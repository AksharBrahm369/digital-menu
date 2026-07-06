import { NextRequest, NextResponse } from "next/server";
import { FieldValue, getAdminAuth, getAdminDb, getFirebaseAdminConfigProblem } from "@/lib/firebase-admin";
import type { Restaurant } from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || "";
}

async function requireAuthenticatedUid(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    throw new ApiError(401, "Missing Firebase authentication token.");
  }

  const configProblem = getFirebaseAdminConfigProblem();
  if (configProblem) {
    console.error("Restaurant API Firebase Admin configuration error:", configProblem);
    throw new ApiError(500, configProblem);
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return decoded.uid;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown token verification error.";
    console.error("Restaurant API token verification failed:", error);
    throw new ApiError(
      401,
      `Firebase token verification failed: ${message}. Make sure NEXT_PUBLIC_FIREBASE_PROJECT_ID and FIREBASE_PROJECT_ID are the same project, then sign out and sign in again.`
    );
  }
}

function timestampToMillis(value: any) {
  if (!value) return 0;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  return 0;
}

function sortRestaurants(restaurants: Restaurant[]) {
  return [...restaurants].sort((a, b) => timestampToMillis(b.updatedAt) - timestampToMillis(a.updatedAt));
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

async function getUniqueRestaurantSlug(desiredSlug: string, currentRestaurantId?: string) {
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

function handleApiError(error: unknown, publicMessage: string) {
  const details = error instanceof Error ? error.message : "Unknown server error.";

  if (error instanceof ApiError) {
    console.error(`${publicMessage}:`, { status: error.status, details });
    const code =
      error.status === 401
        ? "UNAUTHENTICATED"
        : error.status === 403
          ? "FORBIDDEN"
          : error.status === 500 && details.toLowerCase().includes("firebase")
            ? "FIREBASE_ADMIN_CONFIG_ERROR"
            : "RESTAURANT_API_ERROR";
    return NextResponse.json({ error: publicMessage, details, code }, { status: error.status });
  }

  console.error("Restaurant API error:", error);
  return NextResponse.json({ error: publicMessage, details, code: "RESTAURANT_API_ERROR" }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("id");

    if (restaurantId) {
      const docSnap = await adminDb.collection("restaurants").doc(restaurantId).get();
      if (!docSnap.exists) {
        return NextResponse.json({ data: null }, { status: 404 });
      }

      const restaurant = { id: docSnap.id, ...docSnap.data() } as Restaurant;
      if (restaurant.ownerId !== uid) {
        throw new ApiError(403, "You do not have access to this restaurant.");
      }

      return NextResponse.json({ data: restaurant });
    }

    const snapshot = await adminDb.collection("restaurants").where("ownerId", "==", uid).get();
    const restaurants = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Restaurant));
    return NextResponse.json({ data: sortRestaurants(restaurants) });
  } catch (error) {
    return handleApiError(error, "Could not load restaurants");
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const adminDb = getAdminDb();
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      throw new ApiError(400, "Restaurant name is required.");
    }

    const restaurantsColl = adminDb.collection("restaurants");
    const restaurantId =
      typeof body.id === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(body.id)
        ? body.id
        : restaurantsColl.doc().id;
    const slug = await getUniqueRestaurantSlug(String(body.slug || name), restaurantId);

    const restaurantData = {
      name,
      slug,
      ownerId: uid,
      logoUrl: String(body.logoUrl || ""),
      cuisine: String(body.cuisine || ""),
      currency: String(body.currency || "USD"),
      phone: String(body.phone || ""),
      whatsapp: String(body.whatsapp || ""),
      address: String(body.address || ""),
      status: "active" as const,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const memberData = {
      uid,
      role: "owner" as const,
      invitedAt: FieldValue.serverTimestamp(),
      joinedAt: FieldValue.serverTimestamp(),
    };

    const batch = adminDb.batch();
    const restaurantRef = restaurantsColl.doc(restaurantId);
    batch.set(restaurantRef, restaurantData);
    batch.set(restaurantRef.collection("members").doc(uid), memberData);
    await batch.commit();

    const nowSeconds = Math.floor(Date.now() / 1000);
    return NextResponse.json({
      data: {
        id: restaurantId,
        ...restaurantData,
        createdAt: { seconds: nowSeconds },
        updatedAt: { seconds: nowSeconds },
      },
    });
  } catch (error) {
    return handleApiError(error, "Could not create restaurant");
  }
}
