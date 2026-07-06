import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "dummy-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "dummy-auth-domain.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "dummy-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "dummy-storage-bucket.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:1234567890:web:1234567890",
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { app };

export const hasFirebaseClientConfig = () => {
  const key = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  return Boolean(
    key &&
      key !== "dummy-api-key" &&
      key !== "your-api-key" &&
      projectId &&
      projectId !== "dummy-project-id" &&
      projectId !== "your-project-id" &&
      appId &&
      appId !== "1:1234567890:web:1234567890" &&
      appId !== "your-app-id"
  );
};

export const isMockDatabaseEnabled = () => {
  const mockRequested = process.env.NEXT_PUBLIC_MOCK_DATABASE === "true";
  const productionMockAllowed = process.env.NEXT_PUBLIC_ALLOW_MOCK_DATABASE_IN_PRODUCTION === "true";

  if (process.env.NODE_ENV === "production" && !productionMockAllowed) {
    return false;
  }

  return mockRequested || !hasFirebaseClientConfig();
};

export const isFirebaseConfigured = () => {
  return hasFirebaseClientConfig() && !isMockDatabaseEnabled();
};
