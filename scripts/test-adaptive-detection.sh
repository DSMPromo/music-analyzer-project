#!/bin/bash
# Test Adaptive Detection for Quiet Sections
# Usage: ./scripts/test-adaptive-detection.sh <audio_file> <bpm>
#
# Examples:
#   ./scripts/test-adaptive-detection.sh test-fixtures/blinding-lights.mp3 171
#   ./scripts/test-adaptive-detection.sh my-track.wav 128
#
# Options:
#   target_bars: "quiet" (auto-detect), "20,21,22" (specific bars), or empty (all bars)
#   sensitivity_boost: 2.0 (default), higher = more sensitive for quiet sections

AUDIO_FILE="${1:-test-fixtures/test-tone.mp3}"
BPM="${2:-120}"
TARGET_BARS="${3:-quiet}"
SENSITIVITY="${4:-2.0}"

echo "============================================"
echo "  Adaptive Detection Test"
echo "============================================"
echo "Audio: $AUDIO_FILE"
echo "BPM: $BPM"
echo "Target bars: $TARGET_BARS"
echo "Sensitivity boost: ${SENSITIVITY}x"
echo ""

# Check if service is running
if ! curl -s http://localhost:56403/health > /dev/null 2>&1; then
    echo "ERROR: Rhythm analyzer not running on port 56403"
    echo "Start with: ./start-services.sh"
    exit 1
fi

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo "ERROR: File not found: $AUDIO_FILE"
    exit 1
fi

echo "1. Testing /detect-adaptive endpoint..."
echo ""

RESPONSE=$(curl -s -X POST http://localhost:56403/detect-adaptive \
    -F "file=@$AUDIO_FILE" \
    -F "bpm=$BPM" \
    -F "target_bars=$TARGET_BARS" \
    -F "sensitivity_boost=$SENSITIVITY")

# Check for success
SUCCESS=$(echo "$RESPONSE" | jq -r '.success')
if [ "$SUCCESS" != "true" ]; then
    echo "ERROR: Detection failed"
    echo "$RESPONSE" | jq '.error'
    exit 1
fi

# Extract results
TOTAL_BARS=$(echo "$RESPONSE" | jq -r '.total_bars')
BARS_SCANNED=$(echo "$RESPONSE" | jq -r '.bars_scanned')
QUIET_BARS=$(echo "$RESPONSE" | jq -r '.quiet_bars | length')
NEW_HITS=$(echo "$RESPONSE" | jq -r '.total_new_hits')
MEDIAN_ENERGY=$(echo "$RESPONSE" | jq -r '.median_bar_energy')

echo "Results:"
echo "  Total bars: $TOTAL_BARS"
echo "  Bars scanned: $BARS_SCANNED"
echo "  Quiet bars found: $QUIET_BARS"
echo "  New hits detected: $NEW_HITS"
echo "  Median bar energy: $MEDIAN_ENERGY"
echo ""

# Show hits by type
echo "Hits by type:"
echo "$RESPONSE" | jq -r '.hits_by_type | to_entries[] | "  \(.key): \(.value)"'
echo ""

# Show quiet bars
echo "Quiet bars (below 60% median energy):"
echo "$RESPONSE" | jq -r '.quiet_bars[:20] | join(", ")'
if [ "$QUIET_BARS" -gt 20 ]; then
    echo "  ... and $((QUIET_BARS - 20)) more"
fi
echo ""

# Show bar energy distribution
echo "Bar energy distribution (first 10 bars):"
echo "$RESPONSE" | jq -r '.bar_energies[:10][] | "  Bar \(.bar): \(.rms | tostring | .[0:8]) \(if .is_quiet then "(QUIET)" else "" end)"'
echo ""

# Show sample hits
echo "Sample new hits (first 5):"
echo "$RESPONSE" | jq -r '.new_hits[:5][] | "  \(.time)s: \(.type) (bar \(.bar), energy=\(.energy), quiet=\(.is_quiet_bar))"'
echo ""

echo "============================================"
echo "  Test Complete"
echo "============================================"
