import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getFirebaseAdminConfigProblem } from "@/lib/firebase/admin";
import type { Menu, Restaurant } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function timestampToMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value._seconds === "number") return value._seconds * 1000;
  return 0;
}

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
  if (!restaurantId) return null;

  if (restaurant.currentPublishedMenuId) {
    const snap = await adminDb
      .collection("restaurants")
      .doc(restaurantId)
      .collection("menus")
      .doc(restaurant.currentPublishedMenuId)
      .get();
    if (snap.exists) {
      const menu = { id: snap.id, ...snap.data() } as Menu;
      return menu.status === "published" ? menu : null;
    }
  }

  const snapshot = await adminDb.collection("restaurants").doc(restaurantId).collection("menus").where("status", "==", "published").get();
  const menus = snapshot.docs
    .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Menu))
    .sort((a, b) => {
      const publishedDiff = timestampToMillis(b.publishedAt) - timestampToMillis(a.publishedAt);
      return publishedDiff || timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt);
    });
  return menus[0] || null;
}

export async function GET(request: NextRequest) {
  const configProblem = getFirebaseAdminConfigProblem();
  if (configProblem) {
    return NextResponse.json({ error: configProblem }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug") || "";
    if (!slug) {
      return NextResponse.json({ error: "Missing restaurant slug." }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const restaurantSnapshot = await adminDb.collection("restaurants").where("slug", "==", slug).limit(1).get();
    if (restaurantSnapshot.empty) {
      return NextResponse.json({ error: "Restaurant not found." }, { status: 404 });
    }

    const restaurant = {
      id: restaurantSnapshot.docs[0].id,
      ...restaurantSnapshot.docs[0].data(),
    } as Restaurant;
    if (restaurant.status !== "published" || !restaurant.currentPublishedMenuId) {
      return NextResponse.json({ error: "Menu is not published yet.", restaurant }, { status: 409 });
    }

    const menu = await getPublishedMenu(restaurant);
    if (!menu || menu.status !== "published") {
      return NextResponse.json({ error: "Menu is not published yet.", restaurant }, { status: 409 });
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
    return NextResponse.json({ error: `Public menu request failed: ${message}` }, { status: 500 });
  }
}
