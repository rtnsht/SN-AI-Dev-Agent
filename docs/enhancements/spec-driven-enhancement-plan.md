# Spec-Driven Enhancement Plan

## Document Control

| Field | Value |
|-------|--------|
| **Document ID** | PLAN-SPEC-ENH-001 |
| **Version** | 1.0 |
| **Status** | Implemented |
| **Created** | 2026-03-21 |
| **Scope** | Design-phase diagrams, testing-phase test case generation, validation, platform alignment |

---

## 1. Overview

This plan enhances the SN AI Agent’s **spec-driven SDLC** with:

1. **Design phase** — Automatic generation of Mermaid and text diagrams from design documents.
2. **Testing phase** — Structured test case generation (positive, negative, integration, security) from spec + design.
3. **Validation** — Quality checks for design diagrams and test plans in `scripts/validate.cjs`.
4. **Platform alignment** — Next.js 16 proxy migration, Node 24, and version pinning for consistent builds (including Docker).

The enhancement is **parallel-friendly**: diagram generation, test generation, and validation can be developed and run independently. It does **not** replace the existing phase-gate or sign-off process; it adds tooling and checks around Spec → Design → Implementation → Testing → Deployment.

---

## 2. Prerequisites (Stream 0)

These items were completed before or alongside the design/test pipelines.

### 2.1 Next.js 16 Proxy Migration

- **Problem:** Next.js 16 deprecated `middleware.ts`; using `crypto` in middleware caused Edge runtime build warnings.
- **Solution:** Migrate to `proxy.ts` with Node runtime.
- **Changes:**
  - `webapp/src/middleware.ts` → `webapp/src/proxy.ts`
  - Export `middleware()` → `proxy()`
  - Six documentation files updated to reference `proxy.ts`.

### 2.2 Node.js Version Alignment

- **Target:** Node 24 LTS for local dev, CI, and Docker.
- **Changes:**
  - **Dockerfile:** All stages use `node:24-alpine`.
  - **.nvmrc:** Set to `24` for local dev.
  - **engines.node:** `>=24.0.0` in root `package.json`, `mcp-servicenow/package.json`, and `webapp/package.json`.
  - **webapp:** `@types/node` set to `^24`.
- **Reference:** `docs/version-assessment.md` for rationale and LTS schedule.

---

## 3. Design Phase — Diagram Generation (Stream A)

### 3.1 Goal

Generate **five types of diagrams** from structured design content and insert them into `2-design.md` via `AUTO_DIAGRAM` markers.

### 3.2 Diagram Types

| Diagram | Mermaid Type | When Generated | Source Data |
|---------|-------------|----------------|-------------|
| System Context | `flowchart TD` | Always | Artifacts (Section 4.2) + integrations (Section 6) |
| Component | `flowchart LR` | Always | Artifacts grouped by layer |
| Sequence | `sequenceDiagram` | Always | Artifacts + integration flows |
| ER | `erDiagram` | When new tables exist | Data model (Section 5) |
| Data Flow | `flowchart LR` | When integrations exist | Integration points (Section 6) |

### 3.3 AUTO_DIAGRAM Markers

Design documents use placeholders that the enhancement script replaces with generated Mermaid (or text fallback):

```html
<!-- AUTO_DIAGRAM:system_context -->
<!-- AUTO_DIAGRAM:component -->
<!-- AUTO_DIAGRAM:sequence -->
<!-- AUTO_DIAGRAM:er -->
<!-- AUTO_DIAGRAM:data_flow -->
```

The template is in `templates/design.md` (Section 3 — Architecture). New requirements should follow this structure so `enhance-design.cjs` can find sections 4.2 (artifacts), 5 (data model), and 6 (integrations).

### 3.4 CLI Usage

```bash
# By requirement ID
node scripts/enhance-design.cjs --req REQ-001

# By file path
node scripts/enhance-design.cjs --file specs/REQ-001/2-design.md
```

### 3.5 Key Files (Design Pipeline)

| File | Purpose |
|------|---------|
| `src/core/diagram-generator.js` | Orchestrates generation of all diagram types |
| `src/core/diagram-templates.js` | Mermaid syntax templates per diagram type |
| `src/core/text-diagram-generator.js` | ASCII/text fallback when Mermaid is not available |
| `src/core/design-parser.js` | Parses `2-design.md` into structured data for diagrams |
| `templates/design.md` | Design template with Section 3 + AUTO_DIAGRAM markers |
| `scripts/enhance-design.cjs` | CLI: reads design, generates diagrams, replaces markers |
| `webapp/src/lib/system-prompt.ts` | `<design>` section expanded for diagram context |
| `src/core/solution-designer.js` | `generateDiagrams()` + markdown output for agent use |

---

## 4. Testing Phase — Test Case Generation (Stream B)

### 4.1 Goal

Generate a structured **test plan** (`4-testing/test-plan.md`) from `1-spec.md` and `2-design.md`, with categorized test cases and a coverage matrix.

### 4.2 Test Case Categories

| Category | Purpose | ID Pattern | Priority |
|----------|---------|------------|----------|
| Positive | Happy path, valid inputs, role-based success | TC-P### | High–Medium |
| Negative | Error handling, invalid inputs, boundary violations | TC-N### | High–Medium |
| Integration | Cross-system data flow, failure handling | TC-I### | High |
| Security | ACL verification, PII checks, BLOCK-tier scan | TC-S### | High |

