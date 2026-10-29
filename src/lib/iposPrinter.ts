// Bridge to the terminal's built-in printer (iPOS printer service).
// The native side is android/app/src/main/java/com/paypulse/pos/IposPrinterPlugin.java

import { registerPlugin } from '@capacitor/core'

export interface IposPrinterPlugin {
  isAvailable(): Promise<{ available: boolean }>
  status(): Promise<{ code: number; ok: boolean; message: string }>
  /** data: a PNG as a data URL. size: width in 24-dot units (16 = full 58 mm). */
  printImage(opts: { data: string; size?: number }): Promise<void>
}

export const IposPrinter = registerPlugin<IposPrinterPlugin>('IposPrinter')
