"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import {
  User, 
  onIdTokenChanged, 
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from "firebase/auth";
import { auth, isFirebaseConfigured, isMockDatabaseEnabled } from "./config";
import { createUserProfile } from "./db";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<any>;
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  signIn: async () => {},
  signUp: async () => {},
});

function isPermissionDeniedError(error: unknown) {
  const err = error as { code?: string; message?: string };
  return (
    err.code === "permission-denied" ||
    err.code === "firestore/permission-denied" ||
    /permission|insufficient/i.test(err.message || "")
  );
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isFirebaseConfigured();
  const mockEnabled = isMockDatabaseEnabled();

  // Listen to Auth State
  useEffect(() => {
    if (!configured) {
      if (!mockEnabled) {
        setUser(null);
        setLoading(false);
        return;
      }

      // Mock Auth Initialization
      const savedUser = localStorage.getItem("menu3d_mock_user");
      if (savedUser) {
        setUser(JSON.parse(savedUser) as any);
      } else {
        setUser(null);
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);

      try {
        const token = firebaseUser ? await firebaseUser.getIdToken() : null;
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
      } catch (error) {
        console.error("Error synchronizing session cookie:", error);
      }
    });

    return () => unsubscribe();
  }, [configured, mockEnabled]);

  const signIn = async (email: string, password: string) => {
    if (!configured) {
      if (!mockEnabled) {
        throw new Error("Firebase is not configured for this deployment. Add the NEXT_PUBLIC_FIREBASE_* environment variables in Vercel and redeploy.");
      }

      // Simulate validation
      if (!email.includes("@") || password.length < 6) {
        throw new Error("Invalid email format or password too short (min 6 chars).");
      }
      const mockUser = {
        uid: `mock_user_${Date.now()}`,
        email,
        displayName: email.split("@")[0],
        emailVerified: true,
        photoURL: "",
        getIdToken: async () => `mock_token_${Date.now()}`,
      };
      
      localStorage.setItem("menu3d_mock_user", JSON.stringify(mockUser));
      setUser(mockUser as any);
      
      // Save session cookie locally
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: `mock_token_${mockUser.uid}` }),
      });
      
      return { user: mockUser };
    }

    return signInWithEmailAndPassword(auth, email, password);
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!configured) {
      if (!mockEnabled) {
        throw new Error("Firebase is not configured for this deployment. Add the NEXT_PUBLIC_FIREBASE_* environment variables in Vercel and redeploy.");
      }

      if (!email.includes("@") || password.length < 6) {
        throw new Error("Invalid email format or password too short.");
      }
      const mockUser = {
        uid: `mock_user_${Date.now()}`,
        email,
        displayName: fullName,
        emailVerified: true,
        photoURL: "",
        getIdToken: async () => `mock_token_${Date.now()}`,
      };

      // Create Mock Profile document in mock-db API
      await fetch("/api/mock-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "setDoc",
          collection: "users",
          id: mockUser.uid,
          data: {
            uid: mockUser.uid,
            fullName,
            email,
            photoURL: ""
          }
        })
      });

      localStorage.setItem("menu3d_mock_user", JSON.stringify(mockUser));
      setUser(mockUser as any);

      // Save session cookie locally
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: `mock_token_${mockUser.uid}` }),
      });

      return { user: mockUser };
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName: fullName });

    try {
      await createUserProfile(userCredential.user.uid, { fullName, email, photoURL: "" });
    } catch (error) {
      if (!isPermissionDeniedError(error)) {
        throw error;
      }

      console.warn("User profile document was not created because Firestore denied the write. Continuing with Firebase Auth user.", error);
    }

    setUser(userCredential.user);
    return userCredential;
  };

  const signOut = async () => {
    if (!configured) {
      if (mockEnabled) {
        localStorage.removeItem("menu3d_mock_user");
      }
      setUser(null);
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: null }),
      });
      return;
    }

    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
