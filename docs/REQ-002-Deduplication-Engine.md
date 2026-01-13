# REQ-002: Incident Deduplication Engine

## 📋 Overview

| Field | Value |
|-------|-------|
| **Requirement ID** | REQ-002 |
| **Status** | ✅ Complete |
| **Deployed** | 2026-01-13 |
| **Update Set** | [REQ-002 Incident Deduplication Engine](https://dev300943.service-now.com/sys_update_set.do?sys_id=8fa8516393d232102f57f0ba2bba109a) |
| **Scope** | Global |

## 🎯 Problem Statement

Implement a server-side deduplication engine that:
- Detects similar/duplicate incidents based on configurable rules
- Auto-merges duplicates into a canonical "master" incident
- Preserves auditability and performance
- Stores rules in a custom table (not hardcoded)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    INCIDENT DEDUPLICATION ENGINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [New Incident Created]                                                     │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  Business Rule: Incident Deduplication Trigger                  │       │
│  │  (after insert, order 500)                                      │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  IncidentDeduplicationEngine                                    │       │
│  │  ├── orchestrateDedupe(incident)                                │       │
│  │  ├── findDuplicateCandidates()                                  │       │
│  │  │   └── Load rules from u_incident_dedupe_rule                 │       │
│  │  │   └── Evaluate each rule against incident                    │       │
│  │  ├── normalizeText() → for description matching                 │       │
│  │  └── calculateSimilarity() → Jaccard similarity                 │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│           │                                                                 │
│           ▼ (if duplicates found)                                          │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │  DuplicateMergeProcessor                                        │       │
│  │  ├── selectMasterIncident()                                     │       │
│  │  │   └── Oldest open P1-P3 with assignment group                │       │
│  │  ├── mergeToMaster()                                            │       │
│  │  │   └── Set parent_incident on children                        │       │
│  │  │   └── Add work notes                                         │       │
│  │  ├── aggregateFields()                                          │       │
│  │  │   └── Collect callers, locations                             │       │
│  │  │   └── Update master with summary                             │       │
│  │  └── closeDuplicates() (optional)                               │       │
│  │       └── Resolve as "Duplicate"                                │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📦 Artifacts

| Artifact | Type | Table | Description |
|----------|------|-------|-------------|
| u_incident_dedupe_rule | Custom Table | sys_db_object | Stores configurable deduplication rules |
| IncidentDeduplicationEngine | Script Include | sys_script_include | Main engine for detecting duplicates |
| DuplicateMergeProcessor | Script Include | sys_script_include | Handles merge behavior, master selection, aggregation |
| Incident Deduplication Trigger | Business Rule | sys_script | Triggers engine on incident insert |
| Correlation ID Match | Data Record | u_incident_dedupe_rule | Pre-configured rule for correlation_id matching |
| CI + Category + Description Match | Data Record | u_incident_dedupe_rule | Pre-configured rule for multi-field matching |

## 🗃️ Custom Table: u_incident_dedupe_rule

### Columns

| Field | Type | Description |
|-------|------|-------------|
| u_name | String (100) | Rule name |
| u_match_fields | String (500) | Comma-separated field names to match |
| u_time_window_minutes | Integer | Time window for duplicate detection (default: 30) |
| u_normalize_description | Boolean | Apply text normalization to short_description |
| u_auto_close_duplicates | Boolean | Automatically close duplicate incidents |
| u_priority | Integer | Rule evaluation priority (lower = first) |
| u_active | Boolean | Is rule active |

### Pre-configured Rules

| Rule Name | Match Fields | Time Window | Auto-Close |
|-----------|--------------|-------------|------------|
| Correlation ID Match | correlation_id | 60 min | Yes |
| CI + Category + Description Match | cmdb_ci, category, subcategory, short_description | 30 min | No |

## 🔧 Configuration

### Adding New Dedup Rules

1. Navigate to: `u_incident_dedupe_rule.list`
2. Click "New"
3. Configure:
   - **Name**: Descriptive rule name
   - **Match Fields**: Comma-separated field names (e.g., `cmdb_ci,category`)
   - **Time Window**: Minutes to look back for duplicates
   - **Normalize Description**: Enable for fuzzy text matching
   - **Auto-Close**: Automatically resolve duplicates
   - **Priority**: Lower number = evaluated first
   - **Active**: Enable/disable rule

### System Properties

| Property | Default | Description |
|----------|---------|-------------|
| `x_snc_dedupe.auto_close_duplicates` | false | Global override for auto-close |

## 📊 Key Features

### 1. Configurable Rules
- Rules stored in database, not code
- Multiple rules evaluated in priority order
- Each rule can have different match criteria

### 2. Text Normalization
- Removes noise words (the, a, an, is, etc.)
- Lowercases text
- Removes special characters
- Jaccard similarity scoring (≥85% = match)

### 3. Master Selection Algorithm
1. Filter to open incidents (states 1-5)
2. Prefer P1-P3 with assignment group
3. Select oldest by created date

### 4. Merge Behavior
- Children linked via `parent_incident` field
- Work notes added to both master and children
- Aggregated data (callers, locations) added to master
- Optional auto-close with "Resolved – Duplicate"

## 🔗 Links

| Resource | URL |
|----------|-----|
| Update Set | https://dev300943.service-now.com/sys_update_set.do?sys_id=8fa8516393d232102f57f0ba2bba109a |
| Dedup Rules Table | https://dev300943.service-now.com/u_incident_dedupe_rule_list.do |
| IncidentDeduplicationEngine | https://dev300943.service-now.com/sys_script_include_list.do?sysparm_query=name=IncidentDeduplicationEngine |
| DuplicateMergeProcessor | https://dev300943.service-now.com/sys_script_include_list.do?sysparm_query=name=DuplicateMergeProcessor |
| Business Rule | https://dev300943.service-now.com/sys_script_list.do?sysparm_query=name=Incident%20Deduplication%20Trigger |

## 📁 Source Files

```
mcp-servicenow/src/req-002/
├── IncidentDeduplicationEngine.js
├── DuplicateMergeProcessor.js
├── IncidentDeduplicationTrigger.js  (Business Rule)
├── deploy-req-002.js
└── verify-deployment.js
```

## 🧪 Testing

### Test Case 1: Correlation ID Match
1. Create incident with `correlation_id = "TEST-001"`
2. Create another incident with same `correlation_id` within 60 minutes
3. Expected: Second incident linked to first as duplicate

### Test Case 2: CI + Category Match
1. Create incident with specific CI, category, subcategory, and short_description
2. Create another incident with same values within 30 minutes
3. Expected: Deduplication triggered, master selected

### Check System Logs
```
[DedupeEngine] Found X duplicate candidates for INCXXXXXXX
[MergeProcessor] Selected master incident: INCXXXXXXX
[MergeProcessor] Linked INCXXXXXXX to master INCXXXXXXX
```

## 📝 Notes

- Business Rule runs on `after insert` only (not update)
- Order 500 ensures it runs after standard processing
- Incidents with `parent_incident` already set are skipped
- System-created incidents are skipped

