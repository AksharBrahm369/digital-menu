import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/firebase/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qrId: string }> }
) {
  try {
    const { qrId } = await params;

    // 1. Look up the QR Code metadata
    const qrData = await db.getQrCode(qrId);

    if (!qrData || !qrData.restaurantId) {
      console.warn(`Scan redirect warning: QR Code ${qrId} not found in database.`);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const { restaurantId, name: tableName } = qrData;

    // 2. Fetch the corresponding Restaurant profile
    const restData = await db.getRestaurant(restaurantId);
    const isPublicRestaurant = restData?.status === "active" || restData?.status === "published";
    if (!restData || !isPublicRestaurant || !restData.slug) {
      console.warn(`Scan redirect warning: Restaurant profile is inactive or missing slug.`);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const slug = restData.slug;
    const userAgent = request.headers.get("user-agent") || "Unknown Device";
    const referer = request.headers.get("referer") || "Direct Scan";

    // 3. Increment scan counts and log history
    try {
      await db.recordQrScan(qrId, restaurantId, { userAgent, referer });
    } catch (writeError) {
      console.warn("Non-blocking warning: Failed to record QR scan analytics:", writeError);
    }

    // 4. Perform redirect redirecting to /m/[slug]?table=[tableName]
    const destinationUrl = new URL(`/m/${slug}`, request.url);
    destinationUrl.searchParams.set("table", tableName);
    
    return NextResponse.redirect(destinationUrl);
  } catch (error) {
    console.error("Critical error in QR scan redirect tracker:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
