import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

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
    throw new ApiError(401, "Missing authentication token.");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    console.error("Token verification failed:", error);
    throw new ApiError(401, `Authentication failed: ${error?.message || "Invalid token"}`);
  }

  return user.id;
}

function timestampToMillis(value: any) {
  if (!value) return 0;
  if (typeof value === "string") return new Date(value).getTime();
  if (value instanceof Date) return value.getTime();
  return 0;
}

function sortRestaurants(restaurants: any[]) {
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
  const supabaseAdmin = getSupabaseAdmin();
  const baseSlug = normalizeSlug(desiredSlug);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("restaurants")
      .select("id")
      .eq("slug", candidate)
      .limit(10);

    const hasConflict = (data || []).some((rest: any) => rest.id !== currentRestaurantId);
    if (!hasConflict) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function handleApiError(error: unknown, publicMessage: string) {
  try {
    const details = error instanceof Error ? error.message : "Unknown server error.";

    if (error instanceof ApiError) {
      console.error(`${publicMessage}:`, { status: error.status, details });
      const code =
        error.status === 401
          ? "UNAUTHENTICATED"
          : error.status === 403
            ? "FORBIDDEN"
            : "RESTAURANT_API_ERROR";
      return NextResponse.json({ error: publicMessage, details, code }, { status: error.status });
    }

    console.error("Restaurant API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        details,
      },
      { status: 500 }
    );
  } catch (innerError) {
    console.error("Critical failure in handleApiError:", innerError);
    return NextResponse.json(
      {
        error: "Internal server error",
        code: "INTERNAL_SERVER_ERROR",
        details: innerError instanceof Error ? innerError.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const supabaseAdmin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const restaurantId = searchParams.get("id");

    if (restaurantId) {
      const { data: restaurant, error } = await supabaseAdmin
        .from("restaurants")
        .select("*")
        .eq("id", restaurantId)
        .maybeSingle();

      if (error) throw error;
      if (!restaurant) {
        return NextResponse.json({ data: null }, { status: 404 });
      }

      if (restaurant.owner_id !== uid) {
        throw new ApiError(403, "You do not have access to this restaurant.");
      }

      return NextResponse.json({
        data: {
          id: restaurant.id,
          ownerId: restaurant.owner_id,
          name: restaurant.name,
          slug: restaurant.slug,
          logoUrl: restaurant.logo_url || "",
          cuisine: restaurant.cuisine || "",
          currency: restaurant.currency,
          phone: restaurant.phone || "",
          whatsapp: restaurant.whatsapp || "",
          address: restaurant.address || "",
          status: restaurant.status,
          activeMenuId: restaurant.active_menu_id,
          currentPublishedMenuId: restaurant.current_published_menu_id,
          createdAt: restaurant.created_at,
          updatedAt: restaurant.updated_at
        }
      });
    }

    const { data: restaurants, error } = await supabaseAdmin
      .from("restaurants")
      .select("*")
      .eq("owner_id", uid);

    if (error) throw error;

    const mapped = (restaurants || []).map((r: any) => ({
      id: r.id,
      ownerId: r.owner_id,
      name: r.name,
      slug: r.slug,
      logoUrl: r.logo_url || "",
      cuisine: r.cuisine || "",
      currency: r.currency,
      phone: r.phone || "",
      whatsapp: r.whatsapp || "",
      address: r.address || "",
      status: r.status as any,
      activeMenuId: r.active_menu_id,
      currentPublishedMenuId: r.current_published_menu_id,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));

    return NextResponse.json({ data: sortRestaurants(mapped) });
  } catch (error) {
    return handleApiError(error, "Could not load restaurants");
  }
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const supabaseAdmin = getSupabaseAdmin();
    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      throw new ApiError(400, "Restaurant name is required.");
    }

    // Generate a standard UUID if body.id is missing or is not a valid UUID format
    const isUuid = typeof body.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.id);
    const restaurantId = isUuid ? body.id : crypto.randomUUID();
    const slug = await getUniqueRestaurantSlug(String(body.slug || name), restaurantId);

    const restaurantData = {
      id: restaurantId,
      name,
      slug,
      owner_id: uid,
      logo_url: String(body.logoUrl || ""),
      cuisine: String(body.cuisine || ""),
      currency: String(body.currency || "USD"),
      phone: String(body.phone || ""),
      whatsapp: String(body.whatsapp || ""),
      address: String(body.address || ""),
      status: "active",
      updated_at: new Date().toISOString()
    };

    // Insert restaurant
    const { error: restErr } = await supabaseAdmin
      .from("restaurants")
      .insert(restaurantData);
    if (restErr) throw restErr;

    // Add owner to members
    const { error: memberErr } = await supabaseAdmin
      .from("restaurant_members")
      .insert({
        restaurant_id: restaurantId,
        uid,
        role: "owner"
      });
    if (memberErr) throw memberErr;

    return NextResponse.json({
      data: {
        id: restaurantId,
        ownerId: uid,
        name: restaurantData.name,
        slug: restaurantData.slug,
        logoUrl: restaurantData.logo_url,
        cuisine: restaurantData.cuisine,
        currency: restaurantData.currency,
        phone: restaurantData.phone,
        whatsapp: restaurantData.whatsapp,
        address: restaurantData.address,
        status: restaurantData.status,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "Could not create restaurant");
  }
}
