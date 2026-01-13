# REQ-001: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-001 |
| **Spec Version** | 1.0 |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |
| **Status** | ✅ Approved |

---

## 1. Solution Overview

### 1.1 Summary
Three Script Includes orchestrated by a Business Rule provide intelligent incident assignment and auto-remediation. The Business Rule triggers on incident insert/update, invoking each Script Include in sequence.

### 1.2 Goals
- Replace static assignment with dynamic, context-aware routing
- Detect patterns and create Problems automatically
- Enable auto-remediation for known issue types

### 1.3 Non-Goals
- Modify incident form UI
- Replace existing notification system

---

## 2. Architecture

### 2.1 Component Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│  INCIDENT ASSIGNMENT ORCHESTRATOR                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [New/Updated Incident]                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Business Rule: Incident Assignment Orchestrator            │   │
│  │  Table: incident | When: after | Order: 100                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  1. IncidentPatternAnalyzer                                 │   │
│  │     - Classify incident into pattern cluster                │   │
│  │     - Check for active major incidents                      │   │
│  │     - Trigger Problem creation if threshold met             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  2. SkillBasedAssignment                                    │   │
│  │     - Get service ownership from CMDB                       │   │
│  │     - Evaluate user skills & certifications                 │   │
│  │     - Check on-call schedule (PagerDuty)                    │   │
│  │     - Return optimal { group, user, confidence }            │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  3. AutoRemediationOrchestrator                             │   │
│  │     - Evaluate remediation strategy                         │   │
│  │     - ASSIGN_ONLY | ASSIGN_WITH_RUNBOOK | AUTO_REMEDIATE    │   │
│  │     - Execute runbook if applicable                         │   │
│  │     - Auto-resolve on success                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Artifacts to Create

### 3.1 Summary Table

| Artifact | Type | Table | Description |
|----------|------|-------|-------------|
| IncidentPatternAnalyzer | Script Include | sys_script_include | Pattern detection and Problem creation |
| SkillBasedAssignment | Script Include | sys_script_include | Optimal assignee selection |
| AutoRemediationOrchestrator | Script Include | sys_script_include | Remediation decisions and execution |
| Incident Assignment Orchestrator | Business Rule | sys_script | Trigger on incident insert/update |

### 3.2 Artifact Details

#### 3.2.1 IncidentPatternAnalyzer
- **Type:** Script Include
- **Client Callable:** false
- **Key Methods:**
  - `analyzePatterns(incident)` - Main entry point
  - `classifyIncident(incident)` - Determine pattern cluster
  - `checkPatternThreshold(cluster)` - Check if Problem needed
  - `createProblemFromPattern(cluster, incidents)` - Create Problem

#### 3.2.2 SkillBasedAssignment
- **Type:** Script Include
- **Client Callable:** false
- **Key Methods:**
  - `findOptimalAssignment(incident, analysis)` - Main entry
  - `getServiceOwnership(cmdbCi)` - Get from CMDB
  - `evaluateUserSkills(group, category)` - Score users
  - `checkOnCallSchedule(group)` - PagerDuty integration

#### 3.2.3 AutoRemediationOrchestrator
- **Type:** Script Include
- **Client Callable:** false
- **Key Methods:**
  - `evaluateRemediationStrategy(incident, analysis)` - Decide strategy
  - `executeRunbook(runbookId, incident)` - Run automation
  - `checkDuplicateAutomation(incident)` - Prevent duplicate runs

#### 3.2.4 Business Rule
- **Table:** incident
- **When:** after insert, after update
- **Order:** 100
- **Condition:** current.state != 6 && current.state != 7 (not resolved/closed)

---

## 4. Data Model

### 4.1 No New Tables Required
This solution uses existing tables only.

### 4.2 Fields Used

| Table | Field | Usage |
|-------|-------|-------|
| incident | cmdb_ci | CI lookup for service ownership |
| incident | category | Pattern matching |
| incident | priority | On-call escalation |
| incident | assignment_group | Assignment target |
| incident | assigned_to | Assignment target |
| cmdb_ci_service | support_group | Service ownership |
| sys_user | skills | Skill matching |

---

## 5. Integration Points

### 5.1 Internal Integrations

| System | Direction | Method | Purpose |
|--------|-----------|--------|---------|
| CMDB | Query | GlideRecord | Get CI and service ownership |
| Problem | Create | GlideRecord | Create Problem from patterns |
| User | Query | GlideRecord | Evaluate skills |

### 5.2 External Integrations

| System | Direction | Protocol | Authentication |
|--------|-----------|----------|----------------|
| PagerDuty | Outbound | REST | API Key (future) |
| Automation Platform | Outbound | REST | OAuth (future) |

---

## 6. Security Considerations

### 6.1 Access Control
- All Script Includes run in system context
- Business Rule respects existing incident ACLs
- No elevation of privilege

---

## 7. Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| CMDB lookup fails | Fall back to category-based assignment |
| No matching skills | Assign to group only (no user) |
| Pattern analysis timeout | Skip and continue with assignment |
| Runbook execution fails | Log error, assign to human |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

