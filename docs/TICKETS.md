# Issue Tickets

Track bugs, feature requests, and improvements.

> **Integrated System:** Tickets are now managed through the in-app Issue Tracker (click "Issues" in the header). This file is kept for reference, but the database at `data/tickets.json` is the source of truth.

---

## Ticket System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    TICKET SYSTEM                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   React UI   │◄──►│  Express API │◄──►│  tickets.json│      │
│  │ TicketManager│    │  Port 56404  │    │  (Database)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         │                   │                   │               │
│         ▼                   ▼                   ▼               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                SHELL SCRIPTS                          │      │
│  │  backup-tickets.sh  verify-tickets.sh  ralph-*.sh    │      │
│  └──────────────────────────────────────────────────────┘      │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────┐      │
│  │                   BACKUPS                             │      │
│  │  backups/tickets_YYYYMMDD.json                       │      │
│  │  backups/tickets_YYYYMMDD.csv                        │      │
│  │  backups/tickets_latest.json (symlink)               │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflows

### Issue Lifecycle Workflow

```
┌─────────┐   User/Ralph Loop   ┌─────────────┐   Developer    ┌─────────────┐
│  OPEN   │ ─────────────────►  │ IN_PROGRESS │ ────────────►  │   REVIEW    │
└─────────┘                     └─────────────┘                └─────────────┘
     │                                                               │
     │ Won't Fix                                          Tests Pass │
     ▼                                                               ▼
┌─────────┐                                                ┌─────────────┐
│ WONTFIX │                                                │  RESOLVED   │
└─────────┘                                                └─────────────┘
```

### Ralph Loop Integration

```
┌─────────────────────────────────────────────────────────────────┐
│                      RALPH LOOP                                  │
│                                                                 │
│  ┌──────────┐     ┌───────────────┐     ┌──────────────┐       │
│  │Run Tests │ ──► │ Tests Fail?   │ ──► │Create Ticket │       │
│  └──────────┘     └───────────────┘     │ (ralph-ticket)│      │
│                          │ No           └──────────────┘       │
│                          ▼                     │                │
│                   ┌──────────┐                 ▼                │
│                   │   EXIT   │          ┌──────────────┐       │
│                   │  SUCCESS │          │Status: IN_PROG│       │
│                   └──────────┘          └──────────────┘       │
│                          ▲                     │                │
│                          │                     ▼                │
│                   ┌──────────────┐      ┌──────────────┐       │
│                   │ All Pass?    │ ◄─── │ Claude Fix   │       │
│                   └──────────────┘      └──────────────┘       │
│                          │ No                  │                │
│                          ▼                     │                │
│                   ┌──────────────┐             │                │
│                   │ Add Note     │ ────────────┘                │
│                   │ Iterate      │                              │
│                   └──────────────┘                              │
│                                                                 │
│  On Success: Ticket RESOLVED with fix details                  │
│  On Max Iterations: Ticket status → REVIEW                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Commands

### UI Access
- Click **"Issues"** button in header
- Badge shows open ticket count
- Full CRUD operations in modal

### Shell Scripts

```bash
# Backup
./scripts/backup-tickets.sh              # Create timestamped backup

# Restore
./scripts/restore-tickets.sh --list      # List available backups
./scripts/restore-tickets.sh --latest    # Restore latest backup
./scripts/restore-tickets.sh FILE        # Restore specific backup
./scripts/restore-tickets.sh --csv FILE  # Restore from CSV

# Verify
./scripts/verify-tickets.sh              # Check database integrity

# Ralph Loop Ticket CLI
./scripts/ralph-ticket.sh create "Title" "Description" "Component" "Priority"
./scripts/ralph-ticket.sh status TICKET-001 IN_PROGRESS
./scripts/ralph-ticket.sh note TICKET-001 "Progress update"
./scripts/ralph-ticket.sh resolve TICKET-001 "Root cause" "Resolution"
./scripts/ralph-ticket.sh get-open       # List open tickets
./scripts/ralph-ticket.sh summary        # Show stats

# Full Ralph Loop
./scripts/ralph-loop.sh                  # Start autonomous test fixer
./scripts/ralph-loop.sh stop             # Signal stop
./scripts/ralph-loop.sh status           # Show ticket summary
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List all tickets (with filters) |
| GET | `/api/tickets/stats/summary` | Get ticket statistics |
| GET | `/api/tickets/:id` | Get single ticket |
| POST | `/api/tickets` | Create new ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |
| POST | `/api/tickets/:id/notes` | Add note to ticket |

