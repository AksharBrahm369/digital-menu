"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { QrCode, Lock, Mail, User, Loader2, ArrowRight } from "lucide-react";

export default function SignUp() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Sign up and sync the Firebase Auth session.
      await signUp(email, password, fullName);

      // Direct to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("SignUp error:", err);
      // Map common Firebase errors
      if (err.code === "auth/email-already-in-use") {
        setError("This email address is already in use by another account.");
      } else if (err.code === "auth/weak-password") {
        setError("Password should be at least 6 characters long.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else if (err.message && (err.message.includes("permission") || err.message.includes("Permission"))) {
        setError("Firebase permission denied. Please check that Cloud Firestore is created and that the latest firestore.rules file is published in Firebase Console.");
      } else {
        setError("Registration failed. " + (err.message || ""));
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center min-h-[calc(100vh-80px)] bg-black px-6">
      
      {/* Decorative glowing gradient orb */}
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 sm:p-10 shadow-2xl relative">
        <div className="flex flex-col items-center space-y-3 text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-md">
            <QrCode className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Create Account</h1>
          <p className="text-zinc-400 text-sm">
            Start building premium 3D digital menus.
          </p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs py-3 px-4 rounded-xl leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Restaurant Owner Full Name</label>
            <div className="relative">
              <User className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Chef Luigi"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="luigi@ristorante.com"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold py-3.5 rounded-xl hover:shadow-lg hover:shadow-amber-500/10 transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-75"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
                Registering Account...
              </>
            ) : (
              <>
                Register & Start
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-zinc-500 border-t border-zinc-900 pt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-amber-500 hover:underline font-semibold">
            Sign In Instead
          </Link>
        </div>
      </div>
    </div>
  );
}
