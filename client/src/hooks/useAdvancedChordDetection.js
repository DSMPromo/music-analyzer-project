/**
 * useAdvancedChordDetection Hook
 *
 * Advanced chord detection with multi-instrument weighted chroma fusion.
 * Uses stems if available, falls back to harmonic band extraction.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AdvancedChordDetector,
  HARMONIC_INSTRUMENTS,
  NON_HARMONIC_INSTRUMENTS,
  calculateInstrumentAgreement
} from '../utils/advancedChordDetection';

export function useAdvancedChordDetection(options = {}) {
  const {
    sampleRate = 44100,
    fftSize = 4096,
    smoothingWindow = 5,
    enabled = false,
    stems = null // { vocals, bass, drums, other } or null
  } = options;

  // State
  const [isEnabled, setIsEnabled] = useState(enabled);
  const [currentChord, setCurrentChord] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [chordHistory, setChordHistory] = useState([]);
  const [instrumentContributions, setInstrumentContributions] = useState([]);
  const [bassNote, setBassNote] = useState(null);
  const [chromaTotal, setChromaTotal] = useState(null);
  const [isStable, setIsStable] = useState(false);
  const [mode, setMode] = useState('full_mix'); // 'stems' or 'full_mix'

  // Refs
  const detectorRef = useRef(null);
  const analysersRef = useRef({});
  const audioContextRef = useRef(null);

  // Initialize detector
  useEffect(() => {
    detectorRef.current = new AdvancedChordDetector({
      sampleRate,
      smoothingWindow,
      smootherOptions: {
        confidenceMargin: 0.12,
        minFrames: 3,
        minDurationMs: 150
      }
    });

    return () => {
      detectorRef.current?.reset();
    };
  }, [sampleRate, smoothingWindow]);

  // Set up analysers for stems
  const setupStemAnalysers = useCallback(async (stemSources) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate
      });
    }

    const ctx = audioContextRef.current;
    const analysers = {};

    for (const [stemName, source] of Object.entries(stemSources)) {
      // Skip drums - not harmonic
      if (stemName === 'drums') continue;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = 0.3;

      // Connect source to analyser
      source.connect(analyser);

      analysers[stemName] = {
        analyser,
        dataArray: new Uint8Array(analyser.frequencyBinCount)
      };
    }

    analysersRef.current = analysers;
    setMode('stems');

    return analysers;
  }, [sampleRate, fftSize]);

  // Process frame from stems
  const processStems = useCallback(() => {
    if (!detectorRef.current || !isEnabled) return null;

    const instrumentData = {};

    for (const [stemName, { analyser, dataArray }] of Object.entries(analysersRef.current)) {
      analyser.getByteFrequencyData(dataArray);

      // Calculate loudness
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const loudness = sum / dataArray.length / 255;

      // Map stem to instrument type
      let instrumentName = stemName;
      if (stemName === 'other') instrumentName = 'keys';
      if (stemName === 'vocals') instrumentName = 'lead_vocal';

      instrumentData[instrumentName] = {
        frequencyData: dataArray,
        loudness
      };
    }

    const result = detectorRef.current.processFrame(instrumentData);

    setCurrentChord(result.chord);
    setConfidence(result.confidence);
    setIsStable(result.stable);
    setChromaTotal(result.chromaTotal);
    setInstrumentContributions(result.instrumentContributions);
    setBassNote(result.bassNote);

    // Add to history
    if (result.chord && result.stable) {
      setChordHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last ||
            last.chord.root !== result.chord.root ||
            last.chord.type !== result.chord.type) {
          return [...prev, {
            chord: result.chord,
            confidence: result.confidence,
            timestamp: Date.now()
          }].slice(-100); // Keep last 100
        }
        return prev;
      });
    }

    return result;
  }, [isEnabled]);

  // Process frame from full mix (no stems)
  const processFullMix = useCallback((analyser) => {
    if (!detectorRef.current || !isEnabled || !analyser) return null;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate loudness
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const loudness = sum / dataArray.length / 255;

    const result = detectorRef.current.processFullMix(dataArray, loudness);

    setCurrentChord(result.chord);
    setConfidence(result.confidence);
    setIsStable(result.stable);
    setChromaTotal(result.chromaTotal);
    setInstrumentContributions(result.instrumentContributions);
    setBassNote(result.bassNote);

    // Add to history
    if (result.chord && result.stable) {
      setChordHistory(prev => {
        const last = prev[prev.length - 1];
        if (!last ||
            last.chord.root !== result.chord.root ||
            last.chord.type !== result.chord.type) {
          return [...prev, {
            chord: result.chord,
            confidence: result.confidence,
            timestamp: Date.now()
          }].slice(-100);
        }
        return prev;
      });
    }

    return result;
  }, [isEnabled]);

  // Enable/disable
  const enable = useCallback(() => {
    setIsEnabled(true);
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
  }, []);

  // Reset
  const reset = useCallback(() => {
    detectorRef.current?.reset();
    setCurrentChord(null);
    setConfidence(0);
    setChordHistory([]);
    setInstrumentContributions([]);
    setBassNote(null);
    setChromaTotal(null);
    setIsStable(false);
  }, []);

  // Get chord symbol with formatting
  const getChordSymbol = useCallback(() => {
    if (!currentChord) return null;

    const { root, type } = currentChord;

    // Format type
    let typeDisplay = type;
    if (type === 'maj') typeDisplay = '';
    if (type === 'min') typeDisplay = 'm';
    if (type === 'dim') typeDisplay = '°';
    if (type === 'aug') typeDisplay = '+';
    if (type === 'hdim7') typeDisplay = 'ø7';

    return `${root}${typeDisplay}`;
  }, [currentChord]);

  // Get confidence color
  const getConfidenceColor = useCallback(() => {
    if (confidence >= 0.8) return '#4ade80'; // Green
    if (confidence >= 0.6) return '#facc15'; // Yellow
    if (confidence >= 0.4) return '#fb923c'; // Orange
    return '#ef4444'; // Red
  }, [confidence]);

  return {
    // State
    isEnabled,
    currentChord,
    confidence,
    chordHistory,
    instrumentContributions,
    bassNote,
    chromaTotal,
    isStable,
    mode,

    // Actions
    enable,
    disable,
    reset,
    setupStemAnalysers,
    processStems,
    processFullMix,

    // Helpers
    getChordSymbol,
    getConfidenceColor,

    // Config
    HARMONIC_INSTRUMENTS,
    NON_HARMONIC_INSTRUMENTS
  };
}

export default useAdvancedChordDetection;
