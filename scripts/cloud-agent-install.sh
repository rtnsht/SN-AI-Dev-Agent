#!/usr/bin/env bash
set -euo pipefail

echo "[cloud-agent-setup] Installing mcp-servicenow dependencies"
npm ci --prefix mcp-servicenow

echo "[cloud-agent-setup] Installing webapp dependencies (includes exceljs)"
npm ci --prefix webapp

echo "[cloud-agent-setup] Dependency install complete"
