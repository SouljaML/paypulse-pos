/**
 * A unique key per transaction attempt, so a retried request can't create a
 * duplicate on the backend.
 *
 * crypto.randomUUID() only exists in secure contexts (https or localhost). A
 * phone opening the dev server at http://192.168.x.x:5173 is NOT one, so
 * calling it there throws and Submit silently fails. getRandomValues works
 * everywhere, so fall back to building a v4 UUID from it.
 */
export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40 // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // RFC 4122 variant
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
