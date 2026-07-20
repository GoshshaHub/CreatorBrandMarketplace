import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";

import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function normalizePrivateKey(value: string): string {
  let key = value.trim();

  // Remove one pair of surrounding quotes, if present.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  // Convert escaped line breaks, then trim again to remove
  // the trailing newline commonly included in Firebase JSON keys.
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
    process.env.FIREBASE_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL;

  const rawPrivateKey =
    process.env.FIREBASE_PRIVATE_KEY;

  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET;

  if (
    projectId &&
    clientEmail &&
    rawPrivateKey
  ) {
    const privateKey =
      normalizePrivateKey(rawPrivateKey);

    if (
      !privateKey.startsWith(
        "-----BEGIN PRIVATE KEY-----"
      ) ||
      !privateKey.endsWith(
        "-----END PRIVATE KEY-----"
      )
    ) {
      throw new Error(
        "FIREBASE_PRIVATE_KEY is not a valid PEM private key."
      );
    }

    return initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      storageBucket,
    });
  }

  return initializeApp({
    credential: applicationDefault(),
    storageBucket,
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