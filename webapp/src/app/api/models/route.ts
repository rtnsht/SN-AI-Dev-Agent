import { NextRequest, NextResponse } from "next/server";
import { loadModelCatalog } from "@/lib/model-platform";
import { requireUserSession } from "@/lib/session-auth";

export async function GET(req: NextRequest) {
  const auth = await requireUserSession(req);
  if (!auth.ok) return auth.response;

  const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
  const catalog = await loadModelCatalog(auth.session.user.id, allowUserKeys);
  return NextResponse.json(catalog);
}
