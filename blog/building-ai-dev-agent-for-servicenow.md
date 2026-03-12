# Building an AI Development Agent for ServiceNow: Key Learnings

> From CLI tool to multi-tenant web app — how we built an AI agent that follows a spec-driven SDLC to develop, test, and deploy ServiceNow solutions.

---

## The Problem

ServiceNow development is powerful but repetitive. Creating a business rule involves navigating to the right table, filling out forms, writing server-side JavaScript, configuring conditions, testing, and tracking changes in update sets. Multiply that by every script include, client script, UI policy, ACL, notification, and catalog item in a typical requirement — and you've got hours of clicking.

What if an AI agent could do all of that through conversation?

## Architecture: From MCP CLI to Web App

We started with an **MCP (Model Context Protocol) server** — a CLI tool that lets Claude Desktop interact with ServiceNow instances via 80+ REST API tools. It worked, but was limited to a single user with local credentials.

The pivot: **turn it into a web app anyone can use by supplying their own ServiceNow credentials and Claude API key.**

### The Tool Registry Pattern

The critical architectural decision was **decoupling tool definitions from transport**:

```
┌─────────────────────────────────────────────────┐
│              tool-definitions.ts                  │
│        (80 tools, single source of truth)         │
├─────────────────────────────────────────────────┤
│               tool-registry.ts                    │
│        (handler dispatch table + client)          │
├──────────────────┬──────────────────────────────┤
│   MCP Server     │      Next.js Web App          │
│   (CLI/stdio)    │      (HTTP/per-request)        │
└──────────────────┴──────────────────────────────┘
```

Both CLI and web app import from the same shared modules. Zero tool drift. When you add a tool to `tool-definitions.ts` and its handler to `tool-registry.ts`, both transports get it immediately.

**Key learning:** If you're building an AI agent that needs to run in multiple contexts (CLI, web, VS Code extension), invest early in separating your tool schema layer from the transport layer.

### Per-Request Client Isolation

In the CLI, one ServiceNow client lives for the entire session. In the web app, **every API request creates a fresh `ServiceNowClient`** from the user's credentials:

```typescript
const snClient = new ServiceNowClient({
  instanceUrl: credentials.instanceUrl,
  username: credentials.username,
  password: credentials.password,
  defaultScope: 'global',
});
```

No shared state between users. No credential leakage. The client lives for the duration of one tool-use loop and is garbage collected.

**Key learning:** Stateless per-request architecture is the simplest path to multi-tenant safety. The trade-off is no connection pooling, but ServiceNow's REST API is stateless anyway.

## Spec-Driven SDLC in a Chat Interface

The most interesting design challenge: **how do you enforce a structured development methodology inside a free-form chat?**

### The Five Phases

Every requirement follows a mandatory workflow:

```
SPEC → DESIGN → IMPLEMENTATION → TESTING → DEPLOYMENT
```

Each phase produces structured output. Phase gates enforce sequencing — the AI cannot skip ahead.

### Phase Gate Detection

We embed invisible HTML comment markers in the AI's response:

```
<!-- PHASE_GATE:spec -->
```

The frontend parses these with a simple regex:

```typescript
export function parsePhaseGate(content: string): SDLCPhase | null {
  const match = content.match(/<!--\s*PHASE_GATE:(\w+)\s*-->/);
  if (match) {
    const phase = match[1] as SDLCPhase;
    if (SDLC_PHASES.some((p) => p.key === phase)) return phase;
  }
  return null;
}
```

When detected, the UI renders an **Approve button** instead of just text. The marker is stripped from the visible content — the user sees a clean spec document with an approval action.

**Key learning:** HTML comments are an excellent out-of-band signaling mechanism between AI and frontend. They're invisible to the user, don't break markdown rendering, and are trivial to parse. Use them whenever your AI needs to communicate metadata alongside its natural language response.

### The Approval Flow

When the user clicks "Approve":

1. The phase gate message is marked as `approved: true` (button becomes a green badge)
2. The completed phase is tracked in state
3. The PhaseTracker stepper in the header advances
4. The word `"approved"` is sent as a user message to continue the conversation
5. The AI receives the approval and proceeds to the next phase

