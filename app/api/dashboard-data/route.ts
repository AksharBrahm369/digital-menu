import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import * as db from "@/lib/firebase/db";

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
  if (!token) throw new ApiError(401, "Missing authentication token.");

  const supabaseAdmin = getSupabaseAdmin();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !user) {
    console.error("Dashboard Token verification failed:", error);
    throw new ApiError(401, `Authentication failed: ${error?.message || "Invalid token"}`);
  }

  return user.id;
}

async function requireRestaurantAccess(
  restaurantId: string,
  uid: string,
  allowedRoles: Array<"owner" | "admin" | "editor" | "viewer"> = ["owner", "admin", "editor", "viewer"]
) {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: restaurant, error: restErr } = await supabaseAdmin
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .maybeSingle();

  if (restErr) throw restErr;
  if (!restaurant) throw new ApiError(404, "Restaurant not found.");

  if (restaurant.owner_id === uid && allowedRoles.includes("owner")) {
    return restaurant;
  }

  const { data: member, error: memberErr } = await supabaseAdmin
    .from("restaurant_members")
    .select("role")
    .eq("restaurant_id", restaurantId)
    .eq("uid", uid)
    .maybeSingle();

  if (memberErr) throw memberErr;
  const role = member?.role;
  
  if (member && allowedRoles.includes(role as any)) {
    return restaurant;
  }

  throw new ApiError(403, "You do not have access to this restaurant.");
}

function handleApiError(error: any) {
  let details = "Unknown server error.";
  if (error instanceof Error) {
    details = error.message;
  } else if (error && typeof error === "object") {
    details = error.message || error.details || JSON.stringify(error);
  }

  if (error instanceof ApiError) {
    const code =
      error.status === 401
        ? "UNAUTHENTICATED"
        : error.status === 403
          ? "FORBIDDEN"
          : "DASHBOARD_DATA_ERROR";
    console.error("[api/dashboard-data] Request failed:", { status: error.status, details: error.message });
    return NextResponse.json({ error: "Dashboard data request failed", details: error.message, code }, { status: error.status });
  }

  console.error("[api/dashboard-data] Critical error:", error);
  return NextResponse.json({ error: "Dashboard data request failed", details, code: "DASHBOARD_DATA_ERROR" }, { status: 500 });
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST for dashboard data requests.", code: "METHOD_NOT_ALLOWED" },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const uid = await requireAuthenticatedUid(request);
    const body = await request.json();
    const action = String(body.action || "");
    const restaurantId = String(body.restaurantId || "");

    if (!action) throw new ApiError(400, "Missing dashboard data action.");

    if (action === "getQrCode") {
      const qrId = String(body.qrId || "");
      const qrData = await db.getQrCode(qrId);
      if (!qrData) return NextResponse.json({ data: null });
      await requireRestaurantAccess(qrData.restaurantId, uid);
      return NextResponse.json({ data: qrData });
    }

    if (!restaurantId) throw new ApiError(400, "Missing restaurantId.");

    const readOnlyActions = new Set(["getUploads", "getMenus", "getMenu", "getRestaurantQrs", "getScanLogs"]);
    const allowedRoles = readOnlyActions.has(action)
      ? ["owner", "admin", "editor", "viewer"] as const
      : ["owner", "admin", "editor"] as const;
    await requireRestaurantAccess(restaurantId, uid, [...allowedRoles]);

    if (action === "addUpload") {
      const result = await db.addUpload(restaurantId, body.uploadData || {});
      return NextResponse.json({ data: result });
    }

    if (action === "getUploads") {
      const result = await db.getUploads(restaurantId);
      return NextResponse.json({ data: result });
    }

    if (action === "updateUploadStatus") {
      await db.updateUploadStatus(restaurantId, String(body.uploadId || ""), body.status, body.extractedJson);
      return NextResponse.json({ data: { id: body.uploadId } });
    }

    if (action === "createMenu") {
      const menuId = await db.createMenu(restaurantId, String(body.name || "Menu"));
      return NextResponse.json({ data: { id: menuId } });
    }

    if (action === "getMenus") {
      const result = await db.getMenus(restaurantId);
      return NextResponse.json({ data: result });
    }

    if (action === "getMenu") {
      const result = await db.getMenu(restaurantId, String(body.menuId || ""));
      return NextResponse.json({ data: result });
    }

    if (action === "saveMenu") {
      await db.saveMenu(restaurantId, String(body.menuId || ""), body.menuData || {});
      return NextResponse.json({ data: { id: body.menuId } });
    }

    if (action === "publishMenu") {
      const menuId = String(body.menuId || "");
      await db.publishMenu(restaurantId, menuId);
      
      const rest = await db.getRestaurant(restaurantId);
      return NextResponse.json({ data: { id: menuId, slug: rest?.slug } });
    }

    if (action === "createQrCode") {
      const result = await db.createQrCode(restaurantId, String(body.name || "Table"));
      return NextResponse.json({ data: result });
    }

    if (action === "getRestaurantQrs") {
      const result = await db.getRestaurantQrs(restaurantId);
      return NextResponse.json({ data: result });
    }

    if (action === "recordQrScan") {
      await db.recordQrScan(String(body.qrId || ""), restaurantId, body.metadata || {});
      return NextResponse.json({ data: { id: body.qrId } });
    }

    if (action === "getScanLogs") {
      const limitCount = Number(body.limitCount) || 100;
      const result = await db.getScanLogs(restaurantId, limitCount);
      return NextResponse.json({ data: result });
    }

    throw new ApiError(400, `Unsupported dashboard data action: ${action}`);
  } catch (error) {
    return handleApiError(error);
  }
}
