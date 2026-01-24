import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import './App.css';
// Audio components
import AudioInputManager from './components/audio/AudioInputManager';
import AudioOptimizer from './components/audio/AudioOptimizer';
// Spectrogram components
import SpectrumAnalyzer from './components/spectrogram/SpectrumAnalyzer';
import SpectrogramView from './components/spectrogram/SpectrogramView';
// Analysis components
import AudioAnalyzer from './components/analysis/AudioAnalyzer';
import AnalysisHistory from './components/analysis/AnalysisHistory';
// Mix components
import MixAnalysisPanel from './components/mix/MixAnalysisPanel';
import LoudnessTimeline from './components/mix/LoudnessTimeline';
import ReferenceCompare from './components/mix/ReferenceCompare';
import GeminiMixAnalyzer from './components/mix/GeminiMixAnalyzer';
// Chord components
import ChordDetector from './components/chord/ChordDetector';
// MIDI components
import MIDIGenerator from './components/midi/MIDIGenerator';
// Stem components
import StemSeparator from './components/stem/StemSeparator';
// Rhythm components
import FixGridPanel from './components/rhythm/FixGridPanel';
import RhythmGrid from './components/rhythm/RhythmGrid';
import RhythmGridPro from './components/rhythm/RhythmGridPro';
import RhythmVerificationPanel from './components/rhythm/RhythmVerificationPanel';
// Verification components
import VerificationController from './components/verification/VerificationController';
// Knowledge components
import { KnowledgeLab } from './components/knowledge';
import PersonalKnowledge from './components/knowledge/PersonalKnowledge';
// Ticket components
import TicketManager, { TicketBadge } from './components/ticket/TicketManager';
// Shared components
import DevModeGuidance from './components/shared/DevModeGuidance';
// Hooks
import { useAudioContext } from './hooks/useAudioContext';
import { useFFTAnalysis } from './hooks/useFFTAnalysis';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import { useMixAnalysis } from './hooks/useMixAnalysis';
import { useDrumDetection } from './hooks/useDrumDetection';
import { useRhythmAnalysis, ANALYSIS_STATES } from './hooks/useRhythmAnalysis';
import { useAnalysisCache } from './hooks/useAnalysisCache';
import { useChordDetection } from './hooks/useChordDetection';
import { useVerificationWorkflow } from './hooks/useVerificationWorkflow';
// Utils
import { generateFileFingerprint } from './utils/analysisCache';
import { STAGES, STAGE_STATUS } from './utils/verificationUtils';

