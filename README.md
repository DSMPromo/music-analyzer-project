<br>
<br>

<p align="center">
  <img src="https://img.shields.io/badge/•-2.0-000000?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/•-MIT-000000?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/•-178_tests-000000?style=flat-square" alt="Tests">
</p>

<br>

<h1 align="center">
  Music Analyzer Pro
</h1>

<p align="center">
  <em>See your music. Understand your sound.</em>
</p>

<br>
<br>

<p align="center">
  An AI-powered platform that transforms how you analyze,<br>
  understand, and improve your music production.
</p>

<br>
<br>

---

<br>

## The Platform

Music Analyzer Pro brings professional-grade analysis tools to every producer. Whether you're mixing your first track or mastering for streaming platforms, understand exactly what's happening in your music.

<br>

### Visualize Everything

**Spectrogram** — Full-file visualization with stereo L/R display. See frequency content across time with iZotope RX-style coloring. Click anywhere to seek.

**Mix Analysis** — Automatic detection of muddy frequencies, masking issues, and resonances. Get actionable EQ recommendations.

**Loudness Timeline** — LUFS metering across your entire track. Color-coded for streaming platform targets.

<br>

### Detect Intelligently

**36 Instrument Types** — From kicks to ad-libs to risers. Frequency-filtered detection isolates each element precisely.

| Drums | Bass | Melodic | Vocals | FX |
|:-----:|:----:|:-------:|:------:|:--:|
| Kick | Sub | Piano | Lead | Riser |
| Snare | Bass | Guitar | Backing | Impact |
| Hi-Hat | Harmonics | Synth | Ad-lib | Drop |
| Clap | | Strings | Harmony | Stutter |
| Tom | | Brass | | Sweep |
| Perc | | Pluck | | |

<br>

**Advanced Processing Pipeline**

```
Audio → Filter → De-reverb → EQ → Compress → Detect
```

Each instrument type has custom processing presets for optimal detection.

<br>

### Separate & Convert

**Stem Separation** — Powered by Meta's Demucs. Split any track into drums, bass, vocals, and other. Optional 6-stem mode adds guitar and piano.

**MIDI Export** — Convert audio to MIDI using Spotify's Basic Pitch. Export detected rhythms and melodies for your DAW.

**Artifact Reduction** — Clean up separation artifacts with stem-specific spectral denoising. Adjustable from subtle to aggressive.

<br>

### Understand Deeply

**Chord Detection** — Real-time recognition with interactive piano display. Circle of Fifths visualization. Nashville notation.

**Advanced Chord Mode** — Toggle on for multi-instrument weighted detection. Fuses chroma from stems or extracts harmonic bands from full mix.

**AI Mix Engineer** — Multi-provider AI analysis with Engineer and Producer personas. Ask questions, get professional insights.

**Knowledge Lab** — Song structures, signal chains, frequency guides. Learn while you work.

<br>

### Advanced Chord Detection

<br>

**Two detection modes for different workflows:**

| Mode | Method | Best For |
|------|--------|----------|
| **Basic** | Single-source chromagram | Quick analysis, live playback |
| **Advanced** | Multi-instrument fusion | Stems, complex arrangements |

<br>

**How Advanced Mode Works**

```
Stems Available:
  Bass → Extract chroma → Weight by loudness
  Keys → Extract chroma → Weight by loudness
  Vocals → Extract chroma → Weight by loudness
  Other → Extract chroma → Weight by loudness
         ↓
  Weighted fusion → Template match → Smooth → Chord

No Stems (Full Mix):
  Audio → Harmonic bands → Extract chroma → Template match → Chord
```

<br>

**20+ Harmonic Instruments**

Each instrument has custom frequency ranges and priority weights:

| Category | Instruments | Frequency Range |
|----------|-------------|-----------------|
| **Keys** | Piano, Keys, Organ, Rhodes | 80Hz — 5kHz |
| **Synths** | Lead, Pad, Arp, Pluck | 100Hz — 8kHz |
| **Strings** | Guitar, Violin, Cello | 80Hz — 5kHz |
| **Bass** | Bass, Sub | 30Hz — 500Hz |
| **Vocals** | Lead, Backing, Harmony | 100Hz — 4kHz |

<br>

**Instrument Weighting**

Advanced mode calculates contribution from each source:

```
Piano:    ████████████░░ 85%  (high priority + loud)
Bass:     ██████████░░░░ 70%  (bass priority + loud)
Vocals:   ████░░░░░░░░░░ 28%  (lower priority)
Other:    ██░░░░░░░░░░░░ 15%  (residual)
```

