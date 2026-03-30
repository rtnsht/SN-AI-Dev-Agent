import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth";
import { fetchOpenRouterModels } from "@/lib/openrouter";
import { resolveProviderApiKey } from "@/lib/model-platform";
import { touchUserApiKey } from "@/lib/user-api-keys";

/**
 * GET /api/openrouter-models — Fetch available models from OpenRouter.
 * Optional: pass API key via header for authenticated access.
 */
export async function GET(request: NextRequest) {
  try {
    const allowUserKeys = process.env.ALLOW_USER_API_KEYS !== "false";
    const headerKey = request.headers.get("x-openrouter-key") || "";
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    let userId: string | undefined;

    if (sessionToken) {
      const session = await validateSession(sessionToken);
      if (session && !session.is_temporary) {
        userId = session.user.id;
      }
    }

    const resolved = await resolveProviderApiKey({
      userId,
      sessionId: "openrouter-models",
      transport: "openrouter",
      inlineUserKey: headerKey,
      allowUserKeys,
    });
    const apiKey = resolved?.apiKey || "";

    const models = await fetchOpenRouterModels(apiKey || undefined);

    if (resolved?.storedKeyId) {
      void touchUserApiKey(resolved.storedKeyId);
    }

    // Transform to simplified format for UI with capability badges
    const modelList = models.map((m) => {
      const inputMods = m.architecture?.input_modalities || [];
      const promptCost = parseFloat(m.pricing?.prompt ?? "0") * 1_000_000;
      const completionCost = parseFloat(m.pricing?.completion ?? "0") * 1_000_000;
      const priceStr = promptCost > 0 || completionCost > 0
        ? `$${promptCost.toFixed(2)}/$${completionCost.toFixed(2)}/1M`
        : "Free";
      const contextStr = `${Math.round(m.context_length / 1000)}K ctx`;

      // Build capability tags
      const caps: string[] = [];
      if (inputMods.includes("image")) caps.push("vision");
      if (inputMods.includes("file")) caps.push("files");
      if (inputMods.includes("audio")) caps.push("audio");
      if (inputMods.includes("video")) caps.push("video");

      return {
        id: m.id,
        name: m.name,
        contextLength: m.context_length,
        pricing: { prompt: parseFloat(m.pricing?.prompt ?? "0"), completion: parseFloat(m.pricing?.completion ?? "0") },
        summary: `${priceStr} | ${contextStr}${caps.length ? " | " + caps.join(", ") : ""}`,
      };
    });

    return NextResponse.json({
      models: modelList,
      count: modelList.length,
    });
  } catch (err) {
    console.error("[openrouter-models] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch models" },
      { status: 500 }
    );
  }
}

