# REQ-001: Dynamic Service-Aware, Skill-Based, Predictive Assignment & Auto-Remediation Orchestrator

## 📋 Overview

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 (INC-XZ-001) |
| **Status** | ✅ Complete |
| **Deployed** | 2026-01-13 |
| **Update Set** | [REQ-001 Dynamic Assignment Orchestrator](https://dev300943.service-now.com/sys_update_set.do?sys_id=42715563939232102f57f0ba2bba10eb) |
| **Scope** | Global |

## 🎯 Problem Statement

Design and implement an advanced Incident assignment and remediation engine that dynamically routes and optionally auto-resolves incidents using:
- Service context
- Real-time patterns
- Resolver skills
- External automation systems

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCIDENT ASSIGNMENT ORCHESTRATOR                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [New/Updated Incident]                                                     │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  Business Rule: Incident Assignment Orchestrator                │       │
│  │  (after insert/update, order 100)                               │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  IncidentPatternAnalyzer                                        │       │
│  │  ├── analyzePatterns(incident)                                  │       │
│  │  ├── classifyIncident() → pattern cluster                       │       │
│  │  ├── checkPatternThreshold() → trigger Problem creation         │       │
│  │  └── checkActiveMajorIncidents() → correlation                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  SkillBasedAssignment                                           │       │
│  │  ├── findOptimalAssignment(incident, analysis)                  │       │
│  │  ├── getServiceOwnership() → from CMDB                          │       │
│  │  ├── evaluateUserSkills() → certifications, expertise           │       │
│  │  ├── checkOnCallSchedule() → PagerDuty integration              │       │
│  │  └── Return: { group, user, confidence }                        │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  AutoRemediationOrchestrator                                    │       │
│  │  ├── evaluateRemediationStrategy(incident, analysis)            │       │
│  │  ├── Outcomes:                                                  │       │
│  │  │   ├── ASSIGN_ONLY → just assign                              │       │
│  │  │   ├── ASSIGN_WITH_RUNBOOK → assign + execute automation      │       │
│  │  │   └── AUTO_REMEDIATE → no human, auto-fix                    │       │
│  │  ├── executeRunbook() → external automation                     │       │
│  │  └── checkDuplicateAutomation() → prevent duplicate runs        │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📦 Artifacts

| Artifact | Type | Table | Description |
|----------|------|-------|-------------|
| IncidentPatternAnalyzer | Script Include | sys_script_include | Analyzes historical incidents, detects patterns, triggers Problem creation |
| SkillBasedAssignment | Script Include | sys_script_include | Finds optimal assignee based on skills, service ownership, on-call |
| AutoRemediationOrchestrator | Script Include | sys_script_include | Decides remediation strategy, executes runbooks |
| Incident Assignment Orchestrator | Business Rule | sys_script | Triggers the orchestration on incident insert/update |

## 🔧 Configuration

### System Properties (can be created for customization)

| Property | Default | Description |
|----------|---------|-------------|
| `x_snc_assign.pattern_threshold` | 5 | Number of similar incidents to trigger Problem creation |
| `x_snc_assign.pattern_window_minutes` | 30 | Time window for pattern detection |
| `x_snc_assign.pagerduty_enabled` | false | Enable PagerDuty on-call integration |
| `x_snc_assign.auto_remediate_enabled` | true | Enable auto-remediation for known issues |

### Remediation Rules

The system supports these remediation strategies:
1. **ASSIGN_ONLY** - Traditional assignment to human resolver
2. **ASSIGN_WITH_RUNBOOK** - Assign + trigger automation (e.g., restart service)
3. **AUTO_REMEDIATE** - Fully automated resolution, no human unless it fails

## 📊 Key Features

### 1. Pattern Analysis
- Classifies incidents into pattern clusters (e.g., "recurring DB timeouts on CI X in region Y")
- Queries historical incidents for similar issues
- Uses CI, category, subcategory, and short description for matching

### 2. Automatic Problem Creation
- Detects when ≥5 similar incidents occur within 30 minutes
- Automatically creates Problem record
- Links related incidents to the Problem

### 3. Skill-Based Assignment
- Evaluates user skills and certifications
- Considers service ownership from CMDB
- Integrates with on-call schedules (PagerDuty ready)

### 4. Auto-Remediation
- Executes predefined runbooks for known issue patterns
- Prevents duplicate automation runs
- Falls back to human assignment if automation fails

## 🔗 Links

| Resource | URL |
|----------|-----|
| Update Set | https://dev300943.service-now.com/sys_update_set.do?sys_id=42715563939232102f57f0ba2bba10eb |
| IncidentPatternAnalyzer | https://dev300943.service-now.com/sys_script_include.do?sys_id=8d225da3939232102f57f0ba2bba10f9 |
| SkillBasedAssignment | https://dev300943.service-now.com/sys_script_include.do?sys_id=1d2295e3939232102f57f0ba2bba102d |
| AutoRemediationOrchestrator | https://dev300943.service-now.com/sys_script_include.do?sys_id=592295e3939232102f57f0ba2bba10be |
| Business Rule | https://dev300943.service-now.com/sys_script.do?sys_id=692295e3939232102f57f0ba2bba10c6 |

## 📁 Source Files

```
mcp-servicenow/src/req-001/
├── IncidentPatternAnalyzer.js
├── SkillBasedAssignment.js
├── AutoRemediationOrchestrator.js
├── IncidentAssignmentOrchestrator.js  (Business Rule)
└── deploy-req-001.js
```

## 🧪 Testing

To test this feature:

1. Create an incident with a known CI and category
2. Check system logs for orchestration messages:
   - `[PatternAnalyzer]` - Pattern detection
   - `[SkillAssignment]` - Assignment logic
   - `[AutoRemediation]` - Remediation decisions
3. Create 5+ similar incidents within 30 minutes to trigger Problem creation

## 📝 Notes

- Business Rule runs on `after insert` and `after update`
- Order 100 ensures it runs early in the processing chain
- All Script Includes are client-callable: false for security

