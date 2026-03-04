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

    // Transform to simplified format for UI
    const modelList = models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description || "",
      contextLength: m.context_length,
      pricing: {
        prompt: parseFloat(m.pricing.prompt),
        completion: parseFloat(m.pricing.completion),
      },
      supportsTools: m.supported_parameters?.includes("tools") || false,
    }));

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

