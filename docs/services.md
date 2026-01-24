# Backend Services

## Port Configuration
- **React Client**: Port 56400 (http://localhost:56400)
- **Gemini Mix Analyzer**: Port 56401 (http://localhost:56401)
- **Stem Separator**: Port 56402 (http://localhost:56402)
- **Rhythm Analyzer**: Port 56403 (http://localhost:56403)
- **Express Backend**: Port 56404 (http://localhost:56404)
- **Reserved Ports**: 56400-56411 (12 ports for services)

---

## Gemini Mix Analyzer

AI-powered mix analysis using Google's Gemini API or OpenRouter (multi-provider).

### Setup
```bash
# Install Python dependencies
pip install -r config/requirements-gemini.txt

# Option 1: Use Google Gemini directly
export GOOGLE_API_KEY="your_google_api_key"

# Option 2: Use OpenRouter (recommended - access to multiple models)
export OPENROUTER_API_KEY="your_openrouter_api_key"

# Start the analyzer service
./venv/bin/python gemini_analyzer.py
```

### Features
- Two-column layout: controls on left, chat on right
- WaveSurfer waveform with drag-to-select region analysis
- Model selection dropdown with multiple providers
- Engineer vs Producer mode toggle with different AI personas
- Multi-turn chat conversations with session persistence
- Settings persistence to `.gemini_settings.json` (survives restarts)
- Sends spectrogram image + audio metrics to AI for analysis
- Calculates LUFS, true peak, crest factor, stereo correlation, spectral centroid
- Returns structured feedback: summary, issues with fixes, commercial readiness
- Segment presets: Full Track, Intro, Verse, Chorus, Drop, Outro, Custom

### Available Models (via OpenRouter)
- Gemini 3 Pro (Recommended)
- GPT-5.2 / GPT-5.2 Chat
- Gemini 2.5 Pro
- Gemini 2.0 Flash (Free)
- Claude 3.5 Sonnet / Claude 3 Opus
- Llama 3.2 90B Vision

### Engineer Mode Presets
- Full Technical, Low End, Dynamics, Translation, Vocals, Stereo Image, Master Ready

### Producer Mode Presets
- Arrangement, Vibe & Energy, Hooks & Melody, Production Ideas, Layer Suggestions, Reference Match

### API Endpoints
- `POST /analyze` - Analyze audio file (supports model, mode, session_id params)
- `POST /chat` - Send follow-up message in existing session
- `DELETE /chat/{session_id}` - Clear chat session
- `GET /health` - Health check
- `GET /models` - List available models
- `GET /settings` - Get current API settings
- `POST /settings` - Update API settings (provider, API keys, default model)

### Session Management
- Sessions expire after 30 minutes of inactivity
- Each analysis creates a new session ID
- Follow-up questions maintain conversation context
- New file upload clears the session
- Settings persist to file across restarts

---

## Rhythm Analyzer

Python-based rhythm detection using HPSS preprocessing, librosa beat tracking, and rule-based drum classification.

### Setup
```bash
# Install Python dependencies
pip install -r config/requirements-rhythm.txt

# Start the analyzer service (port 56403)
./venv/bin/python rhythm_analyzer.py
```

### Features
- **4-stage pipeline**: HPSS -> Beat detection -> Onset detection -> Drum classification
- **HPSS Preprocessing**: Isolates percussive content from harmonic (bass, synths, vocals)
- **Half-time BPM Correction**: Auto-doubles BPM when < 90 and interpolates beats
- librosa for beat/onset detection (madmom CNN when Python < 3.13)
- Rule-based drum classification with 10 acoustic features
- Swing detection and grid quantization
- Fix Grid panel for manual BPM/downbeat/swing adjustment
- **Step-by-step Verification Panel** for per-instrument sensitivity adjustment
- **Frequency-filtered quiet hit detection** for finding quiet percussion
- **Extended instrument/vocal/Sound FX detection** (36 instrument types)
- **Advanced processing**: Dynamic EQ, Compression, De-reverb
- **Self-validation tests** for all detection features

### API Endpoints
- `POST /analyze-rhythm` - Full pipeline analysis
- `POST /analyze-rhythm-ai` - Beat-aligned drum classification with HPSS
- `POST /analyze-rhythm-steps` - Step-by-step verification analysis
- `POST /apply-verified-hits` - Apply user-verified hits to grid
- `POST /detect-beats` - BPM + beat times + downbeats only
- `POST /classify-hits` - Classify provided onset times
- `POST /quantize-grid` - Swing-aware grid quantization
- `POST /shift-downbeat` - Shift downbeat position
- `POST /match-pattern` - Match hits against Knowledge Lab patterns
- `POST /predict-quiet-hits` - Frequency-filtered quiet hit detection
- `POST /detect-instruments` - Extended instrument/vocal/FX detection
- `POST /analyze-reverb-delay` - Reverb/delay analysis with RT60, stereo width, delay echoes
- `POST /analyze-frequency-bands` - Frequency band analysis for AI tuning
- `GET /instrument-filters` - List all filter bands and categories
- `GET /self-test` - Run all self-validation tests
- `GET /validate-detection/{instrument}` - Test specific instrument detection
- `GET /health` - Health check with method availability
- `GET /available-methods` - List available analysis methods

### Drum Classification
| Type | Frequency Band | Detection Notes |
|------|----------------|-----------------|
| Kick | 20-300 Hz | Extended to capture 808 harmonics and punch |
| Snare | 150-2000 Hz | Snare body with mid presence |
| Hi-Hat | 5000-16000 Hz | High frequencies for cymbals |
| Clap | 150-2000 Hz | Mid frequencies, high spectral flatness |
| Tom | 80-500 Hz | Low-mids, longer decay |
| Perc | Catch-all | Short transients, noise-like |

### Frontend Integration
- `useRhythmAnalysis.js` hook orchestrates Python analysis
- `RhythmVerificationPanel.js` - Step-by-step verification with sensitivity sliders
- Runs in parallel with JS-based `useDrumDetection` for instant preview
- Python results replace JS results when complete
- Fix Grid button opens correction panel (BPM, downbeat, swing)
- **Verify button** opens step-by-step verification panel
- **Find Quiet Hits button** uses frequency filtering to detect quiet percussion
- Confidence-based opacity for detected hits

---

## Reverb/Delay Analysis

Analyze audio to estimate reverb and delay characteristics for matching reference tracks.

### Endpoint
`POST /analyze-reverb-delay`

### Features
- **RT60 Estimation**: Reverb decay time using Schroeder integration (T20/T10 extrapolation)
- **Stereo Width Analysis**: Cross-correlation based width and L/R balance measurement
- **Delay Echo Detection**: Autocorrelation peak finding for discrete delay times
- **Pre-delay Estimation**: Onset envelope analysis for reverb pre-delay
- **Section Analysis**: Analyze reverb variations throughout the track
- **Plugin Recommendations**: Suggests appropriate plugins based on detected characteristics

### Response Structure
```json
{
  "success": true,
  "duration": 180.0,
  "is_stereo": true,
  "global": {
    "stereo": {"correlation": 0.7, "width": 0.3, "l_r_balance": 0.0},
    "rt60_seconds": 1.2,
    "rt60_description": "Ambient (live room)",
    "delay": {"detected": true, "primary_delay_ms": 250, "primary_strength": 0.15},
    "predelay_ms": 15,
    "reverb_character": "Hall/chamber"
  },
  "sections": [...],
  "recommendations": {
    "reverb": {
      "decay_time": "1.20s",
      "predelay": "15ms",
      "width": "30%",
      "suggested_plugins": ["Valhalla Vintage Verb", "FabFilter Pro-R"]
    },
    "delay": {"delay_time": "250ms", "feedback": "10%", "mix": "20-30%"}
  }
}
```

### Reverb Classification
| RT60 | Width | Classification |
|------|-------|----------------|
| < 0.3s | any | Very dry (booth) |
| 0.3-0.6s | < 30% | Dry (treated room) |
| 0.6-1.0s | < 60% | Medium (studio room) |
| 1.0-1.5s | any | Ambient (live room) |
| 1.5-2.5s | > 50% | Long (hall/chamber) |
| > 2.5s | > 50% | Very long (cathedral) |

---

## Stem Separator

Audio stem separation using Meta's Demucs with optional artifact reduction.

### Setup
```bash
# Install Python dependencies
pip install -r config/requirements-stem.txt

# Start the service (port 56402)
./venv/bin/python stem_separator.py
```

### Features
- Demucs-based stem separation (drums, bass, vocals, other)
- Optional 6-stem mode (adds guitar + piano)
- Artifact reduction using spectral denoising (noisereduce)
- MIDI generation per stem
- Play/download individual stems

### Models Available
| Model | Stems | Description |
|-------|-------|-------------|
| `htdemucs` | 4 | Default model (drums, bass, vocals, other) |
| `htdemucs_ft` | 4 | Fine-tuned, slightly better quality |
| `htdemucs_6s` | 6 | Adds guitar and piano stems |

### Artifact Reduction
Reduces separation artifacts using stem-specific spectral denoising:
- **0% (Off)**: No processing, original Demucs output
- **1-30% (Light)**: Subtle cleanup, preserves detail
- **31-60% (Medium)**: Balanced reduction
- **61-100% (Heavy)**: Aggressive, may affect quality

Stem-specific settings:
- **Vocals**: Preserves formants, focuses on high-freq artifacts
- **Drums**: Short time windows to preserve transients
- **Bass**: Larger FFT for better low-frequency resolution
- **Other**: Balanced settings

### API Endpoints
- `POST /separate` - Start separation job (params: model, artifact_reduction)
- `GET /jobs/{job_id}` - Get job status
- `GET /stems/{job_id}/{filename}` - Download stem file
- `DELETE /jobs/{job_id}` - Cleanup job files
- `GET /models` - List available models
- `GET /health` - Health check

### Frontend Component (`StemSeparator.js`)
- Model selection (4-stem vs 6-stem)
- Artifact reduction slider (0-100%)
- Progress display during separation
- Play/pause individual stems
- Download stems as MP3
- Generate MIDI per stem

---

## Ticket Management System

Integrated issue tracking system for bugs, feature requests, and improvements.

### Architecture
```
+-----------------------------------------------------------+
|  Frontend (React)           |  Backend (Express)          |
|  - TicketManager.js         |  - server.js (/api/tickets) |
|  - Header badge             |  - JSON file persistence    |
|  - Create/Update/Delete     |  - data/tickets.json        |
+-----------------------------------------------------------+
                                      |
                                      v
+-----------------------------------------------------------+
|  Backup System (Shell Scripts)                             |
|  - scripts/backup/backup-tickets.sh   -> JSON + CSV backups       |
|  - scripts/backup/restore-tickets.sh  -> Restore from backup      |
|  - scripts/backup/verify-tickets.sh   -> Database integrity check |
|  - backups/tickets_*.json      -> Timestamped JSON backups |
|  - backups/tickets_*.csv       -> Timestamped CSV exports  |
+-----------------------------------------------------------+
```

### Database Schema
```json
{
  "tickets": [
    {
      "id": "TICKET-001",
      "title": "Issue title",
      "description": "Detailed description",
      "priority": "Critical|High|Medium|Low",
      "component": "Chord Detection|Rhythm Detection|Grid/Timeline|...",
      "status": "OPEN|IN_PROGRESS|REVIEW|RESOLVED|WONTFIX",
      "created": "2026-01-23",
      "updated": "2026-01-24",
      "resolved": "2026-01-24",
      "steps": "Steps to reproduce",
      "expected": "Expected behavior",
      "actual": "Actual behavior",
      "rootCause": "Root cause analysis",
      "resolution": "How it was fixed",
      "notes": [{ "text": "...", "timestamp": "..." }],
      "relatedIncidents": ["INCIDENT-001"]
    }
  ],
  "nextId": 6
}
```

### API Endpoints (Port 56404)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tickets` | List all tickets (filter by status, priority, component) |
| GET | `/api/tickets/:id` | Get single ticket |
| GET | `/api/tickets/stats/summary` | Get ticket statistics |
| POST | `/api/tickets` | Create new ticket |
| PUT | `/api/tickets/:id` | Update ticket |
| POST | `/api/tickets/:id/notes` | Add note to ticket |
| DELETE | `/api/tickets/:id` | Delete ticket |

### Backup Scripts
```bash
# Create backup (JSON + CSV)
./scripts/backup/backup-tickets.sh

# List available backups
./scripts/backup/restore-tickets.sh --list

# Restore from latest backup
./scripts/backup/restore-tickets.sh --latest

# Restore from specific backup
./scripts/backup/restore-tickets.sh backups/tickets_20260124.json

# Restore from CSV
./scripts/backup/restore-tickets.sh --csv backups/tickets.csv

# Verify database integrity
./scripts/backup/verify-tickets.sh
```

### Components
- `COMPONENTS`: Chord Detection, Rhythm Detection, Grid/Timeline, Audio Analysis, Stem Separation, MIDI Export, UI/UX, Performance, API/Backend, General
- `PRIORITIES`: Critical, High, Medium, Low
- `STATUSES`: OPEN, IN_PROGRESS, REVIEW, RESOLVED, WONTFIX

### Files
- `client/src/components/ticket/TicketManager.js` - React UI component
- `server.js` - API endpoints (/api/tickets/*)
- `data/tickets.json` - Database file
- `scripts/backup/backup-tickets.sh` - Backup script
- `scripts/backup/restore-tickets.sh` - Restore script
- `scripts/backup/verify-tickets.sh` - Verification script
- `backups/` - Backup storage directory
