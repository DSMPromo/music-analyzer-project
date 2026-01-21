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

/**
 * Custom hook for mix/master analysis
 * Analyzes spectrogram data for problems, masking, resonances, and loudness
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
   * @param {Object} spectrogramData - Spectrogram data from useSpectrogramGenerator
   * @param {AudioBuffer} audioBuffer - Audio buffer for loudness analysis
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
   * Load reference track for comparison
   * @param {File} audioFile - Reference audio file
   * @param {Function} generateSpectrogramFn - Function to generate spectrogram
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
   * Compare current analysis to reference
   * @param {Object} mainSpectrogram - Main track spectrogram
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
   * Clear reference track
   */
  const clearReference = useCallback(() => {
    setReferenceBuffer(null);
    setReferenceSpectrogram(null);
    setComparisonResults(null);
  }, []);

  /**
   * Cancel ongoing analysis
   */
  const cancelAnalysis = useCallback(() => {
    abortRef.current = true;
    setIsAnalyzing(false);
    setProgress(0);
  }, []);

  /**
   * Clear all analysis results
   */
  const clearAnalysis = useCallback(() => {
    setAnalysisResults(null);
    setComparisonResults(null);
    setError(null);
    setProgress(0);
  }, []);

  /**
   * Get problems filtered by severity
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
   * Get all problem markers for spectrogram overlay
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
 * Yield to UI to prevent blocking
 */
function yieldToUI() {
  return new Promise(resolve => setTimeout(resolve, 0));
}

export default useMixAnalysis;
