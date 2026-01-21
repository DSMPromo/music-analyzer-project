# 🎵 Music Analyzer & AI MIDI Generator

## Complete Architecture & Implementation Guide

---

## 🎯 Project Overview

A React-based web application that analyzes audio from multiple sources (uploads, YouTube, microphone/audio interface), provides real-time spectrum visualization, detects chords and musical structure, and generates MIDI files using AI (Claude Code integration).

### Core Features

1. **Audio Input Sources**
   - File upload (WAV, MP3, FLAC, etc.)
   - YouTube URL extraction
   - Microphone/Audio Interface recording (supports Mix M1)
   - System audio loopback (for recording from Logic Pro)

2. **Real-Time Analysis**
   - Spectrum Analyzer (FFT visualization)
   - Waveform display
   - Chord detection
   - Key/Scale detection
   - BPM/Tempo detection
   - Song structure analysis

3. **AI-Powered MIDI Generation**
   - Uses Spotify's Basic Pitch for audio-to-MIDI
   - Claude Code integration for intelligent improvements
   - Chord progression suggestions
   - Structure-aware MIDI creation

4. **Logic Pro Integration**
   - Record directly from Logic via audio interface
   - Export MIDI files compatible with Logic
   - Real-time monitoring

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Audio      │  │   Spectrum   │  │    Chord     │              │
│  │   Sources    │  │   Analyzer   │  │   Detector   │              │
│  │              │  │              │  │              │              │
│  │ • Upload     │  │ • FFT        │  │ • Chromagram │              │
│  │ • YouTube    │  │ • Waveform   │  │ • Key Detect │              │
│  │ • Record     │  │ • Spectrogram│  │ • Structure  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └─────────────────┴─────────────────┘                       │
│                           │                                         │
│                    Web Audio API                                    │
│                    (AudioContext)                                   │
├─────────────────────────────────────────────────────────────────────┤
│                         BACKEND (Node.js)                           │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   yt-dlp     │  │ Basic Pitch  │  │   Claude     │              │
│  │   Handler    │  │   (Python)   │  │   API        │              │
│  │              │  │              │  │              │              │
│  │ • Extract    │  │ • Audio→MIDI │  │ • Analysis   │              │
│  │ • Convert    │  │ • Pitch Bend │  │ • Suggestions│              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI Framework |
| TypeScript | Type Safety |
| Tailwind CSS | Styling |
| Web Audio API | Audio Processing |
| Canvas API | Visualizations |
| Tonal.js | Music Theory |
| audioMotion-analyzer | Spectrum Display |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Server Runtime |
| Express | API Server |
| yt-dlp (via ytdlp-nodejs) | YouTube Audio Extraction |
| basic-pitch (Python) | Audio to MIDI Conversion |
| FFmpeg | Audio Processing |

### AI Integration
| Technology | Purpose |
|------------|---------|
| Claude API | Music Analysis & Suggestions |
| Basic Pitch | Neural Network Transcription |

---

## 🎛️ Component Architecture

### 1. Audio Input Manager

```typescript
// src/components/AudioInputManager.tsx

interface AudioSource {
  type: 'file' | 'youtube' | 'microphone' | 'system';
  url?: string;
  file?: File;
  deviceId?: string;
}

interface AudioInputManagerProps {
  onAudioReady: (audioBuffer: AudioBuffer) => void;
  onStreamReady: (stream: MediaStream) => void;
}
```

**Features:**
- Drag & drop file upload
- YouTube URL parser
- Audio device selector (for Mix M1)
- Recording controls (Start/Stop/Pause)

### 2. Spectrum Analyzer

```typescript
// src/components/SpectrumAnalyzer.tsx

interface SpectrumAnalyzerProps {
  audioContext: AudioContext;
  analyser: AnalyserNode;
  mode: 'bars' | 'waveform' | 'spectrogram';
  fftSize: 2048 | 4096 | 8192;
  colorScheme: 'default' | 'gradient' | 'rainbow';
}
```

