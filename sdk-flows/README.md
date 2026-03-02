# Yantra SDK Flows

ServiceNow Flow Designer artifacts using the SDK Fluent API (v4.3.0+).

## Why SDK for Flows?

The REST API **cannot create functional Flow Designer triggers/actions** - they result in "Content not found" errors because Flow Designer requires internal snapshots that can only be created by the Flow Designer engine.

The SDK Fluent API solves this by:
- Compiling flows to proper ServiceNow metadata
- Creating all required snapshots automatically
- Providing full TypeScript type safety
- Enabling version control and PR reviews

## Prerequisites

- Node.js v20+
- pnpm v9+
- ServiceNow SDK CLI (`npm install -g @servicenow/sdk`)
- ServiceNow instance with appropriate access

## Setup

1. **Install dependencies:**
   ```bash
   cd sdk-flows
   pnpm install
   ```

2. **Authenticate with instance:**
   ```bash
   now-sdk login --instance dev181312.service-now.com
   ```

3. **Build flows:**
   ```bash
   pnpm run build
   ```

4. **Deploy to instance:**
   ```bash
   pnpm run deploy
   ```

## Project Structure

```
sdk-flows/
├── src/
│   └── fluent/
│       ├── generated/          # Auto-generated type definitions
│       └── *.now.ts            # Flow definitions
├── package.json
├── now.config.json             # ServiceNow scope configuration
├── tsconfig.json               # TypeScript configuration
└── README.md
```

## Creating Flows

Flow files use the `.now.ts` extension and follow the SDK Fluent syntax:

```typescript
import { action, Flow, wfa, trigger } from '@servicenow/sdk/automation'

export const myFlow = Flow(
    {
        $id: Now.ID['my_flow'],
        name: 'My Flow',
        description: 'Flow description',
    },
    wfa.trigger(trigger.record.created, { $id: Now.ID['my_trigger'] }, {
        table: 'incident',
        condition: 'active=true',
        run_flow_in: 'background',
    }),
    (params) => {
        // Flow logic here
        wfa.action(action.core.log, { $id: Now.ID['log_action'] }, {
            log_level: 'info',
            log_message: `Record: ${wfa.dataPill(params.trigger.current.sys_id, 'string')}`,
        })
    }
)
```

## Available Triggers

| Trigger Type | API |
|--------------|-----|
| Record Created | `trigger.record.created` |
| Record Updated | `trigger.record.updated` |
| Record Created/Updated | `trigger.record.createdOrUpdated` |
| Scheduled Daily | `trigger.scheduled.daily` |
| Scheduled Weekly | `trigger.scheduled.weekly` |
| Scheduled Monthly | `trigger.scheduled.monthly` |

## Available Actions

| Category | Actions |
|----------|---------|
| **Core** | `log`, `lookUpRecord`, `createRecord`, `updateRecord`, `deleteRecord` |
| **Communication** | `sendEmail`, `sendSms`, `sendNotification`, `createApproval` |
| **Attachments** | `addAttachment`, `copyAttachment` |

## Flow Logic

- `wfa.flowLogic.if()` - Conditional branching
- `wfa.flowLogic.elseIf()` - Else-if branch
- `wfa.flowLogic.else()` - Else branch
- `wfa.flowLogic.forEach()` - Loop over array
- `wfa.flowLogic.exitLoop()` - Break out of loop
- `wfa.flowLogic.skipIteration()` - Continue to next iteration

## Current Limitations (SDK v4.3.0 MVP)

- ❌ Service Catalog trigger (planned)
- ❌ DateTime flow variables (use StringColumn workaround)
- ❌ Try/Catch error handling
- ❌ Step rewind (Go-Back-To)

## Integration with Yantra

This project works alongside the MCP-based tools:

| Artifact Type | Tool |
|---------------|------|
| Business Rules | MCP REST API |
| Script Includes | MCP REST API |
| Client Scripts | MCP REST API |
| UI Policies | MCP REST API |
| **Flows/Subflows** | **SDK Fluent API** |
| **Service Catalog** | **SDK Fluent API** |

