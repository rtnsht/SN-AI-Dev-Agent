# SN AI Dev Agent - Brownfield Enhancement Plan

## Document Control

| Field | Value |
|-------|-------|
| **Document ID** | PLAN-BROWNFIELD-001 |
| **Version** | 1.0 |
| **Status** | Draft - Planning Phase |
| **Created** | 2026-01-14 |
| **Author** | AI-Assisted Planning Session |

---

## 1. Executive Vision

Transform the SN AI Dev Agent into an **intelligent brownfield implementation partner** that embodies a **people-first philosophy** - empowering ServiceNow developers of all levels to deliver high-quality, upgrade-safe, and maintainable solutions while respecting existing customizations.

### 1.1 Core Mission Statement

> "Enable any ServiceNow developer to work with the confidence of a senior architect, the precision of a quality engineer, and the foresight of a platform owner - all while respecting the existing landscape."

---

## 2. Target Users & Personas

### 2.1 Primary Users
- **Junior ServiceNow Developers** - Need guidance, guardrails, and education
- **Senior ServiceNow Developers** - Need efficiency, impact analysis, and best practices enforcement
- **ServiceNow Architects** - Need high-level views, dependency mapping, and strategic recommendations

### 2.2 Supported Personas (All Must Be Addressed)

| Persona | Primary Needs | Agent Capabilities Required |
|---------|---------------|----------------------------|
| **Platform Architect** | High-level impact analysis, dependency maps, upgrade readiness | Instance health dashboards, architecture diagrams, risk scoring |
| **Developer** | Code generation, best practices, brownfield-safe development | Smart code gen, conflict detection, pattern suggestions |
| **Admin** | Configuration assistance, safe changes | Guided configuration, rollback support, validation |
| **Business Analyst** | Requirement capture, gap analysis | Natural language processing, existing capability mapping |
| **QA Engineer** | Test case generation, regression analysis | ATF generation, impact-based test suites, coverage analysis |
| **Project Manager** | Estimation, tracking, risk visibility | Effort estimation, progress tracking, risk dashboards |

---

## 3. People Philosophy Framework (4G Framework)

### 3.1 🛡️ GUARDRAILS - Prevent Bad Practices

**Principle**: Stop problems before they happen. Zero tolerance for anti-patterns.

| Guardrail Category | Examples |
|-------------------|----------|
| **Code Quality** | No GlideRecord in client scripts, no hardcoded sys_ids, proper null checks |
| **Performance** | Query optimization, async pattern enforcement, batch processing |
| **Security** | ACL validation, input sanitization, role-based access |
| **Upgrade Safety** | No OOTB script modifications, proper extension patterns |
| **Naming Conventions** | Consistent prefixes, descriptive names, scope awareness |

**Implementation Approach**:
- Pre-commit validation hooks
- Real-time code analysis during generation
- Block deployment of non-compliant code
- Severity levels: ERROR (blocks), WARNING (requires acknowledgment), INFO (educational)

### 3.2 🧭 GUIDANCE - Suggest Better Approaches

**Principle**: Educate while developing. Every interaction is a learning opportunity.

| Guidance Type | Description |
|--------------|-------------|
| **Pattern Suggestions** | "Consider using a Script Include for reusability" |
| **Alternative Approaches** | "Flow Designer might be better than Business Rule for this use case" |
| **Best Practice Tips** | Contextual tips explaining WHY, not just WHAT |
| **Documentation Links** | Auto-link to relevant ServiceNow docs and community articles |
| **Code Explanations** | Explain generated code for learning |

**Implementation Approach**:
- Contextual tooltips and explanations
- "Did you know?" prompts
- Alternative solution comparisons
- Skill-level adaptive messaging (verbose for juniors, concise for seniors)

### 3.3 📋 GOVERNANCE - Require Approvals & Track Audit Trails

**Principle**: Full traceability. Nothing happens without accountability.

| Governance Aspect | Implementation |
|------------------|----------------|
| **Approval Gates** | Spec approval, design approval, deployment approval |
| **Change Tracking** | Every artifact change logged with timestamp, user, reason |
| **Audit Trail** | Full history of AI decisions and human confirmations |
| **Sign-off Workflow** | Digital signatures for phase completion |
| **Rollback Capability** | Point-in-time recovery for any change |

**Implementation Approach**:
- Mandatory approval checkpoints before phase transitions
- Immutable audit logs
- Integration with ServiceNow's native approval workflows
- Export capability for compliance audits

### 3.4 💪 EMPOWERMENT - Junior Devs Productive Like Seniors

