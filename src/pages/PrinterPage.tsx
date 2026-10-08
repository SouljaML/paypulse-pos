import { useEffect, useRef, useState } from 'react'
import {
  connectPrinter,
  forgetPrinter,
  getSavedPrinter,
  printTestPage,
  savePrinter,
  scanForPrinters,
  type SavedPrinter,
} from '../lib/printer'

export function PrinterPage({ onClose }: { onClose: () => void }) {
  const [saved, setSaved] = useState<SavedPrinter | null>(getSavedPrinter())
  const [found, setFound] = useState<SavedPrinter[]>([])
  const [scanning, setScanning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const stopRef = useRef<null | (() => Promise<void>)>(null)

  useEffect(() => {
    return () => {
      stopRef.current?.().catch(() => {})
    }
  }, [])

  async function handleScan() {
    setMessage(null)
    setFound([])
    setScanning(true)
    try {
      await stopRef.current?.()
      stopRef.current = await scanForPrinters(
        (devices) => setFound(devices),
        () => setScanning(false),
      )
    } catch (err) {
      setScanning(false)
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not start scanning. Is Bluetooth on?' })
    }
  }

  async function handlePick(p: SavedPrinter) {
    setBusy(p.address)
    setMessage(null)
    try {
      if (!(await connectPrinter(p))) throw new Error(`Couldn't connect to ${p.name}. Pair it in Android settings first.`)
      savePrinter(p)
      setSaved(p)
      setMessage({ tone: 'good', text: `Connected to ${p.name}.` })
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not connect.' })
    } finally {
      setBusy(null)
    }
  }

  async function handleTest() {
    setBusy('test')
    setMessage(null)
    try {
      await printTestPage()
      setMessage({ tone: 'good', text: 'Test page sent.' })
    } catch (err) {
      setMessage({ tone: 'bad', text: err instanceof Error ? err.message : 'Could not print.' })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: 24, paddingTop: 'calc(24px + env(safe-area-inset-top, 0px))' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 20 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 20 }}>Receipt printer</div>
        <button onClick={onClose} style={linkStyle}>
          Done
        </button>
      </div>

      <div style={{ color: 'var(--text-dim)', fontSize: 14, marginBottom: 16 }}>
        {saved ? (
          <>
            Using <strong style={{ color: '#fff' }}>{saved.name}</strong>
          </>
        ) : (
          'No printer chosen yet. Switch your Bluetooth printer on, then scan.'
        )}
      </div>

      {message && (
        <div
          style={{
            fontSize: 14,
            color: `var(--status-${message.tone})`,
            background: `var(--status-${message.tone}-bg)`,
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
          }}
        >
          {message.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button onClick={handleScan} disabled={scanning} style={buttonStyle}>
          {scanning ? 'Scanning…' : 'Scan for printers'}
        </button>
        {saved && (
          <button onClick={handleTest} disabled={busy === 'test'} style={buttonStyle}>
            {busy === 'test' ? 'Printing…' : 'Test print'}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {found.map((p) => (
          <button key={p.address} onClick={() => handlePick(p)} disabled={busy === p.address} style={deviceStyle}>
            <span style={{ fontWeight: 600 }}>{p.name || 'Unnamed printer'}</span>
            <span className="num" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              {busy === p.address ? 'Connecting…' : p.address}
            </span>
          </button>
        ))}
        {!scanning && found.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>
            Printers appear here. If yours doesn't, pair it once in Android's Bluetooth settings and scan again.
          </div>
        )}
      </div>

      {saved && (
        <button
          onClick={() => {
            forgetPrinter()
            setSaved(null)
          }}
          style={{ ...linkStyle, marginTop: 24, alignSelf: 'flex-start' }}
        >
          Forget this printer
        </button>
      )}
    </div>
  )
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--text-dim)',
  fontSize: 14,
  cursor: 'pointer',
  padding: 0,
}
const buttonStyle: React.CSSProperties = {
  flex: 1,
  padding: '13px 0',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 10,
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
}
const deviceStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 4,
  padding: '14px 16px',
  background: 'var(--paper-raised)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  cursor: 'pointer',
  textAlign: 'left',
}
