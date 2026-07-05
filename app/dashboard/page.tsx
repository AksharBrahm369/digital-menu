"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { getRestaurants, Restaurant } from "@/lib/firebase/db";
import { 
  Plus, 
  QrCode, 
  Settings, 
  Compass, 
  DollarSign, 
  User, 
  LogOut, 
  Loader2, 
  ChefHat, 
  ChevronRight,
  Sparkles,
  Layers,
  Palette,
  Eye,
  TrendingUp
} from "lucide-react";

export default function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [fetching, setFetching] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }

    const fetchRestaurants = async () => {
      try {
        const list = await getRestaurants(user.uid);
        setRestaurants(list);
      } catch (err) {
        console.error("Error fetching restaurants:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchRestaurants();
  }, [user, loading, router]);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push("/");
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (loading || (!user && loading)) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
      
      {/* Sidebar navigation */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-900 bg-zinc-950/40 backdrop-blur-md p-6 flex flex-col justify-between shrink-0">
        <div className="space-y-8">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-black stroke-[2.5]" />
            </div>
            <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
              Menu3D<span className="text-amber-500">QR</span>
            </span>
          </div>

          <div className="space-y-1">
            <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-2 mb-2">Workspace</p>
            <Link 
              href="/dashboard"
              className="flex items-center gap-3 bg-zinc-900 text-amber-400 text-sm font-semibold px-3 py-2.5 rounded-xl transition-all"
            >
              <ChefHat className="w-4 h-4" />
              Restaurants
            </Link>
          </div>
        </div>

        {/* User profile actions */}
        <div className="pt-6 border-t border-zinc-900 mt-8 space-y-4">
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 font-bold">
              {user.displayName ? user.displayName[0].toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user.displayName || "Restaurant Owner"}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 text-zinc-400 hover:text-rose-400 text-sm font-medium px-3 py-2 rounded-xl transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content pane */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-10 overflow-y-auto">
        
        {/* Header toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Your Restaurants</h1>
            <p className="text-zinc-400 text-sm mt-1">Configure your locations, upload menus, and edit layouts.</p>
          </div>

          <Link
            href="/dashboard/restaurants/new"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold px-5 py-3 rounded-xl hover:shadow-lg hover:shadow-amber-500/10 transition-all hover:scale-[1.01]"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            New Restaurant
          </Link>
        </div>

        {/* Grid listing */}
        {fetching ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="border border-dashed border-zinc-900 bg-zinc-950/30 rounded-3xl p-16 text-center space-y-4 max-w-xl mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <ChefHat className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-white">Create your first Restaurant</p>
              <p className="text-zinc-500 text-xs max-w-xs mx-auto leading-relaxed">
                Add a profile for your restaurant, diner, or bistro to generate custom QR digital menus.
              </p>
            </div>
            <Link
              href="/dashboard/restaurants/new"
              className="inline-flex items-center gap-2 bg-white text-black font-semibold px-5 py-2.5 rounded-full hover:bg-zinc-200 transition-colors mt-2 text-sm"
            >
              Add Restaurant
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {restaurants.map((rest) => (
              <div 
                key={rest.id} 
                className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 hover:border-zinc-800 hover:shadow-xl hover:shadow-amber-500/[0.01] transition-all flex flex-col justify-between space-y-6 relative overflow-hidden group"
              >
                {/* Visual accents */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-amber-500/10 transition-all" />
                
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-amber-500 tracking-wider uppercase bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-md">
                        {rest.cuisine || "Multi-Cuisine"}
                      </span>
                      <h2 className="text-xl font-bold tracking-tight text-white mt-2 group-hover:text-amber-400 transition-colors">
                        {rest.name}
                      </h2>
                      <p className="text-zinc-500 text-xs mt-1">slug: /m/{rest.slug}</p>
                    </div>
                    {rest.logoUrl ? (
                      <img 
                        src={rest.logoUrl} 
                        alt={rest.name} 
                        className="w-12 h-12 rounded-xl object-cover border border-zinc-900"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-500">
                        <ChefHat className="w-6 h-6" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-zinc-900/30 border border-zinc-900 p-3 rounded-xl text-zinc-400">
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">Currency</p>
                      <p className="font-semibold text-white">{rest.currency}</p>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-zinc-650 font-bold uppercase tracking-wider">Status</p>
                      <p className={`font-semibold ${rest.status === "active" ? "text-emerald-400" : "text-zinc-500"}`}>
                        {rest.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <Link 
                    href={`/dashboard/restaurants/${rest.id}`}
                    className="w-full text-center bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white font-semibold py-2.5 rounded-xl text-xs block transition-all"
                  >
                    Manage Restaurant Workspace
                  </Link>

                  <div className="grid grid-cols-4 gap-2">
                    <Link
                      href={`/dashboard/restaurants/${rest.id}/builder`}
                      title="Menu Builder"
                      className="flex items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/50 text-zinc-400 hover:text-amber-500 transition-colors"
                    >
                      <Layers className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/dashboard/restaurants/${rest.id}/theme`}
                      title="Customize Theme"
                      className="flex items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/50 text-zinc-400 hover:text-amber-500 transition-colors"
                    >
                      <Palette className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/dashboard/restaurants/${rest.id}/publish`}
                      title="QRs & Publishing"
                      className="flex items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/50 text-zinc-400 hover:text-amber-500 transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                    </Link>
                    <Link
                      href={`/dashboard/restaurants/${rest.id}/analytics`}
                      title="Analytics"
                      className="flex items-center justify-center p-2 rounded-lg bg-zinc-950 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/50 text-zinc-400 hover:text-amber-500 transition-colors"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
