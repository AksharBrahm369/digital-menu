import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get("slug") || "").trim().toLowerCase();
    if (!slug) {
      return NextResponse.json({ error: "Missing restaurant slug.", code: "MISSING_SLUG" }, { status: 400 });
    }
    if (!/^[a-z0-9-]{1,120}$/.test(slug)) {
      return NextResponse.json({ error: "Invalid restaurant slug.", code: "INVALID_SLUG" }, { status: 400 });
    }

    // 1. Fetch restaurant
    const restaurant = await db.getRestaurantBySlug(slug);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found.", code: "RESTAURANT_NOT_FOUND" }, { status: 404 });
    }

    if (restaurant.status !== "published" || !restaurant.currentPublishedMenuId) {
      return NextResponse.json({ error: "Published menu not found.", code: "MENU_NOT_PUBLISHED" }, { status: 404 });
    }

    // 2. Fetch menu
    const menu = await db.getPublishedMenuForRestaurant(restaurant);
    if (!menu || menu.status !== "published") {
      return NextResponse.json({ error: "Published menu not found.", code: "MENU_NOT_PUBLISHED" }, { status: 404 });
    }

    // 3. Fetch subcollections and theme
    const [categories, items, theme] = await Promise.all([
      db.getMenuCategoriesSubcollection(restaurant.id!, menu.id!),
      db.getMenuItemsSubcollection(restaurant.id!, menu.id!),
      db.getActiveThemeForRestaurant(restaurant.id!)
    ]);

    // Format fields specifically if needed for compatibility
    const categoriesSnapshot = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      sortOrder: cat.sort_order ?? cat.sortOrder,
      isActive: cat.is_active ?? cat.isActive
    }));

    const itemsSnapshot = items.map(item => ({
      id: item.id,
      categoryId: item.categoryId ?? item.category_id,
      name: item.name,
      description: item.description,
      price: Number(item.price),
      priceLabel: item.priceLabel ?? item.price_label,
      priceOptions: item.priceOptions ?? item.price_options,
      variants: item.variants,
      confidence: item.confidence,
      subcategory: item.subcategory,
      dietaryTag: item.dietaryTag ?? item.dietary_tag,
      specialTag: item.specialTag ?? item.special_tag,
      type: item.type,
      imageUrl: item.imageUrl ?? item.image_url,
      isAvailable: item.isAvailable ?? item.is_available,
      isVeg: item.isVeg ?? item.is_veg,
      isFeatured: item.isFeatured ?? item.is_featured,
      isPopular: item.isPopular ?? item.is_popular,
      spiceLevel: item.spiceLevel ?? item.spice_level,
      allergens: item.allergens,
      tags: item.tags,
      sortOrder: item.sortOrder ?? item.sort_order
    }));

    return NextResponse.json({
      data: {
        restaurant,
        menu,
        categoriesSnapshot,
        itemsSnapshot,
        theme,
      },
    });
  } catch (error) {
    console.error("[api/public-menu] Public menu API error:", error);
    const message = error instanceof Error ? error.message : "Unknown public menu error.";
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        details: message,
      },
      { status: 500 }
    );
  }
}
