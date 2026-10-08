// Bluetooth receipt printing (58 mm ESC/POS thermal printers).
//
// Only works inside the native app; in a browser every function reports that
// printing isn't available. The chosen printer is remembered on the phone.

import { CapacitorThermalPrinter } from 'capacitor-thermal-printer'
import { isNative } from './device'

export interface SavedPrinter {
  name: string
  address: string
}

const KEY = 'paypulse_printer'
const WIDTH = 32 // characters per line on a 58 mm roll

export const printingAvailable = (): boolean => isNative()

export function getSavedPrinter(): SavedPrinter | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as SavedPrinter) : null
  } catch {
    return null
  }
}

export function savePrinter(p: SavedPrinter) {
  localStorage.setItem(KEY, JSON.stringify(p))
}

export function forgetPrinter() {
  localStorage.removeItem(KEY)
}

/** Start looking for printers. Returns a function that stops the scan. */
export async function scanForPrinters(
  onDevices: (devices: SavedPrinter[]) => void,
  onFinish: () => void,
): Promise<() => Promise<void>> {
  const found = await CapacitorThermalPrinter.addListener('discoverDevices', (data) => onDevices(data.devices))
  const done = await CapacitorThermalPrinter.addListener('discoveryFinish', onFinish)
  await CapacitorThermalPrinter.startScan()
  return async () => {
    await found.remove()
    await done.remove()
    try {
      await CapacitorThermalPrinter.stopScan()
    } catch {
      // scan already finished
    }
  }
}

export async function connectPrinter(p: SavedPrinter): Promise<boolean> {
  const device = await CapacitorThermalPrinter.connect({ address: p.address })
  return device !== null
}

async function ensureConnected(): Promise<void> {
  const saved = getSavedPrinter()
  if (!saved) throw new Error('No printer set up. Tap Printer at the top to choose one.')
  if (await CapacitorThermalPrinter.isConnected()) return
  if (!(await connectPrinter(saved))) {
    throw new Error(`Couldn't connect to ${saved.name}. Check it is switched on and in range.`)
  }
}

const rule = '-'.repeat(WIDTH) + '\n'

// ASCII only — thermal printers choke on curly quotes and similar.
function ascii(s: string): string {
  return s.replace(/[^\x20-\x7E]/g, '?')
}

function row(left: string, right: string): string {
  const l = ascii(left)
  const r = ascii(right)
  const gap = Math.max(1, WIDTH - l.length - r.length)
  return l + ' '.repeat(gap) + r + '\n'
}

export interface ReceiptData {
  shopName: string | null
  tillLabel: string | null
  receiptNumber: string
  providerName: string | null
  customerMsisdn: string
  amount: string
  currency: string
  reference: string | null
  confirmedAt: string | null
}

function maskMsisdn(m: string): string {
  const digits = m.replace(/\D/g, '')
  return digits.length > 4 ? '*'.repeat(digits.length - 4) + digits.slice(-4) : digits
}

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date()
  return d.toLocaleString('en-GB', { timeZone: 'Africa/Maseru', dateStyle: 'short', timeStyle: 'short' })
}

export async function printReceiptText(r: ReceiptData): Promise<void> {
  await ensureConnected()
  let job = CapacitorThermalPrinter.begin().align('center').bold().doubleWidth().text('PayPulse\n').clearFormatting()
  if (r.shopName) job = job.text(ascii(r.shopName) + '\n')
  if (r.tillLabel) job = job.text(ascii(r.tillLabel) + '\n')
  job = job
    .text(rule)
    .align('left')
    .text(row('Receipt', r.receiptNumber))
    .text(row('Date', formatDate(r.confirmedAt)))
  if (r.providerName) job = job.text(row('Provider', r.providerName))
  job = job.text(row('Customer', maskMsisdn(r.customerMsisdn)))
  if (r.reference) job = job.text(row('Ref', r.reference))
  await job
    .text(rule)
    .bold()
    .doubleHeight()
    .text(row('TOTAL', `${r.currency} ${r.amount}`))
    .clearFormatting()
    .text(rule)
    .align('center')
    .text('Thank you\n\n\n')
    .cutPaper()
    .write()
}

export async function printTestPage(): Promise<void> {
  await ensureConnected()
  await CapacitorThermalPrinter.begin()
    .align('center')
    .bold()
    .text('PayPulse POS\n')
    .clearFormatting()
    .text('Printer test OK\n\n\n')
    .cutPaper()
    .write()
}
