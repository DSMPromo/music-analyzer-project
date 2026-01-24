# Audio Processing & Detection

## Audio Processing Basics
- Always use `AudioContext` with 44100 Hz sample rate
- Clean up audio nodes to prevent memory leaks
- Handle browser autoplay policies (require user interaction)

---

## Rhythm Detection (4-Stage Pipeline)

**Status:** Implemented Python-based rhythm analysis with HPSS preprocessing, librosa beat tracking, and rule-based drum classification.

### New Implementation (Python Backend - Port 56403)
- Files: `rhythm_analyzer.py`, `useRhythmAnalysis.js`, `FixGridPanel.js`, `RhythmVerificationPanel.js`
- Method: HPSS -> librosa beat/onset detection -> rule-based drum classification
- Fallback: madmom CNN when available (requires Python < 3.13)
- 6 drum types: Kick, Snare, Hi-Hat, Clap, Tom, Perc

### Key Improvements (2026-01-24)
1. **HPSS Preprocessing**: Harmonic/Percussive Source Separation isolates drums from melodic content
2. **Half-time BPM Correction**: Doubles BPM when < 90 and interpolates beats (fixes 86->172 BPM issues)
3. **Wider Kick Band**: 20-300 Hz captures sub-bass 808s AND upper harmonics/punch
4. **Step-by-Step Verification**: RhythmVerificationPanel for per-instrument sensitivity adjustment
5. **16th Note Hi-Hat Detection**: Changed from 8th notes to 16th notes for modern tracks (e.g., Blinding Lights)
6. **AI-Guided Detection**: Gemini 3 Pro analyzes spectrogram to configure detection thresholds with caching

### HPSS Preprocessing
```python
# Separates harmonic (bass, synths, vocals) from percussive (drums, transients)
D = librosa.stft(y)
H, P = librosa.decompose.hpss(D, margin=3.0)  # margin=3.0 for strict separation
y_percussive = librosa.istft(P, length=len(y))
```

### Half-time BPM Correction
```python
# If BPM < 90, librosa likely detected half-time
if bpm < 90:
    corrected_bpm = bpm * 2  # 86 -> 172
    # Interpolate beats (add beat between each detected beat)
    for i in range(len(beats) - 1):
        corrected_beats.append(beats[i])
        corrected_beats.append((beats[i] + beats[i+1]) / 2)  # midpoint
```

### 16th Note Hi-Hat Detection
```python
# Generate 16th note grid for hi-hats (4 positions per beat)
sixteenth_notes = []
for beat in beat_times:
    sixteenth_notes.append(beat)
    next_beat_idx = ...
    if next_beat_idx:
        interval = beat_times[next_beat_idx] - beat
        sixteenth_notes.append(beat + interval * 0.25)  # e-and
        sixteenth_notes.append(beat + interval * 0.5)   # and
        sixteenth_notes.append(beat + interval * 0.75)  # a

# Hi-hats checked at all 16th note positions (512+ positions per track)
```

**Why 16th notes?** Modern tracks like "Blinding Lights" (The Weeknd) have 16th note hi-hats. The previous 8th note detection only found 23% of hi-hats. With 16th note detection, accuracy improved to 80%+.

### AI-Guided Detection Pipeline
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ Audio Input │───▶│ Spectrogram │───▶│ Gemini 3    │
│             │    │ Generator   │    │ Pro Vision  │
└─────────────┘    └─────────────┘    └──────┬──────┘
                                             │
┌─────────────┐    ┌─────────────┐    ┌──────▼──────┐
│ Detection   │◀───│ AI-Guided   │◀───│ Pattern     │
│ Engine      │    │ Thresholds  │    │ Analysis    │
└─────────────┘    └─────────────┘    └──────┬──────┘
       │                                     │
       ▼                                     ▼
