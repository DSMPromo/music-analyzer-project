#!/bin/bash
# =============================================================================
# Frequency Band Analysis for AI Tuning
# Analyzes spectrogram to find optimal detection thresholds
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

API_URL="http://localhost:56403"

if [ -z "$1" ]; then
    echo -e "${YELLOW}Usage: $0 <audio_file>${NC}"
    echo ""
    echo "Analyzes frequency bands to find optimal AI detection thresholds."
    echo ""
    echo "Output includes:"
    echo "  - Energy levels per frequency band"
    echo "  - Signal-to-threshold ratios"
    echo "  - Threshold recommendations"
    echo "  - Masking detection"
    exit 1
fi

AUDIO_FILE="$1"

if [ ! -f "$AUDIO_FILE" ]; then
    echo -e "${RED}Error: File not found: $AUDIO_FILE${NC}"
    exit 1
fi

# Check service
echo -e "${BLUE}Checking rhythm analyzer service...${NC}"
HEALTH=$(curl -s "$API_URL/health" 2>/dev/null)
if [ -z "$HEALTH" ]; then
    echo -e "${RED}Error: Rhythm analyzer not running on $API_URL${NC}"
    exit 1
fi
echo -e "${GREEN}Service is healthy${NC}"

FILENAME=$(basename "$AUDIO_FILE")
echo -e "${BLUE}Analyzing: $FILENAME${NC}"
echo ""

echo -e "${YELLOW}=== Frequency Band Analysis ===${NC}"
echo ""

RESULT=$(curl -s -X POST "$API_URL/analyze-frequency-bands" \
    -F "file=@$AUDIO_FILE" \
    -F "use_hpss=true" \
    2>/dev/null)

if [ -z "$RESULT" ]; then
    echo -e "${RED}Error: No response from API${NC}"
    exit 1
fi

echo "$RESULT" | python3 << 'PYTHON_SCRIPT'
import sys
import json

try:
    data = json.load(sys.stdin)

    if not data.get('success', False):
        print(f"\033[0;31mAnalysis failed: {data.get('error', 'Unknown')}\033[0m")
        sys.exit(1)

    print(f"\033[0;32m✓ Analysis successful\033[0m")
    print(f"  Duration: {data.get('duration', 0):.2f}s")
    print(f"  Total RMS: {data.get('total_rms', 0):.6f}")
    print()

    # Category summary
    print("\033[1;33m=== CATEGORY ENERGY ===\033[0m")
    categories = data.get('categories', {})
    for cat, info in sorted(categories.items(), key=lambda x: x[1].get('total_rms', 0), reverse=True):
        rms = info.get('total_rms', 0)
        bar = '█' * int(rms * 500)
        print(f"  {cat:10} {rms:.6f} {bar}")
    print()

    # Top energy bands
    print("\033[1;33m=== TOP ENERGY BANDS ===\033[0m")
    top_bands = data.get('top_energy_bands', [])
    for i, b in enumerate(top_bands[:10], 1):
        band = b['band']
        rms = b['rms']
        str_ratio = b['str_ratio']

        # Color based on STR
        if str_ratio > 5:
            color = '\033[0;31m'  # Red - too sensitive
        elif str_ratio > 2:
            color = '\033[1;33m'  # Yellow - might trigger
        else:
            color = '\033[0;32m'  # Green - OK

        print(f"  {i:2}. {band:18} RMS={rms:.6f}  STR={color}{str_ratio:.1f}x\033[0m")
    print()

    # High detection bands (likely false positives)
    high_det = data.get('high_detection_bands', [])
    if high_det:
        print("\033[1;33m=== HIGH DETECTION RISK (STR > 2.0) ===\033[0m")
        for b in high_det[:8]:
            band = b['band']
            str_ratio = b['str_ratio']
            bands = data.get('bands', {})
            info = bands.get(band, {})
            freq = info.get('frequency_range', '?')
            thresh = info.get('threshold', 0)

            # Calculate suggested threshold
            rms = info.get('rms', 0)
            suggested = rms / 2.5  # Target STR of 2.5

            print(f"  \033[1;33m{band:18}\033[0m {freq:15} STR={str_ratio:.1f}x")
            print(f"      Current: {thresh:.4f}  Suggested: {suggested:.4f}")
        print()

    # Recommendations
    recs = data.get('recommendations', [])
    if recs:
        print("\033[1;33m=== AI RECOMMENDATIONS ===\033[0m")
        for rec in recs:
            rec_type = rec.get('type', '')
            if rec_type == 'masking':
                print(f"  \033[0;33m⚠ {rec.get('issue', '')}\033[0m")
                print(f"    → {rec.get('suggestion', '')}")
            elif rec_type == 'threshold':
                band = rec.get('band', '')
                current = rec.get('current_threshold', 0)
                suggested = rec.get('suggested_threshold', 0)
                print(f"  \033[0;31m⚠ {band}: {rec.get('issue', '')}\033[0m")
                print(f"    → Raise threshold: {current:.4f} → {suggested:.4f}")
        print()

    # Drum-specific analysis
    print("\033[1;33m=== DRUM BANDS DETAIL ===\033[0m")
    bands = data.get('bands', {})
    drums = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc']
    for drum in drums:
        if drum in bands:
            info = bands[drum]
            freq = info.get('frequency_range', '?')
            rms = info.get('rms', 0)
            thresh = info.get('threshold', 0)
            str_ratio = info.get('signal_to_threshold', 0)

            status = '✓' if str_ratio < 3 else ('⚠' if str_ratio < 5 else '✗')
            color = '\033[0;32m' if str_ratio < 3 else ('\033[1;33m' if str_ratio < 5 else '\033[0;31m')

            print(f"  {status} {drum:8} {freq:15} RMS={rms:.6f} Thresh={thresh:.4f} {color}STR={str_ratio:.1f}x\033[0m")
    print()

    print("\033[0;32mDone! Use suggested thresholds to reduce false positives.\033[0m")

except Exception as e:
    print(f"\033[0;31mError: {e}\033[0m")
    import traceback
    traceback.print_exc()
    sys.exit(1)
PYTHON_SCRIPT

echo ""
echo -e "${GREEN}Analysis complete!${NC}"
