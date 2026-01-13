# ServiceNow Development Documentation

This folder contains detailed documentation for each requirement implemented in this project.

## 📋 Requirements Index

| REQ ID | Title | Status | Documentation |
|--------|-------|--------|---------------|
| REQ-001 | Dynamic Assignment Orchestrator | ✅ Complete | [View](./REQ-001-Dynamic-Assignment-Orchestrator.md) |
| REQ-002 | Deduplication Engine | ✅ Complete | [View](./REQ-002-Deduplication-Engine.md) |

## 🏗️ Project Structure

```
SN AI Dev/
├── docs/                                  # Documentation
│   ├── README.md                          # This file
│   ├── REQ-001-Dynamic-Assignment-Orchestrator.md
│   └── REQ-002-Deduplication-Engine.md
│
├── REQUIREMENTS.md                        # Requirements backlog
│
└── mcp-servicenow/                        # ServiceNow MCP Server
    ├── src/
    │   ├── req-001/                       # REQ-001 source files
    │   │   ├── IncidentPatternAnalyzer.js
    │   │   ├── SkillBasedAssignment.js
    │   │   ├── AutoRemediationOrchestrator.js
    │   │   ├── BR_IncidentAssignmentOrchestrator.js
    │   │   └── deploy-req-001.js
    │   │
    │   └── req-002/                       # REQ-002 source files
    │       ├── IncidentDeduplicationEngine.js
    │       ├── DuplicateMergeProcessor.js
    │       ├── IncidentDeduplicationTrigger.js
    │       ├── deploy-req-002.js
    │       └── verify-deployment.js
    │
    ├── lib/                               # Shared utilities
    │   ├── scope-manager.js               # Multi-scope management
    │   └── multi-scope-deployer.js        # Cross-scope deployment
    │
    └── .env                               # Instance credentials (not in git)
```

## 🔧 Instance Information

- **Instance:** dev300943.service-now.com
- **Scope:** Global (no custom scoped apps)

## 🚀 Deployment Process

Each requirement follows this deployment pattern:

1. **Source files** in `mcp-servicenow/src/req-XXX/`
2. **Deploy script** runs to push to ServiceNow
3. **Update Set** created and artifacts moved to it
4. **Documentation** generated in `docs/`

## 📦 Update Sets

| Update Set | REQ | Link |
|------------|-----|------|
| REQ-001 Dynamic Assignment Orchestrator | REQ-001 | [View](https://dev300943.service-now.com/sys_update_set.do?sys_id=42715563939232102f57f0ba2bba10eb) |
| REQ-002 Incident Deduplication Engine | REQ-002 | [View](https://dev300943.service-now.com/sys_update_set.do?sys_id=8fa8516393d232102f57f0ba2bba109a) |

