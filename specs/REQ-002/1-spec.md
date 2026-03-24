# REQ-002: Multi-Agent Harness for Long-Running SDLC Sessions

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Author** | AI Agent |
| **Created** | 2026-03-24 |
| **Last Updated** | 2026-03-24 |
| **Version** | 1.0 |
| **Status** | Draft |

---

## 1. Executive Summary

This requirement introduces a multi-agent harness architecture — inspired by Anthropic's research on [harness design for long-running applications](https://www.anthropic.com/engineering/harness-design-long-running-apps) — into the SN AI Agent platform. The current single-agent tool-use loop degrades on complex, multi-phase SDLC tasks as context windows fill, self-evaluation is unreliable, and there is no structured quality gate between generation and verification. By separating planning, generation, and evaluation into distinct agent roles with explicit handoff artifacts, the platform can sustain coherent multi-hour autonomous ServiceNow development sessions with measurably higher output quality.

---

## 2. Problem Statement

### 2.1 Current State

The SN AI Agent uses a **single-agent architecture** (`sn-engine.ts`) where one LLM session handles all SDLC phases — from spec authoring through deployment. The `task-planner.ts` module provides plan-then-execute structure but runs within the same context window. Key limitations:

- **Context degradation**: As the context window fills with tool results, conversation history, and intermediate artifacts, the agent loses coherence on later phases. The engine uses progressive compression (`MAX_CONTEXT_TOKENS` trimming) but compression is lossy.
- **No self-evaluation separation**: The same agent that produces code is asked to judge its quality. Per Anthropic's findings, agents "tend to respond by confidently praising the work—even when, to a human observer, the quality is obviously mediocre."
- **No structured context resets**: When sessions span spec → design → implementation → testing, earlier phases consume tokens that crowd out later phases. There is no mechanism to cleanly reset context while preserving state.
- **Rigid round limits**: Phase-specific round limits (`engine_config` or tool-def fallbacks) act as blunt timeout controls rather than intelligent session boundaries.
- **No sprint contracts**: The generator has no pre-agreed success criteria with a separate evaluator; the human user is the only QA checkpoint.

### 2.2 Desired State

A three-agent harness architecture where:

1. **Planner Agent** expands brief user prompts into comprehensive SDLC specs (ambitious scope, product context, high-level technical direction — not granular implementation details that cascade errors downstream).
2. **Generator Agent** implements features in structured sprints, working against sprint contracts that define "done" criteria before code is written.
3. **Evaluator Agent** independently tests and grades each sprint's output using the Playwright MCP and ServiceNow-specific validation tools, with calibrated scoring criteria and hard failure thresholds.

Each agent operates with clean context boundaries. Handoff between agents uses structured file-based artifacts (not conversation history), enabling context resets that eliminate context anxiety and degradation.

### 2.3 Business Impact

| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Complex requirement completion rate | ~60% (manual intervention needed) | >85% autonomous | +25% |
| Output quality (bugs found post-deploy) | High (no systematic QA) | Low (evaluator catches before deploy) | Significant reduction |
| Max autonomous session length | ~30 min effective (context degradation) | Multi-hour (context resets) | 4-6x |
| Time to detect implementation drift | Manual review (human gate) | Per-sprint automated eval | Near real-time |
| Spec completeness from brief prompts | Variable (depends on user detail) | Consistently high (planner expansion) | Standardized |

---

## 3. Business Requirements

| ID | Requirement | Priority | Rationale |
|----|-------------|----------|-----------|
| BR-001 | The platform shall support multi-agent orchestration with distinct Planner, Generator, and Evaluator roles | Must Have | Core architectural change enabling all other improvements |
| BR-002 | Agents shall communicate via structured file-based artifacts, not shared conversation history | Must Have | Enables clean context resets; prevents context degradation |
| BR-003 | The Evaluator shall independently verify Generator output using live testing (Playwright MCP, SN API validation) | Must Have | Separating generation from evaluation is the key insight from Anthropic's research |
| BR-004 | The system shall support configurable sprint contracts negotiated between Generator and Evaluator before implementation | Should Have | Pre-agreed success criteria dramatically improve eval reliability |
| BR-005 | The Planner shall expand brief prompts into full SDLC specs with ambitious scope and AI feature opportunities | Should Have | Automates the spec phase; reduces user effort |
| BR-006 | The harness shall support graceful degradation to single-agent mode for simple tasks | Should Have | Not all tasks warrant multi-agent overhead |
| BR-007 | The evaluator shall use calibrated scoring criteria with few-shot examples and hard failure thresholds | Must Have | Uncalibrated LLM evaluators are too lenient (Anthropic finding) |
| BR-008 | Telemetry shall capture per-agent metrics (duration, cost, tokens, pass/fail rates) | Should Have | Enables harness optimization over time |

