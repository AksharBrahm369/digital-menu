import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb, getFirebaseAdminConfigProblem } from "@/lib/firebase/admin";
import type { Menu, MenuCategory, MenuTheme, Restaurant } from "@/lib/firebase/db";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const DEFAULT_THEME: MenuTheme = {
  theme: "classic",
  primaryColor: "#d97706",
  secondaryColor: "#1e293b",
  backgroundColor: "#fafaf9",
  textColor: "#1c1917",
  fontFamily: "Inter",
  cardStyle: "3d-tilt",
};

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function requireAuthenticatedUid(request: NextRequest) {
  const configProblem = getFirebaseAdminConfigProblem();
  if (configProblem) throw new ApiError(500, configProblem);

  const token = getBearerToken(request);
  if (!token) throw new ApiError(401, "Missing Firebase authentication token.");

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown token verification error.";
    throw new ApiError(401, `Firebase token verification failed: ${message}. Sign out and sign in again.`);
  }
}

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

function normalizeSlug(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || `restaurant-${Date.now()}`;
}

async function requireRestaurantAccess(
  restaurantId: string,
  uid: string,
  allowedRoles: Array<"owner" | "admin" | "editor" | "viewer"> = ["owner", "admin", "editor", "viewer"]
) {
  const adminDb = getAdminDb();
  const restaurantRef = adminDb.collection("restaurants").doc(restaurantId);
  const restaurantSnap = await restaurantRef.get();

  if (!restaurantSnap.exists) throw new ApiError(404, "Restaurant not found.");

  const restaurant = { id: restaurantSnap.id, ...restaurantSnap.data() } as Restaurant;
  if (restaurant.ownerId === uid && allowedRoles.includes("owner")) {
    return { restaurant, restaurantRef };
  }

  const memberSnap = await restaurantRef.collection("members").doc(uid).get();
  const role = memberSnap.data()?.role;
  if (memberSnap.exists && allowedRoles.includes(role)) {
    return { restaurant, restaurantRef };
  }

  throw new ApiError(403, "You do not have access to this restaurant.");
}

