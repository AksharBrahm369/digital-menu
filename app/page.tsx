"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/lib/firebase/auth-context";
import { Card3D } from "@/components/ui/3d-card";
import { 
  Sparkles, 
  QrCode, 
  Layers, 
  TrendingUp, 
  Upload, 
  Smartphone,
  CheckCircle2, 
  ArrowRight,
  Flame,
  Leaf
} from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  const mockBurgerFront = (
    <div className="flex flex-col h-full bg-zinc-950 text-white rounded-2xl overflow-hidden border border-zinc-800">
      <div className="relative h-44 w-full bg-[url('https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=60')] bg-cover bg-center">
        <div className="absolute top-3 left-3 bg-amber-500 text-black text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
          Best Seller
        </div>
        <div className="absolute bottom-3 right-3 bg-black/75 backdrop-blur-md px-2 py-1 rounded-md text-sm font-semibold text-amber-400">
          $18.99
        </div>
      </div>
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="font-semibold text-lg tracking-tight">Truffle Wagyu Burger</h3>
            <div className="flex gap-1.5">
              <span title="Veg Available"><Leaf className="w-4 h-4 text-emerald-400 fill-emerald-400/20" /></span>
              <span title="Medium Spicy"><Flame className="w-4 h-4 text-orange-500 fill-orange-500/20" /></span>
            </div>
          </div>
          <p className="text-zinc-400 text-xs line-clamp-2 leading-relaxed">
            Wagyu beef patty, black truffle aioli, aged Swiss cheese, and caramelized onions on a brioche bun.
          </p>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-between items-center text-[10px] text-zinc-500">
          <span>Tap to see Allergens</span>
          <span className="text-amber-500">Interactive 3D Card</span>
        </div>
      </div>
    </div>
  );

  const mockBurgerBack = (
    <div className="flex flex-col h-full justify-between">
      <div>
        <h3 className="font-semibold text-lg border-b border-zinc-800 pb-2 text-amber-400">Nutrition & Allergens</h3>
        <p className="text-zinc-300 text-xs mt-3 leading-relaxed">
          Our Wagyu beef is source-verified and organic. The bun contains gluten, and the truffle spread contains dairy and eggs.
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex justify-between text-xs py-1 border-b border-zinc-800/50 text-zinc-400">
            <span>Gluten Free Option</span>
            <span className="text-emerald-400">Available (+ $2.00)</span>
          </div>
          <div className="flex justify-between text-xs py-1 border-b border-zinc-800/50 text-zinc-400">
            <span>Spice Level</span>
            <span className="text-orange-400">2 / 3 (Medium)</span>
          </div>
          <div className="flex justify-between text-xs py-1 text-zinc-400">
            <span>Calories</span>
            <span>720 kcal</span>
          </div>
        </div>
      </div>
      
      <div className="bg-zinc-800/50 p-2.5 rounded-lg border border-zinc-700/50 text-[10px] text-center text-zinc-400">
        Tap again to view card
      </div>
    </div>
  );

  return (
    <div className="relative min-h-screen bg-black text-white overflow-hidden selection:bg-amber-500 selection:text-black">
      
      {/* Background glowing gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-amber-500/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-15%] w-[60%] h-[60%] rounded-full bg-amber-600/10 blur-[180px] pointer-events-none" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-zinc-900 bg-black/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <QrCode className="w-5 h-5 text-black stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              Menu3D<span className="text-amber-500">QR</span>
            </span>
          </div>
          
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
            <a href="#demo" className="hover:text-white transition-colors">Live Demo</a>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <Link 
                href="/dashboard"
                className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold px-5 py-2.5 rounded-full hover:shadow-lg hover:shadow-amber-500/20 transition-all hover:scale-105"
              >
                Go to Dashboard
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm font-semibold hover:text-amber-400 transition-colors px-4 py-2">
                  Sign In
                </Link>
                <Link 
                  href="/signup"
                  className="bg-white text-black font-semibold px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors"
                >
                  Create Account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 md:pb-32 grid md:grid-cols-12 gap-12 items-center">
        <div className="md:col-span-7 space-y-8 text-left">
          <div className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 rounded-full text-xs font-semibold text-amber-400">
            <Sparkles className="w-4 h-4 fill-amber-400/20" />
            AI-Powered Menu & QR Suite for Restaurants
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Dine-In Menus, <br />
            Reimagined in <span className="text-amber-500 bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text">Interactive 3D</span>
          </h1>
          
          <p className="text-zinc-400 text-base sm:text-lg max-w-xl leading-relaxed">
            Upload your traditional menu PDF, let AI extract your dishes, and publish a gorgeous, mobile-first 3D digital menu. Give guests a premium scanning experience that tracks scans and boosts sales.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 pt-2">
            <Link 
              href="/signup" 
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold px-8 py-4 rounded-full shadow-lg shadow-amber-500/10 hover:shadow-amber-500/25 transition-all hover:scale-[1.02]"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5 stroke-[2.5]" />
            </Link>
            <a 
              href="#demo"
              className="flex items-center justify-center gap-2 border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900 hover:border-zinc-700 text-white font-semibold px-8 py-4 rounded-full transition-colors"
            >
              Try Card Simulator
            </a>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-6 border-t border-zinc-900 text-center sm:text-left">
            <div>
              <p className="text-3xl font-bold text-white">10x</p>
              <p className="text-zinc-500 text-xs mt-1">Faster Load Times</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">35%</p>
              <p className="text-zinc-500 text-xs mt-1">Higher Cart Conversions</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-white">100%</p>
              <p className="text-zinc-500 text-xs mt-1">Cloud Synced & Realtime</p>
            </div>
          </div>
        </div>

        {/* Hero Interactive Card Preview */}
        <div id="demo" className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-[340px]">
            {/* Phone container decoration */}
            <div className="absolute -inset-4 rounded-[40px] border border-zinc-800 bg-zinc-900/30 backdrop-blur-md shadow-2xl -z-10" />
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 w-32 h-6 bg-zinc-950 rounded-b-xl border-x border-b border-zinc-800 z-20 flex items-center justify-center">
              <div className="w-12 h-1 bg-zinc-800 rounded-full" />
            </div>

            <div className="p-3 bg-zinc-950 rounded-[32px] border border-zinc-800">
              <div className="bg-zinc-900/40 rounded-[24px] px-3 py-6 text-center space-y-4">
                <p className="text-xs font-medium text-amber-500 tracking-widest uppercase">Tap or Hover to Interact</p>
                
                <Card3D
                  frontContent={mockBurgerFront}
                  backContent={mockBurgerBack}
                  styleType="3d-flip"
                  className="mx-auto"
                />
                
                <div className="text-center space-y-1">
                  <p className="text-xs text-zinc-300 font-semibold">Truffle Wagyu Burger</p>
                  <p className="text-[10px] text-zinc-500">Perfect 3D Flip Transformation</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-sm font-bold text-amber-500 tracking-wider uppercase">Features</h2>
          <p className="text-3xl sm:text-4xl font-extrabold">Build and Customize in Under 5 Minutes</p>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            Everything you need to digitize your restaurant menu, brand it, print QR flyers, and track scans.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Fast PDF/Image Upload</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Drag and drop your traditional print menu. Our AI/OCR parses the categories, names, description, and prices automatically.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Styling & 3D Cards</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Choose from beautiful pre-built themes (Modern, Neon, Glassmorphism, Minimalist) and interactive 3D card tilt/flip motions.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <QrCode className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Dynamic QR Codes</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Generate custom branded QR codes linked to tables. Print high-quality table tents and tabletop designs instantly.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Ultra-Fast Customer Menu</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Zero apps required for guests. They scan the QR code and the beautiful mobile-first web menu loads instantly, even on slow connections.
            </p>
          </div>

          {/* Card 5 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <TrendingUp className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Detailed Analytics</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Track scans by date, hour, and table. Identify your most scanned menu links and optimize item highlights accordingly.
            </p>
          </div>

          {/* Card 6 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl hover:border-zinc-800 transition-colors space-y-4">
            <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500">
              <Sparkles className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold">Real-time Updates</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Run out of stock? Edit item availability or change prices instantly inside the builder. Your public customer menu updates in real-time.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="text-center space-y-4 mb-16">
          <h2 className="text-sm font-bold text-amber-500 tracking-wider uppercase">Pricing Plans</h2>
          <p className="text-3xl sm:text-4xl font-extrabold">Transparent Plans for Every Restaurant</p>
          <p className="text-zinc-500 text-sm max-w-xl mx-auto">
            Choose the plan that fits your size. Save up to 20% on annual billing options.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {/* Plan 1 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl flex flex-col justify-between space-y-6">
            <div>
              <p className="text-sm font-bold text-zinc-400">Bistro Starter</p>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-extrabold">$19</span>
                <span className="text-zinc-500 text-sm">/ month</span>
              </div>
              <p className="text-zinc-500 text-xs mt-2">Perfect for single cafes and food trucks.</p>
              
              <ul className="mt-6 space-y-3.5">
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>1 Restaurant Profile</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>1 Active Digital Menu</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Up to 10 Table QRs</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-500">
                  <CheckCircle2 className="w-4 h-4 text-zinc-800 shrink-0" />
                  <span>Custom themes & styles</span>
                </li>
              </ul>
            </div>
            <Link 
              href="/signup"
              className="w-full text-center bg-zinc-900 border border-zinc-800 py-3 rounded-full hover:bg-zinc-800 transition-colors font-semibold text-sm block"
            >
              Get Started
            </Link>
          </div>

          {/* Plan 2 - Featured */}
          <div className="bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500 p-8 rounded-2xl flex flex-col justify-between space-y-6 relative shadow-xl shadow-amber-500/5">
            <div className="absolute top-0 right-8 transform -translate-y-1/2 bg-amber-500 text-black text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider">
              Popular
            </div>
            <div>
              <p className="text-sm font-bold text-amber-400">Gourmet Pro</p>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-extrabold">$49</span>
                <span className="text-zinc-500 text-sm">/ month</span>
              </div>
              <p className="text-zinc-400 text-xs mt-2">Ideal for full-service local restaurants.</p>
              
              <ul className="mt-6 space-y-3.5">
                <li className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>3 Restaurant Profiles</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Unlimited Menus</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Unlimited Table QRs</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Full 3D transforms & themes</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Weekly Scan PDF Reports</span>
                </li>
              </ul>
            </div>
            <Link 
              href="/signup"
              className="w-full text-center bg-amber-500 text-black py-3 rounded-full hover:bg-amber-400 transition-colors font-semibold text-sm block"
            >
              Start 14-Day Free Trial
            </Link>
          </div>

          {/* Plan 3 */}
          <div className="bg-zinc-950 border border-zinc-900 p-8 rounded-2xl flex flex-col justify-between space-y-6">
            <div>
              <p className="text-sm font-bold text-zinc-400">Enterprise Franchise</p>
              <div className="flex items-baseline gap-1 mt-4">
                <span className="text-4xl font-extrabold">$129</span>
                <span className="text-zinc-500 text-sm">/ month</span>
              </div>
              <p className="text-zinc-500 text-xs mt-2">For multi-location groups & hotels.</p>
              
              <ul className="mt-6 space-y-3.5">
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Unlimited Locations</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>AI OCR Extraction Priority</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>White-label Domains</span>
                </li>
                <li className="flex items-center gap-2.5 text-sm text-zinc-300">
                  <CheckCircle2 className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Dedicated Account Manager</span>
                </li>
              </ul>
            </div>
            <Link 
              href="/signup"
              className="w-full text-center bg-zinc-900 border border-zinc-800 py-3 rounded-full hover:bg-zinc-800 transition-colors font-semibold text-sm block"
            >
              Contact Sales
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Footer Wrapper */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-16">
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <span className="font-extrabold text-lg tracking-tight">
                Menu3D<span className="text-amber-500">QR</span>
              </span>
            </div>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Premium 3D restaurant interactive menus and QR generation suite. Built with Firebase and Next.js.
            </p>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li><a href="#features" className="hover:text-zinc-300">Features</a></li>
              <li><a href="#pricing" className="hover:text-zinc-300">Pricing</a></li>
              <li><a href="#demo" className="hover:text-zinc-300">Card Tilt Demo</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Company</h4>
            <ul className="space-y-2 text-xs text-zinc-500">
              <li><a href="#" className="hover:text-zinc-300">About Us</a></li>
              <li><a href="#" className="hover:text-zinc-300">Support</a></li>
              <li><a href="#" className="hover:text-zinc-300">Privacy Policy</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-xs font-bold uppercase tracking-wider mb-4">Stack Details</h4>
            <p className="text-zinc-500 text-xs leading-relaxed">
              Tailwind CSS, Framer Motion, Firebase Authentication, Cloud Firestore, Firebase Storage, and Next.js App Router.
            </p>
          </div>
        </div>
        <div className="text-center text-xs text-zinc-650 mt-12 pt-8 border-t border-zinc-900/60 max-w-7xl mx-auto px-6">
          © {new Date().getFullYear()} Menu3D QR. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
