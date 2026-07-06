import { NextResponse } from "next/server";
import { getAdminDb, getFirebaseAdminConfigProblem, getFirebaseAdminEnvStatus } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const checks = getFirebaseAdminEnvStatus();
  const configProblem = getFirebaseAdminConfigProblem();

  if (configProblem) {
    console.error("Firebase health check configuration error:", configProblem);
    return NextResponse.json(
      {
        ok: false,
        error: "Firebase Admin is not configured.",
        details: configProblem,
        code: "FIREBASE_ADMIN_CONFIG_ERROR",
        checks,
      },
      { status: 500 }
    );
  }

  try {
    await getAdminDb().collection("restaurants").limit(1).get();
    return NextResponse.json({
      ok: true,
      message: "Firebase Admin can connect to Firestore.",
      checks,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown Firestore Admin error.";
    console.error("Firebase health check Firestore error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Firebase Admin could not read Firestore.",
        details,
        code: "FIRESTORE_UNREACHABLE",
        checks,
      },
      { status: 500 }
    );
  }
}
