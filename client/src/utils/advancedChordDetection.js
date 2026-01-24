/**
 * Advanced Chord Detection System
 *
 * Multi-instrument weighted chroma fusion for accurate chord detection.
 *
 * Pipeline:
 * 1. Select harmonic sources (keys, pads, guitar, strings, bass, vocals)
 * 2. Per-instrument band filtering using EQ database
 * 3. Extract chroma per instrument with smoothing
 * 4. Weight each instrument per frame
 * 5. Fuse into weighted ChromaTotal
 * 6. Detect chord with enhanced scoring
 * 7. Smooth chord labels over time
 * 8. Output chord + confidence
 */

// ============================================
// HARMONIC INSTRUMENT DEFINITIONS
// ============================================

export const HARMONIC_INSTRUMENTS = {
  // Keys - highest priority for chords
  piano: {
    priority: 1.0,
    freqRange: [80, 4200],
    harmonicBands: [[80, 300], [300, 1000], [1000, 4200]],
    notchFreqs: [],
    category: 'keys'
  },
  keys: {
    priority: 1.0,
    freqRange: [100, 5000],
    harmonicBands: [[100, 400], [400, 1500], [1500, 5000]],
    notchFreqs: [],
    category: 'keys'
  },
  rhodes: {
    priority: 0.95,
    freqRange: [80, 3500],
    harmonicBands: [[80, 300], [300, 1200], [1200, 3500]],
    notchFreqs: [],
    category: 'keys'
  },
  organ: {
    priority: 0.9,
    freqRange: [60, 6000],
    harmonicBands: [[60, 250], [250, 1000], [1000, 6000]],
    notchFreqs: [],
    category: 'keys'
  },

  // Synths
  synth_pad: {
    priority: 0.85,
    freqRange: [100, 8000],
    harmonicBands: [[100, 500], [500, 2000], [2000, 8000]],
    notchFreqs: [],
    category: 'synth'
  },
  synth_lead: {
    priority: 0.8,
    freqRange: [200, 8000],
    harmonicBands: [[200, 800], [800, 3000], [3000, 8000]],
    notchFreqs: [],
    category: 'synth'
  },
  synth_chord: {
    priority: 0.95,
    freqRange: [100, 6000],
    harmonicBands: [[100, 400], [400, 1500], [1500, 6000]],
    notchFreqs: [],
    category: 'synth'
  },

  // Strings
  guitar: {
    priority: 0.9,
    freqRange: [80, 5000],
    harmonicBands: [[80, 300], [300, 1200], [1200, 5000]],
    notchFreqs: [3000], // Pick noise
    category: 'strings'
  },
  acoustic_guitar: {
    priority: 0.9,
    freqRange: [80, 5000],
    harmonicBands: [[80, 300], [300, 1000], [1000, 5000]],
    notchFreqs: [],
    category: 'strings'
  },
  strings: {
    priority: 0.85,
    freqRange: [200, 8000],
    harmonicBands: [[200, 600], [600, 2000], [2000, 8000]],
    notchFreqs: [],
    category: 'strings'
  },
  violin: {
    priority: 0.8,
    freqRange: [200, 10000],
    harmonicBands: [[200, 800], [800, 3000], [3000, 10000]],
    notchFreqs: [],
    category: 'strings'
  },

  // Bass - root note detection
  bass: {
    priority: 0.75,
    freqRange: [30, 500],
    harmonicBands: [[30, 100], [100, 250], [250, 500]],
    notchFreqs: [],
    category: 'bass'
  },
  sub_bass: {
    priority: 0.6,
    freqRange: [20, 120],
    harmonicBands: [[20, 60], [60, 120]],
    notchFreqs: [],
    category: 'bass'
  },

  // Brass
  brass: {
    priority: 0.75,
    freqRange: [100, 6000],
    harmonicBands: [[100, 400], [400, 1500], [1500, 6000]],
    notchFreqs: [],
    category: 'brass'
  },
  horns: {
    priority: 0.7,
    freqRange: [150, 5000],
    harmonicBands: [[150, 500], [500, 2000], [2000, 5000]],
    notchFreqs: [],
    category: 'brass'
  },

  // Vocals - for vocal harmonies
  lead_vocal: {
    priority: 0.5,
    freqRange: [100, 4000],
    harmonicBands: [[100, 300], [300, 1000], [1000, 4000]],
    notchFreqs: [5000, 7000], // Sibilance
    category: 'vocals'
  },
  backing_vocal: {
    priority: 0.6,
    freqRange: [150, 4000],
    harmonicBands: [[150, 400], [400, 1200], [1200, 4000]],
    notchFreqs: [5000, 7000],
    category: 'vocals'
  },
  harmony: {
    priority: 0.65,
    freqRange: [150, 4000],
    harmonicBands: [[150, 400], [400, 1200], [1200, 4000]],
    notchFreqs: [],
    category: 'vocals'
  },

  // Plucks
  pluck: {
    priority: 0.7,
    freqRange: [200, 8000],
    harmonicBands: [[200, 800], [800, 3000], [3000, 8000]],
    notchFreqs: [],
    category: 'synth'
  },
  harp: {
    priority: 0.75,
    freqRange: [30, 4000],
    harmonicBands: [[30, 200], [200, 800], [800, 4000]],
    notchFreqs: [],
    category: 'strings'
  }
};

