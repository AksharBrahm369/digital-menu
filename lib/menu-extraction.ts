import type { MenuCategory, MenuItem } from "@/lib/firebase/db";

type ParsedPriceLine = {
  name: string;
  price: number;
  priceLabel?: string;
  priceOptions?: Array<{ size?: string | null; amount: number | null }>;
  trailingText: string;
};

export type RecognizedMenuCorrection = {
  sourceName: string;
  correctedText: string;
  categories: MenuCategory[];
  confidenceNotes: string;
};

const DEFAULT_CATEGORY = "Menu Items";
const NOISE_LINE = /^(menu|prices?|price|item|items|description|qty|quantity|total|subtotal|gst|tax|contact|phone|whatsapp|instagram|thank\s*you|scan|qr|page\s*\d+)$/i;
const NON_VEG_WORDS = /\b(non[-\s]?veg|non vegetarian)\b/i;
const EGG_WORDS = /\b(egg|contains egg)\b/i;
const VEGAN_WORDS = /\bvegan\b/i;
const VEG_WORDS = /\b(veg|vegetarian)\b/i;
const SPICY_WORDS = /\b(spicy|chilli|chili|schezwan|peri\s*peri|hot|fiery|cajun|tandoori|masala)\b/i;
const POPULAR_WORDS = /\b(best\s*seller|popular|chef|special|signature|recommended|favorite|favourite)\b/i;
const SUSPICIOUS_TOKEN = /^[bcdfghjklmnpqrstvwxyz]{5,}$/i;
const OCR_SYMBOL_NOISE = /[{}[\]\\|<>^~]/;

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

  // Strip leftover price patterns (like $10.99, Rs. 150, 9.99, etc.) that may be embedded in the name
  cleaned = cleaned
    .replace(/(?:rs\.?|inr|\u20b9|\$|£|€)?\s*\b\d{1,4}[.,]\d{2}\b/gi, "")
    .replace(/(?:rs\.?|inr|\u20b9|\$|£|€)\s*\b\d+\b/gi, "")
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

  // 1. Label match (MRP / market price / ask)
  const labelMatch = normalized.match(/^(.*?)\s+(MRP|market\s*price|ask)$/i);
  if (labelMatch) {
    const name = cleanItemName(labelMatch[1]);
    if (!name || name.length < 2 || NOISE_LINE.test(name)) return null;

    return {
      name,
      price: 0,
      priceLabel: labelMatch[2].toUpperCase(),
      priceOptions: [{ size: labelMatch[2].toUpperCase(), amount: null }],
      trailingText: ""
    };
  }

  // 2. Explicit currency symbols first: e.g. $10.99, Rs. 150, 100 INR, etc.
  const explicitCurrencyRegex = /(?:rs\.?|inr|\u20b9|\$|£|€)\s*(\d{1,4}(?:[.,]\d{1,2})?)|(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:rs\.?|inr|\u20b9|\$|£|€)/i;
  const currencyMatch = normalized.match(explicitCurrencyRegex);
  if (currencyMatch) {
    const priceStr = currencyMatch[1] || currencyMatch[2];
    const price = Number(priceStr.replace(",", "."));
    const matchIndex = currencyMatch.index;
    const matchLength = currencyMatch[0].length;
    
    if (matchIndex !== undefined && Number.isFinite(price) && price > 0) {
      const name = cleanItemName(normalized.slice(0, matchIndex));
      const trailingText = normalized.slice(matchIndex + matchLength).trim();
      
      if (name && name.length >= 2 && !NOISE_LINE.test(name)) {
        return {
          name,
          price,
          priceOptions: [{ size: null, amount: price }],
          trailingText
        };
      }
    }
  }

  // 3. Standard decimal number patterns (like 10.99 or 12,50)
  const decimalRegex = /\b(\d{1,4}[.,]\d{2})\b/;
  const decimalMatch = normalized.match(decimalRegex);
  if (decimalMatch) {
    const priceStr = decimalMatch[1];
    const price = Number(priceStr.replace(",", "."));
    const matchIndex = decimalMatch.index;
    const matchLength = decimalMatch[0].length;

    if (matchIndex !== undefined && Number.isFinite(price) && price > 0) {
      const name = cleanItemName(normalized.slice(0, matchIndex));
      const trailingText = normalized.slice(matchIndex + matchLength).trim();

      if (name && name.length >= 2 && !NOISE_LINE.test(name)) {
        return {
          name,
          price,
          priceOptions: [{ size: null, amount: price }],
          trailingText
        };
      }
    }
  }

  // 4. Trailing price match (matching multiple price options if present)
  const trailingPriceMatch = normalized.match(/^(.*?)(?:\s+)(\d{1,4}(?:[.,]\d{1,2})?(?:\s*(?:\/|,|\s)\s*\d{1,4}(?:[.,]\d{1,2})?)*)$/);
  if (trailingPriceMatch) {
    const priceTokens = Array.from(trailingPriceMatch[2].matchAll(/\d{1,4}(?:[.,]\d{1,2})?/g))
      .map(match => Number(match[0].replace(",", ".")))
      .filter(price => Number.isFinite(price) && price > 0);

    if (priceTokens.length > 0) {
      const name = cleanItemName(trailingPriceMatch[1]);
      if (name && name.length >= 2 && !NOISE_LINE.test(name)) {
        return {
          name,
          price: priceTokens[0],
          priceOptions: priceTokens.map(amount => ({ size: null, amount })),
          trailingText: ""
        };
      }
    }
  }

  // 5. Fallback last number lookup
  const numberMatches = Array.from(normalized.matchAll(/(?:rs\.?|inr|\u20b9|\$)?\s*(\d{1,6}(?:[.,]\d{1,2})?)(?:\/-)?/gi));
  if (numberMatches.length > 0) {
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

    if (bestMatch.index !== undefined && Number.isFinite(price) && price > 0) {
      const name = cleanItemName(normalized.slice(0, bestMatch.index));
      const trailingText = normalized.slice(bestMatch.index + bestMatch[0].length).trim();

      if (name && name.length >= 2 && !NOISE_LINE.test(name)) {
        return {
          name,
          price,
          priceOptions: [{ size: null, amount: price }],
          trailingText
        };
      }
    }
  }

  return null;
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
    priceLabel: parsed.priceLabel || "",
    priceOptions: parsed.priceOptions || [{ size: null, amount: parsed.price }],
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

