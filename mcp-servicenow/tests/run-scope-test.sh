#!/bin/bash
# Enhanced Scope Switching Test Runner
# Enables debug logging and runs the comprehensive test suite

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo "🔧 Building TypeScript..."
npm run build

echo ""
echo "🧪 Running Enhanced Scope Switching Test with Debug Logging..."
echo ""

# Enable debug logging
export SN_DEBUG_SCOPE=true

# Run the test
node tests/test-scope-switching-enhanced.js

echo ""
echo "✅ Test complete. Check logs/ directory for detailed logs."
