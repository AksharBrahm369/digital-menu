import "server-only";
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function present(value?: string) {
  return Boolean(value && value.trim());
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizePrivateKey(value: string) {
  return stripWrappingQuotes(value).replace(/\\n/g, "\n");
}

function parseServiceAccountJson(rawValue: string) {
  const stripped = stripWrappingQuotes(rawValue);
  const candidates = [
    stripped,
    Buffer.from(stripped, "base64").toString("utf8"),
  ];

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      return {
        projectId: parsed.project_id || parsed.projectId || "",
        clientEmail: parsed.client_email || parsed.clientEmail || "",
        privateKey: parsed.private_key ? normalizePrivateKey(parsed.private_key) : "",
      };
    } catch {
      // Try next
    }
  }
  return null;
}

function getPrivateKey() {
  if (process.env.FIREBASE_PRIVATE_KEY_BASE64) {
    try {
      return Buffer.from(process.env.FIREBASE_PRIVATE_KEY_BASE64, "base64").toString("utf8");
    } catch {
      // ignore, fallback
    }
  }
  return process.env.FIREBASE_PRIVATE_KEY ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY) : "";
}

function readAdminConfig() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin SDK cannot be used in browser code.");
  }

  const serviceAccountRaw =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    "";
  const serviceAccount = serviceAccountRaw ? parseServiceAccountJson(serviceAccountRaw) : null;

  const projectId = serviceAccount?.projectId || process.env.FIREBASE_PROJECT_ID || "";
  const clientEmail = serviceAccount?.clientEmail || process.env.FIREBASE_CLIENT_EMAIL || "";
  const privateKey = serviceAccount?.privateKey || getPrivateKey();

  return {
    projectId,
    clientEmail,
    privateKey,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
    serviceAccountProvided: present(serviceAccountRaw),
    serviceAccountParsed: Boolean(serviceAccount),
    source: serviceAccount ? ("service-account-json" as const) : ("individual-env-vars" as const),
  };
}

export function getFirebaseAdminEnvStatus() {
  const config = readAdminConfig();
  return {
    source: config.source,
    hasFirebaseProjectId: present(config.projectId),
    hasFirebaseClientEmail: present(config.clientEmail),
    hasFirebasePrivateKey: present(config.privateKey),
    hasFirebaseStorageBucket: present(config.storageBucket),
    hasServiceAccountJson: config.serviceAccountProvided,
    serviceAccountJsonParsed: config.serviceAccountProvided ? config.serviceAccountParsed : null,
  };
}

export function getFirebaseAdminConfigProblem() {
  const config = readAdminConfig();

  if (config.serviceAccountProvided && !config.serviceAccountParsed) {
    return "FIREBASE_SERVICE_ACCOUNT_JSON could not be parsed. Paste the full Firebase service account JSON or use FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY separately.";
  }

  if (!config.projectId || config.projectId === "dummy-project-id" || config.projectId === "your-project-id") {
    return "Missing FIREBASE_PROJECT_ID in Vercel Production environment variables.";
  }

  if (!config.clientEmail) {
    return "Missing FIREBASE_CLIENT_EMAIL in Vercel Production environment variables.";
  }

  if (!config.privateKey) {
    return "Missing FIREBASE_PRIVATE_KEY/FIREBASE_PRIVATE_KEY_BASE64 in Vercel Production environment variables.";
  }

  if (!config.privateKey.includes("-----BEGIN PRIVATE KEY-----") || !config.privateKey.includes("-----END PRIVATE KEY-----")) {
    return "FIREBASE_PRIVATE_KEY is not formatted correctly. Paste the full private_key from the Firebase service account JSON.";
  }

  return "";
}

export function getFirebaseAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const configProblem = getFirebaseAdminConfigProblem();
  if (configProblem) {
    throw new Error(configProblem);
  }

  const { projectId, clientEmail, privateKey, storageBucket } = readAdminConfig();

  try {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firebase Admin initialization error.";
    throw new Error(`Firebase Admin initialization failed: ${message}`);
  }
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminStorage() {
  return getStorage(getFirebaseAdminApp());
}

export { FieldValue };
