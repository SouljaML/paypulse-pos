import { getDeviceToken, type DeviceInfo, type HardwareInfo } from './device'

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

export class ApiError extends Error {
  status: number
  // Machine-readable reason for device refusals, e.g. "device_not_registered".
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// FastAPI's `detail` is a string for most errors, and an object
// {code, message} for device refusals.
function parseDetail(body: unknown, fallback: string): { message: string; code?: string } {
  const detail = (body as { detail?: unknown } | null)?.detail
  if (typeof detail === 'string') return { message: detail }
  if (detail && typeof detail === 'object' && 'message' in detail) {
    const d = detail as { message: string; code?: string }
    return { message: d.message, code: d.code }
  }
  if (detail !== undefined) return { message: JSON.stringify(detail) }
  return { message: fallback }
}

// Fired when the server says this device is no longer registered, so the app
// can drop back to the enrolment screen.
export const DEVICE_REJECTED_EVENT = 'paypulse:device-rejected'

function deviceHeaders(): Record<string, string> {
  const t = getDeviceToken()
  return t ? { 'X-Device-Token': t } : {}
}

function getToken(): string | null {
  return localStorage.getItem('paypulse_pos_token')
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...deviceHeaders(),
    ...((options.headers as Record<string, string>) ?? {}),
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (!res.ok) {
    let parsed = { message: res.statusText } as { message: string; code?: string }
    try {
      parsed = parseDetail(await res.json(), res.statusText)
    } catch {
      // not JSON — fall back to statusText
    }
    if (parsed.code === 'device_not_registered') window.dispatchEvent(new Event(DEVICE_REJECTED_EVENT))
    throw new ApiError(res.status, parsed.message, parsed.code)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

// ---- Auth ----

export async function login(username: string, password: string): Promise<string> {
  const body = new URLSearchParams({ username, password })
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...deviceHeaders() },
    body,
  })
  if (!res.ok) {
    let parsed: { message: string; code?: string } = { message: 'Login failed' }
    try {
      parsed = parseDetail(await res.json(), 'Login failed')
    } catch {
      // ignore
    }
    if (parsed.code === 'device_not_registered') window.dispatchEvent(new Event(DEVICE_REJECTED_EVENT))
    throw new ApiError(res.status, parsed.message, parsed.code)
  }
  const data = await res.json()
  return data.access_token as string
}

export const changePassword = (current_password: string, new_password: string) =>
  request<{ detail: string }>('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ current_password, new_password }),
  })

export interface DecodedToken {
  sub: string
  role: string
  merchant_id: string | null
  shop_id: string | null
  must_change_password?: boolean
  exp: number
}

export function decodeToken(token: string): DecodedToken {
  const payload = token.split('.')[1]
  return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
}

// ---- Device enrolment ----

export interface EnrollResponse extends DeviceInfo {
  device_token: string
}

export async function enrollDevice(code: string, hw: HardwareInfo): Promise<EnrollResponse> {
  const res = await fetch(`${API_BASE}/devices/enroll`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, ...hw }),
  })
  if (!res.ok) {
    let parsed = { message: 'Could not register this device' } as { message: string; code?: string }
    try {
      parsed = parseDetail(await res.json(), parsed.message)
    } catch {
      // ignore
    }
    throw new ApiError(res.status, parsed.message, parsed.code)
  }
  return res.json() as Promise<EnrollResponse>
}

/** Is this device still registered? Throws ApiError(401) if it was revoked. */
export const getDeviceMe = () => request<EnrollResponse>('/devices/me')

// ---- Providers (platform-wide catalog — not shop-scoped) ----

export interface Provider {
  id: string
  name: string
  adapter_key: string
  status: 'active' | 'disabled'
  // True for a provider whose collection flow needs a human-entered OTP as
  // a second step (currently only C-Pay) rather than resolving via push +
  // callback (M-Pesa, EcoCash). Drives whether TransactionPage shows an
  // OTP-entry screen after the initial submit.
  requires_otp: boolean
}

export const listProviders = () => request<Provider[]>('/providers')

// ---- Provider accounts (already shop-scoped server-side for a teller) ----

export interface ProviderAccount {
  id: string
  provider_adapter_key: string
  provider_name: string
  account_identifier: string
  is_active: boolean
}

export const listProviderAccounts = (merchantId: string) =>
  request<ProviderAccount[]>(`/merchants/${merchantId}/provider-accounts`)

// ---- Tills (for the one-time device pairing step) ----

export interface Till {
  id: string
  shop_id: string
  till_identifier: string
  label: string
  status: 'active' | 'blocked'
}

export const listTills = (merchantId: string) => request<Till[]>(`/merchants/${merchantId}/tills`)

// ---- Transactions ----

export type TransactionStatus =
  | 'initiated'
  | 'sent_to_provider'
  | 'pending_confirmation'
  | 'confirmed'
  | 'declined'
  | 'expired'
  | 'failed'

export interface Transaction {
  id: string
  status: TransactionStatus
  provider_reference: string | null
  amount: string
  currency: string
  customer_msisdn: string
  created_at: string
  confirmed_at: string | null
  decline_reason: string | null
}

export interface CreateTransactionInput {
  provider_adapter_key: string
  merchant_provider_account_id: string
  customer_msisdn: string
  amount: string
  idempotency_key: string
}

export const createTransaction = (input: CreateTransactionInput) =>
  request<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(input) })

export const getTransaction = (transactionId: string) => request<Transaction>(`/transactions/${transactionId}`)

// Second step for a requires_otp provider (currently only C-Pay): the
// customer received an OTP by SMS after createTransaction() returned
// PENDING, the teller asks for it, and this resolves the transaction —
// synchronously. The response IS the final result; no polling needed
// afterward the way the push-based providers require.
export const confirmTransactionOtp = (transactionId: string, otp: string) =>
  request<Transaction>(`/transactions/${transactionId}/confirm-otp`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  })

export const printReceipt = (transactionId: string) =>
  request<{ receipt_number: string; transaction: Transaction }>(`/transactions/${transactionId}/receipt`, {
    method: 'POST',
  })