Weights consider:
- Instrument priority (keys > bass > vocals)
- Loudness (louder = more influence)
- Spectral flatness (tonal > noisy)
- Transient score (sustained > percussive)

<br>

**25 Chord Templates**

| Type | Notes | Example |
|------|-------|---------|
| Major | 1, 3, 5 | C, E, G |
| Minor | 1, b3, 5 | C, Eb, G |
| Dominant 7 | 1, 3, 5, b7 | C, E, G, Bb |
| Major 7 | 1, 3, 5, 7 | C, E, G, B |
| Minor 7 | 1, b3, 5, b7 | C, Eb, G, Bb |
| Diminished | 1, b3, b5 | C, Eb, Gb |
| Augmented | 1, 3, #5 | C, E, G# |
| Sus2 | 1, 2, 5 | C, D, G |
| Sus4 | 1, 4, 5 | C, F, G |
| Add9 | 1, 3, 5, 9 | C, E, G, D |
| 6 | 1, 3, 5, 6 | C, E, G, A |
| 9 | 1, 3, 5, b7, 9 | C, E, G, Bb, D |
| Power | 1, 5 | C, G |

Plus: m6, mM7, dim7, half-dim7, 7sus4, m9, M9, 11, 13

<br>

**Chord Smoothing**

Hysteresis prevents flickering between similar chords:

```javascript
// Only switch chords when:
// 1. New chord has 15%+ higher confidence
// 2. Detected for 3+ consecutive frames
// 3. Stable for 200ms+ duration
```

<br>

**Toggle in UI**

```
┌─────────────────────────────────────┐
│ Chord Detector                      │
├─────────────────────────────────────┤
│ Advanced Mode  ○───●                │
│                                     │
│ Current: Cmaj7   Confidence: 87%    │
│                                     │
│ Instrument Contributions:           │
│ Piano   ████████████░░ 85%          │
│ Bass    ██████████░░░░ 70%          │
│ Vocals  ████░░░░░░░░░░ 28%          │
└─────────────────────────────────────┘
```

<br>

---

<br>

## AI Integration

<br>

**Free tier available.** No API key required to start.

<br>

| Provider | Models | Cost |
|----------|--------|------|
| **Google Gemini** | Gemini 2.0 Flash | Free |
| | Gemini 2.5 Pro | Pay per use |
| **OpenRouter** | GPT-4, Claude, Llama | Pay per use |

<br>

Use the built-in settings panel to configure your preferred provider:

```
Settings → API Provider → Choose Gemini or OpenRouter
```

<br>

**Two AI Personas**

*Engineer Mode* — Technical analysis. EQ curves, compression ratios, frequency conflicts, phase issues.

*Producer Mode* — Creative feedback. Arrangement ideas, energy flow, hook suggestions, reference matching.

<br>

**Conversation Memory**

Multi-turn chat with full context. Ask follow-up questions. The AI remembers your track analysis throughout the session.

<br>

---

<br>

## Get Started

<br>

**Requirements**

```
Node.js 18+    Python 3.11+    FFmpeg
```

<br>

**Install**

```bash
git clone https://github.com/yourusername/music-analyzer-project.git
cd music-analyzer-project
npm run setup
./start-services.sh
```

<br>

**Open**

```
http://localhost:56400
```

<br>

---

<br>

## Architecture

<br>

Five services work together seamlessly:

<br>

```
                    ┌─────────────────┐
                    │                 │
                    │   React UI      │
                    │   Port 56400    │
                    │                 │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │             │ │             │ │             │
       │   Express   │ │   Rhythm    │ │   Gemini    │
       │   :56404    │ │   :56403    │ │   :56401    │
       │             │ │             │ │             │
       └─────────────┘ └──────┬──────┘ └─────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │             │
                       │    Stem     │
                       │   :56402    │
                       │             │
                       └─────────────┘
```

<br>

| Service | Purpose |
|---------|---------|
| **React** | User interface |
| **Express** | MIDI generation, file conversion |
| **Rhythm** | Beat detection, instrument classification |
| **Gemini** | AI-powered mix analysis |
| **Stem** | Audio separation (Demucs) |

<br>

---

<br>

## API

<br>

### Rhythm Analyzer

<br>

**Detect Instruments**

