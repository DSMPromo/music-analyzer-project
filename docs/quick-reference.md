# Quick Reference

## Run Tests
```bash
cd music-analyzer-project/client && npm test
```

---

## Validate Services

Run the validation script to check all services and dependencies:
```bash
cd music-analyzer-project
./test-services.sh
```

The validation script checks:
1. **System Dependencies** - FFmpeg, Node.js, Python, yt-dlp
2. **Service Health** - All 5 services responding
3. **API Endpoints** - Conversion, models, methods APIs
4. **Python Environment** - venv, librosa, demucs, noisereduce
5. **Frontend Tests** - All React component tests

---

## Sync Knowledge Lab

Keep the Knowledge Lab data synchronized with the rhythm analyzer backend:
```bash
cd music-analyzer-project
./sync-knowledge-lab.sh           # Full sync: validate, fetch, update, test
./sync-knowledge-lab.sh --test    # Just run self-validation tests
./sync-knowledge-lab.sh --check   # Check if sync is needed
```

---

## Start Development

### Option 1: Use the startup script (recommended)
```bash
cd music-analyzer-project
./start-services.sh    # Starts all 5 services
./stop-services.sh     # Stops all services
```

The script will:
1. Check system dependencies (FFmpeg, Node, Python)
2. Create/update Python virtual environment
3. Install all dependencies
4. Stop any existing services on ports 56400-56404
5. Start all services with logs in `./logs/`

### Option 2: Start services manually
```bash
# Terminal 1: React Frontend (port 56400)
cd music-analyzer-project/client && PORT=56400 npm start

# Terminal 2: Gemini Analyzer Backend (port 56401)
cd music-analyzer-project && ./venv/bin/python gemini_analyzer.py

# Terminal 3: Stem Separator (port 56402)
cd music-analyzer-project && ./venv/bin/python stem_separator.py

# Terminal 4: Rhythm Analyzer Backend (port 56403)
cd music-analyzer-project && ./venv/bin/python rhythm_analyzer.py

# Terminal 5: Express Backend (port 56404)
cd music-analyzer-project && node server.js
```

---

## Build Production
```bash
cd music-analyzer-project && npm run build
```

---

## Install Dependencies
```bash
cd music-analyzer-project && npm run setup

# Or manually install Python dependencies:
pip install -r config/requirements-gemini.txt
pip install -r config/requirements-rhythm.txt
pip install -r config/requirements-stem.txt
```

---

## Configure API Keys

Via environment variables:
```bash
export OPENROUTER_API_KEY="sk-or-..."
```

Or via the Settings panel in the UI (persists to `.gemini_settings.json`).

---

## Test Scripts

All test scripts are in `scripts/testing/`:

### Reverb/Delay Analysis
```bash
./scripts/testing/test-reverb.sh /path/to/audio.wav
./scripts/testing/test-reverb.sh /path/to/audio.aif 8  # 8 second sections
```

### Frequency Band Analysis
```bash
./scripts/testing/analyze-frequencies.sh /path/to/audio.wav
```

### Instrument Detection
```bash
./scripts/testing/test-instruments.sh /path/to/audio.wav vocals
./scripts/testing/test-instruments.sh /path/to/audio.wav sound_fx
```

### Adaptive Detection
```bash
./scripts/testing/test-adaptive-detection.sh /path/to/audio.wav
```

### Detection Accuracy Test
```bash
# Test detection accuracy (92.4% Grade A benchmark)
./scripts/test-detection-accuracy.sh /path/to/audio.wav

# Results show per-instrument accuracy:
# Kicks: 98%, Snares: 95%, Hi-Hats: 75%, Claps: 74%
```

### AI-Guided Detection
```bash
# Test AI-guided detection with free tier
curl -X POST "http://localhost:56403/analyze-with-ai" \
  -F "audio=@/path/to/audio.wav" \
  -F "use_cache=true" \
  -F "model_tier=free"

# Check AI cache status
curl "http://localhost:56403/ai-cache-status"

# Clear AI cache
curl -X DELETE "http://localhost:56403/ai-cache"
```

### Generate Test Fixtures
```bash
./scripts/testing/generate-test-fixtures.sh
```

---

## Ralph Loop Scripts

All Ralph Loop scripts are in `scripts/ralph/`:

### Start Ralph Loop
```bash
./scripts/ralph/ralph-loop.sh           # Start autonomous test fixing
./scripts/ralph/ralph-loop.sh stop      # Stop gracefully
./scripts/ralph/ralph-loop.sh status    # View ticket summary
```

### Manual Ticket Operations
```bash
./scripts/ralph/ralph-ticket.sh create "Title" "Description" "Component" "Priority"
./scripts/ralph/ralph-ticket.sh status TICKET-006 IN_PROGRESS
./scripts/ralph/ralph-ticket.sh note TICKET-006 "Fixed the import statement"
./scripts/ralph/ralph-ticket.sh resolve TICKET-006 "Missing import" "Added import"
./scripts/ralph/ralph-ticket.sh get-open
./scripts/ralph/ralph-ticket.sh summary
```

### E2E Testing
```bash
./scripts/ralph/ralph-e2e.sh            # Run E2E tests
```

---

## Backup Scripts

All backup scripts are in `scripts/backup/`:

### Create Backup
```bash
./scripts/backup/backup-tickets.sh      # Create JSON + CSV backup
```

### Restore Backup
```bash
./scripts/backup/restore-tickets.sh --list              # List available backups
./scripts/backup/restore-tickets.sh --latest            # Restore from latest
./scripts/backup/restore-tickets.sh backups/tickets_20260124.json
./scripts/backup/restore-tickets.sh --csv backups/tickets.csv
```

### Verify Database
```bash
./scripts/backup/verify-tickets.sh      # Check database integrity
```

---

## Claude Code Commands

Essential commands for token optimization:

| Command | Purpose |
|---------|---------|
| `/clear` | Reset context between tasks (saves 50-70% tokens) |
| `/cost` | Check current token usage |
| `/compact` | Summarize conversation to save tokens |
| `/permissions` | Manage tool allowlist |
| `#` key | Add instructions to CLAUDE.md during session |

See [Claude Code Guide](claude-code-guide.md) for full best practices.

---

## Folder Structure Reference

### Components (client/src/components/)
| Folder | Purpose |
|--------|---------|
| `analysis/` | AudioAnalyzer, AnalysisDashboard, AnalysisHistory |
| `audio/` | AudioInputManager, AudioOptimizer |
| `chord/` | ChordDetector |
| `knowledge/` | KnowledgeLab, optimizer panels |
| `midi/` | MIDIGenerator |
| `mix/` | GeminiMixAnalyzer, MixAnalysisPanel |
| `panels/` | LoudnessPanel, FrequencyPanel, QualityPanel, StereoPanel |
| `rhythm/` | RhythmGrid, RhythmGridPro, FixGridPanel |
| `shared/` | DevModeGuidance |
| `spectrogram/` | SpectrogramView, SpectrumAnalyzer |
| `stem/` | StemSeparator |
| `ticket/` | TicketManager |
| `verification/` | VerificationController, stages/ |

### Scripts (scripts/)
| Folder | Purpose |
|--------|---------|
| `ralph/` | Ralph Loop automation scripts |
| `testing/` | Feature test scripts |
| `backup/` | Database backup/restore scripts |

### Config (config/)
| File | Purpose |
|------|---------|
| `requirements-gemini.txt` | Gemini analyzer Python deps |
| `requirements-rhythm.txt` | Rhythm analyzer Python deps |
| `requirements-stem.txt` | Stem separator Python deps |
| `.env.example` | Environment variables template |
