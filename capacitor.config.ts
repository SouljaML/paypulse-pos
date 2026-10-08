import type { CapacitorConfig } from '@capacitor/cli'

// LOCAL TESTING (npm run android:sync:local) lets the app talk to a backend
// over plain http on your wifi. That is never acceptable for a real
// deployment, so the default (npm run android:sync) keeps the WebView on
// https and refuses cleartext traffic.
const local = process.env.PAYPULSE_LOCAL === '1'

const config: CapacitorConfig = {
  appId: 'com.paypulse.pos',
  appName: 'PayPulse POS',
  webDir: 'dist',
  server: local ? { androidScheme: 'http', cleartext: true } : { androidScheme: 'https' },
  android: {
    allowMixedContent: false,
  },
}

export default config
