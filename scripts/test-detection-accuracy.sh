#!/bin/bash
# Detection Accuracy Test Script
# Tests rhythm detection and calculates accuracy metrics

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Config
RHYTHM_API="http://localhost:56403"
TEST_FILE="${1:-/Users/iggy/Am/01 Blinding Lights.aif}"

# Ground truth for Blinding Lights (The Weeknd)
# These are approximate expected values based on the song structure
EXPECTED_BPM=171
EXPECTED_BPM_TOLERANCE=3
EXPECTED_TIME_SIG=4
EXPECTED_BARS=129
EXPECTED_GENRE="trap"

# Expected hits per bar (Gemini 3 Pro analysis - 2026-01-24)
# 4-on-the-floor kick pattern, snare on 2&4, 16th note hi-hats
EXPECTED_KICKS_PER_BAR=4      # ~516 total (4-on-the-floor, NOT 2)
EXPECTED_SNARES_PER_BAR=2     # ~258 total (beats 2 and 4)
EXPECTED_HIHATS_PER_BAR=16    # ~2064 total (16th notes pattern)
EXPECTED_CLAPS_PER_BAR=2      # ~258 total (layered with snare on 2&4)
EXPECTED_TOMS_PER_BAR=0       # ~0 total (no toms in this track)
EXPECTED_PERCS_PER_BAR=0      # ~0 total (Gemini: layered with snare, not separate)

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       RHYTHM DETECTION ACCURACY TEST                         ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if service is running
echo -e "${BLUE}[1/5] Checking service...${NC}"
HEALTH=$(curl -s "$RHYTHM_API/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo -e "${RED}✗ Rhythm analyzer service not running${NC}"
    echo "  Run: ./start-services.sh"
    exit 1
fi
echo -e "${GREEN}✓ Service healthy${NC}"

# Check if test file exists
echo -e "${BLUE}[2/5] Checking test file...${NC}"
if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}✗ Test file not found: $TEST_FILE${NC}"
    exit 1
fi
FILE_SIZE=$(ls -lh "$TEST_FILE" | awk '{print $5}')
echo -e "${GREEN}✓ Test file: $(basename "$TEST_FILE") ($FILE_SIZE)${NC}"

# Copy file to temp with simple name (avoid spaces)
echo -e "${BLUE}[3/5] Preparing audio file...${NC}"
TEMP_FILE="/tmp/test_audio_accuracy.aif"
cp "$TEST_FILE" "$TEMP_FILE"
echo -e "${GREEN}✓ File ready${NC}"

# Run basic detection
echo -e "${BLUE}[4/5] Running basic detection (/analyze-rhythm)...${NC}"
BASIC_RESULT=$(curl -s -X POST "$RHYTHM_API/analyze-rhythm" \
    -F "audio=@$TEMP_FILE" 2>/dev/null)

if [ -z "$BASIC_RESULT" ] || echo "$BASIC_RESULT" | grep -q "Error\|error"; then
    echo -e "${RED}✗ Basic detection failed${NC}"
    echo "$BASIC_RESULT"
else
    echo -e "${GREEN}✓ Basic detection complete${NC}"
fi

# Run AI detection
echo -e "${BLUE}[5/6] Running AI detection (/analyze-rhythm-ai)...${NC}"
AI_RESULT=$(curl -s -X POST "$RHYTHM_API/analyze-rhythm-ai" \
    -F "audio=@$TEMP_FILE" \
    -F "sensitivities={\"kick\":0.5,\"snare\":0.5,\"hihat\":0.5,\"clap\":0.5}" 2>/dev/null)

if [ -z "$AI_RESULT" ] || echo "$AI_RESULT" | grep -q "Error\|error"; then
    echo -e "${RED}✗ AI detection failed${NC}"
    echo "$AI_RESULT"
else
    echo -e "${GREEN}✓ AI detection complete${NC}"
fi

