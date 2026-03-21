import type { BrowserSessionCookie, Credentials, ServiceNowAuthMethod } from "./types";

export function normalizeServiceNowAuthMethod(value?: string | null): ServiceNowAuthMethod {
  switch (value) {
    case "oauth_client_credentials":
    case "oauth_authorization_code":
    case "session":
      return value;
    default:
      return "basic";
  }
}

export function hasSessionCookies(cookies?: BrowserSessionCookie[]): boolean {
  return Array.isArray(cookies) && cookies.length > 0;
}

export function hasConnectableServiceNowAuth(
  credentials: Partial<Credentials>,
  options?: {
    serverBasicConfigured?: boolean;
    requireUsernameForBasic?: boolean;
    allowInteractiveBootstrap?: boolean;
  },
): boolean {
  const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
  const requireUsernameForBasic = options?.requireUsernameForBasic ?? true;
  const allowInteractiveBootstrap = options?.allowInteractiveBootstrap ?? false;

  switch (authType) {
    case "basic":
      return Boolean(
        credentials.instanceUrl &&
        (!requireUsernameForBasic || credentials.username) &&
        (credentials.password || options?.serverBasicConfigured),
      );
    case "oauth_client_credentials":
      return Boolean(credentials.instanceUrl && credentials.clientId && credentials.clientSecret);
    case "oauth_authorization_code":
      return Boolean(
        credentials.instanceUrl &&
        credentials.clientId &&
        (credentials.accessToken || allowInteractiveBootstrap),
      );
    case "session":
      return Boolean(
        credentials.instanceUrl &&
        (
          hasSessionCookies(credentials.sessionCookies) ||
          (
            allowInteractiveBootstrap &&
            credentials.username &&
            credentials.password
          )
        ),
      );
    default:
      return false;
  }
}

export function validateServiceNowCredentials(
  credentials: Partial<Credentials>,
  options?: {
    serverBasicConfigured?: boolean;
    requireUsernameForBasic?: boolean;
  },
): string | null {
  const authType = normalizeServiceNowAuthMethod(credentials.snAuthType);
  const requireUsernameForBasic = options?.requireUsernameForBasic ?? true;

  if (!credentials.instanceUrl) {
    return "Please provide the ServiceNow instance URL.";
  }

  switch (authType) {
    case "basic":
      if (requireUsernameForBasic && !credentials.username) {
        return "Please provide the ServiceNow username.";
      }
      if (!credentials.password && !options?.serverBasicConfigured) {
        return "Please provide the ServiceNow password.";
      }
      return null;
    case "oauth_client_credentials":
      if (!credentials.clientId || !credentials.clientSecret) {
        return "OAuth client credentials require both client ID and client secret.";
      }
      return null;
    case "oauth_authorization_code":
      if (!credentials.clientId) {
        return "OAuth Authorization Code requires a client ID.";
      }
      if (!credentials.accessToken) {
        return "Complete the ServiceNow OAuth sign-in before connecting.";
      }
      return null;
    case "session":
      if (!hasSessionCookies(credentials.sessionCookies)) {
        return "Complete the browser sign-in before connecting.";
      }
      return null;
    default:
      return "Unsupported ServiceNow authentication method.";
  }
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function createPkcePair(): Promise<{ verifier: string; challenge: string }> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(random);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

export function buildServiceNowAuthorizationUrl(input: {
  instanceUrl: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  scope?: string;
}): string {
  const baseUrl = input.instanceUrl.replace(/\/$/, "");
  const url = new URL(`${baseUrl}/oauth_auth.do`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (input.scope) {
    url.searchParams.set("scope", input.scope);
  }
  return url.toString();
}