**Principle**: Democratize expertise. Level the playing field.

| Empowerment Feature | Description |
|--------------------|-------------|
| **Contextual Knowledge** | Surface relevant existing code and patterns |
| **Smart Defaults** | Pre-filled best practice configurations |
| **Error Prevention** | Catch mistakes before they happen |
| **Confidence Scoring** | Show confidence level of AI suggestions |
| **Mentorship Mode** | Explain decisions in detail for learning |

**Implementation Approach**:
- Adaptive UI based on user experience level
- Progressive disclosure of complexity
- Built-in tutorials and walkthroughs
- Success templates from previous implementations

---

## 4. Brownfield Capabilities

### 4.1 🔍 Understanding Existing Customizations

**Current State**: Basic context gathering (tables, fields, scripts)

**Enhanced Capabilities**:

| Capability | Description | Priority |
|-----------|-------------|----------|
| **Customization Inventory** | Complete catalog of all non-OOTB artifacts | P0 |
| **Code Archaeology** | Understand purpose of undocumented code | P0 |
| **Dependency Mapping** | Visual graph of artifact relationships | P0 |
| **OOTB Override Detection** | Identify modified out-of-box elements | P0 |
| **Scope Analysis** | Map artifacts to application scopes | P1 |
| **Dead Code Detection** | Find unused scripts and artifacts | P1 |
| **Documentation Generator** | Auto-generate docs for existing code | P1 |

### 4.2 ⚡ Impact Analysis of Changes

**Current State**: Manual analysis required

**Enhanced Capabilities**:

| Capability | Description | Priority |
|-----------|-------------|----------|
| **Change Impact Preview** | "What will be affected if I modify X?" | P0 |
| **Dependency Cascade** | Show downstream effects of changes | P0 |
| **Conflict Detection** | Identify overlapping business rules, scripts | P0 |
| **Execution Order Analysis** | Predict order of rule execution | P1 |
| **Reference Tracking** | Find all references to a field/table | P0 |
| **Breaking Change Alerts** | Warn about backward compatibility issues | P0 |

### 4.3 🔧 Technical Debt Identification

**Current State**: Not implemented

**Enhanced Capabilities**:

| Capability | Description | Priority |
|-----------|-------------|----------|
| **Code Quality Scoring** | Rate existing code quality (A-F scale) | P0 |
| **Anti-Pattern Detection** | Find common bad practices | P0 |
| **Complexity Analysis** | Cyclomatic complexity, nesting depth | P1 |
| **Duplication Finder** | Identify copy-paste code | P1 |
| **Performance Hotspots** | Find slow queries, synchronous calls | P0 |
| **Debt Remediation Plans** | Suggest refactoring priorities | P1 |
| **Tech Debt Dashboard** | Aggregate view of instance health | P1 |

### 4.4 🔄 Upgrade Compatibility

**Current State**: Not implemented

**Enhanced Capabilities**:

| Capability | Description | Priority |
|-----------|-------------|----------|
| **Upgrade Risk Assessment** | Score risk for upcoming upgrades | P0 |
| **Deprecated API Usage** | Find soon-to-be-obsolete APIs | P0 |
| **OOTB Collision Check** | Predict conflicts with new release | P1 |
| **Skipped Update Tracking** | Manage skipped updates safely | P1 |
| **Upgrade Simulation** | Preview potential issues | P2 |
| **Migration Recommendations** | Suggest migration paths (Workflow→Flow) | P1 |

### 4.5 🚀 Performance Issues from Existing Code

**Current State**: Not implemented

**Enhanced Capabilities**:

| Capability | Description | Priority |
|-----------|-------------|----------|
| **Slow Transaction Detection** | Identify performance bottlenecks | P0 |
| **Query Optimization Suggestions** | Fix inefficient GlideRecord usage | P0 |
| **Async Opportunity Detection** | Suggest async patterns | P1 |
| **Resource Contention Analysis** | Find lock contention issues | P2 |
| **Caching Recommendations** | Suggest caching strategies | P1 |
| **Load Testing Guidance** | Recommend load test scenarios | P2 |

---

## 5. Instance Intelligence (Deep + Predictive)

### 5.1 Deep Analysis Capabilities