**Visualization Modes:**
- **Bar Graph**: Real-time frequency bars
- **Waveform**: Time-domain display
- **Spectrogram**: Frequency over time (waterfall)

### 3. Chord Detector

```typescript
// src/components/ChordDetector.tsx

interface ChordInfo {
  root: string;          // C, D, E, etc.
  quality: string;       // major, minor, dim, aug
  extensions: string[];  // 7, 9, 11, 13
  bass?: string;         // Slash chord bass note
  confidence: number;    // 0-1 confidence score
}

interface ChordDetectorProps {
  chromagram: number[];  // 12-element pitch class profile
  onChordDetected: (chord: ChordInfo) => void;
}
```

**Detection Algorithm:**
1. Compute chromagram from FFT data
2. Apply pitch class profile template matching
3. Use Tonal.js for chord identification
4. Track chord changes over time

### 4. MIDI Generator

```typescript
// src/components/MIDIGenerator.tsx

interface MIDIGeneratorProps {
  audioFile: File | Blob;
  analysisData: AnalysisResult;
  options: {
    minNoteLength: number;
    confidenceThreshold: number;
    includePitchBend: boolean;
  };
  onMIDIGenerated: (midiData: ArrayBuffer) => void;
}
```

---

## 🔧 Implementation Details

### Web Audio API Setup

```typescript
// src/hooks/useAudioContext.ts

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const initAudio = useCallback(async () => {
    const ctx = new AudioContext({ sampleRate: 44100 });
    const analyser = ctx.createAnalyser();
    
    // Configure for high-resolution analysis
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -10;
    
    analyserRef.current = analyser;
    setAudioContext(ctx);
    
    return { ctx, analyser };
  }, []);

  return { audioContext, analyser: analyserRef.current, initAudio };
}
```

### Recording from Audio Interface (Mix M1)

```typescript
// src/hooks/useAudioRecording.ts

export function useAudioRecording() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Get available audio input devices
  const getDevices = useCallback(async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = allDevices.filter(d => d.kind === 'audioinput');
    setDevices(audioInputs);
    
    // Look for Mix M1 or similar interface
    const mixM1 = audioInputs.find(d => 
      d.label.toLowerCase().includes('mix m1') ||
      d.label.toLowerCase().includes('usb audio')
    );
    if (mixM1) setSelectedDevice(mixM1.deviceId);
  }, []);

  const startRecording = useCallback(async (deviceId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: 44100,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    });

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 256000
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      // Convert to WAV for analysis
      convertToWav(blob);
    };

    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start(1000); // Chunk every second
  }, []);

  return { devices, selectedDevice, setSelectedDevice, startRecording };
}
```

### YouTube Audio Extraction (Backend)

```javascript
// server/routes/youtube.js

const express = require('express');
const { YTDlp } = require('ytdlp-nodejs');
const path = require('path');
const router = express.Router();

const ytdlp = new YTDlp();

router.post('/extract', async (req, res) => {
  const { url } = req.body;
  
  try {
    // Get video info first
    const info = await ytdlp.getInfoAsync(url);
    const title = info.title.replace(/[^\w\s-]/g, '');
    
    // Download audio only
    const outputPath = path.join(__dirname, '../temp', `${title}.wav`);
    
    await ytdlp.downloadAsync(url, {
      format: 'bestaudio',
      output: outputPath,
      postProcessorArgs: ['-ar', '44100', '-ac', '2']
    });
    
    res.json({ 
      success: true, 
      path: outputPath,
      title: info.title,
      duration: info.duration
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
```

### Basic Pitch Integration (MIDI Generation)

