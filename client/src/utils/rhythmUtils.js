// Rhythm Utilities for drum detection, tempo analysis, and pattern recognition

/**
 * Frequency bands for drum detection
 * Each drum type has specific frequency ranges that characterize it
 */
export const DRUM_FREQUENCY_BANDS = {
  kick: { low: 30, high: 200, name: 'Kick', color: '#e94560' },  // Extended high end
  snare: { low: 150, high: 500, highSnap: { low: 1500, high: 5000 }, name: 'Snare', color: '#3b82f6' },
  hihat: { low: 2500, high: 14000, name: 'Hi-Hat', color: '#f59e0b' },  // Extended range
  clap: { low: 800, high: 4000, name: 'Clap', color: '#10b981' },  // Wider range for stabs
  tom: { low: 60, high: 350, name: 'Tom', color: '#8b5cf6' },  // Extended range
  perc: { low: 300, high: 3000, name: 'Perc', color: '#ec4899' },  // Wider range
};

/**
 * Common rhythm patterns for recognition
 */
export const RHYTHM_PATTERNS = {
  'four-on-floor': {
    name: 'Four-on-Floor',
    description: 'EDM, disco, house',
    kickPattern: [1, 1, 1, 1], // hits on beats 1, 2, 3, 4
    snarePattern: [0, 1, 0, 1], // hits on beats 2, 4
  },
  'backbeat': {
    name: 'Backbeat',
    description: 'Rock, pop standard',
    kickPattern: [1, 0, 1, 0], // hits on beats 1, 3
    snarePattern: [0, 1, 0, 1], // hits on beats 2, 4
  },
  'breakbeat': {
    name: 'Breakbeat',
    description: 'Hip-hop, breaks',
    kickPattern: [1, 0, 0, 1], // syncopated
    snarePattern: [0, 1, 0, 1],
  },
  'half-time': {
    name: 'Half-Time',
    description: 'Trap, dubstep',
    kickPattern: [1, 0, 1, 0],
    snarePattern: [0, 0, 1, 0], // snare on 3 only
  },
  'shuffle': {
    name: 'Shuffle',
    description: 'Blues, swing',
    kickPattern: [1, 0, 1, 0],
    snarePattern: [0, 1, 0, 1],
    // Shuffle has triplet feel, detected separately
  },
  'custom': {
    name: 'Custom',
    description: 'Non-standard pattern',
    kickPattern: null,
    snarePattern: null,
  },
};

/**
 * Convert frequency to FFT bin index
 * @param {number} frequency - Frequency in Hz
 * @param {number} sampleRate - Audio sample rate (e.g., 44100)
 * @param {number} fftSize - FFT size (e.g., 2048)
 * @returns {number} Bin index
 */
export function frequencyToBin(frequency, sampleRate, fftSize) {
  return Math.round(frequency * fftSize / sampleRate);
}

/**
 * Get energy in a frequency band from FFT data
 * Uses RMS (root mean square) for more accurate energy measurement
 * @param {Uint8Array|Float32Array} frequencyData - FFT frequency data
 * @param {number} lowFreq - Low frequency bound in Hz
 * @param {number} highFreq - High frequency bound in Hz
 * @param {number} sampleRate - Audio sample rate
 * @param {number} fftSize - FFT size
 * @returns {number} RMS energy in the band (0-1 normalized)
 */
export function getBandEnergy(frequencyData, lowFreq, highFreq, sampleRate, fftSize) {
  const lowBin = frequencyToBin(lowFreq, sampleRate, fftSize);
  const highBin = frequencyToBin(highFreq, sampleRate, fftSize);

  let sumSquares = 0;
  let peak = 0;
  let count = 0;

  for (let i = lowBin; i <= highBin && i < frequencyData.length; i++) {
    // Normalize to 0-1 range (assuming Uint8Array with 0-255 values)
    const value = frequencyData[i] / 255;
    sumSquares += value * value;
    if (value > peak) peak = value;
    count++;
  }

  // Combine RMS and peak for better transient detection
  const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
  return (rms * 0.6 + peak * 0.4); // Weight toward peak for transients
}

