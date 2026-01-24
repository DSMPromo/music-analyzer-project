#!/bin/bash
# =============================================================================
# Ralph E2E - Browser-based End-to-End Testing via Playwright MCP
# Uses Playwright MCP tools for browser automation testing
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS_DIR="$PROJECT_DIR/scripts"
FIXTURES_DIR="$PROJECT_DIR/test-fixtures"
LOG_DIR="$PROJECT_DIR/logs"
SCREENSHOTS_DIR="$PROJECT_DIR/logs/screenshots"

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
E2E_LOG="$LOG_DIR/e2e_run_$RUN_ID.log"

log() {
    local msg="[$(date '+%H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$E2E_LOG"
}

# Check if services are running
check_services() {
    log "${BLUE}Checking service health...${NC}"

    local services_ok=true

    # Check each service
    for port in 56400 56401 56402 56403 56404; do
        response=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$port" 2>/dev/null || echo "000")
        if [ "$response" = "000" ]; then
            log "${RED}  Service on port $port not responding${NC}"
            services_ok=false
        else
            log "${GREEN}  Port $port - OK${NC}"
        fi
    done

    if [ "$services_ok" = false ]; then
        return 1
    fi
    return 0
}

# Start services if not running
ensure_services() {
    if check_services; then
        log "${GREEN}All services already running${NC}"
        return 0
    fi

    log "${YELLOW}Starting services...${NC}"
    "$PROJECT_DIR/start-services.sh" &

    # Wait for services to be ready
    local max_wait=60
    local waited=0
    while [ $waited -lt $max_wait ]; do
        if check_services 2>/dev/null; then
            log "${GREEN}All services started${NC}"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
        log "${YELLOW}Waiting for services... ($waited/$max_wait sec)${NC}"
    done

    log "${RED}Failed to start services within $max_wait seconds${NC}"
    return 1
}

# Generate test fixtures if needed
ensure_fixtures() {
    if [ ! -f "$FIXTURES_DIR/short-track.mp3" ]; then
        log "${YELLOW}Generating test fixtures...${NC}"
        "$SCRIPTS_DIR/generate-test-fixtures.sh"
    else
        log "${GREEN}Test fixtures already exist${NC}"
    fi
}

# E2E Test definitions
# These are designed to be executed via Playwright MCP tools by Claude
# The script outputs test scenarios that Claude can execute

define_e2e_tests() {
    cat << 'EOF'
# E2E Test Scenarios for Music Analyzer
# Execute these using Playwright MCP browser tools

## Test 1: App Load and Initial State
STEPS:
1. browser_navigate to http://localhost:56400
2. browser_snapshot to verify page loaded
3. Verify: Page contains "Music Analyzer" or audio upload area
EXPECTED: App loads without errors, main UI visible

## Test 2: Audio File Upload
STEPS:
1. browser_navigate to http://localhost:56400
2. Find file input element
3. Upload test file: test-fixtures/short-track.mp3
4. browser_snapshot after upload
5. Wait for waveform to appear (verify by snapshot)
EXPECTED: Audio loads, waveform displays

## Test 3: Verification Workflow
STEPS:
1. After audio loads (Test 2)
2. browser_snapshot to check verification stages
3. Verify: Audio Quality stage visible
4. Wait for Rhythm analysis (may take a few seconds)
5. browser_snapshot to check Rhythm stage
6. Wait for Chord detection
7. browser_snapshot to check Chord stage
EXPECTED: All verification stages appear and process

## Test 4: RhythmGrid Display
STEPS:
1. After audio loads
2. browser_snapshot focused on rhythm section
3. Verify: BPM display visible
4. Verify: Drum grid rows visible (Kick, Snare, Hi-Hat, etc.)
5. Verify: Bar numbers displayed
EXPECTED: RhythmGrid renders with detected drums

## Test 5: ChordDetector Display
STEPS:
1. After audio loads
2. browser_snapshot focused on chord section
3. Verify: Piano keyboard visible
4. Verify: Chord progression bars visible
5. Verify: Circle of Fifths visible (if present)
EXPECTED: ChordDetector renders with detected chords

## Test 6: Export MIDI
STEPS:
1. After analysis completes
2. Find "Export MIDI" or MIDI download button
3. browser_click on the button
4. browser_snapshot to verify action
EXPECTED: MIDI export initiates (download or file save)

## Test 7: Ticket Manager
STEPS:
1. browser_navigate to http://localhost:56400
2. Find "Issues" button in header
3. browser_click on Issues button
4. browser_snapshot to verify modal opens
5. Verify: Ticket list visible
6. Verify: "New Ticket" button visible
EXPECTED: Ticket manager modal opens and displays tickets

## Test 8: Settings Panel
STEPS:
1. Find Settings or gear icon
2. browser_click on settings
3. browser_snapshot to verify panel
EXPECTED: Settings panel opens

## Test 9: Error Handling - Invalid File
STEPS:
1. browser_navigate to http://localhost:56400
2. Attempt to upload invalid file (not audio)
3. browser_snapshot to check error state
EXPECTED: Error message displayed, app remains functional

## Test 10: Full Workflow
STEPS:
1. browser_navigate to http://localhost:56400
2. Upload test-fixtures/full-test.mp3
3. Wait for all analysis to complete
4. browser_snapshot full page
5. Click through each verification stage
6. Export MIDI
7. Final browser_snapshot
EXPECTED: Complete workflow from upload to export succeeds
EOF
}

