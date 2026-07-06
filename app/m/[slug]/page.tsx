"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  getPublishedMenuForRestaurant,
  getRestaurantBySlug,
  getMenuCategoriesSubcollection,
  getMenuItemsSubcollection,
  getActiveThemeForRestaurant,
  Menu,
  MenuCategory,
  MenuItem,
  MenuTheme,
  Restaurant
} from "@/lib/firebase/db";
import { Card3D } from "@/components/ui/3d-card";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ChefHat,
  Clock3,
  Drumstick,
  Egg,
  Flame,
  Leaf,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Sparkles,
  X
} from "lucide-react";

type FilterKey = "all" | "veg" | "non-veg" | "egg" | "vegan" | "spicy" | "popular" | "available";
type CustomerMenuItem = MenuItem & { categoryId: string; categoryName: string };
type CustomerCategory = Omit<MenuCategory, "items"> & { items: CustomerMenuItem[] };

const DEFAULT_THEME: MenuTheme = {
  theme: "classic",
  primaryColor: "#b45309",
  accentColor: "#0f766e",
  secondaryColor: "#292524",
  backgroundColor: "#fffaf2",
  textColor: "#1c1917",
  fontFamily: "Inter",
  cardStyle: "3d-tilt",
  layoutStyle: "premium",
  animationStyle: "subtle"
};

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "veg", label: "Veg" },
  { key: "non-veg", label: "Non-Veg" },
  { key: "egg", label: "Egg" },
  { key: "vegan", label: "Vegan" },
  { key: "spicy", label: "Spicy" },
  { key: "popular", label: "Popular" },
  { key: "available", label: "Available" }
];

function isColorDark(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return false;
  const expanded = hex.length === 3 ? hex.split("").map(char => char + char).join("") : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function mergeTheme(theme?: Partial<MenuTheme>) {
  return {
    ...DEFAULT_THEME,
    ...theme,
    accentColor: theme?.accentColor || theme?.secondaryColor || DEFAULT_THEME.accentColor
  };
}

function sortBySortOrder<T extends { sortOrder?: number }>(items: T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.sortOrder ?? a.index) - (b.item.sortOrder ?? b.index))
    .map(({ item }) => item);
}

function normalizeCategories(menu: Menu | null): CustomerCategory[] {
  if (!menu?.categories) return [];

  return sortBySortOrder(menu.categories.filter(category => category.isActive !== false))
    .map(category => {
      const items = sortBySortOrder((category.items || []).filter(item => item.isActive !== false))
        .map(item => ({
          ...item,
          categoryId: category.id,
          categoryName: category.name,
          description: item.description || "",
          allergens: item.allergens || [],
          tags: item.tags || [],
          isAvailable: item.isAvailable !== false,
          type: (item.type || item.dietaryTag || "unknown") as MenuItem["type"],
          dietaryTag: item.dietaryTag ?? null,
          priceOptions: item.priceOptions || [],
          variants: item.variants || [],
          confidence: item.confidence || "high",
          subcategory: item.subcategory || null,
          spiceLevel: item.spiceLevel ?? null,
          price: Number(item.price) || 0
        }));

      return { ...category, items };
    })
    .filter(category => category.items.length > 0);
}

function formatPrice(price: number, currency?: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      currencyDisplay: "narrowSymbol"
    }).format(price);
  } catch {
    return `${currency || "USD"} ${price.toFixed(2)}`;
  }
}

function formatItemPrice(item: MenuItem, currency?: string) {
  const options = item.priceOptions || [];
  const pricedOptions = options.filter(option => option.amount !== null && option.amount !== undefined);

  if (pricedOptions.length > 0) {
    return pricedOptions
      .map(option => {
        const amount = formatPrice(Number(option.amount), currency);
        return option.size ? `${option.size} ${amount}` : amount;
      })
      .join(" / ");
  }

  if (Number(item.price) > 0) return formatPrice(Number(item.price), currency);
  return "Price unavailable";
}

function getItemImage(item: MenuItem) {
  return item.imageUrl || item.image || "";
}


function isPopularItem(item: MenuItem) {
  return Boolean(
    item.isPopular ||
      item.tags?.some(tag => /popular|best|seller|favorite|favourite|chef/i.test(tag))
  );
}

