// The PayPulse mark: a P whose coin bowl gathers payment streams.
// Small sizes use a simplified, heavier version so it stays legible.
export function LogoMark({ size = 32 }: { size?: number }) {
  const small = size <= 44
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="PayPulse" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="100" height="100" rx="24" fill="#0E1B2C" />
      {small ? (
        <g transform="translate(7.25 -2.00)"><path d="M36 78V26H52A21 21 0 0 1 52 68H36" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="13" /><path d="M8 38H24" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" /><path d="M8 62H24" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="7" /><circle cx="54" cy="47" r="8.5" fill="#2EE6A6" /></g>
      ) : (
        <g transform="translate(7.25 -2.00)"><path d="M36 78V26H52A21 21 0 0 1 52 68H36" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="10" /><path d="M10 40H26" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" /><path d="M10 60H26" fill="none" stroke="#2EE6A6" strokeLinecap="round" strokeLinejoin="round" strokeWidth="5" /><circle cx="54" cy="47" r="8" fill="#2EE6A6" /></g>
      )}
    </svg>
  )
}
