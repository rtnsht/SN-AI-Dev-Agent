# SN AI Agent - Brownfield Enhancement Plan

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

Transform the SN AI Agent into an **intelligent brownfield implementation partner** that embodies a **people-first philosophy** - empowering ServiceNow developers of all levels to deliver high-quality, upgrade-safe, and maintainable solutions while respecting existing customizations.

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

## 13. Implementation Order Decision

### Decision Made: 2026-01-18

**Chosen Approach: Option C - Core Capabilities First (Deep Instance Intelligence)**

### Rationale

The AI agent's effectiveness is directly proportional to its understanding of the instance. Without deep instance intelligence, the agent is partially blind:

| Current Capability | Status |
|-------------------|--------|
| Read tables, fields, scripts | ✅ Available |
| Distinguish OOTB vs custom | ❌ Missing |
| See dependency graphs | ❌ Missing |
| Detect anti-patterns | ❌ Missing |
| Know execution order of business rules | ❌ Missing |
| Predict conflicts before they happen | ❌ Missing |
| Identify technical debt hotspots | ❌ Missing |

**Core insight**: Guardrails need something to guard. Guidance needs context to guide. Building persona/4G framework first would be putting the cart before the horse.

### Approved Implementation Order

```
┌─────────────────────────────────────────────────────────────────┐
│                  IMPLEMENTATION ORDER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: Deep Instance Intelligence (Phase 1)     ← START HERE  │
│  ├── Enhanced Context Gatherer (full artifact inventory)        │
│  ├── OOTB Override Detection                                    │
│  ├── Dependency Graph Builder                                   │
│  └── Anti-Pattern Detection Engine                              │
│           ↓ provides data for                                   │
│                                                                  │
│  STEP 2: Guardrails & Impact Analysis (Phase 2)                 │
│  ├── Change Impact Preview Engine                               │
│  ├── Conflict Detection System                                  │
│  ├── Guardrail Rule Engine                                      │
│  └── Breaking Change Alerts                                     │
│           ↓ enables                                              │
│                                                                  │
│  STEP 3: Persona & 4G Framework (Phase 0 + 3)                   │
│  ├── Persona Detection Engine                                   │
│  ├── 4G Framework Integration                                   │
│  ├── Skill-Adaptive Messaging                                   │
│  └── Approval Gate System                                       │
│           ↓ completes                                            │
│                                                                  │
│  STEP 4: Multi-Instance & Predictive (Phase 4 + 5)              │
│  ├── Instance Registry & Promotion                              │
│  ├── Upgrade Readiness Scoring                                  │
│  └── Conflict Prediction                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 1 Priority Order (Deep Instance Intelligence)

| Priority | Capability | New MCP Tool | Effort | Status |
|----------|------------|--------------|--------|--------|
| 1.1 | Enhanced Context Gatherer | `sn_analyze_instance` | L | ✅ COMPLETE |
| 1.2 | OOTB Override Detection | `sn_detect_ootb_overrides` | M | ✅ COMPLETE |
| 1.3 | Dependency Graph Builder | `sn_get_dependency_graph` | L | ✅ COMPLETE |
| 1.4 | Anti-Pattern Detection | `sn_find_anti_patterns` | M | ✅ COMPLETE |
| 1.5 | Code Quality Analyzer | `sn_code_quality_score` | L | ✅ COMPLETE |
| 1.6 | Dead Code Finder | `sn_find_dead_code` | M | ✅ COMPLETE |

### 1.1 `sn_analyze_instance` - COMPLETED (2026-01-18) - ENHANCED

**Comprehensive Coverage - 150+ Artifact Types across 40+ Categories:**

| Category Group | Categories | Artifact Types |
|----------------|------------|---------------|
| **Core Development** | | |
| Server Scripts | `server_scripts` | Business Rules, Script Includes, Fix Scripts, Script Actions, Processors, Scheduled Jobs, MID Server Script Includes, Script Validators |
| Client Scripts | `client_scripts` | Client Scripts, UI Scripts, UI Macros, Catalog Client Scripts, Wizard Client Scripts |
| UI | `ui` | UI Policies, UI Actions, UI Pages, Form Layouts, List Layouts, Views, Formatters, Context Menus, Related Lists, Form Sections, Field Styles, UI Messages, Homepages, UI Notifications |
| Flow Designer | `flow_designer` | Flows, Subflows, Flow Actions, Flow Triggers, Flow Inputs, Flow Outputs |
| Process Automation | `process_automation` | Playbooks, Decision Tables, Decision Questions, Document Task Types |
| Integration Hub | `integration_hub` | Spokes, Connection Aliases, Connections, Credentials, Certificates |
| Legacy Workflows | `legacy_workflows` | Workflows, Workflow Activities, Workflow Versions, Workflow Stages |
| **Events & Email** | | |
| Events | `events` | Event Registry, Script Actions, Scheduled Triggers |
| Email | `email` | Notifications, Email Scripts, Email Templates, Inbound Email Actions, Email Layouts, Notification Devices |
| **Portals & Experiences** | | |
| Service Portal | `service_portal` | Widgets, Portal Pages, Portals, Themes, Angular Providers, CSS Includes, JS Includes, Headers/Footers |
| Now Experience | `now_experience` | UX Applications, UX Pages, Macroponents, UX Client Scripts, Data Brokers, UX Events, UX Themes, Library Components, Screen Types |
| Workspace | `workspace` | Workspace Configs, Form Configs, List Configs, Related Lists, Table Configs, Record Pages |
| **Analytics & AI** | | |
| Analytics | `analytics` | Reports, Report Sources, PA Dashboards, PA Indicators (KPIs), PA Breakdowns, PA Widgets, PA Scorecards, Homepage Widgets, Portal Pages |
| Virtual Agent | `virtual_agent` | VA Topics, Topic Goals, NLU Models, NLU Intents, NLU Utterances |
| AI/ML | `ai_ml` | ML Solutions, ML Capabilities, AI Search Configs, Search Sources, Agent Assist Actions |
| **Applications** | | |
| Service Catalog | `service_catalog` | Catalog Items, Categories, Record Producers, Catalog Variables, Variable Sets, Catalog UI Policies, Order Guides, Content Items |
| Knowledge | `knowledge` | Knowledge Articles, Knowledge Bases, KB Categories, KB Templates |
| Employee Center | `employee_center` | HR Service Portals, HR Case Types, HR Topics, HR Content Blocks |
| Customer Service | `customer_service` | CSM Consumers, CSM Case Types, CSM Cases |
| CMDB | `cmdb` | CMDB CI Types, Relationship Types, Identification Rules, Business Services |
| GRC | `grc` | GRC Policies, Risks, Compliance Controls, Audit Engagements, GRC Profiles |
| Field Service | `field_service` | Work Order Types, FSM Agents, Territories, Dispatcher Configs |
| APM | `apm` | Business Applications, App Assessments |
| **Integration & Discovery** | | |
| REST/SOAP | `rest_soap` | REST Messages, REST Message Functions, Scripted REST APIs, Scripted REST Resources, SOAP Messages, SOAP Message Functions |
| Data Import | `data_import` | Transform Maps, Data Sources, Scheduled Imports, Import Set Tables |
| Discovery | `discovery` | Discovery Schedules, Probes, Sensors, Patterns, MID Servers, MID Server Script Includes, Discovery Credentials |
| Service Mapping | `service_mapping` | Service Mapping Patterns, Service Extensions, CI Associations |
| **Configuration** | | |
| Rules Engine | `rules_engine` | Assignment Rules, Approval Rules, Escalation Rules, Data Lookup Definitions, Data Lookup Matchers, System Rules, View Rules |
| SLA Management | `sla_management` | SLA Definitions, SLA Condition Classes, Relative Durations, Service Offerings |
| Navigation | `navigation` | Application Menus, Modules, Application Categories, Perspectives, UX App Configurations |
| Localization | `localization` | Field Labels, Translated Names/Fields, Translated Text, Choice Lists |
| Guided Setup | `guided_setup` | Guided Setup Content, Guided Setup Groups, Wizards, Wizard Panels |
| Documents | `documents` | Templates, Document Templates, Content Blocks, Embedded Help |
| Assessments | `assessments` | Assessment Metric Types, Assessment Metrics, Assessment Categories, Assessment Templates, Survey Templates |
| Metrics | `metrics` | Metric Definitions, System Metrics, Transaction Logs |
| Scheduled Jobs | `scheduled_jobs` | Scheduled Jobs (All), Scheduled Reports, Scheduled PA Jobs, Table Cleaner Rules |
| Interceptors | `interceptors` | Run As Configurations, Import Export Maps |
| **Admin & Deployment** | | |
| Testing | `testing` | ATF Tests, ATF Test Suites, ATF Test Steps |
| Security | `security` | ACLs, Data Policies, Roles, Role Assignments |
| Properties | `properties` | System Properties, Property Categories |
| Deployment | `deployment` | Update Sets, Scoped Applications, Store Applications, Plugins, Remote Update Sets |
| Tables | `tables` | Custom Tables, Dictionary Entries, Database Views, M2M Relationships |

**Features:**
- ✅ Custom vs OOTB detection
- ✅ OOTB-modified artifact detection
- ✅ Instance health scoring (0-100) with bonuses for modern platform usage
- ✅ Category-based filtering (40+ categories)
- ✅ Actionable recommendations for all major areas
- ✅ Parallel API calls with batching for performance
- ✅ Graceful handling of missing tables/plugins (e.g., HRSD, CSM, GRC not installed)
- ✅ Comprehensive ServiceNow development coverage: Flow Designer, UI Builder, Service Portal, Workspace, Discovery, CMDB, GRC, Field Service, AI/ML, and more

**Future Extensibility:**

The `sn_analyze_instance` tool is designed for easy extension when ServiceNow introduces new artifact types or features:

1. **Adding New Artifact Types**: Simply add entries to `ARTIFACT_DEFINITIONS` in `instance-analyzer.ts`
2. **Adding New Categories**: Add category to schema enum, add to `ARTIFACT_DEFINITIONS`, update recommendations
3. **Graceful Degradation**: Tables that don't exist (plugins not installed) are handled automatically
4. **Self-Documenting**: Inline code comments explain exactly how to extend

**Example - Adding Future "App Engine Studio" Support:**
```typescript
// In ARTIFACT_DEFINITIONS:
app_engine_studio: [
  { table: 'sys_appbuilder_application', type: 'AES Applications', nameField: 'name' },
  { table: 'sys_appbuilder_table', type: 'AES Tables', nameField: 'name' },
],
```

See `mcp-servicenow/src/tools/instance-analyzer.ts` for detailed extensibility guide in code comments.

### 1.2 `sn_detect_ootb_overrides` - COMPLETED (2026-01-18)

**Purpose:** Detects Out-of-the-Box (OOTB) artifacts that have been modified/customized.

**Key Features:**
- ✅ Queries `sys_update_xml` (Customer Updates) to find all OOTB modifications
- ✅ Classifies overrides by severity: CRITICAL, HIGH, MEDIUM, LOW
- ✅ Tracks "Replace on Upgrade" settings (protected vs unprotected items)
- ✅ Retrieves skipped updates from `sys_upgrade_history_log`
- ✅ Calculates overall upgrade risk score (0-100)
- ✅ Provides actionable recommendations

**Severity Classification:**
| Severity | Criteria |
|----------|----------|
| CRITICAL | Business Rules, Script Includes, ACLs, Dictionary entries on core tables |
| HIGH | UI Policies, UI Actions, Client Scripts, Notifications on core tables |
| MEDIUM | Form layouts, List layouts, Service Portal widgets, Properties |
| LOW | Other customizations with minimal upgrade impact |

**Input Parameters:**
- `artifactTypes` - Filter by artifact types (e.g., sys_script, sys_script_include)
- `tables` - Filter by target tables (e.g., incident, change_request)
- `includeSkippedUpdates` - Include skipped updates from upgrade history (default: true)
- `includeUpgradeRisk` - Calculate upgrade risk score (default: true)
- `scope` - Filter by application scope
- `limit` - Maximum number of overrides to return (default: 500)
- `severity` - Filter by severity level (all, critical, high, medium, low)

**Output:**
- Upgrade risk score (0-100)
- Override counts by severity, type, and table
- Skipped updates list with upgrade version info
- Actionable recommendations for risk mitigation

**File:** `mcp-servicenow/src/tools/ootb-override-detector.ts`

### 1.3 `sn_get_dependency_graph` - COMPLETED (2026-01-18)

**Purpose:** Builds a dependency graph showing relationships between ServiceNow artifacts.

**Key Features:**
- ✅ Parses script content to find Script Include references
- ✅ Detects GlideAjax calls (Client Script → Script Include)
- ✅ Tracks GlideRecord table usage
- ✅ Identifies class inheritance (extends)
- ✅ Maps table triggers (Business Rule/Client Script → Table)
- ✅ Finds orphaned artifacts with no connections
- ✅ Identifies highly connected "hub" artifacts

**Dependency Types Detected:**
| Type | Description |
|------|-------------|
| `calls_script_include` | new ClassName() or ClassName.method() |
| `glide_ajax` | GlideAjax call from Client Script |
| `glide_record` | GlideRecord query on a table |
| `extends_class` | Script Include extends another |
| `triggers_on_table` | Business Rule/Client Script on table |

**Artifact Types Analyzed:**
- Script Includes, Business Rules, Client Scripts
- UI Actions, UI Policies, Scheduled Jobs
- ACLs, Notifications

**Input Parameters:**
- `artifactType` - Type to analyze (script_include, business_rule, etc., or 'all')
- `artifactName` - Filter to specific artifact name
- `scope` - Filter by application scope
- `direction` - upstream, downstream, or both
- `depth` - How many levels deep (1-5)
- `includeTableDependencies` - Include GlideRecord table refs
- `limit` - Max artifacts to analyze

**Output:**
- Nodes: All artifacts with type, name, scope
- Edges: Relationships with dependency type and context
- Summary: Counts, orphaned artifacts, highly connected hubs
- Recommendations: Based on graph analysis

**File:** `mcp-servicenow/src/tools/dependency-graph.ts` (618 lines)

### 1.4 `sn_find_anti_patterns` - COMPLETED (2026-01-18)

**Purpose:** Detects common anti-patterns and bad practices in ServiceNow code.

**Key Features:**
- ✅ 25+ anti-pattern detection rules with regex-based scanning
- ✅ 5 categories: performance, security, maintainability, upgradability, user_experience
- ✅ 4 severity levels: critical, high, medium, low
- ✅ Special case checks via table queries (global scripts, missing conditions, etc.)
- ✅ Health score calculation (0-100)
- ✅ Actionable recommendations

**Anti-Pattern Categories:**

| Category | Key Patterns Detected |
|----------|----------------------|
| **Performance** | current.update(), getXMLWait(), getRowCount(), global scripts, GlideRecord in ACLs, gs.sleep(), cache flush |
| **Security** | eval(), GlideRecord in client scripts, setBasicAuth(), undeclared variables, REST APIs without auth |
| **Maintainability** | hardcoded sys_ids, hardcoded URLs, debug statements (gs.log, console.log), document object in server |
| **Upgradability** | GlideRecord without new, unsupported APIs |
| **User Experience** | alert(), confirm(), setWorkflow(false), missing isLoading check |

**Special Case Checks (Table Queries):**
- Global Business Rules (no table restriction)
- Global Client Scripts
- Client-callable Script Includes without GlideRecordSecure
- Business Rules without conditions
- onChange Client Scripts missing isLoading check
- Scripted REST APIs without authentication

**Input Parameters:**
- `categories` - Categories to check (all, performance, security, etc.)
- `scope` - Filter by application scope
- `severity` - Minimum severity level to report
- `artifactTypes` - Types of artifacts to scan
- `limit` - Max artifacts per type to scan

**Output:**
- Summary with health score and counts by category/severity
- Issues array with full details (artifact, pattern, code snippet, line number)
- Recommendations based on findings

**File:** `mcp-servicenow/src/tools/anti-pattern-detector.ts` (921 lines)

### 1.5 `sn_code_quality_score` - COMPLETED (2026-01-18)

**Purpose:** Analyzes ServiceNow script quality and provides metrics and recommendations.

**Key Features:**
- ✅ Calculates quality scores (0-100) with letter grades (A-F)
- ✅ Analyzes multiple quality dimensions
- ✅ Provides per-artifact detailed metrics
- ✅ Score distribution and top issues summary
- ✅ Category-specific scores for targeted improvement

**Quality Metrics Analyzed:**

| Category | Metrics |
|----------|---------|
| **Complexity** | Cyclomatic complexity, nesting depth |
| **Documentation** | Comment ratio, JSDoc presence |
| **Best Practices** | Error handling, strict mode, constants usage |
| **Code Style** | Function length, naming conventions |
| **Maintainability** | Script size, modularization |

**Grading Scale:**
- A (90-100): Excellent quality
- B (80-89): Good quality
- C (70-79): Fair quality
- D (60-69): Poor quality
- F (0-59): Needs attention

**Input Parameters:**
- `artifactType` - Type of artifact to analyze (script_include, business_rule, etc., or 'all')
- `artifactName` - Filter to specific artifact name
- `scope` - Filter by application scope
- `includeDetails` - Include detailed metrics per artifact
- `minScore` - Only return artifacts below this score (find problem scripts)
- `limit` - Maximum artifacts to analyze

**Output:**
- Summary with overall grade and average score
- Score distribution (excellent/good/fair/poor/failing counts)
- Top issues with occurrence counts
- Category-specific scores
- Per-artifact details with full metrics and issues

**File:** `mcp-servicenow/src/tools/code-quality-analyzer.ts` (405 lines)

### 1.6 `sn_find_dead_code` - COMPLETED (2026-01-18)

**Purpose:** Identifies unused, orphaned, or dead code in ServiceNow instances.

**Key Features:**
- ✅ Finds unreferenced Script Includes (scans all script tables)
- ✅ Detects artifacts with empty scripts
- ✅ Identifies artifacts referencing non-existent tables
- ✅ Finds stale inactive artifacts (2+ years old)
- ✅ Confidence levels: high, medium, low
- ✅ Estimated cleanup effort calculation

**Detection Methods:**

| Method | Description |
|--------|-------------|
| **Reference Checking** | Scans Business Rules, Client Scripts, UI Actions, Scheduled Jobs for Script Include references |
| **Table Validation** | Verifies tables still exist for Business Rules and Client Scripts |
| **Empty Script Detection** | Finds active artifacts with no actual code |
| **Staleness Analysis** | Identifies artifacts inactive for 2+ years |

**Confidence Levels:**
- **High**: Confirmed dead (unreferenced, empty, or referencing deleted table)
- **Medium**: Likely dead (inactive but may have external references)
- **Low**: Possibly dead (needs manual verification)

**Input Parameters:**
- `scope` - Filter by application scope
- `artifactTypes` - Types to check (script_includes, business_rules, etc.)
- `includeInactive` - Include inactive artifacts
- `checkReferences` - Check Script Include references (slower but more accurate)
- `limit` - Maximum artifacts per type to analyze

**Output:**
- Summary with counts by type, reason, and confidence
- Estimated cleanup effort
- Sorted list of dead code candidates
- Actionable recommendations

**File:** `mcp-servicenow/src/tools/dead-code-finder.ts` (563 lines)

---

## 14. Next Steps

### Immediate Actions (This Week)
1. [x] Review and approve this plan
2. [x] Decide implementation order (Option C chosen)
3. [x] Build `sn_analyze_instance` MCP tool (Step 1.1) - **COMPLETED 2026-01-18**
4. [x] Build `sn_detect_ootb_overrides` MCP tool (Step 1.2) - **COMPLETED 2026-01-18**
5. [x] Build `sn_get_dependency_graph` MCP tool (Step 1.3) - **COMPLETED 2026-01-18**
6. [x] Build `sn_find_anti_patterns` MCP tool (Step 1.4) - **COMPLETED 2026-01-18**
7. [x] Build `sn_code_quality_score` MCP tool (Step 1.5) - **COMPLETED 2026-01-18**
8. [x] Build `sn_find_dead_code` MCP tool (Step 1.6) - **COMPLETED 2026-01-18**

### Step 1 Enhancements (Future)
1. [ ] Add option to analyze OOTB artifacts in `sn_analyze_instance` (currently filters to custom/modified only)

### Step 2: Guardrails & Impact Analysis ✅ COMPLETE
| Priority | Capability | MCP Tool | Effort | Status |
|----------|------------|----------|--------|--------|
| 2.1 | Change Impact Preview | `sn_preview_change_impact` | L | ✅ COMPLETE |
| 2.2 | Conflict Detection | `sn_detect_conflicts` | L | ✅ COMPLETE |
| 2.3 | Guardrail Validation | `sn_validate_change` | M | ✅ COMPLETE |
| 2.4 | Breaking Change Alerts | `sn_check_breaking_changes` | M | ✅ COMPLETE |
| 2.5 | Best Practice Validation | (merged into 2.3 guardrail-validator) | M | ✅ COMPLETE |
| 2.6 | Audit Logger | `sn_log_change` + `sn_get_audit_history` | S | ✅ COMPLETE |

**Step 2 Implementation Files:**
- `src/tools/change-impact-analyzer.ts` (540 lines) - Task 2.1
- `src/tools/conflict-detector.ts` (440 lines) - Task 2.2
- `src/tools/guardrail-validator.ts` (361 lines) - Task 2.3 + 2.5
- `src/tools/breaking-change-detector.ts` (322 lines) - Task 2.4
- `src/tools/audit-logger.ts` (258 lines) - Task 2.6

**Total Step 2: 1,921 lines of new guardrail & impact analysis tools**

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

