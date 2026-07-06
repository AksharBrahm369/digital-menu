import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

type AdminConfig = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
};

let cachedAdminApp: App | null = null;

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

function parseServiceAccountJson(rawValue: string): Partial<AdminConfig> | null {
  try {
    const parsed = JSON.parse(stripWrappingQuotes(rawValue));
    return {
      projectId: parsed.project_id || parsed.projectId || "",
      clientEmail: parsed.client_email || parsed.clientEmail || "",
      privateKey: parsed.private_key ? normalizePrivateKey(parsed.private_key) : "",
    };
  } catch {
    try {
      const decoded = Buffer.from(stripWrappingQuotes(rawValue), "base64").toString("utf8");
      const parsed = JSON.parse(decoded);
      return {
        projectId: parsed.project_id || parsed.projectId || "",
        clientEmail: parsed.client_email || parsed.clientEmail || "",
        privateKey: parsed.private_key ? normalizePrivateKey(parsed.private_key) : "",
      };
    } catch {
      return null;
    }
  }
}

function getAdminConfig(): AdminConfig {
  const serviceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
    "";
  const parsedServiceAccount = serviceAccount ? parseServiceAccountJson(serviceAccount) : null;

  const projectId =
    parsedServiceAccount?.projectId ||
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "";
  const clientEmail =
    parsedServiceAccount?.clientEmail ||
    process.env.FIREBASE_CLIENT_EMAIL ||
    "";
  const rawPrivateKey =
    parsedServiceAccount?.privateKey ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "";
  const privateKey = rawPrivateKey ? normalizePrivateKey(rawPrivateKey) : "";
  const storageBucket =
    process.env.FIREBASE_STORAGE_BUCKET ||
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    undefined;

  return { projectId, clientEmail, privateKey, storageBucket };
}

export function getFirebaseAdminConfigProblem() {
  const { projectId, clientEmail, privateKey } = getAdminConfig();

  if (!projectId || projectId === "dummy-project-id" || projectId === "your-project-id") {
    return "Missing FIREBASE_PROJECT_ID in Vercel environment variables.";
  }

  if (!clientEmail) {
    return "Missing FIREBASE_CLIENT_EMAIL in Vercel environment variables.";
  }

  if (!privateKey) {
    return "Missing FIREBASE_PRIVATE_KEY in Vercel environment variables.";
  }

  if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") || !privateKey.includes("-----END PRIVATE KEY-----")) {
    return "FIREBASE_PRIVATE_KEY is not formatted correctly. Paste the full private_key from the Firebase service account JSON, including BEGIN/END lines, and keep newline escapes as \\n.";
  }

  return "";
}

export function getFirebaseAdminApp() {
  if (cachedAdminApp) return cachedAdminApp;

  const existingApp = getApps()[0];
  if (existingApp) {
    cachedAdminApp = existingApp;
    return cachedAdminApp;
  }

  const problem = getFirebaseAdminConfigProblem();
  if (problem) {
    throw new Error(problem);
  }

  const { projectId, clientEmail, privateKey, storageBucket } = getAdminConfig();

  try {
    cachedAdminApp = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      storageBucket,
    });
    return cachedAdminApp;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firebase Admin initialization error.";
    throw new Error(`Firebase Admin initialization failed: ${message}`);
  }
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export function getAdminStorage() {
  return getStorage(getFirebaseAdminApp());
}