/**
 * Calculate spectral flux (energy change) between two frames
 * @param {number} currentEnergy - Current frame energy
 * @param {number} previousEnergy - Previous frame energy
 * @returns {number} Spectral flux (positive values indicate onset)
 */
export function calculateSpectralFlux(currentEnergy, previousEnergy) {
  // Half-wave rectification - only positive changes (onsets)
  return Math.max(0, currentEnergy - previousEnergy);
}

/**
 * Adaptive threshold using rolling average
 * @param {number[]} history - Array of recent flux values
 * @param {number} multiplier - Threshold multiplier (higher = less sensitive)
 * @returns {number} Adaptive threshold value
 */
export function getAdaptiveThreshold(history, multiplier = 1.5) {
  if (history.length === 0) return 0;

  const mean = history.reduce((a, b) => a + b, 0) / history.length;
  const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
  const stdDev = Math.sqrt(variance);

  return mean + (stdDev * multiplier);
}

/**
 * Detect tempo using onset auto-correlation
 * @param {Array<{timestamp: number}>} onsets - Array of onset events with timestamps
 * @param {number} minBPM - Minimum BPM to detect (default 60)
 * @param {number} maxBPM - Maximum BPM to detect (default 200)
 * @returns {{bpm: number, confidence: number}} Detected tempo and confidence
 */
export function detectTempo(onsets, minBPM = 60, maxBPM = 200) {
  if (onsets.length < 4) {
    return { bpm: 120, confidence: 0 };
  }

  const timestamps = onsets.map(o => o.timestamp);

  // Calculate inter-onset intervals
  const intervals = [];
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1]);
  }

  // Test different BPM values
  let bestBPM = 120;
  let bestScore = 0;

  const minPeriodMs = 60000 / maxBPM;
  const maxPeriodMs = 60000 / minBPM;

  for (let bpm = minBPM; bpm <= maxBPM; bpm++) {
    const periodMs = 60000 / bpm;
    const score = correlateOnsets(intervals, periodMs);

    if (score > bestScore) {
      bestScore = score;
      bestBPM = bpm;
    }
  }

  // Confidence based on how well onsets align with detected period
  const confidence = Math.min(1, bestScore);

  return { bpm: bestBPM, confidence };
}

/**
 * Calculate how well onsets correlate with a given period
 * @param {number[]} intervals - Inter-onset intervals in ms
 * @param {number} periodMs - Test period in ms
 * @returns {number} Correlation score (0-1)
 */
export function correlateOnsets(intervals, periodMs) {
  if (intervals.length === 0) return 0;

  let matchCount = 0;
  const tolerance = periodMs * 0.15; // 15% tolerance

  for (const interval of intervals) {
    // Check if interval is a multiple of the period
    const ratio = interval / periodMs;
    const nearestMultiple = Math.round(ratio);

    if (nearestMultiple > 0 && nearestMultiple <= 4) {
      const expectedInterval = periodMs * nearestMultiple;
      const deviation = Math.abs(interval - expectedInterval);

      if (deviation < tolerance) {
        matchCount += 1 / nearestMultiple; // Weight shorter intervals higher
      }
    }
  }

  return matchCount / intervals.length;
}

/**
 * Quantize hits to a beat grid
 * @param {Array<{timestamp: number}>} hits - Array of drum hits
 * @param {number} bpm - Tempo in BPM
 * @param {number} beatsPerBar - Beats per bar (e.g., 4 for 4/4)
 * @param {number} subdivision - Grid subdivision (e.g., 4 for 16th notes)
 * @param {number} startTime - Start time of analysis in ms
 * @returns {boolean[]} Array of hit presence for each grid position
 */
export function quantizeToGrid(hits, bpm, beatsPerBar, subdivision = 4, startTime = 0) {
  const beatDuration = 60000 / bpm;
  const cellDuration = beatDuration / subdivision;
  const gridSize = beatsPerBar * subdivision;

  const grid = new Array(gridSize).fill(false);

  for (const hit of hits) {
    const relativeTime = hit.timestamp - startTime;
    const positionInBar = (relativeTime / cellDuration) % gridSize;
    const gridIndex = Math.round(positionInBar) % gridSize;

    if (gridIndex >= 0 && gridIndex < gridSize) {
      grid[gridIndex] = true;
    }
  }

  return grid;
}

