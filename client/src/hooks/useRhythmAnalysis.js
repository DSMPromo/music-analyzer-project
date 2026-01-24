import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  analyzeRhythm,
  detectBeats,
  checkRhythmServiceHealth,
  formatHitsForGrid,
  mergeHits,
  shiftDownbeat as shiftDownbeatApi,
  quantizeToGrid,
  quantizeInstrument,
  matchPattern,
  flattenHits,
  predictQuietHits,
  formatQuietHitsForGrid,
} from '../services/rhythmAnalysis';

/**
 * Default per-instrument swing settings
 */
const DEFAULT_SWING_SETTINGS = {
  kick: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
  snare: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
  hihat: { swing: 50, quantizeStrength: 0.75, subdivision: 16 },
  clap: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
  tom: { swing: 50, quantizeStrength: 0.8, subdivision: 8 },
  perc: { swing: 50, quantizeStrength: 0.7, subdivision: 16 },
};

/**
 * Genre presets for common rhythm styles
 */
export const GENRE_PRESETS = {
  'four-on-floor': {
    name: '4-on-Floor',
    description: 'Classic house/techno - straight kicks, light hat swing',
    settings: {
      kick: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      snare: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      hihat: { swing: 50, quantizeStrength: 0.8, subdivision: 8 },
      clap: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      tom: { swing: 50, quantizeStrength: 0.8, subdivision: 8 },
      perc: { swing: 50, quantizeStrength: 0.7, subdivision: 16 },
    },
  },
  'afro-house': {
    name: 'Afro House',
    description: 'Straight kicks, swung hats and percussion',
    settings: {
      kick: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      snare: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      hihat: { swing: 58, quantizeStrength: 0.75, subdivision: 16 },
      clap: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      tom: { swing: 54, quantizeStrength: 0.8, subdivision: 8 },
      perc: { swing: 58, quantizeStrength: 0.7, subdivision: 16 },
    },
  },
  'trap': {
    name: 'Trap',
    description: 'Loose kicks, tight snares, rolling 32nd hats',
    settings: {
      kick: { swing: 50, quantizeStrength: 0.9, subdivision: 8 },
      snare: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      hihat: { swing: 50, quantizeStrength: 0.6, subdivision: 32 },
      clap: { swing: 50, quantizeStrength: 1.0, subdivision: 4 },
      tom: { swing: 50, quantizeStrength: 0.8, subdivision: 8 },
      perc: { swing: 50, quantizeStrength: 0.7, subdivision: 16 },
    },
  },
  'breakbeat': {
    name: 'Breakbeat',
    description: 'Syncopated kicks and snares with groove',
    settings: {
      kick: { swing: 54, quantizeStrength: 0.85, subdivision: 8 },
      snare: { swing: 54, quantizeStrength: 0.85, subdivision: 8 },
      hihat: { swing: 58, quantizeStrength: 0.7, subdivision: 16 },
      clap: { swing: 54, quantizeStrength: 0.9, subdivision: 8 },
      tom: { swing: 54, quantizeStrength: 0.8, subdivision: 8 },
      perc: { swing: 58, quantizeStrength: 0.7, subdivision: 16 },
    },
  },
};

/**
 * Pattern generation templates
 */
export const PATTERN_TEMPLATES = {
  '4-on-floor': [0, 1, 2, 3], // Beats 1, 2, 3, 4
  '2-and-4': [1, 3],          // Beats 2 and 4
  'backbeat': [1, 3],         // Same as 2-and-4
  'offbeat': [0.5, 1.5, 2.5, 3.5], // Offbeats
  '8ths': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], // All 8th notes
  '16ths': Array.from({ length: 16 }, (_, i) => i / 4), // All 16th notes
};

/**
 * Analysis states for the pipeline
 */
