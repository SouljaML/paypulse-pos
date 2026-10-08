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
    // The device registration is deliberately NOT cleared here: it belongs to
    // this physical phone, not to whoever is signed in. The next teller on
    // the same phone just logs in.
  }

  return <AuthContext.Provider value={{ token, decoded, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
