#!/bin/bash
# =============================================================================
# Ticket Database Verification Script
# Validates database integrity, syncs with CSV, and checks API health
# =============================================================================

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
TICKETS_JSON="$DATA_DIR/tickets.json"
API_URL="http://localhost:56404/api"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "=========================================="
echo "  Ticket Database Verification"
echo "=========================================="
echo ""

# 1. Check if database file exists
echo -e "${BLUE}1. Checking Database File${NC}"
if [ -f "$TICKETS_JSON" ]; then
    echo -e "   ${GREEN}✓${NC} tickets.json exists"
else
    echo -e "   ${RED}✗${NC} tickets.json not found!"
    ERRORS=$((ERRORS + 1))
fi

# 2. Validate JSON structure
echo -e "${BLUE}2. Validating JSON Structure${NC}"
if node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$TICKETS_JSON'));

// Check required fields
if (!Array.isArray(data.tickets)) throw new Error('tickets array missing');
if (typeof data.nextId !== 'number') throw new Error('nextId missing');

// Validate each ticket
const requiredFields = ['id', 'title', 'status', 'priority', 'component', 'created'];
data.tickets.forEach((t, i) => {
    requiredFields.forEach(f => {
        if (!t[f]) throw new Error('Ticket ' + i + ' missing field: ' + f);
    });
});

console.log('Valid: ' + data.tickets.length + ' tickets');
" 2>/dev/null; then
    echo -e "   ${GREEN}✓${NC} JSON structure valid"
else
    echo -e "   ${RED}✗${NC} Invalid JSON structure!"
    ERRORS=$((ERRORS + 1))
fi

# 3. Check for data integrity issues
echo -e "${BLUE}3. Checking Data Integrity${NC}"
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$TICKETS_JSON'));

let issues = 0;

// Check for duplicate IDs
const ids = data.tickets.map(t => t.id);
const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i);
if (duplicates.length > 0) {
    console.log('   ⚠ Duplicate IDs found: ' + duplicates.join(', '));
    issues++;
}

// Check nextId is correct
const maxIdNum = Math.max(...data.tickets.map(t => {
    const match = t.id.match(/TICKET-(\d+)/);
    return match ? parseInt(match[1]) : 0;
}));
if (data.nextId <= maxIdNum) {
    console.log('   ⚠ nextId (' + data.nextId + ') should be > ' + maxIdNum);
    issues++;
}

// Check status values
const validStatuses = ['OPEN', 'IN_PROGRESS', 'REVIEW', 'RESOLVED', 'WONTFIX'];
data.tickets.forEach(t => {
    if (!validStatuses.includes(t.status)) {
        console.log('   ⚠ Invalid status \"' + t.status + '\" in ' + t.id);
        issues++;
    }
});

// Check priority values
const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
data.tickets.forEach(t => {
    if (!validPriorities.includes(t.priority)) {
        console.log('   ⚠ Invalid priority \"' + t.priority + '\" in ' + t.id);
        issues++;
    }
});

// Check resolved tickets have resolution
data.tickets.filter(t => t.status === 'RESOLVED').forEach(t => {
    if (!t.resolution) {
        console.log('   ⚠ Resolved ticket ' + t.id + ' has no resolution');
        issues++;
    }
});

if (issues === 0) {
    console.log('   ✓ No integrity issues found');
    process.exit(0);
} else {
    process.exit(1);
}
" 2>/dev/null
if [ $? -eq 0 ]; then
    echo -e "   ${GREEN}✓${NC} Data integrity OK"
else
    echo -e "   ${YELLOW}⚠${NC} Data integrity warnings"
    WARNINGS=$((WARNINGS + 1))
fi

# 4. Check API health
echo -e "${BLUE}4. Checking API Health${NC}"
if curl -s "$API_URL/health" | grep -q "ok"; then
    echo -e "   ${GREEN}✓${NC} API server healthy"
else
    echo -e "   ${RED}✗${NC} API server not responding!"
    ERRORS=$((ERRORS + 1))
fi

# 5. Verify API returns same data as file
echo -e "${BLUE}5. Verifying API/File Sync${NC}"
API_COUNT=$(curl -s "$API_URL/tickets" 2>/dev/null | node -e "
let data = '';
process.stdin.on('data', d => data += d);
process.stdin.on('end', () => {
    try {
        console.log(JSON.parse(data).total);
    } catch(e) {
        console.log(0);
    }
});
" 2>/dev/null || echo "0")

FILE_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.length)" 2>/dev/null || echo "0")

if [ "$API_COUNT" = "$FILE_COUNT" ]; then
    echo -e "   ${GREEN}✓${NC} API and file in sync ($FILE_COUNT tickets)"
else
    echo -e "   ${RED}✗${NC} API ($API_COUNT) and file ($FILE_COUNT) out of sync!"
    ERRORS=$((ERRORS + 1))
fi

# 6. Check backup status
echo -e "${BLUE}6. Checking Backup Status${NC}"
if [ -d "$BACKUP_DIR" ]; then
    BACKUP_COUNT=$(ls "$BACKUP_DIR"/tickets_*.json 2>/dev/null | wc -l | tr -d ' ')
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR"/tickets_*.json 2>/dev/null | head -1)

    if [ "$BACKUP_COUNT" -gt 0 ]; then
        echo -e "   ${GREEN}✓${NC} $BACKUP_COUNT backups found"
        if [ -n "$LATEST_BACKUP" ]; then
            BACKUP_AGE=$((($(date +%s) - $(stat -f %m "$LATEST_BACKUP")) / 3600))
            if [ "$BACKUP_AGE" -gt 24 ]; then
                echo -e "   ${YELLOW}⚠${NC} Latest backup is ${BACKUP_AGE}h old"
                WARNINGS=$((WARNINGS + 1))
            else
                echo -e "   ${GREEN}✓${NC} Latest backup is ${BACKUP_AGE}h old"
            fi
        fi
    else
        echo -e "   ${YELLOW}⚠${NC} No backups found"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "   ${YELLOW}⚠${NC} Backup directory doesn't exist"
    WARNINGS=$((WARNINGS + 1))
fi

# 7. Generate stats report
echo ""
echo -e "${BLUE}7. Database Statistics${NC}"
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$TICKETS_JSON'));

const stats = {
    total: data.tickets.length,
    open: data.tickets.filter(t => t.status === 'OPEN').length,
    inProgress: data.tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: data.tickets.filter(t => t.status === 'RESOLVED').length,
    critical: data.tickets.filter(t => t.priority === 'Critical' && t.status !== 'RESOLVED').length,
    high: data.tickets.filter(t => t.priority === 'High' && t.status !== 'RESOLVED').length,
};

console.log('   Total Tickets:    ' + stats.total);
console.log('   Open:             ' + stats.open);
console.log('   In Progress:      ' + stats.inProgress);
console.log('   Resolved:         ' + stats.resolved);
console.log('   Critical (open):  ' + stats.critical);
console.log('   High (open):      ' + stats.high);
"

# Summary
echo ""
echo "=========================================="
echo "  Verification Summary"
echo "=========================================="
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "  ${GREEN}All checks passed!${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "  ${YELLOW}Passed with $WARNINGS warning(s)${NC}"
else
    echo -e "  ${RED}Failed: $ERRORS error(s), $WARNINGS warning(s)${NC}"
fi
echo "=========================================="

exit $ERRORS
