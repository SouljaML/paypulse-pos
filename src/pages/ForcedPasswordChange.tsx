import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { changePassword, ApiError } from '../lib/api'

/**
 * Shown, instead of the whole app, to a teller who signed in with a temporary
 * password after a reset. The server refuses everything else until a new
 * password is chosen, so there is nothing to fall back to.
 */
export function ForcedPasswordChange() {
  const { logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (next.length < 8) return setError('Your new password needs at least 8 characters')
    if (next !== confirm) return setError("The two new passwords don't match")
    setBusy(true)
    try {
      await changePassword(current, next)
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not change the password. Try again.')
    } finally {
      setBusy(false)
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
      <div style={{ background: 'var(--paper-raised)', borderRadius: 16, padding: 24 }}>
        {done ? (
          <>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Password changed</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>Sign in again with your new password.</p>
            <button onClick={logout} style={{ ...primaryButtonStyle, marginTop: 8 }}>
              Sign in again
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>Choose a new password</div>
            <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: '4px 0 20px' }}>
              You signed in with a temporary password. Choose your own to continue.
            </p>

            <label htmlFor="fp-current" style={labelStyle}>Temporary password</label>
            <input id="fp-current" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required style={inputStyle} />

            <label htmlFor="fp-new" style={{ ...labelStyle, marginTop: 16 }}>New password</label>
            <input id="fp-new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required style={inputStyle} />

            <label htmlFor="fp-confirm" style={{ ...labelStyle, marginTop: 16 }}>Confirm new password</label>
            <input id="fp-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />

            {error && (
              <div style={{ fontSize: 14, color: 'var(--status-bad)', background: 'var(--status-bad-bg)', borderRadius: 8, padding: '10px 12px', marginTop: 16 }}>
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} style={{ ...primaryButtonStyle, marginTop: 20 }}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
            <button type="button" onClick={logout} style={linkStyle}>
              Sign out
            </button>
          </form>
        )}
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
const linkStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  marginTop: 14,
  padding: '10px 0',
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 14,
  cursor: 'pointer',
}
