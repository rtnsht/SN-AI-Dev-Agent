# CLAUDE.md - AI Agent Instructions

> ⚠️ **READ THIS FILE FIRST IN EVERY SESSION**

**Project**: Yantra - AI Dev Agent - SN | **Instance**: dev300943.service-now.com

---

## Critical Files

| File | Purpose |
|------|---------|
| `specs/config.properties` | Phase gates and sign-off rules |
| `specs/manifest.json` | Requirement registry and status |
| `templates/` | All document templates |

---

## ⛔ Phase Gate Process (MANDATORY)

**STOP AND WAIT FOR USER APPROVAL AT EACH GATE:**

1. **SPEC** → Create `specs/REQ-XXX/1-spec.md` → 🛑 STOP for approval
2. **DESIGN** → Create `specs/REQ-XXX/2-design.md` → 🛑 STOP for approval
3. **SCOPE** → If Flow artifacts: select scoped app (see [docs/scope-and-sdk.md](docs/scope-and-sdk.md))
4. **IMPLEMENT** → Create `3-implementation/` → 🛑 STOP for approval
5. **DEPLOY & TEST** → Run deployment, capture results → 🛑 STOP for approval

| Phase Transition | Sign-off Required |
|-----------------|-------------------|
| Spec → Design | ✅ YES |
| Design → Implementation | ✅ YES |
| Implementation → Testing | ❌ NO |
| Testing → Done | ❌ NO |

---

## ❌ NEVER

- Auto-approve sign-offs (only user can approve)
- Skip phases
- Mark sign-offs complete yourself (use ☐ until user approves)
- Deploy without user approval
- Create documentation files unless requested
- Commit/push code

## ✅ ALWAYS

- Read this file first
- Read `config.properties` before requirement work
- Check `manifest.json` for existing requirements
- Use templates from `templates/`
- Use clean naming (no REQ-IDs in artifact names)
- Validate before deploy: `node scripts/validate.cjs REQ-XXX`

---

## Artifact Naming

| Type | Pattern | Example |
|------|---------|---------|
| Script Include | PascalCase | `HighImpactJustificationUtil` |
| Business Rule | PascalCase, action | `ValidateHighImpactJustification` |
| Client Script | PascalCase, event | `HandleHighImpactChange` |
| UI Policy | PascalCase, behavior | `HighImpactFieldBehavior` |
| Custom Field | snake_case, u_ prefix | `u_high_impact_justification` |

---

## Key Commands

```bash
node scripts/validate.cjs REQ-XXX              # Validate requirement
cd mcp-servicenow && node deploy/deploy.js REQ-XXX  # Deploy
cd mcp-servicenow && node tests/test-connection.js  # Test connection
```

---

## Sign-Off Format

**Before approval:**
```markdown
| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | YYYY-MM-DD | ☐ |
| Approver | | | ☐ |
> **Status:** ⬜ Draft
```

**After approval:**
```markdown
| Role | Name | Date | Signature |
|------|------|------|-----------|
| Author | AI Agent | YYYY-MM-DD | ☑ |
| Approver | Ratnesh Tiwari | YYYY-MM-DD | ☑ |
> **Status:** ☑ Approved
```

---

## Error Recovery

1. Acknowledge the mistake
2. Explain what went wrong
3. Propose fix
4. Wait for user direction

---

## Reference Documentation

For detailed technical information, see:
- [docs/flow-designer.md](docs/flow-designer.md) - Flow Designer deployment
- [docs/update-sets.md](docs/update-sets.md) - Update set artifact capture
- [docs/scope-and-sdk.md](docs/scope-and-sdk.md) - Application scope & SDK deployment