```python
# server/python/midi_generator.py

from basic_pitch.inference import predict
from basic_pitch import ICASSP_2022_MODEL_PATH
import json
import sys

def generate_midi(audio_path, output_path, options=None):
    """
    Generate MIDI from audio using Spotify's Basic Pitch
    
    Options:
    - onset_threshold: 0.5 (default)
    - frame_threshold: 0.3 (default)
    - min_note_len: 58 (default, in ms)
    - min_freq: None (Hz, filter low notes)
    - max_freq: None (Hz, filter high notes)
    """
    
    if options is None:
        options = {}
    
    model_output, midi_data, note_events = predict(
        audio_path,
        onset_threshold=options.get('onset_threshold', 0.5),
        frame_threshold=options.get('frame_threshold', 0.3),
        minimum_note_length=options.get('min_note_len', 58),
        minimum_frequency=options.get('min_freq'),
        maximum_frequency=options.get('max_freq')
    )
    
    # Save MIDI file
    midi_data.write(output_path)
    
    # Return note events for analysis
    return {
        'notes': len(note_events),
        'events': [
            {
                'start': float(e[0]),
                'end': float(e[1]),
                'pitch': int(e[2]),
                'velocity': int(e[3] * 127),
                'bend': e[4] if len(e) > 4 else None
            }
            for e in note_events
        ]
    }

if __name__ == '__main__':
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    options = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}
    
    result = generate_midi(audio_path, output_path, options)
    print(json.dumps(result))
```

### Chord Detection Algorithm

```typescript
// src/utils/chordDetection.ts

import { Chord, Note, Interval } from 'tonal';

// Chromagram: 12-element array representing pitch class energy
// Index 0 = C, 1 = C#, 2 = D, etc.

export function detectChord(chromagram: number[]): ChordInfo | null {
  // Normalize chromagram
  const max = Math.max(...chromagram);
  if (max < 0.1) return null; // Too quiet
  
  const normalized = chromagram.map(v => v / max);
  
  // Find peaks (active pitch classes)
  const threshold = 0.4;
  const activePitches: string[] = [];
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  normalized.forEach((value, index) => {
    if (value >= threshold) {
      activePitches.push(noteNames[index]);
    }
  });
  
  if (activePitches.length < 2) return null;
  
  // Try to identify chord using Tonal.js
  const detected = Chord.detect(activePitches);
  
  if (detected.length > 0) {
    const chordName = detected[0];
    const chord = Chord.get(chordName);
    
    return {
      root: chord.tonic || '',
      quality: chord.quality,
      extensions: chord.intervals.filter(i => 
        !['1P', '3M', '3m', '5P'].includes(i)
      ),
      confidence: calculateConfidence(normalized, chord),
      symbol: chordName
    };
  }
  
  return null;
}

function calculateConfidence(chromagram: number[], chord: any): number {
  // Compare expected vs actual pitch class profile
  const expected = new Array(12).fill(0);
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  chord.notes.forEach((note: string) => {
    const index = noteNames.indexOf(Note.pitchClass(note));
    if (index >= 0) expected[index] = 1;
  });
  
  // Pearson correlation
  const n = 12;
  const sumX = expected.reduce((a, b) => a + b, 0);
  const sumY = chromagram.reduce((a, b) => a + b, 0);
  const sumXY = expected.reduce((acc, x, i) => acc + x * chromagram[i], 0);
  const sumX2 = expected.reduce((acc, x) => acc + x * x, 0);
  const sumY2 = chromagram.reduce((acc, y) => acc + y * y, 0);
  
  const correlation = (n * sumXY - sumX * sumY) / 
    Math.sqrt((n * sumX2 - sumX ** 2) * (n * sumY2 - sumY ** 2));
  
  return Math.max(0, Math.min(1, (correlation + 1) / 2));
}
```

---

## 🎹 Logic Pro Integration

### Recording from Logic via Audio Interface

**Setup Steps:**

1. **Configure Logic Pro Output**
   - Go to Logic Pro → Settings → Audio
   - Set Output Device to your Mix M1
   - Enable "Software Monitoring"

2. **Configure Mix M1**
   - Set Mix M1 as input in the web app
   - Route Logic's stereo output to Mix M1's input (loopback)
   - Or use BlackHole for virtual audio routing

3. **Alternative: BlackHole Setup**
   ```bash
   # Install BlackHole (free virtual audio driver)
   brew install --cask blackhole-2ch
   
   # Create Multi-Output Device in Audio MIDI Setup
   # - Add BlackHole 2ch + your speakers
   # This lets you hear audio AND capture it
   ```

