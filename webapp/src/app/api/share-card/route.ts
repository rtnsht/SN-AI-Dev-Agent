/**
 * GET /api/share-card  (DEPRECATED)
 *
 * This route previously generated OG share card PNGs via next/og ImageResponse (Satori).
 * It has been replaced by POST /api/share-image which uses AI image generation.
 *
 * Returns 410 Gone so clients know to use the new endpoint.
 */

export async function GET() {
  return new Response(
    "This endpoint has been replaced by POST /api/share-image. Use the new /share command or share modal.",
    { status: 410 },
  );
}