// Non-harmonic instruments to IGNORE for chord detection
export const NON_HARMONIC_INSTRUMENTS = [
  'kick', 'snare', 'hihat', 'clap', 'tom', 'perc', 'cymbal', 'shaker',
  'uplifter', 'downlifter', 'impact', 'riser', 'drop', 'sweep',
  'white_noise', 'swoosh', 'stutter', 'tape_stop', 'reverse_crash',
  'sub_drop'
];

// ============================================
// CHORD TEMPLATES
// ============================================

export const CHORD_TEMPLATES = {
  // Major chords
  'maj': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
  'maj7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  'maj9': [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 1],
  '6': [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
  'add9': [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],

  // Minor chords
  'min': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
  'min7': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  'min9': [1, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 0],
  'min6': [1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
  'minMaj7': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1],

  // Dominant chords
  '7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  '9': [1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
  '11': [1, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0],
  '13': [1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
  '7#9': [1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0],
  '7b9': [1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],

  // Suspended chords
  'sus2': [1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0],
  'sus4': [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0],
  '7sus4': [1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0],

  // Diminished / Augmented
  'dim': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
  'dim7': [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0],
  'hdim7': [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
  'aug': [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
  'aug7': [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],

  // Power chord (for rock/metal)
  '5': [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
};

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// ============================================
// CHROMA EXTRACTION
// ============================================

/**
 * Extract 12-bin chroma from frequency data with band filtering
 */
export function extractChromaFromBand(frequencyData, sampleRate, lowFreq, highFreq) {
  const chroma = new Float32Array(12).fill(0);
  const fftSize = frequencyData.length * 2;
  const binWidth = sampleRate / fftSize;

  // Convert frequency bounds to bin indices
  const lowBin = Math.floor(lowFreq / binWidth);
  const highBin = Math.min(Math.ceil(highFreq / binWidth), frequencyData.length - 1);

  for (let bin = lowBin; bin <= highBin; bin++) {
    const freq = bin * binWidth;
    if (freq < 20) continue;

    // Convert frequency to MIDI note number
    const midiNote = 12 * Math.log2(freq / 440) + 69;
    const pitchClass = Math.round(midiNote) % 12;

    if (pitchClass >= 0 && pitchClass < 12) {
      // Weight by proximity to exact pitch
      const deviation = Math.abs(midiNote - Math.round(midiNote));
      const weight = Math.cos(deviation * Math.PI) * 0.5 + 0.5;

      // Add magnitude to chroma bin
      const magnitude = frequencyData[bin] / 255; // Normalize 0-1
      chroma[pitchClass] += magnitude * weight;
    }
  }

  // Normalize chroma
  const max = Math.max(...chroma);
  if (max > 0) {
    for (let i = 0; i < 12; i++) {
      chroma[i] /= max;
    }
  }

  return chroma;
}

/**
 * Apply median smoothing to chroma over time
 */
export function smoothChroma(chromaHistory, windowSize = 5) {
  if (chromaHistory.length < windowSize) {
    return chromaHistory[chromaHistory.length - 1] || new Float32Array(12);
  }

  const smoothed = new Float32Array(12);
  const start = chromaHistory.length - windowSize;

  for (let bin = 0; bin < 12; bin++) {
    const values = [];
    for (let i = start; i < chromaHistory.length; i++) {
      values.push(chromaHistory[i][bin]);
    }
    values.sort((a, b) => a - b);
    smoothed[bin] = values[Math.floor(values.length / 2)]; // Median
  }

  return smoothed;
}

// ============================================
// INSTRUMENT WEIGHTING
// ============================================

/**
 * Calculate spectral flatness (0 = tonal, 1 = noisy)
 */
export function calculateSpectralFlatness(magnitudes) {
  const n = magnitudes.length;
  if (n === 0) return 1;

  let geometricMean = 0;
  let arithmeticMean = 0;
  let validCount = 0;

  for (let i = 0; i < n; i++) {
    const val = Math.max(magnitudes[i], 1e-10);
    geometricMean += Math.log(val);
    arithmeticMean += val;
    validCount++;
  }

  if (validCount === 0) return 1;

  geometricMean = Math.exp(geometricMean / validCount);
  arithmeticMean = arithmeticMean / validCount;

  if (arithmeticMean === 0) return 1;
  return Math.min(geometricMean / arithmeticMean, 1);
}

/**
 * Calculate transient score (high = percussive attack)
 */
export function calculateTransientScore(magnitudes, prevMagnitudes) {
  if (!prevMagnitudes || magnitudes.length !== prevMagnitudes.length) {
    return 0;
  }

  let diff = 0;
  for (let i = 0; i < magnitudes.length; i++) {
    diff += Math.max(0, magnitudes[i] - prevMagnitudes[i]);
  }

  return Math.min(diff / magnitudes.length / 128, 1);
}

/**
 * Calculate frame weight for an instrument
 */
export function calculateInstrumentWeight(
  instrumentConfig,
  chroma,
  spectralFlatness,
  transientScore,
  loudness,
  loudnessThreshold = 0.1
) {
  // Priority weight from config
  const priorityWeight = instrumentConfig.priority;

  // Tonal quality weight (prefer tonal over noisy)
  const tonalWeight = 1 - spectralFlatness * 0.5;

  // Transient penalty (reduce weight for percussive moments)
  const transientWeight = 1 - transientScore * 0.3;

  // Loudness gate
  const loudnessWeight = loudness > loudnessThreshold ? 1 : loudness / loudnessThreshold;

  // Combine weights
  return priorityWeight * tonalWeight * transientWeight * loudnessWeight;
}

// ============================================
// CHROMA FUSION
// ============================================

/**
 * Fuse multiple instrument chromas into weighted ChromaTotal
 */
export function fuseInstrumentChromas(instrumentChromas) {
  const chromaTotal = new Float32Array(12).fill(0);
  let totalWeight = 0;

  for (const { chroma, weight } of instrumentChromas) {
    if (weight > 0) {
      for (let i = 0; i < 12; i++) {
        chromaTotal[i] += chroma[i] * weight;
      }
      totalWeight += weight;
    }
  }

  // Normalize
  if (totalWeight > 0) {
    for (let i = 0; i < 12; i++) {
      chromaTotal[i] /= totalWeight;
    }
  }

  return chromaTotal;
}

// ============================================
// CHORD DETECTION
// ============================================

/**
 * Score a chord template against chroma
 */
export function scoreChordTemplate(chroma, template, rootIdx, bassNote = null) {
  let score = 0;
  let chordToneMatch = 0;
  let nonChordPenalty = 0;

  // Rotate template to root
  const rotatedTemplate = new Array(12);
  for (let i = 0; i < 12; i++) {
    rotatedTemplate[i] = template[(i - rootIdx + 12) % 12];
  }

  // Calculate match scores
  for (let i = 0; i < 12; i++) {
    if (rotatedTemplate[i] === 1) {
      // Chord tone - should be present
      chordToneMatch += chroma[i];
    } else {
      // Non-chord tone - penalty if present
      nonChordPenalty += chroma[i] * 0.5;
    }
  }

  // Normalize chord tone match by number of chord tones
  const numChordTones = template.reduce((a, b) => a + b, 0);
  chordToneMatch /= numChordTones;

  // Bass root bonus - if bass note matches root, boost score
  let bassBonus = 0;
  if (bassNote !== null && bassNote === rootIdx) {
    bassBonus = 0.2;
  }

  // Combine into final score
  score = chordToneMatch - nonChordPenalty * 0.3 + bassBonus;

  return {
    score,
    chordToneMatch,
    nonChordPenalty,
    bassBonus
  };
}

/**
 * Detect best chord from ChromaTotal
 */
export function detectChordFromChroma(chroma, bassNote = null) {
  let bestChord = null;
  let bestScore = -Infinity;
  let bestDetails = null;

  for (const [chordType, template] of Object.entries(CHORD_TEMPLATES)) {
    for (let root = 0; root < 12; root++) {
      const result = scoreChordTemplate(chroma, template, root, bassNote);

      if (result.score > bestScore) {
        bestScore = result.score;
        bestChord = {
          root: NOTE_NAMES[root],
          type: chordType,
          symbol: `${NOTE_NAMES[root]}${chordType === 'maj' ? '' : chordType}`
        };
        bestDetails = result;
      }
    }
  }

  return {
    chord: bestChord,
    confidence: Math.max(0, Math.min(1, bestScore)),
    details: bestDetails
  };
}

// ============================================
// TEMPORAL SMOOTHING
// ============================================

/**
 * Chord smoother with hysteresis
 */
export class ChordSmoother {
  constructor(options = {}) {
    this.confidenceMargin = options.confidenceMargin || 0.15;
    this.minFrames = options.minFrames || 3;
    this.minDurationMs = options.minDurationMs || 200;
    this.frameMs = options.frameMs || 50;

    this.currentChord = null;
    this.currentConfidence = 0;
    this.frameCount = 0;
    this.candidateChord = null;
    this.candidateConfidence = 0;
    this.candidateFrames = 0;
  }

  update(chord, confidence) {
    this.frameCount++;

    // If no current chord, accept first detection
    if (!this.currentChord) {
      if (confidence > 0.3) {
        this.currentChord = chord;
        this.currentConfidence = confidence;
      }
      return this.getResult();
    }

    // Check if same chord
    const isSameChord = chord && this.currentChord &&
      chord.root === this.currentChord.root &&
      chord.type === this.currentChord.type;

    if (isSameChord) {
      // Update confidence with EMA
      this.currentConfidence = this.currentConfidence * 0.7 + confidence * 0.3;
      this.candidateChord = null;
      this.candidateFrames = 0;
    } else {
      // New chord detected
      if (chord && confidence > this.currentConfidence + this.confidenceMargin) {
        // Track candidate
        if (this.candidateChord &&
            chord.root === this.candidateChord.root &&
            chord.type === this.candidateChord.type) {
          this.candidateFrames++;
          this.candidateConfidence = Math.max(this.candidateConfidence, confidence);
        } else {
          this.candidateChord = chord;
          this.candidateConfidence = confidence;
          this.candidateFrames = 1;
        }

        // Switch if candidate meets criteria
        if (this.candidateFrames >= this.minFrames) {
          this.currentChord = this.candidateChord;
          this.currentConfidence = this.candidateConfidence;
          this.candidateChord = null;
          this.candidateFrames = 0;
        }
      } else {
        // Decay candidate
        this.candidateFrames = Math.max(0, this.candidateFrames - 1);
        if (this.candidateFrames === 0) {
          this.candidateChord = null;
        }
      }
    }

    return this.getResult();
  }

  getResult() {
    return {
      chord: this.currentChord,
      confidence: this.currentConfidence,
      stable: this.candidateFrames === 0
    };
  }

  reset() {
    this.currentChord = null;
    this.currentConfidence = 0;
    this.frameCount = 0;
    this.candidateChord = null;
    this.candidateConfidence = 0;
    this.candidateFrames = 0;
  }
}

// ============================================
// ADVANCED CHORD DETECTOR CLASS
// ============================================

export class AdvancedChordDetector {
  constructor(options = {}) {
    this.sampleRate = options.sampleRate || 44100;
    this.smoothingWindow = options.smoothingWindow || 5;
    this.instruments = options.instruments || Object.keys(HARMONIC_INSTRUMENTS);

    this.chromaHistories = {};
    this.prevMagnitudes = {};
    this.smoother = new ChordSmoother(options.smootherOptions);

    // Initialize per-instrument state
    for (const inst of this.instruments) {
      this.chromaHistories[inst] = [];
      this.prevMagnitudes[inst] = null;
    }
  }

  /**
   * Process a frame with separated instrument data
   * @param {Object} instrumentData - { instrumentName: { frequencyData, loudness } }
   * @returns {Object} Detected chord with confidence
   */
  processFrame(instrumentData) {
    const instrumentChromas = [];

    for (const [instName, data] of Object.entries(instrumentData)) {
      const config = HARMONIC_INSTRUMENTS[instName];
      if (!config) continue;

      const { frequencyData, loudness = 0 } = data;

      // Extract chroma from instrument's frequency range
      const chroma = extractChromaFromBand(
        frequencyData,
        this.sampleRate,
        config.freqRange[0],
        config.freqRange[1]
      );

      // Add to history and get smoothed chroma
      this.chromaHistories[instName].push(chroma);
      if (this.chromaHistories[instName].length > this.smoothingWindow * 2) {
        this.chromaHistories[instName].shift();
      }
      const smoothedChroma = smoothChroma(
        this.chromaHistories[instName],
        this.smoothingWindow
      );

      // Calculate quality metrics
      const spectralFlatness = calculateSpectralFlatness(frequencyData);
      const transientScore = calculateTransientScore(
        frequencyData,
        this.prevMagnitudes[instName]
      );
      this.prevMagnitudes[instName] = frequencyData.slice();

      // Calculate weight
      const weight = calculateInstrumentWeight(
        config,
        smoothedChroma,
        spectralFlatness,
        transientScore,
        loudness
      );

      instrumentChromas.push({
        instrument: instName,
        chroma: smoothedChroma,
        weight
      });
    }

    // Fuse chromas
    const chromaTotal = fuseInstrumentChromas(instrumentChromas);

    // Detect bass note (from bass instruments)
    let bassNote = null;
    const bassInstruments = instrumentChromas.filter(
      ic => HARMONIC_INSTRUMENTS[ic.instrument]?.category === 'bass'
    );
    if (bassInstruments.length > 0) {
      const bassChroma = bassInstruments[0].chroma;
      let maxBass = 0;
      for (let i = 0; i < 12; i++) {
        if (bassChroma[i] > maxBass) {
          maxBass = bassChroma[i];
          bassNote = i;
        }
      }
    }

    // Detect chord
    const detection = detectChordFromChroma(chromaTotal, bassNote);

    // Smooth over time
    const smoothedResult = this.smoother.update(detection.chord, detection.confidence);

    return {
      chord: smoothedResult.chord,
      confidence: smoothedResult.confidence,
      stable: smoothedResult.stable,
      chromaTotal,
      instrumentContributions: instrumentChromas.map(ic => ({
        instrument: ic.instrument,
        weight: ic.weight
      })),
      bassNote: bassNote !== null ? NOTE_NAMES[bassNote] : null
    };
  }

  /**
   * Process a frame from full mix (no stems)
   * Uses harmonic separation approximation with overlapping bands
   */
  processFullMix(frequencyData, loudness = 0.5) {
    // For full mix, extract chroma directly from different harmonic regions
    // and combine them with appropriate weighting

    // Primary chord range: 80Hz - 4kHz (covers most fundamental + harmonics)
    const primaryChroma = extractChromaFromBand(
      frequencyData,
      this.sampleRate,
      80,
      4000
    );

    // Bass region: 30-250 Hz (root note detection)
    const bassChroma = extractChromaFromBand(
      frequencyData,
      this.sampleRate,
      30,
      250
    );

    // Mid-high region: 1kHz - 6kHz (upper harmonics, helps with chord quality)
    const highChroma = extractChromaFromBand(
      frequencyData,
      this.sampleRate,
      1000,
      6000
    );

    // Combine chromas with weights
    const chromaTotal = new Float32Array(12);
    for (let i = 0; i < 12; i++) {
      // Primary has most weight, bass helps with root, high helps with quality
      chromaTotal[i] = (
        primaryChroma[i] * 0.6 +
        bassChroma[i] * 0.25 +
        highChroma[i] * 0.15
      );
    }

    // Normalize
    const maxVal = Math.max(...chromaTotal);
    if (maxVal > 0) {
      for (let i = 0; i < 12; i++) {
        chromaTotal[i] /= maxVal;
      }
    }

    // Add to history for smoothing
    if (!this.fullMixChromaHistory) {
      this.fullMixChromaHistory = [];
    }
    this.fullMixChromaHistory.push(chromaTotal);
    if (this.fullMixChromaHistory.length > this.smoothingWindow * 2) {
      this.fullMixChromaHistory.shift();
    }

    // Apply temporal smoothing
    const smoothedChroma = smoothChroma(
      this.fullMixChromaHistory,
      this.smoothingWindow
    );

    // Detect chord from combined chroma
    const chordResult = detectChordFromChroma(smoothedChroma);

    // Find bass note from bass chroma
    let bassNoteIndex = 0;
    let maxBass = 0;
    for (let i = 0; i < 12; i++) {
      if (bassChroma[i] > maxBass) {
        maxBass = bassChroma[i];
        bassNoteIndex = i;
      }
    }
    const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const bassNote = maxBass > 0.3 ? NOTE_NAMES[bassNoteIndex] : null;

    // Apply smoother for stability
    const smootherResult = this.smoother.update(chordResult.chord, chordResult.confidence);

    // Calculate instrument contributions (simulated for full mix)
    const instrumentContributions = [
      { instrument: 'primary', weight: 0.6, chroma: primaryChroma },
      { instrument: 'bass', weight: 0.25, chroma: bassChroma },
      { instrument: 'harmonics', weight: 0.15, chroma: highChroma }
    ];

    return {
      chord: smootherResult.chord,
      confidence: smootherResult.confidence,
      stable: smootherResult.stable,
      chromaTotal: smoothedChroma,
      bassNote,
      instrumentContributions,
      rawChroma: chromaTotal,
      debug: {
        primaryMax: Math.max(...primaryChroma),
        bassMax: Math.max(...bassChroma),
        highMax: Math.max(...highChroma),
        loudness
      }
    };
  }

  extractBand(frequencyData, lowFreq, highFreq) {
    const binWidth = this.sampleRate / (frequencyData.length * 2);
    const lowBin = Math.floor(lowFreq / binWidth);
    const highBin = Math.min(Math.ceil(highFreq / binWidth), frequencyData.length - 1);

    const bandData = new Uint8Array(frequencyData.length);
    for (let i = lowBin; i <= highBin; i++) {
      bandData[i] = frequencyData[i];
    }
    return bandData;
  }

  reset() {
    for (const inst of this.instruments) {
      this.chromaHistories[inst] = [];
      this.prevMagnitudes[inst] = null;
    }
    this.fullMixChromaHistory = [];
    this.smoother.reset();
  }

  // Update sample rate (e.g., when audio context changes)
  setSampleRate(sampleRate) {
    this.sampleRate = sampleRate;
  }
}

// ============================================
// CONFIDENCE CALCULATION
// ============================================

/**
 * Calculate comprehensive confidence score
 */
export function calculateConfidence(
  templateMatch,
  nonChordPenalty,
  stability,
  instrumentAgreement
) {
  // Weighted combination
  const weights = {
    templateMatch: 0.4,
    nonChordPenalty: 0.2,
    stability: 0.2,
    instrumentAgreement: 0.2
  };

  const confidence =
    templateMatch * weights.templateMatch +
    (1 - nonChordPenalty) * weights.nonChordPenalty +
    stability * weights.stability +
    instrumentAgreement * weights.instrumentAgreement;

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Calculate cross-instrument agreement
 */
export function calculateInstrumentAgreement(instrumentChromas) {
  if (instrumentChromas.length < 2) return 1;

  let totalAgreement = 0;
  let comparisons = 0;

  for (let i = 0; i < instrumentChromas.length; i++) {
    for (let j = i + 1; j < instrumentChromas.length; j++) {
      const chroma1 = instrumentChromas[i].chroma;
      const chroma2 = instrumentChromas[j].chroma;

      // Cosine similarity
      let dot = 0, mag1 = 0, mag2 = 0;
      for (let k = 0; k < 12; k++) {
        dot += chroma1[k] * chroma2[k];
        mag1 += chroma1[k] * chroma1[k];
        mag2 += chroma2[k] * chroma2[k];
      }

      const similarity = dot / (Math.sqrt(mag1) * Math.sqrt(mag2) + 1e-10);
      totalAgreement += similarity;
      comparisons++;
    }
  }

  return comparisons > 0 ? totalAgreement / comparisons : 1;
}

export default AdvancedChordDetector;
