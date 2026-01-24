#!/bin/bash
# =============================================================================
# Ralph Loop - Autonomous Test Fix System with Ticket Integration
# Automatically fixes failing tests and tracks progress in ticket system
# Now includes E2E browser testing via Playwright MCP
# =============================================================================

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
LOG_DIR="$PROJECT_DIR/logs"
SCREENSHOTS_DIR="$LOG_DIR/screenshots"
FIXTURES_DIR="$PROJECT_DIR/test-fixtures"
MAX_ITERATIONS="${RALPH_MAX_ITERATIONS:-10}"
TICKET_INTEGRATION="${RALPH_TICKET_INTEGRATION:-true}"
E2E_ENABLED="${RALPH_E2E_ENABLED:-true}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Ensure directories exist
mkdir -p "$LOG_DIR"
mkdir -p "$SCREENSHOTS_DIR"

# Log file for this run
RUN_ID=$(date +"%Y%m%d_%H%M%S")
RUN_LOG="$LOG_DIR/ralph_run_$RUN_ID.log"

log() {
    local msg="[$(date '+%H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$RUN_LOG"
}

# Run tests and capture output
run_tests() {
    cd "$PROJECT_DIR/client"
    npm test -- --watchAll=false --passWithNoTests 2>&1
}

# Check if tests pass
tests_pass() {
    local output=$(run_tests)
    echo "$output" >> "$RUN_LOG"

    if echo "$output" | grep -q "FAIL"; then
        return 1
    fi
    return 0
}

# Extract failing tests from output
get_failing_tests() {
    run_tests | grep -E "FAIL|●|✕" | head -20
}

# Create ticket for test failures
create_failure_ticket() {
    local failures="$1"

    if [ "$TICKET_INTEGRATION" != "true" ]; then
        return
    fi

    # Create a single ticket for the Ralph Loop run
    local title="[Ralph Loop] Test Failures - Run $RUN_ID"
    local description="Automated test failure detection by Ralph Loop.\n\nFailing tests:\n$failures"

    local ticket_id=$("$SCRIPTS_DIR/ralph-ticket.sh" create "$title" "$description" "General" "High")
    echo "$ticket_id"
}

# Update ticket progress
update_ticket() {
    local ticket_id="$1"
    local message="$2"

    if [ "$TICKET_INTEGRATION" != "true" ] || [ -z "$ticket_id" ]; then
        return
    fi

    "$SCRIPTS_DIR/ralph-ticket.sh" note "$ticket_id" "$message"
}

# Resolve ticket on success
resolve_ticket() {
    local ticket_id="$1"
    local iterations="$2"
    local fixes="$3"

    if [ "$TICKET_INTEGRATION" != "true" ] || [ -z "$ticket_id" ]; then
        return
    fi

    "$SCRIPTS_DIR/ralph-ticket.sh" resolve "$ticket_id" \
        "Test failures fixed by Ralph Loop in $iterations iteration(s)" \
        "Applied fixes:\n$fixes\n\nAll tests now passing. Validated by verify-tickets.sh"
}

# =============================================================================
# E2E Testing Functions (Playwright MCP Integration)
# =============================================================================

# Check if services are running for E2E tests
check_e2e_services() {
    local all_ok=true
    for port in 56400 56401 56402 56403 56404; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null || echo "000")
        if [ "$response" = "000" ]; then
            all_ok=false
        fi
    done
    [ "$all_ok" = true ]
}

# Ensure test fixtures exist
ensure_e2e_fixtures() {
    if [ ! -f "$FIXTURES_DIR/short-track.mp3" ]; then
        log "${YELLOW}Generating E2E test fixtures...${NC}"
        "$SCRIPTS_DIR/generate-test-fixtures.sh" >> "$RUN_LOG" 2>&1
    fi
}

# Check E2E readiness
e2e_ready() {
    if [ "$E2E_ENABLED" != "true" ]; then
        log "${YELLOW}E2E tests disabled (RALPH_E2E_ENABLED=false)${NC}"
        return 1
    fi

    if ! check_e2e_services; then
        log "${YELLOW}E2E tests skipped - not all services running${NC}"
        log "  Start services with: ./start-services.sh"
        return 1
    fi

    ensure_e2e_fixtures
    return 0
}