# Run quiet hit detection for percussion
echo -e "${BLUE}[6/6] Running quiet hit detection (/predict-quiet-hits)...${NC}"
# Get BPM and duration from AI result
AI_BPM=$(echo "$AI_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('bpm',120))" 2>/dev/null)
AUDIO_DURATION=$(echo "$AI_RESULT" | python3 -c "import json,sys; print(json.load(sys.stdin).get('duration',180))" 2>/dev/null)

# Convert AI hits to flat list format for predict-quiet-hits
HITS_LIST=$(echo "$AI_RESULT" | python3 -c "
import json, sys
data = json.load(sys.stdin)
hits = data.get('hits', {})
flat = []
if isinstance(hits, dict):
    for dtype, times in hits.items():
        if isinstance(times, list):
            for t in times:
                flat.append({'type': dtype, 'time': t})
print(json.dumps(flat))
" 2>/dev/null)

# Run quiet hit detection with formatted hits
QUIET_RESULT=$(curl -s -X POST "$RHYTHM_API/predict-quiet-hits" \
    -F "file=@$TEMP_FILE" \
    -F "hits=$HITS_LIST" \
    -F "bpm=$AI_BPM" \
    -F "audio_duration=$AUDIO_DURATION" \
    -F "start_bar=1" \
    -F "energy_multiplier=0.3" 2>/dev/null)

if [ -z "$QUIET_RESULT" ] || echo "$QUIET_RESULT" | grep -q '"success": *false'; then
    echo -e "${YELLOW}~ Quiet hit detection skipped${NC}"
    QUIET_PERC=0
else
    QUIET_PERC=$(echo "$QUIET_RESULT" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d.get('new_hits',{}).get('perc',[])))" 2>/dev/null || echo "0")
    echo -e "${GREEN}✓ Found $QUIET_PERC additional perc hits${NC}"
fi

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}                      RESULTS COMPARISON                        ${NC}"
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"

# Parse and compare results
python3 << EOF
import json
import sys

# Additional quiet perc hits from quiet hit detection
QUIET_PERC = $QUIET_PERC

# Ground truth
EXPECTED = {
    'bpm': $EXPECTED_BPM,
    'bpm_tolerance': $EXPECTED_BPM_TOLERANCE,
    'time_sig': $EXPECTED_TIME_SIG,
    'bars': $EXPECTED_BARS,
    'genre': '$EXPECTED_GENRE',
    'kicks_per_bar': $EXPECTED_KICKS_PER_BAR,
    'snares_per_bar': $EXPECTED_SNARES_PER_BAR,
    'hihats_per_bar': $EXPECTED_HIHATS_PER_BAR,
    'claps_per_bar': $EXPECTED_CLAPS_PER_BAR,
    'toms_per_bar': $EXPECTED_TOMS_PER_BAR,
    'percs_per_bar': $EXPECTED_PERCS_PER_BAR,
}

# Expected totals
expected_kicks = EXPECTED['bars'] * EXPECTED['kicks_per_bar']
expected_snares = EXPECTED['bars'] * EXPECTED['snares_per_bar']
expected_hihats = EXPECTED['bars'] * EXPECTED['hihats_per_bar']
expected_claps = EXPECTED['bars'] * EXPECTED['claps_per_bar']
expected_toms = int(EXPECTED['bars'] * EXPECTED['toms_per_bar'])
expected_percs = int(EXPECTED['bars'] * EXPECTED['percs_per_bar'])
expected_backbeat = expected_snares + expected_claps

def parse_hits(result):
    """Extract hit counts from result"""
    hits = result.get('hits', {})
    if isinstance(hits, list):
        # Flat list format
        counts = {'kick': 0, 'snare': 0, 'hihat': 0, 'clap': 0, 'tom': 0, 'perc': 0}
        for h in hits:
            t = h.get('type', 'unknown')
            if t in counts:
                counts[t] += 1
        return counts
    elif isinstance(hits, dict):
        return {k: len(v) if isinstance(v, list) else 0 for k, v in hits.items()}
    return {'kick': 0, 'snare': 0, 'hihat': 0, 'clap': 0, 'tom': 0, 'perc': 0}