```
┌─────────────────────────────────────────────────────────────────┐
│                    INSTANCE INTELLIGENCE LAYERS                 │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: PREDICTIVE                                            │
│  ├── Conflict prediction before changes                         │
│  ├── Refactoring recommendations                                │
│  ├── Upgrade impact forecasting                                 │
│  └── Performance degradation warnings                           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: DEEP ANALYSIS                                         │
│  ├── Code quality assessment                                    │
│  ├── Dependency graph analysis                                  │
│  ├── Anti-pattern detection                                     │
│  ├── Security vulnerability scanning                            │
│  └── Business logic extraction                                  │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: ARTIFACT COLLECTION (Current State)                   │
│  ├── Tables, fields, relationships                              │
│  ├── Business rules, script includes                            │
│  ├── Client scripts, UI policies                                │
│  └── ACLs, flows, workflows                                     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Predictive Capabilities

| Prediction Type | Description |
|-----------------|-------------|
| **Conflict Prediction** | Before you make a change, predict what will conflict |
| **Regression Risk** | Likelihood that change causes regression |
| **Performance Impact** | Predict performance effect of new code |
| **Maintenance Cost** | Estimate future maintenance burden |
| **Upgrade Blockers** | Predict what will block next upgrade |

---

## 6. Conflict Resolution Strategy

### 6.1 Core Principle
> **"Always surface, never surprise. User confirms all significant actions."**

### 6.2 Conflict Handling Matrix

| Conflict Type | Detection | User Interaction | Resolution Options |
|--------------|-----------|------------------|-------------------|
| **Business Rule Overlap** | Auto-detect | Alert + Explain | Merge / Reorder / Separate |
| **Script Conflicts** | Auto-detect | Show diff + Impact | User chooses resolution |
| **Field Conflicts** | Auto-detect | Confirm action | Extend / Override / Skip |
| **ACL Conflicts** | Auto-detect | Security review required | Merge / Prioritize |
| **Performance Conflicts** | Analyze | Recommend + Confirm | Apply recommendation |

### 6.3 Confirmation Levels

```
┌────────────────────────────────────────────────────────────────┐
│                    CONFIRMATION HIERARCHY                       │
├────────────────────────────────────────────────────────────────┤
│  CRITICAL (Red)     │ Multi-step confirmation + reason         │
│  ├── OOTB modifications                                        │
│  ├── Security changes                                          │
│  └── Production deployments                                    │
├────────────────────────────────────────────────────────────────┤
│  IMPORTANT (Yellow) │ Single confirmation                      │
│  ├── New artifact creation                                     │
│  ├── Cross-scope changes                                       │
│  └── Update set completion                                     │
├────────────────────────────────────────────────────────────────┤
│  STANDARD (Green)   │ Proceed with notification                │
│  ├── Read operations                                           │
│  ├── Test environment changes                                  │
│  └── Documentation updates                                     │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Multi-Instance Awareness

### 7.1 Phase 1: Dev → Test → Prod Promotion (Current Focus)

| Capability | Description | User Interaction |
|-----------|-------------|------------------|
| **Instance Registry** | Configure multiple instances | Setup wizard |
| **Environment Comparison** | Diff between environments | On-demand |
| **Promotion Workflow** | Guided update set promotion | Step-by-step with confirmations |
| **Pre-flight Checks** | Validate before promotion | Auto with gate |
| **Rollback Support** | Revert failed promotions | Guided rollback |

### 7.2 Phase 2: Instance Comparison (Later Phase)

| Capability | Description |
|-----------|-------------|
| **Full Instance Diff** | Compare all customizations between instances |
| **Drift Detection** | Alert when environments diverge |
| **Sync Recommendations** | Suggest what to sync |
| **Baseline Management** | Track instance baselines |

---

## 8. Architecture Enhancement Areas

### 8.1 New Components Required

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ENHANCED ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Persona   │  │   4G        │  │  Instance   │  │  Multi-Inst │   │
│  │   Engine    │  │  Framework  │  │  Analyzer   │  │  Manager    │   │
│  │             │  │             │  │             │  │             │   │
│  │ • Role      │  │ • Guardrail │  │ • Deep      │  │ • Registry  │   │
│  │   detection │  │ • Guidance  │  │   Analysis  │  │ • Promotion │   │
│  │ • Adaptive  │  │ • Govern    │  │ • Predict   │  │ • Compare   │   │
│  │   UX        │  │ • Empower   │  │ • Score     │  │ • Sync      │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │           │
│  ───────┴────────────────┴────────────────┴────────────────┴────────  │
│                                                                         │
│                    ┌─────────────────────────┐                         │
│                    │   ENHANCED ORCHESTRATOR │                         │
│                    │                         │                         │
│                    │  • Persona-aware flows  │                         │
│                    │  • 4G enforcement       │                         │
│                    │  • Impact integration   │                         │
│                    │  • Audit logging        │                         │
│                    └───────────┬─────────────┘                         │
│                                │                                        │
│  ──────────────────────────────┴───────────────────────────────────── │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐  │
│  │                    EXISTING MCP SERVER                          │  │
│  │  (50+ tools: records, scripts, update sets, ACLs, catalog...)   │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 New MCP Tools Required

