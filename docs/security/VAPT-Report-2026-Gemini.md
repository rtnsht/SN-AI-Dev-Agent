# VAPT Assessment & Remediation Report (Gemini Edition)

## Executive Summary
A comprehensive Vulnerability Assessment and Penetration Testing (VAPT) review was conducted across the SN AI Agent codebase using specialized AI sub-agents (powered by Gemini). The assessment identified several critical and high-severity vulnerabilities spanning network security, authentication, authorization, data privacy, and LLM integration.

This document tracks the identified vulnerabilities and the remediation steps applied.

## Phase 2: Assessment Findings

### 🔴 Critical Vulnerabilities
1. **Server-Side Request Forgery (SSRF) via Unvalidated `instanceUrl`**
   * **Component:** `/api/chat`, `/api/chat-stream`, `/api/test-connection`, `ServiceNowClient`
   * **Impact:** Attackers can force the server to make requests to internal network services or cloud metadata endpoints.
   * **Status:** ✅ Fixed (Extracted `isAllowedInstanceUrl` to `servicenow-auth.ts` and enforced it in all API routes and the `ServiceNowClient` constructor).

2. **Arbitrary Server-Side Code Execution via Script Injection**
   * **Component:** `mcp-servicenow/src/tools/scripts.ts`, `sn-client.ts`
   * **Impact:** Direct vector for Remote Code Execution (RCE) on the connected ServiceNow instance.
   * **Status:** ⚠️ Accepted Risk (This is a core feature of the AI developer agent. It is mitigated by the new `SN_READONLY_MODE` flag which can be enabled for untrusted environments).

3. **Unrestricted Tool Exposure (Lack of RBAC)**
   * **Component:** `mcp-servicenow/src/index.ts`
   * **Impact:** If the LLM prompt is compromised, an attacker can invoke administrative tools to modify the ServiceNow instance.
   * **Status:** ✅ Fixed (Implemented `SN_READONLY_MODE` environment variable to restrict the MCP server to read-only tools like `sn_get_*` and `sn_search_*`).

4. **Database Hot Paths & Concurrency (Race Conditions)**
   * **Component:** `webapp/src/lib/access-tier.ts` & `trial-limiter.ts`
   * **Impact:** Concurrent requests can bypass rate limits and trial quotas.
   * **Status:** ✅ Fixed (Created atomic increment RPCs in Supabase and updated `access-tier.ts` and `trial-limiter.ts` to use them to prevent race conditions).

### 🟠 High Vulnerabilities
1. **In-Memory Rate Limiting for Authentication**
   * **Component:** `webapp/src/lib/auth-rate-limiter.ts`
   * **Impact:** Attackers can bypass rate limits by distributing requests across instances.
   * **Status:** Pending Fix

2. **Unauthenticated & Unrated-Limited LLM Endpoint (Denial of Wallet)**
   * **Component:** `/api/enhance-prompt` & `proxy.ts`
   * **Impact:** Attackers can exhaust the server's Anthropic API credits via automated requests.
   * **Status:** ✅ Fixed (Added `checkAccess` rate limiting to the endpoint).

3. **Arbitrary Model Execution via OpenRouter (Cost Exhaustion)**
   * **Component:** `/api/chat`, `sn-engine.ts`
   * **Impact:** Attackers can bypass UI restrictions to use extremely expensive models.
   * **Status:** ✅ Fixed (Added a strict whitelist of allowed models when using the server's OpenRouter API key).

4. **Incomplete Secret Redaction in Logging (PII & Credential Leakage)**
   * **Component:** `webapp/src/lib/logger.ts`, `sn-engine.ts`, `chat/route.ts`
   * **Impact:** API keys, bearer tokens, and PII can be written in plaintext to local disk and the Supabase telemetry database.
   * **Status:** ✅ Fixed (Added `authorization`, `email`, `username`, `ip` to redaction list and removed `contentPreview` logging).

5. **Insecure Direct Object Reference (IDOR) in Session Logging**
   * **Component:** `/api/session-start/route.ts`, `/api/chat-stream/route.ts`, `/api/session-end/route.ts`
   * **Impact:** Attackers can overwrite metadata or terminate other users' sessions.
   * **Status:** ✅ Fixed (Added `user_id` validation checks to ensure sessions can only be modified or ended by their owners).

6. **Inconsistent Admin Authorization Enforcement**
   * **Component:** `/api/admin/*` routes, `proxy.ts`
   * **Impact:** Potential bypass of admin authorization.
   * **Status:** ✅ Fixed (Added `requireAdmin()` check to all `/api/admin/*` routes and updated `requireAdmin` to respect `BYPASS_AUTH` for local dev).

7. **Missing Content Security Policy (CSP) Header**
   * **Component:** `webapp/next.config.ts`
   * **Impact:** Lacks defense-in-depth against XSS attacks.
   * **Status:** ✅ Fixed (Added CSP header to `next.config.ts`).

8. **Cross-Site Scripting (XSS) via `dangerouslySetInnerHTML`**
   * **Component:** `webapp/src/app/admin/page.tsx`
   * **Impact:** Stored XSS if malicious input is saved as a banner.
   * **Status:** ✅ Fixed (Added DOMPurify sanitization to the live preview and restricted allowed URIs).

9. **Streaming Timeouts & Serverless Limits**
   * **Component:** `openrouter.ts`, `chat-stream/route.ts`
   * **Impact:** Ungraceful termination of long-running LLM tasks, breaking the UI state.
   * **Status:** ✅ Fixed (Increased OpenRouter timeout to 120s and added a 280s execution time check in the streaming loop to gracefully abort before the 300s platform kill).

---

## Phase 3: Remediation Log

*(Fixes will be documented here as they are applied)*
