"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useWorkspace } from "../layout";
import { getMenus, getMenu, saveMenu, Menu, MenuTheme } from "@/lib/firebase/db";
import { Card3D } from "@/components/ui/3d-card";
import { 
  Palette, 
  Loader2, 
  Save, 
  Check, 
  AlertTriangle,
  Smartphone,
  Eye,
  Type,
  Layout,
  Leaf,
  Flame
} from "lucide-react";

// Predefined Theme Palettes
const PRESETS = [
  {
    name: "Classic Amber (Warm)",
    theme: "classic" as const,
    primaryColor: "#d97706", // amber-600
    secondaryColor: "#1e293b", // slate-800
    backgroundColor: "#fafaf9", // stone-50
    textColor: "#1c1917", // stone-900
    fontFamily: "Inter",
    cardStyle: "3d-tilt" as const,
  },
  {
    name: "Neon Cyber (Dark)",
    theme: "neon" as const,
    primaryColor: "#f43f5e", // rose-500
    secondaryColor: "#06b6d4", // cyan-500
    backgroundColor: "#09090b", // zinc-950
    textColor: "#fafafa", // zinc-50
    fontFamily: "Outfit",
    cardStyle: "3d-tilt" as const,
  },
  {
    name: "Mint Organic (Fresh)",
    theme: "glassmorphism" as const,
    primaryColor: "#10b981", // emerald-500
    secondaryColor: "#065f46", // emerald-800
    backgroundColor: "#f0fdf4", // emerald-50
    textColor: "#064e3b", // emerald-950
    fontFamily: "Outfit",
    cardStyle: "3d-flip" as const,
  },
  {
    name: "Nordic Minimalist (Sleek)",
    theme: "minimal" as const,
    primaryColor: "#18181b", // zinc-900
    secondaryColor: "#71717a", // zinc-500
    backgroundColor: "#ffffff",
    textColor: "#09090b",
    fontFamily: "Inter",
    cardStyle: "flat" as const,
  }
];

