"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Drumstick,
  Egg,
  Flame,
  Leaf,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShoppingBag,
  Utensils,
  X
} from "lucide-react";
import {
  getActiveThemeForRestaurant,
  getMenuCategoriesSubcollection,
  getMenuItemsSubcollection,
  getPublishedMenuForRestaurant,
  getRestaurantBySlug,
  Menu,
  MenuCategory,
  MenuItem,
  MenuTheme,
  Restaurant
} from "@/lib/firebase/db";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { hasTrustedStructuredItems } from "@/lib/menu-trust";

type FilterKey = "all" | "veg" | "non-veg" | "egg" | "vegan" | "spicy" | "popular" | "available";
type CustomerMenuItem = MenuItem & { categoryId: string; categoryName: string };
type CustomerCategory = Omit<MenuCategory, "items"> & { items: CustomerMenuItem[] };

const ITEMS_PER_PAGE = 60;

const DEFAULT_THEME: MenuTheme = {
  theme: "classic",
  primaryColor: "#4a2c1e",
  accentColor: "#c58a4b",
  secondaryColor: "#6b4f3f",
  backgroundColor: "#f6ead8",
  textColor: "#2c1810",
  fontFamily: "Poppins",
  cardStyle: "elevated",
  layoutStyle: "menu-book",
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

const VALID_TYPES = new Set<MenuItem["type"]>(["veg", "non-veg", "egg", "vegan", "unknown"]);

function isColorDark(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return false;
  const expanded = hex.length === 3 ? hex.split("").map(char => char + char).join("") : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

function isNearWhite(color: string) {
  const hex = color.replace("#", "");
  if (hex.length !== 3 && hex.length !== 6) return false;
  const expanded = hex.length === 3 ? hex.split("").map(char => char + char).join("") : hex;
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return r > 246 && g > 246 && b > 246;
}

function mergeTheme(theme?: Partial<MenuTheme>) {
  return {
    ...DEFAULT_THEME,
    ...theme,
    primaryColor: theme?.primaryColor || DEFAULT_THEME.primaryColor,
    accentColor: theme?.accentColor || theme?.secondaryColor || DEFAULT_THEME.accentColor,
    secondaryColor: theme?.secondaryColor || DEFAULT_THEME.secondaryColor,
    backgroundColor: theme?.backgroundColor || DEFAULT_THEME.backgroundColor,
    textColor: theme?.textColor || DEFAULT_THEME.textColor,
    fontFamily: theme?.fontFamily || DEFAULT_THEME.fontFamily
  };
}

function sortBySortOrder<T extends { sortOrder?: number }>(items: T[]) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (a.item.sortOrder ?? a.index) - (b.item.sortOrder ?? b.index))
    .map(({ item }) => item);
}

function resolveItemType(item: Partial<MenuItem> & { isVeg?: boolean }): MenuItem["type"] {
  const explicitType = item.type || item.dietaryTag || "unknown";
  if (VALID_TYPES.has(explicitType as MenuItem["type"])) {
    return explicitType as MenuItem["type"];
  }

  if (item.isVeg === true) return "veg";
  return "unknown";
}

function normalizeLegacyPublishedItemName(name: string) {
  return name
    .replace(/\bmachiatto\b/i, "machiato")
    .replace(/^croissant\s+-\s+/i, "croissants - ");
}

function normalizeItem(item: Partial<MenuItem> & { isVeg?: boolean }, category: Pick<MenuCategory, "id" | "name">, index = 0): CustomerMenuItem {
  const itemId = item.id || `item_${category.id}_${index}`;
  return {
    id: itemId,
    name: normalizeLegacyPublishedItemName(item.name || "Untitled item"),
    description: item.description || "",
    price: Number(item.price) || 0,
    priceLabel: item.priceLabel || "",
    priceOptions: item.priceOptions || [],
    variants: item.variants || [],
    confidence: item.confidence || "high",
    subcategory: item.subcategory || null,
    dietaryTag: item.dietaryTag ?? null,
    specialTag: item.specialTag || null,
    image: item.image || "",
    imageUrl: item.imageUrl || item.image || "",
    allergens: item.allergens || [],
    tags: item.tags || [],
    isAvailable: item.isAvailable !== false,
    isActive: item.isActive !== false,
    isFeatured: item.isFeatured || false,
    isPopular: item.isPopular || false,
    type: resolveItemType(item),
    spiceLevel: item.spiceLevel ?? null,
    sortOrder: item.sortOrder ?? index,
    categoryId: category.id,
    categoryName: category.name
  };
}

function normalizeCategories(menu: Menu | null): CustomerCategory[] {
  if (!menu?.categories) return [];

  return sortBySortOrder(menu.categories.filter(category => category.isActive !== false))
    .map((category, categoryIndex) => {
      const categoryId = category.id || `category_${categoryIndex}`;
      const categoryName = category.name || "Menu";
      const items = sortBySortOrder((category.items || []).filter(item => item.isActive !== false))
        .map((item, itemIndex) => normalizeItem(item, { id: categoryId, name: categoryName }, itemIndex));

      return {
        ...category,
        id: categoryId,
        name: categoryName,
        sortOrder: category.sortOrder ?? categoryIndex,
        items
      };
    })
    .filter(category => category.items.length > 0);
}

