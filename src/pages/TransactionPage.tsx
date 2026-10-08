import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/auth'
import { getDeviceInfo } from '../lib/device'
import { getSavedPrinter, printReceiptText, printingAvailable } from '../lib/printer'
import { PrinterPage } from './PrinterPage'
import { newIdempotencyKey } from '../lib/uuid'
import {
  createTransaction,
  confirmTransactionOtp,
  getTransaction,
  listProviderAccounts,
  listProviders,
  printReceipt,
  ApiError,
  type ProviderAccount,
  type Transaction,
} from '../lib/api'

type ViewState =
  | { mode: 'form' }
  | { mode: 'pending'; txn: Transaction }
  | { mode: 'awaiting-otp'; txn: Transaction }
  | { mode: 'result'; txn: Transaction }

export function TransactionPage() {
  const { decoded, logout } = useAuth()
  const merchantId = decoded?.merchant_id ?? null

  const [accounts, setAccounts] = useState<ProviderAccount[] | null>(null)
  // adapter_key -> requires_otp, built from GET /providers (platform-wide,
  // not shop-scoped — provider-accounts only gives us provider_adapter_key,
  // not whether that provider needs an OTP step).
  const [otpByAdapterKey, setOtpByAdapterKey] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState<string | null>(null)

  const [msisdn, setMsisdn] = useState('')
  const [accountId, setAccountId] = useState('')
  const [amount, setAmount] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [confirmingOtp, setConfirmingOtp] = useState(false)

  const [view, setView] = useState<ViewState>({ mode: 'form' })
  const [showPrinter, setShowPrinter] = useState(false)
  // Provider of the transaction on screen, kept for the printed receipt
  // (the transaction record itself only carries the provider's id).
  const [lastProviderName, setLastProviderName] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollAttempts = useRef(0)

  useEffect(() => {
    if (!merchantId) return
    Promise.all([listProviderAccounts(merchantId), listProviders()])
      .then(([accs, providers]) => {
        setAccounts(accs)
        if (accs.length > 0) setAccountId(accs[0].id)
        const map: Record<string, boolean> = {}
        for (const p of providers) map[p.adapter_key] = p.requires_otp
        setOtpByAdapterKey(map)
      })
      .catch((err) => setLoadError(err.message))
  }, [merchantId])

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  function resetForm() {
    setMsisdn('')
    setAmount('')
    setSubmitError(null)
    setOtp('')
    setOtpError(null)
    setView({ mode: 'form' })
    pollAttempts.current = 0
    if (pollRef.current) clearInterval(pollRef.current)
  }

  function startPolling(txnId: string) {
    pollAttempts.current = 0
    pollRef.current = setInterval(async () => {
      pollAttempts.current += 1
      try {
        const updated = await getTransaction(txnId)
        if (updated.status !== 'pending_confirmation' && updated.status !== 'sent_to_provider') {
          if (pollRef.current) clearInterval(pollRef.current)
          setView({ mode: 'result', txn: updated })
        } else if (pollAttempts.current >= 60) {
          // ~2 minutes of polling — stop hammering the API; the backend will
          // eventually expire this on its own if nothing ever arrives.
          if (pollRef.current) clearInterval(pollRef.current)
          setView({ mode: 'result', txn: updated })
        }
      } catch {
        // a transient network blip shouldn't abort the whole flow — just try
        // again on the next tick
      }
    }, 2000)
  }

  async function handleSubmit() {
    if (!accountId || !msisdn.trim() || !amount.trim()) return
    const account = accounts?.find((a) => a.id === accountId)
    if (!account) return

    setSubmitting(true)
    setSubmitError(null)
    try {
      const txn = await createTransaction({
        provider_adapter_key: account.provider_adapter_key,
        merchant_provider_account_id: account.id,
        customer_msisdn: msisdn.trim(),
        amount: amount.trim(),
        idempotency_key: newIdempotencyKey(),
      })
      setLastProviderName(account.provider_name)

      const stillInFlight =
        txn.status === 'pending_confirmation' || txn.status === 'sent_to_provider' || txn.status === 'initiated'
      const needsOtp = otpByAdapterKey[account.provider_adapter_key] === true

      if (stillInFlight && needsOtp) {
        // C-Pay-style flow: the customer just got an OTP by SMS. Don't
        // poll — there's nothing to poll for until the teller enters it.
        setOtp('')
        setOtpError(null)
        setView({ mode: 'awaiting-otp', txn })
      } else if (stillInFlight) {
        // Push-based flow (M-Pesa/EcoCash): wait for the customer to
        // approve on their phone, polling until a callback resolves it.
        setView({ mode: 'pending', txn })
        startPolling(txn.id)
      } else {
        // Resolved immediately somehow (e.g. a provider that doesn't need
        // either step) — just show the result.
        setView({ mode: 'result', txn })
      }
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Could not start the transaction. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleConfirmOtp(txnId: string) {
    if (!otp.trim()) return
    setConfirmingOtp(true)
    setOtpError(null)
    try {
      const updated = await confirmTransactionOtp(txnId, otp.trim())
      setView({ mode: 'result', txn: updated })
    } catch (err) {
      // Wrong OTP or a transient failure — let the teller try again with
      // the same transaction rather than restarting the whole payment.
      setOtpError(err instanceof ApiError ? err.message : 'Could not confirm the OTP. Try again.')
    } finally {
      setConfirmingOtp(false)
    }
  }

  async function handlePrintReceipt(txnId: string) {
    try {
      // Issues (or re-fetches) the official receipt number first, so what is
      // printed is always the number the server has on record.
      const res = await printReceipt(txnId)

      if (!printingAvailable()) {
        window.alert(`Receipt ${res.receipt_number} recorded. Printing works in the PayPulse Android app.`)
        return
      }
      if (!getSavedPrinter()) {
        window.alert(`Receipt ${res.receipt_number} recorded, but no printer is set up. Tap Printer at the top.`)
        return
      }
      await printReceiptText({
        shopName: device?.shop_name ?? null,
        tillLabel: device?.till_label ?? device?.label ?? null,
        receiptNumber: res.receipt_number,
        providerName: lastProviderName,
        customerMsisdn: res.transaction.customer_msisdn,
        amount: res.transaction.amount,
        currency: res.transaction.currency,
        reference: res.transaction.provider_reference,
        confirmedAt: res.transaction.confirmed_at,
      })
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not print receipt.')
    }
  }

  const device = getDeviceInfo()

  if (showPrinter) return <PrinterPage onClose={() => setShowPrinter(false)} />

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          paddingTop: 'calc(14px + env(safe-area-inset-top, 0px))',
          background: 'var(--ink)',
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>PayPulse POS</div>
          {device && (
            <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>
              {[device.shop_name, device.till_label ?? device.label].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {printingAvailable() && (
            <button onClick={() => setShowPrinter(true)} style={smallLinkStyle}>
              Printer
            </button>
          )}
          <button onClick={logout} style={smallLinkStyle}>
            Log out
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: 'auto', padding: 20 }}>
        {loadError && <div style={errorBoxStyle}>{loadError}</div>}

        {view.mode === 'form' && (
          <FormView
            accounts={accounts}
            msisdn={msisdn}
            setMsisdn={setMsisdn}
            accountId={accountId}
            setAccountId={setAccountId}
            amount={amount}
            setAmount={setAmount}
            submitting={submitting}
            submitError={submitError}
            onSubmit={handleSubmit}
            onCancel={resetForm}
          />
        )}

        {view.mode === 'pending' && <PendingView txn={view.txn} />}

        {view.mode === 'awaiting-otp' && (
          <AwaitingOtpView
            txn={view.txn}
            otp={otp}
            setOtp={setOtp}
            otpError={otpError}
            confirming={confirmingOtp}
            onConfirm={() => handleConfirmOtp(view.txn.id)}
            onCancel={resetForm}
          />
        )}

        {view.mode === 'result' && (
          <ResultView txn={view.txn} onNewTransaction={resetForm} onPrintReceipt={handlePrintReceipt} />
        )}
      </main>
    </div>
  )
}

function FormView({
  accounts,
  msisdn,
  setMsisdn,
  accountId,
  setAccountId,
  amount,
  setAmount,
  submitting,
  submitError,
  onSubmit,
  onCancel,
}: {
  accounts: ProviderAccount[] | null
  msisdn: string
  setMsisdn: (v: string) => void
  accountId: string
  setAccountId: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  submitting: boolean
  submitError: string | null
  onSubmit: () => void
  onCancel: () => void
}) {
  const canSubmit = msisdn.trim() && accountId && amount.trim() && parseFloat(amount) > 0

  return (
    <div style={{ maxWidth: 420, margin: '0 auto' }}>
      <label htmlFor="txn-msisdn" style={labelStyle}>Customer mobile number</label>
      <input
        id="txn-msisdn"
        type="tel"
        inputMode="numeric"
        value={msisdn}
        onChange={(e) => setMsisdn(e.target.value)}
        placeholder="e.g. 26658123456"
        style={inputStyle}
      />

      <label htmlFor="txn-provider" style={{ ...labelStyle, marginTop: 18 }}>Provider</label>
      {!accounts ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 14, padding: '12px 0' }}>Loading providers…</div>
      ) : accounts.length === 0 ? (
        <div style={{ color: 'var(--status-bad)', fontSize: 14, padding: '12px 0' }}>
          No provider accounts set up for your shop yet.
        </div>
      ) : (
        <select id="txn-provider" value={accountId} onChange={(e) => setAccountId(e.target.value)} style={inputStyle}>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.provider_name} — {a.account_identifier}
            </option>
          ))}
        </select>
      )}

      <label htmlFor="txn-amount" style={{ ...labelStyle, marginTop: 18 }}>Amount (LSL)</label>
      <input
        id="txn-amount"
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0.00"
        style={{ ...inputStyle, fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)' }}
      />

      {submitError && <div style={{ ...errorBoxStyle, marginTop: 16 }}>{submitError}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button onClick={onSubmit} disabled={!canSubmit || submitting} style={primaryButtonStyle(!!canSubmit && !submitting)}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </div>
  )
}

