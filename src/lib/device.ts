// This phone's / terminal's identity with PayPulse.
//
// After enrolment the server hands the app a long random device token. It is
// kept in the Android Keystore-backed secure store (not localStorage, which
// anyone with file access to the app could read) and sent as X-Device-Token
// on every request. The server refuses tellers and payments without it, and
// revoking the device in the portal kills it on the next request.
//
// In a desktop browser (development) there's no Keystore, so it falls back
// to localStorage — fine for local testing, which is the only place a
// browser should ever be used with enforcement off.

import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { Device } from '@capacitor/device'
import { App as CapApp } from '@capacitor/app'

export const isNative = (): boolean => Capacitor.isNativePlatform()

// Set VITE_REQUIRE_ENROLLMENT=false in .env only when the backend also has
// REQUIRE_REGISTERED_DEVICES=false (browser testing on a dev machine).
export const enrollmentRequired = (): boolean => import.meta.env.VITE_REQUIRE_ENROLLMENT !== 'false'

export interface DeviceInfo {
  device_id: string
  label: string
  merchant_id: string | null
  shop_id: string | null
  status?: 'active' | 'suspended' | string
  assigned?: boolean
  shop_name: string | null
  till_id: string | null
  till_identifier: string | null
  till_label: string | null
}

const TOKEN_KEY = 'device_token'
const INFO_KEY = 'device_info'

let token: string | null = null
let info: DeviceInfo | null = null

async function read(key: string): Promise<string | null> {
  if (isNative()) {
    const v = await SecureStorage.get(key)
    return typeof v === 'string' ? v : null
  }
  return localStorage.getItem('paypulse_' + key)
}

async function write(key: string, value: string): Promise<void> {
  if (isNative()) await SecureStorage.set(key, value)
  else localStorage.setItem('paypulse_' + key, value)
}

async function remove(key: string): Promise<void> {
  if (isNative()) {
    try {
      await SecureStorage.remove(key)
    } catch {
      // nothing stored under that key
    }
  } else {
    localStorage.removeItem('paypulse_' + key)
  }
}

/** Load the stored credential into memory. Call once, before rendering. */
export async function initDevice(): Promise<void> {
  try {
    token = await read(TOKEN_KEY)
    const raw = await read(INFO_KEY)
    info = raw ? (JSON.parse(raw) as DeviceInfo) : null
  } catch {
    token = null
    info = null
  }
}

export const getDeviceToken = (): string | null => token
export const getDeviceInfo = (): DeviceInfo | null => info

export async function saveEnrollment(newToken: string, newInfo: DeviceInfo): Promise<void> {
  await write(TOKEN_KEY, newToken)
  await write(INFO_KEY, JSON.stringify(newInfo))
  token = newToken
  info = newInfo
}

export async function saveDeviceInfo(newInfo: DeviceInfo): Promise<void> {
  await write(INFO_KEY, JSON.stringify(newInfo))
  info = newInfo
}

export async function clearEnrollment(): Promise<void> {
  await remove(TOKEN_KEY)
  await remove(INFO_KEY)
  token = null
  info = null
}

export interface HardwareInfo {
  hardware_id?: string
  platform: string
  model?: string
  os_version?: string
  app_version?: string
}

export async function readHardwareInfo(): Promise<HardwareInfo> {
  if (!isNative()) return { platform: 'web', model: navigator.userAgent.slice(0, 140) }
  const [id, details, app] = await Promise.all([Device.getId(), Device.getInfo(), CapApp.getInfo()])
  return {
    hardware_id: id.identifier,
    platform: details.platform,
    model: [details.manufacturer, details.model].filter(Boolean).join(' '),
    os_version: details.osVersion,
    app_version: app.version,
  }
}