---

## 4. Functional Requirements

| ID | Requirement | Acceptance Criteria | Dependencies |
|----|-------------|---------------------|--------------|
| FR-001 | **Agent Orchestrator**: New orchestration layer that manages agent lifecycle, dispatches work, and handles handoffs | Orchestrator can run Planner → Generator → Evaluator sequence with file-based handoffs; can restart any agent on failure | New module in `webapp/src/lib/` |
| FR-002 | **Planner Agent**: Takes user prompt (1-4 sentences), produces full SDLC spec as structured artifact | Given a brief prompt, planner produces `1-spec.md` conforming to template with ≥5 functional requirements, user stories, and architecture hints | `templates/spec.md` |
| FR-003 | **Generator Agent**: Implements features in sprints against sprint contracts | Generator creates implementation artifacts, self-evaluates before handoff, writes sprint report artifact | `sn-engine.ts`, MCP tools |
| FR-004 | **Evaluator Agent**: Tests running implementation via Playwright MCP and SN API tools, grades against criteria | Evaluator navigates live pages/APIs, produces scored assessment with per-criterion grades and actionable feedback | Playwright MCP, SN validation tools |
| FR-005 | **Sprint Contract Negotiation**: Generator proposes what "done" looks like; Evaluator reviews and amends before implementation begins | Contract file contains testable success criteria; both agents iterate until agreement | FR-001 orchestrator |
| FR-006 | **Context Reset Protocol**: Clean handoff between agent sessions using structured artifacts | Agent can pick up work from handoff artifact alone; no conversation history needed; demonstrated via agent B completing work started by agent A | New handoff artifact schema |
| FR-007 | **Scoring Criteria System**: Configurable evaluation rubrics with weighted dimensions and failure thresholds | Criteria file defines dimensions (functionality, code quality, SN best practices, security), weights, and minimum thresholds; evaluator grades against it | FR-004 evaluator |
| FR-008 | **Adaptive Complexity Router**: Analyzes task complexity to decide single-agent vs multi-agent execution | Simple tasks (≤2 artifacts, single phase) route to single-agent; complex tasks route to full harness | FR-001 orchestrator |
| FR-009 | **Handoff Artifact Schema**: Structured JSON/markdown files for inter-agent communication | Schema includes: completed work summary, pending tasks, environment state, sprint contract, evaluation results | FR-006 context reset |
| FR-010 | **Evaluator Calibration**: Few-shot examples and calibration prompts that align evaluator scoring with human judgment | Evaluator correctly fails known-bad examples and passes known-good examples in calibration suite | FR-007 scoring criteria |

---

## 5. Non-Functional Requirements

| ID | Category | Requirement | Target | Measurement |
|----|----------|-------------|--------|-------------|
| NFR-001 | Performance | Agent handoff latency (artifact write → next agent start) | < 5 seconds | Telemetry timestamps |
| NFR-002 | Cost Efficiency | Multi-agent overhead vs single-agent for equivalent task | < 3x cost for > 2x quality | Token cost comparison |
| NFR-003 | Reliability | Evaluator false-positive rate (passing bad work) | < 15% | Calibration test suite |
| NFR-004 | Reliability | Evaluator false-negative rate (failing good work) | < 10% | Calibration test suite |
| NFR-005 | Scalability | Support concurrent multi-agent sessions | ≥ 3 parallel sessions | Load testing |
| NFR-006 | Observability | Per-agent telemetry (duration, tokens, cost, outcomes) | 100% of sessions instrumented | Telemetry dashboard |
| NFR-007 | Maintainability | Scoring criteria updatable without code changes | Config file changes only | Manual verification |
| NFR-008 | Compatibility | Backward-compatible with existing single-agent chat flow | Zero regressions in existing `/api/chat` and `/api/chat-stream` | Integration tests |

---

## 6. User Stories