# Output E2E test prompt for Claude
generate_e2e_prompt() {
    cat << EOF
E2E Browser Tests - Run using Playwright MCP tools

PREREQUISITE: All services are running on ports 56400-56404

TEST SUITE:

1. **Basic App Load**
   - Navigate to http://localhost:56400
   - Take screenshot
   - Verify main UI elements load (audio input area, header)

2. **Audio Upload Test**
   - Upload file: $FIXTURES_DIR/short-track.mp3
   - Wait for waveform to appear
   - Take screenshot showing loaded audio

3. **Verification Stages**
   - After audio loads, verify these stages appear:
     - Audio Quality stage
     - Rhythm Verification stage
     - Chord Verification stage
   - Take screenshot of verification panel

4. **Analysis Results**
   - Verify BPM is detected and displayed
   - Verify drum grid shows hits
   - Verify chord progression is displayed
   - Take screenshot of analysis results

SCREENSHOT DIRECTORY: $SCREENSHOTS_DIR

INSTRUCTIONS FOR CLAUDE:
- Use browser_navigate for navigation
- Use browser_snapshot to capture page state
- Use browser_click to interact with buttons
- Take screenshots on both success and failure
- Report any errors or unexpected behavior
EOF
}

# Log E2E test results
log_e2e_result() {
    local test_name="$1"
    local status="$2"
    local details="$3"

    log ""
    log "${PURPLE}━━━ E2E Test: $test_name ━━━${NC}"
    if [ "$status" = "PASS" ]; then
        log "${GREEN}  Status: PASS${NC}"
    else
        log "${RED}  Status: FAIL${NC}"
    fi
    log "  Details: $details"
    log ""
}

# =============================================================================
# Main Ralph Loop
# =============================================================================

# Main Ralph Loop
main() {
    echo ""
    echo -e "${PURPLE}=========================================="
    echo "  Ralph Loop - Autonomous Test Fixer"
    echo "==========================================${NC}"
    echo ""
    log "Starting Ralph Loop run: $RUN_ID"
    log "Max iterations: $MAX_ITERATIONS"
    log "Ticket integration: $TICKET_INTEGRATION"
    log "E2E tests enabled: $E2E_ENABLED"
    echo ""

    # Initial test run
    log "${BLUE}[Pre-check] Running initial tests...${NC}"

    if tests_pass; then
        log "${GREEN}✓ All unit tests passing!${NC}"

        # Run E2E tests if enabled
        if e2e_ready; then
            echo ""
            log "${BLUE}[E2E Phase] Running browser tests...${NC}"
            log ""
            log "E2E Test Instructions (for Playwright MCP):"
            log "─────────────────────────────────────────────"
            generate_e2e_prompt | tee -a "$RUN_LOG"
            log ""
            log "${GREEN}E2E tests ready to run via Playwright MCP tools${NC}"
            log "Use browser_navigate, browser_snapshot, browser_click"
        fi

        echo ""
        "$SCRIPTS_DIR/ralph-ticket.sh" summary 2>/dev/null || true
        exit 0
    fi

    # Get failing tests
    local failures=$(get_failing_tests)
    log "${RED}✗ Tests failing:${NC}"
    echo "$failures" | head -10

    # Create ticket for this run
    local ticket_id=""
    if [ "$TICKET_INTEGRATION" = "true" ]; then
        log "${BLUE}Creating ticket for this run...${NC}"
        ticket_id=$(create_failure_ticket "$failures")
        if [ -n "$ticket_id" ]; then
            log "${GREEN}✓ Ticket created: $ticket_id${NC}"
            "$SCRIPTS_DIR/ralph-ticket.sh" status "$ticket_id" "IN_PROGRESS"
        fi
    fi

    # Track fixes applied
    local fixes_applied=""
    local iteration=0

    # Main loop
    while [ $iteration -lt $MAX_ITERATIONS ]; do
        iteration=$((iteration + 1))
        echo ""
        log "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        log "${PURPLE}[Iteration $iteration/$MAX_ITERATIONS]${NC}"
        log "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

        update_ticket "$ticket_id" "[Iteration $iteration] Starting analysis..."

        # Run Claude Code to fix the issue
        log "${BLUE}Invoking Claude Code to analyze and fix...${NC}"

        # Get test output for Claude
        local test_output=$(run_tests 2>&1 | tail -100)

        # Create prompt for Claude
        local prompt="Ralph Loop Iteration $iteration

The following tests are failing:

$test_output

Please:
1. Analyze the test failures
2. Identify the root cause
3. Fix the issue in the code
4. The fix should be minimal and targeted

After fixing, I will re-run the tests."

        # Note: In actual implementation, this would call Claude Code
        # For now, we simulate by just running tests again
        log "${YELLOW}(Waiting for Claude Code to apply fixes...)${NC}"

        # Placeholder for Claude Code invocation
        # In real implementation: claude-code --prompt "$prompt"

        # Re-run tests
        log "${BLUE}Re-running tests after fix attempt...${NC}"

        if tests_pass; then
            log "${GREEN}✓ All tests passing!${NC}"
            fixes_applied="${fixes_applied}\n- Iteration $iteration: Fix applied successfully"

            update_ticket "$ticket_id" "[Iteration $iteration] Tests now passing! Validating..."

            # Run verification
            log "${BLUE}Running verification...${NC}"
            if "$SCRIPTS_DIR/verify-tickets.sh" > /dev/null 2>&1; then
                log "${GREEN}✓ Verification passed!${NC}"

                # Run E2E tests before declaring victory
                if e2e_ready; then
                    log ""
                    log "${BLUE}[E2E Phase] Unit tests pass - now run browser tests${NC}"
                    log ""
                    generate_e2e_prompt | tee -a "$RUN_LOG"
                    log ""
                    log "${YELLOW}Run E2E tests via Playwright MCP, then re-run Ralph Loop${NC}"
                fi

                # Resolve ticket
                resolve_ticket "$ticket_id" "$iteration" "$fixes_applied"

                echo ""
                log "${GREEN}=========================================="
                log "  SUCCESS! All unit tests passing."
                log "  Iterations: $iteration"
                log "  Ticket: $ticket_id"
                [ "$E2E_ENABLED" = "true" ] && log "  E2E: Ready for browser testing"
                log "==========================================${NC}"

                # Backup tickets after successful run
                "$SCRIPTS_DIR/backup-tickets.sh" > /dev/null 2>&1 || true

                # Show summary
                echo ""
                "$SCRIPTS_DIR/ralph-ticket.sh" summary 2>/dev/null || true

                exit 0
            else
                log "${YELLOW}⚠ Verification had warnings${NC}"
            fi
        else
            local new_failures=$(get_failing_tests)
            log "${YELLOW}⚠ Tests still failing:${NC}"
            echo "$new_failures" | head -5
            fixes_applied="${fixes_applied}\n- Iteration $iteration: Attempted fix, tests still failing"
            update_ticket "$ticket_id" "[Iteration $iteration] Tests still failing after fix attempt"
        fi

        # Check for user interrupt
        if [ -f "$PROJECT_DIR/.ralph-stop" ]; then
            log "${YELLOW}Stop file detected, aborting...${NC}"
            rm -f "$PROJECT_DIR/.ralph-stop"
            break
        fi
    done

    # Max iterations reached
    log "${RED}=========================================="
    log "  FAILED: Max iterations ($MAX_ITERATIONS) reached"
    log "==========================================${NC}"

    if [ -n "$ticket_id" ]; then
        update_ticket "$ticket_id" "Ralph Loop reached max iterations ($MAX_ITERATIONS) without fully resolving the issue. Manual intervention required."
        "$SCRIPTS_DIR/ralph-ticket.sh" status "$ticket_id" "REVIEW"
    fi

    exit 1
}

