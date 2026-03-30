# Understanding SN AI Agent

> A guide to what SN AI Agent is, what it can do, and how to think about using it.

---

## Key Takeaways

**SN AI Agent turns plain English into working ServiceNow solutions:** Instead of manually writing scripts, configuring business rules, or clicking through the ServiceNow platform UI, you describe what you need in a chat — and the AI builds it, deploys it, and tests it on your instance. The entire process follows a structured methodology where you review and approve every step before anything ships.

**It's not just a chatbot — it's a development partner with 80+ specialized tools:** SN AI Agent can create business rules, client scripts, UI policies, flows, notifications, ACLs, scheduled jobs, catalog items, scoped applications, and more. It can also analyze your existing instance for health issues, anti-patterns, dead code, and upgrade readiness. Think of it as a ServiceNow developer that works alongside you — it does the heavy lifting, but you make the decisions.

**Nothing ships without your approval:** The system follows a spec-driven SDLC (Software Development Lifecycle) with mandatory human approval gates. The AI writes a spec — you review it. The AI writes a design — you review it. Only after you approve does it proceed to build and deploy. This isn't a "fire and forget" tool. It's a collaborative process where the AI proposes and you decide.

**It understands your specific instance:** When you connect to your ServiceNow instance, the app reads your roles, assignment groups, open incidents, existing business rules, catalog items, update sets, and more. It uses this context to generate personalized suggestions and to make smarter decisions about what to build and how to build it.

**You can use it without any setup beyond a browser:** SN AI Agent is a web application. You sign in, connect your ServiceNow instance, and start working. There's nothing to install. It works on desktop and mobile, supports dark and light themes, and lets you use voice input or attach files (PDFs, Word docs, Excel sheets, images) for additional context.

**Access is controlled and metered:** The app has a three-tier access system. Anonymous users get a limited number of daily requests. Signed-in users get a higher limit. Users who bring their own AI API key get unlimited access. Admins can configure these limits, manage users, and monitor usage.

---

## What SN AI Agent Can Do

SN AI Agent goes far beyond answering questions about ServiceNow. It is an AI-powered development environment that can both automate and augment your work on the platform. Here's what it excels at:

### Build ServiceNow Features from Scratch

Describe a requirement in plain English — "I need a business rule that validates high-impact incidents require a justification before saving" — and the AI will:

1. Write a formal requirements specification
2. Design the technical solution (which tables, which artifact types, what logic)
3. Create the actual artifacts on your instance (business rule, client script, UI policy, etc.)
4. Capture everything in a named update set for clean promotion
5. Test the implementation and capture evidence

You can build anything that ServiceNow supports: business rules, client scripts, script includes, UI policies, UI actions, notifications, ACLs, scheduled jobs, catalog items, flows, scoped applications, custom tables, and custom fields. The AI knows the platform deeply — it understands GlideRecord, GlideSystem, client-side APIs, server-side APIs, and ServiceNow best practices.

### Analyze and Audit an Existing Instance

If you're inheriting an instance or preparing for an upgrade, the AI can run a comprehensive analysis:

- **Instance health scoring** — a 0–100 score across 40+ categories covering scripts, workflows, integrations, security, and platform usage
- **OOTB override detection** — finds every out-of-the-box artifact that has been modified, so you know what's custom vs. standard
- **Anti-pattern detection** — identifies bad practices like synchronous GlideRecord calls in client scripts, hardcoded sys_ids, missing null checks, and overly broad ACLs
- **Dead code finder** — locates unused scripts, inactive business rules, and orphaned script includes that can be safely cleaned up
- **Code quality analysis** — scores the quality of all scripts on the instance with specific improvement recommendations
- **Dependency mapping** — builds a graph of which artifacts depend on which others, so you understand the blast radius of any change
- **Upgrade readiness assessment** — evaluates how ready the instance is for a platform upgrade, flagging customizations that may conflict

### Compare Instances and Manage Promotions

For teams working across multiple instances (dev, test, staging, prod), the AI can:

- Compare two instances side-by-side to find differences
- Detect conflicts between update sets before promotion
- Predict likely conflicts based on change patterns
- Manage promotion workflows across the instance pipeline

### Query and Explore Data

The AI can query any ServiceNow table in real time. Ask it to "show me all high-priority incidents assigned to the Service Desk that are older than 30 days" and it will construct the right query, run it, and present the results. This works for any table — incidents, changes, problems, catalog items, users, groups, or custom tables.

### Get Personalized Recommendations

When you connect, the app generates smart suggestions tailored to you and your instance across four categories:

- **For You** — your open incidents, pending changes, approvals waiting for you, unassigned tickets in your groups
- **Build** — feature ideas based on gaps it detects (tables without business rules, catalog items without workflows, forms without validation)
- **Explore** — audit and review prompts based on real artifacts on your instance (review business rules on the incident table, check scheduled job configurations, analyze ACL coverage)
- **Quick Queries** — ready-made data lookups using actual table names, group names, and counts from your instance