This creates a human-in-the-loop workflow where the AI does the heavy lifting but the human retains control over progression.

## The Tool-Use Loop

The core engine pattern for agentic behavior:

```
User message → Anthropic API → tool_use response?
                                    ↓ YES
                              Execute tools on ServiceNow
                              Feed results back to Claude
                              Loop (up to 15 rounds)
                                    ↓ NO (end_turn)
                              Return final text response
```

A single user message can trigger **dozens of tool executions**. For example, "Build a high-priority incident justification feature" might execute:

1. `sn_get_table_schema` — inspect the incident table
2. `sn_query_records` — check existing business rules
3. `sn_create_update_set` — create a change tracking container
4. `sn_create_script_include` — deploy utility code
5. `sn_create_business_rule` — deploy server-side validation
6. `sn_create_client_script` — deploy form behavior
7. `sn_create_ui_policy` — deploy field visibility rules
8. `sn_query_records` — verify deployment

Each execution is tracked with timing and displayed in collapsible cards in the UI.

**Key learning:** Set a generous but finite loop limit (we use 15 rounds). Without it, the AI can get stuck in retry loops. With it, complex multi-step deployments complete naturally while infinite loops are caught.

## Rate Limiting with Graceful Degradation

The app supports two modes:
- **Server-provided API key** — free tier with rate limits (sliding window per IP)
- **User-provided API key** — unlimited, bypasses rate limiting entirely

```typescript
if (!userSuppliedKey && process.env.CLAUDE_API_KEY) {
  const { allowed, usage } = consume(ip);
  if (!allowed) return NextResponse.json({ error: "rate_limit_exceeded" }, { status: 429 });
}
```

When limits are hit, the UI opens the settings panel and prompts the user to enter their own key. This lets us offer a free trial experience without risking runaway costs.

**Key learning:** Design rate limiting as a spectrum, not a wall. Degrade gracefully with clear messaging about what the user can do to continue.

## Model Selection UX

Users can choose between Claude Sonnet 4.6 (fast) and Opus 4.6 (most capable). The selection **locks after the first message** to prevent mid-conversation model switching that could confuse context.

A "New Chat" button resets the lock, allowing model changes for the next conversation.

**Key learning:** Model selection should be a session-level decision, not a per-message one. Switching models mid-conversation leads to inconsistent behavior since different models have different strengths in following complex system prompts.

## ServiceNow-Specific Lessons

### Flow Designer: The Snapshot Problem

Flow Designer flows can be created via REST API, but they **won't be functional** until activated through the UI. This is because Flow Designer requires internal "snapshots" — compiled representations created by the Flow Designer engine during activation.

Our approach: create draft flows via API, then guide the user to activate them in the Flow Designer UI. The AI can build the structure; the human clicks "Activate."

### Scope Management

ServiceNow has two deployment contexts: **Global scope** and **Application scope**. Artifacts in Global scope are system-wide; Application scope isolates them within a scoped app. The `defaultScope` parameter on the client determines where artifacts land. Getting this wrong means artifacts appear in the wrong scope — visible but non-functional in the intended context.

### Instance Discovery Before Design

The system prompt mandates that the AI **analyze the existing instance before designing a solution**. This prevents the common mistake of building something that already exists out-of-the-box. The AI uses query and schema tools to inspect what's already there, then decides: use OOTB, extend existing, or build new.

## What's Next

- **End-to-end SDLC validation** — Run a real requirement through all 5 phases and fix edge cases
- **Flow Designer tools** — Full MCP tool support for creating flows, triggers, and actions
- **Session persistence** — Save and resume conversations
- **Streaming responses** — Server-Sent Events for real-time token streaming
- **Email + OTP verification** — Gate access before chat to prevent abuse

---

*Built with Next.js, Anthropic Claude API, and the ServiceNow REST API. The full source follows a spec-driven SDLC methodology — the same methodology the agent teaches to its users.*

