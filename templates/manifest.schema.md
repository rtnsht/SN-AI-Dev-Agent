# Manifest.json Schema Reference

This document describes the structure of `specs/manifest.json`.

## Usage

To start a fresh project:
1. Copy `templates/manifest.json` to `specs/manifest.json`
2. Replace placeholder values (`{{...}}`) with your project details
3. Requirements will be added automatically as you create them

---

## Schema

```json
{
  "version": "1.0",
  "lastUpdated": "YYYY-MM-DD",
  "project": {
    "name": "Project display name",
    "description": "Brief project description",
    "repository": "Repository/folder name",
    "defaultInstance": "ServiceNow instance name (e.g., dev300943)"
  },
  "requirements": {
    "REQ-001": {
      "title": "Requirement title",
      "description": "Brief description",
      "status": "spec-draft | spec-approved | design-draft | design-approved | implementing | deployed",
      "phase": "specification | design | implementation | testing | complete",
      "created": "YYYY-MM-DD",
      "lastUpdated": "YYYY-MM-DD",
      "deployedAt": "ISO timestamp (when deployed)",
      "updateSetId": "sys_id of ServiceNow update set",
      "artifacts": {
        "spec": "specs/REQ-001/1-spec.md",
        "design": "specs/REQ-001/2-design.md",
        "implementation": "specs/REQ-001/3-implementation/",
        "testing": "specs/REQ-001/4-testing/",
        "deployment": "specs/REQ-001/5-deployment.md"
      }
    }
  },
  "statistics": {
    "total": 0,
    "deployed": 0,
    "inProgress": 0,
    "notStarted": 0
  }
}
```

---

## Field Descriptions

### Root Level

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version for future compatibility |
| `lastUpdated` | string | Date of last modification |
| `project` | object | Project metadata |
| `requirements` | object | Map of requirement ID to requirement details |
| `statistics` | object | Aggregated counts |

### Project Object

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Human-readable project name |
| `description` | string | Brief project description |
| `repository` | string | Repository or folder name |
| `defaultInstance` | string | Default ServiceNow instance for deployments |

### Requirement Object

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Short title of the requirement |
| `description` | string | Brief description of what it does |
| `status` | string | Current workflow status |
| `phase` | string | Current phase in lifecycle |
| `created` | string | Date requirement was created |
| `lastUpdated` | string | Date of last modification |
| `deployedAt` | string | ISO timestamp when deployed (optional) |
| `updateSetId` | string | ServiceNow update set sys_id (optional) |
| `artifacts` | object | Paths to all requirement documents |

### Status Values

| Status | Description |
|--------|-------------|
| `spec-draft` | Specification in progress |
| `spec-approved` | Specification approved, ready for design |
| `design-draft` | Design in progress |
| `design-approved` | Design approved, ready for implementation |
| `implementing` | Implementation in progress |
| `deployed` | Successfully deployed to ServiceNow |

### Phase Values

| Phase | Description |
|-------|-------------|
| `specification` | Writing the spec document |
| `design` | Writing the technical design |
| `implementation` | Creating code artifacts |
| `testing` | Testing and validation |
| `complete` | Fully deployed and verified |

---

## Example: Fresh Start

```json
{
  "version": "1.0",
  "lastUpdated": "",
  "project": {
    "name": "ServiceNow AI Development",
    "description": "AI-powered ServiceNow development with spec-driven methodology",
    "repository": "SN AI Dev",
    "defaultInstance": "dev300943"
  },
  "requirements": {},
  "statistics": {
    "total": 0,
    "deployed": 0,
    "inProgress": 0,
    "notStarted": 0
  }
}
```

