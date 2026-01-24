/**
 * @module useMixAnalysis
 * @description React hook for professional mix/master analysis
 *
 * Provides comprehensive audio analysis including:
 * - Problem frequency detection (muddy, boxy, harsh, sibilant)
 * - Frequency masking/crowding analysis
 * - Resonance detection
 * - Loudness analysis (LUFS, dynamic range)
 * - Reference track comparison with EQ recommendations
 *
 * ## Usage
 * ```javascript
 * import { useMixAnalysis } from './hooks/useMixAnalysis';
 *
 * function MixAnalyzer({ spectrogramData, audioBuffer }) {
 *   const {
 *     isAnalyzing,
 *     analysisResults,
 *     analyzeMix,
 *     loadReferenceTrack,
 *     comparisonResults
 *   } = useMixAnalysis();
 *
 *   useEffect(() => {
 *     if (spectrogramData && audioBuffer) {
 *       analyzeMix(spectrogramData, audioBuffer);
 *     }
 *   }, [spectrogramData, audioBuffer]);
 *
 *   return (
 *     <MixIssuesPanel issues={analysisResults?.problems} />
 *   );
 * }
 * ```
 *
 * @author Music Analyzer Team
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  detectProblemFrequencies,
  detectFrequencyMasking,
  detectResonances,
  calculateSegmentLUFS,
  analyzeLoudnessDynamics,
  compareToReference,
  getMixAnalysisSummary
} from '../utils/mixAnalysisUtils';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * @typedef {Object} MixAnalysisResults
 * @property {import('../utils/mixAnalysisUtils').DetectedProblem[]} problems - Detected problems
 * @property {import('../utils/mixAnalysisUtils').MaskingRegion[]} masking - Masking regions
 * @property {import('../utils/mixAnalysisUtils').Resonance[]} resonances - Resonances
 * @property {import('../utils/mixAnalysisUtils').LoudnessAnalysis|null} loudness - Loudness data
 * @property {Object} summary - Analysis summary with counts and status
 * @property {string} analyzedAt - ISO timestamp of analysis
 */

/**
 * @typedef {Object} ProblemMarker
 * @property {'problem'|'resonance'} type - Marker type
 * @property {string} [subType] - Problem subtype (muddy, harsh, etc.)
 * @property {number} startTime - Start time in seconds
 * @property {number} endTime - End time in seconds
 * @property {number} frequency - Frequency in Hz
 * @property {'mild'|'moderate'|'severe'} severity - Severity level
 * @property {string} label - Display label
 * @property {string} description - Full description
 */

/**
 * @typedef {Object} UseMixAnalysisReturn
 * @property {boolean} isAnalyzing - True while analyzing
 * @property {number} progress - Analysis progress (0-1)
 * @property {MixAnalysisResults|null} analysisResults - Analysis results
 * @property {string|null} error - Error message if failed
 * @property {AudioBuffer|null} referenceBuffer - Loaded reference audio
 * @property {Object|null} referenceSpectrogram - Reference spectrogram data
 * @property {import('../utils/mixAnalysisUtils').ComparisonResult|null} comparisonResults - Comparison
 * @property {function} analyzeMix - Run mix analysis
 * @property {function} loadReferenceTrack - Load reference for comparison
 * @property {function} compareWithReference - Compare to loaded reference
 * @property {function} clearReference - Clear reference track
 * @property {function} cancelAnalysis - Cancel ongoing analysis
 * @property {function} clearAnalysis - Clear all results
 * @property {function} getProblemsBySeverity - Filter by severity
 * @property {function} getProblemMarkers - Get markers for overlay
 */

/**
 * Custom hook for mix/master analysis
 *
 * Analyzes spectrogram data for problems, masking, resonances, and loudness.
 * Supports reference track comparison with EQ recommendations.
 *
 * @returns {UseMixAnalysisReturn} Hook state and methods
 *
 * @example
 * const {
 *   analyzeMix,
 *   analysisResults,
 *   loadReferenceTrack,
 *   comparisonResults
 * } = useMixAnalysis();
 *
 * // Run analysis
 * await analyzeMix(spectrogramData, audioBuffer);
 *
 * // Load reference for A/B comparison
 * await loadReferenceTrack(referenceFile, generateSpectrogram);
 */