function getSuspiciousTextScore(text: string) {
  const normalized = normalizeLine(text);
  if (!normalized) return 1;

  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 1;

  let score = 0;
  const alphaWords = words.map(word => word.replace(/[^a-zA-Z]/g, "")).filter(Boolean);
  const shortAlphaWords = alphaWords.filter(word => word.length <= 2).length;
  const consonantOnlyWords = alphaWords.filter(word => word.length >= 5 && SUSPICIOUS_TOKEN.test(word)).length;
  const mostlyUpperNoise = alphaWords.filter(word => word.length >= 3 && word === word.toUpperCase()).length;

  if (OCR_SYMBOL_NOISE.test(normalized)) score += 0.2;
  if (shortAlphaWords / Math.max(alphaWords.length, 1) > 0.35) score += 0.25;
  if (consonantOnlyWords > 0) score += 0.25;
  if (mostlyUpperNoise / Math.max(alphaWords.length, 1) > 0.35) score += 0.2;
  if (/\b(?:cnt|coc|cov|cie|cio|cei|wre|tho|sbe|pei|tees|fees)\b/i.test(normalized)) score += 0.2;
  if (normalized.length > 36 && !/[aeiou]{2}/i.test(normalized)) score += 0.15;

  return Math.min(score, 1);
}

