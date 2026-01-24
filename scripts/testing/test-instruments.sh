#!/bin/bash
# =============================================================================
# Instrument Detection Test Script
# Tests vocals, drums, bass, and all instruments on an audio file
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:56403"

# Check if file argument provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <audio_file> [instrument_type]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 /path/to/audio.aif              # Test all instruments"
    echo "  $0 /path/to/audio.wav vocals       # Test vocals only"
    echo "  $0 /path/to/audio.mp3 drums        # Test drums only"
    echo "  $0 /path/to/audio.m4a bass         # Test bass only"
    echo ""
    echo "Available instrument types:"
    echo "  vocals    - vocal_body, vocal_presence, vocal_air"
    echo "  adlibs    - adlib, harmony"
    echo "  drums     - kick, snare, hihat, clap, tom, perc"
    echo "  bass      - sub_bass, bass, bass_harmonics"
    echo "  piano     - piano_low, piano_mid, piano_high"
    echo "  synth     - synth_lead, synth_pad, pluck"
    echo "  fx        - uplifter, downlifter, impact, etc."
    echo "  all       - All 36 instruments"
    exit 1
fi

AUDIO_FILE="$1"
INSTRUMENT_TYPE="${2:-all}"

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo -e "${RED}Error: File not found: $AUDIO_FILE${NC}"
    exit 1
fi

# Check if service is running
echo -e "${BLUE}Checking rhythm analyzer service...${NC}"
HEALTH=$(curl -s "$API_URL/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo -e "${RED}Error: Rhythm analyzer not running on $API_URL${NC}"
    echo "Start it with: ./venv/bin/python rhythm_analyzer.py"
    exit 1
fi
echo -e "${GREEN}Service is healthy${NC}"

# Get file info
FILENAME=$(basename "$AUDIO_FILE")
FILESIZE=$(ls -lh "$AUDIO_FILE" | awk '{print $5}')
echo -e "${BLUE}Testing: $FILENAME ($FILESIZE)${NC}"
echo ""

# Run detection
echo -e "${YELLOW}=== Detecting: $INSTRUMENT_TYPE ===${NC}"
echo ""

RESULT=$(curl -s -X POST "$API_URL/detect-instruments" \
    -F "file=@$AUDIO_FILE" \
    -F "instrument_types=$INSTRUMENT_TYPE" \
    -F "energy_multiplier=0.3" \
    -F "detect_stereo=true" \
    -F "use_dynamic_eq=true" \
    2>/dev/null)

if [ -z "$RESULT" ]; then
    echo -e "${RED}Error: No response from API${NC}"
    exit 1
fi

# Check for error
ERROR=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))" 2>/dev/null)
if [ -n "$ERROR" ]; then
    echo -e "${RED}Error: $ERROR${NC}"
    exit 1
fi

# Parse and display results
echo "$RESULT" | python3 << 'PYTHON_SCRIPT'
import sys
import json

try:
    data = json.load(sys.stdin)

    if not data.get('success', False):
        print(f"\033[0;31mDetection failed: {data.get('error', 'Unknown error')}\033[0m")
        sys.exit(1)

    print(f"\033[0;32m✓ Detection successful\033[0m")
    print(f"  Duration: {data.get('duration', 0):.2f}s")
    print(f"  Bands scanned: {', '.join(data.get('bands_scanned', []))}")
    print()

    results = data.get('results', {})
    total_hits = 0

    for band, info in sorted(results.items()):
        hits = info.get('hits', [])
        count = len(hits)
        total_hits += count

        if count > 0:
            freq = info.get('filter_range', 'N/A')
            print(f"\033[1;33m{band}\033[0m ({freq}): {count} hits")

            # Show first 5 hits
            for i, hit in enumerate(hits[:5]):
                time = hit.get('time', 0)
                conf = hit.get('confidence', 0) * 100
                pos = hit.get('stereo_position', 'center')
                print(f"    {i+1}. {time:.2f}s (conf: {conf:.0f}%, pos: {pos})")

            if count > 5:
                print(f"    ... and {count - 5} more")
            print()

    print(f"\033[0;32mTotal hits detected: {total_hits}\033[0m")

except Exception as e:
    print(f"\033[0;31mError parsing results: {e}\033[0m")
    sys.exit(1)
PYTHON_SCRIPT

echo ""
echo -e "${GREEN}Done!${NC}"