| Tool Category | New Tools |
|--------------|-----------|
| **Analysis** | `sn_analyze_instance`, `sn_get_dependency_graph`, `sn_find_anti_patterns` |
| **Impact** | `sn_impact_preview`, `sn_find_conflicts`, `sn_execution_order` |
| **Quality** | `sn_code_quality_score`, `sn_find_tech_debt`, `sn_performance_scan` |
| **Upgrade** | `sn_upgrade_readiness`, `sn_find_deprecated`, `sn_skipped_updates` |
| **Multi-Inst** | `sn_compare_instances`, `sn_promote_update_set`, `sn_validate_promotion` |

---

## 9. Implementation Phases

### Phase 0: Foundation (Current + Immediate)
**Duration**: Completed + 2 weeks
**Focus**: Stabilize current capabilities, add persona awareness

| Task | Status | Notes |
|------|--------|-------|
| MCP Server with 50+ tools | ✅ Done | |
| Basic context gathering | ✅ Done | |
| Spec-driven SDLC templates | ✅ Done | |
| Update set management | ✅ Done | |
| Persona detection engine | 🔲 New | |
| 4G Framework scaffolding | 🔲 New | |

### Phase 1: Deep Instance Intelligence
**Duration**: 4-6 weeks
**Focus**: Understand brownfield instances deeply

| Task | Priority | Effort |
|------|----------|--------|
| Enhanced context gatherer (full artifact inventory) | P0 | L |
| OOTB override detection | P0 | M |
| Dependency graph builder | P0 | L |
| Code quality analyzer | P0 | L |
| Anti-pattern detection engine | P0 | M |
| Dead code finder | P1 | M |

### Phase 2: Impact Analysis & Guardrails
**Duration**: 4-6 weeks
**Focus**: Prevent problems, surface impacts

| Task | Priority | Effort |
|------|----------|--------|
| Change impact preview engine | P0 | L |
| Conflict detection system | P0 | L |
| Guardrail rule engine | P0 | M |
| Best practice validation | P0 | M |
| Breaking change alerts | P0 | M |
| Audit logging system | P0 | M |

### Phase 3: Governance & Empowerment
**Duration**: 3-4 weeks
**Focus**: Approval workflows, user empowerment

| Task | Priority | Effort |
|------|----------|--------|
| Approval gate system | P0 | M |
| Confirmation hierarchy | P0 | S |
| Skill-adaptive messaging | P1 | M |
| Documentation generator | P1 | M |
| Mentorship mode | P1 | M |
| Smart defaults system | P1 | S |

### Phase 4: Multi-Instance & Promotion
**Duration**: 3-4 weeks
**Focus**: Cross-environment workflows

| Task | Priority | Effort |
|------|----------|--------|
| Instance registry | P0 | M |
| Promotion workflow | P0 | L |
| Pre-flight validation | P0 | M |
| Rollback support | P0 | M |
| Instance comparison (Phase 2 item) | P2 | L |

### Phase 5: Predictive Intelligence
**Duration**: 4-6 weeks
**Focus**: Proactive insights

| Task | Priority | Effort |
|------|----------|--------|
| Upgrade readiness scoring | P0 | L |
| Performance prediction | P1 | L |
| Refactoring recommendations | P1 | M |
| Tech debt remediation plans | P1 | M |
| Conflict prediction | P1 | L |

---

## 10. Success Metrics

### 10.1 People Philosophy Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Guardrail Effectiveness** | 90% bad patterns caught | Pre-deployment validation |
| **Guidance Adoption** | 70% suggestions accepted | Tracking user choices |
| **Governance Compliance** | 100% audit trail coverage | Audit log completeness |
| **Empowerment Impact** | 50% faster junior dev onboarding | Time-to-productivity |

### 10.2 Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Instance Analysis Coverage** | 95% artifacts cataloged | Inventory completeness |
| **Impact Prediction Accuracy** | 85% conflicts predicted | Post-deployment validation |
| **Code Quality Improvement** | 20% quality score increase | Before/after scoring |
| **Upgrade Readiness Improvement** | 30% fewer upgrade issues | Upgrade success rate |

---