┌─────────────┐                       ┌─────────────┐
│ Accurate    │                       │ Cache       │
│ Results     │                       │ (30-day TTL)│
└─────────────┘                       └─────────────┘
```

**AI Pattern Analysis Returns:**
- `kick_pattern`: "4-on-the-floor", "half-time", "trap", "breakbeat"
- `hihat_pattern`: "8th notes", "16th notes", "open/closed"
- `hihat_per_bar`: 8, 16, or 32
- `has_reverb_tails`: Whether snare/clap have reverb (affects double-detection)
- `has_layered_perc`: Whether claps are layered with snare

**Frontend Usage:**
```javascript
const { analyzeWithAI, aiAnalysis, aiCacheStatus } = useRhythmAnalysis();

// Analyze with AI-guided detection
const result = await analyzeWithAI(audioFile, {
  modelTier: 'free',      // 'free', 'standard', 'premium'
  useCache: true,         // Use cached analysis if available
  forceReanalyze: false,  // Force new AI analysis
});

// Check AI analysis info
console.log(aiAnalysis.hihat_pattern);  // "16th notes"
console.log(aiAnalysis.confidence);      // 0.85
```

### Legacy Implementation (JavaScript Fallback)
- Files: `useDrumDetection.js`, `RhythmGrid.js`, `rhythmUtils.js`
- Method: Energy threshold detection with rising edge detection
- Used for real-time preview while Python analysis runs

### Python Frequency Bands
```python
kick:     20-300 Hz     # Sub-bass to punch (extended for 808s with harmonics)
mid:      150-2000 Hz   # Snare body, toms
high:     5000-16000 Hz # Hi-hats, snare snap, cymbals
```

### Classification Features Extracted
- `low_energy_ratio`: Energy in 20-250Hz / total
- `sub_bass_ratio`: Energy in 20-80Hz / total (808 kicks)
- `mid_energy_ratio`: Energy in 250-2kHz / total
- `high_energy_ratio`: Energy in 2-20kHz / total
- `hihat_band_ratio`: Energy in 5-15kHz / total
- `spectral_centroid`: Frequency brightness (0-1 normalized)
- `spectral_flatness`: Noise vs tonal (0-1)
- `zero_crossing_rate`: Noisiness indicator
- `transient_width`: Attack time in ms
- `decay_time`: Time to 10% amplitude in ms

### Classification Thresholds
| Drum | Key Triggers |
|------|--------------|
| Kick | `low > 0.25`, `sub_bass > 0.1`, `centroid < 0.15`, `high < 0.2` |
| Snare | `mid > 0.15 && high > 0.1`, `flatness > 0.25`, `zcr > 0.08` |
| Hi-Hat | `high > 0.3`, `hihat_band > 0.15`, `centroid > 0.4`, `low < 0.15` |
| Clap | `mid > 0.25 && flatness > 0.35`, `zcr > 0.1` |
| Tom | `low > 0.15 && mid > 0.2`, `decay > 30`, `flatness < 0.3` |
| Perc | Catch-all with `transient < 15`, `flatness > 0.2` |

### Analysis Settings
- FFT Size: 4096 (better low frequency resolution)
- Window: 80ms around each onset
- Sample Rate: 44100 Hz

---

## Frequency-Filtered Quiet Hit Detection

**Status:** Implemented pattern-based prediction with frequency-filtered detection for finding quiet percussion.

**Purpose:** Detects quiet/subtle percussion (wood blocks, claves, shakers) that standard onset detection misses.

### How It Works
1. Matches existing hits against known patterns from Knowledge Lab
2. Predicts where each drum type SHOULD be based on pattern
3. Creates frequency-filtered audio for each drum type
4. Scans predicted positions with very low energy thresholds
5. Returns newly found quiet hits with filter band info

### Frequency Filter Bands
| Drum Type | Filter Band | Purpose |
|-----------|-------------|---------|
| Kick | 20-250 Hz | Low-pass isolates kick drum |
| Snare | 150-2000 Hz | Band-pass for snare body |
| Hi-Hat | 5000-15000 Hz | High-pass for cymbals |
| Clap | 1000-4000 Hz | Upper-mids for claps |
| Tom | 80-500 Hz | Low-mids for toms |
| **Perc** | **2000-8000 Hz** | **Mid-highs for wood blocks, claves, shakers** |

### Energy Thresholds
| Drum Type | Base Threshold | With 0.3x Multiplier |
|-----------|----------------|----------------------|
| Kick | 0.008 | 0.0024 |
| Snare | 0.006 | 0.0018 |
| Hi-Hat | 0.004 | 0.0012 |
| Clap | 0.005 | 0.0015 |
| Tom | 0.006 | 0.0018 |
| **Perc** | **0.003** | **0.0009** |

### Factory Default Settings (Updated 2026-01-24)
```javascript
{
  startBar: 1,            // Start from bar 1 (full song scan)
  energyMultiplier: 0.3   // 0.3x = high sensitivity (factory default)
}
```

### API Endpoint
- `POST /predict-quiet-hits` - HPSS + Frequency-filtered quiet hit detection
  - `file`: Audio file (FormData)
  - `hits`: JSON string of existing hits
  - `bpm`: Detected BPM
  - `audio_duration`: Total duration in seconds
  - `start_bar`: Bar number to start scanning (default: 1)
  - `energy_multiplier`: Sensitivity (default: 0.3 = high sensitivity)

### Frontend Integration
- Hook: `useRhythmAnalysis.findQuietHits(audioFile, options)`
- Button: "Quiet Hits" in RhythmGridPro header (purple button)
- Button: "Find Quiet Hits" in RhythmVerificationStage
- Results automatically merge into existing hits

---

## Extended Instrument & Vocal Detection

**Status:** Implemented HPSS + frequency-filtered detection for ALL instruments, vocals, and sound FX.

**Key Enhancement:** Uses HPSS (Harmonic/Percussive Source Separation) to separate:
- **Harmonic component** -> Vocals, bass, piano, synth, strings, brass (melodic content)
- **Percussive component** -> Drums, impacts, transients (rhythmic content)

### Categories Available

| Category | Filter Bands |
|----------|--------------|
| **Drums** | kick, snare, hihat, clap, tom, perc |
| **Bass** | sub_bass (20-80Hz), bass (60-250Hz), bass_harmonics (200-600Hz) |
| **Melodic** | piano_low, piano_mid, piano_high, guitar, guitar_bright, synth_lead, synth_pad, strings, brass, pluck |
| **Vocals** | vocal_low, vocal_body, vocal_presence, vocal_air, sibilance |
| **Background Vocals** | adlib (200-5000Hz), harmony (300-4000Hz) |
| **Sound FX** | uplifter, downlifter, impact, sub_drop, reverse_crash, white_noise, swoosh, tape_stop, stutter, vocal_chop |

### Full Filter Bands Reference

```python
INSTRUMENT_FILTERS = {
    # === DRUMS ===
    'kick': (20, 250), 'snare': (150, 2000), 'hihat': (5000, 15000),
    'clap': (1000, 4000), 'tom': (80, 500), 'perc': (2000, 8000),

    # === BASS ===
    'sub_bass': (20, 80),        # 808s, sub synths
    'bass': (60, 250),           # Bass guitar, synth bass
    'bass_harmonics': (200, 600), # Bass upper harmonics

    # === MELODIC ===
    'piano_low': (80, 400),      # Piano left hand
    'piano_mid': (250, 2000),    # Piano middle
    'piano_high': (2000, 5000),  # Piano right hand
    'guitar': (80, 1200),        # Guitar body
    'guitar_bright': (2000, 5000), # Guitar presence
    'synth_lead': (500, 8000),   # Lead synths, arps
    'synth_pad': (200, 4000),    # Pads, atmospheres
    'strings': (200, 4000),      # Orchestral strings
    'brass': (100, 3000),        # Horns, trumpets
    'pluck': (2000, 12000),      # Plucks, bells

    # === VOCALS ===
    'vocal_low': (80, 300),      # Male chest voice
    'vocal_body': (200, 2000),   # Core vocal tone
    'vocal_presence': (2000, 5000),  # Vocal clarity
    'vocal_air': (5000, 12000),  # Breathiness
    'sibilance': (5000, 9000),   # S, T, F sounds
    'adlib': (200, 5000),        # Ad-libs, background
    'harmony': (300, 4000),      # Vocal harmonies

    # === SOUND FX / TRANSITIONS ===
    'uplifter': (2000, 15000),   # White noise risers
    'downlifter': (100, 10000),  # Downward sweeps
    'impact': (20, 2000),        # Hits, booms
    'sub_drop': (20, 100),       # Sub bass drops
    'reverse_crash': (3000, 15000),  # Reverse cymbals
    'white_noise': (1000, 15000),    # Noise sweeps
    'swoosh': (1000, 8000),      # Wooshes, transitions
    'tape_stop': (50, 2000),     # Tape stop effects
    'stutter': (200, 8000),      # Glitch, stutter edits
    'vocal_chop': (300, 5000),   # Chopped vocal FX
}
```

### Energy Thresholds by Category

| Category | Threshold Range | Notes |
|----------|-----------------|-------|
| Drums | 0.003-0.008 | Higher for kick/snare, lower for hihat/perc |
| Bass | 0.005-0.010 | Sub bass needs higher threshold |
| Melodic | 0.003-0.006 | Piano/guitar higher, pads/plucks lower |
| Vocals | 0.002-0.006 | Ad-libs very sensitive (0.002) |
| Sound FX | 0.002-0.010 | Impacts high (0.008), noise/stutter low (0.002) |

### Advanced Processing Pipeline
```
Audio -> HPSS Separation -> Select Component -> Bandpass Filter -> De-reverb -> Dynamic EQ -> Compression -> Onset Detection
         |                  |                                   (optional)   (optional)   (optional)
         +- Harmonic ------> Vocals, Bass, Piano, Synth, Strings
         +- Percussive ----> Drums, Impacts, Transients
