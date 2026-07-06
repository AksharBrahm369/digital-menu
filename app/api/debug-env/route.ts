import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    mockDatabase: process.env.NEXT_PUBLIC_MOCK_DATABASE ?? null,
    hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasFirebaseClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasFirebasePrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    hasFirebasePrivateKeyBase64: Boolean(process.env.FIREBASE_PRIVATE_KEY_BASE64),
    hasPublicApiKey: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    hasPublicProjectId: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
  });
}