---

## Open Tickets

### TICKET-001: [OPEN] Chord Detection Accuracy with Complex Arrangements
**Priority:** Medium
**Component:** Chord Detection
**Created:** 2026-01-23
**Assigned:** Unassigned

**Description:**
Advanced chord detection may struggle with complex arrangements that have multiple overlapping instruments in similar frequency ranges.

**Steps to Reproduce:**
1. Load a track with dense orchestration
2. Enable Advanced mode
3. Observe detection accuracy

**Expected:** Accurate chord detection
**Actual:** May show incorrect chords or low confidence

**Notes:**
- Consider adding instrument separation preprocessing
- May need stem separation for best results

---

### TICKET-002: [OPEN] Grid Quantization Options
**Priority:** Low
**Component:** Chord Grid
**Created:** 2026-01-23
**Assigned:** Unassigned

**Description:**
Add more quantization options for chord grid alignment (1/4, 1/8, 1/16 note resolution).

**Acceptance Criteria:**
- [ ] Dropdown to select quantization resolution
- [ ] Chords snap to selected grid division
- [ ] Visual grid lines match resolution

---

## Resolved Tickets

### TICKET-R001: [RESOLVED] Grid Playhead 2-Bar Delay
**Priority:** High
**Component:** Chord Grid
**Created:** 2026-01-23
**Resolved:** 2026-01-23

**Description:**
Playhead line appears 2 bars late compared to actual audio position.

**Root Cause:**
Chord timestamps used `Date.now()` (wall clock) but grid used `currentTimeMs` (playback position). Different time bases caused offset.

**Resolution:**
Changed `processFullMix` to accept `playbackTimeMs` parameter and use it for chord timestamps.

**Related:** INCIDENT-002

---

### TICKET-R002: [RESOLVED] Settings Reset on Re-analyze
**Priority:** High
**Component:** Rhythm Verification
**Created:** 2026-01-23
**Resolved:** 2026-01-23

**Description:**
Energy Threshold, Min Hit Interval, and Genre Preset reset to defaults after clicking Re-analyze.

**Root Cause:**
Local state not synced with props after re-render. Used `defaultValue` instead of controlled `value`.

**Resolution:**
Added `useEffect` to preserve user values, changed to controlled components, pass settings to callback.

**Related:** INCIDENT-003

---

### TICKET-R003: [RESOLVED] Full Mix Chord Detection Not Working
**Priority:** Critical
**Component:** Advanced Chord Detection
**Created:** 2026-01-23
**Resolved:** 2026-01-23

**Description:**
Nothing detected when using Advanced mode with full mix (no stems).

**Root Cause:**
- Sparse band extraction lost frequency resolution
- Sample rate mismatch
- Band separation too narrow

**Resolution:**
Rewrote `processFullMix` with overlapping frequency bands and proper sample rate sync.

**Related:** INCIDENT-001

---

## How to Create a Ticket

Copy this template:

```markdown
### TICKET-XXX: [STATUS] Title
**Priority:** Critical/High/Medium/Low
**Component:** Component Name
**Created:** YYYY-MM-DD
**Assigned:** Name or Unassigned

**Description:**
Clear description of the issue or feature request.

**Steps to Reproduce:** (for bugs)
1. Step one
2. Step two

**Expected:** What should happen
**Actual:** What actually happens

**Acceptance Criteria:** (for features)
- [ ] Criteria 1
- [ ] Criteria 2

**Notes:**
Additional context or technical details.

**Related:** INCIDENT-XXX or TICKET-XXX
```

## Status Definitions

| Status | Meaning |
|--------|---------|
| OPEN | New ticket, not started |
| IN PROGRESS | Currently being worked on |
| REVIEW | Fix implemented, needs testing |
| RESOLVED | Fixed and verified |
| WONTFIX | Decided not to fix |
| DUPLICATE | Same as another ticket |

## Priority Definitions

| Priority | Response Time | Description |
|----------|--------------|-------------|
| Critical | Immediate | App broken, data loss, security issue |
| High | Same day | Major feature broken, blocking users |
| Medium | This week | Feature degraded, workaround exists |
| Low | Backlog | Nice to have, minor improvement |

## Component List

- Chord Detection
- Rhythm Detection
- Grid/Timeline
- Audio Analysis
- Stem Separation
- MIDI Export
- UI/UX
- Performance
- API/Backend
