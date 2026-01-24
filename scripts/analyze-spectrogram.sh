#!/bin/bash
# Spectrogram Analysis Script with Caching
# Usage: ./analyze-spectrogram.sh [audio_file] [--premium|--free|--cached]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CACHE_DIR="$PROJECT_DIR/data/spectrogram_cache"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default settings
AUDIO_FILE="/Users/iggy/Am/01 Blinding Lights.aif"
MODEL_TIER="free"  # free, standard, premium

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --premium)
            MODEL_TIER="premium"
            shift
            ;;
        --standard)
            MODEL_TIER="standard"
            shift
            ;;
        --free)
            MODEL_TIER="free"
            shift
            ;;
        --cached)
            MODEL_TIER="cached"
            shift
            ;;
        --help)
            echo "Usage: $0 [audio_file] [options]"
            echo ""
            echo "Options:"
            echo "  --free      Use Gemini 2.0 Flash (Free) - default"
            echo "  --standard  Use Gemini 2.5 Pro"
            echo "  --premium   Use Gemini 3 Pro (best accuracy)"
            echo "  --cached    Use cached analysis only (no API call)"
            echo ""
            echo "Cache location: $CACHE_DIR"
            exit 0
            ;;
        *)
            # Not an option, assume it's the audio file
            if [[ ! "$1" == --* ]]; then
                AUDIO_FILE="$1"
            fi
            shift
            ;;
    esac
done

