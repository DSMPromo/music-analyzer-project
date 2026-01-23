import { useState, useCallback, useRef } from 'react';
import {
  DRUM_FREQUENCY_BANDS,
  getBandEnergy,
  detectTempo,
  detectPattern,
  gridPositionToTimestamp,
  processTapTempo,
} from '../utils/rhythmUtils';

const DRUM_TYPES = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];
const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;

// Drum-specific detection settings
// Uses both absolute energy threshold AND spectral flux for better detection
const DRUM_SETTINGS = {
  kick: { energyThreshold: 0.15, minInterval: 60, priority: 1 },
  snare: { energyThreshold: 0.12, minInterval: 50, priority: 2 },
  hihat: { energyThreshold: 0.08, minInterval: 20, priority: 3 },
  clap: { energyThreshold: 0.10, minInterval: 60, priority: 4 },
  tom: { energyThreshold: 0.12, minInterval: 80, priority: 5 },
  perc: { energyThreshold: 0.08, minInterval: 30, priority: 6 },
};

// Drums that conflict - only trigger the strongest one in each group
const CONFLICT_GROUPS = [
  ['kick', 'tom'],           // Low frequencies overlap
  ['snare', 'clap'],         // Mid frequencies with transients
];

/**
 * Hook for drum detection, tempo analysis, and rhythm pattern recognition
 * @param {number} initialTempo - Initial tempo in BPM (default 120)
 * @param {string} timeSignature - Time signature (default '4/4')
 */