function normalizeSubcollectionCategories(categoriesSnapshot: any[], itemsSnapshot: any[]): CustomerCategory[] {
  const sortedCats = sortBySortOrder(
    categoriesSnapshot
      .filter(category => category.isActive !== false)
      .map((category, index) => ({
        id: category.id || `category_${index}`,
        name: category.name || "Menu",
        description: category.description || "",
        isActive: category.isActive !== false,
        sortOrder: category.sortOrder ?? index
      }))
  );

  const sortedItems = sortBySortOrder(itemsSnapshot.filter(item => item.isActive !== false));

  return sortedCats
    .map(category => ({
      ...category,
      items: sortedItems
        .filter(item => item.categoryId === category.id)
        .map((item, itemIndex) => normalizeItem(item, category, itemIndex))
    }))
    .filter(category => category.items.length > 0);
}

function getCurrencyCode(currency?: string) {
  const value = (currency || "INR").trim();
  const symbolMap: Record<string, string> = {
    "₹": "INR",
    "$": "USD",
    "€": "EUR",
    "£": "GBP"
  };

  if (symbolMap[value]) return symbolMap[value];
  if (/^[A-Z]{3}$/.test(value)) return value;
  return value;
}

function formatPrice(price: number, currency?: string) {
  const normalizedCurrency = getCurrencyCode(currency);

  if (/^[A-Z]{3}$/.test(normalizedCurrency)) {
    try {
      return new Intl.NumberFormat(normalizedCurrency === "INR" ? "en-IN" : undefined, {
        style: "currency",
        currency: normalizedCurrency,
        currencyDisplay: "narrowSymbol",
        maximumFractionDigits: Number.isInteger(price) ? 0 : 2
      }).format(price);
    } catch {
      return `${normalizedCurrency} ${price.toLocaleString()}`;
    }
  }

  return `${normalizedCurrency}${price.toLocaleString(undefined, {
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2
  })}`;
}

function getItemPriceAmounts(item: MenuItem) {
  if (item.priceLabel) return [];
  const optionAmounts = (item.priceOptions || [])
    .map(option => option.amount)
    .filter((amount): amount is number => amount !== null && amount !== undefined && Number(amount) > 0)
    .map(Number);

  if (optionAmounts.length > 0) return optionAmounts;
  return Number(item.price) > 0 ? [Number(item.price)] : [];
}

function formatItemPrice(item: MenuItem, currency?: string) {
  if (item.priceLabel) return item.priceLabel;

  const options = item.priceOptions || [];
  const pricedOptions = options
    .filter(option => option.amount !== null && option.amount !== undefined && Number(option.amount) > 0);

  if (pricedOptions.length > 0) {
    return pricedOptions
      .map(option => {
        const amount = formatPrice(Number(option.amount), currency);
        return option.size ? `${option.size} ${amount}` : amount;
      })
      .join(" / ");
  }

  const labelOptions = options
    .filter(option => (option.amount === null || option.amount === undefined) && option.size)
    .map(option => option.size);

  if (labelOptions.length > 0) return labelOptions.join(" / ");

  if (Number(item.price) > 0) return formatPrice(Number(item.price), currency);
  return "Price unavailable";
}

function formatPriceRange(items: MenuItem[], currency?: string) {
  const prices = items.flatMap(getItemPriceAmounts);
  if (prices.length === 0) return "Prices unavailable";

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return formatPrice(min, currency);
  return `${formatPrice(min, currency)} - ${formatPrice(max, currency)}`;
}

function getItemImage(item: MenuItem) {
  return item.imageUrl || item.image || "";
}

function isPopularItem(item: MenuItem) {
  return Boolean(
    item.isPopular ||
      item.isFeatured ||
      item.tags?.some(tag => /popular|best|seller|favorite|favourite|chef/i.test(tag))
  );
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
  if (typeof restaurant.isOpen === "boolean") return restaurant.isOpen ? "Open now" : "Closed";
  if (restaurant.openStatus === "open") return "Open now";
  if (restaurant.openStatus === "closed") return "Closed";
  return "Live menu";
}

function isSourceImage(menu: Menu | null) {
  if (!menu?.sourceFileUrl) return false;
  if (menu.sourceFileType?.startsWith("image/")) return true;
  return /\.(png|jpe?g|webp|gif|avif)$/i.test(menu.sourceFileName || menu.sourceFileUrl.split("?")[0]);
}

