// Rhythm Analysis Service
// Communicates with the Python FastAPI backend for AI-powered rhythm detection

import { convertToWav, needsConversion } from '../utils/audioConversion';

const RHYTHM_API_URL = 'http://localhost:56403';

/**
 * Helper to ensure file is in a compatible format for analysis
 */
async function ensureCompatibleFormat(audioFile) {
  if (needsConversion(audioFile)) {
    const result = await convertToWav(audioFile);
    return result.file;
  }
  return audioFile;
}

/**
 * Check if the rhythm analyzer service is available.
 * @returns {Promise<Object>} Health status including available methods
 */
export async function checkRhythmServiceHealth() {
  try {
    const response = await fetch(`${RHYTHM_API_URL}/health`);
    if (!response.ok) {
      return { available: false, error: 'Service unavailable' };
    }
    const data = await response.json();
    return { available: true, ...data };
  } catch (error) {
    return { available: false, error: error.message };
  }
}

/**
 * Get available analysis methods from the service.
 * @returns {Promise<Object>} Available methods for each analysis stage
 */
export async function getAvailableMethods() {
  const response = await fetch(`${RHYTHM_API_URL}/available-methods`);
  if (!response.ok) {
    throw new Error('Failed to get available methods');
  }
  return response.json();
}

/**
 * Analyze rhythm from an audio file.
 * Full pipeline: beat detection → onset detection → drum classification → swing detection
 *
 * @param {File|Blob} audioFile - The audio file to analyze
 * @param {Object} options - Analysis options
 * @param {boolean} options.useStem - Whether the audio is a separated drum stem
 * @param {boolean} options.useAI - Whether to use Gemini AI for detection (more accurate)
 * @returns {Promise<Object>} Complete rhythm analysis result
 */
export async function analyzeRhythm(audioFile, options = {}) {
  const { useStem = false, useAI = false } = options;

  // Convert if needed (AIFF, etc.)
  const compatibleFile = await ensureCompatibleFormat(audioFile);

  const formData = new FormData();
  formData.append('audio', compatibleFile, compatibleFile.name || 'audio.wav');

  // Choose endpoint based on options
  const endpoint = useAI ? '/analyze-rhythm-ai' : '/analyze-rhythm';

  if (!useAI) {
    formData.append('use_stem', useStem.toString());
  }

  const response = await fetch(`${RHYTHM_API_URL}${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Rhythm analysis failed');
  }

  return response.json();
}

/**
 * Detect only BPM, beats, and downbeats from audio.
 *
 * @param {File|Blob} audioFile - The audio file to analyze
 * @returns {Promise<Object>} Beat detection result with bpm, beats, downbeats
 */
export async function detectBeats(audioFile) {
  // Convert if needed (AIFF, etc.)
  const compatibleFile = await ensureCompatibleFormat(audioFile);

  const formData = new FormData();
  formData.append('audio', compatibleFile, compatibleFile.name || 'audio.wav');

  const response = await fetch(`${RHYTHM_API_URL}/detect-beats`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Beat detection failed');
  }

  return response.json();
}

/**
 * Classify provided onset times as drum types.
 *
 * @param {File|Blob} audioFile - The audio file
 * @param {number[]} onsetTimes - Array of onset times in seconds
 * @returns {Promise<Object>} Classification result with typed hits
 */
export async function classifyHits(audioFile, onsetTimes) {
  // Convert if needed (AIFF, etc.)
  const compatibleFile = await ensureCompatibleFormat(audioFile);

  const formData = new FormData();
  formData.append('audio', compatibleFile, compatibleFile.name || 'audio.wav');
  formData.append('onset_times', JSON.stringify(onsetTimes));

  const response = await fetch(`${RHYTHM_API_URL}/classify-hits`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Hit classification failed');
  }

  return response.json();
}

/**
 * Quantize hits to a rhythmic grid with swing awareness.
 *
 * @param {Object[]} hits - Array of drum hits
 * @param {number} bpm - Tempo in BPM
 * @param {number} downbeatOffset - Time of first downbeat in seconds
 * @param {number} swing - Swing percentage (50 = straight)
 * @param {number} quantizeStrength - Quantization amount (0-1)
 * @returns {Promise<Object>} Quantized hits with grid positions
 */
export async function quantizeToGrid(hits, bpm, downbeatOffset, swing = 50, quantizeStrength = 1.0) {
  const response = await fetch(`${RHYTHM_API_URL}/quantize-grid`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hits,
      bpm,
      downbeat_offset: downbeatOffset,
      swing,
      quantize_strength: quantizeStrength,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Grid quantization failed');
  }

  return response.json();
}

/**
 * Quantize a single instrument's hits with specific settings.
 *
 * @param {string} drumType - Type of drum (kick, snare, hihat, etc.)
 * @param {Object[]} hits - Array of hits for this instrument
 * @param {number} bpm - Tempo in BPM
 * @param {number} downbeatOffset - Time of first downbeat in seconds
 * @param {Object} settings - Per-instrument settings
 * @param {number} settings.swing - Swing percentage (50 = straight)
 * @param {number} settings.quantizeStrength - Quantization amount (0-1)
 * @param {number} settings.subdivision - Grid subdivision (4 = 16th notes)
 * @returns {Promise<Object>} Quantized hits with grid positions
 */
export async function quantizeInstrument(drumType, hits, bpm, downbeatOffset, settings) {
  const response = await fetch(`${RHYTHM_API_URL}/quantize-instrument`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      drum_type: drumType,
      hits: hits.map(h => ({
        time: h.timestamp / 1000, // Convert ms to seconds
        type: drumType,
        velocity: h.velocity || 0.8,
        confidence: h.confidence || 1.0,
      })),
      bpm,
      downbeat_offset: downbeatOffset,
      swing: settings.swing,
      quantize_strength: settings.quantizeStrength,
      subdivision: settings.subdivision,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Instrument quantization failed');
  }

  return response.json();
}

/**
 * Shift downbeat position by N beats.
 *
 * @param {number[]} beats - Array of beat times
 * @param {Object[]} downbeats - Array of downbeat objects {time, beat_position}
 * @param {number} shiftBeats - Number of beats to shift (positive = forward)
 * @returns {Promise<Object>} Updated downbeats
 */
export async function shiftDownbeat(beats, downbeats, shiftBeats) {
  const response = await fetch(`${RHYTHM_API_URL}/shift-downbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      beats,
      downbeats,
      shift_beats: shiftBeats,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Downbeat shift failed');
  }

  return response.json();
}

