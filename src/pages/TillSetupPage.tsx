import { useEffect, useState } from 'react'
import { useAuth, setPairedTill } from '../lib/auth'
import { listTills, type Till } from '../lib/api'

export function TillSetupPage({ onPaired }: { onPaired: () => void }) {
  const { decoded } = useAuth()
  const [tills, setTills] = useState<Till[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!decoded?.merchant_id) return
    listTills(decoded.merchant_id)
      .then((all) => {
        // A teller only ever sees their own shop's tills to pick from — an
        // owner using this app (no single shop_id) sees every till and
        // picks whichever one this phone physically sits at.
        const relevant = decoded.shop_id ? all.filter((t) => t.shop_id === decoded.shop_id) : all
        setTills(relevant)
      })
      .catch((err) => setError(err.message))
  }, [decoded])

  function handlePick(till: Till) {
    setPairedTill(till.till_identifier)
    onPaired()
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Which till is this phone?</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 4 }}>
          One-time setup — you won't see this again on this device.
        </div>
      </div>

      {error && (
        <div
          style={{
            fontSize: 14,
            color: 'var(--status-bad)',
            background: 'var(--status-bad-bg)',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
          }}
        >
          {error}
        </div>
      )}

      {!tills ? (
        <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 40 }}>Loading tills…</div>
      ) : tills.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
          No tills registered for your shop yet. Ask your manager to register one in the web portal first.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tills.map((t) => (
            <button
              key={t.id}
              onClick={() => handlePick(t)}
              disabled={t.status === 'blocked'}
              style={{
                ...tillButtonStyle,
                opacity: t.status === 'blocked' ? 0.5 : 1,
              }}
            >
              <span style={{ fontWeight: 600 }}>{t.label}</span>
              <span className="num" style={{ fontSize: 13, color: 'var(--text-dim)' }}>
                {t.till_identifier}
                {t.status === 'blocked' ? ' — blocked' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const tillButtonStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '16px 18px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  cursor: 'pointer',
  textAlign: 'left',
}