### Recording Workflow

```typescript
// src/components/LogicProRecorder.tsx

export function LogicProRecorder({ onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const recorderRef = useRef<AudioRecorder | null>(null);

  const startRecording = async () => {
    // Request specific device (BlackHole or Mix M1)
    const devices = await navigator.mediaDevices.enumerateDevices();
    const blackhole = devices.find(d => 
      d.label.includes('BlackHole') || 
      d.label.includes('Mix M1')
    );
    
    if (!blackhole) {
      alert('Please set up BlackHole or Mix M1 for recording from Logic');
      return;
    }
    
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: blackhole.deviceId },
        sampleRate: 44100,
        channelCount: 2,
        echoCancellation: false,
        noiseSuppression: false
      }
    });
    
    recorderRef.current = new AudioRecorder(stream);
    recorderRef.current.start();
    setIsRecording(true);
    
    // Duration timer
    const startTime = Date.now();
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    recorderRef.current.onStop = (blob) => {
      clearInterval(interval);
      onRecordingComplete(blob);
    };
  };

  return (
    <div className="logic-recorder">
      <h3>🎹 Record from Logic Pro</h3>
      <p>Route Logic's output through BlackHole or Mix M1</p>
      
      {!isRecording ? (
        <button onClick={startRecording} className="record-btn">
          ⏺️ Start Recording
        </button>
      ) : (
        <>
          <div className="recording-indicator">
            🔴 Recording... {formatTime(duration)}
          </div>
          <button onClick={() => recorderRef.current?.stop()}>
            ⏹️ Stop
          </button>
        </>
      )}
    </div>
  );
}
```

---

## 🤖 Claude Code Integration

### AI-Powered Analysis Suggestions

```typescript
// src/services/claudeAnalysis.ts

interface AnalysisRequest {
  chordProgression: ChordInfo[];
  key: string;
  tempo: number;
  structure: SongSection[];
  midiNotes?: NoteEvent[];
}

interface AnalysisSuggestion {
  type: 'harmony' | 'rhythm' | 'structure' | 'production';
  description: string;
  suggestion: string;
  midiChanges?: NoteEvent[];
}

export async function analyzeWithClaude(
  data: AnalysisRequest
): Promise<AnalysisSuggestion[]> {
  const response = await fetch('/api/claude/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: `Analyze this musical content and provide specific improvement suggestions:

Key: ${data.key}
Tempo: ${data.tempo} BPM
Chord Progression: ${data.chordProgression.map(c => c.symbol).join(' - ')}

Structure:
${data.structure.map(s => `${s.name}: bars ${s.startBar}-${s.endBar}`).join('\n')}

Please provide:
1. Harmonic analysis and suggestions for more interesting chord substitutions
2. Rhythmic improvements
3. Structure recommendations (intro, verse, chorus, bridge arrangement)
4. Production tips specific to this style

Format your response as JSON array of suggestions.`
    })
  });
  
  return response.json();
}
```

---

## 📁 Project Structure

```
music-analyzer/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AudioInputManager.tsx
│   │   │   ├── SpectrumAnalyzer.tsx
│   │   │   ├── ChordDetector.tsx
│   │   │   ├── MIDIGenerator.tsx
│   │   │   ├── LogicProRecorder.tsx
│   │   │   └── AnalysisDashboard.tsx
│   │   ├── hooks/
│   │   │   ├── useAudioContext.ts
│   │   │   ├── useAudioRecording.ts
│   │   │   ├── useChordDetection.ts
│   │   │   └── useFFTAnalysis.ts
│   │   ├── utils/
│   │   │   ├── chordDetection.ts
│   │   │   ├── audioUtils.ts
│   │   │   └── midiUtils.ts
│   │   └── services/
│   │       ├── api.ts
│   │       └── claudeAnalysis.ts
│   └── package.json
│
├── server/                 # Node.js Backend
│   ├── routes/
│   │   ├── youtube.js
│   │   ├── midi.js
│   │   └── analysis.js
│   ├── python/
│   │   └── midi_generator.py
│   ├── temp/               # Temporary audio files
│   └── index.js
│
├── docker-compose.yml      # Container setup
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites

```bash
# System dependencies
brew install ffmpeg yt-dlp python@3.11