### US-001: Complex Requirement — Autonomous Multi-Sprint Build
**As a** ServiceNow developer  
**I want** the AI agent to autonomously plan, implement, and verify a complex requirement across multiple sprints  
**So that** I receive a fully tested implementation without needing to intervene at every step

**Acceptance Criteria:**
- [ ] Planner expands brief prompt into comprehensive spec
- [ ] Generator implements in ordered sprints with contracts
- [ ] Evaluator tests each sprint via live interaction
- [ ] Failed sprints are retried with evaluator feedback
- [ ] Final output passes all sprint contracts

### US-002: Quality Evaluation with Actionable Feedback
**As a** ServiceNow developer  
**I want** the evaluator to provide specific, actionable bug reports rather than vague praise  
**So that** I can trust the quality assessment and know exactly what needs fixing

**Acceptance Criteria:**
- [ ] Evaluator cites specific code locations for bugs
- [ ] Evaluator provides severity classification per issue
- [ ] Evaluator grades each sprint criterion as PASS/FAIL with evidence
- [ ] Score breakdown visible in telemetry dashboard

### US-003: Simple Task — Graceful Single-Agent Fallback
**As a** ServiceNow developer  
**I want** simple tasks (single business rule, quick field addition) to execute via the fast single-agent path  
**So that** I don't pay multi-agent overhead for trivial changes

**Acceptance Criteria:**
- [ ] Complexity router correctly classifies simple vs complex tasks
- [ ] Simple tasks use existing single-agent `sn-engine` path
- [ ] No regression in simple task latency or cost

### US-004: Context-Heavy Requirement Without Degradation
**As a** ServiceNow developer  
**I want** multi-phase requirements to maintain quality from spec through deployment  
**So that** the testing phase is as coherent as the spec phase, regardless of session length

**Acceptance Criteria:**
- [ ] Context resets occur between major phases
- [ ] Handoff artifacts carry sufficient state for clean pickup
- [ ] Later phases show no quality degradation vs earlier phases
- [ ] Total session can span 2+ hours without drift

### US-005: Sprint Contract Negotiation
**As a** ServiceNow developer  
**I want** the generator and evaluator to agree on testable "done" criteria before implementation begins  
**So that** evaluation is objective and specification gaps are caught early

**Acceptance Criteria:**
- [ ] Sprint contract file created before each implementation sprint
- [ ] Contract contains specific testable criteria (not vague goals)
- [ ] Evaluator references contract criteria in assessment
- [ ] Contract visible to user for transparency

---

## 7. Assumptions

| ID | Assumption | Risk if Invalid |
|----|------------|-----------------|
| A-001 | Anthropic Claude API supports sufficiently long sessions or compaction for each agent's individual context | Must fall back to more frequent context resets; harness complexity increases |
| A-002 | Playwright MCP can reliably interact with ServiceNow UI for evaluation | Evaluator limited to API-only testing; UI quality gaps missed |
| A-003 | File-based handoff artifacts provide sufficient context for clean agent pickup | Agent B produces lower quality work; more human intervention needed |
| A-004 | Cost increase for multi-agent (est. 2-3x) is acceptable for quality gain | Must optimize evaluator to fewer iterations or make multi-agent optional |
| A-005 | Evaluator calibration generalizes across ServiceNow artifact types | Need per-artifact-type calibration sets; maintenance burden increases |

---

## 8. Constraints

| ID | Constraint | Impact |
|----|------------|--------|
| C-001 | Must remain backward-compatible with existing single-agent chat flow | Cannot replace `sn-engine.ts`; must wrap/extend it |
| C-002 | Anthropic API rate limits and token costs | Multi-agent increases API calls 3-5x; need cost controls |
| C-003 | Existing SDLC phase gates must be preserved | Multi-agent operates within the phase gate framework, not outside it |
| C-004 | Webapp must remain stateless (credentials in POST body) per current architecture | Agent state must be in artifacts/files, not server-side sessions |
| C-005 | Evaluator cannot hear/see (audio/visual subjective assessment) | ServiceNow evaluation limited to functional/structural checks, not aesthetic |

---

## 9. Dependencies