function PendingView({ txn }: { txn: Transaction }) {
  return (
    <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '4px solid var(--status-pending-bg)',
          borderTopColor: 'var(--status-pending)',
          margin: '0 auto 20px',
          animation: 'spin 0.9s linear infinite',
        }}
      />
      <style>{'@keyframes spin { to { transform: rotate(360deg); } }'}</style>
      <div style={{ fontSize: 18, fontWeight: 600 }}>Waiting for confirmation</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>
        LSL {txn.amount} to {txn.customer_msisdn}. The customer needs to approve this on their phone.
      </p>
    </div>
  )
}

function AwaitingOtpView({
  txn,
  otp,
  setOtp,
  otpError,
  confirming,
  onConfirm,
  onCancel,
}: {
  txn: Transaction
  otp: string
  setOtp: (v: string) => void
  otpError: string | null
  confirming: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const canConfirm = otp.trim().length > 0 && !confirming

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 600, marginTop: 20 }}>Enter the OTP</div>
      <p style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 8 }}>
        LSL {txn.amount} — the customer received a code by SMS at {txn.customer_msisdn}. Ask them for it and enter
        it below.
      </p>

      <label htmlFor="txn-otp" style={{ ...labelStyle, marginTop: 24, textAlign: 'left' }}>
        OTP
      </label>
      <input
        id="txn-otp"
        type="text"
        inputMode="numeric"
        autoFocus
        value={otp}
        onChange={(e) => setOtp(e.target.value)}
        placeholder="e.g. 4425"
        style={{ ...inputStyle, fontSize: 22, fontWeight: 600, fontFamily: 'var(--font-mono)', textAlign: 'center' }}
      />

      {otpError && <div style={{ ...errorBoxStyle, marginTop: 16 }}>{otpError}</div>}

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
        <button onClick={onConfirm} disabled={!canConfirm} style={primaryButtonStyle(canConfirm)}>
          {confirming ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    </div>
  )
}

