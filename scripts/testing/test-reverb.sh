#!/bin/bash
# =============================================================================
# Reverb/Delay Analysis Test Script
# Tests reverb time, stereo width, delay echoes on an audio file
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

API_URL="http://localhost:56403"

# Check if file argument provided
if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <audio_file> [section_length]${NC}"
    echo ""
    echo "Examples:"
    echo "  $0 /path/to/audio.aif              # Analyze with 4s sections"
    echo "  $0 /path/to/audio.wav 8            # Analyze with 8s sections"
    echo ""
    echo "Output includes:"
    echo "  - RT60 (reverb time)"
    echo "  - Stereo width and correlation"
    echo "  - Delay echo detection"
    echo "  - Pre-delay estimation"
    echo "  - Plugin recommendations"
    exit 1
fi

AUDIO_FILE="$1"
SECTION_LENGTH="${2:-4}"

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
echo -e "${BLUE}Analyzing: $FILENAME ($FILESIZE)${NC}"
echo ""

# Run analysis
echo -e "${YELLOW}=== Reverb/Delay Analysis ===${NC}"
echo ""

RESULT=$(curl -s -X POST "$API_URL/analyze-reverb-delay" \
    -F "file=@$AUDIO_FILE" \
    -F "analyze_sections=true" \
    -F "section_length=$SECTION_LENGTH" \
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
        print(f"\033[0;31mAnalysis failed: {data.get('error', 'Unknown error')}\033[0m")
        sys.exit(1)

    print(f"\033[0;32m✓ Analysis successful\033[0m")
    print(f"  Duration: {data.get('duration', 0):.2f}s")
    print(f"  Stereo: {'Yes' if data.get('is_stereo') else 'No'}")
    print()

    g = data.get('global', {})

    # Reverb characteristics
    print("\033[1;33m=== REVERB CHARACTERISTICS ===\033[0m")
    rt60 = g.get('rt60_seconds')
    if rt60:
        print(f"  RT60: {rt60:.2f}s ({g.get('rt60_description', '')})")
    else:
        print("  RT60: Could not estimate")

    predelay = g.get('predelay_ms')
    if predelay:
        print(f"  Pre-delay: {predelay:.0f}ms")

    print(f"  Character: {g.get('reverb_character', 'Unknown')}")
    print()

    # Stereo analysis
    stereo = g.get('stereo', {})
    print("\033[1;33m=== STEREO ANALYSIS ===\033[0m")
    print(f"  Correlation: {stereo.get('correlation', 0):.2f} (1.0=mono, 0.0=wide)")
    print(f"  Width: {stereo.get('width', 0) * 100:.0f}%")
    balance = stereo.get('l_r_balance', 0)
    if abs(balance) < 0.05:
        balance_str = "Centered"
    elif balance < 0:
        balance_str = f"Left ({abs(balance)*100:.0f}%)"
    else:
        balance_str = f"Right ({balance*100:.0f}%)"
    print(f"  Balance: {balance_str}")
    print()

    # Delay echoes
    delay = g.get('delay', {})
    print("\033[1;33m=== DELAY ECHOES ===\033[0m")
    if delay.get('detected'):
        print(f"  Detected: Yes")
        print(f"  Primary delay: {delay.get('primary_delay_ms', 0):.0f}ms")
        print(f"  Strength: {delay.get('primary_strength', 0) * 100:.0f}%")
        print(f"  Est. feedback: {delay.get('estimated_feedback', 0) * 100:.0f}%")

        echoes = delay.get('echoes', [])
        if len(echoes) > 1:
            print(f"  Additional echoes:")
            for e in echoes[1:3]:
                print(f"    - {e['delay_ms']:.0f}ms ({e['strength']*100:.0f}%)")
    else:
        print(f"  Detected: No distinct delay echoes found")
    print()

    # Recommendations
    recs = data.get('recommendations', {})
    print("\033[1;33m=== PLUGIN RECOMMENDATIONS ===\033[0m")

    reverb_rec = recs.get('reverb', {})
    print("  \033[0;36mReverb:\033[0m")
    print(f"    Decay time: {reverb_rec.get('decay_time', 'N/A')}")
    print(f"    Pre-delay: {reverb_rec.get('predelay', 'N/A')}")
    print(f"    Width: {reverb_rec.get('width', 'N/A')}")
    print(f"    Diffusion: {reverb_rec.get('diffusion', 'N/A')}")
    plugins = reverb_rec.get('suggested_plugins', [])
    if plugins:
        print(f"    Suggested plugins:")
        for p in plugins:
            print(f"      - {p}")

    delay_rec = recs.get('delay')
    if delay_rec:
        print()
        print("  \033[0;36mDelay:\033[0m")
        print(f"    Delay time: {delay_rec.get('delay_time', 'N/A')}")
        print(f"    Feedback: {delay_rec.get('feedback', 'N/A')}")
        print(f"    Mix: {delay_rec.get('mix', 'N/A')}")
        plugins = delay_rec.get('suggested_plugins', [])
        if plugins:
            print(f"    Suggested plugins:")
            for p in plugins:
                print(f"      - {p}")
    print()

    # Section analysis
    sections = data.get('sections', [])
    if sections:
        print("\033[1;33m=== SECTION ANALYSIS ===\033[0m")
        print(f"  ({len(sections)} sections analyzed)")
        for i, s in enumerate(sections[:4]):  # Show first 4
            rt60 = s.get('rt60_seconds')
            width = s.get('stereo', {}).get('width', 0) * 100
            start = s.get('start_time', 0)
            end = s.get('end_time', 0)
            print(f"    {start:.1f}-{end:.1f}s: RT60={rt60:.2f}s, Width={width:.0f}%")

        if len(sections) > 4:
            print(f"    ... and {len(sections) - 4} more sections")
        print()

    print("\033[0;32mDone!\033[0m")

except Exception as e:
    print(f"\033[0;31mError parsing results: {e}\033[0m")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_SCRIPT

echo ""
echo -e "${GREEN}Analysis complete!${NC}"
