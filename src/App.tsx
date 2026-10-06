import { useState } from 'react'
import { useAuth, getPairedTill, clearPairedTill } from './lib/auth'
import { LoginPage } from './pages/LoginPage'
import { TillSetupPage } from './pages/TillSetupPage'
import { TransactionPage } from './pages/TransactionPage'

export default function App() {
  const { decoded, logout } = useAuth()
  const [pairingVersion, setPairingVersion] = useState(0)

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

  // pairingVersion exists purely to force a re-check of localStorage after
  // TillSetupPage writes to it, or after "Change till" clears it — neither
  // of those is React state on its own, so nothing would otherwise trigger
  // a re-render when the paired till changes.
  const paired = getPairedTill()

  if (!paired) {
    return <TillSetupPage key={pairingVersion} onPaired={() => setPairingVersion((n) => n + 1)} />
  }

  function handleRepair() {
    clearPairedTill()
    setPairingVersion((n) => n + 1)
  }

  return <TransactionPage key={pairingVersion} onRepair={handleRepair} />
}
