#!/bin/bash
# =============================================================================
# Generate Test Fixtures - Audio Files for E2E Testing
# Creates synthetic audio files for testing without requiring external samples
# =============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES_DIR="$PROJECT_DIR/test-fixtures"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Test Fixtures Generator${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check FFmpeg
if ! command -v ffmpeg &> /dev/null; then
    echo -e "${YELLOW}FFmpeg not found. Install with: brew install ffmpeg${NC}"
    exit 1
fi

mkdir -p "$FIXTURES_DIR"
cd "$FIXTURES_DIR"

echo -e "${BLUE}Generating test audio files...${NC}"
echo ""

# 1. Simple test tone (5 seconds, 440Hz A4)
echo -e "  Creating ${GREEN}test-tone.mp3${NC} (5s, 440Hz sine wave)..."
ffmpeg -y -f lavfi -i "sine=frequency=440:duration=5" \
    -ar 44100 -b:a 192k \
    test-tone.mp3 2>/dev/null

# 2. Short track - 10 second chord progression using simple layering
echo -e "  Creating ${GREEN}short-track.mp3${NC} (10s, chord tones)..."
ffmpeg -y -f lavfi -i "sine=frequency=261.63:duration=10" \
    -f lavfi -i "sine=frequency=329.63:duration=10" \
    -f lavfi -i "sine=frequency=392:duration=10" \
    -filter_complex "[0][1][2]amix=inputs=3:duration=first,volume=0.5" \
    -ar 44100 -b:a 192k \
    short-track.mp3 2>/dev/null

# 3. Drum loop simulation - simple low frequency pulses (8 seconds)
echo -e "  Creating ${GREEN}drum-loop.mp3${NC} (8s, low-freq pulses)..."
# Creates a simple 60Hz tone that pulses - simulates a kick drum
ffmpeg -y -f lavfi -i "sine=frequency=60:duration=8" \
    -af "volume=0.8,tremolo=f=2:d=0.9" \
    -ar 44100 -b:a 192k \
    drum-loop.mp3 2>/dev/null

# 4. Piano chords - layered sine waves simulating C major chord
echo -e "  Creating ${GREEN}piano-chords.mp3${NC} (10s, chord simulation)..."
ffmpeg -y -f lavfi -i "sine=frequency=261.63:duration=10" \
    -f lavfi -i "sine=frequency=329.63:duration=10" \
    -f lavfi -i "sine=frequency=392:duration=10" \
    -f lavfi -i "sine=frequency=523.25:duration=10" \
    -filter_complex "[0][1][2][3]amix=inputs=4:duration=first,volume=0.4,afade=t=out:st=9:d=1" \
    -ar 44100 -b:a 192k \
    piano-chords.mp3 2>/dev/null

# 5. Silence (3 seconds - for edge case testing)
echo -e "  Creating ${GREEN}silence.mp3${NC} (3s, silent audio)..."
ffmpeg -y -f lavfi -i "anullsrc=r=44100:cl=stereo" \
    -t 3 -b:a 192k \
    silence.mp3 2>/dev/null

# 6. Complex track - multiple frequencies changing over time
echo -e "  Creating ${GREEN}full-test.mp3${NC} (15s, complex test audio)..."
ffmpeg -y -f lavfi -i "sine=frequency=220:duration=15" \
    -f lavfi -i "sine=frequency=440:duration=15" \
    -f lavfi -i "sine=frequency=880:duration=15" \
    -filter_complex "[0][1][2]amix=inputs=3:duration=first,volume=0.4,tremolo=f=0.5:d=0.3" \
    -ar 44100 -b:a 192k \
    full-test.mp3 2>/dev/null

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Test Fixtures Generated!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Files created in $FIXTURES_DIR:"
ls -lh "$FIXTURES_DIR"/*.mp3 2>/dev/null || echo "  (no mp3 files found)"
echo ""