def accuracy_score(detected, expected, tolerance_pct=0.3):
    """Calculate accuracy score (0-100)"""
    if expected == 0:
        return 100 if detected == 0 else 0
    diff = abs(detected - expected)
    tolerance = expected * tolerance_pct
    if diff <= tolerance:
        return 100 - (diff / tolerance * 30)  # Up to 30% penalty within tolerance
    else:
        return max(0, 70 - ((diff - tolerance) / expected * 100))

def format_comparison(label, basic, ai, expected, unit=''):
    """Format a comparison row"""
    basic_acc = accuracy_score(basic, expected)
    ai_acc = accuracy_score(ai, expected)

    basic_color = '\033[92m' if basic_acc >= 80 else ('\033[93m' if basic_acc >= 50 else '\033[91m')
    ai_color = '\033[92m' if ai_acc >= 80 else ('\033[93m' if ai_acc >= 50 else '\033[91m')
    nc = '\033[0m'

    basic_symbol = '✓' if basic_acc >= 80 else ('~' if basic_acc >= 50 else '✗')
    ai_symbol = '✓' if ai_acc >= 80 else ('~' if ai_acc >= 50 else '✗')

    print(f"  {label:12} │ {basic_color}{basic:>6}{unit} {basic_symbol}{nc} │ {ai_color}{ai:>6}{unit} {ai_symbol}{nc} │ {expected:>6}{unit} │ {basic_color}{basic_acc:>5.0f}%{nc} │ {ai_color}{ai_acc:>5.0f}%{nc}")

try:
    basic = json.loads('''$BASIC_RESULT''')
    ai = json.loads('''$AI_RESULT''')
except json.JSONDecodeError as e:
    print(f"\033[91mError parsing results: {e}\033[0m")
    sys.exit(1)

# Parse hits
basic_hits = parse_hits(basic)
ai_hits = parse_hits(ai)

print("")
print("  \033[1mMetric       │  Basic      │  AI         │ Expected │ Basic │   AI\033[0m")
print("  ─────────────┼─────────────┼─────────────┼──────────┼───────┼───────")

# BPM
basic_bpm = basic.get('bpm', 0)
ai_bpm = ai.get('bpm', 0)
format_comparison('BPM', round(basic_bpm, 1), round(ai_bpm, 1), EXPECTED['bpm'], '')

# Confidence
basic_conf = basic.get('bpm_confidence', 0) * 100
ai_conf = ai.get('bpm_confidence', 0) * 100
print(f"  {'Confidence':12} │ {basic_conf:>5.0f}%     │ {ai_conf:>5.0f}%     │   >70%   │       │")

# Genre
basic_genre = basic.get('detected_genre', 'unknown')
ai_genre = ai.get('detected_genre', 'unknown')
genre_match_b = '✓' if basic_genre.lower() == EXPECTED['genre'].lower() else '✗'
genre_match_a = '✓' if ai_genre.lower() == EXPECTED['genre'].lower() else '✗'
print(f"  {'Genre':12} │ {basic_genre:>6} {genre_match_b}   │ {ai_genre:>6} {genre_match_a}   │ {EXPECTED['genre']:>8} │       │")

print("  ─────────────┼─────────────┼─────────────┼──────────┼───────┼───────")

# Drum hits
format_comparison('Kicks', basic_hits.get('kick', 0), ai_hits.get('kick', 0), expected_kicks, '')
format_comparison('Snares', basic_hits.get('snare', 0), ai_hits.get('snare', 0), expected_snares, '')
format_comparison('Hi-Hats', basic_hits.get('hihat', 0), ai_hits.get('hihat', 0), expected_hihats, '')
format_comparison('Claps', basic_hits.get('clap', 0), ai_hits.get('clap', 0), expected_claps, '')
format_comparison('Toms', basic_hits.get('tom', 0), ai_hits.get('tom', 0), expected_toms, '')
# Add quiet hit perc count to AI total
ai_perc_total = ai_hits.get('perc', 0) + QUIET_PERC
format_comparison('Perc', basic_hits.get('perc', 0), ai_perc_total, expected_percs, '')