async function getUniqueRestaurantSlug(desiredSlug: string, currentRestaurantId: string) {
  const adminDb = getAdminDb();
  const baseSlug = normalizeSlug(desiredSlug);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const snapshot = await adminDb.collection("restaurants").where("slug", "==", candidate).limit(10).get();
    const hasConflict = snapshot.docs.some(docSnap => docSnap.id !== currentRestaurantId);
    if (!hasConflict) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function syncMenuSubcollections(restaurantId: string, menuId: string, categories: MenuCategory[]) {
  const adminDb = getAdminDb();
  const menuRef = adminDb.collection("restaurants").doc(restaurantId).collection("menus").doc(menuId);
  const categoriesColl = menuRef.collection("categories");
  const itemsColl = menuRef.collection("items");
  const [existingCategories, existingItems] = await Promise.all([categoriesColl.get(), itemsColl.get()]);
  const batch = adminDb.batch();

  existingCategories.docs.forEach(docSnap => batch.delete(docSnap.ref));
  existingItems.docs.forEach(docSnap => batch.delete(docSnap.ref));

  categories.forEach((category, catIndex) => {
    const catId = category.id || `cat_${catIndex}`;
    batch.set(categoriesColl.doc(catId), {
      name: category.name || "",
      description: category.description || "",
      sortOrder: category.sortOrder ?? catIndex,
      isActive: category.isActive !== false,
    });

    (category.items || []).forEach((item, itemIndex) => {
      const itemId = item.id || `item_${catIndex}_${itemIndex}`;
      batch.set(itemsColl.doc(itemId), {
        categoryId: catId,
        name: item.name || "",
        description: item.description || "",
        price: Number(item.price) || 0,
        priceLabel: item.priceLabel || "",
        priceOptions: item.priceOptions || [],
        variants: item.variants || [],
        confidence: item.confidence || "high",
        subcategory: item.subcategory || null,
        dietaryTag: item.dietaryTag || null,
        specialTag: item.specialTag || null,
        type: item.type || item.dietaryTag || "unknown",
        imageUrl: item.imageUrl || item.image || "",
        isAvailable: item.isAvailable !== false,
        isVeg: item.type === "veg" || item.type === "vegan" || item.dietaryTag === "veg" || item.dietaryTag === "vegan",
        isFeatured: item.isFeatured || item.isPopular || false,
        isPopular: item.isPopular || false,
        spiceLevel: item.spiceLevel ?? null,
        allergens: item.allergens || [],
        tags: item.tags || [],
        sortOrder: item.sortOrder ?? itemIndex,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  });

  await batch.commit();
}

function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unknown server error.";
  console.error("Dashboard data API error:", error);
  return NextResponse.json({ error: `Dashboard data request failed: ${message}` }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const body = await request.json();
    const action = String(body.action || "");
    const restaurantId = String(body.restaurantId || "");
    const adminDb = getAdminDb();

    if (!action) throw new ApiError(400, "Missing dashboard data action.");

    if (action === "getQrCode") {
      const qrId = String(body.qrId || "");
      const qrSnap = await adminDb.collection("qrs").doc(qrId).get();
      if (!qrSnap.exists) return NextResponse.json({ data: null });
      const qrData = { id: qrSnap.id, ...qrSnap.data() } as any;
      await requireRestaurantAccess(qrData.restaurantId, uid);
      return NextResponse.json({ data: serializeFirestoreValue(qrData) });
    }

    if (!restaurantId) throw new ApiError(400, "Missing restaurantId.");

    const readOnlyActions = new Set(["getUploads", "getMenus", "getMenu", "getRestaurantQrs", "getScanLogs"]);
    const allowedRoles = readOnlyActions.has(action)
      ? ["owner", "admin", "editor", "viewer"] as const
      : ["owner", "admin", "editor"] as const;
    const { restaurant, restaurantRef } = await requireRestaurantAccess(restaurantId, uid, [...allowedRoles]);

    if (action === "addUpload") {
      const uploadData = body.uploadData || {};
      const docRef = restaurantRef.collection("uploads").doc();
      const data = {
        ...uploadData,
        restaurantId,
        extractionStatus: "pending",
        createdAt: FieldValue.serverTimestamp(),
      };
      await docRef.set(data);
      return NextResponse.json({ data: { id: docRef.id, ...uploadData, restaurantId, extractionStatus: "pending" } });
    }

    if (action === "getUploads") {
      const snapshot = await restaurantRef.collection("uploads").get();
      const uploads = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a: any, b: any) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
      return NextResponse.json({ data: serializeFirestoreValue(uploads) });
    }

    if (action === "updateUploadStatus") {
      const uploadId = String(body.uploadId || "");
      const updateData: Record<string, any> = {
        extractionStatus: body.status,
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (body.extractedJson !== undefined) updateData.extractedJson = body.extractedJson;
      await restaurantRef.collection("uploads").doc(uploadId).set(updateData, { merge: true });
      return NextResponse.json({ data: { id: uploadId } });
    }

    if (action === "createMenu") {
      const docRef = restaurantRef.collection("menus").doc();
      await docRef.set({
        name: String(body.name || "Menu"),
        status: "draft",
        version: 1,
        categories: [],
        theme: DEFAULT_THEME,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ data: { id: docRef.id } });
    }

    if (action === "getMenus") {
      const snapshot = await restaurantRef.collection("menus").get();
      const menus = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Menu))
        .sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt));
      return NextResponse.json({ data: serializeFirestoreValue(menus) });
    }

    if (action === "getMenu") {
      const menuId = String(body.menuId || "");
      const docSnap = await restaurantRef.collection("menus").doc(menuId).get();
      return NextResponse.json({ data: docSnap.exists ? serializeFirestoreValue({ id: docSnap.id, ...docSnap.data() }) : null });
    }

    if (action === "saveMenu") {
      const menuId = String(body.menuId || "");
      const menuData = body.menuData || {};
      await restaurantRef.collection("menus").doc(menuId).set({
        ...menuData,
        restaurantId,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (Array.isArray(menuData.categories)) {
        await syncMenuSubcollections(restaurantId, menuId, menuData.categories);
      }
      return NextResponse.json({ data: { id: menuId } });
    }

    if (action === "publishMenu") {
      const menuId = String(body.menuId || "");
      const slug = await getUniqueRestaurantSlug(restaurant.slug || restaurant.name, restaurantId);
      const batch = adminDb.batch();
      batch.update(restaurantRef.collection("menus").doc(menuId), {
        status: "published",
        publishedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(restaurantRef, {
        slug,
        status: "published",
        activeMenuId: menuId,
        currentPublishedMenuId: menuId,
        updatedAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ data: { id: menuId, slug } });
    }

    if (action === "createQrCode") {
      const docRef = adminDb.collection("qrs").doc();
      const data = {
        restaurantId,
        name: String(body.name || "Table"),
        scanCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      };
      await docRef.set(data);
      return NextResponse.json({ data: { id: docRef.id, ...data, createdAt: { seconds: Math.floor(Date.now() / 1000) } } });
    }

    if (action === "getRestaurantQrs") {
      const snapshot = await adminDb.collection("qrs").where("restaurantId", "==", restaurantId).get();
      const qrs = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a: any, b: any) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
      return NextResponse.json({ data: serializeFirestoreValue(qrs) });
    }

    if (action === "recordQrScan") {
      const qrId = String(body.qrId || "");
      const batch = adminDb.batch();
      batch.update(adminDb.collection("qrs").doc(qrId), { scanCount: FieldValue.increment(1) });
      batch.set(restaurantRef.collection("scans").doc(), {
        qrId,
        timestamp: FieldValue.serverTimestamp(),
        userAgent: body.metadata?.userAgent || "Unknown",
        referer: body.metadata?.referer || "Direct",
      });
      await batch.commit();
      return NextResponse.json({ data: { id: qrId } });
    }

    if (action === "getScanLogs") {
      const limitCount = Number(body.limitCount) || 100;
      const snapshot = await restaurantRef.collection("scans").get();
      const scans = snapshot.docs
        .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
        .sort((a: any, b: any) => timestampToMillis(b.timestamp) - timestampToMillis(a.timestamp))
        .slice(0, limitCount);
      return NextResponse.json({ data: serializeFirestoreValue(scans) });
    }

    throw new ApiError(400, `Unsupported dashboard data action: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}
