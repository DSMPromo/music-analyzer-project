# Issue Tickets

Track bugs, feature requests, and improvements.

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
