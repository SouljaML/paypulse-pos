import { useState } from 'react'
import type { ProviderAccount } from '../lib/api'

// Badge colours used until an official logo file is dropped into
// public/providers/<slug>.png (see the README there).
const BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  cpay: { bg: '#E8F0FB', fg: '#0B4DA2', label: 'C-Pay' },
  mpesa: { bg: '#E6F4EA', fg: '#1E7B34', label: 'M-Pesa' },
  ecocash: { bg: '#E5F1FA', fg: '#0A5C9E', label: 'EcoCash' },
  khetsi: { bg: '#FBEDE4', fg: '#B4470F', label: 'Khetsi' },
  mywallet: { bg: '#F1E9F8', fg: '#6A2C9B', label: 'MyWallet' },
}

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

function ProviderMark({ name }: { name: string }) {
  const slug = slugOf(name)
  const [missing, setMissing] = useState(false)
  const badge = BADGE[slug]

  if (!missing) {
    return (
      <img
        src={`/providers/${slug}.png`}
        alt=""
        onError={() => setMissing(true)}
        style={{ maxWidth: '100%', maxHeight: 34, objectFit: 'contain', display: 'block' }}
      />
    )
  }
  return (
    <span
      style={{
        fontWeight: 700,
        fontSize: 17,
        letterSpacing: -0.2,
        color: badge?.fg ?? '#171a23',
        background: badge?.bg ?? '#eef0f3',
        borderRadius: 8,
        padding: '6px 10px',
      }}
    >
      {badge?.label ?? name}
    </span>
  )
}

export function ProviderPicker({
  accounts,
  value,
  onChange,
}: {
  accounts: ProviderAccount[]
  value: string
  onChange: (id: string) => void
}) {
  // Several accounts for one provider are told apart by their identifier.
  const perProvider: Record<string, number> = {}
  for (const a of accounts) perProvider[a.provider_adapter_key] = (perProvider[a.provider_adapter_key] ?? 0) + 1

  return (
    <div
      role="radiogroup"
      aria-label="Provider"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}
    >
      {accounts.map((a) => {
        const selected = a.id === value
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={a.provider_name}
            onClick={() => onChange(a.id)}
            style={{
              minHeight: 64,
              padding: '10px 8px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: '#fff',
              border: selected ? '2px solid var(--accent)' : '2px solid var(--hairline)',
              boxShadow: selected ? '0 0 0 3px rgba(76,95,213,0.18)' : 'none',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <ProviderMark name={a.provider_name} />
            {perProvider[a.provider_adapter_key] > 1 && (
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{a.account_identifier}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
