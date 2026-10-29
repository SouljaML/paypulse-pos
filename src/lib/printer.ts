// Receipt printing.
//
// Two ways to print, chosen by the kind of device:
//   - phone / tablet : a paired Bluetooth ESC/POS printer (58 mm)
//   - POS terminal   : the printer built into the machine (vendor driver)
//
// Either way the receipt is drawn as a picture (see receipt.ts) and the
// picture is what gets printed, so the slip matches the preview exactly.

import { CapacitorThermalPrinter } from 'capacitor-thermal-printer'
import { isNative } from './device'
import { getDeviceProfile, profileLabel } from './terminal'
import { IposPrinter } from './iposPrinter'
import { receiptToDataUrl, type ReceiptData } from './receipt'

export type { ReceiptData } from './receipt'

export interface SavedPrinter {
  name: string
  address: string
}

const KEY = 'paypulse_printer'

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

/** True when this device needs no Bluetooth printer set-up (built-in printer). */
export async function hasBuiltInPrinter(): Promise<boolean> {
  return (await getDeviceProfile()).cls === 'terminal'
}

/** Start looking for Bluetooth printers. Returns a function that stops the scan. */
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

// ---- drivers ---------------------------------------------------------------

async function printPictureBluetooth(dataUrl: string): Promise<void> {
  await ensureConnected()
  await CapacitorThermalPrinter.begin().align('center').image(dataUrl).feedCutPaper().write()
}

async function printPictureBuiltIn(dataUrl: string): Promise<void> {
  const p = await getDeviceProfile()
  if (p.vendor === 'ipos' || p.vendor === 'alps') {
    await IposPrinter.printImage({ data: dataUrl, size: 16 })
    return
  }
  // Other terminal makers need their own driver; add it here.
  throw new Error(
    `The built-in printer driver for ${profileLabel(p)} isn't installed yet. ` +
      `Send this model name to PayPulse support.`,
  )
}

async function printPicture(dataUrl: string): Promise<void> {
  if (await hasBuiltInPrinter()) return printPictureBuiltIn(dataUrl)
  return printPictureBluetooth(dataUrl)
}

// ---- public ----------------------------------------------------------------

export async function printReceiptText(r: ReceiptData): Promise<void> {
  await printPicture(receiptToDataUrl(r))
}

export async function printTestPage(): Promise<void> {
  const p = await getDeviceProfile()
  const { SAMPLE_RECEIPT } = await import('./receipt')
  await printPicture(receiptToDataUrl({ ...SAMPLE_RECEIPT, tillLabel: `Test print - ${profileLabel(p)}` }))
}
