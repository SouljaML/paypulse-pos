import { useState, type FormEvent } from 'react'
import { enrollDevice, ApiError } from '../lib/api'
import { readHardwareInfo, saveEnrollment } from '../lib/device'

export function EnrollPage({ onEnrolled }: { onEnrolled: () => void }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const hw = await readHardwareInfo()
      const { device_token, ...info } = await enrollDevice(code.trim(), hw)
      await saveEnrollment(device_token, info)
      onEnrolled()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach PayPulse. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 24px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 26 }}>Register this device</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 6 }}>
          Ask your manager to register this device in the PayPulse portal, then enter the code they get.
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: 'var(--paper-raised)', borderRadius: 16, padding: 24 }}>
        <label htmlFor="enroll-code" style={labelStyle}>
          Enrolment code
        </label>
        <input
          id="enroll-code"
          className="num"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          style={{ ...inputStyle, fontSize: 22, letterSpacing: 3, textAlign: 'center' }}
        />

        {error && (
          <div
            style={{
              fontSize: 14,
              color: 'var(--status-bad)',
              background: 'var(--status-bad-bg)',
              borderRadius: 8,
              padding: '10px 12px',
              marginTop: 16,
            }}
          >
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting || code.trim().length < 8} style={{ ...primaryButtonStyle, marginTop: 20 }}>
          {submitting ? 'Registering…' : 'Register device'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--text-dim)', marginBottom: 6 }
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1px solid var(--hairline)',
  borderRadius: 10,
  background: 'var(--paper)',
}
const primaryButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '15px 0',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 600,
  cursor: 'pointer',
}