function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [detectedKey, setDetectedKey] = useState(null);
  const [estimatedTempo, setEstimatedTempo] = useState(null);
  const [staticPeakFreq, setStaticPeakFreq] = useState(null);
  const [staticRmsLevel, setStaticRmsLevel] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiQuery, setAiQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Ticket manager state
  const [showTicketManager, setShowTicketManager] = useState(false);
  const [openTicketCount, setOpenTicketCount] = useState(0);

  // Rhythm verification panel state
  const [showVerificationPanel, setShowVerificationPanel] = useState(false);

  // Developer Mode state
  const [devModeEnabled, setDevModeEnabled] = useState(false);
  const [testSongPath] = useState('/Users/iggy/Am/01 Blinding Lights.aif');

  const audioRef = useRef(null);
  const sourceRef = useRef(null);

  // Audio buffer for spectrogram (decoded from file)
  const [audioBuffer, setAudioBuffer] = useState(null);

  const { audioContext, analyser, initAudio, connectSource } = useAudioContext();

  // Spectrogram generator hook
  const {
    isGenerating: isGeneratingSpectrogram,
    progress: spectrogramProgress,
    spectrogramData,
    generateSpectrogram,
    clearSpectrogram
  } = useSpectrogramGenerator();

  // Mix analysis hook
  const {
    isAnalyzing: isAnalyzingMix,
    progress: mixAnalysisProgress,
    analysisResults: mixAnalysisResults,
    referenceBuffer,
    referenceSpectrogram,
    comparisonResults,
    analyzeMix,
    loadReferenceTrack,
    clearReference,
    getProblemMarkers
  } = useMixAnalysis();
  const {
    frequencyData,
    chromagram,
    chromagramByOctave,
    peakFrequency,
    rmsLevel,
    startAnalysis,
    stopAnalysis,
    isAnalyzing
  } = useFFTAnalysis();

  // Drum detection hook
  const {
    drumHits,
    tempo: drumTempo,
    tempoConfidence: drumTempoConfidence,
    detectedPattern,
    patternConfidence,
    analyzeFrame: analyzeDrumFrame,
    startAnalysis: startDrumAnalysis,
    stopAnalysis: stopDrumAnalysis,
    resetAnalysis: resetDrumAnalysis,
    updatePlaybackPosition,
    addHit: addDrumHit,
    removeHit: removeDrumHit,
    clearRow: clearDrumRow,
    clearAll: clearAllDrums,
    setTempo: setDrumTempo,
    tapTempo,
  } = useDrumDetection(estimatedTempo || 120);

  // Python rhythm analysis hook (accurate, runs in background)
  const {
    analysisState: rhythmAnalysisState,
    analysisProgress: rhythmProgress,
    analysisError: rhythmError,
    isAnalyzing: isRhythmAnalyzing,
    serviceAvailable: rhythmServiceAvailable,
    bpm: pythonBpm,
    bpmConfidence: pythonBpmConfidence,
    bpmLocked: pythonBpmLocked,
    bpmAutoCorrected: pythonBpmAutoCorrected,
    beats: pythonBeats,
    downbeats: pythonDownbeats,
    timeSignature: pythonTimeSignature,
    hits: pythonHits,
    swing: pythonSwing,
    swingSettings: pythonSwingSettings,
    analysisMethod: rhythmAnalysisMethod,
    analysisSource: rhythmAnalysisSource,
    detectedGenre: rhythmDetectedGenre,
    genreConfidence: rhythmGenreConfidence,
    patternFilterApplied: rhythmPatternFilterApplied,
    hitsBeforeFilter: rhythmHitsBeforeFilter,
    hitsAfterFilter: rhythmHitsAfterFilter,
    analyzeFile: analyzeRhythmFile,
    recalculateBPM: recalculateRhythmBPM,
    setManualBPM: setRhythmManualBPM,
    toggleBpmLock: toggleRhythmBpmLock,
    shiftDownbeatPosition,
    adjustSwing,
    resetToDetected: resetRhythmToDetected,
    clearAnalysis: clearRhythmAnalysis,
    replaceHits: replaceRhythmHits,
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
    pendingChanges: fixGridPendingChanges,
    openFixGrid,
    closeFixGrid,
    applyFixGridChanges,
    setPendingChanges: setFixGridPendingChanges,
    // Pattern matching
    patternMatch,
    patternMatchLoading,
    matchPatternFromKnowledge,
    // Quiet hit prediction
    isFindingQuietHits,
    quietHitResult,
    findQuietHits,
  } = useRhythmAnalysis();

  // Use Python results when available, fall back to JS detection
  const usePythonRhythm = rhythmAnalysisState === ANALYSIS_STATES.COMPLETE && pythonBpm;
  const effectiveDrumHits = usePythonRhythm ? pythonHits : drumHits;
  const effectiveTempo = usePythonRhythm ? pythonBpm : drumTempo;
  const effectiveTempoConfidence = usePythonRhythm ? pythonBpmConfidence : drumTempoConfidence;

  // Chord detection hook (for verification system)
  const {
    currentChord: appCurrentChord,
    chordHistory: appChordHistory,
    analyzeChromagram: appAnalyzeChromagram,
    clearHistory: appClearChordHistory,
    verificationData: chordVerificationData,
  } = useChordDetection();

  // Verification workflow hook
  const verificationWorkflow = useVerificationWorkflow();

  // Analysis cache hook
  const {
    history: analysisHistory,
    isLoading: isCacheLoading,
    currentCacheId,
    checkCache,
    cacheAnalysis,
    loadFromHistory,
    deleteFromHistory,
    clearHistory,
    updateCache,
  } = useAnalysisCache();

  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [cacheEnabled, setCacheEnabled] = useState(true);

  // Memory management constants
  const MAX_AI_SUGGESTIONS = 50;

  // Clear accumulated analysis state to prevent memory leaks
  const clearAnalysisState = useCallback(() => {
    setAudioBuffer(null);
    setAiSuggestions([]);
    setDetectedKey(null);
    setEstimatedTempo(null);
    setStaticPeakFreq(null);
    setStaticRmsLevel(null);
    clearSpectrogram();
  }, [clearSpectrogram]);

  const handleAudioSelect = async (file, forceReanalyze = false) => {
    setAudioFile(file);

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setLoadedFromCache(false);

    // Import and use conversion utility
    const { convertToWav } = await import('./utils/audioConversion');

    // Create object URL for audio playback (converts if needed)
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    let url;
    let fileForDecoding = file;

    try {
      const result = await convertToWav(file);
      url = result.url;
      fileForDecoding = result.file;
    } catch (err) {
      console.error('Conversion error:', err);
      url = URL.createObjectURL(file);
    }

    setAudioUrl(url);

    // First, decode audio to get duration for cache lookup
    let decodedBuffer = null;
    let tempContext = null;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      tempContext = new AudioContextClass({ sampleRate: 44100 });
      const arrayBuffer = await fileForDecoding.arrayBuffer();
      decodedBuffer = await tempContext.decodeAudioData(arrayBuffer);
    } catch (err) {
      console.error('Error decoding audio:', err);
    } finally {
      // Always close AudioContext to prevent memory leaks
      if (tempContext && tempContext.state !== 'closed') {
        try {
          await tempContext.close();
        } catch (e) {
          // Ignore close errors
        }
      }
    }

    // Check cache for this file (if cache enabled and not forcing reanalyze)
    if (decodedBuffer && cacheEnabled && !forceReanalyze) {
      const cachedData = await checkCache(file, decodedBuffer.duration);

      if (cachedData && cachedData.detectedKey) {
        // Found in cache! Restore cached analysis data
        console.log('Loading from cache:', file.name);
        setLoadedFromCache(true);

        // Restore cached values (skip heavy key/tempo detection)
        if (cachedData.detectedKey) setDetectedKey(cachedData.detectedKey);
        if (cachedData.tempo) setEstimatedTempo(cachedData.tempo);

        // Still need to set audioBuffer for spectrogram generation
        setAudioBuffer(decodedBuffer);
        return;
      }
    }

    // Not in cache - do full processing
    console.log('Processing new file:', file.name);
    setDetectedKey(null);
    setEstimatedTempo(null);
    setStaticPeakFreq(null);
    setStaticRmsLevel(null);
    setAiSuggestions([]);
    clearSpectrogram();

    if (decodedBuffer) {
      setAudioBuffer(decodedBuffer);
    }
  };

  // Re-analyze current file (bypass cache)
  const handleReanalyze = () => {
    if (audioFile) {
      handleAudioSelect(audioFile, true);
    }
  };

  const handlePlay = async () => {
    if (!audioRef.current) return;

    // Initialize audio context on first play
    let ctx = audioContext;
    let currentAnalyser = analyser;
    if (!ctx) {
      const result = await initAudio();
      ctx = result.ctx;
      currentAnalyser = result.analyser;
    }

    // Connect source only once
    if (ctx && !sourceRef.current && audioRef.current) {
      sourceRef.current = connectSource(audioRef.current);
    }

    // Start FFT analysis (use currentAnalyser which is guaranteed to be set)
    if (currentAnalyser && !isAnalyzing) {
      startAnalysis(currentAnalyser);
    }

    // Start drum analysis
    startDrumAnalysis();

    // Handle play() promise to avoid "interrupted by pause()" errors
    audioRef.current.play().catch(e => {
      // AbortError is expected when pause() is called before play() resolves
      if (e.name !== 'AbortError') {
        console.error('Playback error:', e);
      }
    });
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      // Stop drum analysis when pausing
      stopDrumAnalysis();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handle spectrogram seek
  const handleSpectrogramSeek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Run mix analysis when spectrogram data is available
  useEffect(() => {
    if (spectrogramData && audioBuffer && !mixAnalysisResults) {
      analyzeMix(spectrogramData, audioBuffer);
    }
  }, [spectrogramData, audioBuffer, mixAnalysisResults, analyzeMix]);

  // Analyze drums from FFT data when playing
  useEffect(() => {
    if (isPlaying && frequencyData && frequencyData.length > 0) {
      const currentTimeMs = currentTime * 1000;
      analyzeDrumFrame(new Uint8Array(frequencyData), currentTimeMs);
      updatePlaybackPosition(currentTimeMs);
    }
  }, [isPlaying, frequencyData, currentTime, analyzeDrumFrame, updatePlaybackPosition]);

  // Reset drum analysis when audio file changes
  useEffect(() => {
    if (audioFile) {
      resetDrumAnalysis();
    }
  }, [audioFile, resetDrumAnalysis]);

  // Reset verification workflow when audio file changes
  useEffect(() => {
    if (audioFile) {
      verificationWorkflow.resetWorkflow();
      appClearChordHistory();
    }
  }, [audioFile, verificationWorkflow.resetWorkflow, appClearChordHistory]);

  // Analyze chromagram for app-level chord detection (for verification)
  useEffect(() => {
    if (isPlaying && chromagram && chromagram.length > 0) {
      appAnalyzeChromagram(chromagram);
    }
  }, [isPlaying, chromagram, appAnalyzeChromagram]);

  // Create rhythm data object for verification system
  const rhythmVerificationData = useMemo(() => ({
    bpm: effectiveTempo,
    bpmConfidence: effectiveTempoConfidence,
    hits: effectiveDrumHits,
    patternMatch: patternMatch,
    swing: pythonSwing,
    timeSignature: pythonTimeSignature,
  }), [effectiveTempo, effectiveTempoConfidence, effectiveDrumHits, patternMatch, pythonSwing, pythonTimeSignature]);

  // Trigger Python rhythm analysis when audio file is loaded
  useEffect(() => {
    if (audioFile && rhythmServiceAvailable) {
      // Run Python AI analysis for accurate results (adaptive thresholds)
      analyzeRhythmFile(audioFile, { useAI: true });
    }
  }, [audioFile, rhythmServiceAvailable, analyzeRhythmFile]);

  // Analyze key and tempo from full audio buffer when loaded (lightweight version)
  useEffect(() => {
    if (!audioBuffer) return;

    // Skip heavy key/tempo detection if loaded from cache
    if (loadedFromCache) {
      console.log('Skipping key/tempo detection - loaded from cache');
      return;
    }

    // Use setTimeout to avoid blocking UI during load
    const timeoutId = setTimeout(() => {
      try {
        const sampleRate = audioBuffer.sampleRate;
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.numberOfChannels > 1
          ? audioBuffer.getChannelData(1)
          : leftChannel;

        // === KEY DETECTION (simplified) ===
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
        const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

        // Sample a few segments and use energy in frequency bands
        const chromagram = new Array(12).fill(0);
        const segmentSize = 4096;
        const numSegments = Math.min(20, Math.floor(leftChannel.length / segmentSize / 10));

        for (let seg = 0; seg < numSegments; seg++) {
          const startIdx = Math.floor((seg / numSegments) * (leftChannel.length - segmentSize));

          // Calculate energy for each note using simple bandpass approximation
          for (let note = 0; note < 12; note++) {
            for (let octave = 2; octave <= 5; octave++) {
              const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
              const period = Math.round(sampleRate / freq);

              if (period > 2 && startIdx + period * 4 < leftChannel.length) {
                // Simple autocorrelation at this frequency
                let corr = 0;
                for (let i = 0; i < period * 2; i++) {
                  const idx = startIdx + i;
                  corr += leftChannel[idx] * leftChannel[idx + period];
                }
                chromagram[note] += Math.max(0, corr);
              }
            }
          }
        }

        // Normalize and find best key
        const maxChroma = Math.max(...chromagram);
        if (maxChroma > 0) {
          const normChroma = chromagram.map(v => v / maxChroma);

          let bestKey = 'C major';
          let bestCorr = -Infinity;

          for (let root = 0; root < 12; root++) {
            const corrMajor = normChroma.reduce((sum, val, i) =>
              sum + val * MAJOR_PROFILE[(i - root + 12) % 12], 0);
            const corrMinor = normChroma.reduce((sum, val, i) =>
              sum + val * MINOR_PROFILE[(i - root + 12) % 12], 0);

            if (corrMajor > bestCorr) { bestCorr = corrMajor; bestKey = `${NOTE_NAMES[root]} major`; }
            if (corrMinor > bestCorr) { bestCorr = corrMinor; bestKey = `${NOTE_NAMES[root]} minor`; }
          }
          setDetectedKey(bestKey);
        }

        // === TEMPO DETECTION (energy-based, lightweight) ===
        const hopSize = 2048;  // Larger hop = fewer calculations
        const numFrames = Math.floor(leftChannel.length / hopSize);
        const energies = [];

        // Calculate RMS energy per frame
        for (let frame = 0; frame < numFrames; frame++) {
          let energy = 0;
          const start = frame * hopSize;
          for (let i = 0; i < hopSize; i++) {
            const sample = leftChannel[start + i] || 0;
            energy += sample * sample;
          }
          energies.push(Math.sqrt(energy / hopSize));
        }

        // Find peaks in energy (onsets)
        const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.3;
        const peakFrames = [];
        for (let i = 1; i < energies.length - 1; i++) {
          if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] >= energies[i+1]) {
            if (peakFrames.length === 0 || i - peakFrames[peakFrames.length - 1] > 3) {
              peakFrames.push(i);
            }
          }
        }

        // Calculate intervals between peaks
        if (peakFrames.length >= 8) {
          const intervals = [];
          for (let i = 1; i < peakFrames.length; i++) {
            intervals.push(peakFrames[i] - peakFrames[i - 1]);
          }

          // Find most common interval
          const histogram = {};
          intervals.forEach(interval => {
            const bin = Math.round(interval);
            histogram[bin] = (histogram[bin] || 0) + 1;
          });

          let bestInterval = 10;
          let bestCount = 0;
          for (const [bin, count] of Object.entries(histogram)) {
            if (count > bestCount) {
              bestCount = count;
              bestInterval = parseInt(bin);
            }
          }

          // Convert to BPM
          const secondsPerBeat = (bestInterval * hopSize) / sampleRate;
          let bpm = Math.round(60 / secondsPerBeat);

          // Normalize to 70-160 range
          while (bpm > 160) bpm = Math.round(bpm / 2);
          while (bpm < 70 && bpm > 0) bpm = Math.round(bpm * 2);

          if (bpm >= 70 && bpm <= 160) {
            setEstimatedTempo(bpm);
          }
        }

        // === PEAK FREQUENCY & RMS LEVEL ===
        // Calculate overall RMS level
        let sumSquares = 0;
        for (let i = 0; i < leftChannel.length; i++) {
          sumSquares += leftChannel[i] * leftChannel[i];
        }
        const rms = Math.sqrt(sumSquares / leftChannel.length);
        setStaticRmsLevel(rms);

        // Find dominant frequency using autocorrelation
        // Sample from middle of track for representative frequency
        const sampleStart = Math.floor(leftChannel.length * 0.4);
        const sampleLength = Math.min(8192, leftChannel.length - sampleStart);
        let bestFreq = 100;
        let bestCorr = 0;

        // Check frequencies from 30Hz to 500Hz (bass/low-mid range)
        for (let freq = 30; freq <= 500; freq += 5) {
          const period = Math.round(sampleRate / freq);
          if (period < sampleLength / 2) {
            let corr = 0;
            for (let i = 0; i < sampleLength - period; i++) {
              corr += leftChannel[sampleStart + i] * leftChannel[sampleStart + i + period];
            }
            if (corr > bestCorr) {
              bestCorr = corr;
              bestFreq = freq;
            }
          }
        }
        setStaticPeakFreq(bestFreq);

      } catch (err) {
        console.error('Error analyzing audio:', err);
      }
    }, 100); // Small delay to let UI render first

    return () => clearTimeout(timeoutId);
  }, [audioBuffer, loadedFromCache]);

  // Save analysis to cache when key data is available
  useEffect(() => {
    if (!audioFile || !duration || loadedFromCache) return;

    // Wait until we have essential analysis data
    if (!detectedKey && !estimatedTempo && !spectrogramData) return;

    const saveToCache = async () => {
      const analysisData = {
        duration,
        detectedKey,
        tempo: drumTempo || estimatedTempo,
        detectedPattern,
        drumHits,
        spectrogramData: spectrogramData ? true : null, // Don't store actual spectrogram, just flag
        hasMidi: Object.values(drumHits || {}).some(hits => hits.length > 0),
        hasStems: false, // Will be updated when stems are processed
      };

      await cacheAnalysis(audioFile, analysisData);
    };

    // Debounce saving to avoid too many writes
    const timeoutId = setTimeout(saveToCache, 2000);
    return () => clearTimeout(timeoutId);
  }, [audioFile, duration, detectedKey, estimatedTempo, drumTempo, detectedPattern, drumHits, spectrogramData, loadedFromCache, cacheAnalysis]);

  // Handle loading analysis from history
  const handleLoadFromHistory = useCallback(async (entry) => {
    // Load the cached analysis data
    const cachedData = await loadFromHistory(entry.id);
    if (!cachedData) return;

    // Apply cached data
    setLoadedFromCache(true);
    if (cachedData.detectedKey) setDetectedKey(cachedData.detectedKey);
    if (cachedData.tempo) setEstimatedTempo(cachedData.tempo);

    // Note: We can't restore the actual audio file from cache
    // The user needs to re-select the file, but analysis will be faster
    alert(`Loaded analysis for "${entry.fileName}"\n\nKey: ${cachedData.detectedKey || 'Unknown'}\nTempo: ${cachedData.tempo || 'Unknown'} BPM\nPattern: ${cachedData.detectedPattern || 'Unknown'}\n\nTo play the audio, please select the file again.`);
  }, [loadFromHistory]);

  // Handle reference track loading
  const handleLoadReference = useCallback(async (file) => {
    await loadReferenceTrack(file, generateSpectrogram);
  }, [loadReferenceTrack, generateSpectrogram]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Note: Key and tempo are now detected from full audio buffer on load (see above)
  // Real-time detection removed to prevent unstable switching during playback

  // AI Assistant
  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/claude/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery,
          key: detectedKey,
          tempo: estimatedTempo,
          context: 'User is analyzing audio in a music production app'
        }),
      });

      const data = await response.json();
      // Bound AI suggestions to prevent unbounded memory growth
      setAiSuggestions(prev => {
        const updated = [...prev, { query: aiQuery, response: data.suggestions }];
        return updated.length > MAX_AI_SUGGESTIONS
          ? updated.slice(-MAX_AI_SUGGESTIONS)
          : updated;
      });
      setAiQuery('');
    } catch (err) {
      // Bound AI suggestions even for error responses
      setAiSuggestions(prev => {
        const updated = [...prev, { query: aiQuery, response: [{ description: 'Error', suggestion: 'Could not get AI response' }] }];
        return updated.length > MAX_AI_SUGGESTIONS
          ? updated.slice(-MAX_AI_SUGGESTIONS)
          : updated;
      });
    } finally {
      setIsAiLoading(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      stopAnalysis();
    };
  }, [audioUrl, stopAnalysis]);

  // Fetch open ticket count for header badge
  useEffect(() => {
    const fetchTicketStats = async () => {
      try {
        const response = await fetch('http://localhost:56404/api/tickets/stats/summary');
        if (response.ok) {
          const stats = await response.json();
          setOpenTicketCount(stats.open + stats.inProgress);
        }
      } catch (err) {
        // Silently fail - ticket service may not be running
      }
    };

    fetchTicketStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchTicketStats, 30000);
    return () => clearInterval(interval);
  }, [showTicketManager]);

  // Load test song for Developer Mode
  const loadTestSong = async () => {
    try {
      // Use Electron/Node file system if available, otherwise use fetch
      const response = await fetch(`http://localhost:56404/api/load-local-file?path=${encodeURIComponent(testSongPath)}`);
      if (response.ok) {
        const blob = await response.blob();
        const fileName = testSongPath.split('/').pop();
        const file = new File([blob], fileName, { type: 'audio/aiff' });
        handleAudioSelect(file);
      } else {
        console.error('Could not load test song. Add /api/load-local-file endpoint or drag file manually.');
        alert('Drag "01 Blinding Lights.aif" into the app to load test song');
      }
    } catch (err) {
      console.error('Error loading test song:', err);
      alert('Drag "01 Blinding Lights.aif" into the app to load test song');
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Music Analyzer</h1>
            <p>AI-powered music analysis with chord detection and MIDI generation</p>
          </div>
          <nav className="header-nav">
            <button
              className={`dev-mode-toggle ${devModeEnabled ? 'active' : ''}`}
              onClick={() => setDevModeEnabled(!devModeEnabled)}
              title="Developer Mode - Show guidance and recommendations"
            >
              <span className="toggle-icon">{devModeEnabled ? '🔧' : '⚙️'}</span>
              Dev Mode
            </button>
            <TicketBadge
              count={openTicketCount}
              onClick={() => setShowTicketManager(true)}
            />
            <button
              className="nav-btn"
              onClick={() => setShowTicketManager(true)}
              title="Issue Tracker"
            >
              Issues
            </button>
          </nav>
        </div>
      </header>

      {/* Ticket Manager Modal */}
      <TicketManager
        isOpen={showTicketManager}
        onClose={() => setShowTicketManager(false)}
      />

      {/* Developer Mode Guidance Panel */}
      {devModeEnabled && (
        <DevModeGuidance
          audioFile={audioFile}
          duration={duration}
          audioBuffer={audioBuffer}
          bpm={effectiveTempo}
          bpmConfidence={effectiveTempoConfidence}
          bpmLocked={pythonBpmLocked}
          bpmAutoCorrected={pythonBpmAutoCorrected}
          beats={pythonBeats}
          timeSignature={pythonTimeSignature}
          swing={pythonSwing}
          detectedGenre={rhythmDetectedGenre}
          genreConfidence={rhythmGenreConfidence}
          drumHits={effectiveDrumHits}
          totalHitCount={Object.values(effectiveDrumHits || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0)}
          rhythmAnalysisState={rhythmAnalysisState}
          isRhythmAnalyzing={isRhythmAnalyzing}
          rhythmServiceAvailable={rhythmServiceAvailable}
          detectedKey={detectedKey}
          currentChord={appCurrentChord}
          chordHistory={appChordHistory}
          mixAnalysisResults={mixAnalysisResults}
          onOpenFixGrid={openFixGrid}
          onFindQuietHits={() => audioFile && findQuietHits(audioFile)}
          onStartVerification={() => setShowVerificationPanel(true)}
          onAnalyzeRhythm={() => audioFile && analyzeRhythmFile(audioFile)}
          onRecalculateBPM={recalculateRhythmBPM}
          onSetManualBPM={setRhythmManualBPM}
        />
      )}

      {/* Test Song Loader (Dev Mode) */}
      {devModeEnabled && !audioFile && (
        <div className="test-song-loader">
          <span>🎵 Quick Load:</span>
          <button onClick={loadTestSong}>Load "Blinding Lights"</button>
          <span style={{ color: '#888', fontSize: '11px' }}>or drag the file</span>
        </div>
      )}

      {/* Rhythm Verification Panel */}
      {showVerificationPanel && (
        <>
          <div className="rvp-overlay" onClick={() => setShowVerificationPanel(false)} />
          <RhythmVerificationPanel
            audioFile={audioFile}
            initialBpm={effectiveTempo}
            onHitsVerified={(result) => {
              // Replace rhythm analysis hits with verified hits
              if (result.hits) {
                replaceRhythmHits(result.hits);
              }
              setShowVerificationPanel(false);
            }}
            onClose={() => setShowVerificationPanel(false)}
          />
        </>
      )}

      <main className="App-main">
        <section className="input-section">
          <AudioInputManager
            onAudioReady={handleAudioSelect}
            onStreamReady={handleAudioSelect}
          />

          {/* Analysis History Panel */}
          <AnalysisHistory
            history={analysisHistory}
            currentCacheId={currentCacheId}
            onLoadAnalysis={handleLoadFromHistory}
            onDeleteAnalysis={deleteFromHistory}
            onClearAll={clearHistory}
            isLoading={isCacheLoading}
            cacheEnabled={cacheEnabled}
            onToggleCache={setCacheEnabled}
            onReanalyze={handleReanalyze}
            currentFileName={audioFile?.name}
          />
        </section>

        {audioUrl && (
          <section className="player-section">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />
            <div className="player-controls">
              <button onClick={isPlaying ? handlePause : handlePlay}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <span className="time">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="seek-bar"
              />
              <span className="time">{formatTime(duration)}</span>
            </div>

            <div className="audio-info">
              <div className="info-item">
                <strong>Key:</strong> {detectedKey || 'Detecting...'}
              </div>
              <div className="info-item">
                <strong>Tempo:</strong> {effectiveTempo ? `${Math.round(effectiveTempo)} BPM` : (estimatedTempo ? `~${estimatedTempo} BPM` : 'Detecting...')}
              </div>
              <div className="info-item">
                <strong>Peak Freq:</strong> {Math.round(isPlaying ? peakFrequency : (staticPeakFreq || 0))} Hz
              </div>
              <div className="info-item">
                <strong>Level:</strong> {((isPlaying ? rmsLevel : (staticRmsLevel || 0)) * 100).toFixed(1)}%
              </div>
            </div>
          </section>
        )}

        {/* Verification Controller Section */}
        {audioBuffer && (
          <section className="verification-section">
            <VerificationController
              workflow={verificationWorkflow}
              audioBuffer={audioBuffer}
              rhythmData={rhythmVerificationData}
              isRhythmAnalyzing={isRhythmAnalyzing}
              rhythmProgress={rhythmProgress}
              rhythmAnalysisMethod={rhythmAnalysisMethod}
              onOpenFixGrid={openFixGrid}
              onReanalyzeRhythm={() => {
                if (audioFile) {
                  analyzeRhythmFile(audioFile, { useAI: true });
                }
              }}
              onReanalyzeRhythmWithAI={() => {
                if (audioFile) {
                  analyzeRhythmFile(audioFile, { useAI: true });
                }
              }}
              onFindQuietHits={() => {
                if (audioFile) {
                  findQuietHits(audioFile, { startBar: 21, energyMultiplier: 0.3 });
                }
              }}
              isFindingQuietHits={isFindingQuietHits}
              chordData={chordVerificationData}
            />
          </section>
        )}

        {/* Spectrogram & Mix Analysis Section */}
        {audioBuffer && (
          <section className="spectrogram-section">
            <SpectrogramView
              audioBuffer={audioBuffer}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={handleSpectrogramSeek}
              height={300}
              showStereo={true}
              problemMarkers={getProblemMarkers()}
            />

            {/* Loudness Timeline */}
            {mixAnalysisResults?.loudness && (
              <LoudnessTimeline
                loudnessData={mixAnalysisResults.loudness}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSpectrogramSeek}
                height={60}
              />
            )}

            {/* Mix Analysis & Reference Comparison Grid */}
            <div className="mix-analysis-grid">
              <MixAnalysisPanel
                analysisResults={mixAnalysisResults}
                isAnalyzing={isAnalyzingMix}
                progress={mixAnalysisProgress}
                onSeek={handleSpectrogramSeek}
              />
              <ReferenceCompare
                comparisonResults={comparisonResults}
                referenceBuffer={referenceBuffer}
                mainLoudness={mixAnalysisResults?.loudness?.integratedLUFS}
                onLoadReference={handleLoadReference}
                onClearReference={clearReference}
              />
            </div>
          </section>
        )}

        {/* Professional Audio Analyzer */}
        <section className="pro-analyzer-section">
          <AudioAnalyzer
            audioFile={audioFile}
            onFileSelect={handleAudioSelect}
          />
        </section>

        {analyser && (
          <section className="visualization-section">
            <div className="visualizers">
              <SpectrumAnalyzer
                analyser={analyser}
                width={600}
                height={200}
                showControls={true}
                showStats={true}
              />
            </div>
          </section>
        )}

        {/* Chord Detector with Piano - always visible */}
        <section className="chord-section">
          <ChordDetector
            chromagram={chromagram}
            chromagramByOctave={chromagramByOctave}
            showHistory={true}
            showPiano={true}
            showDiagram={true}
            detectedKey={detectedKey}
            tempo={estimatedTempo}
            // Rhythmic mode props
            drumHits={effectiveDrumHits}
            currentTimeMs={currentTime * 1000}
            isPlaying={isPlaying}
            // Advanced mode props
            analyser={analyser}
          />
        </section>

        {/* NEW: RhythmGridPro - DAW-style with Logic Pro principles */}
        <section className="rhythm-section">
          <RhythmGridPro
            bpm={effectiveTempo || 120}
            downbeatTime={pythonDownbeats?.[0]?.time || 0}
            audioDuration={duration}
            currentTime={currentTime}
            isPlaying={isPlaying}
            beatsPerBar={pythonTimeSignature || 4}
            subdivisions={4}
            barsPerPage={4}
            hits={(() => {
              // Convert effectiveDrumHits to flat array format
              const flatHits = [];
              Object.entries(effectiveDrumHits || {}).forEach(([type, hits]) => {
                hits.forEach(hit => {
                  flatHits.push({
                    time: hit.timestamp / 1000, // ms to seconds
                    type,
                    confidence: hit.confidence || 0.8,
                    isManual: hit.isManual || false,
                  });
                });
              });
              return flatHits;
            })()}
            onHitAdd={(hit) => {
              // Convert back to old format
              const bar = Math.floor(hit.time / ((60 / effectiveTempo) * (pythonTimeSignature || 4)));
              const beatInBar = Math.floor((hit.time % ((60 / effectiveTempo) * (pythonTimeSignature || 4))) / (60 / effectiveTempo));
              const subBeat = Math.round(((hit.time % (60 / effectiveTempo)) / (60 / effectiveTempo)) * 4);
              addDrumHit(hit.type, bar, beatInBar, subBeat);
            }}
            onHitRemove={(hit) => {
              removeDrumHit(hit.type, hit.time * 1000, hit.isManual);
            }}
            onSeek={(time) => {
              if (audioRef.current) {
                audioRef.current.currentTime = time;
              }
            }}
            onAnalyzeWithAI={() => {
              if (audioFile) {
                analyzeRhythmFile(audioFile, { useAI: true });
              }
            }}
            onVerifyHits={() => {
              if (audioFile) {
                setShowVerificationPanel(true);
              }
            }}
            onFindQuietHits={() => {
              if (audioFile) {
                findQuietHits(audioFile, { startBar: 21, energyMultiplier: 0.3 });
              }
            }}
            isFindingQuietHits={isFindingQuietHits}
            analysisSource={rhythmAnalysisSource}
            detectedGenre={rhythmDetectedGenre}
            genreConfidence={rhythmGenreConfidence}
            isAnalyzing={isRhythmAnalyzing}
            analysisProgress={rhythmProgress}
            patternFilterApplied={rhythmPatternFilterApplied}
            hitsBeforeFilter={rhythmHitsBeforeFilter}
            hitsAfterFilter={rhythmHitsAfterFilter}
          />
        </section>

        {/* OLD: Rhythm Grid - keeping for comparison */}
        <section className="rhythm-section" style={{ opacity: 0.5 }}>
          <div style={{ padding: '0.5rem', background: '#333', color: '#888', fontSize: '0.8rem' }}>
            OLD GRID (for comparison) - will be removed
          </div>
          <RhythmGrid
            drumHits={effectiveDrumHits}
            currentBeat={0}
            currentBar={0}
            beatsPerBar={pythonTimeSignature || 4}
            barsToShow={8}
            subdivision={4}
            tempo={effectiveTempo}
            tempoConfidence={effectiveTempoConfidence}
            detectedPattern={detectedPattern}
            patternConfidence={patternConfidence}
            isPlaying={isPlaying}
            currentTimeMs={currentTime * 1000}
            audioDuration={duration}
            onCellClick={(drumType, bar, beat, subBeat) => {
              // Toggle hit - if exists, remove; if not, add
              const hitsToCheck = effectiveDrumHits;
              const hit = hitsToCheck[drumType]?.find(h => {
                const targetTime = (bar * 4 + beat + subBeat / 4) * (60000 / effectiveTempo);
                return Math.abs(h.timestamp - targetTime) < 50;
              });
              if (hit) {
                removeDrumHit(drumType, hit.timestamp, hit.isManual);
              } else {
                addDrumHit(drumType, bar, beat, subBeat);
              }
            }}
            onClearRow={clearDrumRow}
            onClearAll={clearAllDrums}
            onTempoChange={usePythonRhythm ? setRhythmManualBPM : setDrumTempo}
            onTapTempo={tapTempo}
            // Python rhythm analysis props
            rhythmAnalysisState={rhythmAnalysisState}
            rhythmProgress={rhythmProgress}
            rhythmError={rhythmError}
            isRhythmAnalyzing={isRhythmAnalyzing}
            rhythmServiceAvailable={rhythmServiceAvailable}
            usePythonRhythm={usePythonRhythm}
            rhythmAnalysisMethod={rhythmAnalysisMethod}
            swing={pythonSwing}
            bpmAutoCorrected={pythonBpmAutoCorrected}
            onOpenFixGrid={openFixGrid}
            // Analysis source and genre
            analysisSource={rhythmAnalysisSource}
            detectedGenre={rhythmDetectedGenre}
            genreConfidence={rhythmGenreConfidence}
            // Pattern matching from Knowledge Lab
            patternMatch={patternMatch}
            patternMatchLoading={patternMatchLoading}
            onMatchPattern={matchPatternFromKnowledge}
          />
        </section>

        {/* Fix Grid Panel */}
        <FixGridPanel
          isOpen={isFixGridOpen}
          onClose={closeFixGrid}
          pendingChanges={fixGridPendingChanges}
          setPendingChanges={setFixGridPendingChanges}
          onApply={applyFixGridChanges}
          onReset={resetRhythmToDetected}
          onRecalculateBPM={recalculateRhythmBPM}
          onShiftDownbeat={shiftDownbeatPosition}
          onAlignToFirstKick={alignDownbeatToFirstKick}
          onSnapToPosition={snapToPosition}
          onQuantizeInstrument={quantizeSingleInstrument}
          onGeneratePattern={generatePattern}
          onClearInstrument={clearInstrument}
          onApplyPreset={applyPreset}
          bpmConfidence={pythonBpmConfidence}
          timeSignature={pythonTimeSignature}
          analysisState={rhythmAnalysisState}
          analysisMethod={rhythmAnalysisMethod}
          hasKicks={(pythonHits?.kick?.length || 0) > 0}
        />

        {audioFile && (
          <section className="analysis-section">
            <MIDIGenerator audioFile={audioFile} />
          </section>
        )}

        <section className="ai-section">
          <h2>AI Audio Engineer Assistant</h2>
          <div className="ai-chat">
            <div className="ai-messages">
              {aiSuggestions.length === 0 && (
                <p className="ai-hint">Ask questions about mixing, production, chord progressions, or get suggestions for your track.</p>
              )}
              {aiSuggestions.map((item, idx) => (
                <div key={idx} className="ai-exchange">
                  <div className="ai-query"><strong>You:</strong> {item.query}</div>
                  <div className="ai-response">
                    {item.response.map((r, i) => (
                      <div key={i} className="suggestion">
                        <strong>{r.type || r.description}:</strong> {r.suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="ai-input">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Ask the AI assistant..."
                onKeyPress={(e) => e.key === 'Enter' && handleAiQuery()}
              />
              <button onClick={handleAiQuery} disabled={isAiLoading}>
                {isAiLoading ? 'Thinking...' : 'Ask'}
              </button>
            </div>
          </div>
        </section>

        {/* Gemini Mix Analyzer Section */}
        <section className="gemini-section">
          <GeminiMixAnalyzer
            audioFile={audioFile}
            audioBuffer={audioBuffer}
            onSeek={handleSpectrogramSeek}
          />
        </section>

        {/* AI Audio Optimizer Section */}
        <section className="optimizer-section">
          <AudioOptimizer
            audioFile={audioFile}
            audioBuffer={audioBuffer}
            audioMetrics={mixAnalysisResults?.metrics}
            spectrogramData={spectrogramData}
            problemFrequencies={mixAnalysisResults?.problems || []}
            detectedBpm={effectiveTempo || estimatedTempo || 120}
          />
        </section>

        {/* Stem Separator Section */}
        <section className="stem-section">
          <StemSeparator audioFile={audioFile} />
        </section>

        {/* Personal Knowledge Base Section */}
        <section className="personal-knowledge-section">
          <PersonalKnowledge
            currentBPM={effectiveTempo || estimatedTempo || 120}
          />
        </section>

        {/* Knowledge Lab Section */}
        <section className="knowledge-lab-section">
          <KnowledgeLab
            analysisContext={{
              lufs: mixAnalysisResults?.loudness?.integratedLUFS,
              dynamicRange: mixAnalysisResults?.metrics?.dynamicRange,
              problems: mixAnalysisResults?.problems?.map(p => p.type) || [],
              lowMidEnergy: mixAnalysisResults?.metrics?.lowMidEnergy,
              presenceEnergy: mixAnalysisResults?.metrics?.presenceEnergy,
              bassPhase: mixAnalysisResults?.metrics?.stereo?.correlation,
              hasVocals: false // Could be detected from stems later
            }}
            detectedGenre={null} // Could add genre detection
            bpm={effectiveTempo || estimatedTempo}
            detectedKey={detectedKey}
            onApplyStructure={(structure) => {
              console.log('Structure exported:', structure);
              // Could integrate with RhythmGrid markers
            }}
          />
        </section>
      </main>

      <footer className="App-footer">
        <p>Music Analyzer - Port 56400</p>
      </footer>
    </div>
  );
}

export default App;
