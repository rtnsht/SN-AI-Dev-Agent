# Fix: Assistant Message Prefill Error

**Date:** 2026-03-23  
**Severity:** P1 (Production-blocking)  
**Affected Component:** `webapp/src/lib/sn-engine.ts`  
**Status:** Fixed

---

## Symptom

Users see a generic red error banner in the chat UI:

> Error: Something went wrong while processing your request. Please try again. If the issue persists, try starting a new conversation.

This occurs when the AI agent attempts to execute any action that triggers the task planner (e.g., "lets perform deployment stage.. of SDD").

## Root Cause

The Anthropic API returns HTTP 400:

```json
{
  "type": "error",
  "error": {
    "type": "invalid_request_error",
    "message": "This model does not support assistant message prefill. The conversation must end with a user message."
  }
}
```

### Why It Happens

After the task planner pre-fetches ServiceNow instance data, the code appended two messages to the **end** of the messages array:

1. A `user` message containing the gathered data
2. An `assistant` acknowledgment: "I have received the pre-fetched data..."

The assistant message became the **last message** in the array. Modern Claude models (4.5+) interpret a trailing assistant message as "assistant message prefill" and reject it.

```
Messages before API call (BROKEN):
[user1, asst1, user2(current), user(data), asst(ack)]
                                             ^^^ LAST = assistant = REJECTED
```

### Scope of the Problem

This is NOT specific to Claude Sonnet 4.6. Research confirmed it affects:

| Provider/Model | Behavior |
|---|---|
| Claude Sonnet 4.6, Opus 4.6 | 400 error (breaking change Feb 2026) |
| Claude Sonnet 4.5, Haiku 4.5 | 400 error |
| Amazon Nova (reasoning enabled) | 400 error |
| MiniMax M1/M2 | Rejected |
| Switchpoint Router, Morph | "Last message must be of user role" |
| OpenAI GPT models | No error, but no prefill behavior (silently ignored) |
| OpenRouter | Transparent pass-through (propagates provider error) |

Multiple open-source frameworks were affected by the same breaking change: CrewAI (#4798), Mastra (#13969), strands-agents SDK (#1694).

## Diagnosis Method

1. Used DigitalOcean App Platform MCP (`apps-get-logs`) to pull runtime logs from the `sn-ai-dev-agent` component
2. Found the Anthropic API 400 error with the exact error message
3. Traced the code path from `chatStream()` -> planner data injection -> `anthropic.messages.create()`

## Changes Made

### 1. Fix Message Ordering in `chatStream()` (Anthropic streaming path)

**File:** `webapp/src/lib/sn-engine.ts`, lines ~1337-1358

**Before:** Gathered data and acknowledgment were `push()`ed to the end of the array (after the user's current message).

**After:** Gathered data and acknowledgment are `splice()`d before the user's last message, so the user's actual request remains last.

```
Messages after fix:
[user1, asst1, user(data), asst(ack), user2(current)]
                                       ^^^ LAST = user = OK
```

This also fixes the semantic ordering -- context data comes before the request that should use it.

### 2. Fix Message Ordering in `chatStreamOpenRouter()` (OpenRouter streaming path)

**File:** `webapp/src/lib/sn-engine.ts`, lines ~1659-1672

Same splice approach applied to the OpenRouter message array.

### 3. Safety Guard in `trimConversationHistory()`

**File:** `webapp/src/lib/sn-engine.ts`, lines ~399-403

Added a guard after context trimming: if the result would end with an assistant message (e.g., if the recent messages slice is empty), a synthetic user continuation is appended.

```typescript
if (result.length > 0 && result[result.length - 1].role === "assistant") {
  result.push({ role: "user", content: "Please continue." });
}
```

### 4. Improved Error Messages in `sanitizeApiError()`

**File:** `webapp/src/lib/sn-engine.ts`, lines ~422-480

The previous implementation replaced ALL Anthropic/OpenRouter JSON error bodies with a single generic "Something went wrong" message, regardless of the actual error type. This made debugging impossible for users.

**New implementation** parses the error JSON, extracts the `message` field, and maps to category-specific user-friendly messages:

| Error Category | User-Facing Message |
|---|---|
| Assistant prefill rejected | "The AI model rejected the message format (assistant prefill not supported). Please start a new conversation." |
| Context length exceeded | "The conversation has grown too long for the model's context window. Please start a new conversation." |
| Model overloaded | "The AI model is temporarily overloaded. Please try again in a moment." |
| Authentication failed | "API authentication failed. Please check your API key in Settings." |
| Billing/quota exceeded | "The API quota or billing limit has been reached. Please check your plan or try again later." |
| Model not available | "The selected AI model is not available. Please try switching to a different model." |
| Rate limit | "Rate limit reached. Please wait a moment and try again." |
| Other known API error (with detail) | "The AI model could not process this request: [extracted detail]" |
| Other known API error (no detail) | "The AI model could not process this request. Please try rephrasing or start a new conversation." |
| HTTP status code prefix | "A temporary issue occurred. Please try again in a moment." |
| Unrecognized long error | "An unexpected error occurred. Please try again. If the issue persists, try starting a new conversation." |

## Code Paths NOT Affected

- **Non-streaming `chat()` function** -- no task planner integration, goes directly into the tool-use loop
- **Non-streaming `chatOpenRouter()` function** -- same, no planner
- **Tool-use loop** -- always ends with a `user` message (tool results) before the next API call

## Testing

- TypeScript compilation: clean (the single pre-existing error in `s3-provider.ts` is unrelated)
- Linter: no errors in `sn-engine.ts`
- Deployment: auto-deploys from `main` branch to DigitalOcean App Platform

## References

- Anthropic docs: [Prefill Claude's response](https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/prefill-claudes-response) (documents the feature for compatible models)
- OpenRouter prefill tracker: [rentry.org/or-prefill](https://rentry.org/or-prefill) (community-maintained compatibility table)
- Related framework issues: CrewAI #4798, Mastra #13969, strands-agents SDK #1694