/**
 * Detect rhythm pattern from kick and snare hits
 * @param {Array<{timestamp: number}>} kicks - Kick drum hits
 * @param {Array<{timestamp: number}>} snares - Snare drum hits
 * @param {number} bpm - Detected tempo
 * @param {number} beatsPerBar - Beats per bar
 * @returns {{pattern: string, confidence: number}} Detected pattern
 */
export function detectPattern(kicks, snares, bpm, beatsPerBar = 4) {
  // Quantize to beat level (not subdivision)
  const kickGrid = quantizeToGrid(kicks, bpm, beatsPerBar, 1);
  const snareGrid = quantizeToGrid(snares, bpm, beatsPerBar, 1);

  let bestMatch = { pattern: 'custom', score: 0 };

  for (const [patternName, patternDef] of Object.entries(RHYTHM_PATTERNS)) {
    if (patternDef.kickPattern === null) continue;

    const kickScore = compareGrids(kickGrid, patternDef.kickPattern);
    const snareScore = compareGrids(snareGrid, patternDef.snarePattern);
    const totalScore = (kickScore + snareScore) / 2;

    if (totalScore > bestMatch.score) {
      bestMatch = { pattern: patternName, score: totalScore };
    }
  }

  // Require minimum confidence
  if (bestMatch.score < 0.5) {
    return { pattern: 'custom', confidence: bestMatch.score };
  }

  return { pattern: bestMatch.pattern, confidence: bestMatch.score };
}

/**
 * Compare two boolean grids for similarity
 * @param {boolean[]} grid1 - First grid
 * @param {number[]} grid2 - Second grid (1s and 0s)
 * @returns {number} Similarity score (0-1)
 */
function compareGrids(grid1, grid2) {
  if (grid1.length !== grid2.length) return 0;

  let matches = 0;
  for (let i = 0; i < grid1.length; i++) {
    const g1 = grid1[i] ? 1 : 0;
    const g2 = grid2[i];
    if (g1 === g2) matches++;
  }

  return matches / grid1.length;
}

/**
 * Merge detected and manual hits, removing duplicates
 * @param {Array} detectedHits - Auto-detected hits
 * @param {Array} manualHits - User-added hits
 * @param {number} toleranceMs - Time tolerance for duplicate detection
 * @returns {Array} Merged hit array
 */