# Generate E2E test report
generate_e2e_report() {
    local test_name="$1"
    local status="$2"
    local screenshot="$3"
    local details="$4"

    cat >> "$E2E_LOG" << EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
E2E Test: $test_name
Status: $status
Screenshot: $screenshot
Details: $details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EOF
}

# Main
main() {
    echo ""
    echo -e "${PURPLE}========================================${NC}"
    echo -e "${PURPLE}  Ralph E2E - Browser Testing Suite${NC}"
    echo -e "${PURPLE}========================================${NC}"
    echo ""

    log "E2E Test Run: $RUN_ID"
    log "Log file: $E2E_LOG"
    echo ""

    case "${1:-run}" in
        run)
            # Ensure prerequisites
            ensure_fixtures

            if ! ensure_services; then
                log "${RED}Cannot run E2E tests - services not available${NC}"
                exit 1
            fi

            echo ""
            log "${BLUE}E2E Tests Ready${NC}"
            log ""
            log "To run E2E tests, use Playwright MCP tools with Claude:"
            log ""
            log "  1. browser_navigate to http://localhost:56400"
            log "  2. browser_snapshot to capture state"
            log "  3. browser_click to interact with elements"
            log "  4. browser_type to enter text"
            log ""
            log "Test fixtures available in: $FIXTURES_DIR"
            ls -la "$FIXTURES_DIR"/*.mp3 2>/dev/null | head -5
            log ""
            log "Screenshots will be saved to: $SCREENSHOTS_DIR"
            ;;

        scenarios)
            # Output test scenarios for Claude to execute
            define_e2e_tests
            ;;

        check)
            # Just check services
            if check_services; then
                log "${GREEN}All services running - ready for E2E tests${NC}"
                exit 0
            else
                log "${RED}Some services not running${NC}"
                exit 1
            fi
            ;;

        fixtures)
            # Generate/regenerate test fixtures
            "$SCRIPTS_DIR/generate-test-fixtures.sh"
            ;;

        help|*)
            echo "Ralph E2E - Browser-based End-to-End Testing"
            echo ""
            echo "Usage: $0 [command]"
            echo ""
            echo "Commands:"
            echo "  run        Check services and prepare for E2E tests (default)"
            echo "  scenarios  Output test scenarios for Claude/Playwright"
            echo "  check      Check if services are ready"
            echo "  fixtures   Generate test audio fixtures"
            echo ""
            echo "This script prepares the environment for E2E testing."
            echo "Actual browser tests are executed via Playwright MCP tools."
            echo ""
            echo "Example workflow:"
            echo "  1. ./ralph-e2e.sh run          # Prepare environment"
            echo "  2. Use Playwright MCP tools to run browser tests"
            echo "  3. Review screenshots in logs/screenshots/"
            ;;
    esac
}

main "$@"
