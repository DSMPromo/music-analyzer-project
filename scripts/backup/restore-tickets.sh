#!/bin/bash
# =============================================================================
# Ticket Database Restore Script
# Restores ticket database from JSON or CSV backup
# =============================================================================

set -e

# Configuration
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$PROJECT_DIR/data"
BACKUP_DIR="$PROJECT_DIR/backups"
TICKETS_JSON="$DATA_DIR/tickets.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 [OPTIONS] [BACKUP_FILE]"
    echo ""
    echo "Options:"
    echo "  -l, --list     List available backups"
    echo "  -L, --latest   Restore from latest backup"
    echo "  -c, --csv      Restore from CSV file (converts to JSON)"
    echo "  -h, --help     Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 --list                           # List all backups"
    echo "  $0 --latest                         # Restore latest backup"
    echo "  $0 backups/tickets_20260124.json    # Restore specific JSON"
    echo "  $0 --csv backups/tickets.csv        # Restore from CSV"
    exit 1
}

list_backups() {
    echo "=========================================="
    echo "  Available Backups"
    echo "=========================================="
    echo ""
    echo "JSON Backups:"
    ls -lh "$BACKUP_DIR"/tickets_*.json 2>/dev/null | awk '{print "  " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}' || echo "  No JSON backups found"
    echo ""
    echo "CSV Backups:"
    ls -lh "$BACKUP_DIR"/tickets_*.csv 2>/dev/null | awk '{print "  " $9 " (" $5 ", " $6 " " $7 " " $8 ")"}' || echo "  No CSV backups found"
    echo ""
}

restore_from_json() {
    local backup_file="$1"

    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}ERROR: Backup file not found: $backup_file${NC}"
        exit 1
    fi

    # Validate JSON
    if ! node -e "JSON.parse(require('fs').readFileSync('$backup_file'))" 2>/dev/null; then
        echo -e "${RED}ERROR: Invalid JSON file: $backup_file${NC}"
        exit 1
    fi

    # Create backup of current state
    if [ -f "$TICKETS_JSON" ]; then
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        cp "$TICKETS_JSON" "$BACKUP_DIR/tickets_pre_restore_${TIMESTAMP}.json"
        echo -e "${YELLOW}⚠${NC} Current database backed up before restore"
    fi

    # Restore
    cp "$backup_file" "$TICKETS_JSON"
    echo -e "${GREEN}✓${NC} Database restored from: $backup_file"

    # Show stats
    TICKET_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.length)")
    echo "  Tickets restored: $TICKET_COUNT"
}

restore_from_csv() {
    local csv_file="$1"

    if [ ! -f "$csv_file" ]; then
        echo -e "${RED}ERROR: CSV file not found: $csv_file${NC}"
        exit 1
    fi

    # Create backup of current state
    if [ -f "$TICKETS_JSON" ]; then
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        cp "$TICKETS_JSON" "$BACKUP_DIR/tickets_pre_restore_${TIMESTAMP}.json"
        echo -e "${YELLOW}⚠${NC} Current database backed up before restore"
    fi

    # Convert CSV to JSON
    node -e "
const fs = require('fs');
const csv = fs.readFileSync('$csv_file', 'utf8');
const lines = csv.split('\n').filter(l => l.trim());
const headers = lines[0].split(',');

// Parse CSV with proper escaping
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '\"') {
            if (inQuotes && line[i + 1] === '\"') {
                current += '\"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

const tickets = [];
let maxId = 0;

for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const ticket = {
        id: values[0],
        title: values[1],
        description: values[2],
        priority: values[3],
        component: values[4],
        status: values[5],
        created: values[6],
        updated: values[7],
        resolved: values[8] || null,
        steps: values[9] || null,
        expected: values[10] || null,
        actual: values[11] || null,
        rootCause: values[12] || null,
        resolution: values[13] || null,
        notes: [],
        relatedIncidents: values[15] ? values[15].split(';').filter(Boolean) : []
    };

    // Extract ID number for nextId
    const idMatch = ticket.id.match(/TICKET-(\d+)/);
    if (idMatch) {
        maxId = Math.max(maxId, parseInt(idMatch[1]));
    }

    tickets.push(ticket);
}

const data = { tickets, nextId: maxId + 1 };
fs.writeFileSync('$TICKETS_JSON', JSON.stringify(data, null, 2));
console.log('Converted ' + tickets.length + ' tickets from CSV');
"

    echo -e "${GREEN}✓${NC} Database restored from CSV: $csv_file"

    # Show stats
    TICKET_COUNT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$TICKETS_JSON')).tickets.length)")
    echo "  Tickets restored: $TICKET_COUNT"
}

# Parse arguments
if [ $# -eq 0 ]; then
    usage
fi

case "$1" in
    -l|--list)
        list_backups
        ;;
    -L|--latest)
        if [ -f "$BACKUP_DIR/tickets_latest.json" ]; then
            restore_from_json "$BACKUP_DIR/tickets_latest.json"
        else
            echo -e "${RED}ERROR: No latest backup found${NC}"
            exit 1
        fi
        ;;
    -c|--csv)
        if [ -z "$2" ]; then
            echo -e "${RED}ERROR: CSV file path required${NC}"
            usage
        fi
        restore_from_csv "$2"
        ;;
    -h|--help)
        usage
        ;;
    *)
        if [[ "$1" == *.csv ]]; then
            restore_from_csv "$1"
        else
            restore_from_json "$1"
        fi
        ;;
esac

echo ""
echo -e "${GREEN}Restore completed successfully!${NC}"
