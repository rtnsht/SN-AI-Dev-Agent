import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";
import { buildSetCookieHeader, createSession } from "@/lib/auth";
import { checkEmergencyLogin } from "@/lib/auth-rate-limiter";
import { getClientIp } from "@/lib/client-ip";
import { parseTokenBody } from "@/lib/request-validation";

function tokenMatches(providedToken: string, expectedToken: string): boolean {
  const providedDigest = crypto.createHash("sha256").update(providedToken).digest();
  const expectedDigest = crypto.createHash("sha256").update(expectedToken).digest();
  return crypto.timingSafeEqual(providedDigest, expectedDigest);
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(new URL("/auth/emergency-login", request.url));
}

export async function POST(request: NextRequest) {
  try {
    const expectedToken = process.env.ADMIN_EMERGENCY_TOKEN?.trim();
    const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();

    // Keep the break-glass path invisible unless explicitly configured.
    if (!expectedToken || !adminEmail) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const parsed = parseTokenBody(await request.json());
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const ip = getClientIp(request);
    const rateLimit = await checkEmergencyLogin(ip);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    if (!tokenMatches(parsed.data.token.trim(), expectedToken)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    const db = getSupabase();
    let { data: user, error } = await db
      .from("users")
      .select("id, email, name, role, status")
      .ilike("email", adminEmail)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to lookup admin user: ${error.message}`);
    }

    // Self-heal the admin account if the row is missing in the database.
    if (!user) {
      const fallbackName = adminEmail.split("@")[0] || "admin";
      const insertResult = await db
        .from("users")
        .insert({
          email: adminEmail,
          name: fallbackName,
          role: "admin",
          status: "active",
          password_hash: null,
          must_set_password: true,
        })
        .select("id, email, name, role, status")
        .single();

      user = insertResult.data;
      error = insertResult.error;

      if (error || !user) {
        throw new Error(`Failed to create admin user: ${error?.message || "unknown error"}`);
      }
    } else if (user.role !== "admin" || user.status !== "active") {
      const updateResult = await db
        .from("users")
        .update({ role: "admin", status: "active" })
        .eq("id", user.id)
        .select("id, email, name, role, status")
        .single();

      user = updateResult.data;
      error = updateResult.error;

      if (error || !user) {
        throw new Error(`Failed to restore admin access: ${error?.message || "unknown error"}`);
      }
    }

    const ua = request.headers.get("user-agent") || "";
    const { token: sessionToken, expiresAt } = await createSession(user.id, {
      ip,
      userAgent: ua,
      temporary: true,
    });

    const response = NextResponse.json({
      success: true,
      mustSetPassword: true,
      redirect: "/auth/set-password",
    });
    response.headers.set("Set-Cookie", buildSetCookieHeader(sessionToken, expiresAt));
    return response;
  } catch (err) {
    console.error("[auth/emergency-login] Error:", err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
}
