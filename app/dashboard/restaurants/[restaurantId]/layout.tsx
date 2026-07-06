"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { getRestaurant, Restaurant } from "@/lib/firebase/db";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { 
  ArrowLeft, 
  ChefHat, 
  Upload, 
  Layers, 
  Palette, 
  QrCode, 
  TrendingUp, 
  Loader2,
  Info,
  ExternalLink
} from "lucide-react";

interface WorkspaceContextType {
  restaurant: Restaurant | null;
  loading: boolean;
  refreshRestaurant: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType>({
  restaurant: null,
  loading: true,
  refreshRestaurant: async () => {},
});

async function getWorkspaceRestaurant(
  restaurantId: string,
  user: { getIdToken?: () => Promise<string> }
) {
  if (!isFirebaseConfigured()) {
    return getRestaurant(restaurantId);
  }

  const token = await user.getIdToken?.();
  const response = await fetch(`/api/restaurants?id=${encodeURIComponent(restaurantId)}`, {
    cache: "no-store",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Could not load restaurant workspace.");
  }

  return payload.data as Restaurant | null;
}

export const useWorkspace = () => useContext(WorkspaceContext);

export default function RestaurantLayout({ children }: { children: React.ReactNode }) {
  const { restaurantId } = useParams() as { restaurantId: string };
  const { user, loading: authLoading } = useAuth();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const router = useRouter();
  const pathname = usePathname();

  const fetchRestaurantDetails = async () => {
    if (!user) return;

    try {
      setError("");
      const details = await getWorkspaceRestaurant(restaurantId, user);
      if (details) {
        setRestaurant(details);
      } else {
        // If restaurant not found, send back to dashboard
        router.push("/dashboard");
      }
    } catch (error) {
      console.error("Error loading workspace restaurant:", error);
      const message = error instanceof Error ? error.message : "Could not load restaurant workspace.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }

    fetchRestaurantDetails();
  }, [user, authLoading, restaurantId, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black px-6 py-12 text-white">
        <div className="mx-auto max-w-2xl rounded-2xl border border-rose-500/30 bg-rose-500/10 p-5 text-sm font-medium text-rose-300">
          {error}
        </div>
      </div>
    );
  }

  if (!restaurant) return null;

  const menuItems = [
    { name: "Workspace Overview", href: `/dashboard/restaurants/${restaurantId}`, icon: Info },
    { name: "1. Upload Print Menu", href: `/dashboard/restaurants/${restaurantId}/upload`, icon: Upload },
    { name: "2. Edit Menu Items", href: `/dashboard/restaurants/${restaurantId}/builder`, icon: Layers },
    { name: "3. Customize Design", href: `/dashboard/restaurants/${restaurantId}/theme`, icon: Palette },
    { name: "4. Publish & QR Setup", href: `/dashboard/restaurants/${restaurantId}/publish`, icon: QrCode },
    { name: "Scan Analytics", href: `/dashboard/restaurants/${restaurantId}/analytics`, icon: TrendingUp },
  ];

  return (
    <WorkspaceContext.Provider value={{ restaurant, loading, refreshRestaurant: fetchRestaurantDetails }}>
      <div className="min-h-screen bg-black text-white flex flex-col md:flex-row">
        
        {/* Restaurant Workspace Sidebar */}
        <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-zinc-900 bg-zinc-950/40 backdrop-blur-md p-6 flex flex-col shrink-0">
          <div className="space-y-6">
            <Link 
              href="/dashboard"
              className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-500 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to Dashboard
            </Link>

            {/* Restaurant header card */}
            <div className="flex items-center gap-3 bg-zinc-900/40 border border-zinc-900 p-3 rounded-xl">
              {restaurant.logoUrl ? (
                <img 
                  src={restaurant.logoUrl} 
                  alt={restaurant.name} 
                  className="w-10 h-10 rounded-lg object-cover border border-zinc-800"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-400">
                  <ChefHat className="w-5 h-5" />
                </div>
              )}
              <div className="truncate">
                <h3 className="text-sm font-bold truncate">{restaurant.name}</h3>
                <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">{restaurant.cuisine || "Cafe"}</span>
              </div>
            </div>

            {/* Sidebar navigation */}
            <nav className="space-y-1">
              <p className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest px-2 mb-2">Editor Steps</p>
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive 
                        ? "bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/10" 
                        : "text-zinc-400 hover:text-white hover:bg-zinc-900/40"
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Quick links to live menu */}
          <div className="mt-auto pt-6 border-t border-zinc-900 space-y-3">
            <a 
              href={`/m/${restaurant.slug}`} 
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between text-xs text-zinc-400 hover:text-amber-500 transition-colors bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-900 hover:border-zinc-800"
            >
              <span className="font-semibold">View Live Menu</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <p className="text-[10px] text-center text-zinc-650">Menu3D QR Workspace v1.0</p>
          </div>
        </aside>

        {/* Dynamic Nested Page Content */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
