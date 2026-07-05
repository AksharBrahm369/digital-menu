"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { QrCode, Lock, Mail, Loader2, ArrowRight } from "lucide-react";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Sign in and sync cookie using the context wrapper
      await signIn(email, password);

      // 2. Navigate to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Login error:", err);
      // Map common Firebase auth errors to readable messages
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Invalid email or password. Please try again.");
      } else if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to sign in. " + (err.message || ""));
      }
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow flex items-center justify-center min-h-[calc(100vh-80px)] bg-black px-6">
      
      {/* Decorative gradient glowing orb */}
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-3xl p-8 sm:p-10 shadow-2xl relative">
        <div className="flex flex-col items-center space-y-3 text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-md">
            <QrCode className="w-6 h-6 text-black stroke-[2.5]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">Welcome Back</h1>
          <p className="text-zinc-400 text-sm">
            Sign in to manage your digital restaurant menus.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs py-3 px-4 rounded-xl leading-relaxed">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-300">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-3 pl-11 pr-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-zinc-300">Password</label>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 w-4 h-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
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
                Signing In...
              </>
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-zinc-500 border-t border-zinc-900 pt-6">
          New to Menu3D QR?{" "}
          <Link href="/signup" className="text-amber-500 hover:underline font-semibold">
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}