export function mergeHits(detectedHits, manualHits, toleranceMs = 50) {
  const merged = [...detectedHits];

  for (const manualHit of manualHits) {
    // Check if there's a detected hit at similar position
    const isDuplicate = detectedHits.some(
      detected => Math.abs(detected.timestamp - manualHit.timestamp) < toleranceMs
    );

    if (!isDuplicate) {
      merged.push({ ...manualHit, isManual: true });
    }
  }

  // Sort by timestamp
  return merged.sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Find hit at a specific grid position
 * @param {Array} hits - Array of hits
 * @param {number} bar - Bar number (0-indexed)
 * @param {number} beat - Beat within bar (0-indexed)
 * @param {number} subBeat - Subdivision within beat (0-indexed)
 * @param {number} bpm - Tempo
 * @param {number} beatsPerBar - Beats per bar
 * @param {number} subdivision - Grid subdivision
 * @param {number} toleranceMs - Time tolerance
 * @returns {Object|null} Found hit or null
 */
export function findHitAt(hits, bar, beat, subBeat, bpm, beatsPerBar, subdivision, toleranceMs = 30) {
  const beatDuration = 60000 / bpm;
  const cellDuration = beatDuration / subdivision;

  const targetTime = (bar * beatsPerBar + beat + subBeat / subdivision) * beatDuration;

  return hits.find(hit => Math.abs(hit.timestamp - targetTime) < toleranceMs) || null;
}

/**
 * Convert a grid position to timestamp
 * @param {number} bar - Bar number
 * @param {number} beat - Beat within bar
 * @param {number} subBeat - Subdivision within beat
 * @param {number} bpm - Tempo
 * @param {number} beatsPerBar - Beats per bar
 * @param {number} subdivision - Grid subdivision
 * @returns {number} Timestamp in ms
 */
export function gridPositionToTimestamp(bar, beat, subBeat, bpm, beatsPerBar, subdivision) {
  const beatDuration = 60000 / bpm;
  const barDuration = beatDuration * beatsPerBar;
  const cellDuration = beatDuration / subdivision;

  return bar * barDuration + beat * beatDuration + subBeat * cellDuration;
}

/**
 * Convert timestamp to grid position
 * @param {number} timestamp - Timestamp in ms
 * @param {number} bpm - Tempo
 * @param {number} beatsPerBar - Beats per bar
 * @param {number} subdivision - Grid subdivision
 * @returns {{bar: number, beat: number, subBeat: number}}
 */
export function timestampToGridPosition(timestamp, bpm, beatsPerBar, subdivision) {
  const beatDuration = 60000 / bpm;
  const barDuration = beatDuration * beatsPerBar;
  const cellDuration = beatDuration / subdivision;

  const bar = Math.floor(timestamp / barDuration);
  const remainingAfterBar = timestamp - bar * barDuration;
  const beat = Math.floor(remainingAfterBar / beatDuration);
  const remainingAfterBeat = remainingAfterBar - beat * beatDuration;
  const subBeat = Math.floor(remainingAfterBeat / cellDuration);

  return { bar, beat, subBeat };
}

/**
 * Process tap tempo inputs to calculate BPM
 * @param {number[]} tapTimes - Array of tap timestamps
 * @param {number} maxHistory - Maximum taps to consider
 * @returns {{bpm: number, confidence: number}} Calculated BPM
 */
export function processTapTempo(tapTimes, maxHistory = 8) {
  if (tapTimes.length < 2) {
    return { bpm: 0, confidence: 0 };
  }

  // Use last N taps
  const recentTaps = tapTimes.slice(-maxHistory);

  // Calculate intervals
  const intervals = [];
  for (let i = 1; i < recentTaps.length; i++) {
    intervals.push(recentTaps[i] - recentTaps[i - 1]);
  }

  // Average interval
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const bpm = Math.round(60000 / avgInterval);

  // Confidence based on consistency of taps
  const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
  const stdDev = Math.sqrt(variance);
  const consistency = 1 - Math.min(1, stdDev / avgInterval);

  return {
    bpm: Math.max(30, Math.min(300, bpm)),
    confidence: consistency
  };
}

// ===== MIDI EXPORT FUNCTIONS =====

/**
 * General MIDI Drum Map (Channel 10)
 * Maps drum types to standard GM drum notes
 */
export const GM_DRUM_MAP = {
  kick: 36,   // C1 - Bass Drum 1
  snare: 38,  // D1 - Acoustic Snare
  hihat: 42,  // F#1 - Closed Hi-Hat
  clap: 39,   // D#1 - Hand Clap
  tom: 45,    // A1 - Low Tom
  perc: 56,   // G#2 - Cowbell (general percussion)
};

/**
 * Alternative mapping for melodic samplers (piano roll style)
 * Maps drums to chromatic notes starting from C2
 */
export const MELODIC_DRUM_MAP = {
  kick: 36,   // C2
  snare: 38,  // D2
  hihat: 40,  // E2
  clap: 41,   // F2
  tom: 43,    // G2
  perc: 45,   // A2
};

/**
 * Write a variable-length quantity (VLQ) for MIDI
 * @param {number} value - Value to encode
 * @returns {number[]} Array of bytes
 */
function writeVLQ(value) {
  if (value < 0) value = 0;

  const bytes = [];
  bytes.push(value & 0x7F);

  while (value > 0x7F) {
    value >>= 7;
    bytes.unshift((value & 0x7F) | 0x80);
  }

  return bytes;
}

/**
 * Convert drum hits to MIDI file bytes
 * @param {Object} drumHits - Drum hits by type { kick: [], snare: [], ... }
 * @param {number} bpm - Tempo in BPM
 * @param {number} beatsPerBar - Beats per bar
 * @param {number} bars - Number of bars to export
 * @param {boolean} useMelodicMap - Use melodic mapping instead of GM drums
 * @returns {Uint8Array} MIDI file bytes
 */
export function exportDrumMidi(drumHits, bpm, beatsPerBar = 4, bars = 4, useMelodicMap = false) {
  const ticksPerBeat = 480; // Standard MIDI resolution
  const drumMap = useMelodicMap ? MELODIC_DRUM_MAP : GM_DRUM_MAP;
  const channel = useMelodicMap ? 0 : 9; // Channel 10 (0-indexed as 9) for GM drums

  // Collect all MIDI events
  const events = [];

  // Convert each drum type's hits to MIDI notes
  for (const [drumType, hits] of Object.entries(drumHits)) {
    const noteNumber = drumMap[drumType];
    if (noteNumber === undefined) continue;

    for (const hit of hits) {
      // Convert timestamp (ms) to MIDI ticks
      const ticksPerMs = (ticksPerBeat * bpm) / 60000;
      const startTick = Math.round(hit.timestamp * ticksPerMs);

      // Only include hits within our bar range
      const maxTick = bars * beatsPerBar * ticksPerBeat;
      if (startTick >= maxTick) continue;

      // Velocity from hit data (0-127 range)
      const velocity = Math.round((hit.velocity || 0.8) * 127);

      // Note duration (1/16 note = ticksPerBeat / 4)
      const duration = Math.round(ticksPerBeat / 4);

      events.push({
        tick: startTick,
        type: 'noteOn',
        channel,
        note: noteNumber,
        velocity,
      });

      events.push({
        tick: startTick + duration,
        type: 'noteOff',
        channel,
        note: noteNumber,
        velocity: 0,
      });
    }
  }

  // Sort events by tick time
  events.sort((a, b) => a.tick - b.tick);

  // Build MIDI track data
  const trackData = [];

  // Tempo meta event (at tick 0)
  const microsecondsPerBeat = Math.round(60000000 / bpm);
  trackData.push(
    0x00, // Delta time
    0xFF, 0x51, 0x03, // Tempo meta event
    (microsecondsPerBeat >> 16) & 0xFF,
    (microsecondsPerBeat >> 8) & 0xFF,
    microsecondsPerBeat & 0xFF
  );

  // Time signature meta event
  trackData.push(
    0x00, // Delta time
    0xFF, 0x58, 0x04, // Time signature meta event
    beatsPerBar, // Numerator
    0x02, // Denominator (2 = quarter note)
    0x18, // Clocks per metronome click
    0x08  // 32nd notes per quarter note
  );

  // Track name
  const trackName = useMelodicMap ? 'Drum Pattern (Melodic)' : 'Drum Pattern (GM)';
  const nameBytes = Array.from(trackName).map(c => c.charCodeAt(0));
  trackData.push(0x00, 0xFF, 0x03, nameBytes.length, ...nameBytes);

  // Convert events to MIDI bytes
  let lastTick = 0;
  for (const event of events) {
    const deltaTick = event.tick - lastTick;
    lastTick = event.tick;

    // Delta time as VLQ
    trackData.push(...writeVLQ(deltaTick));

    if (event.type === 'noteOn') {
      trackData.push(0x90 | event.channel, event.note, event.velocity);
    } else if (event.type === 'noteOff') {
      trackData.push(0x80 | event.channel, event.note, 0);
    }
  }

  // End of track
  trackData.push(0x00, 0xFF, 0x2F, 0x00);

  // Build complete MIDI file
  const midiFile = [];

  // Header chunk
  midiFile.push(
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // Header length (6 bytes)
    0x00, 0x00, // Format type 0 (single track)
    0x00, 0x01, // Number of tracks (1)
    (ticksPerBeat >> 8) & 0xFF, ticksPerBeat & 0xFF // Ticks per beat
  );

  // Track chunk
  midiFile.push(
    0x4D, 0x54, 0x72, 0x6B, // "MTrk"
    (trackData.length >> 24) & 0xFF,
    (trackData.length >> 16) & 0xFF,
    (trackData.length >> 8) & 0xFF,
    trackData.length & 0xFF,
    ...trackData
  );

  return new Uint8Array(midiFile);
}

/**
 * Download MIDI file
 * @param {Uint8Array} midiData - MIDI file bytes
 * @param {string} filename - Filename without extension
 */
export function downloadMidiFile(midiData, filename = 'drum-pattern') {
  const blob = new Blob([midiData], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
