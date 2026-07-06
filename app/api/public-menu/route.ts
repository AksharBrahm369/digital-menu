import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getFirebaseAdminConfigProblem } from "@/lib/firebase-admin";
import type { Menu, Restaurant } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeFirestoreValue(value: any): any {
  if (!value) return value;
  if (typeof value.toMillis === "function" && typeof value.seconds === "number") {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds || 0 };
  }
  if (Array.isArray(value)) return value.map(serializeFirestoreValue);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeFirestoreValue(item)]));
  }
  return value;
}

function sortBySortOrder<T extends Record<string, any>>(items: T[]) {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

async function getPublishedMenu(restaurant: Restaurant): Promise<Menu | null> {
  const adminDb = getAdminDb();
  const restaurantId = restaurant.id;
  const menuId = restaurant.currentPublishedMenuId;
  if (!restaurantId || !menuId) return null;

  const snap = await adminDb
    .collection("restaurants")
    .doc(restaurantId)
    .collection("menus")
    .doc(menuId)
    .get();
  if (!snap.exists) return null;

  const menu = { id: snap.id, ...snap.data() } as Menu;
  return menu.status === "published" ? menu : null;
}

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

    const configProblem = getFirebaseAdminConfigProblem();
    if (configProblem) {
      console.error("Public menu Firebase Admin configuration error:", configProblem);
      return NextResponse.json(
        { error: "Firebase Admin is not configured.", details: configProblem, code: "FIREBASE_ADMIN_CONFIG_ERROR" },
        { status: 500 }
      );
    }

    const adminDb = getAdminDb();
    const restaurantSnapshot = await adminDb.collection("restaurants").where("slug", "==", slug).limit(1).get();
    if (restaurantSnapshot.empty) {
      return NextResponse.json({ error: "Restaurant not found.", code: "RESTAURANT_NOT_FOUND" }, { status: 404 });
    }

    const restaurant = {
      id: restaurantSnapshot.docs[0].id,
      ...restaurantSnapshot.docs[0].data(),
    } as Restaurant;
    if (restaurant.status !== "published" || !restaurant.currentPublishedMenuId) {
      return NextResponse.json({ error: "Published menu not found.", code: "MENU_NOT_FOUND" }, { status: 404 });
    }

    const menu = await getPublishedMenu(restaurant);
    if (!menu || menu.status !== "published") {
      return NextResponse.json({ error: "Published menu not found.", code: "MENU_NOT_FOUND" }, { status: 404 });
    }

    const [categoriesSnapshot, itemsSnapshot, themesSnapshot] = await Promise.all([
      adminDb.collection("restaurants").doc(restaurant.id!).collection("menus").doc(menu.id!).collection("categories").get(),
      adminDb.collection("restaurants").doc(restaurant.id!).collection("menus").doc(menu.id!).collection("items").get(),
      adminDb.collection("restaurants").doc(restaurant.id!).collection("themes").where("isActive", "==", true).limit(1).get(),
    ]);

    const categories = sortBySortOrder(categoriesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    const items = sortBySortOrder(itemsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })));
    const theme = themesSnapshot.empty ? null : themesSnapshot.docs[0].data();

    return NextResponse.json({
      data: serializeFirestoreValue({
        restaurant,
        menu,
        categoriesSnapshot: categories,
        itemsSnapshot: items,
        theme,
      }),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown public menu error.";
    console.error("Public menu API error:", error);
    return NextResponse.json({ error: "Public menu request failed", details: message, code: "PUBLIC_MENU_ERROR" }, { status: 500 });
  }
}
