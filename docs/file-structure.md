# Project File Structure

## Optimized Layout (Updated 2026-01-24)

```
music-analyzer-project/
├── client/                        # React frontend
│   └── src/
│       ├── components/
│       │   ├── analysis/          # Analysis & dashboard components
│       │   │   ├── AnalysisDashboard.js
│       │   │   ├── AnalysisHistory.js
│       │   │   └── AudioAnalyzer.js
│       │   ├── audio/             # Audio input & optimization
│       │   │   ├── AudioInputManager.js
│       │   │   └── AudioOptimizer.js
│       │   ├── chord/             # Chord detection
│       │   │   └── ChordDetector.js
│       │   ├── knowledge/         # Knowledge Lab & optimizer panels
│       │   │   ├── index.js
│       │   │   ├── KnowledgeLab.js
│       │   │   ├── PersonalKnowledge.js
│       │   │   ├── StructureBuilder.js
│       │   │   ├── EQRecommendationChart.js
│       │   │   ├── OptimizationComparisonView.js
│       │   │   ├── BPMEffectsPanel.js
│       │   │   ├── SunoModePanel.js
│       │   │   └── DynamicsPanel.js
│       │   ├── midi/              # MIDI export
│       │   │   └── MIDIGenerator.js
│       │   ├── mix/               # Mix analysis & comparison
│       │   │   ├── GeminiMixAnalyzer.js
│       │   │   ├── MixAnalysisPanel.js
│       │   │   ├── LoudnessTimeline.js
│       │   │   └── ReferenceCompare.js
│       │   ├── panels/            # Analysis info panels
│       │   │   ├── FrequencyPanel.js
│       │   │   ├── LoudnessPanel.js
│       │   │   ├── QualityPanel.js
│       │   │   └── StereoPanel.js
│       │   ├── rhythm/            # Rhythm & drum detection
│       │   │   ├── FixGridPanel.js
│       │   │   ├── RhythmGrid.js
│       │   │   ├── RhythmGridPro.js
│       │   │   ├── RhythmGridPro.css
│       │   │   └── RhythmVerificationPanel.js
│       │   ├── shared/            # Shared UI components
│       │   │   ├── DevModeGuidance.js
│       │   │   └── DevModeGuidance.css
│       │   ├── spectrogram/       # Spectrogram visualization
│       │   │   ├── SpectrogramView.js
│       │   │   └── SpectrumAnalyzer.js
│       │   ├── stem/              # Stem separation
│       │   │   └── StemSeparator.js
│       │   ├── ticket/            # Issue tracking
│       │   │   └── TicketManager.js
│       │   └── verification/      # Verification workflow
│       │       ├── VerificationController.js
│       │       └── stages/
│       │           ├── AudioQualityStage.js
│       │           ├── RhythmVerificationStage.js
│       │           └── ChordVerificationStage.js
│       ├── hooks/                 # React hooks
│       │   ├── useAudioContext.js
│       │   ├── useAudioAnalyzer.js
│       │   ├── useAudioOptimizer.js
│       │   ├── useAudioRecording.js
│       │   ├── useAdvancedChordDetection.js
│       │   ├── useAnalysisCache.js
│       │   ├── useChordDetection.js
│       │   ├── useContextualTips.js
│       │   ├── useDrumDetection.js
│       │   ├── useFFTAnalysis.js
│       │   ├── useGenreDetection.js
│       │   ├── useKnowledgeLab.js
│       │   ├── useMixAnalysis.js
│       │   ├── usePersonalKnowledge.js
│       │   ├── usePracticeProgress.js
│       │   ├── useRhythmAnalysis.js
│       │   ├── useSpectrogramGenerator.js
│       │   ├── useStructureBuilder.js
│       │   └── useVerificationWorkflow.js
│       ├── utils/                 # Utility functions
│       │   ├── advancedChordDetection.js
│       │   ├── analysisCache.js
│       │   ├── analysisUtils.js
│       │   ├── audioConversion.js
│       │   ├── audioUtils.js
│       │   ├── bpmSyncUtils.js
│       │   ├── chordDetection.js
│       │   ├── exportUtils.js
│       │   ├── midiUtils.js
│       │   ├── mixAnalysisUtils.js
│       │   ├── optimizationUtils.js
│       │   ├── rhythmUtils.js
│       │   ├── spectrogramUtils.js
│       │   ├── sunoDetection.js
│       │   └── verificationUtils.js
│       ├── services/              # API clients
│       │   ├── api.js
│       │   ├── claudeAnalysis.js
│       │   ├── geminiAnalysis.js
│       │   ├── rhythmAnalysis.js
│       │   └── stemSeparation.js
│       ├── data/                  # Static data files
│       │   ├── chordProgressions.js
│       │   └── knowledgeDefaults.js
│       ├── App.js
│       └── App.css
│
├── config/                        # Configuration files
│   ├── requirements-gemini.txt
│   ├── requirements-rhythm.txt
│   ├── requirements-stem.txt
│   └── .env.example
│
├── scripts/                       # Shell scripts
│   ├── ralph/                     # Ralph Loop automation
│   │   ├── ralph-loop.sh
│   │   ├── ralph-ticket.sh
│   │   └── ralph-e2e.sh
│   ├── testing/                   # Test scripts
│   │   ├── test-reverb.sh
│   │   ├── test-instruments.sh
│   │   ├── test-adaptive-detection.sh
│   │   ├── analyze-frequencies.sh
│   │   └── generate-test-fixtures.sh
│   └── backup/                    # Backup scripts
│       ├── backup-tickets.sh
│       ├── restore-tickets.sh
│       └── verify-tickets.sh
│
├── docs/                          # Documentation
│   ├── coding-standards.md
│   ├── ralph-loop.md
│   ├── audio-processing.md
│   ├── services.md
│   ├── chord-detector.md
│   ├── quick-reference.md
│   ├── melodic-house.md
│   ├── file-structure.md
│   ├── ARCHITECTURE.md
│   ├── TECHNICAL_REFERENCE.md
│   ├── INCIDENTS.md
│   ├── TICKETS.md
│   └── SPECTROGRAM-GUIDE.md
│
├── data/                          # Data files
│   └── tickets.json
│
├── backups/                       # Backup storage
├── logs/                          # Log files
├── archive/                       # Archived/unused files
├── temp/                          # Temporary files
├── test-fixtures/                 # Test audio files
├── venv/                          # Python virtual environment
│
├── server.js                      # Express backend (Port 56404)
├── gemini_analyzer.py             # Gemini AI analyzer (Port 56401)
├── stem_separator.py              # Stem separation (Port 56402)
├── rhythm_analyzer.py             # Rhythm analyzer (Port 56403)
├── midi_generator.py              # MIDI generation
│
├── start-services.sh              # Start all services
├── stop-services.sh               # Stop all services
├── test-services.sh               # Validate services
├── sync-knowledge-lab.sh          # Sync knowledge lab
│
├── package.json
├── package-lock.json
└── README.md
```

