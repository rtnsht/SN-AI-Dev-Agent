# Building an AI-Powered ServiceNow Dev Agent: Key Learnings & Design Patterns

> **Context**: We built a Next.js webapp that lets users describe ServiceNow requirements in plain English, and an AI agent (Claude) designs, implements, and deploys the solution — following a full spec-driven SDLC with phase gates. Here are the patterns and lessons that emerged.

---

## 1. Where to Place Instance Discovery in an AI-Driven SDLC

**The question**: When should the AI agent query the live ServiceNow instance to check what already exists?

**Options considered**:
- Before Spec (too early — you don't yet know what tables/artifacts to search for)
- Before Design ✅ (just right)
- After Design (too late — you've already designed without knowing what exists)

**Why before Design works best**:
- The **Spec defines WHAT** to build — business requirements, user stories, acceptance criteria. It doesn't need implementation knowledge.
- The **Design defines HOW** to build it — this is exactly when you need to know what business rules, script includes, flows, and scheduled jobs already exist.
- After the spec is approved, the agent knows the exact scope (which tables, which processes), so tool queries are **targeted, not broad**.

The agent runs discovery queries like:
```
search_scripts(table: "incident", type: "business_rule")
search_scripts(table: "incident", type: "script_include")
query_records(table: "sysauto_script", query: "name LIKE incident")
```

Then it makes a REUSE / EXTEND / BUILD NEW decision for each artifact before writing the design.

---

## 2. System Prompt Engineering — 50% Token Reduction Without Losing Information

**Problem**: Our system prompt was 234 lines and consumed significant tokens on every API call.

**Solution**: Applied Anthropic-specific optimizations to cut it to 117 lines (50% reduction):

### Technique 1: XML Tags Instead of Decorative Delimiters
```
# Before (wasteful)
═══════════════════════════════════════════
📋 PHASE 1: SPECIFICATION
═══════════════════════════════════════════

# After (Claude-native)
<spec>
Generate spec with sections:
- Document Control: REQ ID, Author, Date...
</spec>
```
Claude parses XML tags natively — they're more efficient than decorative ASCII art for structuring prompts.

### Technique 2: Concise Bullet Format
```
# Before
**Step 1:** Use the search tools to find existing business rules on the target table.
**Step 2:** Check for OOTB capabilities that match the requirements.

# After
- Use search/query tools to find existing business rules, script includes, etc.
- Check for OOTB capabilities that match requirements
```

### Technique 3: Remove Filler Words
```
# Before
"Generate a comprehensive spec document with these sections:"

# After
"Generate spec with sections:"
```

### What We Preserved
Every piece of functional information stayed intact:
- Complete SDLC workflow (5 phases)
- Phase gate markers (`<!-- PHASE_GATE:xxx -->`)
- All template structures (spec, design)
- All 8 instance discovery tool examples
- Naming conventions with examples
- Sign-off rules

**Key insight**: Token reduction isn't about removing information — it's about removing *packaging* around information.

---

## 3. Prompt Caching — 90% Cost Reduction on Repeat Calls

**Problem**: Each tool-use round resends the full system prompt + 50+ tool schemas as input tokens. With a 15-round tool loop, that's 15× the cost.

**Solution**: Anthropic's prompt caching with `cache_control: { type: "ephemeral" }`:

```typescript
response = await anthropic.messages.create({
  model,
  max_tokens: 8192,
  system: SYSTEM_PROMPT,
  tools,
  messages: anthropicMessages,
  cache_control: { type: "ephemeral" },
});
```

**How it works**:
- Round 1: Full token cost (cache miss + cache creation)
- Rounds 2-15: ~90% reduction (cache hit — only new message tokens are billed as input)
- Cache is valid for 5 minutes

**We also log cache performance**:
```typescript
const cached = usage.cache_read_input_tokens ?? 0;
const created = usage.cache_creation_input_tokens ?? 0;
const plain = usage.input_tokens ?? 0;
console.log(`[cache] input=${plain} cache_read=${cached} cache_creation=${created}`);
```

This lets us verify caching is actually working in production logs.

---

## 4. Retry with Exponential Backoff — Handling Transient 429s

**Problem**: Anthropic's API has a 30,000 input token per minute rate limit that gets hit during heavy tool-use loops.

**Solution**: 3-retry loop with exponential backoff that respects the `retry-after` header:

```
Attempt 1: fails → wait 5s
Attempt 2: fails → wait 10s
Attempt 3: fails → wait 20s
Attempt 4: give up → throw tagged error
```

**Key design decisions**:
- **Respect `retry-after` header**: If the API tells us to wait 8 seconds, we wait 8 seconds — not our default 5.
- **Exponential backoff as fallback**: `BASE_BACKOFF_MS * 2^attempt` when the header isn't present.
- **Tag exhausted errors**: When all retries fail, we throw `Error("anthropic_rate_limit")` — not the raw SDK error — so downstream code can distinguish it from other failures.

---

## 5. Graceful Degradation: Token Error → API Key Prompt → Session Resume

**The problem**: When the server's shared Claude API key hits its rate limit (even after retries), the user gets a dead-end error. The conversation context is "lost" — they can't continue.

**The insight**: Chat history is already preserved in React state. We just need to remember *what failed* and *retry it* with a different API key.

### The Pattern: `pendingRetry`

```
User sends message
  → Claude API returns 429 (after 3 retries)
  → Backend returns { error: "anthropic_rate_limit", needsApiKey: true }
  → Frontend:
      1. Stores the failed message in `pendingRetry` state
      2. Shows inline error: "🔑 API rate limit hit — enter your API key..."
      3. Opens settings sidebar, highlights API key field
  → User pastes their own API key
  → `onApiKeyProvided` callback fires:
      1. Clears rate limit flag
      2. Reads `pendingRetry`
      3. Calls `handleSend(pendingRetry.text, pendingRetry.images)`
  → Same conversation, same history, new key — seamless resume
```

**Why this works without special "resume" logic**:
- The user's message was already added to `messages` state before the fetch
- `handleSend` rebuilds `apiMessages` from the full `messages` array each time
- The retried API call sends the complete conversation → Claude sees full context
- No messages are lost. The only new thing is `pendingRetry` remembering what to resend.

**Edge cases handled**:
| Case | Behavior |
|------|----------|
| User's own key also hits 429 | Same retry loop → same error banner again |
| User closes settings without entering key | `pendingRetry` persists — they can enter key later |
| User sends a new message instead | `pendingRetry` is cleared — new message takes priority |
| User starts a new chat | `pendingRetry` is cleared |

### Two Distinct 429 Types

A subtle but important distinction:

| Source | Error Code | Trigger | Resolution |
|--------|-----------|---------|------------|
| App-level rate limiter | `rate_limit_exceeded` | N free requests per time window | Enter own API key (removes limiter) |
| Anthropic API | `anthropic_rate_limit` | 30K input tokens/min exceeded | Enter own API key (different quota) |

Both open the settings sidebar and highlight the API key field, but they show different error messages and the Anthropic variant auto-retries.

---

## 6. Cancel/Stop Button with AbortController

**Problem**: Long-running tool-use loops (15 rounds of ServiceNow API calls) can take minutes. Users need a way to stop them.

**Solution**: `AbortController` on the fetch call:

```typescript
const controller = new AbortController();
abortRef.current = controller;

const res = await fetch("/api/chat", {
  // ...
  signal: controller.signal,
});
```

The send button morphs into a red **■ Stop** button during requests. Clicking it calls `abortRef.current.abort()`.

**Limitation we documented**: The abort terminates the HTTP connection from browser → Next.js server, but the Anthropic API call on the server side may still complete in the background. Next.js doesn't propagate abort signals to route handlers. This is acceptable for MVP — the user gets immediate UI feedback.

---

## 7. Architecture Diagrams as Living Documentation

We maintain a single `docs/architecture.md` with 8 mermaid diagrams that evolve with the codebase:

1. **High-Level System Architecture** — boxes and arrows between browser, Next.js, Anthropic, ServiceNow
2. **Frontend Component Architecture** — React component tree with state ownership
3. **Tool-Use Conversation Loop** — sequence diagram showing the retry + caching flow
4. **SDLC Phase Gate Workflow** — state machine for the 5-phase process
5. **Credential & API Key Flow** — flowchart covering both rate limit types + auto-retry
6. **MCP Tool Categories** — 50+ tools grouped by function
7. **Project Directory Structure** — annotated tree
8. **Key Design Decisions** — table with rationale for each choice

**Key practice**: Every feature change updates the relevant diagrams in the same PR. The architecture doc isn't a separate artifact — it's part of the implementation.

---

## 8. Design Decision Table — Making Trade-offs Explicit

We keep a table in the architecture doc that forces us to articulate *why* for every significant choice:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stateless API | Credentials per-request | No server sessions = simpler deployment |
| Prompt caching | `cache_control: ephemeral` | 90% token savings on tool-use loops |
| XML system prompt | Replace ASCII art with XML tags | Claude-native parsing, 50% fewer tokens |
| Pending retry pattern | Store failed msg in React state | Zero-infra session resume after 429 |
| Shift+Enter to send | Enter = new line | Better UX for multi-line code snippets |
| Model selection lock | Lock after first message | Prevents mid-conversation model confusion |

This table is valuable for onboarding, code reviews, and future refactoring — it prevents "why did we do it this way?" questions.

---

## Summary of Patterns

| # | Pattern | Problem | Solution |
|---|---------|---------|----------|
| 1 | Discovery placement | When to check existing implementation | After Spec approval, before Design |
| 2 | Prompt optimization | System prompt consuming excess tokens | XML tags + concise bullets (50% reduction) |
| 3 | Prompt caching | Repeated system prompt in tool loops | `cache_control: ephemeral` (90% savings) |
| 4 | Retry with backoff | Transient API rate limits | 3 retries, exponential backoff, respect `retry-after` |
| 5 | Pending retry | Session dies on API key exhaustion | Store failed msg → prompt for key → auto-retry |
| 6 | Error differentiation | Two 429 types need different handling | Tagged errors: `anthropic_rate_limit` vs `rate_limit_exceeded` |
| 7 | Request cancellation | Long tool loops block the user | AbortController on fetch, button state morph |
| 8 | Living architecture docs | Diagrams drift from code | Update mermaid diagrams with every feature change |

---

*Built with Next.js, Anthropic Claude API, and the mcp-servicenow tool package.*
