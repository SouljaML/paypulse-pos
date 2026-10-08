import { useEffect, useState } from 'react'
import { useAuth } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { EnrollPage } from './pages/EnrollPage'
import { TransactionPage } from './pages/TransactionPage'
import { ForcedPasswordChange } from './pages/ForcedPasswordChange'
import { ApiError, DEVICE_REJECTED_EVENT, getDeviceMe } from './lib/api'
import { clearEnrollment, enrollmentRequired, getDeviceToken, saveDeviceInfo } from './lib/device'

// 'checking' only lasts as long as one request: on start-up a stored
// credential is verified, so a device revoked while it was off is turned away
// before anyone types a password.
type DeviceState = 'checking' | 'enrolled' | 'unenrolled'

export default function App() {
  const { decoded, logout } = useAuth()
  const [deviceState, setDeviceState] = useState<DeviceState>(() => {
    if (!enrollmentRequired()) return 'enrolled'
    return getDeviceToken() ? 'checking' : 'unenrolled'
  })

  useEffect(() => {
    if (deviceState !== 'checking') return
    getDeviceMe()
      .then(({ device_token: _ignored, ...info }) => saveDeviceInfo(info))
      .then(() => setDeviceState('enrolled'))
      .catch(async (err) => {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await clearEnrollment()
          setDeviceState('unenrolled')
        } else {
          // Couldn't reach the server — keep the credential and let the
          // normal login screen report the connection problem.
          setDeviceState('enrolled')
        }
      })
  }, [deviceState])

  // The server can revoke this device at any moment. Its next request then
  // comes back "not registered": confirm, drop the credential, sign out.
  useEffect(() => {
    if (!enrollmentRequired()) return
    async function onRejected() {
      try {
        await getDeviceMe()
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          await clearEnrollment()
          logout()
          setDeviceState('unenrolled')
        }
      }
    }
    window.addEventListener(DEVICE_REJECTED_EVENT, onRejected)
    return () => window.removeEventListener(DEVICE_REJECTED_EVENT, onRejected)
  }, [logout])

  if (deviceState === 'checking') {
    return <div style={{ color: 'var(--text-dim)', textAlign: 'center', marginTop: 80 }}>Checking device…</div>
  }

  if (deviceState === 'unenrolled') return <EnrollPage onEnrolled={() => setDeviceState('enrolled')} />

  if (!decoded) return <LoginPage />

  if (!decoded.merchant_id) {
    return (
      <div style={{ padding: 24, color: '#fff', textAlign: 'center', marginTop: 60 }}>
        <p>This app is for merchant staff only. Your account isn't linked to a merchant.</p>
        <button
          onClick={logout}
          style={{
            marginTop: 20,
            padding: '14px 28px',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    )
  }

  // After a password reset the server refuses everything except changing it,
  // so show that screen instead of an app that would only show errors.
  if (decoded.must_change_password) return <ForcedPasswordChange />

  return <TransactionPage />
}