# Backbeat (snares + claps combined)
basic_backbeat = basic_hits.get('snare', 0) + basic_hits.get('clap', 0)
ai_backbeat = ai_hits.get('snare', 0) + ai_hits.get('clap', 0)
format_comparison('Backbeat', basic_backbeat, ai_backbeat, expected_backbeat, '')

print("  ─────────────┴─────────────┴─────────────┴──────────┴───────┴───────")

# Calculate overall scores
scores_basic = [
    accuracy_score(basic_bpm, EXPECTED['bpm']),
    accuracy_score(basic_hits.get('kick', 0), expected_kicks),
    accuracy_score(basic_backbeat, expected_backbeat),
    accuracy_score(basic_hits.get('hihat', 0), expected_hihats),
    accuracy_score(basic_hits.get('perc', 0), expected_percs) if expected_percs > 0 else 100,
]
scores_ai = [
    accuracy_score(ai_bpm, EXPECTED['bpm']),
    accuracy_score(ai_hits.get('kick', 0), expected_kicks),
    accuracy_score(ai_backbeat, expected_backbeat),
    accuracy_score(ai_hits.get('hihat', 0), expected_hihats),
    accuracy_score(ai_perc_total, expected_percs) if expected_percs > 0 else 100,
]

basic_overall = sum(scores_basic) / len(scores_basic)
ai_overall = sum(scores_ai) / len(scores_ai)

print("")
print("\033[1m  OVERALL ACCURACY SCORE\033[0m")
print("  ─────────────────────────────────────────────────────────────────")

basic_color = '\033[92m' if basic_overall >= 80 else ('\033[93m' if basic_overall >= 50 else '\033[91m')
ai_color = '\033[92m' if ai_overall >= 80 else ('\033[93m' if ai_overall >= 50 else '\033[91m')
nc = '\033[0m'

basic_grade = 'A' if basic_overall >= 90 else ('B' if basic_overall >= 80 else ('C' if basic_overall >= 70 else ('D' if basic_overall >= 60 else 'F')))
ai_grade = 'A' if ai_overall >= 90 else ('B' if ai_overall >= 80 else ('C' if ai_overall >= 70 else ('D' if ai_overall >= 60 else 'F')))

print(f"  Basic Detection:  {basic_color}{basic_overall:>5.1f}% (Grade: {basic_grade}){nc}")
print(f"  AI Detection:     {ai_color}{ai_overall:>5.1f}% (Grade: {ai_grade}){nc}")

improvement = ai_overall - basic_overall
if improvement > 0:
    print(f"  \033[92m↑ AI is {improvement:.1f}% more accurate\033[0m")
elif improvement < 0:
    print(f"  \033[91m↓ Basic is {-improvement:.1f}% more accurate\033[0m")

# Summary
print("")
print("\033[1m  HIT COUNTS SUMMARY\033[0m")
print("  ─────────────────────────────────────────────────────────────────")
basic_total = sum(basic_hits.values())
ai_total = sum(ai_hits.values()) + QUIET_PERC
expected_total = expected_kicks + expected_snares + expected_hihats + expected_claps + expected_toms + expected_percs
print(f"  Basic Total:    {basic_total:>6} hits")
print(f"  AI Total:       {ai_total:>6} hits")
print(f"  Expected Total: {expected_total:>6} hits (approximate)")
if basic_total > 0:
    print(f"  AI Improvement: {ai_total - basic_total:>+6} hits ({(ai_total/basic_total - 1)*100:+.0f}%)")
else:
    print(f"  AI Improvement: {ai_total - basic_total:>+6} hits")

EOF

# Cleanup
rm -f "$TEMP_FILE"

echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Test complete!${NC}"
echo ""