export default function ThemeCustomizer() {
  const { restaurant } = useWorkspace();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [menus, setMenus] = useState<Menu[]>([]);
  const [activeMenu, setActiveMenu] = useState<Menu | null>(null);
  
  // Theme state
  const [themeSettings, setThemeSettings] = useState<MenuTheme>({
    theme: "classic",
    primaryColor: "#d97706",
    secondaryColor: "#1e293b",
    backgroundColor: "#fafaf9",
    textColor: "#1c1917",
    fontFamily: "Inter",
    cardStyle: "3d-tilt",
  });

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const restaurantId = restaurant?.id;

  useEffect(() => {
    const fetchMenuAndTheme = async () => {
      if (!restaurantId) return;

      try {
        const menuList = await getMenus(restaurantId);
        setMenus(menuList);

        let targetMenuId = searchParams.get("menuId");
        if (!targetMenuId && menuList.length > 0) {
          targetMenuId = menuList[0].id!;
        }

        if (targetMenuId) {
          const menuDetails = await getMenu(restaurantId, targetMenuId);
          if (menuDetails) {
            setActiveMenu(menuDetails);
            if (menuDetails.theme) {
              setThemeSettings(menuDetails.theme);
            }
          }
        }
      } catch (err) {
        console.error("Theme initialization error:", err);
        setError("Failed to load design settings.");
      } finally {
        setLoading(false);
      }
    };

    fetchMenuAndTheme();
  }, [restaurantId, searchParams]);

  if (!restaurant || !restaurantId) return null;

  const handleSaveTheme = async () => {
    if (!activeMenu || !activeMenu.id) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      await saveMenu(restaurant.id!, activeMenu.id, {
        theme: themeSettings,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Save theme error:", err);
      setError("Failed to save style parameters.");
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (preset: MenuTheme) => {
    setThemeSettings(preset);
  };

  // Mock Menu content to show inside the phone preview
  const mockFrontCard = (
    <div 
      className="p-3.5 flex flex-col h-full justify-between"
      style={{ 
        backgroundColor: themeSettings.theme === "neon" ? "#18181b" : "white",
        color: themeSettings.textColor,
        borderColor: themeSettings.primaryColor + "30",
        borderWidth: 1,
      }}
    >
      <div className="space-y-2">
        <div className="h-28 w-full rounded-xl bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&auto=format&fit=crop&q=60')" }} />
        <div>
          <div className="flex justify-between items-start">
            <h4 className="font-bold text-xs tracking-tight">Avocado Toast Supreme</h4>
            <Leaf className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10 shrink-0" />
          </div>
          <p className="text-[9px] opacity-60 line-clamp-2 mt-0.5 leading-relaxed">Sourdough toast, smashed organic avocado, cherry tomatoes, feta, and poached egg.</p>
        </div>
      </div>
      <div className="flex justify-between items-center border-t border-zinc-200/20 pt-2 text-[10px]">
        <span className="font-bold" style={{ color: themeSettings.primaryColor }}>$11.99</span>
        <span className="text-[8px] opacity-50">Details 3D</span>
      </div>
    </div>
  );

  const mockBackCard = (
    <div className="p-3.5 flex flex-col h-full justify-between text-white" style={{ backgroundColor: "#1c1917" }}>
      <div className="space-y-1">
        <h4 className="font-bold text-xs border-b border-zinc-800 pb-1 text-amber-500">Allergen Flags</h4>
        <p className="text-[9px] text-zinc-300 leading-relaxed">Contains eggs and gluten. Dairy-free option available with vegan cheese substitution.</p>
        <div className="text-[8px] space-y-1 pt-1 text-zinc-400">
          <div className="flex justify-between border-b border-zinc-800 pb-0.5">
            <span>Calories</span>
            <span>480 kcal</span>
          </div>
          <div className="flex justify-between">
            <span>Spice Rating</span>
            <span>Mild</span>
          </div>
        </div>
      </div>
      <span className="text-[8px] text-center opacity-40">Tap again to reset</span>
    </div>
  );

  if (loading) {
    return (
      <div className="p-10 flex justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 space-y-8 max-w-6xl">
      
      {/* Header action bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">3. Brand & Layout Customizer</h1>
          <p className="text-zinc-400 text-sm mt-1">Configure your customer-facing theme, colors, fonts, and 3D animations.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {error && (
            <span className="text-rose-400 text-xs flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-xl">
              <AlertTriangle className="w-4 h-4" /> {error}
            </span>
          )}
          {saveSuccess && (
            <span className="text-emerald-400 text-xs flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
              <Check className="w-4 h-4" /> Design Preserved!
            </span>
          )}
          <button
            onClick={handleSaveTheme}
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-amber-500 text-black font-bold px-5 py-3 rounded-xl hover:bg-amber-400 transition-colors cursor-pointer"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin stroke-[2.5]" />
            ) : (
              <Save className="w-4 h-4 stroke-[2.5]" />
            )}
            Save Design
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Style Editor Panels */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Presets Cards */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              Theme Preset Palettes
            </h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {PRESETS.map((preset) => (
                <div
                  key={preset.name}
                  onClick={() => handlePresetSelect(preset)}
                  className="p-3 rounded-xl border border-zinc-900 hover:border-zinc-800 bg-zinc-900/10 hover:bg-zinc-900/30 cursor-pointer flex flex-col justify-between h-20 transition-all select-none"
                >
                  <p className="text-xs font-bold text-white">{preset.name}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.primaryColor }} />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: preset.secondaryColor }} />
                    <div className="w-4 h-4 rounded-full border border-zinc-800" style={{ backgroundColor: preset.backgroundColor }} />
                    <span className="text-[10px] text-zinc-550 capitalize">{preset.theme} • {preset.cardStyle}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Theme type, Card design & Typography */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-5">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Layout className="w-4 h-4 text-amber-500" />
              Theme Layout Parameters
            </h3>

            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Theme Layout</label>
                <select
                  value={themeSettings.theme}
                  onChange={(e) => setThemeSettings({ ...themeSettings, theme: e.target.value as any })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                >
                  <option value="classic">Classic Plain</option>
                  <option value="modern">Modern Flat</option>
                  <option value="minimal">Minimalist Bold</option>
                  <option value="glassmorphism">Glassmorphism Blur</option>
                  <option value="neon">Neon Dark Mode</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">3D Card Presentation</label>
                <select
                  value={themeSettings.cardStyle}
                  onChange={(e) => setThemeSettings({ ...themeSettings, cardStyle: e.target.value as any })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                >
                  <option value="flat">Standard Flat Card</option>
                  <option value="elevated">Elevated Shadow</option>
                  <option value="3d-tilt">3D Glare Tilt (Hover)</option>
                  <option value="3d-flip">3D Double Flip (Tap)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-zinc-400">Typography Font</label>
                <select
                  value={themeSettings.fontFamily}
                  onChange={(e) => setThemeSettings({ ...themeSettings, fontFamily: e.target.value })}
                  className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 transition-all"
                >
                  <option value="Inter">Inter (Sans-Serif)</option>
                  <option value="Outfit">Outfit (Round Geometric)</option>
                  <option value="Playfair">Playfair (Elegant Serif)</option>
                  <option value="Georgia">Georgia (Classic Book)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Color pickers */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              Custom Color Palette
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Primary Accent</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeSettings.primaryColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, primaryColor: e.target.value })}
                    className="w-8 h-8 rounded border border-zinc-850 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeSettings.primaryColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, primaryColor: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-white px-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Secondary Accent</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeSettings.secondaryColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, secondaryColor: e.target.value })}
                    className="w-8 h-8 rounded border border-zinc-850 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeSettings.secondaryColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, secondaryColor: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-white px-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Background</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeSettings.backgroundColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, backgroundColor: e.target.value })}
                    className="w-8 h-8 rounded border border-zinc-850 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeSettings.backgroundColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, backgroundColor: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-white px-2 focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-400 uppercase">Text Color</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={themeSettings.textColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, textColor: e.target.value })}
                    className="w-8 h-8 rounded border border-zinc-850 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={themeSettings.textColor}
                    onChange={(e) => setThemeSettings({ ...themeSettings, textColor: e.target.value })}
                    className="w-full bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs text-white px-2 focus:outline-none font-mono"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Phone Simulator Preview */}
        <div className="lg:col-span-5 flex flex-col items-center">
          <div className="sticky top-6 w-full max-w-[320px]">
            <p className="text-zinc-550 text-xs font-bold text-center mb-4 uppercase tracking-widest flex items-center justify-center gap-1.5">
              <Smartphone className="w-4 h-4 text-amber-500" />
              Live Customer Preview
            </p>

            {/* Phone container */}
            <div className="bg-zinc-950 rounded-[40px] p-3 border-4 border-zinc-900 shadow-2xl relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-5 bg-zinc-900 rounded-b-xl z-20 flex items-center justify-center">
                <div className="w-10 h-1 bg-black rounded-full" />
              </div>
              
              {/* Screen Content Wrapper */}
              <div 
                className="rounded-[32px] overflow-hidden px-4 py-8 h-[500px] flex flex-col transition-colors duration-300 relative select-none"
                style={{ 
                  backgroundColor: themeSettings.backgroundColor,
                  color: themeSettings.textColor,
                  fontFamily: themeSettings.fontFamily === "Outfit" ? "var(--font-geist-sans)" : themeSettings.fontFamily,
                }}
              >
                {/* Header inside phone */}
                <div className="flex justify-between items-center pb-3 border-b border-zinc-200/10 mb-4">
                  <div>
                    <h3 className="text-xs font-black tracking-tight">{restaurant.name}</h3>
                    <p className="text-[8px] opacity-60">Menu Preview</p>
                  </div>
                  {restaurant.logoUrl ? (
                    <img src={restaurant.logoUrl} alt="Logo" className="w-6 h-6 rounded-full object-cover" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-850 flex items-center justify-center text-[8px]">🍴</div>
                  )}
                </div>

                {/* Filters inside phone */}
                <div className="flex gap-1.5 mb-4 text-[9px] overflow-x-auto pb-1 shrink-0">
                  <span className="px-2.5 py-1 rounded-full font-bold shadow-sm" style={{ backgroundColor: themeSettings.primaryColor, color: themeSettings.theme === "neon" ? "black" : "white" }}>Starters</span>
                  <span className="px-2.5 py-1 rounded-full opacity-50 border" style={{ borderColor: themeSettings.textColor + "30" }}>Mains</span>
                  <span className="px-2.5 py-1 rounded-full opacity-50 border" style={{ borderColor: themeSettings.textColor + "30" }}>Desserts</span>
                </div>

                {/* Card Simulator inside phone */}
                <div className="flex-1 overflow-y-auto space-y-4 py-1">
                  
                  {/* Standard or 3D cards */}
                  <Card3D
                    frontContent={mockFrontCard}
                    backContent={mockBackCard}
                    styleType={themeSettings.cardStyle}
                  />

                  <div 
                    className="p-3 rounded-2xl border"
                    style={{ 
                      backgroundColor: themeSettings.theme === "neon" ? "#18181b" : "white",
                      borderColor: themeSettings.textColor + "15",
                    }}
                  >
                    <div className="flex justify-between items-baseline">
                      <h4 className="font-extrabold text-xs">Lemonade Spritzer</h4>
                      <span className="font-bold text-xs text-amber-500" style={{ color: themeSettings.primaryColor }}>$4.50</span>
                    </div>
                    <p className="text-[9px] opacity-60 mt-1 line-clamp-1">Freshly squeezed lemons with sugar syrup and mint sprig.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