| ID | Dependency | Type | Status |
|----|------------|------|--------|
| D-001 | Anthropic Claude API (Claude Agent SDK or direct API) | External | Available |
| D-002 | Playwright MCP for evaluator live testing | External | Available (referenced in article) |
| D-003 | Existing `sn-engine.ts` orchestration | Internal | Complete |
| D-004 | Existing `task-planner.ts` plan/execute framework | Internal | Complete |
| D-005 | MCP tool registry (115+ tools) | Internal | Complete |
| D-006 | Telemetry system (`telemetry-generator.ts`, `logger.ts`) | Internal | Complete |
| D-007 | SDLC phase gate system (`sdd-policy.ts`) | Internal | Complete |

---

## 10. Out of Scope

- Replacing the existing single-agent chat flow (it remains the default for simple tasks)
- Training or fine-tuning custom evaluation models (uses prompt-engineered Claude)
- GAN-style adversarial training loops (we adopt the architecture, not the ML training methodology)
- Cross-instance multi-agent orchestration (all agents target the same ServiceNow instance)
- Browser-based visual design evaluation (no screenshot-based aesthetic grading)
- Real-time collaborative multi-user agent sessions

---

## 11. Risks

| ID | Risk | Probability | Impact | Mitigation |
|----|------|-------------|--------|------------|
| R-001 | Evaluator is too lenient despite calibration (Anthropic's core finding) | High | High | Few-shot calibration with known-bad examples; hard failure thresholds; iterative prompt tuning |
| R-002 | Multi-agent cost exceeds acceptable budget for users | Medium | High | Adaptive complexity router; make multi-agent opt-in; cost controls with token budgets per agent |
| R-003 | Handoff artifacts lose critical context | Medium | Medium | Schema validation; completeness checks; test with real multi-sprint builds |
| R-004 | Sprint contract negotiation adds latency without proportional quality gain | Medium | Low | Make contracts optional for simple sprints; track negotiation duration vs quality delta |
| R-005 | Agent orchestration complexity increases maintenance burden | Medium | Medium | Clean separation of concerns; each agent is a standalone module; comprehensive telemetry |
| R-006 | Context anxiety persists despite resets (model-specific behavior) | Low | Medium | Monitor for premature wrap-up; tune reset triggers; test across model versions |

---

## 12. Glossary

| Term | Definition |
|------|------------|
| **Harness** | The orchestration layer and prompting infrastructure around LLM agents that shapes their behavior and manages their lifecycle |
| **Context Reset** | Clearing an agent's context window entirely and starting a fresh session with a structured handoff artifact |
| **Context Anxiety** | Model behavior where agents prematurely wrap up work as they approach perceived context limits |
| **Sprint Contract** | A pre-negotiated agreement between Generator and Evaluator defining testable "done" criteria for a unit of work |
| **Compaction** | Summarizing earlier conversation turns in-place to free context space (vs. full reset) |
| **GAN-inspired** | Architecture pattern inspired by Generative Adversarial Networks: separate generator and evaluator with feedback loops |
| **Scoring Criteria** | Configurable rubric dimensions (functionality, code quality, SN best practices, security) with weights and minimum thresholds |
| **Handoff Artifact** | Structured file (JSON/markdown) carrying completed work summary, pending tasks, environment state between agent sessions |
| **Complexity Router** | Decision logic that analyzes task characteristics to determine single-agent vs multi-agent execution path |

---

## Platform References

| # | Platform Feature | Documentation Area | Notes |
|---|------------------|--------------------|-------|
| 1 | Anthropic Harness Design | [Harness design for long-running apps](https://www.anthropic.com/engineering/harness-design-long-running-apps) | Primary inspiration; three-agent architecture |
| 2 | Anthropic Effective Harnesses | [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) | Earlier work on context resets and task decomposition |
| 3 | Anthropic Context Engineering | [Context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) | Context window management strategies |
| 4 | Anthropic Building Effective Agents | [Building effective agents](https://www.anthropic.com/research/building-effective-agents) | "Simplest solution" principle; complexity management |
| 5 | Claude Agent SDK | [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview) | Potential orchestration framework |
| 6 | Playwright MCP | Playwright Model Context Protocol | Live page testing for evaluator agent |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | 2026-03-24 | ☐ |
| Technical Reviewer | | | ☐ |
| Business Owner | | | ☐ |
| Approver | | | ☐ |

### Approval Status

> **Status:** ⬜ Draft

### Approval History

| Version | Date | Approver | Decision | Comments |
|---------|------|----------|----------|----------|
| 1.0 | 2026-03-24 | | | Initial draft based on Anthropic harness design research |
