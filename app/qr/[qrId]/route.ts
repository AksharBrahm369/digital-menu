import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ qrId: string }> }
) {
  try {
    const { qrId } = await params;

    // 1. Look up the QR Code metadata document from top-level 'qrs' collection
    const qrDocRef = adminDb.collection("qrs").doc(qrId);
    const qrDoc = await qrDocRef.get();

    if (!qrDoc.exists) {
      console.warn(`Scan redirect warning: QR Code ${qrId} not found in database.`);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const qrData = qrDoc.data();
    if (!qrData || !qrData.restaurantId) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const { restaurantId, name: tableName } = qrData;

    // 2. Fetch the corresponding Restaurant profile to acquire its URL slug
    const restDoc = await adminDb.collection("restaurants").doc(restaurantId).get();
    if (!restDoc.exists) {
      console.warn(`Scan redirect warning: Restaurant ${restaurantId} not found.`);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const restData = restDoc.data();
    const isPublicRestaurant = restData?.status === "active" || restData?.status === "published";
    if (!restData || !isPublicRestaurant || !restData.slug) {
      console.warn(`Scan redirect warning: Restaurant profile is inactive or missing slug.`);
      return NextResponse.redirect(new URL("/", request.url));
    }

    const slug = restData.slug;
    const userAgent = request.headers.get("user-agent") || "Unknown Device";
    const referer = request.headers.get("referer") || "Direct Scan";

    // 3. Increment scan counts and log history atomically using a batch write
    const batch = adminDb.batch();
    
    // Increment scan count on QR placard
    batch.update(qrDocRef, {
      scanCount: FieldValue.increment(1),
    });

    // Write scan log to subcollection restaurants/{restaurantId}/scans
    const scanLogRef = adminDb.collection("restaurants").doc(restaurantId).collection("scans").doc();
    batch.set(scanLogRef, {
      qrId,
      timestamp: FieldValue.serverTimestamp(),
      userAgent,
      referer,
    });

    await batch.commit();

    // 4. Perform redirect redirecting to /m/[slug]?table=[tableName]
    const destinationUrl = new URL(`/m/${slug}`, request.url);
    destinationUrl.searchParams.set("table", tableName);
    
    return NextResponse.redirect(destinationUrl);
  } catch (error) {
    console.error("Critical error in QR scan redirect tracker:", error);
    // Fallback: send the customer to the home page to avoid raw 500 error screen
    return NextResponse.redirect(new URL("/", request.url));
  }
}
