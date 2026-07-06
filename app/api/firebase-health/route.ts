import { NextResponse } from "next/server";
import { getAdminDb, getFirebaseAdminConfigProblem } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

function present(value?: string) {
  return Boolean(value && value.trim());
}

export async function GET() {
  const configProblem = getFirebaseAdminConfigProblem();
  const checks = {
    publicProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    adminProjectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    hasPublicApiKey: present(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    hasClientEmail: present(process.env.FIREBASE_CLIENT_EMAIL),
    hasPrivateKey: present(process.env.FIREBASE_PRIVATE_KEY) || present(process.env.FIREBASE_SERVICE_ACCOUNT_KEY) || present(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    mockDatabase: process.env.NEXT_PUBLIC_MOCK_DATABASE || "",
  };

  if (configProblem) {
    return NextResponse.json({
      ok: false,
      error: configProblem,
      checks,
    }, { status: 500 });
  }

  try {
    await getAdminDb().collection("restaurants").limit(1).get();
    return NextResponse.json({
      ok: true,
      message: "Firebase Admin can connect to Firestore.",
      checks,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Firestore Admin error.";
    return NextResponse.json({
      ok: false,
      error: `Firebase Admin could not read Firestore: ${message}`,
      checks,
    }, { status: 500 });
  }
}