```http
POST /detect-instruments

instrument_types: vocals,bass,sound_fx
use_dynamic_eq: true
use_compression: false
use_dereverb: false
```

<br>

**Get Filters**

```http
GET /instrument-filters
```

Returns 36 instrument types with frequency bands and processing presets.

<br>

**Self Test**

```http
GET /self-test
```

Validates all detection systems. 10 tests, 100% pass rate required.

<br>

### AI Analyzer

<br>

**Analyze**

```http
POST /analyze

model: gemini-2.5-pro
mode: engineer
```

<br>

**Chat**

```http
POST /chat

session_id: abc123
message: How can I improve the low end?
```

<br>

### Stem Separator

<br>

**Separate**

```http
POST /separate

model: htdemucs
artifact_reduction: 30
```

| Model | Stems | Description |
|-------|-------|-------------|
| `htdemucs` | 4 | Drums, bass, vocals, other |
| `htdemucs_ft` | 4 | Fine-tuned, better quality |
| `htdemucs_6s` | 6 | Adds guitar and piano |

<br>

**Download Stems**

```http
GET /stems/{job_id}/{filename}
```

<br>

### MIDI Generator

<br>

**Convert to MIDI**

```http
POST /api/generate-midi

onset_threshold: 0.5
frame_threshold: 0.3
```

Returns MIDI file with detected notes, velocities, and timing.

<br>

---

<br>

## Personal Knowledge Base

<br>

**Self-learning system that remembers what you love.**

<br>

### Your Favorites

Save your favorite instruments and get instant dial-in configurations:

```
"I love M1 Piano" → System remembers

Next session at 128 BPM:
  M1 Piano @ 128 BPM
  ├─ Delay: 351ms (dotted 1/8)
  ├─ Reverb Pre-delay: 29ms (natural)
  ├─ Reverb Decay: 937ms (2 beats)
  └─ Comp Release: 117ms (1/16 note)
```

<br>

### BPM-Synced Calculations

Every timing value calculated from your tempo:

| Setting | 120 BPM | 140 BPM |
|---------|---------|---------|
| Quarter note | 500ms | 428ms |
| Eighth note | 250ms | 214ms |
| Dotted 1/8 | 375ms | 321ms |
| Triplet 1/8 | 167ms | 143ms |

<br>

### AI Sound Design Assistant

Talk to the AI about your sound:

```
You: "I'm working on a house track, help me dial in the M1 piano"

AI: "For house at 124 BPM, here's your M1 Piano setup:
     - Delay: 363ms (dotted 1/8) for that classic groove
     - Pre-delay: 30ms to keep it upfront
     - Reverb: 968ms decay (2 beats) for space without mud
     - Sidechain from kick with 10ms attack..."
```

The AI remembers your preferences and gives exact values based on your BPM.

<br>

### 35+ Built-in Presets

<br>

**Serum**
| Preset | Type | Description |
|--------|------|-------------|
| Serum Bass | Bass | Modern wavetable bass |
| Serum Supersaw | Lead | Massive unison lead |
| Serum Pluck | Synth | Short percussive synth |
| Serum Pad | Pad | Lush atmospheric pad |
| Serum Growl | Bass | Aggressive dubstep bass |

<br>

**Massive**
| Preset | Type | Description |
|--------|------|-------------|
| Massive Bass | Bass | Classic Reese bass |
| Massive Lead | Lead | Cutting lead synth |
| Massive Wobble | Bass | Classic dubstep wobble |
| Massive Pluck | Synth | Punchy pluck synth |

<br>

**Sylenth1**
| Preset | Type | Description |
|--------|------|-------------|
| Sylenth1 Lead | Lead | Classic trance lead |
| Sylenth1 Supersaw | Lead | EDM supersaw stack |
| Sylenth1 Bass | Bass | Punchy synth bass |
| Sylenth1 Pluck | Synth | Bright pluck synth |
| Sylenth1 Pad | Pad | Warm analog-style pad |

<br>

**More Synths**
| Preset | Plugin | Description |
|--------|--------|-------------|
| Vital Modern Bass | Vital | Free Serum alternative |
| Nexus EDM Lead | Nexus | Big room house lead |
| Omnisphere Pad | Omnisphere | Cinematic texture |
| Diva Analog Lead | Diva | Vintage analog emulation |
| Phase Plant Texture | Phase Plant | Complex modular texture |
| Pigments FM Bass | Pigments | FM synthesis bass |

<br>

