# Scope Switching Log Monitoring

This guide helps you monitor and capture all scope switching activity from the web application.

## Setup

### 1. Enable Debug Logging

Debug logging for scope switching is already enabled in `.env`:
```bash
SN_DEBUG_SCOPE=true
```

This will output detailed debug logs from the MCP server's scope switching methods.

### 2. Log Locations

**Webapp Logs:**
- Location: `webapp/logs/`
- Format: `sess_{timestamp}_{random}.jsonl` (one file per session)
- Content: All tool calls, API requests, and scope operations

**MCP Server Logs (if running separately):**
- Console output with `[ScopeSwitch]` prefix when `SN_DEBUG_SCOPE=true`

**Telemetry Dashboard:**
- Location: `webapp/logs/telemetry-session-{suffix}.md`
- Real-time markdown dashboard with session activity

## Monitoring Options

### Option 1: Real-time Log Monitor (Recommended)

Run the monitoring script in a separate terminal:

```bash
cd webapp
./monitor-scope-logs.sh
```

This will:
- Watch the most recent session log file
- Filter for scope-related activity
- Display formatted, color-coded entries in real-time
- Show timestamps, log levels, categories, and data

### Option 2: Manual Log Inspection

View the most recent log file:

```bash
cd webapp
tail -f logs/sess_*.jsonl | grep -i scope
```

Or view all scope-related entries:

```bash
cd webapp
grep -i "scope\|set_scope\|verify_scope" logs/sess_*.jsonl | jq '.'
```

### Option 3: Telemetry Dashboard

Open the telemetry markdown file in VS Code to see a live-updating dashboard:

```bash
cd webapp
ls -lt logs/telemetry-session-*.md | head -1
```

The dashboard shows:
- Phase transitions
- Tool usage stats
- Round-by-round activity
- Errors and warnings

## What Gets Logged

### Scope Switching Operations

1. **sn_set_scope** tool calls
   - Category: `mcp_tool`
   - Includes: scope_id, scope_name, method used

2. **sn_verify_scope** tool calls
   - Category: `mcp_tool`
   - Includes: target_scope_id, verification results

3. **sn_create_update_set** tool calls
   - Category: `mcp_tool`
   - Includes: update set details, application field

4. **Internal Scope Switching (ensureScopeActive)**
   - Debug logs with `[ScopeSwitch]` prefix
   - Shows all 5 tiers attempted
   - Verification results

### Log Entry Structure

Each log entry contains:
```json
{
  "timestamp": "2026-03-20T12:00:00.000Z",
  "level": "info|warn|error|debug",
  "sessionId": "sess_1234567890_abc123",
  "category": "mcp_tool|claude_api|context_mgmt",
  "message": "Tool executed: sn_set_scope",
  "data": {
    "toolName": "sn_set_scope",
    "input": { "scope_id": "...", "scope_name": "..." },
    "durationMs": 250,
    "success": true
  }
}
```

## Filtering Logs

### Find All Scope Operations

```bash
cd webapp
grep -i "sn_set_scope\|sn_verify_scope\|ensureScopeActive" logs/sess_*.jsonl
```

### Find Errors

```bash
cd webapp
grep '"level":"error"' logs/sess_*.jsonl | grep -i scope
```

### Find Debug Details

```bash
cd webapp
grep '"level":"debug"' logs/sess_*.jsonl | grep -i "ScopeSwitch"
```

### Extract Tool Call Data

```bash
cd webapp
jq 'select(.category == "mcp_tool" and (.message | contains("scope") or .message | contains("update_set")))' logs/sess_*.jsonl
```

## Analyzing a Session

To analyze a complete session:

```bash
cd webapp

# Find the latest session log
LATEST=$(ls -t logs/sess_*.jsonl | head -1)

# Extract scope operations
echo "=== Scope Operations ==="
jq 'select(.category == "mcp_tool" and (.message | contains("scope") or .message | contains("update_set")))' "$LATEST"

# Extract errors
echo "=== Errors ==="
jq 'select(.level == "error")' "$LATEST"

# Summary stats
echo "=== Summary ==="
echo "Total log entries: $(wc -l < "$LATEST")"
echo "Scope operations: $(grep -c "scope\|update_set" "$LATEST")"
echo "Errors: $(grep -c '"level":"error"' "$LATEST")"
```

## Tips

1. **Keep the monitor running** in a separate terminal while testing
2. **Check telemetry dashboard** for a high-level view
3. **Search logs by session ID** if you have multiple sessions
4. **Use jq** for better JSON parsing and filtering
5. **Watch console output** for immediate feedback (debug logs print to console)

## Troubleshooting

### No logs appearing?
- Check that `logs/` directory exists and is writable
- Verify the webapp server is running
- Check file permissions: `ls -la logs/`

### Monitor script not working?
- Ensure `jq` is installed: `brew install jq` (macOS) or `apt-get install jq` (Linux)
- Check script permissions: `chmod +x monitor-scope-logs.sh`

### Debug logs not showing?
- Verify `SN_DEBUG_SCOPE=true` in `.env`
- Restart the webapp server after changing `.env`
- Check console output (debug logs also print to console)
