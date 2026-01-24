# Ralph Loop Self-Correction Protocol

## Overview
When the Ralph Loop is active, you are operating in autonomous mode. Your goal is to fix all failing tests and achieve a green test suite without human intervention.

## Core Principles

1. **Test-Driven Fixes**
   - ALWAYS run tests first to understand failures
   - Fix ONE test at a time, starting with the first failure
   - Re-run tests after each fix to verify progress
   - If a fix breaks other tests, revert and try a different approach

2. **Success Criteria**
   - All tests pass (exit code 0)
   - No console errors or warnings
   - Code builds successfully
   - When achieved, loop will auto-terminate

3. **Failure Analysis**
   - Read test output carefully - it contains the solution
   - Check test file to understand expected behavior
   - Review related code files mentioned in stack traces
   - Look for typos, incorrect imports, or logic errors

4. **Fix Strategy**
   ```
   1. Identify root cause from test output
   2. Locate the relevant file and line number
   3. Make minimal, targeted changes
   4. Verify the fix doesn't introduce regressions
   5. Run tests again
   6. If still failing, analyze new error and iterate
   ```

5. **Time Management**
   - You have a maximum of 10 minutes per loop iteration
   - If stuck on same error for 3+ attempts, try alternative approach
   - Priority order: syntax errors -> import errors -> logic errors -> edge cases

6. **Autonomous Decision Making**
   - Make changes confidently without asking permission
   - Use the Read tool to understand context before editing
   - Make one logical change per iteration
   - Document your reasoning in commit messages

## Test Commands

### Frontend Tests
```bash
cd music-analyzer-project/client && npm test -- --watchAll=false --passWithNoTests
```

### Full Test Suite
```bash
cd music-analyzer-project && npm run test:all
```

## Common Failure Patterns

### Pattern 1: Import Errors
```
Cannot find module './Component'
```
**Fix**: Check file path, extension, and export/import syntax

### Pattern 2: Undefined Props
```
TypeError: Cannot read property 'x' of undefined
```
**Fix**: Add prop validation, default props, or optional chaining

### Pattern 3: Async Issues
```
Warning: An update to Component inside a test was not wrapped in act(...)
```
**Fix**: Wrap async operations in `await waitFor()` or `act()`

### Pattern 4: Mock Failures
```
jest.fn() value must be a mock function
```
**Fix**: Ensure mocks are properly setup before tests run

## Ralph Loop Iteration Template

When operating in Ralph Loop mode, follow this format:

```
[Iteration N]
1. Running tests...
   -> Test output: [paste relevant output]

2. Analysis:
   -> Root cause: [explanation]
   -> Affected file: [file:line]

3. Fix applied:
   -> Changed: [description]
   -> Reasoning: [why this fixes it]

4. Re-running tests...
   -> Result: [pass/fail]
   -> Next action: [continue or exit]
```

## Exit Conditions

**SUCCESS** - Loop terminates when:
- All tests pass
- No errors in test output
- Build completes successfully

**ABORT** - Loop terminates on:
- Max iterations reached (--max-iterations flag)
- User presses Escape or Ctrl+C
- Timeout (10 minutes)

## Safety Rules

1. **Never**:
   - Delete test files
   - Skip tests by adding `.skip`
   - Modify test expectations to make tests pass artificially
   - Make unrelated changes outside the scope of failing tests
   - Push to remote repository

2. **Always**:
   - Make minimal changes to fix specific failures
   - Preserve existing functionality
   - Maintain code style consistency
   - Add comments for non-obvious fixes
   - Clean up temporary debugging code

## Context Loading

When a new Ralph Loop session starts, you should:
1. Read the test output provided in the prompt
2. Identify all failing test files
3. Read the failing test files to understand expectations
4. Read the implementation files being tested
5. Form a hypothesis about the root cause
6. Apply targeted fixes

## Ticket Integration

Ralph Loop automatically tracks all fix attempts in the ticket system.

**Workflow:**
```
Test Failure Detected
        |
        v
+-------------------+
| Create Ticket     |  -> TICKET-XXX created with failure details
| Status: OPEN      |
+-------------------+
        |
        v
+-------------------+
| Start Fixing      |  -> Status: IN_PROGRESS
| Add iteration     |  -> Notes added for each attempt
| notes             |
+-------------------+
        |
        v
    Tests Pass?
    /        \
   No         Yes
   |           |
   v           v
Continue   +-------------------+
 Loop      | Resolve Ticket    |  -> Status: RESOLVED
           | Document fix      |  -> Root cause + resolution added
           | Backup database   |  -> Automatic backup created
           +-------------------+
```

