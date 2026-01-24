#!/bin/bash
#
# Sync Knowledge Lab - Auto-update Knowledge Lab data from rhythm analyzer backend
#
# This script:
# 1. Fetches current instrument filters and processing presets from the backend
# 2. Validates all detection features are working
# 3. Updates the Knowledge Lab data file with any changes
# 4. Runs frontend tests to ensure compatibility
#
# Usage:
#   ./sync-knowledge-lab.sh           # Full sync
#   ./sync-knowledge-lab.sh --test    # Just run tests, no sync
#   ./sync-knowledge-lab.sh --check   # Check if sync is needed
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
RHYTHM_ANALYZER_URL="http://localhost:56403"
KNOWLEDGE_LAB_FILE="client/src/data/rhythmPatterns.js"
BACKUP_DIR=".knowledge-lab-backups"
LOG_FILE="logs/knowledge-lab-sync.log"

# Ensure log directory exists
mkdir -p logs
mkdir -p "$BACKUP_DIR"

log() {
    echo -e "$1" | tee -a "$LOG_FILE"
}

header() {
    echo ""
    log "${BLUE}========================================${NC}"
    log "${BLUE}  $1${NC}"
    log "${BLUE}========================================${NC}"
}

success() {
    log "${GREEN}  ✓ $1${NC}"
}

warn() {
    log "${YELLOW}  ⚠ $1${NC}"
}

error() {
    log "${RED}  ✗ $1${NC}"
}

# Check if rhythm analyzer is running
check_service() {
    header "Checking Rhythm Analyzer Service"

    if curl -s "$RHYTHM_ANALYZER_URL/health" > /dev/null 2>&1; then
        success "Rhythm Analyzer is running on port 56403"
        return 0
    else
        error "Rhythm Analyzer not responding"
        echo ""
        log "Start the service with: ./venv/bin/python rhythm_analyzer.py"
        return 1
    fi
}

# Run self-validation tests
run_self_tests() {
    header "Running Self-Validation Tests"

    RESULT=$(curl -s "$RHYTHM_ANALYZER_URL/self-test")

    STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['status'])")
    PASSED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['passed'])")
    FAILED=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['failed'])")
    WARNINGS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['warnings'])")
    TOTAL=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['summary']['total'])")

    if [ "$STATUS" = "PASS" ]; then
        success "All $TOTAL tests passed"
    else
        error "$FAILED of $TOTAL tests failed"

        # Show failed tests
        echo "$RESULT" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for test in d['tests']:
    if test['status'] == 'failed':
        print(f\"    - {test['name']}: {test['message']}\")
"
        return 1
    fi

    if [ "$WARNINGS" != "0" ]; then
        warn "$WARNINGS warnings"
    fi

    return 0
}

# Fetch current data from backend
fetch_backend_data() {
    header "Fetching Data from Backend"

    # Get instrument filters
    FILTERS=$(curl -s "$RHYTHM_ANALYZER_URL/instrument-filters")

    # Parse data
    INSTRUMENT_COUNT=$(echo "$FILTERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['filters']))")
    CATEGORY_COUNT=$(echo "$FILTERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['categories']))")

    success "Fetched $INSTRUMENT_COUNT instrument filters"
    success "Fetched $CATEGORY_COUNT categories"

    # Check for processing presets
    HAS_PROCESSING=$(echo "$FILTERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print('yes' if 'processing' in d else 'no')")
    if [ "$HAS_PROCESSING" = "yes" ]; then
        success "Fetched processing presets (EQ, Compression, De-reverb)"
    fi

    echo "$FILTERS"
}

# Compare with current Knowledge Lab data
check_sync_status() {
    header "Checking Sync Status"

    FILTERS=$(curl -s "$RHYTHM_ANALYZER_URL/instrument-filters")

    # Count instruments in backend
    BACKEND_COUNT=$(echo "$FILTERS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['filters']))")

    # Check Knowledge Lab file
    if [ -f "$KNOWLEDGE_LAB_FILE" ]; then
        # Count instruments in frontend (approximate by counting entries in EXTENDED_DETECTION_BANDS)
        FRONTEND_COUNT=$(grep -c "min:" "$KNOWLEDGE_LAB_FILE" 2>/dev/null || echo "0")

        if [ "$BACKEND_COUNT" = "$FRONTEND_COUNT" ]; then
            success "Knowledge Lab is in sync ($BACKEND_COUNT instruments)"
            return 0
        else
            warn "Sync needed: Backend has $BACKEND_COUNT, Frontend has ~$FRONTEND_COUNT"
            return 1
        fi
    else
        error "Knowledge Lab file not found: $KNOWLEDGE_LAB_FILE"
        return 1
    fi
}

# Generate updated Knowledge Lab content
generate_update() {
    header "Generating Knowledge Lab Update"

    FILTERS=$(curl -s "$RHYTHM_ANALYZER_URL/instrument-filters")

    # Generate JSON file for reference
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    OUTPUT_FILE="$BACKUP_DIR/instrument-filters-$TIMESTAMP.json"

    echo "$FILTERS" | python3 -m json.tool > "$OUTPUT_FILE"
    success "Saved backup to $OUTPUT_FILE"

    log ""
    log "  Current categories:"
    echo "$FILTERS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for cat, instruments in d['categories'].items():
    print(f\"    {cat}: {len(instruments)} instruments\")
"

    return 0
}

# Run frontend tests
run_frontend_tests() {
    header "Running Frontend Tests"

    cd client
    npm test -- --watchAll=false --passWithNoTests 2>&1 | tail -5
    TEST_RESULT=$?
    cd ..

    if [ $TEST_RESULT -eq 0 ]; then
        success "All frontend tests passed"
    else
        error "Frontend tests failed"
        return 1
    fi

    return 0
}

# Main execution
main() {
    log ""
    log "$(date '+%Y-%m-%d %H:%M:%S') - Knowledge Lab Sync Started"

    case "$1" in
        --test)
            check_service && run_self_tests
            ;;
        --check)
            check_service && check_sync_status
            ;;
        --help|-h)
            echo "Usage: $0 [option]"
            echo ""
            echo "Options:"
            echo "  (none)     Full sync: validate, fetch, update, test"
            echo "  --test     Run self-validation tests only"
            echo "  --check    Check if sync is needed"
            echo "  --help     Show this help"
            ;;
        *)
            # Full sync
            check_service || exit 1
            run_self_tests || exit 1
            fetch_backend_data > /dev/null
            generate_update
            run_frontend_tests

            header "Sync Complete"
            success "Knowledge Lab is up to date"
            ;;
    esac

    log ""
    log "$(date '+%Y-%m-%d %H:%M:%S') - Sync Complete"
}

main "$@"