### 4.3 Coverage Requirements

- **Minimum 5 test cases** per functional requirement.
- **At least 40%** of test cases must be negative (TC-N###).
- Every functional requirement has at least one positive test case.
- Each test case includes: preconditions, steps (action + expected result), and requirement traceability.

### 4.4 CLI Usage

```bash
node scripts/generate-test-plan.cjs --req REQ-001
```

Output: `specs/REQ-XXX/4-testing/test-plan.md` with categorized test cases and coverage matrix.

### 4.5 Key Files (Test Pipeline)

| File | Purpose |
|------|---------|
| `src/core/test-case-generator.js` | Main generator — builds positive, negative, integration, security cases |
| `src/core/test-patterns.js` | Reusable pattern library for all test categories |
| `src/core/positive-test-generator.js` | Happy path, boundary, multi-role positive cases |
| `src/core/negative-test-generator.js` | Error handling, invalid input, unauthorized access |
| `src/core/test-categorizer.js` | Categorize by type/priority/automation; build coverage matrix |
| `templates/test-plan.md` | Test plan template structure |
| `scripts/generate-test-plan.cjs` | CLI: reads spec + design, generates test plan |
| `webapp/src/lib/system-prompt.ts` | `<testing>` section expanded for test strategy |
| `src/core/solution-designer.js` | `generateTestCases()` using dynamic require + generators |

---

## 5. Validation (Stream C)

### 5.1 Diagram Validation

`scripts/validate.cjs` checks design documents for:

- Presence of **Mermaid** diagram blocks (or generated content from AUTO_DIAGRAM).
- **At least 3** diagram types: system context, component, sequence.
- If AUTO_DIAGRAM markers exist but no diagrams, suggests: `node scripts/enhance-design.cjs --req REQ-XXX`.

### 5.2 Test Plan Validation

The same script checks test plans for:

- **Minimum 5 test cases** (IDs matching `TC-XXX` pattern).
- **Negative ratio** ≥ 40% (TC-N### vs total).
- **Content quality:** preconditions, test steps (action/expected result), coverage matrix.

### 5.3 Running Validation

```bash
# All requirements
node scripts/validate.cjs

# Single requirement
node scripts/validate.cjs REQ-001

# Pre-deploy checks
node scripts/validate.cjs --pre-deploy REQ-001
```

---

## 6. Agent Integration (CLAUDE.md)

Sections **19** and **20** of `CLAUDE.md` are the canonical reference for AI agents:

- **Section 19 — Design Phase Diagram Generation:** Diagram types, AUTO_DIAGRAM markers, CLI usage, key files.
- **Section 20 — Testing Phase Test Case Generation:** Test categories, coverage requirements, CLI usage, key files, validation rules.

Agents should use these sections when generating or updating design docs and test plans.

---

## 7. File Summary

| Area | Location | Files |
|------|----------|--------|
| Diagram core | `src/core/` | `diagram-generator.js`, `diagram-templates.js`, `text-diagram-generator.js`, `design-parser.js` |
| Test core | `src/core/` | `test-case-generator.js`, `test-patterns.js`, `positive-test-generator.js`, `negative-test-generator.js`, `test-categorizer.js` |
| Orchestration | `src/core/` | `solution-designer.js` (generateDiagrams, generateTestCases) |
| Templates | `templates/` | `design.md`, `test-plan.md` |
| Scripts | `scripts/` | `enhance-design.cjs`, `generate-test-plan.cjs`, `validate.cjs` |
| Webapp | `webapp/src/lib/` | `system-prompt.ts` (design + testing sections) |
| Platform | `webapp/src/` | `proxy.ts` (ex-middleware) |
| Versioning | repo root, package.json | `.nvmrc`, `engines.node`, `Dockerfile`, `docs/version-assessment.md` |

---

## 8. Workflow Summary

1. **Spec** — Author creates/updates `1-spec.md` (unchanged).
2. **Design** — Author creates/updates `2-design.md` using `templates/design.md` with AUTO_DIAGRAM markers.
3. **Enhance design** — Run `node scripts/enhance-design.cjs --req REQ-XXX` to generate and insert diagrams.
4. **Test plan** — Run `node scripts/generate-test-plan.cjs --req REQ-XXX` to generate `4-testing/test-plan.md`.
5. **Validate** — Run `node scripts/validate.cjs REQ-XXX` before implementation or deployment to ensure diagram and test quality.
6. **Implementation / Testing / Deployment** — Follow existing phase gates and sign-off rules (see CLAUDE.md Sections 3–5).

---

## 9. Related Documents

| Document | Purpose |
|----------|---------|
| `CLAUDE.md` (Sections 19–20) | Agent-facing diagram and test generation rules |
| `docs/version-assessment.md` | Node/Next.js versions, proxy migration, LTS schedule |
| `docs/BROWNFIELD-ENHANCEMENT-PLAN.md` | Brownfield/instance intelligence roadmap (separate from this plan) |
| `specs/config.properties` | Phase gate and sign-off configuration |
| `templates/design.md`, `templates/test-plan.md` | Design and test plan templates |

---

*Document End — Version 1.0*
