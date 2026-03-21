import axios from "axios";
import { NextRequest, NextResponse } from "next/server";

function isAllowedInstanceUrl(instanceUrl: string): boolean {
  try {
    const hostname = new URL(instanceUrl).hostname.toLowerCase();
    return hostname.endsWith(".service-now.com") || hostname.endsWith(".servicenow.com");
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      instanceUrl?: string;
      clientId?: string;
      clientSecret?: string;
      code?: string;
      codeVerifier?: string;
      redirectUri?: string;
    };

    const instanceUrl = body.instanceUrl?.replace(/\/$/, "") || "";
    if (!instanceUrl || !body.clientId || !body.code || !body.codeVerifier || !body.redirectUri) {
      return NextResponse.json(
        { success: false, message: "Missing required fields for ServiceNow OAuth exchange." },
        { status: 400 },
      );
    }

    if (!isAllowedInstanceUrl(instanceUrl)) {
      return NextResponse.json(
        { success: false, message: "Instance URL is not in the allowed ServiceNow domain list." },
        { status: 400 },
      );
    }

    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: body.clientId,
      code: body.code,
      code_verifier: body.codeVerifier,
      redirect_uri: body.redirectUri,
    });

    if (body.clientSecret) {
      params.set("client_secret", body.clientSecret);
    }

    const response = await axios.post<Record<string, unknown>>(
      `${instanceUrl}/oauth_token.do`,
      params.toString(),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json",
        },
        timeout: 30000,
      },
    );

    const accessToken = typeof response.data.access_token === "string" ? response.data.access_token : "";
    if (!accessToken) {
      return NextResponse.json(
        { success: false, message: "ServiceNow OAuth exchange did not return an access token." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      accessToken,
      refreshToken: typeof response.data.refresh_token === "string" ? response.data.refresh_token : undefined,
      expiresIn: typeof response.data.expires_in === "number" ? response.data.expires_in : undefined,
      tokenType: typeof response.data.token_type === "string" ? response.data.token_type : undefined,
    });
  } catch (error) {
    const detail = axios.isAxiosError(error)
      ? (error.response?.data?.error_description as string | undefined) ||
        (error.response?.data?.error as string | undefined) ||
        error.message
      : error instanceof Error
        ? error.message
        : "OAuth exchange failed";
    console.error("[sn-oauth/exchange] ServiceNow error:", detail);

    return NextResponse.json(
      { success: false, message: "OAuth token exchange failed. Check instance configuration." },
      { status: 500 },
    );
  }
}
