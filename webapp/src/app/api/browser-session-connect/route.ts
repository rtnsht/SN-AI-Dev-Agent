import { NextRequest, NextResponse } from "next/server";
import { connectViaBrowser } from "@/lib/browser-scope-switcher";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      instanceUrl?: string;
      username?: string;
      password?: string;
    };

    if (!body.instanceUrl) {
      return NextResponse.json(
        { success: false, message: "Please provide the ServiceNow instance URL." },
        { status: 400 },
      );
    }

    const result = await connectViaBrowser({
      instanceUrl: body.instanceUrl,
      username: body.username,
      password: body.password,
      forceMode: "headed", // Force headed mode so user can see browser and complete MFA
      manualTimeoutMs: 300000,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          message: result.error || "Browser-assisted sign-in failed.",
          failureCategory: result.failureCategory,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      success: true,
      sessionCookies: result.cookies || [],
      sessionToken: result.sessionToken || "",
      validationResult: result.validationResult || null,
      message: "Browser-assisted ServiceNow sign-in completed.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Browser-assisted sign-in failed";
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("[Browser Session Connect] Error:", message, stack);
    return NextResponse.json({ 
      success: false, 
      message: message || "Browser-assisted sign-in failed. Check server logs for details." 
    }, { status: 500 });
  }
}