These aren't generic templates — they're generated from 13 parallel queries against your specific instance data.

---

## The Development Process

SN AI Agent follows a structured, auditable development process with six phases. This isn't just a suggestion — it's enforced by the system.

### Phase 1: Specification

The AI writes a formal requirements spec that documents what will be built, why, acceptance criteria, and scope. The spec follows a standard template and is saved as a markdown file in the project.

**Gate: You must review and approve the spec before the AI proceeds to design.**

### Phase 2: Design

The AI writes a technical design document that specifies which ServiceNow artifacts will be created, on which tables, with what logic. Before designing, it queries your instance to understand what already exists — existing business rules, client scripts, UI policies, and table schemas — so it doesn't duplicate or conflict with existing functionality.

**Gate: You must review and approve the design before the AI proceeds to implementation.**

### Phase 3: Scope Selection

The AI determines the right application scope for the work. It can use the global scope, select an existing scoped application, or create a new one. This is important for modularity and for ensuring artifacts are properly organized.

**This phase auto-proceeds — no approval needed.**

### Phase 4: Implementation

The AI creates a named update set, generates all the artifacts defined in the design, and deploys them to your instance via the REST API. Every artifact is captured in the update set using a three-layer defense strategy that ensures reliable capture even though the REST API doesn't natively honor session-based update sets.

**This phase auto-proceeds — no approval needed.**

### Phase 5: Testing

