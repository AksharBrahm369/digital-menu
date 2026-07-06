import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseAdmin } from "@/lib/supabase";

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

    // Verify the Supabase token passed from client
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error: verifyError } = await supabaseAdmin.auth.getUser(token);

    if (verifyError || !user) {
      console.error("[api/auth/session] Token verification failed:", verifyError);
      return NextResponse.json(
        { error: "Authentication failed", details: verifyError?.message || "Invalid token", code: "AUTH_SESSION_FAILED" },
        { status: 401 }
      );
    }

    cookieStore.set("session", token, {
      maxAge: 5 * 24 * 60 * 60, // 5 days in seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return NextResponse.json({ status: "success", uid: user.id });
  } catch (error) {
    console.error("[api/auth/session] Authentication session endpoint error:", error);
    const details = error instanceof Error ? error.message : "Unknown authentication error.";
    return NextResponse.json({ error: "Authentication failed", details, code: "AUTH_SESSION_FAILED" }, { status: 401 });
  }
}
