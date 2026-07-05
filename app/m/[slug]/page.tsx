"use client";

import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { getRestaurantBySlug, getMenu, getMenus, Restaurant, Menu, MenuItem } from "@/lib/firebase/db";
import { Card3D } from "@/components/ui/3d-card";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Loader2, 
  Leaf, 
  Flame, 
  Search, 
  AlertTriangle,
  Info,
  ChevronRight,
  Phone,
  Compass,
  X,
  ExternalLink,
  MessageSquare,
  Clock,
  Sparkles,
  ShoppingBag,
  Bell
} from "lucide-react";

// Helper: Calculate if a hex color is dark
function isColorDark(color: string) {
  if (!color) return false;
  const hex = color.replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 < 128;
  }
  return false;
}

// Helper: Resolve dynamic Unsplash food photos based on dish keywords for premium UI layout
function getFoodImage(name: string): string | null {
  const lowercase = name.toLowerCase();
  if (lowercase.includes("waffle")) {
    return "https://images.unsplash.com/photo-1562376502-6f769499c886?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("chocolate") || lowercase.includes("nutella")) {
    return "https://images.unsplash.com/photo-1511381939415-e44015463834?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("salad")) {
    return "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("sandwich") || lowercase.includes("panini") || lowercase.includes("wrap")) {
    return "https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("chicken")) {
    return "https://images.unsplash.com/photo-1598515214211-89d3c73ae83b?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("burger")) {
    return "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("pizza") || lowercase.includes("margherita")) {
    return "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("taco")) {
    return "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("lemonade")) {
    return "https://images.unsplash.com/photo-1534353436294-0dbd4bdac845?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("smoothie") || lowercase.includes("milkshake") || lowercase.includes("drink") || lowercase.includes("soda") || lowercase.includes("coke")) {
    return "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("coffee") || lowercase.includes("latte") || lowercase.includes("cappuccino")) {
    return "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("tea") || lowercase.includes("matcha")) {
    return "https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("water")) {
    return "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("fries")) {
    return "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("wings")) {
    return "https://images.unsplash.com/photo-1567620832903-9fc6debc209f?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("salmon") || lowercase.includes("fish")) {
    return "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("cake") || lowercase.includes("dessert") || lowercase.includes("lava") || lowercase.includes("sweet")) {
    return "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80";
  }
  if (lowercase.includes("pasta") || lowercase.includes("spaghetti") || lowercase.includes("penne")) {
    return "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=600&q=80";
  }
  return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&q=80"; // Default food flatlay
}

