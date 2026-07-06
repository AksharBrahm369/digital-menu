"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWorkspace } from "./layout";
import { getRestaurantQrs, getMenus, QrCode, Menu } from "@/lib/firebase/db";
import { 
  ChefHat, 
  MapPin, 
  Phone, 
  Info, 
  QrCode as QrIcon, 
  Layers, 
  TrendingUp,
  FileText,
  Palette,
  CheckCircle2,
  HelpCircle,
  Clock,
  ArrowRight
} from "lucide-react";

export default function RestaurantOverview() {
  const { restaurant } = useWorkspace();
  const [qrs, setQrs] = useState<QrCode[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    const restId = restaurant?.id;
    if (!restId) return;

    const loadStats = async () => {
      try {
        const [qrList, menuList] = await Promise.all([
          getRestaurantQrs(restId),
          getMenus(restId)
        ]);
        setQrs(qrList);
        setMenus(menuList);
      } catch (err) {
        console.error("Error loading stats:", err);
      } finally {
        setLoadingStats(false);
      }
    };

    loadStats();
  }, [restaurant]);

  if (!restaurant) return null;

  const totalScans = qrs.reduce((sum, item) => sum + item.scanCount, 0);
  const publishedMenuId = restaurant.currentPublishedMenuId || restaurant.activeMenuId;
  const activeMenu = menus.find(m => m.id === publishedMenuId);
  const totalMenus = menus.length;
  
  // Calculate completion steps
  const step1Done = totalMenus > 0;
  const step2Done = menus.some(m => Boolean(m.sourceFileUrl) || (m.categories && m.categories.length > 0));
  const step3Done = menus.some(m => m.theme && m.theme.theme !== "classic");
  const step4Done = publishedMenuId !== undefined && publishedMenuId !== "";

  const stats = [
    { name: "Active Digital Menu", value: activeMenu ? activeMenu.name : "None Published", subtext: activeMenu ? `v${activeMenu.version}` : "Draft only", icon: Layers, color: "text-amber-500 bg-amber-500/10" },
    { name: "Total Configured QRs", value: qrs.length.toString(), subtext: "Table / Location tags", icon: QrIcon, color: "text-blue-500 bg-blue-500/10" },
    { name: "Total Customer Scans", value: totalScans.toString(), subtext: "Real-time analytics", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10" },
  ];

  return (
    <div className="p-6 md:p-10 space-y-10">
      
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-3xl bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-850 relative overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-48 h-48 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        <div className="space-y-2 relative z-1">
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Restaurant Command Center</h1>
          <p className="text-zinc-400 text-sm max-w-xl">
            Welcome to the workspace for <span className="text-white font-semibold">{restaurant.name}</span>. Walk through the checklist steps below to configure, brand, and launch your mobile 3D digital menu.
          </p>
        </div>
      </div>

      {/* Stats Panels */}
      <div className="grid sm:grid-cols-3 gap-6">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-zinc-950 border border-zinc-900 rounded-2xl p-6 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="text-zinc-500 text-xs font-semibold">{stat.name}</p>
                <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                <p className="text-[10px] text-zinc-500">{stat.subtext}</p>
              </div>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${stat.color} shrink-0`}>
                <Icon className="w-5 h-5 stroke-[2]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Set-Up Checklist Progress */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 space-y-6">
        <h2 className="text-lg font-bold">Interactive Launch Checklist</h2>
        
        <div className="grid gap-4">
          {/* Step 1 */}
          <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-850 transition-colors gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {step1Done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />
                ) : (
                  <Clock className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  1. Upload Traditional Menu PDF or Images
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${step1Done ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"}`}>
                    {step1Done ? "Completed" : "Action Required"}
                  </span>
                </h3>
                <p className="text-zinc-400 text-xs mt-1 max-w-lg leading-relaxed">
                  Upload your legacy print menu layouts. We simulate AI OCR parsing to extract products, item names, and descriptions.
                </p>
              </div>
            </div>
            <Link 
              href={`/dashboard/restaurants/${restaurant.id}/upload`}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shrink-0 transition-colors"
            >
              Upload Menu
            </Link>
          </div>

          {/* Step 2 */}
          <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-850 transition-colors gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {step2Done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />
                ) : (
                  <Clock className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  2. Edit Categories & Menu Items
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${step2Done ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"}`}>
                    {step2Done ? "Completed" : "Action Required"}
                  </span>
                </h3>
                <p className="text-zinc-400 text-xs mt-1 max-w-lg leading-relaxed">
                  Edit categories (Starters, Mains, Desserts), adjust item prices, mark allergens (gluten, lactose), tags, spice ratings, and customize availability flags.
                </p>
              </div>
            </div>
            <Link 
              href={`/dashboard/restaurants/${restaurant.id}/builder`}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shrink-0 transition-colors"
            >
              Builder Setup
            </Link>
          </div>

          {/* Step 3 */}
          <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-850 transition-colors gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {step3Done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />
                ) : (
                  <Clock className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  3. Customize Themes & 3D Interactive Card Styles
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${step3Done ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"}`}>
                    {step3Done ? "Completed" : "Optional Customization"}
                  </span>
                </h3>
                <p className="text-zinc-400 text-xs mt-1 max-w-lg leading-relaxed">
                  Brand your customer-facing portal. Toggle neon dark modes, glassmorphism cards, customized fonts, colors, and interactive 3D motion formats.
                </p>
              </div>
            </div>
            <Link 
              href={`/dashboard/restaurants/${restaurant.id}/theme`}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shrink-0 transition-colors"
            >
              Style Editor
            </Link>
          </div>

          {/* Step 4 */}
          <div className="flex items-start justify-between p-4 rounded-xl bg-zinc-900/20 border border-zinc-900 hover:border-zinc-850 transition-colors gap-4">
            <div className="flex items-start gap-4">
              <div className="mt-1 shrink-0">
                {step4Done ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 fill-emerald-400/10" />
                ) : (
                  <Clock className="w-5 h-5 text-zinc-500" />
                )}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  4. Publish & Configure Table QR Tags
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${step4Done ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20"}`}>
                    {step4Done ? "Published Live" : "Action Required"}
                  </span>
                </h3>
                <p className="text-zinc-400 text-xs mt-1 max-w-lg leading-relaxed">
                  Publish your draft menu, generate scan-tracked Table QR Code graphics, and customize and print table tents.
                </p>
              </div>
            </div>
            <Link 
              href={`/dashboard/restaurants/${restaurant.id}/publish`}
              className="bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-white font-semibold text-xs px-4 py-2 rounded-lg shrink-0 transition-colors"
            >
              QR Setup
            </Link>
          </div>
        </div>
      </div>

      {/* Restaurant Info Panel */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 space-y-6">
        <h2 className="text-lg font-bold">Restaurant Profile Specifications</h2>
        
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-6 text-sm">
          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ChefHat className="w-3.5 h-3.5" /> Cuisine Type
            </p>
            <p className="font-semibold text-white">{restaurant.cuisine || "Multi-Cuisine"}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" /> Physical Address
            </p>
            <p className="font-semibold text-white truncate" title={restaurant.address}>{restaurant.address || "Not specified"}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Phone Number
            </p>
            <p className="font-semibold text-white">{restaurant.phone || "Not specified"}</p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Currency Code
            </p>
            <p className="font-semibold text-white">{restaurant.currency}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
