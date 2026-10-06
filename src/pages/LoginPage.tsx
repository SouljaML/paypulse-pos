import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      // No navigation needed: App.tsx picks the next screen from auth state,
      // so a successful login re-renders straight into the till/transaction view.
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.')
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
      <div style={{ marginBottom: 40, textAlign: 'center' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 26, letterSpacing: 0.2 }}>PayPulse</div>
        <div style={{ color: 'var(--text-dim)', fontSize: 14, marginTop: 2 }}>Point of sale</div>
      </div>

      <form onSubmit={handleSubmit} style={{ background: 'var(--paper-raised)', borderRadius: 16, padding: 24 }}>
        <label htmlFor="login-email" style={labelStyle}>Email</label>
        <input
          id="login-email"
          autoComplete="username"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
          style={inputStyle}
        />

        <label htmlFor="login-password" style={{ ...labelStyle, marginTop: 16 }}>Password</label>
        <input
          id="login-password"
          autoComplete="current-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={inputStyle}
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

        <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, marginTop: 20 }}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  color: 'var(--text-dim)',
  marginBottom: 6,
}

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
