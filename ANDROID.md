# PayPulse POS — Android app (Capacitor)

The same React POS, packaged as a native Android app with a secure device
credential and Bluetooth receipt printing. This replaces the old
`paypulse-pos-android` TWA wrapper, which can't hold a protected credential.

## One-time setup (your Mac)

Needs Android Studio (Ladybug or newer) with JDK 21 and an Android SDK.

```bash
cd paypulse-pos
npm install
```

## Local testing on a phone (same wifi as your computer)

1. **Backend** — listen on the network, not just localhost:
   ```bash
   cd paypulse
   python scripts/init_db.py          # creates the new `devices` table
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
   In `paypulse/.env` add the app's origin to `CORS_ORIGINS`:
   `CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost`
2. **App** — point it at your computer's LAN address in `paypulse-pos/.env`:
   `VITE_API_BASE_URL=http://192.168.x.x:8000`
3. Build and open:
   ```bash
   npm run android:sync:local
   npm run android:open
   ```
   In Android Studio press Run with the phone attached over USB (USB
   debugging on), or Build → Build APK(s) and copy the APK across.
4. In the portal, **Devices → Register device**, then type the code into the app.

`android:sync:local` allows plain http for testing. For a real deployment use
`npm run android:sync` (https only) with an https `VITE_API_BASE_URL`.

## Printer

Pair the Bluetooth printer once in Android's settings, then in the app tap
**Printer → Scan**, pick it, and **Test print**.

## Browser testing (no enrolment)

Backend `.env`: `REQUIRE_REGISTERED_DEVICES=false`; POS `.env`:
`VITE_REQUIRE_ENROLLMENT=false`.
