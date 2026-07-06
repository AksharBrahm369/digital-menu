import type { MenuCategory, MenuItem } from "@/lib/firebase/db";

type ParsedPriceLine = {
  name: string;
  price: number;
  trailingText: string;
};

const DEFAULT_CATEGORY = "Menu Items";
const NOISE_LINE = /^(menu|prices?|price|item|items|description|qty|quantity|total|subtotal|gst|tax|contact|phone|whatsapp|instagram|thank\s*you|scan|qr|page\s*\d+)$/i;
const NON_VEG_WORDS = /\b(non[-\s]?veg|non vegetarian)\b/i;
const EGG_WORDS = /\b(egg|contains egg)\b/i;
const VEGAN_WORDS = /\bvegan\b/i;
const VEG_WORDS = /\b(veg|vegetarian)\b/i;
const SPICY_WORDS = /\b(spicy|chilli|chili|schezwan|peri\s*peri|hot|fiery|cajun|tandoori|masala)\b/i;
const POPULAR_WORDS = /\b(best\s*seller|popular|chef|special|signature|recommended|favorite|favourite)\b/i;

function slugify(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function normalizeLine(line: string) {
  return line
    .replace(/[\u2022\u00b7]/g, " ")
    .replace(/[|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanItemName(value: string) {
  let cleaned = value
    .replace(/(?:rs\.?|inr|\u20b9|\$)\s*$/i, "")
    .replace(/^[.:,-]+|[.:,-]+$/g, "")
    .trim();

  // Remove leading garbage tokens from OCR (numbers, symbols, short noise words <= 3 chars)
  // e.g. "(ei 47 52 ", "pm 47 sz ", "= is) "
  cleaned = cleaned.replace(/^[a-z0-9\s(){}[\]|.,;:=+-]{1,20}\s+(?=[a-zA-Z]{4,})/i, (match) => {
    const words = match.trim().split(/\s+/);
    const hasLongWord = words.some(w => w.replace(/[^a-zA-Z]/g, "").length > 3);
    return hasLongWord ? match : "";
  });

  // Strip leading symbols and numbers (like item indices or leftover OCR trash)
  cleaned = cleaned
    .replace(/^[^a-zA-Z\d]+/, "")
    .replace(/^\d+\s*[.,-]?\s*/, "")
    .replace(/^[.:,-]+|[.:,-]+$/g, "")
    .trim();

  // Remove trailing single character noise (like isolated letter 'a', 'x', or letter-digit noise like 'a7', 'v2')
  cleaned = cleaned
    .replace(/\s+[a-zA-Z]$/, "")
    .replace(/\s+[a-zA-Z][0-9]$/i, "")
    .trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }
  return cleaned;
}

function parsePriceLine(line: string): ParsedPriceLine | null {
  const normalized = normalizeLine(line);
  
  // Find all number tokens that look like prices
  const numberMatches = Array.from(normalized.matchAll(/(?:rs\.?|inr|\u20b9|\$)?\s*(\d{1,6}(?:[.,]\d{1,2})?)(?:\/-)?/gi));
  if (numberMatches.length === 0) return null;

  // We find the last number in the line, as menu prices are typically placed towards the right/end.
  // If the last number is very small (< 10, like spice level or quantity) and there is a larger number before it,
  // we treat the larger number as the price.
  let bestMatch = numberMatches[numberMatches.length - 1];
  let price = Number(bestMatch[1].replace(",", "."));

  if (numberMatches.length > 1 && price < 10) {
    const prevMatch = numberMatches[numberMatches.length - 2];
    const prevPrice = Number(prevMatch[1].replace(",", "."));
    if (prevPrice >= 10) {
      bestMatch = prevMatch;
      price = prevPrice;
    }
  }

  if (bestMatch.index === undefined || !Number.isFinite(price) || price === 0) return null;

  const name = cleanItemName(normalized.slice(0, bestMatch.index));
  const trailingText = normalized.slice(bestMatch.index + bestMatch[0].length).trim();

  if (!name || name.length < 2 || NOISE_LINE.test(name)) return null;

  return {
    name,
    price,
    trailingText
  };
}

function parsePriceEntries(line: string): ParsedPriceLine[] {
  const parsed = parsePriceLine(line);
  return parsed ? [parsed] : [];
}

function hasPriceNearby(lines: string[], startIndex: number) {
  return lines.slice(startIndex + 1, startIndex + 5).some(line => parsePriceEntries(line).length > 0);
}

function looksLikeCategory(line: string, lines: string[], index: number) {
  const normalized = normalizeLine(line);
  if (!normalized || NOISE_LINE.test(normalized)) return false;
  if (parsePriceEntries(normalized).length > 0) return false;

  const wordCount = normalized.split(" ").length;
  const upperLetters = normalized.replace(/[^A-Z]/g, "").length;
  const lowerLetters = normalized.replace(/[^a-z]/g, "").length;
  const isMostlyUpper = upperLetters > 1 && upperLetters >= lowerLetters;
  const hasCategoryKeyword = /\b(waffle|stick|beverage|drink|coffee|tea|shake|starter|main|dessert|combo|pizza|burger|sandwich|pasta|rice|noodle|bread|soup|salad|roll|wrap|snack|mocktail|juice|ice\s*cream)\b/i.test(normalized);

  return wordCount <= 6 && (isMostlyUpper || hasCategoryKeyword || hasPriceNearby(lines, index));
}

function inferType(text: string): MenuItem["type"] {
  if (VEGAN_WORDS.test(text)) return "vegan";
  if (EGG_WORDS.test(text)) return "egg";
  if (NON_VEG_WORDS.test(text)) return "non-veg";
  if (VEG_WORDS.test(text)) return "veg";
  return "unknown";
}

function inferTags(text: string) {
  const tags: string[] = [];
  if (POPULAR_WORDS.test(text)) tags.push("Popular");
  return tags;
}

function inferSpiceLevel(text: string) {
  if (!SPICY_WORDS.test(text)) return 0;
  if (/\b(extra|very|fiery|hot)\b/i.test(text)) return 2;
  return 1;
}

function cleanCategoryName(value: string) {
  let cleaned = value
    .replace(/^[^a-zA-Z\d]+/, "")
    .replace(/^[.:,-]+|[.:,-]+$/g, "")
    .trim();

  cleaned = cleaned.replace(/^(?:a\s+rs|yi\s*=)\s*/i, "");

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function createCategory(name: string, index: number): MenuCategory {
  const cleanedName = cleanCategoryName(name);
  return {
    id: `cat-${slugify(cleanedName, `category-${index + 1}`)}`,
    name: cleanedName,
    description: "",
    sortOrder: index,
    isActive: true,
    items: []
  };
}

function createItem(parsed: ParsedPriceLine, category: MenuCategory, index: number): MenuItem {
  const text = `${parsed.name} ${parsed.trailingText}`;

  return {
    id: `item-${slugify(category.name, "category")}-${index + 1}-${slugify(parsed.name, "dish")}`,
    name: parsed.name,
    description: parsed.trailingText,
    price: parsed.price,
    allergens: [],
    tags: inferTags(text),
    isAvailable: true,
    isActive: true,
    isPopular: POPULAR_WORDS.test(text),
    type: inferType(text),
    spiceLevel: inferSpiceLevel(text),
    sortOrder: index
  };
}

function compactCategories(categories: MenuCategory[]) {
  const merged = new Map<string, MenuCategory>();

  categories.forEach(category => {
    if (!category.items.length) return;
    const key = slugify(category.name, category.id);
    const existing = merged.get(key);

    if (existing) {
      existing.items.push(...category.items);
      return;
    }

    merged.set(key, {
      ...category,
      id: `cat-${key}`,
      items: [...category.items]
    });
  });

  return Array.from(merged.values()).map((category, categoryIndex) => ({
    ...category,
    sortOrder: categoryIndex,
    items: category.items.map((item, itemIndex) => ({
      ...item,
      id: item.id || `item-${categoryIndex + 1}-${itemIndex + 1}`,
      sortOrder: itemIndex
    }))
  }));
}

export function parseMenuTextToCategories(rawText: string): MenuCategory[] {
  const lines = rawText
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

  const categories: MenuCategory[] = [];
  let currentCategory: MenuCategory | null = null;
  let lastItem: MenuItem | null = null;

  lines.forEach((line, index) => {
    if (NOISE_LINE.test(line)) return;

    const parsedPrices = parsePriceEntries(line);
    if (parsedPrices.length > 0) {
      if (!currentCategory) {
        currentCategory = createCategory(DEFAULT_CATEGORY, categories.length);
        categories.push(currentCategory);
      }

      parsedPrices.forEach(parsedPrice => {
        const item = createItem(parsedPrice, currentCategory!, currentCategory!.items.length);
        currentCategory!.items.push(item);
        lastItem = item;
      });
      return;
    }

    if (looksLikeCategory(line, lines, index)) {
      currentCategory = createCategory(line, categories.length);
      categories.push(currentCategory);
      lastItem = null;
      return;
    }

    if (lastItem && line.length > 3) {
      lastItem.description = [lastItem.description, line].filter(Boolean).join(" ");
    }
  });

  return compactCategories(categories);
}

export function countMenuItems(categories: MenuCategory[]) {
  return categories.reduce((total, category) => total + category.items.length, 0);
}