export const ANALYSIS_STATES = {
  IDLE: 'idle',
  CHECKING_SERVICE: 'checking_service',
  ANALYZING_BEATS: 'analyzing_beats',
  DETECTING_ONSETS: 'detecting_onsets',
  CLASSIFYING_HITS: 'classifying_hits',
  COMPLETE: 'complete',
  ERROR: 'error',
  SERVICE_UNAVAILABLE: 'service_unavailable',
};

/**
 * Auto-correct BPM to typical range (90-180)
 * - If BPM < 90: double it (half-time detection)
 * - If BPM > 180: halve it (double-time detection)
 *
 * Common half-time detections:
 * - Blinding Lights: 86 BPM detected → should be 172 BPM (true: 171)
 * - Most pop/EDM: 60-89 detected → should be 120-178
 *
 * Normal range (90-180) includes:
 * - House/techno: 120-130
 * - Pop: 100-130
 * - DNB/fast EDM: 170-180
 *
 * Returns { bpm, wasAutoCorrected, correction }
 */
export function normalizeBpm(rawBpm) {
  if (!rawBpm || rawBpm <= 0) return { bpm: rawBpm, wasAutoCorrected: false, correction: null };

  let correctedBpm = rawBpm;
  let correction = null;

  // Half-time detection: BPM too slow, double it
  // Threshold 90 catches songs like Blinding Lights (detected as 86)
  if (rawBpm < 90) {
    correctedBpm = rawBpm * 2;
    correction = 'doubled';
  }
  // Double-time detection: BPM too fast, halve it
  // Threshold 180 to allow fast DNB/EDM (up to 180)
  else if (rawBpm > 180) {
    correctedBpm = rawBpm / 2;
    correction = 'halved';
  }

  return {
    bpm: Math.round(correctedBpm * 10) / 10, // Round to 1 decimal
    wasAutoCorrected: correction !== null,
    correction,
    originalBpm: rawBpm,
  };
}

/**
 * Hook for Python-based rhythm analysis.
 * Orchestrates the 3-stage pipeline: beats → onsets → classify
 *
 * Works alongside useDrumDetection for a dual-mode architecture:
 * - useDrumDetection: Real-time JS-based detection (instant preview)
 * - useRhythmAnalysis: Accurate Python-based analysis (runs in background)
 */