**Scripts:**
```bash
# Start Ralph Loop with ticket integration
./scripts/ralph/ralph-loop.sh

# Stop Ralph Loop gracefully
./scripts/ralph/ralph-loop.sh stop

# View ticket summary
./scripts/ralph/ralph-loop.sh status

# Manual ticket operations
./scripts/ralph/ralph-ticket.sh create "Title" "Description" "Component" "Priority"
./scripts/ralph/ralph-ticket.sh status TICKET-006 IN_PROGRESS
./scripts/ralph/ralph-ticket.sh note TICKET-006 "Fixed the import statement"
./scripts/ralph/ralph-ticket.sh resolve TICKET-006 "Missing import" "Added import"
./scripts/ralph/ralph-ticket.sh get-open
./scripts/ralph/ralph-ticket.sh summary

# Parse test output and create tickets
npm test 2>&1 | ./scripts/ralph/ralph-ticket.sh parse-failures
```

**Environment Variables:**
```bash
RALPH_MAX_ITERATIONS=10        # Max fix attempts before giving up
RALPH_TICKET_INTEGRATION=true  # Enable/disable ticket tracking
```

**Ticket Fields Updated by Ralph Loop:**
| Field | When Updated |
|-------|--------------|
| status | OPEN -> IN_PROGRESS -> RESOLVED/REVIEW |
| notes | Each iteration adds a note |
| rootCause | Set when issue is identified |
| resolution | Set when fix is validated |

**Log Files:**
- `logs/ralph_run_YYYYMMDD_HHMMSS.log` - Full run log
- `logs/ralph-tickets.log` - Ticket API operations log
- `logs/e2e_run_YYYYMMDD_HHMMSS.log` - E2E test run log
- `logs/screenshots/` - E2E test screenshots

## E2E Browser Testing (Playwright MCP)

Ralph Loop now supports browser-based E2E testing via Playwright MCP tools.

**How It Works:**
1. After Jest unit tests pass, Ralph Loop checks for E2E readiness
2. Verifies all 5 services are running (ports 56400-56404)
3. Generates test fixtures if needed (`test-fixtures/`)
4. Outputs test instructions for Playwright MCP execution
5. Claude executes browser tests using MCP tools

**E2E Test Commands:**
```bash
# Show E2E test instructions
./scripts/ralph/ralph-loop.sh e2e

# Run full loop (unit tests + E2E preparation)
./scripts/ralph/ralph-loop.sh run

# Disable E2E testing
RALPH_E2E_ENABLED=false ./scripts/ralph/ralph-loop.sh run
```

**Test Fixtures (Auto-Generated):**
| File | Duration | Purpose |
|------|----------|---------|
| `test-tone.mp3` | 5s | Basic audio loading test |
| `short-track.mp3` | 10s | Quick analysis test |
| `drum-loop.mp3` | 8s | Rhythm detection test |
| `piano-chords.mp3` | 10s | Chord detection test |
| `silence.mp3` | 3s | Edge case testing |
| `full-test.mp3` | 15s | Full workflow test |

**Playwright MCP Tools:**
- `browser_navigate` - Navigate to URL
- `browser_snapshot` - Capture accessibility tree/state
- `browser_click` - Click elements
- `browser_type` - Type text
- `browser_screenshot` - Save screenshot

**E2E Test Scenarios:**
1. App Load - Navigate to http://localhost:56400, verify UI loads
2. Audio Upload - Upload test-fixtures/short-track.mp3
3. Verification Stages - Check Audio Quality, Rhythm, Chord stages
4. Analysis Results - Verify BPM, drum grid, chord progression
5. Export - Test MIDI export functionality

**Screenshot Directory:** `logs/screenshots/`

## Activation

To activate the Ralph Loop:
```bash
./scripts/ralph/ralph-loop.sh
```

Or manually:
```bash
./init-claude.sh && ./scripts/ralph/ralph-loop.sh
```

The loop will automatically:
1. Run your tests
2. Capture failures
3. Invoke Claude Code with test output
4. Apply fixes autonomously
5. Repeat until all tests pass
6. Clean up and exit
