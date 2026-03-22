import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getLogStorageSync } from "@/lib/log-storage";

/**
 * GET /api/admin/log-storage
 *
 * Returns the current status of the log storage sync system,
 * including provider info, last scan results, and upload stats.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const sync = getLogStorageSync();
    if (!sync) {
      return NextResponse.json({
        enabled: false,
        message: "Log storage sync is disabled. Set LOG_STORAGE_ENABLED=true to enable.",
      });
    }

    const [status, stats] = await Promise.all([
      sync.getStatus(),
      sync.getStats(),
    ]);

    return NextResponse.json({
      enabled: true,
      ...status,
      stats,
    });
  } catch (err) {
    console.error("[admin/log-storage] GET error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

/**
 * POST /api/admin/log-storage
 *
 * Manually trigger a log storage sync scan.
 * Returns the scan result.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const sync = getLogStorageSync();
    if (!sync) {
      return NextResponse.json(
        { error: "Log storage sync is disabled. Set LOG_STORAGE_ENABLED=true to enable." },
        { status: 400 }
      );
    }

    const result = await sync.triggerScan();
    return NextResponse.json({
      message: "Scan completed",
      result,
    });
  } catch (err) {
    console.error("[admin/log-storage] POST error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