/**
 * Convert Python analysis results to the format used by useDrumDetection hook.
 *
 * @param {Object} analysisResult - Result from analyzeRhythm
 * @param {number} bpm - Tempo for timestamp calculation
 * @param {number} beatsPerBar - Beats per bar
 * @returns {Object} Formatted drum hits by type
 */
export function formatHitsForGrid(analysisResult, bpm, beatsPerBar = 4) {
  const hits = {
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
    tom: [],
    perc: [],
  };

  if (!analysisResult.hits || !Array.isArray(analysisResult.hits)) {
    return hits;
  }

  const beatDuration = 60 / bpm; // seconds per beat
  const downbeatTime = analysisResult.downbeats?.[0]?.time || 0;

  for (const hit of analysisResult.hits) {
    const drumType = hit.type;
    if (!hits[drumType]) continue;

    // Calculate grid position
    const relativeTime = hit.time - downbeatTime;
    const totalBeats = relativeTime / beatDuration;
    const bar = Math.floor(totalBeats / beatsPerBar);
    const beatInBar = Math.floor(totalBeats % beatsPerBar);
    const subbeat = Math.round((totalBeats % 1) * 4); // Assuming 16th note resolution

    hits[drumType].push({
      timestamp: hit.time * 1000, // Convert to ms
      confidence: hit.confidence,
      bar,
      beat: beatInBar,
      subbeat,
      isManual: false,
      isPythonAnalysis: true,
    });
  }

  return hits;
}

/**
 * Merge Python analysis results with existing JS-detected hits.
 * Python results take precedence for confident detections.
 *
 * @param {Object} pythonHits - Hits from Python analysis
 * @param {Object} jsHits - Hits from JavaScript real-time detection
 * @param {number} confidenceThreshold - Minimum confidence to prefer Python hit
 * @returns {Object} Merged hits
 */
export function mergeHits(pythonHits, jsHits, confidenceThreshold = 0.6) {
  const merged = {
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
    tom: [],
    perc: [],
  };

  const drumTypes = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];
  const mergeWindow = 50; // ms - hits within this window are considered the same

  for (const drumType of drumTypes) {
    const pyHits = pythonHits[drumType] || [];
    const jsHitsForType = jsHits[drumType] || [];

    // Start with Python hits that meet confidence threshold
    const confidentPyHits = pyHits.filter(h => h.confidence >= confidenceThreshold);
    merged[drumType] = [...confidentPyHits];

    // Add JS hits that don't overlap with Python hits
    for (const jsHit of jsHitsForType) {
      const hasOverlap = confidentPyHits.some(
        pyHit => Math.abs(pyHit.timestamp - jsHit.timestamp) < mergeWindow
      );
      if (!hasOverlap) {
        merged[drumType].push({ ...jsHit, isJsDetection: true });
      }
    }

    // Sort by timestamp
    merged[drumType].sort((a, b) => a.timestamp - b.timestamp);
  }

  return merged;
}

