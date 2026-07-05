import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    const cookieStore = await cookies();

    if (!token) {
      cookieStore.delete("session");
      return NextResponse.json({ status: "success", message: "Session cleared" });
    }

    // Bypass verification if it's a mock token or server-side keys are missing
    const isMockToken = typeof token === "string" && token.startsWith("mock_token_");
    const hasAdminCredentials = !!process.env.FIREBASE_PRIVATE_KEY && !!process.env.FIREBASE_CLIENT_EMAIL;

    if (isMockToken || !hasAdminCredentials) {
      const mockUid = isMockToken ? token.replace("mock_token_", "") : "mock_user_123";
      
      cookieStore.set("session", `mock_session_${mockUid}`, {
        maxAge: 5 * 24 * 60 * 60, // 5 days
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
      });

      return NextResponse.json({ status: "success", uid: mockUid, mock: true });
    }

    // Verify the ID token passed from client
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
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
