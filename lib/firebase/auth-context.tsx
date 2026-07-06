"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { createUserProfile } from "./db";

interface AuthContextType {
  user: any | null;
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

function isMockDatabaseEnabled() {
  return process.env.NEXT_PUBLIC_MOCK_DATABASE === "true";
}

function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

function mapSupabaseUser(supabaseUser: any) {
  if (!supabaseUser) return null;
  return {
    uid: supabaseUser.id,
    email: supabaseUser.email,
    displayName: supabaseUser.user_metadata?.full_name || supabaseUser.email?.split("@")[0] || "",
    photoURL: supabaseUser.user_metadata?.avatar_url || "",
    getIdToken: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session?.access_token || "";
    }
  };
}

async function syncSessionCookie(token: string | null) {
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch (error) {
    console.error("Error synchronizing session cookie:", error);
  }
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const configured = isSupabaseConfigured();
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

    // Initialize Supabase Auth State
    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        setUser(mapped as any);
        syncSessionCookie(session.access_token);
      } else {
        setUser(null);
        syncSessionCookie(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      if (session?.user) {
        const mapped = mapSupabaseUser(session.user);
        setUser(mapped as any);
        await syncSessionCookie(session.access_token);
      } else {
        setUser(null);
        await syncSessionCookie(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [configured, mockEnabled]);

  const signIn = async (email: string, password: string) => {
    if (!configured) {
      if (!mockEnabled) {
        throw new Error("Supabase is not configured for this deployment. Add the NEXT_PUBLIC_SUPABASE_* environment variables in Vercel and redeploy.");
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { user: mapSupabaseUser(data.user) };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    if (!configured) {
      if (!mockEnabled) {
        throw new Error("Supabase is not configured for this deployment. Add the NEXT_PUBLIC_SUPABASE_* environment variables in Vercel and redeploy.");
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

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName
        }
      }
    });
    if (error) throw error;

    if (data.user) {
      try {
        await createUserProfile(data.user.id, { fullName, email, photoURL: "" });
      } catch (profileErr) {
        console.warn("User profile record could not be created:", profileErr);
      }
    }

    return { user: mapSupabaseUser(data.user) };
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

    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signIn, signUp }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
