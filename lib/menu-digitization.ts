import type { MenuCategory, MenuItem } from "@/lib/firebase/db";

export type DigitizedPrice = {
  size?: string | null;
  amount: number | null;
};

export type DigitizedItem = {
  name: string;
  description?: string | null;
  price?: DigitizedPrice[] | DigitizedPrice | number | string | null;
  variants?: string[] | string | null;
  dietary_tag?: "veg" | "non-veg" | "egg" | "vegan" | null;
  spice_level?: number | string | null;
  special_tag?: string | null;
  is_available?: boolean;
  confidence?: "high" | "medium" | "low";
};

export type DigitizedSubcategory = {
  subcategory_name?: string | null;
  items?: DigitizedItem[];
};

export type DigitizedCategory = {
  category_name: string;
  subcategories?: DigitizedSubcategory[];
  items?: DigitizedItem[];
};

export type DigitizedMenuJson = {
  menu_metadata?: {
    total_items_detected?: number;
    total_categories_detected?: number;
    extraction_confidence_notes?: string;
  };
  categories: DigitizedCategory[];
};

export type DigitizedMenuImport = {
  categories: MenuCategory[];
  metadata: {
    totalItemsDetected: number;
    totalCategoriesDetected: number;
    confidenceNotes: string;
  };
};

export const PROFESSIONAL_MENU_DIGITIZATION_PROMPT = `
You are a professional menu digitization engine. Your ONLY job is to convert the uploaded menu image into a complete, accurate, structured JSON representation.
You are not designing a menu. You are transcribing one exactly as it appears.

NON-NEGOTIABLE RULES
1. Extract every single item. Do not summarize, sample, or skip items.
2. Do not invent, guess, improve, or rewrite item names, prices, or descriptions.
3. If text is unclear, keep what is legible and mark confidence as low.
4. Preserve original category headings, subcategories, spelling, language, and repeated items.
5. Preserve all prices/sizes as price arrays.
6. dietary_tag, spice_level, and special_tag must be set only when explicitly printed/marked.
7. Return strict JSON only with menu_metadata and categories.
`.trim();

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function normalizeAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value).replace(/[^\d.,-]/g, "").replace(",", ".");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePriceOptions(price: DigitizedItem["price"]): DigitizedPrice[] {
  if (price === null || price === undefined || price === "") return [];

  if (Array.isArray(price)) {
    return price.map(entry => ({
      size: entry?.size ?? null,
      amount: normalizeAmount(entry?.amount)
    }));
  }

  if (typeof price === "object") {
    return [{
      size: price.size ?? null,
      amount: normalizeAmount(price.amount)
    }];
  }

  return [{
    size: null,
    amount: normalizeAmount(price)
  }];
}

function normalizePriceLabel(price: DigitizedItem["price"]) {
  if (typeof price !== "string") return "";
  const label = price.trim();
  if (!label || normalizeAmount(label) !== null) return "";
  return label;
}

function normalizeVariants(value: DigitizedItem["variants"]) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).map(item => item.trim()).filter(Boolean);
  return [String(value).trim()].filter(Boolean);
}

function normalizeDietaryTag(value: DigitizedItem["dietary_tag"]): MenuItem["dietaryTag"] {
  if (value === "veg" || value === "non-veg" || value === "egg" || value === "vegan") return value;
  return null;
}

function normalizeSpiceLevel(value: DigitizedItem["spice_level"]): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function convertItem(
  item: DigitizedItem,
  categoryName: string,
  subcategoryName: string | null,
  itemIndex: number
): MenuItem {
  const priceOptions = normalizePriceOptions(item.price);
  const firstAmount = priceOptions.find(option => option.amount !== null)?.amount ?? 0;
  const priceLabel = normalizePriceLabel(item.price) || priceOptions.find(option => option.amount === null && option.size)?.size || "";
  const dietaryTag = normalizeDietaryTag(item.dietary_tag);
  const specialTag = item.special_tag?.trim() || null;
  const tags = specialTag ? [specialTag] : [];

  return {
    id: `item-${slugify(categoryName, "category")}-${subcategoryName ? `${slugify(subcategoryName, "subcategory")}-` : ""}${itemIndex + 1}-${slugify(item.name, "item")}`,
    name: item.name,
    description: item.description || "",
    price: firstAmount,
    priceLabel,
    priceOptions,
    variants: normalizeVariants(item.variants),
    confidence: item.confidence || "high",
    subcategory: subcategoryName,
    dietaryTag,
    specialTag,
    allergens: [],
    tags,
    isAvailable: item.is_available !== false,
    isActive: true,
    isPopular: Boolean(specialTag && /best|popular|special|chef|signature|new/i.test(specialTag)),
    type: dietaryTag || "unknown",
    spiceLevel: normalizeSpiceLevel(item.spice_level),
    sortOrder: itemIndex
  };
}

export function convertDigitizedJsonToMenuCategories(input: DigitizedMenuJson): DigitizedMenuImport {
  const categories = (input.categories || []).map((category, categoryIndex): MenuCategory => {
    const sourceSubcategories = category.subcategories?.length
      ? category.subcategories
      : [{ subcategory_name: null, items: category.items || [] }];

    const items = sourceSubcategories.flatMap(subcategory => {
      const subcategoryName = subcategory.subcategory_name || null;
      return (subcategory.items || []).map((item, itemIndex) => (
        convertItem(item, category.category_name, subcategoryName, itemIndex)
      ));
    });

    return {
      id: `cat-${slugify(category.category_name, `category-${categoryIndex + 1}`)}`,
      name: category.category_name,
      description: "",
      items,
      isActive: true,
      sortOrder: categoryIndex
    };
  }).filter(category => category.items.length > 0);

  const totalItems = categories.reduce((sum, category) => sum + category.items.length, 0);

  return {
    categories,
    metadata: {
      totalItemsDetected: input.menu_metadata?.total_items_detected ?? totalItems,
      totalCategoriesDetected: input.menu_metadata?.total_categories_detected ?? categories.length,
      confidenceNotes: input.menu_metadata?.extraction_confidence_notes || "none"
    }
  };
}

export function parseDigitizedMenuJson(rawJson: string): DigitizedMenuImport {
  const parsed = JSON.parse(rawJson) as DigitizedMenuJson;
  if (!Array.isArray(parsed.categories)) {
    throw new Error("Digitized JSON must include a categories array.");
  }

  return convertDigitizedJsonToMenuCategories(parsed);
}