The AI runs automated tests (using ServiceNow's ATF framework where applicable) and captures evidence of the results.

**This phase auto-proceeds — no approval needed.**

### Phase 6: Deployment Record

The AI creates a deployment record documenting what was deployed, when, by whom, and updates the project manifest.

**This phase auto-proceeds — no approval needed.**

The result: every feature built through SN AI Agent has a complete audit trail — spec, design, implementation, test results, and deployment record — all linked together. For the full design of these quality gates (configuration, sign-off rules, and validation), see [Quality Gate Design](../design/quality-gate-design.md). For how the system handles custom application scopes and update set capture, see [Custom Scope Capture](../architecture/custom-scope-capture.md).

---

## How You Interact With It

### The Chat Interface

The primary interface is a chat window where you type (or speak) your requests. The AI responds with rich, formatted text — markdown with headers, tables, code blocks, and collapsible sections. When the AI is working, you see a real-time activity timeline showing each step: which ServiceNow API it's calling, how long it takes, and whether it succeeded.

You can:
- **Type a message** — describe what you need in plain English
- **Pick a suggestion** — choose from the personalized prompt suggestions
- **Use voice input** — click the microphone button and dictate your request
- **Attach files** — drag and drop or click to attach images, PDFs, Word documents, or Excel spreadsheets for additional context
- **Enhance your prompt** — use the magic wand button to have the AI rewrite your prompt to be clearer and more specific before sending
- **Cancel at any time** — click the stop button to abort an in-progress request

### The Settings Panel

A sidebar panel lets you configure:
- **ServiceNow credentials** — instance URL, username, and password
- **AI provider** — switch between Anthropic (Claude) and OpenRouter (multi-model)
- **Model selection** — choose which AI model to use (different models have different strengths and costs)
- **API key** — optionally provide your own API key for unlimited usage
- **Usage meter** — see how many requests you've used and how many remain

### The Phase Tracker

A visual pipeline in the header shows where you are in the development lifecycle. Each phase has a status indicator — pending, in progress, or complete — so you always know what stage the work is in and what comes next.

### Theme and Branding

The app supports dark and light modes, toggled with a single click. All visual branding — app name, logo, colors, taglines — is configurable, making it adaptable for different teams or organizations.

---

## How It Works Under the Hood

You don't need to understand the internals to use SN AI Agent, but here's a simplified view of what happens when you send a message:

1. **Your message goes to the server** — the Next.js backend receives your message along with your ServiceNow credentials and conversation history.

2. **Access is checked** — the system verifies you haven't exceeded your daily request limit (unless you're using your own API key, in which case there's no limit).

3. **The AI receives your message with 80+ tool definitions** — the system sends your message to the AI model (Claude or an OpenRouter model) along with a detailed system prompt that teaches it the SDLC methodology and definitions for all 80+ ServiceNow tools it can use.

4. **The AI decides what to do** — it may respond directly with text, or it may decide to call one or more tools. For example, if you ask it to "show me all business rules on the incident table," it will call the `sn_get_business_rules` tool with `table="incident"`.

5. **Tools execute against your ServiceNow instance** — each tool call translates to one or more REST API calls to your ServiceNow instance. The results come back as JSON.

6. **The AI processes the results and responds** — it may call more tools based on what it learned, or it may compose a final response. This loop can run up to 30 rounds for complex requests.

7. **You see everything in real time** — tool executions stream to your browser as they happen, so you can watch the AI work.

The key architectural feature is that the AI doesn't have a pre-programmed set of workflows. It has tools and knowledge, and it reasons about how to use them for each request. This means it can handle novel requests it has never seen before, as long as the underlying ServiceNow APIs support the operation.

---

## Who Is It For?

### ServiceNow Developers

Speed up your development workflow. Instead of manually writing and testing scripts, describe what you need and review what the AI produces. Use the analysis tools to audit instances, find anti-patterns, and assess upgrade readiness.

### ServiceNow Administrators

Build automations, notifications, and catalog items without deep scripting knowledge. The AI handles the technical implementation — you focus on the business requirements and review the results.

### Platform Owners and Architects

Use the instance analysis suite to get a comprehensive view of customization health, OOTB overrides, dead code, and upgrade readiness across your instance landscape. Compare instances and manage promotion workflows.

### Teams New to ServiceNow

Learn the platform by building on it. The AI follows best practices, uses proper naming conventions, and creates clean, well-documented artifacts. Review what it produces to understand how ServiceNow works.

---

## Access and Availability

### How to Get Access

SN AI Agent is a web application. To get started:

1. **Visit the app** — open the URL in any modern browser
2. **Sign up** — enter your email. If you're a new user, you'll receive a one-time verification code. If your organization uses invite codes, use the invite link provided by your admin.
3. **Set your password** — after verification, set a password for future logins
4. **Connect your instance** — enter your ServiceNow instance URL, username, and password

### Access Tiers

| Tier | Who | Daily Limit | How to Get |
|------|-----|-------------|------------|
| Anonymous | Anyone, no sign-in | Low (admin-configurable) | Just use the app |
| Authenticated | Signed-in users | Higher (admin-configurable) | Sign up with email |
| BYOK | Users with own API key | Unlimited | Add your Anthropic or OpenRouter key in settings |

### AI Providers

You can choose between two AI providers:

- **Anthropic (Claude)** — the default. Claude models are purpose-built for tool use, reasoning, and following complex instructions. The app uses prompt caching to reduce costs and latency.
- **OpenRouter** — gives you access to models from multiple providers. The app filters to only show models that support tool calling, reasoning, and have sufficient context length for complex ServiceNow work.

### For Admins

If you're an admin, you have access to a management panel where you can:

- Approve or reject new user signups
- Suspend or reactivate user accounts
- Configure daily request limits for each access tier
- Generate invite codes with optional expiry and usage limits
- Create site-wide banners for announcements
- View session logs and usage statistics
- Manage trial configurations

---

## What Makes It Different

### Spec-Driven, Not Prompt-and-Pray

Most AI coding tools generate code from a prompt and hand it to you. SN AI Agent follows a full SDLC — spec, design, implementation, testing, deployment — with human approval at critical gates. This produces auditable, documented, reviewable work.

### Instance-Aware, Not Generic

The AI doesn't generate ServiceNow code in a vacuum. It queries your actual instance to understand what exists, what tables are in use, what business rules are already active, and what scope to work in. This means it avoids conflicts, follows existing patterns, and builds on what's already there.

### Reliable Artifact Capture

One of the hardest problems in ServiceNow REST API development is ensuring artifacts land in the right update set. SN AI Agent solves this with a three-layer defense strategy — session-based capture, post-creation move, and a server-side GlideUpdateManager2 fallback — so every artifact is reliably captured regardless of platform quirks.

### Full Analysis Suite

Beyond building, the system includes 14 analysis tools that can score instance health, detect anti-patterns, find dead code, map dependencies, predict conflicts, and assess upgrade readiness. This makes it valuable even if you never use it to build anything — just connect and run an analysis.

### Transparent Execution

You see exactly what the AI is doing at every step. Every tool call is logged, timed, and displayed in the chat. There are no hidden operations. If something goes wrong, you can see where and why.

---

## Getting Started — What to Try First

If you're new to SN AI Agent, here are some good starting points:

1. **Connect to your instance** and explore the personalized suggestions in the "For You" and "Explore" tabs. These are generated from your actual instance data and give you a sense of what the AI knows about your environment.

2. **Ask the AI to analyze your instance.** Try: *"Analyze my instance health and give me a summary of customization areas."* This runs a comprehensive scan and gives you a baseline understanding of your instance.

3. **Build something small.** Try: *"Create a business rule on the incident table that sets the priority to 1 when the impact is 1-High and the urgency is 1-High."* Watch the AI go through the spec → design → implementation process and see how the approval gates work.

4. **Explore existing artifacts.** Try: *"Show me all active business rules on the incident table and summarize what each one does."* This demonstrates the AI's ability to query and interpret your instance data.

5. **Try the analysis tools.** Try: *"Detect anti-patterns in the business rules on my instance"* or *"Find dead code — unused script includes and inactive business rules."*

6. **Attach a document.** Upload a requirements document (PDF or Word) and ask: *"Read this requirements document and create a spec for implementing it in ServiceNow."*

Take a look at your current ServiceNow backlog and identify a few tasks you might want to try with SN AI Agent. The best way to understand what it can do is to use it on real work.