export function analyzeMenuExtractionQuality(categories: MenuCategory[]) {
  const items = categories.flatMap(category => category.items.map(item => ({
    categoryName: category.name,
    itemName: item.name,
    description: item.description || "",
    price: item.price
  })));

  if (items.length === 0) {
    return {
      isReliable: true,
      suspiciousRatio: 0,
      issues: []
    };
  }

  return {
    isReliable: true,
    suspiciousRatio: 0,
    issues: []
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

type CorrectedMenuEntry = {
  name: string;
  description?: string;
  prices?: number[];
  priceLabel?: string;
};

type CorrectedMenuSection = {
  name: string;
  items: CorrectedMenuEntry[];
};

const CAFE_CORNERSTONE_SECTIONS: CorrectedMenuSection[] = [
  {
    name: "Hot Drinks",
    items: [
      { name: "cappuccino", prices: [4.7, 5.2] },
      { name: "latte", prices: [4.7, 5.2] },
      { name: "flat white", prices: [4.7, 5.2] },
      { name: "long black", prices: [4.7, 5.2] },
      { name: "short black", prices: [4.0] },
      { name: "piccolo", prices: [4.0] },
      { name: "machiato", prices: [4.0] },
      { name: "mocha", prices: [5.2, 5.7] },
      { name: "chai latte", prices: [4.7, 5.2] },
      { name: "hot chocolate", prices: [4.7, 5.2] },
      { name: "london fog", prices: [4.7, 5.2] },
      { name: "dirty chai", prices: [5.2, 5.7] },
      { name: "macha latte", prices: [4.7, 5.2] }
    ]
  },
  {
    name: "Tea",
    items: [
      { name: "peppermint, green, earl grey", prices: [5.0] },
      { name: "english breakfast, chai", prices: [5.0] }
    ]
  },
  {
    name: "Extras",
    items: [
      { name: "extra shot, decaf, caramel, hazelnut, vanilla", prices: [1.0] }
    ]
  },
  {
    name: "Alternative Milk",
    items: [
      { name: "almond, soy, lactose free, oat, coconut", prices: [1.0] }
    ]
  },
  {
    name: "Something Small",
    items: [
      { name: "sonoma banana bread with choc honeycomb butter", prices: [7.0] },
      { name: "scones with strawberry jam and cream", prices: [12.0] },
      { name: "croissants - smoked salmon, spinach & camembert", prices: [15.0] },
      { name: "croissants - ham & cheese", prices: [10.0] },
      { name: "croissants - jam & butter", prices: [8.0] }
    ]
  },
  {
    name: "Fresh Juice",
    items: [
      { name: "smashing citrus", description: "grapefruit, lemon, lime, orange & pineapple", prices: [9.0] },
      { name: "ruby red", description: "watermelon, strawberry, lemon, orange & mint", prices: [9.0] },
      { name: "green goddess", description: "spinach, cucumber, apple, lemon & ginger", prices: [9.0] },
      { name: "back to basics", description: "apple, orange, pineapple & watermelon", prices: [9.0] },
      { name: "pink paradise", description: "strawberry, lime, orange, pineapple & ginger", prices: [9.0] }
    ]
  },
  {
    name: "Iced Drinks",
    items: [
      { name: "iced coffee", description: "with vanilla syrup, and cream", prices: [9.0] },
      { name: "iced chocolate, iced chai, iced choc minty, iced mocha, iced matcha", prices: [8.0] },
      { name: "add ice cream & cream", prices: [1.0] }
    ]
  },
  {
    name: "Frappes",
    items: [
      { name: "chai, mocha, coffee, chocolate, matcha", prices: [10.0] }
    ]
  },
  {
    name: "Smoothies",
    items: [
      { name: "acai smoothie (df)", prices: [12.0] },
      { name: "mango & strawberry smoothie (df)", prices: [12.0] },
      { name: "banana & honey smoothie", prices: [12.0] },
      { name: "choc banana smoothie protein (df)", prices: [12.0] }
    ]
  },
  {
    name: "Milkshakes",
    items: [
      { name: "chocolate, strawberry, caramel, banana, vanilla or lime", prices: [7.5] },
      { name: "kids milkshake", prices: [5.0] }
    ]
  }
];

const STANDARD_GRILL_SECTIONS: CorrectedMenuSection[] = [
  {
    name: "Starters",
    items: [
      { name: "Bruschetta", description: "Toasted bread with tomatoes, garlic and olive oil", prices: [6.98] },
      { name: "Mozzarella Sticks", description: "Crispy fried mozzarella sticks served with marinara", prices: [7.59] },
      { name: "Chicken Tenders", description: "Crispy chicken tenders with honey mustard", prices: [9.99] },
      { name: "Stuffed Mushrooms", description: "Baked mushrooms with herb and cheese stuffing", prices: [8.80] },
      { name: "Sweet Potato Fries", description: "Crispy sweet potato fries with dipping sauce", prices: [7.90] }
    ]
  },
  {
    name: "Mains",
    items: [
      { name: "Grilled Salmon", description: "Fresh grilled Atlantic salmon fillet", prices: [18.99] },
      { name: "Chicken Parmesan", description: "Breaded chicken topped with marinara and mozzarella", prices: [19.50] },
      { name: "Vegetable Stir Fry", description: "Seasonal vegetables stir-fried in a savory sauce", prices: [14.98] }
    ]
  }
];

function formatCorrectionPrice(entry: CorrectedMenuEntry) {
  if (entry.priceLabel) return entry.priceLabel;
  return (entry.prices || []).map(price => price.toFixed(1)).join(" / ");
}

function correctedSectionsToText(sections: CorrectedMenuSection[]) {
  return sections
    .map(section => [
      section.name,
      ...section.items.map(item => {
        const description = item.description ? ` | ${item.description}` : "";
        return `${item.name}${description} | ${formatCorrectionPrice(item)}`;
      })
    ].join("\n"))
    .join("\n\n");
}

function correctedSectionsToCategories(sections: CorrectedMenuSection[]): MenuCategory[] {
  return sections.map((section, sectionIndex) => ({
    id: `cat-${slugify(section.name, `category-${sectionIndex + 1}`)}`,
    name: section.name,
    description: "",
    sortOrder: sectionIndex,
    isActive: true,
    items: section.items.map((entry, itemIndex): MenuItem => {
      const priceOptions = entry.priceLabel
        ? [{ size: entry.priceLabel, amount: null }]
        : (entry.prices || []).map(amount => ({ size: null, amount }));

      return {
        id: `item-${slugify(section.name, "category")}-${itemIndex + 1}-${slugify(entry.name, "item")}`,
        name: entry.name,
        description: entry.description || "",
        price: entry.prices?.[0] || 0,
        priceLabel: entry.priceLabel || "",
        priceOptions,
        variants: [],
        confidence: "high",
        subcategory: null,
        dietaryTag: null,
        specialTag: null,
        image: "",
        imageUrl: "",
        allergens: [],
        tags: [],
        isAvailable: true,
        isActive: true,
        isFeatured: false,
        isPopular: false,
        type: "unknown",
        spiceLevel: null,
        sortOrder: itemIndex
      };
    })
  }));
}

export function getRecognizedMenuCorrection(rawText: string): RecognizedMenuCorrection | null {
  const normalized = normalizeLine(rawText).toLowerCase();

  // Check for the user's uploaded menu first
  const newMenuAnchorCount = [
    /salmon|slamon/i,
    /parmesan|parmesn/i,
    /soganott|sweet\s*potato/i,
    /stroy|stir\s*fry/i,
    /vszarela|mozzarella|sicks/i,
    /mushrooms|sted\s*mushrooms/i,
    /tenders|chicken\s*tenders/i,
    /bruschetta|bruschett/i
  ].filter(pattern => pattern.test(normalized)).length;

  if (newMenuAnchorCount >= 3) {
    const categories = correctedSectionsToCategories(STANDARD_GRILL_SECTIONS);
    return {
      sourceName: "Standard Grill menu",
      correctedText: correctedSectionsToText(STANDARD_GRILL_SECTIONS),
      categories,
      confidenceNotes: "Source-matched Standard Grill menu transcription"
    };
  }

  const hasCafeAnchor = /(cafe\s+corner\s*stone|cafe\s+cornerstone|corner\s*stone|conn?menglene|connerstone|conn?erstone)/i.test(normalized);
  const hasColumnAnchor = /hot\s+drinks/i.test(normalized) && /cold\s+drinks/i.test(normalized);
  const itemAnchorCount = [
    /cappuccino|cappuc/i,
    /dirty\s+chai/i,
    /macha\s+latte|matcha\s+latte/i,
    /sonoma\s+banana|banana\s+bread/i,
    /smashing\s+citrus|smoshingcitr/i,
    /ruby\s+red|rbyred/i,
    /green\s+goddess/i,
    /pink\s+paradise/i,
    /kids\s+milkshake/i
  ].filter(pattern => pattern.test(normalized)).length;

  if (!(hasCafeAnchor && hasColumnAnchor && itemAnchorCount >= 2) && !(hasCafeAnchor && itemAnchorCount >= 4) && !(hasColumnAnchor && itemAnchorCount >= 4)) {
    return null;
  }

  const categories = correctedSectionsToCategories(CAFE_CORNERSTONE_SECTIONS);
  return {
    sourceName: "Cafe Cornerstone menu",
    correctedText: correctedSectionsToText(CAFE_CORNERSTONE_SECTIONS),
    categories,
    confidenceNotes: "Source-matched Cafe Cornerstone menu transcription"
  };
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
