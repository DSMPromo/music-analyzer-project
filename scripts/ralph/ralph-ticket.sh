#!/bin/bash
# =============================================================================
# Ralph Loop Ticket Integration
# Automatically creates, updates, and resolves tickets during Ralph Loop runs
# =============================================================================

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="http://localhost:56404/api"
LOG_FILE="$PROJECT_DIR/logs/ralph-tickets.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$PROJECT_DIR/logs"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo -e "$1"
}

# Check if API is available
check_api() {
    if ! curl -s "$API_URL/health" | grep -q "ok"; then
        log "${RED}ERROR: Ticket API not available${NC}"
        return 1
    fi
    return 0
}

# Create ticket from test failure
# Usage: ralph-ticket.sh create "Title" "Description" "Component" "Priority"
create_ticket() {
    local title="$1"
    local description="$2"
    local component="${3:-General}"
    local priority="${4:-High}"

    check_api || return 1

    local response=$(curl -s -X POST "$API_URL/tickets" \
        -H "Content-Type: application/json" \
        -d "{
            \"title\": \"$title\",
            \"description\": \"$description\",
            \"component\": \"$component\",
            \"priority\": \"$priority\",
            \"steps\": \"Auto-detected by Ralph Loop\",
            \"expected\": \"Tests should pass\",
            \"actual\": \"Tests failing\"
        }")

    local ticket_id=$(echo "$response" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{ try{console.log(JSON.parse(d).id)}catch(e){console.log('')} });
    ")

    if [ -n "$ticket_id" ]; then
        log "${GREEN}✓ Created ticket: $ticket_id${NC}"
        echo "$ticket_id"
    else
        log "${RED}✗ Failed to create ticket${NC}"
        return 1
    fi
}

# Update ticket status
# Usage: ralph-ticket.sh status TICKET-001 IN_PROGRESS
update_status() {
    local ticket_id="$1"
    local status="$2"

    check_api || return 1

    curl -s -X PUT "$API_URL/tickets/$ticket_id" \
        -H "Content-Type: application/json" \
        -d "{\"status\": \"$status\"}" > /dev/null

    log "${BLUE}→ Updated $ticket_id status to $status${NC}"
}

# Add note to ticket
# Usage: ralph-ticket.sh note TICKET-001 "Note text"
add_note() {
    local ticket_id="$1"
    local note="$2"

    check_api || return 1

    curl -s -X POST "$API_URL/tickets/$ticket_id/notes" \
        -H "Content-Type: application/json" \
        -d "{\"note\": \"$note\"}" > /dev/null

    log "${BLUE}→ Added note to $ticket_id${NC}"
}

# Resolve ticket with fix details
# Usage: ralph-ticket.sh resolve TICKET-001 "Root cause" "Resolution"
resolve_ticket() {
    local ticket_id="$1"
    local root_cause="$2"
    local resolution="$3"

    check_api || return 1

    curl -s -X PUT "$API_URL/tickets/$ticket_id" \
        -H "Content-Type: application/json" \
        -d "{
            \"status\": \"RESOLVED\",
            \"rootCause\": \"$root_cause\",
            \"resolution\": \"$resolution\"
        }" > /dev/null

    log "${GREEN}✓ Resolved $ticket_id${NC}"
}

# Parse test output and create tickets for failures
# Usage: ralph-ticket.sh parse-failures < test_output.txt
parse_failures() {
    local test_output=$(cat)
    local failures=()

    # Extract failing test names (Jest format)
    while IFS= read -r line; do
        if [[ "$line" =~ FAIL.*\.test\.(js|ts) ]]; then
            local file=$(echo "$line" | grep -oE '[^ ]+\.test\.(js|ts)')
            failures+=("$file")
        fi
    done <<< "$test_output"

    # Create tickets for each failure
    for failure in "${failures[@]}"; do
        local title="Test Failure: $failure"
        local component="General"

        # Detect component from file path
        if [[ "$failure" == *"Chord"* ]]; then
            component="Chord Detection"
        elif [[ "$failure" == *"Rhythm"* ]] || [[ "$failure" == *"Drum"* ]]; then
            component="Rhythm Detection"
        elif [[ "$failure" == *"Grid"* ]]; then
            component="Grid/Timeline"
        elif [[ "$failure" == *"Audio"* ]]; then
            component="Audio Analysis"
        elif [[ "$failure" == *"MIDI"* ]]; then
            component="MIDI Export"
        fi

        # Extract error message
        local error_msg=$(echo "$test_output" | grep -A 5 "$failure" | grep -E "Error|expect|received" | head -3 | tr '\n' ' ')

        create_ticket "$title" "Test failure detected by Ralph Loop.\n\nError: $error_msg" "$component" "High"
    done
}

