/**
 * @module useAudioOptimizer
 * @description Main React hook for audio optimization
 *
 * Orchestrates all optimization analysis:
 * - Genre detection
 * - EQ recommendations
 * - Compression/limiting settings
 * - Stereo analysis
 * - Suno artifact detection
 * - Export functionality
 */

import { useState, useCallback, useMemo } from 'react';
import { useGenreDetection } from './useGenreDetection';
import {
  generateOptimizationSummary,
  generateEQRecommendations,
  generateCompressionRecommendation,
  generateMultibandCompression,
  generateLimiterRecommendation,
  generateStereoRecommendation,
  GENRE_TARGETS,
  OPTIMIZATION_BANDS
} from '../utils/optimizationUtils';
import { getBPMSyncedEffects } from '../utils/bpmSyncUtils';
import { analyzeAIArtifacts } from '../utils/sunoDetection';
import {
  exportToJSON,
  exportToPDF,
  exportSettingsJSON,
  copyToClipboard,
  formatForDAW
} from '../utils/exportUtils';

/**
 * Main hook for audio optimization
 * @param {Object} options - Hook options
 * @returns {Object} Optimization state and methods
 */
export function useAudioOptimizer(options = {}) {
  const { defaultPlatform = 'spotify' } = options;

  // State
  const [optimizationResult, setOptimizationResult] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [platform, setPlatform] = useState(defaultPlatform);
  const [sunoMode, setSunoMode] = useState(false);
  const [sunoAnalysis, setSunoAnalysis] = useState(null);
  const [bpmEffects, setBpmEffects] = useState(null);

  // Genre detection hook
  const genreDetection = useGenreDetection();

  /**
   * Run full optimization analysis
   * @param {Object} params - Analysis parameters
   * @param {Object} params.metrics - Audio metrics (LUFS, peak, RMS, etc.)
   * @param {Object} params.problemFrequencies - Detected problem frequencies
   * @param {AudioBuffer} params.audioBuffer - Audio buffer for Suno analysis
   * @param {Object} params.spectrogramData - Spectrogram for detailed analysis
   * @param {number} params.bpm - Detected BPM for effect calculations
   */
  const analyze = useCallback(async ({
    metrics,
    problemFrequencies = [],
    audioBuffer = null,
    spectrogramData = null,
    bpm = 120
  }) => {
    if (!metrics) {
      setError('No audio metrics provided');
      return null;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      // Detect genre
      const genreResult = genreDetection.detect(metrics);
      const targetGenre = genreDetection.selectedGenre !== 'auto'
        ? genreDetection.selectedGenre
        : genreResult?.genre || 'pop';

      // Generate optimization summary
      const summary = generateOptimizationSummary(
        metrics,
        targetGenre,
        problemFrequencies,
        platform
      );

      setOptimizationResult(summary);

      // Suno artifact detection if enabled
      if (sunoMode && audioBuffer) {
        const artifacts = analyzeAIArtifacts(audioBuffer, spectrogramData);
        setSunoAnalysis(artifacts);
      }

      // BPM-synced effects
      if (bpm > 0) {
        const effects = getBPMSyncedEffects(bpm);
        setBpmEffects(effects);
      }

      return summary;
    } catch (err) {
      setError(err.message || 'Analysis failed');
      return null;
    } finally {
      setIsAnalyzing(false);
    }
  }, [genreDetection, platform, sunoMode]);

  /**
   * Quick analysis (just EQ and compression)
   */
  const quickAnalyze = useCallback((metrics, problemFrequencies = []) => {
    const targetGenre = genreDetection.effectiveGenre;

    return {
      eq: generateEQRecommendations(metrics, targetGenre, problemFrequencies),
      compression: generateCompressionRecommendation(metrics, targetGenre),
      limiter: generateLimiterRecommendation(metrics, targetGenre, platform)
    };
  }, [genreDetection.effectiveGenre, platform]);

  /**
   * Analyze stereo field only
   */
  const analyzeStereo = useCallback((metrics) => {
    const targetGenre = genreDetection.effectiveGenre;
    return generateStereoRecommendation(metrics, targetGenre);
  }, [genreDetection.effectiveGenre]);

  /**
   * Run Suno artifact detection
   */
  const analyzeSunoArtifacts = useCallback((audioBuffer, spectrogramData = null) => {
    if (!audioBuffer) return null;

    const result = analyzeAIArtifacts(audioBuffer, spectrogramData);
    setSunoAnalysis(result);
    return result;
  }, []);

  /**
   * Update BPM and recalculate effects
   */
  const updateBPM = useCallback((bpm) => {
    if (bpm > 0) {
      const effects = getBPMSyncedEffects(bpm);
      setBpmEffects(effects);
    }
  }, []);

  // Export functions
  const exportJSON = useCallback((filename) => {
    if (!optimizationResult) return;
    exportToJSON(optimizationResult, filename);
  }, [optimizationResult]);

  const exportPDF = useCallback((filename) => {
    if (!optimizationResult) return;
    exportToPDF(optimizationResult, filename);
  }, [optimizationResult]);

  const exportSettings = useCallback((filename) => {
    if (!optimizationResult) return;
    exportSettingsJSON(optimizationResult, filename);
  }, [optimizationResult]);

  const copySettings = useCallback(async (format = 'daw') => {
    if (!optimizationResult) return false;
    return copyToClipboard(optimizationResult, format);
  }, [optimizationResult]);

  const getDAWSettings = useCallback((dawType = 'generic') => {
    if (!optimizationResult) return '';
    return formatForDAW(optimizationResult, dawType);
  }, [optimizationResult]);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setOptimizationResult(null);
    setSunoAnalysis(null);
    setBpmEffects(null);
    setError(null);
    genreDetection.reset();
  }, [genreDetection]);

  // Computed values
  const hasResults = useMemo(() => !!optimizationResult, [optimizationResult]);

  const priorityActions = useMemo(() => {
    return optimizationResult?.priority || [];
  }, [optimizationResult]);

  const currentScore = useMemo(() => {
    return optimizationResult?.scores?.current || null;
  }, [optimizationResult]);

  const potentialScore = useMemo(() => {
    return optimizationResult?.scores?.potential || null;
  }, [optimizationResult]);

  return {
    // State
    optimizationResult,
    sunoAnalysis,
    bpmEffects,
    isAnalyzing,
    error,
    platform,
    sunoMode,
    hasResults,
    priorityActions,
    currentScore,
    potentialScore,

    // Genre detection
    ...genreDetection,

    // Constants
    GENRE_TARGETS,
    OPTIMIZATION_BANDS,

    // Methods
    analyze,
    quickAnalyze,
    analyzeStereo,
    analyzeSunoArtifacts,
    updateBPM,
    setPlatform,
    setSunoMode,
    reset,

    // Export
    exportJSON,
    exportPDF,
    exportSettings,
    copySettings,
    getDAWSettings
  };
}

/**
 * Hook for Suno-specific artifact detection
 */
export function useSunoArtifactDetection() {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback((audioBuffer, spectrogramData = null) => {
    if (!audioBuffer) return null;

    setIsAnalyzing(true);
    try {
      const result = analyzeAIArtifacts(audioBuffer, spectrogramData);
      setAnalysis(result);
      return result;
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnalysis(null);
  }, []);

  return {
    analysis,
    isAnalyzing,
    analyze,
    reset
  };
}

export default useAudioOptimizer;