function groupItemsBySubcategory(items: CustomerMenuItem[]) {
  const groups = new Map<string, CustomerMenuItem[]>();

  items.forEach(item => {
    const key = item.subcategory || "";
    groups.set(key, [...(groups.get(key) || []), item]);
  });

  return Array.from(groups.entries()).map(([name, groupItems]) => ({
    name,
    items: groupItems
  }));
}

function getWhatsAppUrl(restaurant: Restaurant, item?: MenuItem | null) {
  const phone = restaurant.whatsapp?.replace(/\D/g, "");
  if (!phone) return "";

  const text = item
    ? `Hi ${restaurant.name}, I would like to order ${item.name}.`
    : `Hi ${restaurant.name}, I would like to place an order.`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}

function getServiceLabel(restaurant: Restaurant) {
  if (typeof restaurant.isOpen === "boolean") {
    return restaurant.isOpen ? "Open now" : "Closed";
  }

  if (restaurant.openStatus === "open") return "Open now";
  if (restaurant.openStatus === "closed") return "Closed";
  return "Live menu";
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-[#fffaf2] text-stone-900">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="h-32 rounded-lg bg-stone-200/70 animate-pulse" />
        <div className="sticky top-0 mt-6 space-y-3 bg-[#fffaf2]/95 py-4">
          <div className="h-12 rounded-lg bg-stone-200/80 animate-pulse" />
          <div className="flex gap-2 overflow-hidden">
            {[1, 2, 3, 4].map(item => (
              <div key={item} className="h-9 w-24 shrink-0 rounded-full bg-stone-200/80 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map(item => (
            <div key={item} className="h-72 rounded-lg bg-white shadow-sm animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PublicMenuContent() {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const table = searchParams.get("table") || "";
  const reduceMotion = useReducedMotion();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [categories, setCategories] = useState<CustomerCategory[]>([]);
  const [activeTheme, setActiveTheme] = useState<MenuTheme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<"not-found" | "not-published" | "other" | "">("");
  const [selectedCatId, setSelectedCatId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [selectedItem, setSelectedItem] = useState<CustomerMenuItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPublicMenu() {
      setLoading(true);
      setError("");
      setErrorType("");
      setCategories([]);

      try {
        const restData = await getRestaurantBySlug(slug);
        if (!restData) {
          if (!cancelled) {
            setErrorType("not-found");
            setRestaurant(null);
          }
          return;
        }

        if (cancelled) return;
        setRestaurant(restData);

        if (restData.status !== "published") {
          if (!cancelled) {
            setErrorType("not-published");
          }
          return;
        }

        const publishedMenuId = restData.currentPublishedMenuId;
        if (!publishedMenuId) {
          if (!cancelled) {
            setErrorType("not-published");
          }
          return;
        }

        const publishedMenu = await getPublishedMenuForRestaurant(restData);
        if (!publishedMenu || publishedMenu.status !== "published" || publishedMenu.id !== publishedMenuId) {
          if (!cancelled) {
            setErrorType("not-published");
          }
          return;
        }

        setMenu(publishedMenu);

        const [categoriesSnapshot, itemsSnapshot] = await Promise.all([
          getMenuCategoriesSubcollection(restData.id!, publishedMenuId),
          getMenuItemsSubcollection(restData.id!, publishedMenuId)
        ]);

        const themeData = await getActiveThemeForRestaurant(restData.id!);

        if (cancelled) return;
        setActiveTheme(themeData);

        let finalCategories: CustomerCategory[] = [];

        if (categoriesSnapshot.length > 0) {
          const sortedCats = categoriesSnapshot
            .filter(c => c.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

          const sortedItems = itemsSnapshot
            .filter(item => item.isActive !== false)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

          finalCategories = sortedCats.map(cat => {
            const items = sortedItems
              .filter(item => item.categoryId === cat.id)
              .map(item => ({
                ...item,
                categoryId: cat.id,
                categoryName: cat.name,
                description: item.description || "",
                allergens: item.allergens || [],
                tags: item.tags || [],
                isAvailable: item.isAvailable !== false,
                type: item.type || (item.isVeg ? "veg" : "non-veg"),
                spiceLevel: item.spiceLevel ?? null,
                price: Number(item.price) || 0
              }));
            
            return {
              ...cat,
              items
            };
          }).filter(cat => cat.items.length > 0);
        } else {
          finalCategories = normalizeCategories(publishedMenu);
        }

        if (publishedMenu.structuredItemsVerified === false) {
          finalCategories = finalCategories.map(cat => ({
            ...cat,
            items: cat.items.filter(item => item.confidence !== "low")
          })).filter(cat => cat.items.length > 0);
        }

        setCategories(finalCategories);
        setSelectedCatId("");
      } catch (err) {
        console.error("Public menu fetch error:", err);
        if (!cancelled) {
          setErrorType("other");
          setError("Unable to load this menu right now. Please try again in a moment.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPublicMenu();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const theme = useMemo(() => {
    const preferredTheme = activeTheme || menu?.theme;
    return mergeTheme(preferredTheme);
  }, [activeTheme, menu?.theme]);

  const isDark = isColorDark(theme.backgroundColor);

  useEffect(() => {
    if (!theme.fontFamily || ["Inter", "sans-serif", "serif", "monospace"].includes(theme.fontFamily)) return;
    
    const fontName = theme.fontFamily.replace(/\s+/g, "+");
    const linkId = `google-font-${fontName.toLowerCase()}`;
    if (document.getElementById(linkId)) return;

    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${fontName}:wght@400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  }, [theme.fontFamily]);

  const allItems = useMemo(() => categories.flatMap(category => category.items), [categories]);

  const visibleFilters = useMemo(() => {
    const hasUnavailableItems = allItems.some(item => !item.isAvailable);

    return FILTERS.filter(filter => {
      if (filter.key === "all") return true;
      if (filter.key === "veg") return allItems.some(item => item.type === "veg" || item.type === "vegan");
      if (filter.key === "non-veg") return allItems.some(item => item.type === "non-veg");
      if (filter.key === "spicy") return allItems.some(item => Number(item.spiceLevel) > 0);
      if (filter.key === "popular") return allItems.some(item => item.isFeatured || item.isPopular || isPopularItem(item));
      if (filter.key === "available") return hasUnavailableItems && allItems.some(item => item.isAvailable);
      return false;
    });
  }, [allItems]);

  useEffect(() => {
    if (!visibleFilters.some(filter => filter.key === activeFilter)) {
      setActiveFilter("all");
    }
  }, [activeFilter, visibleFilters]);

  useEffect(() => {
    if (categories.length === 0) return;

    const observerOptions = {
      root: null,
      rootMargin: "-25% 0px -55% 0px",
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setSelectedCatId(entry.target.id);
        }
      });
    }, observerOptions);

    categories.forEach((category) => {
      const el = document.getElementById(category.id);
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [categories]);

  const scrollToCategory = (categoryId: string) => {
    setSelectedCatId(categoryId);
    const element = document.getElementById(categoryId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const popularItems = useMemo(() => {
    return allItems.filter(item => (item.isFeatured || item.isPopular || isPopularItem(item)) && item.isAvailable);
  }, [allItems]);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .map(category => {
        const categoryMatches = category.name.toLowerCase().includes(query);
        const items = category.items.filter(item => {
          const searchMatches =
            !query ||
            categoryMatches ||
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            item.tags.some(tag => tag.toLowerCase().includes(query)) ||
            item.allergens.some(allergen => allergen.toLowerCase().includes(query));

          if (!searchMatches) return false;

          if (activeFilter === "veg") return item.type === "veg" || item.type === "vegan";
          if (activeFilter === "non-veg") return item.type === "non-veg";
          if (activeFilter === "spicy") return Number(item.spiceLevel) > 0;
          if (activeFilter === "popular") return item.isFeatured || item.isPopular || isPopularItem(item);
          if (activeFilter === "available") return item.isAvailable;
          return true;
        });

        return items.length > 0 ? { ...category, items } : null;
      })
      .filter(Boolean) as CustomerCategory[];
  }, [activeFilter, categories, searchQuery, selectedCatId]);

  const pageStyle = {
    "--menu-bg": theme.backgroundColor,
    "--menu-text": theme.textColor,
    "--menu-primary": theme.primaryColor,
    "--menu-accent": theme.accentColor || theme.secondaryColor,
    "--menu-card": isDark ? "#1c1917" : "#ffffff",
    "--menu-muted": isDark ? "#d6d3d1" : "#57534e",
    backgroundColor: theme.backgroundColor,
    color: theme.textColor,
    fontFamily: `${theme.fontFamily}, Inter, ui-sans-serif, system-ui, sans-serif`
  } as React.CSSProperties;

  const cardStyle = reduceMotion ? "elevated" : theme.cardStyle;
  const contactUrl = restaurant ? getWhatsAppUrl(restaurant) : "";

  if (loading) return <MenuSkeleton />;

  if (errorType === "not-found" || !restaurant) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-md space-y-5">
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
            <ChefHat className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Menu Not Found</h1>
            <p className="text-stone-400 text-sm leading-relaxed">
              We couldn&apos;t locate this restaurant. Please double-check the web address or scan the QR code again.
            </p>
          </div>
          <Link href="/" className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold px-6 py-2.5 rounded-xl text-xs transition-colors">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (errorType === "not-published") {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-md space-y-5">
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-2xl bg-stone-900 border border-stone-850 text-stone-400 animate-pulse">
            <Clock3 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Menu is not available yet</h1>
            <p className="text-stone-400 text-sm leading-relaxed">
              The digital menu for <strong className="text-white font-bold">{restaurant.name}</strong> is currently being prepared and has not been published. Please try again soon.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-stone-950 flex items-center justify-center px-6 py-16 text-white text-center">
        <div className="max-w-md space-y-4">
          <div className="mx-auto w-14 h-14 flex items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Error Loading Menu</h1>
            <p className="mt-2 text-sm leading-6 text-stone-400">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const serviceLabel = getServiceLabel(restaurant);

  const renderDietIcon = (item: MenuItem) => {
    if (item.type === "veg" || item.type === "vegan" || item.dietaryTag === "veg" || item.dietaryTag === "vegan") {
      return <Leaf className="h-4 w-4 text-emerald-600" aria-label={item.type === "vegan" ? "Vegan" : "Vegetarian"} />;
    }
    if (item.type === "egg" || item.dietaryTag === "egg") return <Egg className="h-4 w-4 text-amber-600" aria-label="Contains egg" />;
    if (item.type === "non-veg" || item.dietaryTag === "non-veg") return <Drumstick className="h-4 w-4 text-rose-700" aria-label="Non-vegetarian" />;
    return null;
  };

  const renderSpice = (item: MenuItem) => {
    if (!item.spiceLevel) return null;
    const count = Math.min(Number(item.spiceLevel), 3);
    return (
      <span className="flex items-center gap-0.5" aria-label={`Spice level ${item.spiceLevel}`}>
        {Array.from({ length: count }).map((_, index) => (
          <Flame key={index} className="h-3.5 w-3.5 fill-orange-500/15 text-orange-500" />
        ))}
      </span>
    );
  };

  const renderCardBack = (item: CustomerMenuItem) => (
    <div className="flex h-full flex-col justify-between text-left p-6">
      <div className="space-y-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">Details</p>
          <h3 className="mt-2 text-lg font-black leading-tight text-white">{item.name}</h3>
        </div>
        {item.description && <p className="text-sm leading-6 text-stone-300">{item.description}</p>}
        <div className="flex flex-wrap gap-2">
          {[...item.tags, ...item.allergens].slice(0, 6).map(label => (
            <span key={label} className="rounded-full border border-white/10 px-3 py-1 text-[11px] font-semibold text-stone-200">
              {label}
            </span>
          ))}
        </div>
      </div>
      <p className="text-lg font-black text-amber-300">{formatItemPrice(item, restaurant.currency)}</p>
    </div>
  );

  const renderItemCard = (item: CustomerMenuItem) => {
    const image = getItemImage(item);
    const hasImage = Boolean(image);
    const isAvailable = item.isAvailable !== false;

    const frontContent = (
      <article className={`flex h-full min-h-[160px] flex-col bg-[var(--menu-card)] text-[var(--menu-text)] ${!isAvailable ? "opacity-65 grayscale-[20%]" : ""}`}>
        <button
          type="button"
          onClick={() => setSelectedItem(item)}
          className="group flex h-full flex-col text-left"
          aria-label={`View ${item.name}`}
        >
          {hasImage ? (
            <div className="relative h-40 overflow-hidden bg-stone-100 dark:bg-stone-900">
              <img src={image} alt={item.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              {!isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-stone-950 uppercase tracking-widest">Out of Stock</span>
                </div>
              )}
              {item.isFeatured && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </span>
              )}
            </div>
          ) : (
            <div className="relative h-48 w-full overflow-hidden bg-gradient-to-br from-[var(--menu-primary)]/5 via-[var(--menu-accent)]/5 to-[var(--menu-primary)]/15 flex items-center justify-center">
              <ChefHat className="h-10 w-10 text-[var(--menu-primary)]/25 group-hover:scale-110 transition-transform duration-300" />
              {!isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-[1px]">
                  <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-stone-950 uppercase tracking-widest">Out of Stock</span>
                </div>
              )}
              {(item.isFeatured || item.isPopular) && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-[11px] font-bold text-white">
                  <Sparkles className="h-3 w-3" />
                  Featured
                </span>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {renderDietIcon(item)}
                  {renderSpice(item)}
                </div>
                <h3 className="mt-1.5 text-base font-black leading-tight tracking-tight">{item.name}</h3>
              </div>
              <p className="shrink-0 text-base font-black text-[var(--menu-primary)]">
                {formatItemPrice(item, restaurant.currency)}
              </p>
            </div>

            {item.description && (
              <p className="line-clamp-2 text-xs leading-relaxed text-[var(--menu-muted)]">
                {item.description}
              </p>
            )}

            <div className="mt-auto flex flex-wrap gap-1.5">
              {item.tags.slice(0, 2).map(tag => (
                <span key={tag} className="rounded-full border border-current/10 px-2.5 py-0.5 text-[10px] font-bold text-[var(--menu-muted)]">
                  {tag}
                </span>
              ))}
              {item.allergens.slice(0, 2).map(allergen => (
                <span key={allergen} className="rounded-full bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 text-[10px] font-bold text-stone-600 dark:text-stone-300">
                  {allergen}
                </span>
              ))}
            </div>
          </div>
        </button>
      </article>
    );

    return (
      <motion.div
        key={item.id}
        layout
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="h-full"
      >
        <Card3D
          frontContent={frontContent}
          backContent={cardStyle === "3d-flip" ? renderCardBack(item) : undefined}
          styleType={cardStyle}
          theme={theme}
          className="h-full rounded-2xl shadow-sm overflow-hidden"
        />
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" style={pageStyle}>
      <header className="border-b border-black/5 bg-[var(--menu-bg)]">
        <div className="mx-auto max-w-6xl px-5 pb-6 pt-7 sm:pt-10">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm">
              {restaurant.logoUrl ? (
                <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <ChefHat className="h-8 w-8 text-[var(--menu-primary)]" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--menu-primary)] px-3 py-0.5 text-[10px] font-black uppercase tracking-[0.16em] text-white">
                  <Clock3 className="h-3 w-3" />
                  {serviceLabel}
                </span>
                {table && (
                  <span className="rounded-full border border-current/10 px-3 py-0.5 text-[10px] font-bold text-[var(--menu-muted)]">
                    Table {table}
                  </span>
                )}
              </div>
              <h1 className="mt-2.5 text-2xl sm:text-4xl font-black leading-none tracking-tight">{restaurant.name}</h1>
              <p className="mt-2 max-w-2xl text-xs sm:text-sm font-medium leading-relaxed text-[var(--menu-muted)]">
                {restaurant.cuisine || "Restaurant menu"}
                {allItems.length > 0 && ` / ${allItems.length} ${allItems.length === 1 ? "item" : "items"}`}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-40 border-b border-black/5 bg-[var(--menu-bg)]/95 backdrop-blur transition-all duration-300">
        <div className="mx-auto max-w-6xl space-y-3 px-5 py-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--menu-muted)]" />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder="Search menu items..."
              className="h-12 w-full rounded-2xl border border-black/10 bg-white/85 dark:bg-stone-900/85 pl-11 pr-4 text-xs font-semibold text-stone-900 dark:text-stone-100 outline-none transition focus:border-[var(--menu-primary)] focus:ring-2 focus:ring-[var(--menu-primary)]/20"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {categories.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCatId("");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                aria-pressed={!selectedCatId}
                className="shrink-0 rounded-full border px-4 py-2 text-[11px] font-black transition cursor-pointer"
                style={{
                  backgroundColor: !selectedCatId ? theme.primaryColor : "transparent",
                  borderColor: !selectedCatId ? theme.primaryColor : `${theme.textColor}22`,
                  color: !selectedCatId ? "#ffffff" : theme.textColor
                }}
              >
                All Categories
                <span className="ml-1.5 text-[9px] opacity-75">{allItems.length}</span>
              </button>
            )}

            {categories.map(category => {
              const active = selectedCatId === category.id;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => scrollToCategory(category.id)}
                  aria-pressed={active}
                  className="shrink-0 rounded-full border px-4 py-2 text-[11px] font-black transition cursor-pointer"
                  style={{
                    backgroundColor: active ? theme.primaryColor : "transparent",
                    borderColor: active ? theme.primaryColor : `${theme.textColor}22`,
                    color: active ? "#ffffff" : theme.textColor
                  }}
                >
                  {category.name}
                  <span className="ml-1.5 text-[9px] opacity-75">{category.items.length}</span>
                </button>
              );
            })}
          </div>

          {visibleFilters.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {visibleFilters.map(filter => {
                const active = activeFilter === filter.key;
                return (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={() => setActiveFilter(filter.key)}
                    aria-pressed={active}
                    className="shrink-0 rounded-full border px-3.5 py-1.5 text-[10px] font-black transition cursor-pointer"
                    style={{
                      backgroundColor: active ? theme.accentColor : "rgba(255,255,255,0.08)",
                      borderColor: active ? theme.accentColor : `${theme.textColor}12`,
                      color: active ? "#ffffff" : theme.textColor
                    }}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <main className="mx-auto max-w-6xl px-5 py-7">
        {categories.length === 0 ? (
          <section className="rounded-2xl border border-black/10 bg-white/80 dark:bg-stone-900/80 p-12 text-center shadow-sm max-w-lg mx-auto">
            <ChefHat className="mx-auto h-12 w-12 text-[var(--menu-primary)]" />
            <h2 className="mt-4 text-2xl font-black">Menu is not published yet.</h2>
            <p className="mx-auto mt-2 text-xs leading-relaxed text-[var(--menu-muted)]">
              This restaurant hasn&apos;t set up dynamic categories or menu items yet. Check back soon.
            </p>
          </section>
        ) : (
          <>
            {popularItems.length > 0 && !selectedCatId && !searchQuery && (
              <section className="mb-10">
                <div className="mb-4 border-l-4 pl-4" style={{ borderColor: theme.primaryColor }}>
                  <h2 className="text-xl font-black leading-tight tracking-tight">Popular Picks</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[var(--menu-muted)]">Guest favorites and chef recommendations</p>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 pt-1 snap-x scrollbar-none">
                  {popularItems.map(item => (
                    <div key={`popular-${item.id}`} className="w-72 shrink-0 snap-start">
                      {renderItemCard(item)}
                    </div>
                  ))}
                </div>
              </section>
            )}



            {filteredCategories.length === 0 ? (
              <section className="rounded-2xl border border-black/10 bg-white/80 dark:bg-stone-900/80 p-12 text-center shadow-sm max-w-md mx-auto">
                <Search className="mx-auto h-10 w-10 text-[var(--menu-primary)]" />
                <h2 className="mt-4 text-lg font-black">No matching items found</h2>
                <p className="mx-auto mt-2 text-xs leading-relaxed text-[var(--menu-muted)]">
                  Try clearing your search query or choosing another dietary filter above.
                </p>
              </section>
            ) : (
              <div className="space-y-10">
                {filteredCategories.map(category => (
                  <section key={category.id} id={category.id} className="scroll-mt-40">
                    <div className="mb-5 border-l-4 pl-4" style={{ borderColor: theme.primaryColor }}>
                      <h2 className="text-xl font-black leading-tight tracking-tight">{category.name}</h2>
                      {category.description && (
                        <p className="mt-1 text-xs leading-relaxed text-[var(--menu-muted)]">{category.description}</p>
                      )}
                    </div>
                    <div className="space-y-6">
                      {groupItemsBySubcategory(category.items).map(group => (
                        <div key={group.name || "items"} className="space-y-3">
                          {group.name && (
                            <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[var(--menu-muted)] pl-1">
                              {group.name}
                            </h3>
                          )}
                          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {group.items.map(renderItemCard)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-5 pb-10 pt-2 text-xs text-[var(--menu-muted)]">
        <div className="border-t border-black/10 pt-6">
          {restaurant.address && <p className="leading-relaxed">{restaurant.address}</p>}
          <p className="mt-2 font-semibold text-stone-850 dark:text-stone-300">{restaurant.name}</p>
        </div>
      </footer>

      {(restaurant.whatsapp || restaurant.phone) && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-row gap-3 sm:bottom-5 sm:right-5 sm:flex-col">
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              aria-label="Call restaurant"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-950 text-white shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer"
            >
              <Phone className="h-5 w-5" />
            </a>
          )}
          {restaurant.whatsapp && contactUrl && (
            <a
              href={contactUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Order on WhatsApp"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--menu-accent)] text-white shadow-xl hover:scale-105 active:scale-95 transition cursor-pointer sm:h-14 sm:w-14"
            >
              <MessageCircle className="h-6 w-6" />
            </a>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.button
              type="button"
              aria-label="Close item details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="item-detail-title"
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-3xl bg-white dark:bg-stone-900 text-stone-950 dark:text-stone-50 shadow-2xl sm:max-w-lg sm:rounded-3xl"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Close"
                className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="h-56 bg-stone-100 dark:bg-stone-950 relative">
                {getItemImage(selectedItem) ? (
                  <img src={getItemImage(selectedItem)} alt={selectedItem.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[var(--menu-primary)]/10 text-[var(--menu-primary)]">
                    <ChefHat className="h-14 w-14 opacity-50" />
                  </div>
                )}
              </div>

              <div className="max-h-[calc(92vh-14rem)] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {renderDietIcon(selectedItem)}
                      {renderSpice(selectedItem)}
                      {!selectedItem.isAvailable && (
                        <span className="rounded-full bg-stone-200 dark:bg-stone-800 px-2.5 py-0.5 text-[10px] font-black text-stone-700 dark:text-stone-300 uppercase tracking-wider">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <h2 id="item-detail-title" className="mt-3 text-xl sm:text-2xl font-black leading-tight tracking-tight">
                      {selectedItem.name}
                    </h2>
                    <p className="mt-1 text-xs font-bold text-stone-500">{selectedItem.categoryName}</p>
                  </div>
                  <p className="shrink-0 text-lg sm:text-xl font-black text-[var(--menu-primary)]">
                    {formatItemPrice(selectedItem, restaurant.currency)}
                  </p>
                </div>

                {selectedItem.description && (
                  <p className="mt-4 text-xs sm:text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                    {selectedItem.description}
                  </p>
                )}

                {selectedItem.tags.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Tags</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.variants && selectedItem.variants.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Variants / Add-ons</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.variants.map(variant => (
                        <span key={variant} className="rounded-full bg-stone-100 dark:bg-stone-800 px-3 py-1 text-[10px] font-bold text-stone-700 dark:text-stone-300">
                          {variant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.allergens.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-stone-500">Allergens</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.allergens.map(allergen => (
                        <span key={allergen} className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                          {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {restaurant.whatsapp && (
                <div className="border-t border-stone-200 dark:border-stone-800 p-4">
                  {selectedItem.isAvailable ? (
                    <a
                      href={getWhatsAppUrl(restaurant, selectedItem)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--menu-accent)] px-4 py-3 text-sm font-black text-white hover:scale-[1.02] active:scale-95 transition cursor-pointer"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Order on WhatsApp
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-stone-200 dark:bg-stone-800 px-4 py-3 text-sm font-black text-stone-400 dark:text-stone-600 cursor-not-allowed"
                    >
                      Out of Stock
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PublicMenuPage() {
  return (
    <Suspense fallback={<MenuSkeleton />}>
      <PublicMenuContent />
    </Suspense>
  );
}
