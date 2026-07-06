import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getFirebaseAdminConfigProblem } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isMockSessionAllowed() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_MOCK_DATABASE === "true";
}

export async function GET() {
  return NextResponse.json(
    { error: "Use POST to create or clear an auth session.", code: "METHOD_NOT_ALLOWED" },
    { status: 405 }
  );
}

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json().catch(() => ({ token: null }));
    const cookieStore = await cookies();

    if (!token) {
      cookieStore.delete("session");
      return NextResponse.json({ status: "success", message: "Session cleared" });
    }

    // Bypass verification only for local mock users.
    const isMockToken = typeof token === "string" && token.startsWith("mock_token_");

    if (isMockToken) {
      if (!isMockSessionAllowed()) {
        return NextResponse.json(
          { error: "Mock auth sessions are disabled in production.", code: "MOCK_AUTH_DISABLED" },
          { status: 401 }
        );
      }

      const mockUid = token.replace("mock_token_", "");
      
      cookieStore.set("session", `mock_session_${mockUid}`, {
        maxAge: 5 * 24 * 60 * 60, // 5 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
      });

      return NextResponse.json({ status: "success", uid: mockUid, mock: true });
    }

    const configProblem = getFirebaseAdminConfigProblem();
    if (configProblem) {
      console.error("Auth session Firebase Admin configuration error:", configProblem);
      return NextResponse.json(
        { error: "Firebase Admin is not configured.", details: configProblem, code: "FIREBASE_ADMIN_CONFIG_ERROR" },
        { status: 500 }
      );
    }

    // Verify the ID token passed from client
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);

    // Create session cookie (5 days expiry)
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await adminAuth.createSessionCookie(token, { expiresIn });

    cookieStore.set("session", sessionCookie, {
      maxAge: 5 * 24 * 60 * 60, // 5 days in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ status: "success", uid: decodedToken.uid });
  } catch (error) {
    console.error("Authentication session endpoint error:", error);
    const details = error instanceof Error ? error.message : "Unknown authentication error.";
    const isConfigError =
      details.includes("Missing Firebase Admin env vars") ||
      details.includes("not configured") ||
      details.includes("initialization failed") ||
      details.includes("could not be parsed") ||
      details.includes("Missing FIREBASE_PROJECT_ID") ||
      details.includes("Missing FIREBASE_CLIENT_EMAIL") ||
      details.includes("Missing FIREBASE_PRIVATE_KEY");
    if (isConfigError) {
      return NextResponse.json(
        { error: "Firebase Admin is not configured.", details, code: "FIREBASE_ADMIN_CONFIG_ERROR" },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Authentication failed", details, code: "AUTH_SESSION_FAILED" }, { status: 401 });
  }
}