# Python dependencies
pip install basic-pitch --break-system-packages

# Node dependencies
npm install -g npm
```

### Installation

```bash
# Clone and setup
git clone <repo>
cd music-analyzer

# Install frontend
cd client && npm install

# Install backend
cd ../server && npm install

# Start development
npm run dev  # Starts both frontend and backend
```

### First Use

1. **Open the app**: http://localhost:56400
2. **Select audio source**:
   - Upload a file, OR
   - Paste YouTube URL, OR
   - Select your Mix M1 and click Record
3. **View analysis**: Spectrum, chords, structure
4. **Generate MIDI**: Click "Generate MIDI" for AI transcription
5. **Export**: Download MIDI file for Logic Pro

---

## 📊 Feature Comparison

| Feature | Basic | Pro | Enterprise |
|---------|-------|-----|------------|
| File Upload | ✅ | ✅ | ✅ |
| YouTube Extract | ✅ | ✅ | ✅ |
| Spectrum Analyzer | ✅ | ✅ | ✅ |
| Chord Detection | ✅ | ✅ | ✅ |
| MIDI Generation | Limited | ✅ | ✅ |
| Claude Analysis | ❌ | ✅ | ✅ |
| Logic Integration | ❌ | ✅ | ✅ |
| Batch Processing | ❌ | ❌ | ✅ |

---

## 🎓 Music Theory Reference

### Chord Templates (Pitch Class Profiles)

| Chord Type | Intervals | PCP Template |
|------------|-----------|--------------|
| Major | 1-3-5 | C: [1,0,0,0,1,0,0,1,0,0,0,0] |
| Minor | 1-b3-5 | Cm: [1,0,0,1,0,0,0,1,0,0,0,0] |
| Dominant 7 | 1-3-5-b7 | C7: [1,0,0,0,1,0,0,1,0,0,1,0] |
| Major 7 | 1-3-5-7 | Cmaj7: [1,0,0,0,1,0,0,1,0,0,0,1] |
| Minor 7 | 1-b3-5-b7 | Cm7: [1,0,0,1,0,0,0,1,0,0,1,0] |

### Frequency to Note Conversion

```typescript
function freqToNote(freq: number): { note: string; cents: number } {
  const A4 = 440;
  const semitones = 12 * Math.log2(freq / A4);
  const nearestNote = Math.round(semitones);
  const cents = Math.round((semitones - nearestNote) * 100);
  
  const noteNames = ['A', 'A#', 'B', 'C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#'];
  const octave = Math.floor((nearestNote + 9) / 12) + 4;
  const noteIndex = ((nearestNote % 12) + 12) % 12;
  
  return {
    note: `${noteNames[noteIndex]}${octave}`,
    cents
  };
}
```

---

## 🔮 Future Enhancements

1. **Real-time collaboration** - Multiple users analyzing same track
2. **VST/AU plugin** - Direct integration into Logic Pro
3. **Stem separation** - Isolate instruments before analysis
4. **Training mode** - Learn from user corrections
5. **Style transfer** - Generate MIDI in style of specific artists
6. **Mobile app** - iOS/Android companion apps

---

## 📚 Resources

### Libraries & Tools
- [Spotify Basic Pitch](https://basicpitch.spotify.com/)
- [Tonal.js](https://github.com/tonaljs/tonal)
- [audioMotion-analyzer](https://audiomotion.dev/)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [BlackHole](https://existential.audio/blackhole/)

### Research Papers
- "A Lightweight Instrument-Agnostic Model for Polyphonic Note Transcription" (ICASSP 2022)
- "Real-Time Chord Recognition For Live Performance" (ICMC 2009)

### Tutorials
- [Web Audio API MDN Docs](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Logic Pro Scripter Guide](https://support.apple.com/guide/logicpro/scripter-api-overview-lgce3905a48c/mac)

---

*Built with ❤️ for musicians by DSM.Promo*
