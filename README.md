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

### Understand Deeply

**Chord Detection** — Real-time recognition with interactive piano display. Circle of Fifths visualization. Nashville notation.

**AI Mix Engineer** — Gemini-powered analysis with Engineer and Producer personas. Ask questions, get professional insights.

**Knowledge Lab** — Song structures, signal chains, frequency guides. Learn while you work.

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

---

<br>

## Knowledge Lab

<br>

Educational content built into the platform:

<br>

**Song Structures** — EDM, Pop, Hip-Hop, K-Pop templates with section purposes and energy curves.

**Music Theory** — Modes, progressions, Nashville numbers. Learn the language of music.

**Rhythm Patterns** — Grid notation for every genre. Swing values. Humanization techniques.

**Signal Chains** — Professional processing chains for vocals, drums, and mastering.

<br>

Keep it synced:

```bash
./sync-knowledge-lab.sh
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