# Run Ralph Loop iteration with ticket tracking
# Usage: ralph-ticket.sh run-iteration TICKET-001
run_iteration() {
    local ticket_id="$1"
    local iteration="${2:-1}"

    log "${BLUE}[Ralph Loop Iteration $iteration] Working on $ticket_id${NC}"

    # Update status to in progress
    update_status "$ticket_id" "IN_PROGRESS"
    add_note "$ticket_id" "[Iteration $iteration] Ralph Loop started working on this issue"

    # Run tests and capture output
    local test_output
    local test_exit_code

    cd "$PROJECT_DIR/client"
    test_output=$(npm test -- --watchAll=false --passWithNoTests 2>&1) || test_exit_code=$?

    if [ -z "$test_exit_code" ] || [ "$test_exit_code" -eq 0 ]; then
        # Tests passed!
        add_note "$ticket_id" "[Iteration $iteration] All tests passing! Validating fix..."

        # Run verification
        cd "$PROJECT_DIR"
        if ./scripts/verify-tickets.sh > /dev/null 2>&1; then
            resolve_ticket "$ticket_id" \
                "Issue identified and fixed by Ralph Loop in iteration $iteration" \
                "Fix applied and validated. All tests passing."
            log "${GREEN}✓ $ticket_id resolved successfully!${NC}"
            return 0
        fi
    else
        # Tests still failing
        local error_summary=$(echo "$test_output" | grep -E "FAIL|Error|expect" | head -5 | tr '\n' ' ')
        add_note "$ticket_id" "[Iteration $iteration] Tests still failing: $error_summary"
        log "${YELLOW}⚠ Tests still failing, continuing...${NC}"
        return 1
    fi
}

# Get open tickets for Ralph Loop
# Usage: ralph-ticket.sh get-open
get_open_tickets() {
    check_api || return 1

    curl -s "$API_URL/tickets?status=OPEN" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
            try {
                const data = JSON.parse(d);
                data.tickets.forEach(t => {
                    console.log(t.id + '|' + t.priority + '|' + t.component + '|' + t.title);
                });
            } catch(e) {}
        });
    "
}

# Generate summary report
# Usage: ralph-ticket.sh summary
generate_summary() {
    check_api || return 1

    local stats=$(curl -s "$API_URL/tickets/stats/summary")

    echo "=========================================="
    echo "  Ralph Loop Ticket Summary"
    echo "=========================================="
    echo ""
    echo "$stats" | node -e "
        let d=''; process.stdin.on('data',c=>d+=c);
        process.stdin.on('end',()=>{
            const s = JSON.parse(d);
            console.log('  Total Tickets:    ' + s.total);
            console.log('  Open:             ' + s.open);
            console.log('  In Progress:      ' + s.inProgress);
            console.log('  Resolved:         ' + s.resolved);
            console.log('');
            console.log('  Critical (open):  ' + s.byPriority.Critical);
            console.log('  High (open):      ' + s.byPriority.High);
        });
    "
    echo "=========================================="
}

# Main command dispatcher
case "${1:-help}" in
    create)
        create_ticket "$2" "$3" "$4" "$5"
        ;;
    status)
        update_status "$2" "$3"
        ;;
    note)
        add_note "$2" "$3"
        ;;
    resolve)
        resolve_ticket "$2" "$3" "$4"
        ;;
    parse-failures)
        parse_failures
        ;;
    run-iteration)
        run_iteration "$2" "$3"
        ;;
    get-open)
        get_open_tickets
        ;;
    summary)
        generate_summary
        ;;
    help|*)
        echo "Ralph Loop Ticket Integration"
        echo ""
        echo "Usage: $0 <command> [args]"
        echo ""
        echo "Commands:"
        echo "  create <title> <desc> [component] [priority]  Create new ticket"
        echo "  status <ticket-id> <status>                   Update ticket status"
        echo "  note <ticket-id> <note>                       Add note to ticket"
        echo "  resolve <ticket-id> <root-cause> <resolution> Resolve ticket"
        echo "  parse-failures                                Parse test output (stdin)"
        echo "  run-iteration <ticket-id> [iteration]         Run Ralph Loop iteration"
        echo "  get-open                                      List open tickets"
        echo "  summary                                       Show ticket summary"
        echo ""
        echo "Examples:"
        echo "  $0 create 'Test failing' 'ChordDetector test fails' 'Chord Detection' 'High'"
        echo "  $0 status TICKET-006 IN_PROGRESS"
        echo "  $0 note TICKET-006 'Fixed import statement'"
        echo "  $0 resolve TICKET-006 'Missing import' 'Added missing import'"
        echo "  npm test 2>&1 | $0 parse-failures"
        echo "  $0 run-iteration TICKET-006 1"
        ;;
esac
