# Enhanced Scope Switching Test

This test suite comprehensively tests all 5 tiers of scope switching with detailed logging for debugging.

## Prerequisites

1. **Environment Variables**: Create a `.env` file in `mcp-servicenow/` with:
   ```bash
   SN_INSTANCE_URL=https://your-instance.service-now.com
   SN_USERNAME=your-username
   SN_PASSWORD=your-password
   ```

2. **Custom Scope**: Your instance must have at least one custom application scope (not just Global) to test scope switching.

3. **Helper APIs**: The ScopeHelper API will be auto-deployed on connection, but you can also deploy it manually:
   ```bash
   cd mcp-servicenow
   node src/deployer/HelperApisSetup.js
   ```

## Running the Test

### Option 1: Using the test runner (recommended)
```bash
cd mcp-servicenow
./tests/run-scope-test.sh
```

### Option 2: Manual run with debug logging
```bash
cd mcp-servicenow
npm run build
export SN_DEBUG_SCOPE=true
node tests/test-scope-switching-enhanced.js
```

## What Gets Tested

1. **Connection & Authentication** - Verifies you can connect to the instance
2. **List Available Scopes** - Lists all scopes via concoursepicker API
3. **Tier 1: Concoursepicker API** - Tests the built-in scope switching API
4. **Tier 2: ScopeHelper Scripted REST API** - Tests the custom helper API
5. **Tier 3: User Preference Write** - Tests preference-based switching
6. **End-to-End Test** - Full workflow:
   - Switch scope
   - Create update set in custom scope
   - Verify application field
   - Create test artifact
   - Verify artifact capture in update set

## Log Output

The test generates two types of logs:

1. **Console Output**: Real-time colored output showing test progress
2. **JSON Log File**: Detailed structured logs saved to `logs/scope-test-{timestamp}.json`

The JSON log file contains:
- Timestamped entries for every operation
- Request/response data for API calls
- Verification results
- Error details with stack traces
- Test results summary

## Debug Logging

When `SN_DEBUG_SCOPE=true` is set, additional debug logs are printed to console showing:
- Each tier attempt
- API request/response details
- Verification results
- Fallback chain progression

## Interpreting Results

- ✅ **Green checkmark**: Test passed
- ❌ **Red X**: Test failed
- ⏭️ **Skip icon**: Test skipped (e.g., no custom scopes available)
- ⚠️ **Warning**: Test passed but with warnings

The test summary at the end shows:
- Total passed/failed/skipped counts
- Detailed results for each test
- Location of the JSON log file

## Troubleshooting

### "No custom scopes found"
- Create a scoped application in ServiceNow first
- The test requires at least one non-Global scope

### "ScopeHelper API not available"
- This is expected if helper APIs haven't been deployed yet
- The test will skip Tier 2 but continue with other tiers
- Deploy helper APIs: `node src/deployer/HelperApisSetup.js`

### "Connection failed"
- Verify your `.env` file has correct credentials
- Check that the instance URL is accessible
- Ensure your user has admin or delegated developer role

### "Tier 3 verification failed"
- This is expected - preferences only take effect after a new session
- The test marks this as "SKIPPED" rather than failed

## Cleanup

The test automatically cleans up:
- Test update sets created during the run
- Test artifacts (business rules, etc.)

If cleanup fails, you can manually delete:
- Update sets with name pattern: `Scope-Test-*`
- Scripts with name pattern: `TestScopeCapture_*`
