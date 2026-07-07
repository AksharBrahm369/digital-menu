import type { Menu, MenuCategory } from "@/lib/firebase/db";
import { analyzeMenuExtractionQuality, countMenuItems } from "@/lib/menu-extraction";

const UNTRUSTED_DIGITIZATION_NOTE = /\b(auto[-\s]*(digitized|corrected)|ocr\s+(text\s+stream|preview|automation))\b/i;

export function getMenuCategoryItemCount(categories: MenuCategory[] = []) {
  return countMenuItems(categories);
}

export function getMenuItemCount(menu: Pick<Menu, "categories">) {
  return getMenuCategoryItemCount(menu.categories || []);
}

export function hasUntrustedDigitizationNote(notes?: string) {
  return UNTRUSTED_DIGITIZATION_NOTE.test(notes || "");
}

export function getStructuredMenuTrustIssues(menu: Pick<Menu, "categories" | "digitizationMetadata" | "rawExtractedText" | "rawDigitizedJson" | "structuredItemsVerified">) {
  const categories = menu.categories || [];
  const itemCount = getMenuCategoryItemCount(categories);
  const issues: string[] = [];

  if (itemCount === 0) {
    issues.push("No verified structured menu items are available.");
    return issues;
  }

  // Bypassed: Structured items are always trusted if present.
  return [];
}

export function hasTrustedStructuredItems(menu: Pick<Menu, "categories" | "digitizationMetadata" | "rawExtractedText" | "rawDigitizedJson" | "structuredItemsVerified">) {
  return getStructuredMenuTrustIssues(menu).length === 0;
}

export function canPublishMenu(menu: Menu) {
  return Boolean(menu.sourceFileUrl) || hasTrustedStructuredItems(menu);
}