export default function PublicMenu() {
  const { slug } = useParams() as { slug: string };
  const searchParams = useSearchParams();
  const table = searchParams.get("table") || "";

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Interaction states
  const [selectedCatId, setSelectedCatId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [waiterModalOpen, setWaiterModalOpen] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);

  useEffect(() => {
    const fetchPublicMenu = async () => {
      try {
        // 1. Fetch restaurant by unique slug
        const restData = await getRestaurantBySlug(slug);
        if (!restData) {
          setError("Restaurant not found or is currently inactive.");
          setLoading(false);
          return;
        }
        setRestaurant(restData);

        // 2. Fetch active menu details
        let menuData = null;
        if (restData.activeMenuId) {
          menuData = await getMenu(restData.id!, restData.activeMenuId);
        }

        // Failsafe fallback: if active menu is empty or not set, look for any populated menu
        if (!menuData || !menuData.categories || menuData.categories.length === 0) {
          const menuList = await getMenus(restData.id!);
          const populatedMenu = menuList.find(m => m.categories && m.categories.length > 0);
          if (populatedMenu) {
            menuData = populatedMenu;
          }
        }

        if (menuData) {
          setMenu(menuData);
          setSelectedCatId(""); // Default to "All" view on load
        } else {
          setError("This restaurant has no active menu published yet.");
        }
      } catch (err) {
        console.error("Public menu fetch error:", err);
        setError("Unable to load digital menu.");
      } finally {
        setLoading(false);
      }
    };

    fetchPublicMenu();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-zinc-550 text-xs tracking-wider animate-pulse">Loading Digital Menu...</p>
      </div>
    );
  }

  if (error || !restaurant || !menu) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-5">
        <AlertTriangle className="w-12 h-12 text-amber-500" />
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold">Menu Unavailable</h1>
          <p className="text-zinc-550 text-xs max-w-xs mx-auto leading-relaxed">{error || "The menu could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const theme = menu.theme || {
    theme: "classic",
    primaryColor: "#d97706",
    secondaryColor: "#1e293b",
    backgroundColor: "#fafaf9",
    textColor: "#1c1917",
    fontFamily: "Inter",
    cardStyle: "3d-tilt"
  };

  const isDarkBg = isColorDark(theme.backgroundColor);
  const fontUrl = `https://fonts.googleapis.com/css2?family=${theme.fontFamily.replace(/\s+/g, "+")}:wght@300;400;500;600;700;800&display=swap`;

  const categories = menu.categories || [];

  // Filter items based on search and category
  const filteredCategories = categories.map(cat => {
    if (selectedCatId && cat.id !== selectedCatId && !searchQuery) {
      return null;
    }
    
    const items = cat.items.filter(item => 
      item.isAvailable &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       item.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (items.length === 0) return null;
    return { ...cat, items };
  }).filter(Boolean) as typeof categories;

  // Call Waiter handler
  const triggerCallWaiter = () => {
    setWaiterCalled(true);
    setTimeout(() => {
      setWaiterCalled(false);
      setWaiterModalOpen(false);
    }, 3000);
  };

  // Render front of a dish card
  const renderCardFront = (item: MenuItem) => {
    return (
      <div className="flex flex-col h-full bg-transparent text-left">
        
        {/* Card Header Image */}
        {item.image || getFoodImage(item.name) ? (
          <div className="h-48 w-full bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${item.image || getFoodImage(item.name)}')` }} />
        ) : (
          <div 
            className="h-32 w-full flex flex-col items-center justify-center shrink-0 relative overflow-hidden"
            style={{ 
              background: `linear-gradient(135deg, ${theme.primaryColor}15 0%, ${theme.secondaryColor}25 100%)`
            }}
          >
            <div className="absolute inset-0 opacity-15" style={{ 
              backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
              backgroundSize: "20px 20px" 
            }} />
            <span className="text-3xl relative z-1">🍽️</span>
            <span className="text-[10px] uppercase font-bold tracking-widest mt-1 opacity-50">Gourmet Selection</span>
          </div>
        )}
        
        {/* Card Body content */}
        <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            <div className="flex justify-between items-start gap-3">
              <h4 className="font-bold text-base leading-snug tracking-tight" style={{ color: theme.textColor }}>
                {item.name}
              </h4>
              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                {item.type === "veg" && <span title="Vegetarian"><Leaf className="w-4 h-4 text-emerald-500 fill-emerald-500/10" /></span>}
                {item.type === "egg" && <span className="text-[12px] opacity-75">🥚</span>}
                {item.spiceLevel > 0 && (
                  <div className="flex gap-0.5">
                    {Array.from({ length: item.spiceLevel }).map((_, idx) => (
                      <Flame key={idx} className="w-3.5 h-3.5 text-orange-500 fill-orange-500/10 animate-pulse" />
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: theme.textColor, opacity: 0.65 }}>
              {item.description}
            </p>
          </div>

          <div className="flex justify-between items-center border-t border-zinc-500/10 pt-3">
            <span className="font-extrabold text-base" style={{ color: theme.primaryColor }}>
              {restaurant.currency === "USD" && "$"}
              {restaurant.currency === "EUR" && "€"}
              {restaurant.currency === "INR" && "₹"}
              {restaurant.currency === "GBP" && "£"}
              {item.price.toFixed(2)}
            </span>
            
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItem(item);
              }}
              className="text-[10px] font-bold py-1.5 px-3 rounded-lg flex items-center gap-1 hover:opacity-90 active:scale-95 transition-all cursor-pointer border"
              style={{ 
                borderColor: theme.primaryColor + "25",
                backgroundColor: theme.primaryColor + "05",
                color: theme.primaryColor 
              }}
            >
              Details <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Render back of a dish card for 3D flip layouts
  const renderCardBack = (item: MenuItem) => (
    <div className="flex flex-col h-full justify-between text-left text-white">
      <div className="space-y-4">
        <h4 className="font-bold text-sm border-b border-zinc-800 pb-2 flex items-center justify-between" style={{ color: theme.primaryColor }}>
          Dietary Information
          {item.type === "veg" && (
            <span className="text-[9px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 px-2.5 py-0.5 rounded-full uppercase tracking-wider font-bold">
              Vegetarian
            </span>
          )}
        </h4>

        {item.allergens && item.allergens.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Contains:</p>
            <div className="flex flex-wrap gap-1.5">
              {item.allergens.map((allergen) => (
                <span key={allergen} className="text-[9px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700/50 px-2.5 py-0.5 rounded-md capitalize">
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-zinc-400 italic">No specific allergen declarations logged.</p>
        )}

        {item.tags && item.tags.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[9px] text-zinc-400 font-semibold uppercase tracking-wider">Tags:</p>
            <div className="flex flex-wrap gap-1.5">
              {item.tags.map((tag) => (
                <span key={tag} className="text-[9px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-md">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className="text-center text-[9px] opacity-40 border-t border-zinc-800 pt-2 shrink-0 select-none">
        Tap to reset card view
      </div>
    </div>
  );

  return (
    <div 
      className="min-h-screen pb-20 transition-colors duration-300 relative"
      style={{ 
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontFamily: theme.fontFamily === "Outfit" ? "sans-serif" : theme.fontFamily,
      }}
    >
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      {/* @ts-ignore */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href={fontUrl} rel="stylesheet" />

      {/* Floating Call Waiter Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setWaiterModalOpen(true)}
          className="w-14 h-14 rounded-full flex items-center justify-center shadow-2xl cursor-pointer text-white relative bg-gradient-to-tr from-amber-600 to-amber-500"
        >
          <Bell className="w-6 h-6 animate-float" />
          {table && (
            <span className="absolute -top-1.5 -right-1.5 bg-black border border-white/20 text-[9px] font-extrabold px-1.5 py-0.5 rounded-full select-none">
              T-{table}
            </span>
          )}
        </motion.button>
      </div>

      {/* Interactive Hero Cover Header Banner */}
      <div className="w-full relative h-48 sm:h-64 overflow-hidden border-b border-zinc-500/10 bg-zinc-900 text-white shrink-0">
        <div className="absolute inset-0 bg-cover bg-center filter blur-md scale-105 opacity-25" style={{ 
          backgroundImage: restaurant.logoUrl ? `url('${restaurant.logoUrl}')` : "none" 
        }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        
        <div className="absolute bottom-6 left-6 right-6 flex items-end gap-4 relative z-10">
          {restaurant.logoUrl ? (
            <img src={restaurant.logoUrl} alt="Logo" className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/20 shadow-lg bg-zinc-950" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-center text-3xl shadow-lg">🍴</div>
          )}
          
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-none text-white">{restaurant.name}</h1>
            <p className="text-[10px] sm:text-xs font-bold text-amber-400 uppercase tracking-widest leading-none mt-1">
              {restaurant.cuisine || "Digital Gourmet"}
            </p>
            {table && (
              <span className="inline-block mt-2 text-[9px] font-extrabold bg-amber-500 text-black px-2 py-0.5 rounded-full tracking-wider uppercase">
                Table: {table}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Premium Search Bar */}
      <div className="sticky top-0 z-35 backdrop-blur-md bg-white/70 dark:bg-black/60 border-b border-zinc-500/10 px-6 py-4 flex gap-4 items-center">
        <div className="relative flex-grow">
          <Search className="absolute left-3.5 top-3 w-4 h-4 opacity-40" />
          <input
            type="text"
            placeholder="Search dish or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-zinc-500/5 border border-zinc-500/15 rounded-xl py-2.5 pl-11 pr-4 text-xs focus:outline-none focus:ring-1 transition-all"
            style={{ 
              borderColor: theme.primaryColor + "30",
              // @ts-ignore
              "--tw-ring-color": theme.primaryColor
            }}
          />
        </div>
        {restaurant.phone && (
          <a 
            href={`tel:${restaurant.phone}`}
            className="w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 hover:bg-zinc-500/5 transition-colors cursor-pointer"
            style={{ borderColor: theme.textColor + "15" }}
          >
            <Phone className="w-4 h-4" />
          </a>
        )}
      </div>

      {/* Sticky Category Horizontal Filter Bar */}
      {!searchQuery && (
        <div className="sticky top-[69px] z-30 backdrop-blur-md bg-white/50 dark:bg-black/40 border-b border-zinc-500/5 px-6 py-3.5 flex gap-2.5 overflow-x-auto pb-3.5 shrink-0 scrollbar-none select-none">
          <button
            onClick={() => setSelectedCatId("")}
            className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all border cursor-pointer border-transparent shadow-sm"
            style={{
              backgroundColor: selectedCatId === "" ? theme.primaryColor : theme.backgroundColor,
              borderColor: selectedCatId === "" ? "transparent" : theme.textColor + "15",
              color: selectedCatId === "" ? (isDarkBg ? "#000000" : "#ffffff") : theme.textColor,
            }}
          >
            All Choices
          </button>
          
          {categories.map((cat) => {
            const isActive = selectedCatId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCatId(cat.id)}
                className="px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap shrink-0 transition-all border cursor-pointer shadow-sm"
                style={{
                  backgroundColor: isActive ? theme.primaryColor : theme.backgroundColor,
                  borderColor: isActive ? "transparent" : theme.textColor + "15",
                  color: isActive ? (isDarkBg ? "#000000" : "#ffffff") : theme.textColor,
                }}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Main Dishes Grid */}
      <main className="px-6 mt-8 max-w-6xl mx-auto">
        {filteredCategories.length === 0 ? (
          <div className="py-24 text-center space-y-3 opacity-40">
            <Compass className="w-10 h-10 mx-auto animate-pulse" />
            <p className="text-xs font-bold">No dishes matched your criteria</p>
            <p className="text-[10px]">Please search for another recipe or tag.</p>
          </div>
        ) : (
          filteredCategories.map((category) => (
            <div key={category.id} className="space-y-5 mb-10">
              
              {/* Category Header */}
              <div className="space-y-1 pl-3 border-l-3" style={{ borderColor: theme.primaryColor }}>
                <h3 className="text-sm font-black uppercase tracking-wider leading-none" style={{ color: theme.textColor }}>
                  {category.name}
                </h3>
                {category.description && (
                  <p className="text-[10px] opacity-50 leading-relaxed italic mt-0.5">{category.description}</p>
                )}
              </div>

              {/* Responsive Items Grid (double column on mobile-tablet, triple on desktop) */}
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {category.items.map((item) => (
                  <div key={item.id} className="h-full flex">
                    <Card3D
                      frontContent={renderCardFront(item)}
                      backContent={theme.cardStyle === "3d-flip" ? renderCardBack(item) : undefined}
                      styleType={theme.cardStyle}
                      theme={theme}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>

      {/* Footer Details */}
      <footer className="px-6 mt-16 text-center text-[10px] opacity-40 flex flex-col items-center justify-center gap-1.5 border-t border-zinc-500/10 pt-10 pb-6">
        {restaurant.address && (
          <p className="max-w-xs mx-auto leading-relaxed">{restaurant.address}</p>
        )}
        <p className="font-bold flex items-center gap-1 mt-1 text-xs">
          📞 Contact Waiter: {restaurant.phone || "Direct Service"}
        </p>
        <p className="mt-2 opacity-80">© {new Date().getFullYear()} {restaurant.name}. Powered by Menu3D QR.</p>
      </footer>

      {/* Details Dialog Modal */}
      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black cursor-pointer"
            />
            
            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 text-black dark:text-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 flex flex-col max-h-[90vh] border border-zinc-500/10"
            >
              {/* Close Button */}
              <button 
                onClick={() => setSelectedItem(null)}
                className="absolute top-4 right-4 bg-black/60 text-white w-8 h-8 rounded-full flex items-center justify-center z-20 hover:bg-black/80 transition-colors cursor-pointer border border-white/10"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Large Image Header */}
              {selectedItem.image || getFoodImage(selectedItem.name) ? (
                <div className="h-56 w-full bg-cover bg-center shrink-0" style={{ backgroundImage: `url('${selectedItem.image || getFoodImage(selectedItem.name)}')` }} />
              ) : (
                <div className="h-40 w-full bg-gradient-to-tr from-amber-600/20 to-amber-500/10 flex items-center justify-center shrink-0 border-b border-zinc-500/10">
                  <span className="text-5xl">🍽️</span>
                </div>
              )}

              {/* Content body */}
              <div className="p-6 space-y-5 overflow-y-auto flex-1 text-left">
                <div className="space-y-1">
                  <div className="flex justify-between items-start gap-4">
                    <h3 className="font-extrabold text-lg tracking-tight leading-tight">{selectedItem.name}</h3>
                    <span className="font-black text-lg text-amber-500 shrink-0">
                      {restaurant.currency === "USD" && "$"}
                      {restaurant.currency === "EUR" && "€"}
                      {restaurant.currency === "INR" && "₹"}
                      {restaurant.currency === "GBP" && "£"}
                      {selectedItem.price.toFixed(2)}
                    </span>
                  </div>
                  
                  {/* Diet Badge row */}
                  <div className="flex items-center gap-1.5 mt-2">
                    {selectedItem.type === "veg" && (
                      <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wide flex items-center gap-1">
                        <Leaf className="w-3 h-3 fill-current" /> Vegetarian
                      </span>
                    )}
                    {selectedItem.type === "non-veg" && (
                      <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wide">
                        Non-Vegetarian
                      </span>
                    )}
                    {selectedItem.spiceLevel > 0 && (
                      <span className="text-[9px] font-black bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-full px-2.5 py-0.5 uppercase tracking-wide flex items-center gap-0.5">
                        <Flame className="w-3 h-3 fill-current" /> Spice: {selectedItem.spiceLevel}
                      </span>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Description</h4>
                  <p className="text-xs leading-relaxed opacity-75">{selectedItem.description}</p>
                </div>

                {/* Allergens declarations */}
                {selectedItem.allergens && selectedItem.allergens.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Allergens Declarations</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItem.allergens.map((allergen) => (
                        <span key={allergen} className="text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-lg capitalize">
                          {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tag pill row */}
                {selectedItem.tags && selectedItem.tags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Menu Tags</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedItem.tags.map((tag) => (
                        <span key={tag} className="text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Order/Call Action Footer */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-150 dark:border-zinc-850 shrink-0">
                <button
                  onClick={() => {
                    setSelectedItem(null);
                    setWaiterModalOpen(true);
                  }}
                  className="w-full bg-black dark:bg-white text-white dark:text-black font-extrabold text-xs py-3 rounded-2xl flex items-center justify-center gap-1.5 hover:opacity-90 active:scale-98 transition-all cursor-pointer"
                >
                  <Bell className="w-4 h-4 shrink-0" />
                  Order / Call Waiter to Table
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Waiter Calling Modal */}
      <AnimatePresence>
        {waiterModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              exit={{ opacity: 0 }}
              onClick={() => setWaiterModalOpen(false)}
              className="absolute inset-0 bg-black cursor-pointer"
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white dark:bg-zinc-900 text-black dark:text-white rounded-3xl p-6 text-center max-w-xs w-full shadow-2xl relative z-10 border border-zinc-550/10"
            >
              <button 
                onClick={() => setWaiterModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-white w-6 h-6 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="space-y-4 py-4 flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/25 flex items-center justify-center">
                  <Bell className={`w-6 h-6 text-amber-500 ${waiterCalled ? "animate-bounce" : ""}`} />
                </div>
                
                <div className="space-y-1">
                  <h3 className="font-extrabold text-base">Call Waiter</h3>
                  <p className="text-zinc-550 text-[10px] max-w-[200px] leading-relaxed">
                    {table 
                      ? `Summon service assistant directly to Table ${table}.` 
                      : "Summon service assistant directly to your table."}
                  </p>
                </div>

                {waiterCalled ? (
                  <div className="text-emerald-500 font-bold text-xs flex items-center gap-1 py-2">
                    <Sparkles className="w-4 h-4" /> Waiter Called Successfully!
                  </div>
                ) : (
                  <button
                    onClick={triggerCallWaiter}
                    className="w-full bg-gradient-to-tr from-amber-600 to-amber-500 text-white font-extrabold text-xs py-2.5 rounded-xl hover:shadow-lg active:scale-98 transition-all cursor-pointer mt-2"
                  >
                    Ring Service Bell
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
