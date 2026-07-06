import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminAuth, getFirebaseAdminConfigProblem } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    const cookieStore = await cookies();

    if (!token) {
      cookieStore.delete("session");
      return NextResponse.json({ status: "success", message: "Session cleared" });
    }

    // Bypass verification only for local mock users.
    const isMockToken = typeof token === "string" && token.startsWith("mock_token_");

    if (isMockToken) {
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
      return NextResponse.json({ error: configProblem }, { status: 500 });
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
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
