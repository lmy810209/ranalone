import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function initAdmin() {
  if (getApps().length > 0) return getApps()[0];
  return initializeApp({ projectId: 'ahwa-85b70' });
}

initAdmin();
export const adminDb = getFirestore();
