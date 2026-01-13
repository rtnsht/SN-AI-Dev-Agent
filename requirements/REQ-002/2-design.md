# REQ-002: Technical Design Document

## Document Control

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Spec Version** | 1.0 |
| **Author** | AI Development Assistant |
| **Created** | 2026-01-13 |
| **Last Updated** | 2026-01-13 |
| **Version** | 1.0 |
| **Status** | ✅ Approved |

---

## 1. Solution Overview

### 1.1 Summary
A custom table stores dedup rules. Two Script Includes handle detection and merging. A Business Rule triggers the engine on incident creation.

### 1.2 Goals
- Configurable dedup rules without code changes
- Intelligent duplicate detection with fuzzy matching
- Proper master selection and information aggregation

---

## 2. Architecture

### 2.1 Component Flow
```
┌─────────────────────────────────────────────────────────────────────┐
│  INCIDENT DEDUPLICATION ENGINE                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [New Incident Created]                                             │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Business Rule: Incident Deduplication Trigger              │   │
│  │  Table: incident | When: after insert | Order: 500          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼                                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  IncidentDeduplicationEngine                                │   │
│  │  ├── orchestrateDedupe(incident)                            │   │
│  │  ├── loadActiveRules() → from u_incident_dedupe_rule        │   │
│  │  ├── findDuplicateCandidates(incident, rules)               │   │
│  │  ├── normalizeText(text) → remove noise words               │   │
│  │  └── calculateSimilarity(a, b) → Jaccard coefficient        │   │
│  └─────────────────────────────────────────────────────────────┘   │
│           │                                                         │
│           ▼ (if duplicates found)                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  DuplicateMergeProcessor                                    │   │
│  │  ├── processDuplicates(newIncident, candidates, rule)       │   │
│  │  ├── selectMasterIncident(candidates) → oldest P1-P3        │   │
│  │  ├── mergeToMaster(master, children)                        │   │
│  │  ├── aggregateFields(master, children) → callers, locations │   │
│  │  └── closeDuplicates(children) → optional                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Artifacts to Create

### 3.1 Summary Table

| Artifact | Type | Table | Description |
|----------|------|-------|-------------|
| u_incident_dedupe_rule | Custom Table | sys_db_object | Stores dedup rules |
| IncidentDeduplicationEngine | Script Include | sys_script_include | Detection logic |
| DuplicateMergeProcessor | Script Include | sys_script_include | Merge logic |
| Incident Deduplication Trigger | Business Rule | sys_script | Entry point |

### 3.2 Custom Table Schema: u_incident_dedupe_rule

| Column | Type | Length | Mandatory | Description |
|--------|------|--------|-----------|-------------|
| u_name | String | 100 | Yes | Rule name |
| u_match_fields | String | 500 | Yes | Comma-separated fields |
| u_time_window_minutes | Integer | | No | Matching window (default 30) |
| u_normalize_description | Boolean | | No | Enable fuzzy matching |
| u_auto_close_duplicates | Boolean | | No | Auto-close children |
| u_priority | Integer | | No | Rule priority (lower=first) |
| u_active | Boolean | | No | Rule enabled |

---

## 4. Pre-configured Rules

| Rule Name | Match Fields | Window | Normalize | Auto-Close |
|-----------|--------------|--------|-----------|------------|
| Correlation ID Match | correlation_id | 60 min | No | Yes |
| CI + Category + Description | cmdb_ci,category,subcategory,short_description | 30 min | Yes | No |

---

## 5. Algorithm Details

### 5.1 Text Normalization
```
Input:  "The server is down and not responding"
Output: "server down responding"
```
- Lowercase
- Remove noise words: the, a, an, is, and, or, not, etc.
- Remove special characters

### 5.2 Similarity Calculation (Jaccard)
```
Similarity = |A ∩ B| / |A ∪ B|
Threshold: 0.85 (85% match)
```

### 5.3 Master Selection
1. Filter: Open incidents (state 1-5)
2. Prefer: P1-P3 with assignment group
3. Sort: By created date ascending
4. Select: First (oldest)

---

## 6. Security Considerations

- Script Includes not client-callable
- Business Rule respects incident ACLs
- Rules table restricted to admins

---

## 7. Error Handling

| Error | Handling |
|-------|----------|
| No rules active | Log warning, skip dedup |
| Rule query fails | Log error, continue |
| Merge fails | Log error, leave incident as-is |

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Development Assistant | 2026-01-13 | ☑ |
| Technical Reviewer | Ratnesh Tiwari | 2026-01-13 | ☑ |

### Approval Status

> **Status:** ✅ Approved

