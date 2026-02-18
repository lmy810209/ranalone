import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];

  // Vercel: use service account JSON from env var
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      return initializeApp({ credential: cert(sa) });
    } catch {
      // Fall through to default
    }
  }

  // Firebase Studio / Cloud Functions: ADC auto-configured
  return initializeApp();
}

initAdmin();
export const adminDb = getFirestore();
