// Tells a phone from a purpose-built POS terminal.
//
// Terminals (Sunmi, PAX, Newland, Urovo...) have the printer built in, so the
// app must not go looking for a Bluetooth printer on them. Phones and tablets
// still use a paired Bluetooth printer.

import { Device } from '@capacitor/device'
import { isNative } from './device'
import { IposPrinter } from './iposPrinter'

export type DeviceClass = 'terminal' | 'phone'

export interface DeviceProfile {
  cls: DeviceClass
  manufacturer: string
  model: string
  vendor: TerminalVendor | null
}

export type TerminalVendor =
  | 'sunmi'
  | 'pax'
  | 'newland'
  | 'urovo'
  | 'imin'
  | 'telpo'
  | 'landi'
  | 'ingenico'
  | 'verifone'
  | 'nexgo'
  | 'cloudwalk'
  | 'topwise'
  | 'alps'
  | 'ipos'
  | 'other'

// Manufacturer (or model) fragments that only appear on payment terminals.
const VENDORS: Array<[TerminalVendor, RegExp]> = [
  ['sunmi', /sunmi/i],
  ['pax', /\bpax\b|^a(80|90|92|920|930|35|50)/i],
  ['newland', /newland|\bn(700|910|950)\b/i],
  ['urovo', /urovo/i],
  ['imin', /\bimin\b/i],
  ['telpo', /telpo/i],
  ['landi', /landi/i],
  ['ingenico', /ingenico/i],
  ['verifone', /verifone/i],
  ['nexgo', /nexgo/i],
  ['cloudwalk', /cloudwalk/i],
  ['topwise', /topwise/i],
  ['alps', /alps|\bq2i\b/i],
]

export function classify(manufacturer: string, model: string): DeviceProfile {
  const hay = `${manufacturer} ${model}`
  for (const [vendor, re] of VENDORS) {
    if (re.test(hay)) return { cls: 'terminal', manufacturer, model, vendor }
  }
  return { cls: 'phone', manufacturer, model, vendor: null }
}

let cached: DeviceProfile | null = null

export async function getDeviceProfile(): Promise<DeviceProfile> {
  if (cached) return cached
  if (!isNative()) {
    cached = { cls: 'phone', manufacturer: 'browser', model: 'browser', vendor: null }
    return cached
  }
  try {
    const info = await Device.getInfo()
    cached = classify(info.manufacturer ?? '', info.model ?? '')
    // Any device running the iPOS printer service has a built-in printer.
    if (cached.cls === 'phone') {
      try {
        if ((await IposPrinter.isAvailable()).available) cached = { ...cached, cls: 'terminal', vendor: 'ipos' }
      } catch {
        // plugin not in this build
      }
    }
  } catch {
    cached = { cls: 'phone', manufacturer: '', model: '', vendor: null }
  }
  return cached
}

/** "Sunmi V2s" style label for screens. */
export function profileLabel(p: DeviceProfile): string {
  const m = p.manufacturer ? p.manufacturer.charAt(0).toUpperCase() + p.manufacturer.slice(1) : ''
  return `${m} ${p.model}`.trim() || 'Unknown device'
}
