import { NextRequest } from "next/server";

function normalizeIp(value: string | null | undefined): string | null {
  if (!value) return null;
  const ip = value.trim();
  if (!ip) return null;
  // Keep validation permissive to avoid false negatives for IPv6 variants.
  if (/^[0-9a-fA-F:.]+$/.test(ip)) return ip;
  return null;
}

export function getClientIp(request: NextRequest): string {
  const realIp = normalizeIp(request.headers.get("x-real-ip"));
  if (realIp) return realIp;

  const trustForwardedFor = process.env.TRUST_X_FORWARDED_FOR !== "false";
  if (trustForwardedFor) {
    const forwarded = request.headers.get("x-forwarded-for");
    const firstHop = forwarded?.split(",")[0] ?? null;
    const forwardedIp = normalizeIp(firstHop);
    if (forwardedIp) return forwardedIp;
  }

  return "unknown";
}