# Get filename for cache key
BASENAME=$(basename "$AUDIO_FILE" | sed 's/\.[^.]*$//' | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
CACHE_FILE="$CACHE_DIR/${BASENAME}_analysis.json"

echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║       SPECTROGRAM ANALYSIS WITH AI                           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for cached analysis
if [ -f "$CACHE_FILE" ]; then
    echo -e "${GREEN}✓ Found cached analysis: $CACHE_FILE${NC}"

    if [ "$MODEL_TIER" = "cached" ]; then
        echo ""
        echo -e "${BLUE}Using cached analysis (no API call):${NC}"
        cat "$CACHE_FILE" | python3 -c "
import json, sys
d = json.load(sys.stdin)
print(f\"  File: {d.get('file', 'unknown')}\")
print(f\"  Artist: {d.get('artist', 'unknown')}\")
print(f\"  Analyzed: {d.get('analyzed_at', 'unknown')}\")
print(f\"  BPM: {d.get('bpm', 'unknown')}\")
print()
print('  Expected Hits:')
for drum, info in d.get('pattern_analysis', {}).items():
    total = info.get('expected_total', 0)
    pattern = info.get('pattern', 'unknown')
    print(f\"    {drum:8}: {total:>5} ({pattern})\")
"
        exit 0
    fi

    echo -e "${YELLOW}  To use cached data, run with --cached${NC}"
    echo ""
fi

# Model selection
case $MODEL_TIER in
    free)
        MODEL_ID="google/gemini-2.0-flash-exp:free"
        MODEL_NAME="Gemini 2.0 Flash (Free)"
        echo -e "${GREEN}Using: $MODEL_NAME (no cost)${NC}"
        ;;
    standard)
        MODEL_ID="google/gemini-2.5-pro-preview-05-06"
        MODEL_NAME="Gemini 2.5 Pro"
        echo -e "${YELLOW}Using: $MODEL_NAME (medium cost)${NC}"
        ;;
    premium)
        MODEL_ID="google/gemini-3-pro-preview"
        MODEL_NAME="Gemini 3 Pro"
        echo -e "${RED}Using: $MODEL_NAME (premium cost)${NC}"
        ;;
esac

echo ""

# Check if file exists
if [ ! -f "$AUDIO_FILE" ]; then
    echo -e "${RED}✗ Audio file not found: $AUDIO_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}[1/3] Generating spectrogram...${NC}"

# Generate spectrogram with Python
"$PROJECT_DIR/venv/bin/python" << PYEOF
import numpy as np
import librosa
import librosa.display
import matplotlib.pyplot as plt
import matplotlib
matplotlib.use('Agg')
import warnings
warnings.filterwarnings('ignore')

print("  Loading audio...")
y, sr = librosa.load("$AUDIO_FILE", sr=44100, duration=180)
print(f"  Loaded: {len(y)/sr:.1f}s @ {sr}Hz")

print("  Computing mel spectrogram...")
S = librosa.feature.melspectrogram(y=y, sr=sr, n_mels=128, fmax=16000, hop_length=512)
S_dB = librosa.power_to_db(S, ref=np.max)

fig, axes = plt.subplots(3, 1, figsize=(20, 12))

# Full spectrogram
ax1 = axes[0]
librosa.display.specshow(S_dB, sr=sr, hop_length=512, x_axis='time', y_axis='mel', ax=ax1, cmap='magma')
ax1.set_title('Full Track Mel Spectrogram')

# Low frequency (kicks, bass)
ax2 = axes[1]
S_low = librosa.feature.melspectrogram(y=y[:sr*30], sr=sr, n_mels=64, fmax=500, hop_length=256)
S_low_dB = librosa.power_to_db(S_low, ref=np.max)
librosa.display.specshow(S_low_dB, sr=sr, hop_length=256, x_axis='time', y_axis='mel', ax=ax2, cmap='magma')
ax2.set_title('Low Frequencies (20-500Hz) - KICKS & BASS')

# High frequency (hi-hats)
ax3 = axes[2]
S_high = librosa.feature.melspectrogram(y=y[:sr*30], sr=sr, n_mels=64, fmin=3000, fmax=16000, hop_length=256)
S_high_dB = librosa.power_to_db(S_high, ref=np.max)
librosa.display.specshow(S_high_dB, sr=sr, hop_length=256, x_axis='time', y_axis='mel', ax=ax3, cmap='magma')
ax3.set_title('High Frequencies (3-16kHz) - HI-HATS & CYMBALS')

plt.tight_layout()
plt.savefig('/tmp/spectrogram_for_ai.png', dpi=150, bbox_inches='tight')
plt.close()
print("  Saved: /tmp/spectrogram_for_ai.png")
PYEOF

if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Failed to generate spectrogram${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Spectrogram generated${NC}"

echo -e "${BLUE}[2/3] Sending to $MODEL_NAME for analysis...${NC}"

# Send to Gemini
"$PROJECT_DIR/venv/bin/python" << PYEOF
import requests
import base64
import json
import os

api_key = os.environ.get('OPENROUTER_API_KEY')
if not api_key:
    try:
        with open('$PROJECT_DIR/.gemini_settings.json') as f:
            settings = json.load(f)
            api_key = settings.get('openrouter_api_key')
    except:
        pass

if not api_key:
    print("  ERROR: No OpenRouter API key found!")
    exit(1)

with open('/tmp/spectrogram_for_ai.png', 'rb') as f:
    img_base64 = base64.b64encode(f.read()).decode('utf-8')

prompt = """Analyze this spectrogram. Return ONLY valid JSON (no markdown) with this structure:
{
  "bpm": <number>,
  "pattern_analysis": {
    "kick": {"pattern": "<description>", "hits_per_bar": <number>, "frequency_band_hz": [<low>, <high>]},
    "snare": {"pattern": "<description>", "hits_per_bar": <number>, "frequency_band_hz": [<low>, <high>]},
    "hihat": {"pattern": "<description>", "hits_per_bar": <number>, "frequency_band_hz": [<low>, <high>]},
    "clap": {"pattern": "<description>", "hits_per_bar": <number>, "frequency_band_hz": [<low>, <high>]},
    "perc": {"pattern": "<description>", "hits_per_bar": <number>}
  },
  "notes": "<any additional observations>"
}

Identify: kick pattern (4-on-floor?), snare/clap timing, hi-hat subdivision (8ths/16ths), any percussion."""

response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    },
    json={
        "model": "$MODEL_ID",
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/png;base64,{img_base64}"}},
                {"type": "text", "text": prompt}
            ]
        }],
        "max_tokens": 2048
    },
    timeout=120
)

if response.status_code == 200:
    result = response.json()
    content = result['choices'][0]['message']['content']

    # Try to parse as JSON
    try:
        # Remove markdown code blocks if present
        if content.startswith('\`\`\`'):
            content = content.split('\`\`\`')[1]
            if content.startswith('json'):
                content = content[4:]
        analysis = json.loads(content.strip())

        # Add metadata
        analysis['file'] = '$BASENAME'
        analysis['model'] = '$MODEL_ID'
        analysis['model_name'] = '$MODEL_NAME'

        # Calculate expected totals (assuming 129 bars)
        bars = 129
        for drum, info in analysis.get('pattern_analysis', {}).items():
            if 'hits_per_bar' in info:
                info['expected_total'] = bars * info['hits_per_bar']

        # Save to cache
        with open('$CACHE_FILE', 'w') as f:
            json.dump(analysis, f, indent=2)

        print("  Analysis complete!")
        print(json.dumps(analysis, indent=2))

    except json.JSONDecodeError:
        print("  Raw response (not valid JSON):")
        print(content)
else:
    print(f"  ERROR: {response.status_code}")
    print(response.text)
PYEOF

echo ""
echo -e "${GREEN}[3/3] Analysis cached to: $CACHE_FILE${NC}"
echo ""
echo -e "${CYAN}To use cached data next time, run:${NC}"
echo -e "  $0 --cached"
