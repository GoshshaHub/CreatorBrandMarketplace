import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

/**
 * Supports Firebase private keys stored as:
 *
 * 1. A normal multiline PEM value
 * 2. A one-line value containing literal \n sequences
 * 3. A JSON-quoted value copied from a service-account file
 */
function normalizePrivateKey(value: string): string {
  let key = value.trim();

  /*
   * When the environment value was copied as a JSON string,
   * JSON.parse safely removes surrounding quotes and converts
   * escaped line breaks.
   */
  if (key.startsWith('"') && key.endsWith('"')) {
    try {
      const parsed = JSON.parse(key);

      if (typeof parsed === "string") {
        key = parsed;
      }
    } catch {
      key = key.slice(1, -1);
    }
  } else if (
    key.startsWith("'") &&
    key.endsWith("'")
  ) {
    key = key.slice(1, -1);
  }

  /*
   * Support literal escaped line breaks commonly stored in
   * environment-variable dashboards and local env files.
   */
  return key
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "")
    .replace(/\r/g, "")
    .trim();
}

function getFirebaseAdminApp() {
  const existingApps = getApps();

  if (existingApps.length > 0) {
    return existingApps[0];
  }

  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim();

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL?.trim();

  const rawPrivateKey =
    process.env.FIREBASE_PRIVATE_KEY;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET?.trim();

  /*
   * Use the explicit Firebase service-account credentials
   * whenever all required values are configured.
   */
  if (
    projectId &&
    clientEmail &&
    rawPrivateKey
  ) {
    const privateKey =
      normalizePrivateKey(rawPrivateKey);

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket:
        storageBucket || undefined,
    });
  }

  /*
   * This fallback supports environments that provide Google
   * Application Default Credentials automatically.
   */
  return initializeApp({
    credential: applicationDefault(),
    storageBucket:
      storageBucket || undefined,
  });
}

const adminApp =
  getFirebaseAdminApp();

export const adminDb =
  getFirestore(adminApp);

export const adminStorage =
  getStorage(adminApp);

export const adminAuth =
  getAuth(adminApp);