export function useMixAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [error, setError] = useState(null);

  // Reference track state
  const [referenceBuffer, setReferenceBuffer] = useState(null);
  const [referenceSpectrogram, setReferenceSpectrogram] = useState(null);
  const [comparisonResults, setComparisonResults] = useState(null);

  const abortRef = useRef(false);

  /**
   * Run full mix analysis on spectrogram data
   *
   * Performs comprehensive analysis in stages:
   * 1. Problem frequency detection (muddy, boxy, harsh, sibilant)
   * 2. Frequency masking detection (competing bands)
   * 3. Resonance detection (sustained peaks)
   * 4. Loudness analysis (LUFS, dynamic range)
   * 5. Summary generation
   *
   * If a reference track is loaded, also runs comparison analysis.
   *
   * @param {Object} spectrogramData - Spectrogram data from useSpectrogramGenerator
   * @param {AudioBuffer} [audioBuffer] - Audio buffer for loudness analysis
   * @returns {Promise<MixAnalysisResults|null>} Analysis results or null on error
   */
  const analyzeMix = useCallback(async (spectrogramData, audioBuffer) => {
    if (!spectrogramData) {
      setError('No spectrogram data provided');
      return null;
    }

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      // Step 1: Detect problem frequencies (30%)
      setProgress(0.1);
      await yieldToUI();

      if (abortRef.current) throw new Error('Analysis cancelled');

      const problems = detectProblemFrequencies(spectrogramData);
      setProgress(0.3);

      // Step 2: Detect frequency masking (20%)
      await yieldToUI();
      if (abortRef.current) throw new Error('Analysis cancelled');

      const masking = detectFrequencyMasking(spectrogramData);
      setProgress(0.5);

      // Step 3: Detect resonances (20%)
      await yieldToUI();
      if (abortRef.current) throw new Error('Analysis cancelled');

      const resonances = detectResonances(spectrogramData);
      setProgress(0.7);

      // Step 4: Loudness analysis (20%)
      await yieldToUI();
      if (abortRef.current) throw new Error('Analysis cancelled');

      let loudnessData = null;
      if (audioBuffer) {
        const segments = calculateSegmentLUFS(audioBuffer, 1);
        loudnessData = analyzeLoudnessDynamics(segments);
      }
      setProgress(0.9);

      // Step 5: Generate summary (10%)
      const summary = getMixAnalysisSummary(problems, masking, resonances);

      const results = {
        problems,
        masking,
        resonances,
        loudness: loudnessData,
        summary,
        analyzedAt: new Date().toISOString()
      };

      setAnalysisResults(results);
      setProgress(1);

      // Compare to reference if available
      if (referenceSpectrogram) {
        const comparison = compareToReference(spectrogramData, referenceSpectrogram);
        setComparisonResults(comparison);
      }

      return results;

    } catch (err) {
      if (err.message !== 'Analysis cancelled') {
        setError(err.message || 'Mix analysis failed');
        console.error('Mix analysis error:', err);
      }
      return null;

    } finally {
      setIsAnalyzing(false);
    }
  }, [referenceSpectrogram]);

  /**
   * Load reference track for A/B comparison
   *
   * Decodes the audio file and generates a spectrogram for comparison.
   * Once loaded, subsequent analyzeMix calls will include comparison results.
   *
   * @param {File} audioFile - Reference audio file (WAV, MP3, etc.)
   * @param {function} [generateSpectrogramFn] - Spectrogram generator function
   * @returns {Promise<AudioBuffer|null>} Decoded audio buffer or null on error
   *
   * @example
   * await loadReferenceTrack(referenceFile, generateSpectrogram);
   * // Now run analysis - comparison will be included
   * await analyzeMix(spectrogramData, audioBuffer);
   */
  const loadReferenceTrack = useCallback(async (audioFile, generateSpectrogramFn) => {
    if (!audioFile) {
      setError('No reference file provided');
      return null;
    }

    try {
      setProgress(0);

      // Create audio context for decoding
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });

      // Read and decode file
      const arrayBuffer = await audioFile.arrayBuffer();
      const buffer = await audioContext.decodeAudioData(arrayBuffer);

      setReferenceBuffer(buffer);

      // Generate spectrogram for reference
      if (generateSpectrogramFn) {
        const spectrogram = await generateSpectrogramFn(buffer, {
          width: 1200,
          height: 256
        });
        setReferenceSpectrogram(spectrogram);
      }

      await audioContext.close();

      return buffer;

    } catch (err) {
      setError(`Failed to load reference: ${err.message}`);
      return null;
    }
  }, []);

  /**
   * Compare main spectrogram to loaded reference track
   *
   * Performs frequency band comparison and generates EQ recommendations.
   * Reference track must be loaded first via loadReferenceTrack().
   *
   * @param {Object} mainSpectrogram - Main track spectrogram data
   * @returns {import('../utils/mixAnalysisUtils').ComparisonResult|null} Comparison or null
   */
  const compareWithReference = useCallback((mainSpectrogram) => {
    if (!referenceSpectrogram || !mainSpectrogram) {
      return null;
    }

    const comparison = compareToReference(mainSpectrogram, referenceSpectrogram);
    setComparisonResults(comparison);
    return comparison;
  }, [referenceSpectrogram]);

  /**
   * Clear loaded reference track and comparison results
   * @returns {void}
   */
  const clearReference = useCallback(() => {
    setReferenceBuffer(null);
    setReferenceSpectrogram(null);
    setComparisonResults(null);
  }, []);

  /**
   * Cancel ongoing analysis
   * Sets abort flag and resets progress state
   * @returns {void}
   */
  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setIsAnalyzing(false);
    setProgress(0);
  }, []);

  /**
   * Clear all analysis results, comparison, and errors
   * Use when unloading audio or starting fresh
   * @returns {void}
   */
  const clearAnalysis = useCallback(() => {
    setAnalysisResults(null);
    setComparisonResults(null);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Get all issues filtered by severity level
   *
   * Combines problems, masking regions, and resonances.
   *
   * @param {'mild'|'moderate'|'severe'} severity - Severity level to filter
   * @returns {Array} Combined array of issues with matching severity
   */
  const getProblemsBySeverity = useCallback((severity) => {
    if (!analysisResults) return [];
    return [
      ...analysisResults.problems.filter(p => p.severity === severity),
      ...analysisResults.masking.filter(m => m.severity === severity),
      ...analysisResults.resonances.filter(r => r.severity === severity)
    ];
  }, [analysisResults]);

  /**
   * Get all problem markers formatted for spectrogram overlay
   *
   * Returns markers suitable for rendering on the spectrogram canvas.
   * Includes both time-bounded problems and full-duration resonances.
   *
   * @returns {ProblemMarker[]} Array of markers for overlay rendering
   */
  const getProblemMarkers = useCallback(() => {
    if (!analysisResults) return [];

    const markers = [];

    // Add problem frequency markers
    analysisResults.problems.forEach(problem => {
      markers.push({
        type: 'problem',
        subType: problem.type,
        startTime: problem.startTime,
        endTime: problem.endTime,
        frequency: problem.frequency,
        severity: problem.severity,
        label: problem.name,
        description: problem.description
      });
    });

    // Add resonance markers
    analysisResults.resonances.forEach(resonance => {
      markers.push({
        type: 'resonance',
        startTime: 0,
        endTime: analysisResults.loudness?.segments?.[analysisResults.loudness.segments.length - 1]?.endTime || 0,
        frequency: resonance.frequency,
        severity: resonance.severity,
        label: `Resonance at ${Math.round(resonance.frequency)}Hz`,
        description: resonance.description
      });
    });

    return markers;
  }, [analysisResults]);

  return {
    isAnalyzing,
    progress,
    analysisResults,
    error,
    referenceBuffer,
    referenceSpectrogram,
    comparisonResults,
    analyzeMix,
    loadReferenceTrack,
    compareWithReference,
    clearReference,
    cancelAnalysis,
    clearAnalysis,
    getProblemsBySeverity,
    getProblemMarkers
  };
}

/**
 * Yield to UI event loop to prevent blocking
 *
 * Uses setTimeout(0) to allow browser to process pending events
 * and keep the UI responsive during long-running analysis.
 *
 * @private
 * @returns {Promise<void>} Resolves on next tick
 */
function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export default useMixAnalysis;
