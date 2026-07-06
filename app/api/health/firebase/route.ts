import { NextResponse } from "next/server";
import { getAdminDb, getFirebaseAdminApp, getFirebaseAdminEnvStatus } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let envPresent = false;
  let adminInitOk = false;
  let firestorePingOk = false;
  let errorMsg = null;
  let checks: any = null;

  try {
    checks = getFirebaseAdminEnvStatus();
    envPresent = Boolean(
      checks.hasFirebaseProjectId &&
      checks.hasFirebaseClientEmail &&
      checks.hasFirebasePrivateKey
    );

    // Try app initialization
    try {
      getFirebaseAdminApp();
      adminInitOk = true;
    } catch (e: any) {
      errorMsg = e.message || "Admin init failed";
    }

    // Try Firestore ping if init succeeded
    if (adminInitOk) {
      try {
        await getAdminDb().collection("restaurants").limit(1).get();
        firestorePingOk = true;
      } catch (e: any) {
        errorMsg = e.message || "Firestore ping failed";
      }
    }
  } catch (globalError: any) {
    errorMsg = globalError.message || "Global health check error";
  }

  const status = (envPresent && adminInitOk && firestorePingOk) ? 200 : 500;

  return NextResponse.json(
    {
      ok: status === 200,
      envPresent,
      adminInitOk,
      firestorePingOk,
      error: errorMsg,
      checks,
    },
    { status }
  );
}
