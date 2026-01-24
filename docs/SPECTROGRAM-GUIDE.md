# Spectrogram Guide & Sensitivity Tuning

A practical guide to reading spectrograms and tuning detection sensitivity, tested with "Blinding Lights" by The Weeknd (171 BPM).

---

## Quick Reference

| Term | Meaning |
|------|---------|
| **Energy** | RMS amplitude (0.0 - 1.0) - higher = louder |
| **Quiet Bar** | Energy < 60% of median |
| **Sensitivity Boost** | Threshold multiplier for quiet sections |
| **HPSS** | Harmonic/Percussive Source Separation |

---

## 1. Reading Bar Energy Levels

The adaptive detection analyzes energy per bar to identify quiet sections.

### Blinding Lights Example

```
Bar  | Energy  | Status
-----|---------|--------
1    | 0.00255 | QUIET (intro)
2    | 0.00524 | QUIET
3    | 0.00687 | QUIET
...  |         |
8    | 0.00729 | QUIET
9    | 0.07191 | NORMAL (verse begins)
10   | 0.06969 | NORMAL
```

**Key insight**: Intro bars (1-8) have ~10x lower energy than main content. Standard detection misses hits here.

### Interpreting Energy Values

| Energy Range | Interpretation | Detection Behavior |
|--------------|----------------|-------------------|
| < 0.01 | Very quiet (intro/outro, breaks) | Needs sensitivity boost |
| 0.01 - 0.03 | Quiet (sparse arrangement) | May need boost |
| 0.03 - 0.08 | Normal (typical verse/chorus) | Standard thresholds work |
| > 0.08 | Loud (drops, builds) | May over-detect |

---

## 2. Sensitivity Boost Parameter

The `sensitivity_boost` parameter controls how much thresholds are lowered for quiet sections.

### How It Works

```
effective_threshold = base_threshold / sensitivity_boost
```

| Boost | Effect | Use Case |
|-------|--------|----------|
| 1.0 | No adjustment | Already detecting well |
| 1.5 | Light boost | Minor quiet sections |
| 2.0 | Standard boost (default) | Most quiet intros/outros |
| 3.0 | Strong boost | Very sparse/quiet sections |
| 4.0+ | Maximum sensitivity | Ambient/minimal tracks |

### Base Thresholds (before boost)

| Drum Type | Threshold | Notes |
|-----------|-----------|-------|
| Kick | 0.010 | Lowest threshold - most sensitive |
| Snare | 0.008 | |
| Clap | 0.006 | |
| Hi-Hat | 0.005 | |
| Perc | 0.004 | Highest sensitivity for quiet perc |

### Blinding Lights Results

With `sensitivity_boost=2.0` on quiet bars:

```
Standard thresholds:     Boosted thresholds:
Kick:  0.010      →      0.005
Snare: 0.008      →      0.004
Hi-Hat: 0.005     →      0.0025
```

This detected 8 new hits in the quiet intro that standard detection missed.

---

## 3. Reading Spectrogram Colors

### Color Map (iZotope RX style)

| Color | dB Range | Meaning |
|-------|----------|---------|
| Black/Dark Blue | < -60 dB | Silence/noise floor |
| Blue | -60 to -40 dB | Very quiet |
| Cyan/Teal | -40 to -25 dB | Quiet |
| Green | -25 to -15 dB | Moderate |
| Yellow | -15 to -6 dB | Loud |
| Orange/Red | > -6 dB | Very loud |

### Identifying Drum Types by Frequency

| Drum | Frequency Band | Visual Appearance |
|------|----------------|-------------------|
| **Kick** | 20-250 Hz (bottom) | Vertical lines at bottom, short duration |
| **Snare** | 150-2000 Hz (low-mid) | Vertical lines spanning low-mid range |
| **Hi-Hat** | 5000-15000 Hz (top) | Bright dots/lines at top of spectrogram |
| **Clap** | 1000-4000 Hz (mid) | Noisy vertical splash in mid range |
| **Perc** | 2000-8000 Hz (upper-mid) | Sharp transients in upper-mid |

### Example: Quiet Intro

```
Frequency ↑
15kHz |.......................|  ← No hi-hats in intro
 5kHz |.......................|
 2kHz |.....▪...▪...▪...▪.....|  ← Subtle perc/snare hits
 250Hz|.......................|  ← No kick in intro
 20Hz |.......................|
      └───────────────────────→ Time
            Bar 1-8 (quiet)
```

---

## 4. Using the Adaptive Detection Endpoint

### Basic Usage

```bash
# Detect only in quiet sections (auto-detect)
curl -X POST http://localhost:56403/detect-adaptive \
    -F "file=@track.wav" \
    -F "bpm=171" \
    -F "target_bars=quiet" \
    -F "sensitivity_boost=2.0"

# Detect in specific bars
curl -X POST http://localhost:56403/detect-adaptive \
    -F "file=@track.wav" \
    -F "bpm=171" \
    -F "target_bars=1,2,3,4,5,6,7,8" \
    -F "sensitivity_boost=2.5"

# Detect in all bars with adaptive thresholds
curl -X POST http://localhost:56403/detect-adaptive \
    -F "file=@track.wav" \
    -F "bpm=171" \
    -F "sensitivity_boost=1.5"
```

