import { createContext, useContext, useState, type ReactNode } from 'react'
import { login as apiLogin, decodeToken, ApiError, type DecodedToken } from './api'

interface AuthState {
  token: string | null
  decoded: DecodedToken | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)
const STORAGE_KEY = 'paypulse_pos_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY))
  const [decoded, setDecoded] = useState<DecodedToken | null>(() => {
    const existing = localStorage.getItem(STORAGE_KEY)
    if (!existing) return null
    try {
      const d = decodeToken(existing)
      if (d.exp * 1000 < Date.now()) {
        localStorage.removeItem(STORAGE_KEY)
        return null
      }
      return d
    } catch {
      return null
    }
  })

  async function login(username: string, password: string) {
    const newToken = await apiLogin(username, password)
    const newDecoded = decodeToken(newToken)
    // Turned away here, before any session is kept, so the person stays on
    // the login form with the reason shown — rather than landing on a screen
    // that has no way back.
    if (!newDecoded.merchant_id) {
      throw new ApiError(403, "This app is for merchant staff only. Your account isn't linked to a merchant.")
    }
    localStorage.setItem(STORAGE_KEY, newToken)
    setToken(newToken)
    setDecoded(newDecoded)
  }

  function logout() {
    localStorage.removeItem(STORAGE_KEY)
    setToken(null)
    setDecoded(null)
    // Deliberately NOT clearing the paired till here — the till is a
    // property of this physical device, not of who's currently signed in.
    // The next teller to log in on this same phone should inherit the same
    // pairing, not have to re-pair it.
  }

  return <AuthContext.Provider value={{ token, decoded, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// ---- Till pairing (per-device, survives logout/login of different tellers) ----

const TILL_STORAGE_KEY = 'paypulse_pos_till_identifier'

export function getPairedTill(): string | null {
  return localStorage.getItem(TILL_STORAGE_KEY)
}

export function setPairedTill(tillIdentifier: string) {
  localStorage.setItem(TILL_STORAGE_KEY, tillIdentifier)
}

export function clearPairedTill() {
  localStorage.removeItem(TILL_STORAGE_KEY)
}
