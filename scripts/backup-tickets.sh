#!/bin/bash
# =============================================================================
# Ticket Database Backup Script
# Creates JSON and CSV backups of the ticket database
# =============================================================================

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
TICKETS_JSON="$DATA_DIR/tickets.json"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=========================================="
echo "  Ticket Database Backup"
echo "=========================================="
echo ""

# Create backup directory if not exists
mkdir -p "$BACKUP_DIR"

# Check if tickets.json exists
if [ ! -f "$TICKETS_JSON" ]; then
    echo -e "${RED}ERROR: tickets.json not found at $TICKETS_JSON${NC}"
    exit 1
fi

# Create JSON backup
JSON_BACKUP="$BACKUP_DIR/tickets_${TIMESTAMP}.json"
cp "$TICKETS_JSON" "$JSON_BACKUP"
echo -e "${GREEN}✓${NC} JSON backup created: $JSON_BACKUP"

# Create CSV backup using Node.js
CSV_BACKUP="$BACKUP_DIR/tickets_${TIMESTAMP}.csv"
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('$TICKETS_JSON', 'utf8'));

// CSV Header
const headers = [
    'id', 'title', 'description', 'priority', 'component', 'status',
    'created', 'updated', 'resolved', 'steps', 'expected', 'actual',
    'rootCause', 'resolution', 'notes_count', 'related_incidents'
];

// Escape CSV field
const escapeCSV = (field) => {
    if (field === null || field === undefined) return '';
    const str = String(field);
    if (str.includes(',') || str.includes('\"') || str.includes('\n')) {
        return '\"' + str.replace(/\"/g, '\"\"') + '\"';
    }
    return str;
};

// Generate CSV rows
const rows = data.tickets.map(t => [
    t.id,
    t.title,
    t.description,
    t.priority,
    t.component,
    t.status,
    t.created,
    t.updated,
    t.resolved || '',
    t.steps || '',
    t.expected || '',
    t.actual || '',
    t.rootCause || '',
    t.resolution || '',
    (t.notes || []).length,
    (t.relatedIncidents || []).join(';')
].map(escapeCSV).join(','));

// Write CSV
const csv = [headers.join(','), ...rows].join('\n');
fs.writeFileSync('$CSV_BACKUP', csv);
console.log('CSV generated with ' + data.tickets.length + ' tickets');
"
echo -e "${GREEN}✓${NC} CSV backup created: $CSV_BACKUP"

# Create latest symlinks
ln -sf "$JSON_BACKUP" "$BACKUP_DIR/tickets_latest.json"
ln -sf "$CSV_BACKUP" "$BACKUP_DIR/tickets_latest.csv"
echo -e "${GREEN}✓${NC} Latest symlinks updated"

# Show backup stats
TICKET_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.length)")
OPEN_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.filter(t=>t.status==='OPEN').length)")
RESOLVED_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.filter(t=>t.status==='RESOLVED').length)")

echo ""
echo "=========================================="
echo "  Backup Summary"
echo "=========================================="
echo "  Total Tickets: $TICKET_COUNT"
echo "  Open: $OPEN_COUNT"
echo "  Resolved: $RESOLVED_COUNT"
echo "  JSON Size: $(du -h "$JSON_BACKUP" | cut -f1)"
echo "  CSV Size: $(du -h "$CSV_BACKUP" | cut -f1)"
echo "=========================================="

# Cleanup old backups (keep last 10)
echo ""
echo "Cleaning up old backups (keeping last 10)..."
cd "$BACKUP_DIR"
ls -t tickets_*.json 2>/dev/null | tail -n +11 | xargs -r rm -f
ls -t tickets_*.csv 2>/dev/null | tail -n +11 | xargs -r rm -f
echo -e "${GREEN}✓${NC} Cleanup complete"

echo ""
echo -e "${GREEN}Backup completed successfully!${NC}"