### Response Structure

```json
{
  "success": true,
  "total_bars": 129,
  "bars_scanned": 129,
  "quiet_bars": [1, 2, 3, 4, 5, 6, 7, 8],
  "median_bar_energy": 0.05366,
  "bar_energies": [
    {"bar": 1, "rms": 0.00255, "is_quiet": true, "relative_energy": 0.047},
    {"bar": 2, "rms": 0.00524, "is_quiet": true, "relative_energy": 0.098},
    ...
  ],
  "new_hits": [
    {
      "time": 2.456,
      "type": "snare",
      "bar": 2,
      "grid_position": 4,
      "energy": 0.0046,
      "is_quiet_bar": true,
      "source": "adaptive_detection"
    }
  ],
  "total_new_hits": 877,
  "hits_by_type": {
    "snare": 189,
    "hihat": 488,
    "perc": 196,
    "clap": 4
  }
}
```

---

## 5. Workflow: Detecting Quiet Sections

### Step 1: Run Standard Detection

```bash
curl -X POST http://localhost:56403/analyze-rhythm-ai \
    -F "file=@track.wav"
```

Check results. If hits are missing in intros/outros/breaks...

### Step 2: Check Bar Energies

```bash
curl -X POST http://localhost:56403/detect-adaptive \
    -F "file=@track.wav" \
    -F "bpm=171" \
    -F "target_bars=quiet" | jq '.bar_energies[:20]'
```

Look for bars with `is_quiet: true`.

### Step 3: Tune Sensitivity

If still missing hits, increase `sensitivity_boost`:

| Issue | Solution |
|-------|----------|
| Missing subtle snares in intro | Boost to 2.5-3.0 |
| Missing hi-hats in quiet section | Boost to 3.0+ |
| Getting false positives | Lower boost to 1.5 |
| Too many hits everywhere | Use `target_bars=quiet` to limit |

### Step 4: Merge Results

The `new_hits` array contains only NEW detections not in `existing_hits`. Merge with your main hit list in the frontend.

---

## 6. Test Script Usage

```bash
# Basic test (Blinding Lights)
./scripts/test-adaptive-detection.sh /path/to/blinding-lights.aif 171

# With specific bars
./scripts/test-adaptive-detection.sh track.wav 128 "1,2,3,4"

# With high sensitivity
./scripts/test-adaptive-detection.sh track.wav 140 quiet 3.0
```

---

## 7. Common Patterns by Genre

### Pop (e.g., Blinding Lights)

- Quiet intro (bars 1-8) with minimal percussion
- Full drums kick in at verse (bar 9+)
- May have quiet bridge section
- **Settings**: `target_bars=quiet`, `sensitivity_boost=2.0`

### EDM/House

- Build-ups often strip drums to just hi-hats
- Drops have heavy kick/snare
- **Settings**: Use specific bar targeting for breakdowns

### Hip-Hop/Trap

- 808 bass can mask kick detection
- Hi-hats often very subtle in verses
- **Settings**: May need boost of 2.5-3.0 for hi-hats

### Ambient/Chill

- Very sparse percussion throughout
- Need high sensitivity globally
- **Settings**: `sensitivity_boost=3.0+`, scan all bars

---

## 8. Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| No quiet bars detected | Track is consistently loud | Lower median threshold in code |
| Too many false positives | Boost too high | Lower sensitivity_boost |
| Missing obvious hits | Boost too low or wrong bands | Increase boost or check frequency filters |
| Wrong drum types | Frequency overlap | Adjust DRUM_FILTERS in rhythm_analyzer.py |
| Intro detected but bridge missed | Bridge not below 60% median | Use specific bar targeting |

---

## 9. Technical Details

### HPSS Preprocessing

Before energy analysis, audio is processed with HPSS to isolate percussive content:

```python
D = librosa.stft(y)
H, P = librosa.decompose.hpss(D, margin=3.0)
y_percussive = librosa.istft(P)
```

This removes bass lines, vocals, and synths that could affect energy readings.

### Quiet Bar Detection

```python
# Bar is "quiet" if below 60% of median energy
median_rms = np.median([b['rms'] for b in bar_energies])
is_quiet = bar_rms < median_rms * 0.6
```

### Grid Positions

Detection uses 16th-note grid (0-15 per bar):

| Position | Beat | Note |
|----------|------|------|
| 0 | 1 | Downbeat |
| 4 | 2 | |
| 8 | 3 | |
| 12 | 4 | |

---

*Last updated: 2026-01-24*
*Tested with: Blinding Lights (171 BPM, 180s duration)*