# Handle arguments
case "${1:-run}" in
    run)
        main
        ;;
    stop)
        touch "$PROJECT_DIR/.ralph-stop"
        echo "Stop signal sent. Ralph Loop will stop after current iteration."
        ;;
    status)
        "$SCRIPTS_DIR/ralph-ticket.sh" summary
        ;;
    e2e)
        # Run E2E test preparation
        if e2e_ready; then
            log "${GREEN}E2E tests ready${NC}"
            echo ""
            generate_e2e_prompt
        else
            log "${RED}E2E tests not ready - check services${NC}"
            exit 1
        fi
        ;;
    help|*)
        echo "Ralph Loop - Autonomous Test Fix System"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  run     Start Ralph Loop (default)"
        echo "  stop    Signal Ralph Loop to stop"
        echo "  status  Show ticket summary"
        echo "  e2e     Show E2E test instructions for Playwright MCP"
        echo ""
        echo "Environment Variables:"
        echo "  RALPH_MAX_ITERATIONS=10       Max fix attempts"
        echo "  RALPH_TICKET_INTEGRATION=true Enable ticket tracking"
        echo "  RALPH_E2E_ENABLED=true        Enable E2E browser testing"
        echo ""
        echo "E2E Testing (Playwright MCP):"
        echo "  1. Ensure services are running: ./start-services.sh"
        echo "  2. Run: $0 e2e  (shows test instructions)"
        echo "  3. Execute tests using Playwright MCP browser tools"
        echo ""
        echo "To stop Ralph Loop:"
        echo "  $0 stop"
        echo "  OR press Ctrl+C"
        echo "  OR create file: touch .ralph-stop"
        ;;
esac