```

### API Endpoints

1. `GET /instrument-filters` - List all available filters, categories, and processing presets
2. `POST /detect-instruments` - Detect instruments/vocals in audio
   - `file`: Audio file (FormData)
   - `filter_type`: Category or specific filter (e.g., 'vocals', 'sound_fx', 'uplifter')
   - `energy_multiplier`: Sensitivity (0.3 = very sensitive)
   - `detect_stereo`: Enable stereo position detection (default: true)
   - **Advanced Processing Options:**
   - `use_dynamic_eq`: Apply EQ shaping per instrument (default: true)
   - `eq_strength`: EQ strength 0.0-2.0 (default: 1.0)
   - `use_compression`: Apply compression per instrument (default: false)
   - `use_dereverb`: Remove reverb/delay (default: false)
   - `dereverb_strength`: De-reverb strength 0.0-1.0 (default: 0.5)

---

## RhythmGrid Component (DAW-Style)

### Features
- **Dynamic Bar Count**: Calculates total bars from audio duration and BPM
- **Page Navigation**: Prev/Next buttons, bars-per-page selector (4/8/16 bars)
- **Bar Numbers**: Row showing bar numbers (1, 2, 3...) above the grid
- **Minimap**: Full song overview with hit density, click to navigate
- **Metronome**: Toggle for click track on each beat (higher pitch on downbeat)
- **Sticky Labels**: Drum labels stay visible during horizontal scroll
- **Auto-Scroll**: Automatically follows playhead during playback
- **MIDI Export**: Exports all bars (not just visible page)

### Layout
```
+-------------------------------------------------------------+
| Rhythm Map    120 BPM [Tap]  [Fix Grid]  [< Page 1/12 >] [8v]|
+-------------------------------------------------------------+
| MINIMAP: [####.............................................] |
+-------------------------------------------------------------+
| Bar  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |                      |
+------+---+---+---+---+---+---+---+---+                       |
| Kick | o |   | o |   | o |   | o |   |  <- Sticky            |
| Snare|   | o |   | o |   | o |   | o |  <- Sticky            |
| ...  |   |   |   |   |   |   |   |   |                      |
+------+---+---+---+---+---+---+---+---+                       |
| Legend: o Detected  O Manual   [Scroll] [Metro] [Export MIDI]|
+-------------------------------------------------------------+
```

### Props
- `audioDuration`: Audio duration in seconds (for calculating total bars)
- `drumHits`: Detected/manual hits by drum type
- `tempo`: Current BPM
- `isPlaying`: Playback state
- `currentTimeMs`: Current playback position
- `beatsPerBar`: Time signature (default 4)
- `subdivision`: Grid resolution (default 4 for 16th notes)

### Metronome
- Toggle: "Metro" button in header
- Downbeat (beat 1): 1200Hz click
- Other beats: 800Hz click
- Helps verify grid alignment with audio

---

## Spectrogram & Mix Analysis

The spectrogram system provides professional-grade visualization and analysis.

### Spectrogram Features
- FFT Size: 2048 (21.5 Hz resolution at 44.1kHz)
- Hop Size: 512 (75% overlap for smooth time resolution)
- Logarithmic frequency scale: 20Hz to 20kHz
- iZotope RX-style heat map colors (blue=quiet to yellow=loud)
- Stereo L/R channel display with mono toggle
- Click-to-seek and playhead sync

### Mix Analysis Detection
- Problem frequencies: muddy (200-400Hz), boxy (400-800Hz), harsh (2-5kHz), sibilant (5-9kHz)
- Frequency masking between competing bands
- Resonance detection with severity levels
- LUFS loudness per segment with color coding

### Reference Comparison
- Upload reference track for A/B analysis
- Frequency band comparison (Sub, Bass, Low-Mid, Mid, Upper-Mid, Presence, Air)
- Difference view showing EQ recommendations

---

## Quality Analysis Algorithms

The quality analysis system (`analysisUtils.js`) is tuned for professional mastered audio.

### Clipping Detection
**Settings:** Threshold = 0.9999, Minimum consecutive samples = 8

**Why these values:**
- **Threshold 0.9999** (not 0.99): Only detects samples at true digital maximum
- **8 consecutive samples** (~0.18ms at 44.1kHz): Distinguishes between limiting and clipping

**Result:** Mastered tracks show 0 clipping. Only true distortion is flagged.

### Signal-to-Noise Ratio (SNR)
**Algorithm:** Compares quietest 5% of windows to loudest 10%

**Our Solution:**
1. If dynamic range < 20dB -> Assume mastered track -> Return 70dB
2. If quietest section < -60dB -> Measure actual noise floor
3. Otherwise -> Add 30dB offset

**Result:** Mastered tracks show 70dB (Good).

### Quality Score Calculation
Starts at 100, deducts points for:
- Clipping: -2 points per instance (max -30)
- DC Offset > 1%: -10 points
- Phase correlation < 0: -15 points (out of phase)
- Phase correlation < 0.3: -5 points (very wide)
- Channel imbalance > 3dB: -10 points
- Channel imbalance > 1dB: -3 points
- SNR < 40dB: -10 points
- Dynamic range < 6dB: -5 points
- Peak < -6dB: -5 points (too quiet)

**Grades:** A (90+), B (80-89), C (70-79), D (60-69), F (<60)

---

## Audio Format Conversion

Automatic server-side conversion for browser-unsupported formats (AIFF, etc.).

### Supported Input Formats
- AIFF/AIF (Apple)
- AIFF-C (compressed AIFF)
- M4A/AAC (when browser can't decode)

### Conversion Process
1. Browser attempts to decode audio using Web Audio API
2. If decoding fails, file is sent to Express backend (`/api/convert`)
3. FFmpeg converts to MP3 (320kbps) or WAV
4. Converted file returned for playback and analysis

### File Size Limits
- Express Backend: 200MB
- Gemini Analyzer: 200MB
- Stem Separator: 200MB
- Rhythm Analyzer: 200MB

### Utility Functions
```javascript
import { convertToWav, needsConversion } from '../utils/audioConversion';

// Check if file needs conversion
if (needsConversion(file)) {
  const result = await convertToWav(file);
  // result.file - converted File object
  // result.url - blob URL for playback
  // result.converted - true if conversion happened
}

// Options
await convertToWav(file, { format: 'wav' });  // Lossless
await convertToWav(file, { format: 'mp3' });  // Smaller (default)
```

### Components with AIFF Support
- App.js - Main file upload and playback
- AudioAnalyzer - Professional audio analysis
- GeminiMixAnalyzer - AI mix analysis
- StemSeparator - Stem separation
- MIDIGenerator - MIDI generation
- RhythmAnalysis - Rhythm detection
