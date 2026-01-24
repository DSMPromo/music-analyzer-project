# Service Incidents Log

> **Related:** See [TICKETS.md](./TICKETS.md) for issue tracking
> **Integrated System:** Tickets are now managed through the in-app Issue Tracker (click "Issues" in the header)

---

## Incident Response Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                   INCIDENT RESPONSE                              │
│                                                                 │
│  1. DETECTION                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  Test Fails  │ OR │ User Report  │ OR │  Ralph Loop  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│         │                   │                   │               │
│         └───────────────────┼───────────────────┘               │
│                             ▼                                   │
│  2. TRIAGE                                                      │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Create Ticket  →  Set Priority  →  Assign Owner    │      │
│  │  (TICKET-XXX)      (Critical/High)   (Developer)     │      │
│  └──────────────────────────────────────────────────────┘      │
│                             │                                   │
│                             ▼                                   │
│  3. INVESTIGATION                                               │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Document Symptoms → Identify Root Cause → Plan Fix │      │
│  └──────────────────────────────────────────────────────┘      │
│                             │                                   │
│                             ▼                                   │
│  4. RESOLUTION                                                  │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Implement Fix → Run Tests → Verify → Document      │      │
│  └──────────────────────────────────────────────────────┘      │
│                             │                                   │
│                             ▼                                   │
│  5. POST-MORTEM                                                 │
│  ┌──────────────────────────────────────────────────────┐      │
│  │  Update INCIDENTS.md → Add Lessons Learned          │      │
│  │  Resolve Ticket → Backup Database                   │      │
│  └──────────────────────────────────────────────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Ticket ↔ Incident Relationship

```
┌─────────────────────┐           ┌─────────────────────┐
│      TICKET         │           │     INCIDENT        │
│  (Work Tracking)    │ ◄──────►  │  (Documentation)    │
├─────────────────────┤           ├─────────────────────┤
│ • Status            │           │ • Symptoms          │
│ • Priority          │           │ • Root Cause        │
│ • Assignment        │           │ • Resolution Steps  │
│ • Notes/Updates     │           │ • Files Changed     │
│ • Component         │           │ • Lessons Learned   │
└─────────────────────┘           └─────────────────────┘
        │                                   │
        │     ┌─────────────────────┐       │
        └────►│  Related: TICKET-X  │◄──────┘
              │  Related: INCIDENT-Y│
              └─────────────────────┘
```

---

## Commands for Incident Handling

```bash
# Create ticket for new incident
./scripts/ralph-ticket.sh create "[Incident] Title" "Symptoms..." "Component" "Critical"

# Track progress
./scripts/ralph-ticket.sh status TICKET-XXX IN_PROGRESS
./scripts/ralph-ticket.sh note TICKET-XXX "Found root cause: ..."

# Resolve after fix
./scripts/ralph-ticket.sh resolve TICKET-XXX "Root cause description" "Fix applied"

# Verify system health
./scripts/verify-tickets.sh

# Backup after resolution
./scripts/backup-tickets.sh
```

---

## 2026-01-23: Chord Detection & Rhythm Settings Issues

### Incident #001: Advanced Chord Detection Not Working in Full Mix Mode

**Status:** RESOLVED

**Symptoms:**
- Nothing detected when using Advanced mode with full mix (no stems)
- Vocals interfering with chord detection
- Low confidence scores

**Root Cause:**
- `processFullMix` method used sparse band extraction that lost frequency resolution
- Sample rate mismatch between detector (44100Hz) and actual AudioContext
- Band separation too narrow (missed harmonic content)

**Resolution:**
- Rewrote `processFullMix` to extract chroma directly from overlapping frequency bands:
  - Primary (80Hz-4kHz): 60% weight - main chord harmonics
  - Bass (30-250Hz): 25% weight - root note detection
  - High (1-6kHz): 15% weight - chord quality/extensions
- Added sample rate sync from AudioContext
- Added signal level check to skip processing when audio too quiet

**Files Changed:**
- `client/src/utils/advancedChordDetection.js`
- `client/src/hooks/useAdvancedChordDetection.js`
- `client/src/components/ChordDetector.js`

---

### Incident #002: Chord Grid Playhead Out of Sync

**Status:** RESOLVED

**Symptoms:**
- Red playhead line appears late after 3 bars
- Grid not synced with actual song position
- Bar numbers don't match playback position

**Root Cause:**
- Bars were calculated from first chord timestamp instead of time 0
- `currentBarBeat` calculated from time 0 but bars started from `firstTime`
- Timing mismatch caused playhead to drift

**Resolution:**
- Changed bar calculation to use absolute time from 0 (song start)
- `currentBar = Math.floor(currentTimeMs / barDurationMs)` - direct calculation
- Playhead position uses same reference: `(currentTimeMs % barDurationMs) / barDurationMs`
- Both now perfectly synced to same time base

**Files Changed:**
- `client/src/components/ChordDetector.js`
- `client/src/App.css`

---

### Incident #003: Rhythm Settings Reset on Re-analyze

**Status:** RESOLVED

**Symptoms:**
- Selecting "4 on 4" preset resets after re-analyze
- Energy Threshold and Min Hit Interval return to defaults
- Genre Preset dropdown shows "Select preset..." after analysis

**Root Cause:**
- `localThresholds` state initialized only on mount, not synced with props
- `useState` initial value doesn't update on re-renders
- Genre Preset used `defaultValue` which doesn't persist selection
- Settings not passed to `onReanalyze` callback

**Resolution:**
- Added `useEffect` to sync local thresholds with parent (preserving user values)
- Added `selectedPreset` state to track genre selection
- Changed `defaultValue` to controlled `value` prop
- Pass `localThresholds` to `onReanalyze()` callback
- Added settings summary showing current values

**Files Changed:**
- `client/src/components/stages/RhythmVerificationStage.js`
- `client/src/App.css`

---

## Integration Lessons Learned

### State Management
1. **Props vs Local State:** When component needs to edit prop values, sync local state with `useEffect` but preserve user modifications
2. **Controlled vs Uncontrolled:** Use `value` instead of `defaultValue` for form elements that need to persist selections
3. **Callback Arguments:** Pass current settings to callbacks so parent can use them

### Audio Processing
1. **Sample Rate:** Always get sample rate from AudioContext, don't assume 44100Hz
2. **Frequency Bands:** Use overlapping bands for better harmonic capture
3. **Signal Level:** Check for minimum signal level before processing

### Time Synchronization
1. **Common Reference:** All time-based calculations should use same reference point (time 0)
2. **Direct Calculation:** Calculate current position directly from `currentTimeMs`, don't cache intermediate values that can drift
3. **Consistent Units:** Ensure all time values use same units (ms vs seconds)

---

## How to Report New Issues

1. Add new incident with date and title
2. Document symptoms, root cause, and resolution
3. List files changed
4. Update "Lessons Learned" if applicable
