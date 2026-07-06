import "server-only";

import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

function getPrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
    } catch {
      // ignore
    }
  }

  return process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
}

export function getFirebaseAdminApp() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Firebase Admin env vars missing");
  }

  if (getApps().length > 0) return getApps()[0];

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export { FieldValue };

export function getFirebaseAdminEnvStatus() {
  return {
    source: "individual-env-vars",
    hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasFirebaseClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasFirebasePrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_PRIVATE_KEY_BASE64),
    hasFirebaseStorageBucket: Boolean(process.env.FIREBASE_STORAGE_BUCKET),
    hasServiceAccountJson: false,
    serviceAccountJsonParsed: null,
  };
}

export function getFirebaseAdminConfigProblem() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId) return "Missing FIREBASE_PROJECT_ID";
  if (!clientEmail) return "Missing FIREBASE_CLIENT_EMAIL";
  if (!privateKey) return "Missing FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64";
  return "";
}
