#!/bin/bash
# Real-time log monitor for scope switching operations
# Watches webapp logs and filters for scope-related activity

LOGS_DIR="logs"

echo "🔍 Monitoring scope switching logs..."
echo "📁 Watching: $LOGS_DIR/"
echo "Press Ctrl+C to stop"
echo ""

# Function to format and display log entries
display_log() {
  local line="$1"
  
  # Try to parse as JSON
  if command -v jq >/dev/null 2>&1; then
    timestamp=$(echo "$line" | jq -r '.timestamp // empty' 2>/dev/null)
    level=$(echo "$line" | jq -r '.level // empty' 2>/dev/null)
    category=$(echo "$line" | jq -r '.category // empty' 2>/dev/null)
    message=$(echo "$line" | jq -r '.message // empty' 2>/dev/null)
    data=$(echo "$line" | jq -c '.data // {}' 2>/dev/null)
    
    # Color coding
    case "$level" in
      "error") color="\033[0;31m" ;;
      "warn") color="\033[0;33m" ;;
      "info") color="\033[0;36m" ;;
      "debug") color="\033[0;90m" ;;
      *) color="\033[0m" ;;
    esac
    reset="\033[0m"
    
    # Format timestamp
    time=$(echo "$timestamp" | cut -d'T' -f2 | cut -d'.' -f1 2>/dev/null || echo "$timestamp")
    
    echo -e "${color}[$time] [$level] [$category]${reset} $message"
    if [ "$data" != "{}" ] && [ -n "$data" ]; then
      echo "$data" | jq '.' 2>/dev/null | sed 's/^/  /' || echo "  $data"
    fi
    echo ""
  else
    # Fallback: just show the line
    echo "$line"
  fi
}

# Monitor the most recent log file
monitor_latest() {
  while true; do
    # Find the most recent log file
    LATEST_LOG=$(find "$LOGS_DIR" -name "sess_*.jsonl" -type f -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)
    
    if [ -z "$LATEST_LOG" ] || [ ! -f "$LATEST_LOG" ]; then
      echo "⏳ Waiting for log files in $LOGS_DIR/..."
      sleep 2
      continue
    fi
    
    # Tail the file and filter for scope-related entries
    tail -f "$LATEST_LOG" 2>/dev/null | while IFS= read -r line; do
      # Filter for scope-related keywords (case insensitive)
      if echo "$line" | grep -qiE "scope|set_scope|verify_scope|ensureScopeActive|ScopeSwitch|concoursepicker|scope_helper|update.*set|sn_set_scope|sn_verify_scope|sn_create_update_set"; then
        display_log "$line"
      fi
    done
  done
}

# Start monitoring
monitor_latest
