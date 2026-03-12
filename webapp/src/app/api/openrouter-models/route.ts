import { NextRequest, NextResponse } from "next/server";
import { fetchOpenRouterModels } from "@/lib/openrouter";

/**
 * GET /api/openrouter-models — Fetch available models from OpenRouter.
 * Optional: pass API key via header for authenticated access.
 */
export async function GET(request: NextRequest) {
  try {
    // Get API key from header or server env
    const apiKey = request.headers.get("x-openrouter-key") || process.env.OPENROUTER_API_KEY;

    const models = await fetchOpenRouterModels(apiKey || undefined);

    // Transform to simplified format for UI with capability badges
    const modelList = models.map((m) => {
      const inputMods = m.architecture?.input_modalities || [];
      const promptCost = parseFloat(m.pricing.prompt) * 1_000_000;
      const completionCost = parseFloat(m.pricing.completion) * 1_000_000;
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
        pricing: { prompt: parseFloat(m.pricing.prompt), completion: parseFloat(m.pricing.completion) },
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
      { error: err instanceof Error ? err.message : "Failed to fetch models" },
      { status: 500 }
    );
  }
}