**Hardware Emulations**
| Preset | Emulates | Description |
|--------|----------|-------------|
| Juno-106 Pad | Roland Juno-106 | Classic 80s pad |
| Minimoog Bass | Moog Minimoog | Classic analog bass |
| DX7 E-Piano | Yamaha DX7 | Classic FM electric piano |
| Prophet-5 Brass | Sequential Prophet-5 | Classic poly synth brass |

<br>

**Keys & Instruments**
| Preset | Type | Description |
|--------|------|-------------|
| M1 Piano | Keys | Classic 80s/90s house piano |
| Rhodes | Keys | Warm electric piano |
| 808 Bass | Bass | Classic 808 with sustain |
| Lead Vocal | Vocals | Modern pop/R&B vocal chain |
| Acoustic Kit | Drums | Natural acoustic drums |

<br>

---

<br>

## Knowledge Lab

<br>

Learn while you work. Educational content built into the platform.

<br>

### Song Structures

Templates for every genre with section timing and energy curves:

| Genre | Sections | BPM Range |
|-------|----------|-----------|
| EDM/House | Intro → Build → Drop → Break → Drop → Outro | 124-128 |
| Pop | Intro → Verse → Pre → Chorus → Verse → Chorus → Bridge → Chorus | 100-130 |
| Hip-Hop | Intro → Verse → Hook → Verse → Hook → Bridge → Hook | 85-115 |
| K-Pop | Intro → Verse → Pre → Chorus → Dance Break → Bridge → Chorus | 100-140 |

<br>

### Music Theory

Interactive learning built into the chord detector:

- **Circle of Fifths** — Visual key relationships
- **Nashville Numbers** — Industry-standard notation (1, 4, 5, 6m)
- **Modal Theory** — Ionian through Locrian with example progressions
- **Chord Extensions** — 7ths, 9ths, suspended, altered

<br>

### Signal Chains

Professional processing chains you can learn and apply:

**Vocals** — HPF 80Hz → De-esser → Comp 3:1 → EQ → Reverb → Delay

**Drums** — Parallel comp → Transient shaper → Bus comp → Saturation

**Master** — EQ → Multiband → Limiter → Dither

<br>

### Rhythm Patterns

Grid notation for programming realistic drums:

- Genre-specific patterns (Four-on-floor, Boom-bap, Trap, Breakbeat)
- Swing percentages (50% straight → 67% triplet feel)
- Ghost note placement
- Humanization velocity curves

<br>

Keep Knowledge Lab synced with the backend:

```bash
./sync-knowledge-lab.sh          # Full sync
./sync-knowledge-lab.sh --test   # Validate only
./sync-knowledge-lab.sh --check  # Check if sync needed
```

<br>

---

<br>

## Specifications

<br>

### Spectrogram

| Parameter | Value |
|-----------|-------|
| FFT Size | 2048 |
| Hop Size | 512 |
| Range | 20Hz — 20kHz |
| Scale | Logarithmic |

<br>

### Loudness Targets

| Platform | LUFS | Peak |
|----------|------|------|
| Spotify | -14 | -1.0 dBTP |
| Apple Music | -16 | -1.0 dBTP |
| YouTube | -14 | -1.0 dBTP |
| Club | -6 to -9 | -0.3 dBTP |

<br>

### Problem Frequencies

| Issue | Range |
|-------|-------|
| Muddy | 200-400 Hz |
| Boxy | 400-800 Hz |
| Harsh | 2-5 kHz |
| Sibilant | 5-9 kHz |

<br>

---

<br>

## Development

<br>

**Test**

```bash
cd client && npm test
./test-services.sh
./sync-knowledge-lab.sh --test
```

<br>

**Standards**

- Functional components with hooks
- 2-space indentation
- Conventional commits

<br>

**Key Files**

```
CLAUDE.md              Development guide
sync-knowledge-lab.sh  Data synchronization
test-services.sh       Service validation
```

<br>

---

<br>

## Roadmap

<br>

- Real-time collaboration
- VST plugin
- Mobile app
- Cloud storage
- Batch processing

<br>

---

<br>

## Credits

<br>

Built with [Basic Pitch](https://github.com/spotify/basic-pitch), [Demucs](https://github.com/facebookresearch/demucs), [librosa](https://librosa.org/), and [Gemini](https://ai.google.dev/).

<br>

---

<br>
<br>

<p align="center">
  <strong>Made for music.</strong>
</p>

<br>

<p align="center">
  <sub>MIT License</sub>
</p>

<br>
<br>
