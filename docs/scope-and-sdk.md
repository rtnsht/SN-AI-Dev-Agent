# Application Scope & SDK Deployment Reference

## Scope Requirements by Artifact Type

| Artifact Type | Global OK? | Scoped Required? | Deploy Method |
|--------------|------------|------------------|---------------|
| Business Rule | ✅ | ❌ | REST API |
| Script Include | ✅ | ❌ | REST API |
| Client Script | ✅ | ❌ | REST API |
| UI Policy | ✅ | ❌ | REST API |
| UI Action | ✅ | ❌ | REST API |
| ACL | ✅ | ❌ | REST API |
| **Flow** | ❌ | ✅ | **SDK** |
| **Subflow** | ❌ | ✅ | **SDK** |
| **Flow Action** | ❌ | ✅ | **SDK** |

## MCP Tools for Scope Management

| Tool | Purpose |
|------|---------|
| `sn_get_custom_apps` | Query available scoped applications |
| `sn_get_scope_selection_options` | Get recommendations based on artifact types |
| `sn_create_custom_app` | Create new scoped application |

## ServiceNow Fluent SDK

### When to Use
- Flow Designer flows, subflows, flow actions
- Any artifact requiring scoped application context

### Project Structure
```
sdk-flows/
├── now.config.json      # Scope and instance config
├── package.json         # SDK dependencies
├── tsconfig.json        # TypeScript config
└── src/fluent/          # Flow definitions
```

### Configuration (now.config.json)
```json
{
  "name": "yantra-ai-dev-agent",
  "scope": "x_snc_yantra",
  "scopeId": "<sys_id from sys_app>",
  "version": "1.0.0",
  "instances": {
    "yantra-dev": { "host": "dev300943.service-now.com" }
  }
}
```

### Commands
```bash
npx now-sdk build                              # Build flows
npx now-sdk install --auth yantra-dev --reinstall  # First deploy
npx now-sdk install --auth yantra-dev          # Updates
```

### Key Learnings
1. Use `--reinstall` flag for first-time deployments
2. SDK properly handles scope (unlike REST API)
3. Flows are created in draft status — activate in UI to publish