## Component Folder Organization

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `analysis/` | Audio analysis UI | AudioAnalyzer, AnalysisHistory |
| `audio/` | Audio input/recording | AudioInputManager, AudioOptimizer |
| `chord/` | Chord detection | ChordDetector |
| `knowledge/` | Knowledge Lab + optimizer | KnowledgeLab, EQRecommendationChart |
| `midi/` | MIDI export | MIDIGenerator |
| `mix/` | Mix analysis | GeminiMixAnalyzer, MixAnalysisPanel |
| `panels/` | Info display panels | LoudnessPanel, FrequencyPanel |
| `rhythm/` | Rhythm/drum grid | RhythmGrid, FixGridPanel |
| `shared/` | Shared UI components | DevModeGuidance |
| `spectrogram/` | Spectrogram view | SpectrogramView, SpectrumAnalyzer |
| `stem/` | Stem separation | StemSeparator |
| `ticket/` | Issue tracking | TicketManager |
| `verification/` | Verification workflow | VerificationController, stages/ |

## Script Folder Organization

| Folder | Purpose | Key Scripts |
|--------|---------|-------------|
| `ralph/` | Autonomous test fixing | ralph-loop.sh, ralph-ticket.sh |
| `testing/` | Feature test scripts | test-reverb.sh, test-instruments.sh |
| `backup/` | Database backup | backup-tickets.sh, restore-tickets.sh |

## Environment Setup
- Node.js >= 18.0.0
- Python 3.11+
- FFmpeg for audio conversion
- yt-dlp for YouTube download (optional)