## 11. Open Questions & Decisions Needed

| # | Question | Options | Decision |
|---|----------|---------|----------|
| 1 | Persona detection method? | User profile / Self-select / Behavior-based | TBD |
| 2 | Guardrail severity configuration? | Global / Per-project / Per-user | TBD |
| 3 | Audit log storage? | Local JSON / ServiceNow table / External DB | TBD |
| 4 | Multi-instance credentials? | Environment variables / Secure vault / OAuth | TBD |
| 5 | Code quality scoring algorithm? | Custom rules / Industry standard / ML-based | TBD |

---

## 12. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Performance overhead from deep analysis | Medium | High | Incremental analysis, caching |
| False positives in conflict detection | Medium | Medium | User feedback loop, tuning |
| Credential security across instances | Low | Critical | Secure vault, OAuth, rotation |
| User resistance to guardrails | Medium | Medium | Configurable strictness, education |
| Scope creep | High | Medium | Phased approach, clear boundaries |

---

## 13. Next Steps

### Immediate Actions (This Week)
1. [ ] Review and approve this plan
2. [ ] Prioritize Phase 1 tasks
3. [ ] Define persona detection approach
4. [ ] Set up enhancement tracking (GitHub issues / ServiceNow stories)

### Short-term (Next 2 Weeks)
1. [ ] Create detailed technical design for Instance Analyzer
2. [ ] Define guardrail rule schema
3. [ ] Prototype dependency graph visualization
4. [ ] Set up multi-instance test environment

---

## Appendix A: Persona Interaction Examples

### A.1 Junior Developer Experience

```
┌─────────────────────────────────────────────────────────────────┐
│ 👋 Welcome, Developer!                                          │
│                                                                 │
│ You're about to create a Business Rule on the Incident table.  │
│                                                                 │
│ 📊 Instance Context:                                            │
│ • 12 existing Business Rules on Incident                        │
│ • 3 potential conflicts detected                                │
│ • Recommended order: 150 (after assignment rules)               │
│                                                                 │
│ 💡 Tip: This table has async rules for notifications.           │
│    Consider making your rule async if it's not time-critical.  │
│                                                                 │
│ ⚠️ Guardrails Active:                                           │
│ • No GlideRecord in client scripts                              │
│ • Null checks required for reference fields                     │
│ • Async recommended for external calls                          │
│                                                                 │
│ [Continue with Guidance] [Show Me Existing Rules] [Cancel]      │
└─────────────────────────────────────────────────────────────────┘
```

### A.2 Architect Experience

```
┌─────────────────────────────────────────────────────────────────┐
│ 📐 Architecture View - Incident Ecosystem                       │
│                                                                 │
│ Tables: incident → task → problem → change_request              │
│ Business Rules: 47 custom | 23 OOTB modified                   │
│ Script Includes: 12 (3 with circular dependencies)             │
│ Tech Debt Score: C (Moderate - 23 issues)                      │
│ Upgrade Risk: Medium (5 deprecated APIs in use)                │
│                                                                 │
│ 🎯 Quick Actions:                                               │
│ [View Dependency Graph] [Export Analysis] [Plan Remediation]   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Appendix B: 4G Framework Implementation Details

### B.1 Guardrail Rule Schema

```json
{
  "guardrails": [
    {
      "id": "GR-001",
      "name": "No GlideRecord in Client Scripts",
      "category": "performance",
      "severity": "ERROR",
      "pattern": "GlideRecord.*in.*client_script",
      "message": "GlideRecord is not available in client scripts. Use GlideAjax instead.",
      "documentation": "https://docs.servicenow.com/...",
      "autoFix": {
        "available": true,
        "template": "glideajax_conversion"
      }
    }
  ]
}
```

### B.2 Audit Log Schema

```json
{
  "auditLog": {
    "timestamp": "2026-01-14T10:30:00Z",
    "user": "developer@company.com",
    "persona": "developer",
    "action": "create_business_rule",
    "artifact": {
      "type": "sys_script",
      "name": "Set Priority on VIP",
      "table": "incident"
    },
    "context": {
      "requirement": "REQ-004",
      "updateSet": "REQ-004_20260114"
    },
    "guardrails": {
      "passed": ["GR-001", "GR-002"],
      "warnings": ["GR-005"],
      "blocked": []
    },
    "confirmation": {
      "required": true,
      "level": "IMPORTANT",
      "confirmed": true,
      "confirmedAt": "2026-01-14T10:30:15Z"
    }
  }
}
```

---

*Document End - Version 1.0*