function MenuSkeleton() {
  return (
    <div className="min-h-screen bg-[#f6ead8] text-[#2c1810]">
      <div className="mx-auto max-w-6xl px-5 py-6">
        <div className="h-20 rounded-lg bg-white/70 shadow-sm animate-pulse" />
        <div className="mt-14 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-5">
            <div className="h-4 w-36 rounded-full bg-white/70 animate-pulse" />
            <div className="h-24 max-w-xl rounded-lg bg-white/60 animate-pulse" />
            <div className="h-11 w-72 rounded-full bg-white/70 animate-pulse" />
          </div>
          <div className="h-56 rounded-lg bg-white/80 animate-pulse" />
        </div>
        <div className="mt-16 h-64 rounded-lg bg-white/70 animate-pulse" />
        <div className="mt-8 space-y-5">
          {[1, 2, 3].map(item => (
            <div key={item} className="h-52 rounded-lg bg-white/80 animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
}

function PublicMenuContent() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const table = searchParams.get("table") || "";
  const reduceMotion = useReducedMotion();

  const slug = Array.isArray(params.slug) ? params.slug[0] : params.slug;

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
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<CustomerMenuItem | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPublicMenu() {
      if (!slug) return;

      setLoading(true);
      setError("");
      setErrorType("");
      setCategories([]);
      setMenu(null);

      try {
        if (isFirebaseConfigured()) {
          const response = await fetch(`/api/public-menu?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
          const payload = await response.json().catch(() => ({}));

          if (response.status === 404) {
            if (!cancelled) {
              setRestaurant(null);
              setErrorType("not-found");
            }
            return;
          }

          if (response.status === 409) {
            if (!cancelled) {
              if (payload.restaurant) setRestaurant(payload.restaurant);
              setErrorType("not-published");
            }
            return;
          }

          if (!response.ok) {
            throw new Error(payload.error || "Unable to load this menu right now.");
          }

          const restData = payload.data?.restaurant as Restaurant | null;
          const publishedMenu = payload.data?.menu as Menu | null;
          if (!restData || !publishedMenu) {
            if (!cancelled) setErrorType("not-found");
            return;
          }

          if (cancelled) return;

          let finalCategories: CustomerCategory[] = [];
          if (hasTrustedStructuredItems(publishedMenu)) {
            const categoriesSnapshot = payload.data?.categoriesSnapshot || [];
            const itemsSnapshot = payload.data?.itemsSnapshot || [];
            finalCategories =
              categoriesSnapshot.length > 0 && itemsSnapshot.length > 0
                ? normalizeSubcollectionCategories(categoriesSnapshot, itemsSnapshot)
                : normalizeCategories(publishedMenu);

            if (!hasTrustedStructuredItems({ ...publishedMenu, categories: finalCategories })) {
              finalCategories = [];
            }
          }

          setRestaurant(restData);
          setMenu(publishedMenu);
          setActiveTheme(payload.data?.theme || null);
          setCategories(finalCategories);
          setSelectedCatId("");
          setCurrentPage(1);
          return;
        }

        const restData = await getRestaurantBySlug(slug);
        if (!restData) {
          if (!cancelled) {
            setRestaurant(null);
            setErrorType("not-found");
          }
          return;
        }

        if (cancelled) return;
        setRestaurant(restData);

        if (restData.status !== "published" || !restData.currentPublishedMenuId) {
          if (!cancelled) setErrorType("not-published");
          return;
        }

        const publishedMenu = await getPublishedMenuForRestaurant(restData);
        if (!publishedMenu || publishedMenu.status !== "published" || publishedMenu.id !== restData.currentPublishedMenuId) {
          if (!cancelled) setErrorType("not-published");
          return;
        }

        const [categoriesSnapshot, itemsSnapshot, themeData] = await Promise.all([
          getMenuCategoriesSubcollection(restData.id!, publishedMenu.id!),
          getMenuItemsSubcollection(restData.id!, publishedMenu.id!),
          getActiveThemeForRestaurant(restData.id!)
        ]);

        if (cancelled) return;

        let finalCategories: CustomerCategory[] = [];
        if (hasTrustedStructuredItems(publishedMenu)) {
          finalCategories =
            categoriesSnapshot.length > 0 && itemsSnapshot.length > 0
              ? normalizeSubcollectionCategories(categoriesSnapshot, itemsSnapshot)
              : normalizeCategories(publishedMenu);

          if (!hasTrustedStructuredItems({ ...publishedMenu, categories: finalCategories })) {
            finalCategories = [];
          }
        }

        setMenu(publishedMenu);
        setActiveTheme(themeData);
        setCategories(finalCategories);
        setSelectedCatId("");
        setCurrentPage(1);
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

  const theme = useMemo(() => mergeTheme(activeTheme || menu?.theme), [activeTheme, menu?.theme]);
  const canvasColor = isNearWhite(theme.backgroundColor) ? DEFAULT_THEME.backgroundColor : theme.backgroundColor;
  const isDark = isColorDark(canvasColor);

  useEffect(() => {
    const fonts = [
      { id: "menu-font-poppins", href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" },
      { id: "menu-font-playfair", href: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&display=swap" }
    ];

    fonts.forEach(font => {
      if (document.getElementById(font.id)) return;
      const link = document.createElement("link");
      link.id = font.id;
      link.rel = "stylesheet";
      link.href = font.href;
      document.head.appendChild(link);
    });
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeFilter, searchQuery, selectedCatId]);

  const allItems = useMemo(() => categories.flatMap(category => category.items), [categories]);

  const visibleFilters = useMemo(() => {
    const hasUnavailableItems = allItems.some(item => !item.isAvailable);

    return FILTERS.filter(filter => {
      if (filter.key === "all") return true;
      if (filter.key === "veg") return allItems.some(item => item.type === "veg" || item.type === "vegan");
      if (filter.key === "non-veg") return allItems.some(item => item.type === "non-veg");
      if (filter.key === "egg") return allItems.some(item => item.type === "egg");
      if (filter.key === "vegan") return allItems.some(item => item.type === "vegan");
      if (filter.key === "spicy") return allItems.some(item => Number(item.spiceLevel) > 0);
      if (filter.key === "popular") return allItems.some(isPopularItem);
      if (filter.key === "available") return hasUnavailableItems && allItems.some(item => item.isAvailable);
      return false;
    });
  }, [allItems]);

  useEffect(() => {
    if (!visibleFilters.some(filter => filter.key === activeFilter)) {
      setActiveFilter("all");
    }
  }, [activeFilter, visibleFilters]);

  const filteredCategories = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return categories
      .filter(category => !selectedCatId || category.id === selectedCatId)
      .map(category => {
        const categoryMatches = category.name.toLowerCase().includes(query);
        const items = category.items.filter(item => {
          const priceText = restaurant ? formatItemPrice(item, restaurant.currency).toLowerCase() : "";
          const searchMatches =
            !query ||
            categoryMatches ||
            item.name.toLowerCase().includes(query) ||
            item.description.toLowerCase().includes(query) ||
            priceText.includes(query) ||
            item.tags.some(tag => tag.toLowerCase().includes(query)) ||
            item.allergens.some(allergen => allergen.toLowerCase().includes(query));

          if (!searchMatches) return false;
          if (activeFilter === "veg") return item.type === "veg" || item.type === "vegan";
          if (activeFilter === "non-veg") return item.type === "non-veg";
          if (activeFilter === "egg") return item.type === "egg";
          if (activeFilter === "vegan") return item.type === "vegan";
          if (activeFilter === "spicy") return Number(item.spiceLevel) > 0;
          if (activeFilter === "popular") return isPopularItem(item);
          if (activeFilter === "available") return item.isAvailable;
          return true;
        });

        return items.length > 0 ? { ...category, items } : null;
      })
      .filter(Boolean) as CustomerCategory[];
  }, [activeFilter, categories, restaurant, searchQuery, selectedCatId]);

  const filteredItems = useMemo(() => filteredCategories.flatMap(category => category.items), [filteredCategories]);
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const pageItems = useMemo(() => {
    const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredItems, safePage]);

  const pageCategories = useMemo(() => {
    const itemIdsOnPage = new Set(pageItems.map(item => item.id));
    return filteredCategories
      .map(category => ({
        ...category,
        items: category.items.filter(item => itemIdsOnPage.has(item.id))
      }))
      .filter(category => category.items.length > 0);
  }, [filteredCategories, pageItems]);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const pages = new Set([1, totalPages, safePage, safePage - 1, safePage + 1]);
    if (safePage <= 3) {
      pages.add(2);
      pages.add(3);
      pages.add(4);
    }
    if (safePage >= totalPages - 2) {
      pages.add(totalPages - 1);
      pages.add(totalPages - 2);
      pages.add(totalPages - 3);
    }

    return Array.from(pages)
      .filter(page => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
  }, [safePage, totalPages]);

  const pageStyle = {
    "--menu-bg": canvasColor,
    "--menu-text": theme.textColor,
    "--menu-primary": theme.primaryColor,
    "--menu-accent": theme.accentColor || theme.secondaryColor,
    "--menu-secondary": theme.secondaryColor,
    "--menu-card": isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.82)",
    "--menu-soft": isDark ? "rgba(255,255,255,0.10)" : "rgba(74,44,30,0.08)",
    "--menu-muted": isDark ? "#e7dfd6" : "#6b5b50",
    "--menu-border": isDark ? "rgba(255,255,255,0.14)" : "rgba(74,44,30,0.12)",
    backgroundColor: canvasColor,
    color: theme.textColor,
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, sans-serif"
  } as React.CSSProperties;

  const headingStyle = {
    fontFamily: "\"Playfair Display\", Georgia, serif",
    letterSpacing: "0"
  } as React.CSSProperties;

  const contactUrl = restaurant ? getWhatsAppUrl(restaurant) : "";
  const serviceLabel = restaurant ? getServiceLabel(restaurant) : "Live menu";
  const sourceAvailable = Boolean(menu?.sourceFileUrl);
  const sourceIsImage = isSourceImage(menu);
  const shownStart = filteredItems.length === 0 ? 0 : (safePage - 1) * ITEMS_PER_PAGE + 1;
  const shownEnd = Math.min(safePage * ITEMS_PER_PAGE, filteredItems.length);

  if (loading) return <MenuSkeleton />;

  if (errorType === "not-found" || !restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2c1810] px-6 py-16 text-center text-white">
        <div className="max-w-md space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-[#f2c078]">
            <ChefHat className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Menu Not Found</h1>
            <p className="text-sm leading-relaxed text-white/70">
              We could not locate this restaurant. Please check the link or scan the QR code again.
            </p>
          </div>
          <Link href="/" className="inline-flex items-center rounded-full bg-[#f2c078] px-6 py-2.5 text-xs font-bold text-[#2c1810] transition hover:bg-[#ffd79a]">
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  if (errorType === "not-published") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2c1810] px-6 py-16 text-center text-white">
        <div className="max-w-md space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white/70">
            <Clock3 className="h-8 w-8" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight">Menu is not available yet</h1>
            <p className="text-sm leading-relaxed text-white/70">
              The menu for <strong className="text-white">{restaurant.name}</strong> has not been published.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#2c1810] px-6 py-16 text-center text-white">
        <div className="max-w-md space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg border border-rose-400/25 bg-rose-500/10 text-rose-300">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Error Loading Menu</h1>
            <p className="mt-2 text-sm leading-6 text-white/70">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const renderDietIcon = (item: MenuItem) => {
    if (item.type === "veg" || item.type === "vegan" || item.dietaryTag === "veg" || item.dietaryTag === "vegan") {
      return <Leaf className="h-4 w-4 text-emerald-700" aria-label={item.type === "vegan" ? "Vegan" : "Vegetarian"} />;
    }
    if (item.type === "egg" || item.dietaryTag === "egg") return <Egg className="h-4 w-4 text-amber-700" aria-label="Contains egg" />;
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

  const renderItemRow = (item: CustomerMenuItem) => {
    const image = getItemImage(item);
    const tags = item.tags || [];
    const variants = item.variants || [];

    return (
      <li key={item.id} className="group">
        <button
          type="button"
          onClick={() => setSelectedItem(item)}
          className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-2.5 text-left transition hover:text-[var(--menu-primary)] cursor-pointer"
        >
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--menu-soft)] text-[var(--menu-primary)]">
            {image ? (
              <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <Utensils className="h-4 w-4" />
            )}
          </span>

          <span className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <span className="min-w-0 break-words text-sm font-semibold leading-tight sm:text-[15px]">{item.name}</span>
              {renderDietIcon(item)}
              {renderSpice(item)}
              {!item.isAvailable && (
                <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-stone-600">
                  Unavailable
                </span>
              )}
            </span>
            {(item.description || tags.length > 0 || variants.length > 0) && (
              <span className="mt-1 block text-xs leading-relaxed text-[var(--menu-muted)]">
                {item.description || tags.slice(0, 2).join(" / ") || variants.slice(0, 2).join(" / ")}
              </span>
            )}
          </span>

          <span className="flex min-w-[96px] items-baseline justify-end gap-3 pt-0.5">
            <span className="hidden h-px min-w-8 flex-1 border-t border-dashed border-[var(--menu-border)] sm:block" />
            <span className="text-right text-sm font-black text-[var(--menu-secondary)] sm:text-[15px]">
              {formatItemPrice(item, restaurant.currency)}
            </span>
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="min-h-screen overflow-x-hidden pb-20 transition-colors duration-300" style={pageStyle}>
      <div className="pointer-events-none fixed inset-0 opacity-70" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(255,255,255,0.55),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.28),transparent_42%)]" />
      </div>

      <header className="fixed left-0 right-0 top-0 z-50 px-4 py-3 sm:py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 rounded-lg border border-[var(--menu-border)] bg-white/[0.78] px-3 py-2 shadow-[0_18px_60px_rgba(44,24,16,0.12)] backdrop-blur-xl sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-[var(--menu-primary)] shadow-sm">
              {restaurant.logoUrl ? (
                <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full object-cover" />
              ) : (
                <ChefHat className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black sm:text-base" style={headingStyle}>
                {restaurant.name}
              </p>
              <p className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--menu-muted)]">
                {restaurant.cuisine || "Live Menu"}
              </p>
            </div>
          </div>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Customer menu sections">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--menu-soft)] cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("browse-menu")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-full bg-[var(--menu-primary)] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90 cursor-pointer"
            >
              Menu
            </button>
            {(restaurant.phone || restaurant.whatsapp) && (
              <button
                type="button"
                onClick={() => document.getElementById("contact")?.scrollIntoView({ behavior: "smooth" })}
                className="rounded-full px-4 py-2 text-xs font-semibold transition hover:bg-[var(--menu-soft)] cursor-pointer"
              >
                Contact
              </button>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--menu-muted)] lg:inline">
              {serviceLabel}
            </span>
            {restaurant.phone ? (
              <a
                href={`tel:${restaurant.phone}`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--menu-primary)] px-4 text-xs font-bold text-white shadow-lg transition hover:opacity-90"
              >
                <Phone className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Call</span>
              </a>
            ) : (
              <button
                type="button"
                onClick={() => document.getElementById("browse-menu")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex h-10 items-center justify-center rounded-full bg-[var(--menu-primary)] px-4 text-xs font-bold text-white shadow-lg transition hover:opacity-90 cursor-pointer"
              >
                Menu
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl gap-8 px-5 pb-12 pt-32 sm:pt-36 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:pb-16">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="h-px w-8 bg-[var(--menu-accent)]" />
              <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--menu-accent)]">
                Premium Menu
              </span>
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[0.98] sm:text-5xl lg:text-6xl" style={headingStyle}>
              {restaurant.name} live menu
            </h1>
            <p className="mt-5 max-w-xl text-sm font-medium leading-7 text-[var(--menu-muted)] sm:text-base">
              {restaurant.cuisine || "Freshly published restaurant menu"}
              {table ? ` / Table ${table}` : ""}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => document.getElementById("browse-menu")?.scrollIntoView({ behavior: "smooth" })}
                className="inline-flex h-12 items-center justify-center rounded-full bg-[var(--menu-primary)] px-6 text-sm font-bold text-white shadow-[0_14px_30px_rgba(44,24,16,0.18)] transition hover:opacity-90 cursor-pointer"
              >
                Browse Menu
              </button>
              {restaurant.whatsapp && contactUrl ? (
                <a
                  href={contactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--menu-border)] bg-white/[0.58] px-6 text-sm font-bold transition hover:bg-white/80"
                >
                  <MessageCircle className="h-4 w-4" />
                  Order
                </a>
              ) : restaurant.phone ? (
                <a
                  href={`tel:${restaurant.phone}`}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-[var(--menu-border)] bg-white/[0.58] px-6 text-sm font-bold transition hover:bg-white/80"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              ) : null}
            </div>
          </div>

          <aside className="rounded-lg border border-[var(--menu-border)] bg-white/[0.74] p-4 shadow-[0_20px_70px_rgba(44,24,16,0.12)] backdrop-blur">
            <div className="divide-y divide-[var(--menu-border)]">
              <div className="py-4 first:pt-1">
                <strong className="block text-2xl font-black">{allItems.length}</strong>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--menu-muted)]">
                  Menu Items
                </span>
              </div>
              <div className="py-4">
                <strong className="block text-2xl font-black">{categories.length}</strong>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--menu-muted)]">
                  Categories
                </span>
              </div>
              <div className="py-4 last:pb-1">
                <strong className="block text-lg font-black">{serviceLabel}</strong>
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--menu-muted)]">
                  Current Status
                </span>
              </div>
            </div>
          </aside>
        </section>

        <section id="browse-menu" className="border-y border-[var(--menu-border)] bg-white/[0.12] py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-5">
            <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <div className="mb-4 flex items-center gap-3">
                  <span className="h-px w-8 bg-[var(--menu-accent)]" />
                  <span className="text-[10px] font-black uppercase tracking-[0.28em] text-[var(--menu-accent)]">
                    Browse Menu
                  </span>
                </div>
                <h2 className="text-2xl font-black leading-tight sm:text-3xl" style={headingStyle}>
                  Categories
                </h2>
              </div>

              <div className="relative">
                <Search className="absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--menu-muted)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search item, category, or price"
                  className="h-[52px] w-full rounded-full border border-[var(--menu-border)] bg-white/[0.84] pl-12 pr-5 text-sm font-semibold text-[var(--menu-text)] shadow-sm outline-none transition placeholder:text-[var(--menu-muted)] focus:border-[var(--menu-primary)] focus:ring-4 focus:ring-[var(--menu-primary)]/10"
                />
              </div>
            </div>

            {categories.length > 0 && (
              <div className="mt-6 rounded-lg border border-[var(--menu-border)] bg-white/[0.66] p-4 shadow-sm backdrop-blur">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[var(--menu-muted)]">
                    Categories
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--menu-muted)]">
                    {categories.length} Sections
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  <button
                    type="button"
                    onClick={() => setSelectedCatId("")}
                    aria-pressed={!selectedCatId}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left text-xs font-black transition cursor-pointer"
                    style={{
                      backgroundColor: !selectedCatId ? theme.primaryColor : "rgba(255,255,255,0.82)",
                      borderColor: !selectedCatId ? theme.primaryColor : "var(--menu-border)",
                      color: !selectedCatId ? "#ffffff" : theme.textColor
                    }}
                  >
                    <span className="truncate">All</span>
                    <small className="rounded-full bg-black/[0.08] px-2 py-0.5 text-[10px] font-black opacity-75">{allItems.length}</small>
                  </button>

                  {categories.map(category => {
                    const active = selectedCatId === category.id;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setSelectedCatId(active ? "" : category.id)}
                        aria-pressed={active}
                        className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 text-left text-xs font-black transition cursor-pointer"
                        style={{
                          backgroundColor: active ? theme.primaryColor : "rgba(255,255,255,0.82)",
                          borderColor: active ? theme.primaryColor : "var(--menu-border)",
                          color: active ? "#ffffff" : theme.textColor
                        }}
                      >
                        <span className="truncate">{category.name}</span>
                        <small className="rounded-full bg-black/[0.08] px-2 py-0.5 text-[10px] font-black opacity-75">
                          {category.items.length}
                        </small>
                      </button>
                    );
                  })}
                </div>

                {visibleFilters.length > 1 && (
                  <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                    {visibleFilters.map(filter => {
                      const active = activeFilter === filter.key;
                      return (
                        <button
                          key={filter.key}
                          type="button"
                          onClick={() => setActiveFilter(filter.key)}
                          aria-pressed={active}
                          className="shrink-0 rounded-full border px-4 py-2 text-[11px] font-black transition cursor-pointer"
                          style={{
                            backgroundColor: active ? theme.secondaryColor : "rgba(255,255,255,0.72)",
                            borderColor: active ? theme.secondaryColor : "var(--menu-border)",
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
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
          {categories.length === 0 ? (
            <div className="mx-auto max-w-3xl rounded-lg border border-[var(--menu-border)] bg-white/[0.78] p-5 text-center shadow-sm">
              {sourceAvailable ? (
                <div>
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-[var(--menu-soft)] text-[var(--menu-primary)]">
                    <ChefHat className="h-6 w-6" />
                  </div>
                  <h2 className="text-2xl font-black" style={headingStyle}>
                    Posted Menu
                  </h2>
                  <p className="mt-2 text-sm font-medium text-[var(--menu-muted)]">
                    {menu?.sourceFileName || restaurant.name}
                  </p>
                  <div className="mt-5 overflow-hidden rounded-lg border border-[var(--menu-border)] bg-white">
                    {sourceIsImage ? (
                      <img src={menu!.sourceFileUrl} alt={`${restaurant.name} posted menu`} className="mx-auto max-h-[80vh] w-full object-contain" />
                    ) : (
                      <a
                        href={menu!.sourceFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex min-h-40 items-center justify-center p-6 text-sm font-black text-[var(--menu-primary)]"
                      >
                        Open Posted Menu
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <ChefHat className="mx-auto h-12 w-12 text-[var(--menu-primary)]" />
                  <h2 className="mt-4 text-2xl font-black" style={headingStyle}>
                    No menu items published
                  </h2>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[var(--menu-muted)]">
                    This restaurant has published a menu shell, but no customer-visible items are available yet.
                  </p>
                </div>
              )}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mx-auto max-w-md rounded-lg border border-[var(--menu-border)] bg-white/[0.78] p-10 text-center shadow-sm">
              <Search className="mx-auto h-10 w-10 text-[var(--menu-primary)]" />
              <h2 className="mt-4 text-xl font-black" style={headingStyle}>
                No matching items
              </h2>
              <p className="mx-auto mt-2 text-sm leading-relaxed text-[var(--menu-muted)]">
                Try another category or search term.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-5 flex flex-col gap-2 rounded-lg border border-[var(--menu-border)] bg-white/[0.68] px-4 py-3 text-sm text-[var(--menu-muted)] shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Showing {shownStart}-{shownEnd} of {filteredItems.length} items
                </span>
                <strong className="font-black text-[var(--menu-secondary)]">
                  Page {safePage} of {totalPages}
                </strong>
              </div>

              <div className="space-y-5">
                {pageCategories.map(category => (
                  <motion.article
                    key={category.id}
                    id={category.id}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                    animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                    className="rounded-lg border border-[var(--menu-border)] bg-white/[0.84] p-4 shadow-[0_14px_48px_rgba(44,24,16,0.08)] backdrop-blur sm:p-5"
                  >
                    <header className="flex flex-col gap-4 border-b border-[var(--menu-border)] pb-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--menu-soft)] text-[var(--menu-primary)]">
                          <Utensils className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate text-xl font-black" style={headingStyle}>
                            {category.name}
                          </h3>
                          {category.description && (
                            <p className="mt-1 text-xs leading-relaxed text-[var(--menu-muted)]">{category.description}</p>
                          )}
                        </div>
                      </div>

                      <div className="shrink-0 text-left sm:text-right">
                        <span className="block text-xs font-semibold text-[var(--menu-muted)]">
                          {category.items.length} on this page
                        </span>
                        <strong className="mt-1 block text-sm font-black text-[var(--menu-secondary)]">
                          {formatPriceRange(category.items, restaurant.currency)}
                        </strong>
                      </div>
                    </header>

                    <ul className="divide-y divide-[var(--menu-border)] pt-2">
                      {category.items.map(renderItemRow)}
                    </ul>
                  </motion.article>
                ))}
              </div>

              {totalPages > 1 && (
                <nav className="mt-7 flex flex-wrap items-center justify-center gap-2 rounded-lg border border-[var(--menu-border)] bg-white/[0.72] px-3 py-4 shadow-sm" aria-label="Menu pagination">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--menu-border)] bg-white px-4 text-xs font-black transition enabled:hover:bg-[var(--menu-soft)] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Previous
                  </button>

                  {pageNumbers.map((pageNumber, index) => {
                    const previous = pageNumbers[index - 1];
                    const showGap = previous && pageNumber - previous > 1;

                    return (
                      <React.Fragment key={pageNumber}>
                        {showGap && <span className="px-1 text-xs font-black text-[var(--menu-muted)]">...</span>}
                        <button
                          type="button"
                          onClick={() => setCurrentPage(pageNumber)}
                          aria-current={safePage === pageNumber ? "page" : undefined}
                          className="flex h-10 w-10 items-center justify-center rounded-full border text-xs font-black transition cursor-pointer"
                          style={{
                            backgroundColor: safePage === pageNumber ? theme.primaryColor : "rgba(255,255,255,0.82)",
                            borderColor: safePage === pageNumber ? theme.primaryColor : "var(--menu-border)",
                            color: safePage === pageNumber ? "#ffffff" : theme.textColor
                          }}
                        >
                          {pageNumber}
                        </button>
                      </React.Fragment>
                    );
                  })}

                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                    className="inline-flex h-10 items-center gap-1 rounded-full border border-[var(--menu-border)] bg-white px-4 text-xs font-black transition enabled:hover:bg-[var(--menu-soft)] disabled:cursor-not-allowed disabled:opacity-45 cursor-pointer"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </nav>
              )}

              {sourceAvailable && (
                <section className="mt-8 rounded-lg border border-[var(--menu-border)] bg-white/[0.72] p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-xl font-black" style={headingStyle}>
                        Posted Menu
                      </h2>
                      <p className="mt-1 text-xs font-semibold text-[var(--menu-muted)]">
                        {menu?.sourceFileName || restaurant.name}
                      </p>
                    </div>
                    <a
                      href={menu!.sourceFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--menu-border)] bg-white px-4 text-xs font-black transition hover:bg-[var(--menu-soft)]"
                    >
                      Open Original
                    </a>
                  </div>
                  {sourceIsImage && (
                    <div className="mt-4 overflow-hidden rounded-lg border border-[var(--menu-border)] bg-white">
                      <img src={menu!.sourceFileUrl} alt={`${restaurant.name} posted menu`} className="mx-auto max-h-[70vh] w-full object-contain" loading="lazy" />
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </section>
      </main>

      <footer id="contact" className="relative z-10 bg-[#2c1810] px-5 py-12 text-white sm:py-16">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.08] px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-[#f2c078]">
            <Clock3 className="h-3.5 w-3.5" />
            {serviceLabel}
          </div>

          <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
            <section className="rounded-lg border border-white/[0.12] bg-white/[0.08] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-[#2c1810]">
                  {restaurant.logoUrl ? (
                    <img src={restaurant.logoUrl} alt={`${restaurant.name} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <ChefHat className="h-6 w-6" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black" style={headingStyle}>
                    {restaurant.name}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">
                    {restaurant.cuisine || "Restaurant"}
                  </p>
                </div>
              </div>
              {restaurant.address && (
                <p className="mt-5 max-w-md text-sm leading-7 text-white/70">{restaurant.address}</p>
              )}
              <div className="mt-5 flex flex-wrap gap-2">
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="rounded-full bg-[#f2c078] px-5 py-2 text-xs font-black text-[#2c1810]">
                    Call
                  </a>
                )}
                {restaurant.whatsapp && contactUrl && (
                  <a href={contactUrl} target="_blank" rel="noreferrer" className="rounded-full border border-white/[0.16] px-5 py-2 text-xs font-black text-white">
                    WhatsApp
                  </a>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/[0.12] bg-white/[0.08] p-5">
              <h3 className="text-base font-black" style={headingStyle}>
                Visit
              </h3>
              <div className="mt-4 space-y-4 text-sm text-white/70">
                <div>
                  <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#f2c078]">Status</span>
                  <strong className="mt-1 block text-white">{serviceLabel}</strong>
                </div>
                {restaurant.address && (
                  <div>
                    <span className="block text-[10px] font-black uppercase tracking-[0.18em] text-[#f2c078]">Address</span>
                    <p className="mt-1 leading-6">{restaurant.address}</p>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-white/[0.12] bg-white/[0.08] p-5">
              <h3 className="text-base font-black" style={headingStyle}>
                Connect
              </h3>
              <div className="mt-4 space-y-3">
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 rounded-lg border border-white/[0.12] bg-white/[0.08] p-3 text-sm font-bold text-white">
                    <Phone className="h-4 w-4 text-[#f2c078]" />
                    {restaurant.phone}
                  </a>
                )}
                {restaurant.whatsapp && contactUrl && (
                  <a href={contactUrl} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-lg border border-white/[0.12] bg-white/[0.08] p-3 text-sm font-bold text-white">
                    <MessageCircle className="h-4 w-4 text-[#f2c078]" />
                    WhatsApp
                  </a>
                )}
                {restaurant.address && (
                  <div className="flex items-start gap-3 rounded-lg border border-white/[0.12] bg-white/[0.08] p-3 text-sm font-bold text-white">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#f2c078]" />
                    <span className="leading-6">{restaurant.address}</span>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </footer>

      {(restaurant.whatsapp || restaurant.phone) && (
        <div className="fixed bottom-4 right-4 z-40 flex flex-row gap-3 sm:bottom-5 sm:right-5 sm:flex-col">
          {restaurant.phone && (
            <a
              href={`tel:${restaurant.phone}`}
              aria-label="Call restaurant"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2c1810] text-white shadow-xl transition hover:scale-105 active:scale-95"
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
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--menu-primary)] text-white shadow-xl transition hover:scale-105 active:scale-95 sm:h-14 sm:w-14"
            >
              <MessageCircle className="h-6 w-6" />
            </a>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedItem && (
          <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-6">
            <motion.button
              type="button"
              aria-label="Close item details"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedItem(null)}
              className="absolute inset-0 bg-black/[0.62] backdrop-blur-[2px]"
            />

            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="item-detail-title"
              initial={reduceMotion ? false : { opacity: 0, y: 28, scale: 0.98 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.22 }}
              className="relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-lg bg-[#fffaf2] text-[#2c1810] shadow-2xl sm:max-w-lg sm:rounded-lg"
            >
              <button
                type="button"
                onClick={() => setSelectedItem(null)}
                aria-label="Close"
                className="absolute right-4 top-4 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-black/[0.65] text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative h-56 bg-[#efe0cb]">
                {getItemImage(selectedItem) ? (
                  <img src={getItemImage(selectedItem)} alt={selectedItem.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--menu-primary)]">
                    <Utensils className="h-14 w-14 opacity-60" />
                  </div>
                )}
              </div>

              <div className="max-h-[calc(92vh-14rem)] overflow-y-auto p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {renderDietIcon(selectedItem)}
                      {renderSpice(selectedItem)}
                      <span className="rounded-full bg-[#4a2c1e]/[0.08] px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-[#6b5b50]">
                        {selectedItem.categoryName}
                      </span>
                      {!selectedItem.isAvailable && (
                        <span className="rounded-full bg-stone-200 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-stone-600">
                          Unavailable
                        </span>
                      )}
                    </div>
                    <h2 id="item-detail-title" className="mt-3 text-2xl font-black leading-tight" style={headingStyle}>
                      {selectedItem.name}
                    </h2>
                  </div>
                  <p className="shrink-0 text-right text-lg font-black text-[var(--menu-secondary)]">
                    {formatItemPrice(selectedItem, restaurant.currency)}
                  </p>
                </div>

                {selectedItem.description && (
                  <p className="mt-4 text-sm leading-7 text-[#6b5b50]">{selectedItem.description}</p>
                )}

                {selectedItem.variants && selectedItem.variants.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b5b50]">Variants / Add-ons</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.variants.map(variant => (
                        <span key={variant} className="rounded-full bg-white px-3 py-1 text-[10px] font-bold text-[#4a2c1e]">
                          {variant}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.tags.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b5b50]">Tags</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.tags.map(tag => (
                        <span key={tag} className="rounded-full bg-[#c58a4b]/[0.12] px-3 py-1 text-[10px] font-bold text-[#6b3f20]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedItem.allergens.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6b5b50]">Allergens</h3>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {selectedItem.allergens.map(allergen => (
                        <span key={allergen} className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-bold text-rose-700">
                          {allergen}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {restaurant.whatsapp && (
                <div className="border-t border-[#4a2c1e]/10 p-4">
                  {selectedItem.isAvailable ? (
                    <a
                      href={getWhatsAppUrl(restaurant, selectedItem)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[var(--menu-primary)] px-4 py-3 text-sm font-black text-white transition hover:opacity-90"
                    >
                      <ShoppingBag className="h-4 w-4" />
                      Order on WhatsApp
                    </a>
                  ) : (
                    <button
                      disabled
                      className="flex w-full items-center justify-center rounded-full bg-stone-200 px-4 py-3 text-sm font-black text-stone-500"
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