export function useRhythmAnalysis() {
  // Analysis state
  const [analysisState, setAnalysisState] = useState(ANALYSIS_STATES.IDLE);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisError, setAnalysisError] = useState(null);

  // Service availability
  const [serviceAvailable, setServiceAvailable] = useState(null);
  const [serviceInfo, setServiceInfo] = useState(null);

  // Rhythm data
  const [bpm, setBpm] = useState(null);
  const [bpmConfidence, setBpmConfidence] = useState(0);
  const [bpmLocked, setBpmLocked] = useState(false);
  const [bpmAutoCorrected, setBpmAutoCorrected] = useState(null); // { correction, originalBpm }
  const [beats, setBeats] = useState([]);
  const [downbeats, setDownbeats] = useState([]);
  const [timeSignature, setTimeSignature] = useState(4);
  const [hits, setHits] = useState({
    kick: [], snare: [], hihat: [], clap: [], tom: [], perc: [],
  });
  const [swing, setSwing] = useState(50);
  const [swingSettings, setSwingSettings] = useState({ ...DEFAULT_SWING_SETTINGS });
  const [analysisMethod, setAnalysisMethod] = useState(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [analysisSource, setAnalysisSource] = useState(null); // 'drums_stem' or 'full_mix'
  const [detectedGenre, setDetectedGenre] = useState(null);
  const [genreConfidence, setGenreConfidence] = useState(0);
  // Pattern filter stats
  const [patternFilterApplied, setPatternFilterApplied] = useState(false);
  const [hitsBeforeFilter, setHitsBeforeFilter] = useState(0);
  const [hitsAfterFilter, setHitsAfterFilter] = useState(0);

  // Compute global swing from per-instrument settings for backward compatibility
  const globalSwing = useMemo(() => {
    const values = Object.values(swingSettings).map(s => s.swing);
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [swingSettings]);

  // Raw analysis result for reference
  const [rawResult, setRawResult] = useState(null);

  // Fix Grid panel state
  const [isFixGridOpen, setIsFixGridOpen] = useState(false);
  const [pendingChanges, setPendingChanges] = useState(null);

  // Pattern matching state
  const [patternMatch, setPatternMatch] = useState(null);
  const [patternMatchLoading, setPatternMatchLoading] = useState(false);

  // Quiet hit prediction state
  const [isFindingQuietHits, setIsFindingQuietHits] = useState(false);
  const [quietHitResult, setQuietHitResult] = useState(null);

  // Refs
  const currentFileRef = useRef(null);
  const abortControllerRef = useRef(null);

  /**
   * Check if the Python service is available
   */
  const checkService = useCallback(async () => {
    setAnalysisState(ANALYSIS_STATES.CHECKING_SERVICE);
    try {
      const result = await checkRhythmServiceHealth();
      setServiceAvailable(result.available);
      setServiceInfo(result);
      return result.available;
    } catch (error) {
      setServiceAvailable(false);
      setServiceInfo({ error: error.message });
      return false;
    }
  }, []);

  /**
   * Run full rhythm analysis on an audio file
   * @param {File} audioFile - The audio file to analyze
   * @param {Object} options - Analysis options
   * @param {boolean} options.useStem - Use separated drums stem (default: false)
   * @param {boolean} options.useAI - Use Gemini AI for detection (more accurate, default: false)
   * @param {Object} options.mergeWithJs - Optional JS hits to merge with
   */
  const analyzeFile = useCallback(async (audioFile, options = {}) => {
    const { useStem = false, useAI = false, mergeWithJs = null } = options;

    // Reset state
    setAnalysisError(null);
    setRawResult(null);
    currentFileRef.current = audioFile;

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      // Check service availability first
      setAnalysisState(ANALYSIS_STATES.CHECKING_SERVICE);
      setAnalysisProgress(5);

      const isAvailable = await checkService();
      if (!isAvailable) {
        setAnalysisState(ANALYSIS_STATES.SERVICE_UNAVAILABLE);
        return null;
      }

      // Run full analysis
      setAnalysisState(ANALYSIS_STATES.ANALYZING_BEATS);
      setAnalysisProgress(20);

      const result = await analyzeRhythm(audioFile, { useStem, useAI });

      setAnalysisProgress(80);
      setAnalysisState(ANALYSIS_STATES.CLASSIFYING_HITS);

      // Update state with results - auto-correct BPM if needed
      const normalized = normalizeBpm(result.bpm);
      setBpm(normalized.bpm);
      setBpmAutoCorrected(normalized.wasAutoCorrected ? {
        correction: normalized.correction,
        originalBpm: normalized.originalBpm,
      } : null);
      setBpmConfidence(result.bpm_confidence);
      setBeats(result.beats);
      setDownbeats(result.downbeats);
      setTimeSignature(result.time_signature);
      setSwing(result.swing);
      setAnalysisMethod(result.analysis_method);
      setAudioDuration(result.duration);
      setAnalysisSource(result.analysis_source || 'full_mix');
      setDetectedGenre(result.detected_genre);
      setGenreConfidence(result.genre_confidence || 0);
      setPatternFilterApplied(result.pattern_filter_applied || false);
      setHitsBeforeFilter(result.hits_before_filter || 0);
      setHitsAfterFilter(result.hits_after_filter || 0);
      setRawResult(result);

      // Format hits for grid display
      const formattedHits = formatHitsForGrid(result, result.bpm, result.time_signature);

      // Optionally merge with JS-detected hits
      if (mergeWithJs) {
        const mergedHits = mergeHits(formattedHits, mergeWithJs);
        setHits(mergedHits);
      } else {
        setHits(formattedHits);
      }

      setAnalysisProgress(100);
      setAnalysisState(ANALYSIS_STATES.COMPLETE);

      return result;

    } catch (error) {
      if (error.name === 'AbortError') {
        setAnalysisState(ANALYSIS_STATES.IDLE);
        return null;
      }
      setAnalysisError(error.message);
      setAnalysisState(ANALYSIS_STATES.ERROR);
      return null;
    }
  }, [checkService]);

  /**
   * Cancel ongoing analysis
   */
  const cancelAnalysis = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setAnalysisState(ANALYSIS_STATES.IDLE);
    setAnalysisProgress(0);
  }, []);

  /**
   * Recalculate BPM from the current audio file
   */
  const recalculateBPM = useCallback(async () => {
    if (!currentFileRef.current) return;

    try {
      setAnalysisState(ANALYSIS_STATES.ANALYZING_BEATS);
      const result = await detectBeats(currentFileRef.current);

      // Auto-correct BPM if needed
      const normalized = normalizeBpm(result.bpm);
      setBpm(normalized.bpm);
      setBpmAutoCorrected(normalized.wasAutoCorrected ? {
        correction: normalized.correction,
        originalBpm: normalized.originalBpm,
      } : null);
      setBpmConfidence(result.bpm_confidence);
      setBeats(result.beats);
      setDownbeats(result.downbeats);
      setTimeSignature(result.time_signature);
      setBpmLocked(false);

      setAnalysisState(ANALYSIS_STATES.COMPLETE);
    } catch (error) {
      setAnalysisError(error.message);
      setAnalysisState(ANALYSIS_STATES.ERROR);
    }
  }, []);

  /**
   * Manually set BPM and lock it
   */
  const setManualBPM = useCallback((newBpm) => {
    setBpm(newBpm);
    setBpmLocked(true);
    setBpmAutoCorrected(null); // Clear auto-correction flag on manual edit
    setBpmConfidence(1.0); // Manual = 100% confidence
  }, []);

  /**
   * Toggle BPM lock
   */
  const toggleBpmLock = useCallback(() => {
    setBpmLocked(prev => !prev);
  }, []);

  /**
   * Shift downbeat position by N beats
   */
  const shiftDownbeatPosition = useCallback(async (shiftBeats) => {
    if (downbeats.length === 0) return;

    try {
      const result = await shiftDownbeatApi(beats, downbeats, shiftBeats);
      setDownbeats(result.downbeats);

      // Recalculate hit grid positions based on new downbeat
      if (rawResult && bpm) {
        const formattedHits = formatHitsForGrid(
          { ...rawResult, downbeats: result.downbeats },
          bpm,
          timeSignature
        );
        setHits(formattedHits);
      }
    } catch (error) {
      setAnalysisError(error.message);
    }
  }, [beats, downbeats, rawResult, bpm, timeSignature]);

  /**
   * Manually adjust swing percentage
   */
  const adjustSwing = useCallback((newSwing) => {
    setSwing(Math.max(0, Math.min(100, newSwing)));
  }, []);

  /**
   * Quantize hits to grid with current settings
   */
  const quantizeHits = useCallback(async (quantizeStrength = 1.0) => {
    if (!rawResult || !bpm || downbeats.length === 0) return;

    try {
      const allHits = rawResult.hits || [];
      const downbeatOffset = downbeats[0]?.time || 0;

      const result = await quantizeToGrid(
        allHits,
        bpm,
        downbeatOffset,
        swing,
        quantizeStrength
      );

      // Update hits with quantized positions
      const quantizedResult = {
        ...rawResult,
        hits: result.hits,
      };
      setRawResult(quantizedResult);

      const formattedHits = formatHitsForGrid(quantizedResult, bpm, timeSignature);
      setHits(formattedHits);

    } catch (error) {
      setAnalysisError(error.message);
    }
  }, [rawResult, bpm, downbeats, swing, timeSignature]);

  /**
   * Update settings for a single instrument
   */
  const updateInstrumentSettings = useCallback((drumType, settings) => {
    setSwingSettings(prev => ({
      ...prev,
      [drumType]: { ...prev[drumType], ...settings },
    }));
  }, []);

  /**
   * Quantize a single instrument with its specific settings
   */
  const quantizeSingleInstrument = useCallback(async (drumType) => {
    if (!bpm || downbeats.length === 0) return;

    const settings = swingSettings[drumType];
    const instrumentHits = hits[drumType] || [];

    if (instrumentHits.length === 0) return;

    try {
      const downbeatOffset = downbeats[0]?.time || 0;

      const result = await quantizeInstrument(
        drumType,
        instrumentHits,
        bpm,
        downbeatOffset,
        settings
      );

      // Update only this instrument's hits
      setHits(prev => ({
        ...prev,
        [drumType]: result.hits.map(h => ({
          ...h,
          timestamp: h.time * 1000,
          isPythonAnalysis: true,
          isQuantized: true,
        })),
      }));
    } catch (error) {
      setAnalysisError(error.message);
    }
  }, [swingSettings, hits, bpm, downbeats]);

  /**
   * Align downbeat to the first kick hit
   */
  const alignDownbeatToFirstKick = useCallback(() => {
    const kickHits = hits.kick || [];
    if (kickHits.length === 0 || !bpm) return;

    // Find first kick
    const firstKick = kickHits.reduce((min, hit) =>
      hit.timestamp < min.timestamp ? hit : min
    );

    // Calculate new downbeat position (in seconds)
    const newDownbeatTime = firstKick.timestamp / 1000;

    setDownbeats(prev => {
      if (prev.length === 0) {
        return [{ time: newDownbeatTime, beat_position: 1 }];
      }
      return [{ ...prev[0], time: newDownbeatTime }];
    });

    // Recalculate hit grid positions
    if (rawResult) {
      const formattedHits = formatHitsForGrid(
        { ...rawResult, downbeats: [{ time: newDownbeatTime }] },
        bpm,
        timeSignature
      );
      setHits(formattedHits);
    }
  }, [hits.kick, bpm, rawResult, timeSignature]);

  /**
   * Apply a genre preset to all instruments
   */
  const applyPreset = useCallback((presetName) => {
    const preset = GENRE_PRESETS[presetName];
    if (preset) {
      setSwingSettings({ ...preset.settings });
    }
  }, []);

  /**
   * Generate a pattern for a specific instrument
   */
  const generatePattern = useCallback((drumType, patternName, totalBars = null) => {
    if (!bpm) return;

    const beatDuration = 60000 / bpm;
    const downbeatMs = (downbeats[0]?.time || 0) * 1000;
    const barsToGenerate = totalBars || Math.ceil(audioDuration / ((beatDuration * timeSignature) / 1000)) || 8;

    const beatPositions = PATTERN_TEMPLATES[patternName] || [];
    const newHits = [];

    for (let bar = 0; bar < barsToGenerate; bar++) {
      for (const beatPos of beatPositions) {
        const timestamp = downbeatMs + (bar * timeSignature + beatPos) * beatDuration;
        newHits.push({
          timestamp,
          type: drumType,
          velocity: 0.8,
          confidence: 1.0,
          isManual: true,
          isGenerated: true,
        });
      }
    }

    setHits(prev => ({
      ...prev,
      [drumType]: newHits,
    }));
  }, [bpm, downbeats, audioDuration, timeSignature]);

  /**
   * Clear all hits for a single instrument
   */
  const clearInstrument = useCallback((drumType) => {
    setHits(prev => ({
      ...prev,
      [drumType]: [],
    }));
  }, []);

  /**
   * Snap downbeat to a specific position
   * @param {string} position - 'on-bar', 'offbeat', 'beat-2', 'beat-3', 'beat-4'
   */
  const snapToPosition = useCallback((position) => {
    if (!bpm || downbeats.length === 0) return;

    const beatDuration = 60 / bpm; // seconds per beat
    const currentDownbeat = downbeats[0]?.time || 0;

    let newDownbeatTime = currentDownbeat;

    switch (position) {
      case 'on-bar':
        // Snap to nearest bar start (quantize to bar boundary)
        const barDuration = beatDuration * timeSignature;
        newDownbeatTime = Math.round(currentDownbeat / barDuration) * barDuration;
        break;
      case 'offbeat':
        // Shift by half a beat for offbeat feel
        newDownbeatTime = currentDownbeat + (beatDuration / 2);
        break;
      case 'beat-2':
        // Shift so current position becomes beat 2 (shift back 1 beat)
        newDownbeatTime = currentDownbeat - beatDuration;
        break;
      case 'beat-3':
        // Shift so current position becomes beat 3 (shift back 2 beats)
        newDownbeatTime = currentDownbeat - (beatDuration * 2);
        break;
      case 'beat-4':
        // Shift so current position becomes beat 4 (shift back 3 beats)
        newDownbeatTime = currentDownbeat - (beatDuration * 3);
        break;
      default:
        return;
    }

    // Ensure downbeat is positive
    if (newDownbeatTime < 0) {
      newDownbeatTime = 0;
    }

    setDownbeats(prev => {
      if (prev.length === 0) {
        return [{ time: newDownbeatTime, beat_position: 1 }];
      }
      return [{ ...prev[0], time: newDownbeatTime, beat_position: 1 }];
    });

    // Recalculate hit grid positions
    if (rawResult) {
      const formattedHits = formatHitsForGrid(
        { ...rawResult, downbeats: [{ time: newDownbeatTime }] },
        bpm,
        timeSignature
      );
      setHits(formattedHits);
    }
  }, [bpm, downbeats, timeSignature, rawResult]);

  /**
   * Reclassify a specific hit
   */
  const reclassifyHit = useCallback((hitIndex, newType) => {
    setHits(prev => {
      const updated = { ...prev };

      // Find and remove from old type
      for (const drumType of Object.keys(updated)) {
        const idx = updated[drumType].findIndex((h, i) =>
          h.isPythonAnalysis && i === hitIndex
        );
        if (idx !== -1) {
          const hit = updated[drumType][idx];
          updated[drumType] = updated[drumType].filter((_, i) => i !== idx);
          // Add to new type
          updated[newType] = [...updated[newType], { ...hit, type: newType }]
            .sort((a, b) => a.timestamp - b.timestamp);
          break;
        }
      }

      return updated;
    });
  }, []);

  /**
   * Delete a specific hit
   */
  const deleteHit = useCallback((drumType, timestamp) => {
    setHits(prev => ({
      ...prev,
      [drumType]: prev[drumType].filter(h => h.timestamp !== timestamp),
    }));
  }, []);

  /**
   * Open Fix Grid panel
   */
  const openFixGrid = useCallback(() => {
    setPendingChanges({
      bpm,
      bpmLocked,
      downbeats: [...downbeats],
      swing,
      swingSettings: JSON.parse(JSON.stringify(swingSettings)),
    });
    setIsFixGridOpen(true);
  }, [bpm, bpmLocked, downbeats, swing, swingSettings]);

  /**
   * Close Fix Grid panel without applying changes
   */
  const closeFixGrid = useCallback(() => {
    setIsFixGridOpen(false);
    setPendingChanges(null);
  }, []);

  /**
   * Apply pending changes from Fix Grid
   */
  const applyFixGridChanges = useCallback(() => {
    if (!pendingChanges) return;

    setBpm(pendingChanges.bpm);
    setBpmLocked(pendingChanges.bpmLocked);
    setDownbeats(pendingChanges.downbeats);
    setSwing(pendingChanges.swing);
    if (pendingChanges.swingSettings) {
      setSwingSettings(pendingChanges.swingSettings);
    }

    setIsFixGridOpen(false);
    setPendingChanges(null);
  }, [pendingChanges]);

  /**
   * Match detected pattern against Knowledge Lab patterns
   */
  const matchPatternFromKnowledge = useCallback(async () => {
    if (!bpm || !hits || downbeats.length === 0) {
      setPatternMatch(null);
      return null;
    }

    // Check if we have any hits
    const hasHits = Object.values(hits).some(arr => arr.length > 0);
    if (!hasHits) {
      setPatternMatch(null);
      return null;
    }

    setPatternMatchLoading(true);
    try {
      const flatHits = flattenHits(hits);
      const downbeatOffset = downbeats[0]?.time || 0;

      const result = await matchPattern(flatHits, bpm, downbeatOffset, timeSignature);
      setPatternMatch(result);
      return result;
    } catch (error) {
      console.error('Pattern matching failed:', error);
      setPatternMatch(null);
      return null;
    } finally {
      setPatternMatchLoading(false);
    }
  }, [bpm, hits, downbeats, timeSignature]);

  /**
   * Find quiet percussion hits using pattern-based prediction.
   * Scans for quiet hits that may have been missed at predicted pattern positions.
   *
   * @param {File} audioFile - The audio file to scan
   * @param {Object} options - Options like startBar, energyMultiplier
   */
  const findQuietHits = useCallback(async (audioFile, options = {}) => {
    if (!bpm || !hits || !audioFile || audioDuration === 0) {
      console.warn('Cannot find quiet hits: missing BPM, hits, or audio file');
      return null;
    }

    // Check if we have any hits
    const hasHits = Object.values(hits).some(arr => arr.length > 0);
    if (!hasHits) {
      console.warn('Cannot find quiet hits: no existing hits to match patterns against');
      return null;
    }

    setIsFindingQuietHits(true);
    try {
      const flatHits = flattenHits(hits);
      const downbeatOffset = downbeats[0]?.time || 0;

      const result = await predictQuietHits(
        audioFile,
        flatHits,
        bpm,
        audioDuration,
        {
          downbeatOffset,
          timeSignature,
          startBar: options.startBar || 1,  // Factory default: start from bar 1
          energyMultiplier: options.energyMultiplier || 0.3,  // Factory default: high sensitivity
        }
      );

      setQuietHitResult(result);

      // If we found new hits, merge them into existing hits
      if (result.success && result.total_new_hits > 0) {
        const newHits = formatQuietHitsForGrid(result, bpm, timeSignature);

        // Merge new hits with existing
        setHits(prevHits => {
          const merged = { ...prevHits };
          for (const [drumType, newTypeHits] of Object.entries(newHits)) {
            if (!merged[drumType]) merged[drumType] = [];

            // Add new hits that aren't duplicates
            for (const newHit of newTypeHits) {
              const isDuplicate = merged[drumType].some(
                existing => Math.abs(existing.timestamp - newHit.timestamp) < 50
              );
              if (!isDuplicate) {
                merged[drumType].push(newHit);
              }
            }

            // Sort by timestamp
            merged[drumType].sort((a, b) => a.timestamp - b.timestamp);
          }
          return merged;
        });

        console.log(`Found ${result.total_new_hits} quiet hits:`, result.all_new_hits);
      }

      return result;
    } catch (error) {
      console.error('Quiet hit prediction failed:', error);
      setQuietHitResult({ success: false, error: error.message });
      return null;
    } finally {
      setIsFindingQuietHits(false);
    }
  }, [bpm, hits, downbeats, timeSignature, audioDuration]);

  /**
   * Reset to detected values
   */
  const resetToDetected = useCallback(() => {
    if (!rawResult) return;

    // Re-apply auto-correction on reset
    const normalized = normalizeBpm(rawResult.bpm);
    setBpm(normalized.bpm);
    setBpmAutoCorrected(normalized.wasAutoCorrected ? {
      correction: normalized.correction,
      originalBpm: normalized.originalBpm,
    } : null);
    setBpmConfidence(rawResult.bpm_confidence);
    setBpmLocked(false);
    setDownbeats(rawResult.downbeats);
    setSwing(rawResult.swing);
    setSwingSettings({ ...DEFAULT_SWING_SETTINGS });

    const formattedHits = formatHitsForGrid(rawResult, rawResult.bpm, rawResult.time_signature);
    setHits(formattedHits);
  }, [rawResult]);

  /**
   * Clear all analysis data
   */
  const clearAnalysis = useCallback(() => {
    setAnalysisState(ANALYSIS_STATES.IDLE);
    setAnalysisProgress(0);
    setAnalysisError(null);
    setBpm(null);
    setBpmConfidence(0);
    setBpmLocked(false);
    setBpmAutoCorrected(null);
    setBeats([]);
    setDownbeats([]);
    setTimeSignature(4);
    setHits({ kick: [], snare: [], hihat: [], clap: [], tom: [], perc: [] });
    setSwing(50);
    setSwingSettings({ ...DEFAULT_SWING_SETTINGS });
    setAnalysisMethod(null);
    setAudioDuration(0);
    setAnalysisSource(null);
    setDetectedGenre(null);
    setGenreConfidence(0);
    setPatternFilterApplied(false);
    setHitsBeforeFilter(0);
    setHitsAfterFilter(0);
    setRawResult(null);
    currentFileRef.current = null;
  }, []);

  // Check service availability on mount (without setting analyzing state)
  useEffect(() => {
    const checkOnMount = async () => {
      try {
        const result = await checkRhythmServiceHealth();
        setServiceAvailable(result.available);
        setServiceInfo(result);
      } catch (error) {
        setServiceAvailable(false);
        setServiceInfo({ error: error.message });
      }
    };
    checkOnMount();
  }, []);

  return {
    // Analysis state
    analysisState,
    analysisProgress,
    analysisError,
    isAnalyzing: analysisState !== ANALYSIS_STATES.IDLE &&
                 analysisState !== ANALYSIS_STATES.COMPLETE &&
                 analysisState !== ANALYSIS_STATES.ERROR &&
                 analysisState !== ANALYSIS_STATES.SERVICE_UNAVAILABLE,

    // Service info
    serviceAvailable,
    serviceInfo,

    // Rhythm data
    bpm,
    bpmConfidence,
    bpmLocked,
    bpmAutoCorrected, // { correction: 'doubled'|'halved', originalBpm }
    beats,
    downbeats,
    timeSignature,
    hits,
    swing,
    globalSwing,
    swingSettings,
    analysisMethod,
    audioDuration,
    analysisSource,
    detectedGenre,
    genreConfidence,
    // Pattern filter stats
    patternFilterApplied,
    hitsBeforeFilter,
    hitsAfterFilter,

    // Actions
    checkService,
    analyzeFile,
    cancelAnalysis,
    recalculateBPM,
    setManualBPM,
    toggleBpmLock,
    shiftDownbeatPosition,
    adjustSwing,
    quantizeHits,
    reclassifyHit,
    deleteHit,
    resetToDetected,
    clearAnalysis,

    // Per-instrument actions
    updateInstrumentSettings,
    quantizeSingleInstrument,
    alignDownbeatToFirstKick,
    snapToPosition,
    applyPreset,
    generatePattern,
    clearInstrument,

    // Fix Grid panel
    isFixGridOpen,
    pendingChanges,
    openFixGrid,
    closeFixGrid,
    applyFixGridChanges,
    setPendingChanges,

    // Pattern matching
    patternMatch,
    patternMatchLoading,
    matchPatternFromKnowledge,

    // Quiet hit prediction
    isFindingQuietHits,
    quietHitResult,
    findQuietHits,
  };
}
