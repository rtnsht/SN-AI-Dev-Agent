# Dynamic AI Suggestions Enhancement

## Overview

Enhance all five suggestion tabs (For you, Build a feature, Explore instance, Quick queries, Latest Updates) to be fully dynamic and personalized based on instance data, user role, and activity. Add a persistent right sidebar suggestion panel, auto-refresh, new-chat-on-click, and an expandable "Latest Updates" tab showing recent update set summaries.

## Problem

- The "For you" tab fetches instance data once at connection from 4 SN tables, randomly picks 4 prompts, no personalization.
- The other 3 tabs ("Build a feature", "Explore instance", "Quick queries") are entirely hardcoded static strings.
- Suggestions only appear on the empty chat screen and disappear once a conversation starts.
- The right sidebar only shows connection info.

## Solution

### 1. Enrich User Context

Extend `testConnection()` to return the user's `sys_id`, `email`, and assignment groups (via `sys_user_grmember`). This context enables personalized prompts like "You have N open incidents" and "N unassigned in your group".

### 2. Categorized Prompt Generation

Replace `fetchInstancePrompts()` (returns flat `ExamplePrompt[]`) with `fetchCategorizedPrompts()` (returns `CategorizedPrompts` with all 4 tab keys). Run 13 parallel ServiceNow queries:

| Query | Table | Category Targets |
|-------|-------|-----------------|
| Custom tables | `sys_db_object` | explore, build |
| Business rules | `sys_script` | explore, build |
| Catalog items | `sc_cat_item` | explore, build |
| Update sets | `sys_update_set` | foryou, quick |
| My open incidents | `incident` | foryou, quick |
| My pending changes | `change_request` | foryou, quick |
| Pending approvals | `sysapproval_approver` | foryou |
| Group unassigned | `incident` | foryou, quick |
| Scheduled jobs | `sysauto_script` | explore, quick |
| ACLs | `sys_security_acl` | explore |
| Knowledge bases | `kb_knowledge_base` | explore, build |
| Workflows | `wf_workflow` | explore, build |
| Notifications | `sysevent_email_action` | explore, quick |

Each prompt gets a priority score (user-specific=10, instance-specific-with-counts=7, instance-specific=5, generic=2). Top 6 per category are returned.

### 3. All Tabs Dynamic

- **For you**: My incidents, changes, approvals, group unassigned, role-based prompts
- **Build a feature**: Feature ideas from instance gaps (tables without rules, items without workflows)
- **Explore instance**: Review/audit prompts from real artifacts (rules by table, scheduled jobs, ACLs)
- **Quick queries**: Data lookups using actual table names, group names, counts

### 4. Persistent Sidebar Panel

New `SuggestionPanel` component in the right sidebar with:
- Tabbed interface (For you, Build, Explore, Quick)
- Compact cards with icon, text, description
- Click triggers new chat with that prompt
- Manual refresh button + "Updated X min ago" timestamp

### 5. Auto-Refresh

Suggestions re-fetch every 5 minutes via `setInterval`. Manual refresh available. Old suggestions stay visible during refresh.

### 6. New Chat on Click

Clicking a sidebar suggestion during an active conversation clears the session and sends the prompt as a new message.

### 7. Latest Updates Tab

A new 5th tab ("Latest Updates") shows recent update sets from the instance:
- Expandable rows: collapsed shows state dot + name; expanded shows state badge, timestamp, application, description
- "Explore this update set" action button sends a prompt to analyze that update set
- Count badge on the tab shows number of recent update sets
- Fetches up to 15 recent update sets (excluding Default, ignoring "ignore" state) ordered by sys_updated_on

## Architecture

```
User connects
  -> testConnection() returns enriched userInfo (sys_id, groups)
  -> POST /api/instance-prompts with userContext
  -> fetchCategorizedPrompts() runs 13 parallel SN queries
  -> Returns { foryou, build, explore, quick } with scored prompts
  -> State: categorizedPrompts
  -> Feeds: SuggestionPanel (right sidebar) + ChatWindow hero tabs
  -> Auto-refresh every 5 min
  -> Click sidebar suggestion -> handleNewChat + auto-send
```

## Files Modified

| File | Change |
|------|--------|
| `webapp/src/lib/types.ts` | Add `CategorizedPrompts`, extend `ConnectionResult.userInfo` |
| `webapp/src/lib/sn-engine.ts` | Extend `testConnection()`, add `fetchCategorizedPrompts()` |
| `webapp/src/app/api/instance-prompts/route.ts` | Accept user context, return categorized prompts |
| `webapp/src/components/SuggestionPanel.tsx` | New sidebar tabbed suggestion panel |
| `webapp/src/app/app/page.tsx` | Wire sidebar panel, auto-refresh, new-chat handler |
| `webapp/src/components/ChatWindow.tsx` | Consume categorized prompts for all hero tabs |
| `webapp/src/app/globals.css` | Styles for suggestion panel |