export function ResultView({
  txn,
  onNewTransaction,
  onPrintReceipt,
}: {
  txn: Transaction
  onNewTransaction: () => void
  onPrintReceipt: (id: string) => void
}) {
  const confirmed = txn.status === 'confirmed'
  // Polling gave up while the customer still hadn't answered — that is not a
  // failure, and showing it as one would send the teller off to redo a
  // payment that may still go through.
  const stillWaiting =
    txn.status === 'pending_confirmation' || txn.status === 'sent_to_provider' || txn.status === 'initiated'
  const tone = confirmed ? 'good' : stillWaiting ? 'pending' : 'bad'
  const headline = confirmed
    ? 'Confirmed'
    : stillWaiting
      ? 'Still waiting for the customer'
      : txn.status === 'declined'
        ? 'Declined'
        : txn.status === 'expired'
          ? 'Expired'
          : 'Failed'

  return (
    <div style={{ maxWidth: 420, margin: '40px auto', textAlign: 'center' }}>
      <div
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: `var(--status-${tone})`,
          background: `var(--status-${tone}-bg)`,
          borderRadius: 10,
          padding: '14px 16px',
          marginBottom: 20,
        }}
      >
        {headline}
      </div>

      <div className="num" style={{ fontSize: 26, fontWeight: 700 }}>
        LSL {txn.amount}
      </div>
      <div className="num" style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4 }}>
        {txn.customer_msisdn}
      </div>

      {stillWaiting && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>
          No reply yet. It will update on its own — you can start another transaction, and check this one under Transactions.
        </p>
      )}

      {!confirmed && txn.decline_reason && (
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 12 }}>{txn.decline_reason}</p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 28 }}>
        {confirmed && (
          <button onClick={() => onPrintReceipt(txn.id)} style={secondaryButtonStyle}>
            Print receipt
          </button>
        )}
        <button onClick={onNewTransaction} style={primaryButtonStyle(true)}>
          New transaction
        </button>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--hairline)',
  borderRadius: 10,
  background: 'var(--paper-raised)',
}
const errorBoxStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--status-bad)',
  background: 'var(--status-bad-bg)',
  borderRadius: 8,
  padding: '10px 12px',
}
const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '15px 0',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}
const smallLinkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
}

function primaryButtonStyle(enabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '15px 0',
    background: enabled ? 'var(--accent)' : 'var(--hairline)',
    color: enabled ? '#fff' : 'var(--text-dim)',
    border: 'none',
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: enabled ? 'pointer' : 'not-allowed',
  }
}