export function useDrumDetection(initialTempo = 120, timeSignature = '4/4') {
  // Drum hits state - separate detected and manual
  const [drumHits, setDrumHits] = useState({
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
    tom: [],
    perc: [],
  });

  const [manualHits, setManualHits] = useState({
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
    tom: [],
    perc: [],
  });

  // Tempo and pattern state
  const [detectedTempo, setDetectedTempo] = useState(initialTempo);
  const [manualTempo, setManualTempo] = useState(null);
  const [tempoConfidence, setTempoConfidence] = useState(0);
  const [detectedPattern, setDetectedPattern] = useState('custom');
  const [patternConfidence, setPatternConfidence] = useState(0);

  // Playback position
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentBar, setCurrentBar] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Refs for analysis state
  const previousEnergies = useRef({
    kick: 0,
    snare: 0,
    hihat: 0,
    clap: 0,
    tom: 0,
    perc: 0,
  });

  const lastHitTimes = useRef({
    kick: 0,
    snare: 0,
    hihat: 0,
    clap: 0,
    tom: 0,
    perc: 0,
  });

  const tapHistory = useRef([]);
  const analysisStartTime = useRef(0);

  // Parse time signature
  const beatsPerBar = parseInt(timeSignature.split('/')[0], 10) || 4;

  /**
   * Get effective tempo (manual override or detected)
   */
  const tempo = manualTempo !== null ? manualTempo : detectedTempo;

  /**
   * Analyze a single FFT frame for drum hits
   * Uses simple energy threshold detection - more reliable than spectral flux
   * @param {Uint8Array} frequencyData - FFT frequency data
   * @param {number} currentTimeMs - Current playback time in ms
   */
  const analyzeFrame = useCallback((frequencyData, currentTimeMs) => {
    if (!frequencyData || frequencyData.length === 0) return;

    const candidates = {};

    for (const drumType of DRUM_TYPES) {
      const bands = DRUM_FREQUENCY_BANDS[drumType];
      const settings = DRUM_SETTINGS[drumType];

      // Get energy for this drum type
      let energy = getBandEnergy(
        frequencyData,
        bands.low,
        bands.high,
        SAMPLE_RATE,
        FFT_SIZE
      );

      // For snare, also check high frequency snap
      if (drumType === 'snare' && bands.highSnap) {
        const snapEnergy = getBandEnergy(
          frequencyData,
          bands.highSnap.low,
          bands.highSnap.high,
          SAMPLE_RATE,
          FFT_SIZE
        );
        energy = (energy * 0.5 + snapEnergy * 0.5);
      }

      // Check time since last hit
      const timeSinceLastHit = currentTimeMs - lastHitTimes.current[drumType];
      const prevEnergy = previousEnergies.current[drumType];

      // Detect onset: energy above threshold AND rising (not sustaining)
      const isRising = energy > prevEnergy * 1.2; // Energy increased by 20%
      const isAboveThreshold = energy > settings.energyThreshold;
      const enoughTimePassed = timeSinceLastHit > settings.minInterval;

      previousEnergies.current[drumType] = energy;

      if (isAboveThreshold && isRising && enoughTimePassed) {
        candidates[drumType] = {
          energy,
          score: energy / settings.energyThreshold,
        };
      }
    }

    // Resolve conflicts - only keep the strongest in each conflict group
    const newHits = {};
    const suppressed = new Set();

    for (const group of CONFLICT_GROUPS) {
      const groupCandidates = group.filter(d => candidates[d] && !suppressed.has(d));

      if (groupCandidates.length > 1) {
        let best = groupCandidates[0];
        let bestEnergy = candidates[best].energy;

        for (const drumType of groupCandidates) {
          if (candidates[drumType].energy > bestEnergy) {
            best = drumType;
            bestEnergy = candidates[drumType].energy;
          }
        }

        for (const drumType of groupCandidates) {
          if (drumType !== best) {
            suppressed.add(drumType);
          }
        }
      }
    }

    // Create hits for non-suppressed candidates
    for (const drumType of Object.keys(candidates)) {
      if (suppressed.has(drumType)) continue;

      const candidate = candidates[drumType];
      lastHitTimes.current[drumType] = currentTimeMs;

      newHits[drumType] = {
        timestamp: currentTimeMs,
        confidence: Math.min(1, candidate.score),
        velocity: Math.min(1, candidate.energy * 1.5),
        isManual: false,
      };
    }

    // Batch update if we have new hits
    if (Object.keys(newHits).length > 0) {
      setDrumHits(prev => {
        const updated = { ...prev };
        for (const [drumType, hit] of Object.entries(newHits)) {
          updated[drumType] = [...prev[drumType], hit];
        }
        return updated;
      });
    }

    // Update playback position
    const beatDuration = 60000 / tempo;
    const totalBeats = currentTimeMs / beatDuration;
    const beat = totalBeats % beatsPerBar;
    const bar = Math.floor(totalBeats / beatsPerBar);

    setCurrentBeat(beat);
    setCurrentBar(bar);
  }, [tempo, beatsPerBar]);

  /**
   * Update tempo and pattern detection periodically
   */
  const updateTempoAndPattern = useCallback(() => {
    // Collect all onsets for tempo detection
    const allOnsets = [
      ...drumHits.kick,
      ...drumHits.snare,
      ...drumHits.hihat,
    ].sort((a, b) => a.timestamp - b.timestamp);

    if (allOnsets.length >= 8) {
      const { bpm, confidence } = detectTempo(allOnsets, 60, 200);
      if (confidence > 0.3) {
        setDetectedTempo(bpm);
        setTempoConfidence(confidence);
      }
    }

    // Detect pattern
    if (drumHits.kick.length >= 4 && drumHits.snare.length >= 2) {
      const { pattern, confidence } = detectPattern(
        drumHits.kick,
        drumHits.snare,
        tempo,
        beatsPerBar
      );
      setDetectedPattern(pattern);
      setPatternConfidence(confidence);
    }
  }, [drumHits, tempo, beatsPerBar]);

  /**
   * Start drum analysis
   */
  const startAnalysis = useCallback(() => {
    analysisStartTime.current = Date.now();
    setIsAnalyzing(true);

    // Reset histories
    for (const drumType of DRUM_TYPES) {
      lastHitTimes.current[drumType] = 0;
      previousEnergies.current[drumType] = 0;
    }
  }, []);

  /**
   * Stop drum analysis
   */
  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    updateTempoAndPattern();
  }, [updateTempoAndPattern]);

  /**
   * Reset all analysis data
   */
  const resetAnalysis = useCallback(() => {
    setDrumHits({
      kick: [],
      snare: [],
      hihat: [],
      clap: [],
      tom: [],
      perc: [],
    });
    setManualHits({
      kick: [],
      snare: [],
      hihat: [],
      clap: [],
      tom: [],
      perc: [],
    });
    setDetectedTempo(initialTempo);
    setManualTempo(null);
    setTempoConfidence(0);
    setDetectedPattern('custom');
    setPatternConfidence(0);
    setCurrentBeat(0);
    setCurrentBar(0);
    setIsAnalyzing(false);

    for (const drumType of DRUM_TYPES) {
      lastHitTimes.current[drumType] = 0;
      previousEnergies.current[drumType] = 0;
    }

    tapHistory.current = [];
  }, [initialTempo]);

  /**
   * Add a manual hit
   * @param {string} drumType - Type of drum
   * @param {number} bar - Bar number
   * @param {number} beat - Beat within bar
   * @param {number} subBeat - Subdivision within beat
   * @param {number} subdivision - Grid subdivision (default 4)
   */
  const addHit = useCallback((drumType, bar, beat, subBeat, subdivision = 4) => {
    const timestamp = gridPositionToTimestamp(bar, beat, subBeat, tempo, beatsPerBar, subdivision);

    const hit = {
      timestamp,
      confidence: 1.0,
      velocity: 0.8,
      isManual: true,
      bar,
      beat,
      subBeat,
    };

    setManualHits(prev => ({
      ...prev,
      [drumType]: [...prev[drumType], hit],
    }));
  }, [tempo, beatsPerBar]);

  /**
   * Remove a hit (manual or detected)
   * @param {string} drumType - Type of drum
   * @param {number} timestamp - Hit timestamp
   * @param {boolean} isManual - Whether to remove from manual or detected hits
   */
  const removeHit = useCallback((drumType, timestamp, isManual = false) => {
    const tolerance = 50; // ms

    if (isManual) {
      setManualHits(prev => ({
        ...prev,
        [drumType]: prev[drumType].filter(
          hit => Math.abs(hit.timestamp - timestamp) > tolerance
        ),
      }));
    } else {
      setDrumHits(prev => ({
        ...prev,
        [drumType]: prev[drumType].filter(
          hit => Math.abs(hit.timestamp - timestamp) > tolerance
        ),
      }));
    }
  }, []);

  /**
   * Clear all hits of a specific drum type
   * @param {string} drumType - Type of drum to clear
   */
  const clearRow = useCallback((drumType) => {
    setDrumHits(prev => ({
      ...prev,
      [drumType]: [],
    }));
    setManualHits(prev => ({
      ...prev,
      [drumType]: [],
    }));
  }, []);

  /**
   * Clear all hits
   */
  const clearAll = useCallback(() => {
    setDrumHits({
      kick: [],
      snare: [],
      hihat: [],
      clap: [],
      tom: [],
      perc: [],
    });
    setManualHits({
      kick: [],
      snare: [],
      hihat: [],
      clap: [],
      tom: [],
      perc: [],
    });
    setDetectedPattern('custom');
    setPatternConfidence(0);
  }, []);

  /**
   * Set tempo manually (overrides detected tempo)
   * @param {number} bpm - New tempo in BPM
   */
  const setTempo = useCallback((bpm) => {
    const validBpm = Math.max(30, Math.min(300, bpm));
    setManualTempo(validBpm);
  }, []);

  /**
   * Record a tap for tap-tempo
   */
  const tapTempo = useCallback(() => {
    const now = Date.now();
    tapHistory.current.push(now);

    // Keep only recent taps (within 5 seconds)
    const recentTime = now - 5000;
    tapHistory.current = tapHistory.current.filter(t => t > recentTime);

    const { bpm, confidence } = processTapTempo(tapHistory.current);

    if (bpm > 0 && confidence > 0.3) {
      setManualTempo(bpm);
      setTempoConfidence(confidence);
    }
  }, []);

  /**
   * Update current playback position
   * @param {number} timeMs - Current playback time in ms
   */
  const updatePlaybackPosition = useCallback((timeMs) => {
    const beatDuration = 60000 / tempo;
    const totalBeats = timeMs / beatDuration;
    const beat = totalBeats % beatsPerBar;
    const bar = Math.floor(totalBeats / beatsPerBar);

    setCurrentBeat(beat);
    setCurrentBar(bar);
  }, [tempo, beatsPerBar]);

  /**
   * Get all hits merged (detected + manual)
   */
  const getAllHits = useCallback(() => {
    const merged = {};
    for (const drumType of DRUM_TYPES) {
      merged[drumType] = [
        ...drumHits[drumType].map(h => ({ ...h, isManual: false })),
        ...manualHits[drumType].map(h => ({ ...h, isManual: true })),
      ].sort((a, b) => a.timestamp - b.timestamp);
    }
    return merged;
  }, [drumHits, manualHits]);

  return {
    // Detection state
    drumHits: getAllHits(),
    detectedTempo,
    tempo, // Effective tempo (manual or detected)
    tempoConfidence,
    detectedPattern,
    patternConfidence,

    // Playback position
    currentBeat,
    currentBar,
    isAnalyzing,

    // Actions
    analyzeFrame,
    startAnalysis,
    stopAnalysis,
    resetAnalysis,
    updatePlaybackPosition,

    // Interactive editing
    addHit,
    removeHit,
    clearRow,
    clearAll,

    // Tempo control
    setTempo,
    tapTempo,
  };
}

export default useDrumDetection;