/**
 * Match detected drum hits against known patterns from Knowledge Lab.
 * Optimized for partial patterns (2-line detection).
 *
 * @param {Object[]} hits - Array of drum hits with {time, type}
 * @param {number} bpm - Tempo in BPM
 * @param {number} downbeatOffset - Time of first downbeat in seconds
 * @param {number} timeSignature - Beats per bar (default 4)
 * @returns {Promise<Object>} Pattern matching results with scores and suggestions
 */
export async function matchPattern(hits, bpm, downbeatOffset, timeSignature = 4) {
  const response = await fetch(`${RHYTHM_API_URL}/match-pattern`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      hits: hits.map(h => ({
        time: typeof h.timestamp === 'number' ? h.timestamp / 1000 : h.time,
        type: h.type,
        confidence: h.confidence || 1.0,
      })),
      bpm,
      downbeat_offset: downbeatOffset,
      time_signature: timeSignature,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Pattern matching failed');
  }

  return response.json();
}

/**
 * Flatten hits object into array format for pattern matching
 */
export function flattenHits(hitsObj) {
  const allHits = [];
  for (const [drumType, hits] of Object.entries(hitsObj)) {
    for (const hit of hits) {
      allHits.push({
        time: hit.timestamp / 1000,
        type: drumType,
        confidence: hit.confidence || 1.0,
      });
    }
  }
  return allHits.sort((a, b) => a.time - b.time);
}

/**
 * Predict and find quiet percussion hits using pattern-based analysis.
 * Uses mathematical prediction to find where percussion SHOULD be based on patterns,
 * then re-scans those windows with lower thresholds.
 *
 * @param {File|Blob} audioFile - The audio file to analyze
 * @param {Object[]} existingHits - Flattened array of existing hits
 * @param {number} bpm - Detected BPM
 * @param {number} audioDuration - Total audio duration in seconds
 * @param {Object} options - Prediction options
 * @param {number} options.downbeatOffset - Time of first downbeat (default 0)
 * @param {number} options.timeSignature - Beats per bar (default 4)
 * @param {number} options.startBar - Start scanning from this bar (optional)
 * @param {number} options.energyMultiplier - Lower = more sensitive (default 0.5)
 * @returns {Promise<Object>} Predicted quiet hits and analysis
 */
export async function predictQuietHits(audioFile, existingHits, bpm, audioDuration, options = {}) {
  const {
    downbeatOffset = 0,
    timeSignature = 4,
    startBar = null,
    energyMultiplier = 0.5,
  } = options;

  // Convert if needed (AIFF, etc.)
  const compatibleFile = await ensureCompatibleFormat(audioFile);

  // Prepare hits as JSON string
  const hitsJson = JSON.stringify(existingHits.map(h => ({
    time: typeof h.timestamp === 'number' ? h.timestamp / 1000 : h.time,
    type: h.type,
    confidence: h.confidence || 1.0,
  })));

  const formData = new FormData();
  formData.append('file', compatibleFile, compatibleFile.name || 'audio.wav');
  formData.append('hits', hitsJson);
  formData.append('bpm', bpm.toString());
  formData.append('downbeat_offset', downbeatOffset.toString());
  formData.append('audio_duration', audioDuration.toString());
  formData.append('time_signature', timeSignature.toString());
  if (startBar !== null) {
    formData.append('start_bar', startBar.toString());
  }
  formData.append('energy_multiplier', energyMultiplier.toString());

  const response = await fetch(`${RHYTHM_API_URL}/predict-quiet-hits`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Quiet hit prediction failed');
  }

  return response.json();
}

/**
 * Format predicted quiet hits for merging with existing hits
 */
export function formatQuietHitsForGrid(quietHitsResult, bpm, beatsPerBar = 4) {
  const hits = {
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
    tom: [],
    perc: [],
  };

  if (!quietHitsResult.all_new_hits || !Array.isArray(quietHitsResult.all_new_hits)) {
    return hits;
  }

  for (const hit of quietHitsResult.all_new_hits) {
    const drumType = hit.type;
    if (!hits[drumType]) continue;

    hits[drumType].push({
      timestamp: hit.time * 1000, // Convert to ms
      confidence: hit.confidence,
      bar: hit.bar,
      beat: Math.floor((hit.grid_position || 0) / 4),
      subbeat: (hit.grid_position || 0) % 4,
      isManual: false,
      isPythonAnalysis: true,
      isQuietHitPrediction: true,
      source: hit.source,
      energy: hit.energy,
    });
  }

  return hits;
}

// Export service object for convenience
export const rhythmAnalysisService = {
  checkHealth: checkRhythmServiceHealth,
  getAvailableMethods,
  analyzeRhythm,
  detectBeats,
  classifyHits,
  quantizeToGrid,
  quantizeInstrument,
  shiftDownbeat,
  formatHitsForGrid,
  mergeHits,
  matchPattern,
  flattenHits,
  predictQuietHits,
  formatQuietHitsForGrid,
};
