/**
 * @module useGenreDetection
 * @description React hook for automatic genre detection from audio characteristics
 *
 * Uses audio metrics to infer the most likely genre based on:
 * - LUFS loudness
 * - Dynamic range
 * - Frequency profile (bass, mid, high ratios)
 * - Crest factor (transient content)
 */

import { useState, useCallback, useMemo } from 'react';
import {
  GENRE_TARGETS,
  detectGenre,
  getAvailableGenres,
  calculateFrequencyProfile
} from '../utils/optimizationUtils';

/**
 * Hook for genre detection from audio metrics
 * @returns {Object} Genre detection state and methods
 */
export function useGenreDetection() {
  const [detectedGenre, setDetectedGenre] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState('auto');
  const [isDetecting, setIsDetecting] = useState(false);

  /**
   * Detect genre from audio metrics
   * @param {Object} metrics - Audio metrics including LUFS, dynamic range, etc.
   * @returns {Object} Detection result
   */
  const detect = useCallback((metrics) => {
    if (!metrics) return null;

    setIsDetecting(true);

    try {
      const result = detectGenre(metrics);
      setDetectedGenre(result);
      return result;
    } finally {
      setIsDetecting(false);
    }
  }, []);

  /**
   * Get effective genre (selected or detected)
   */
  const effectiveGenre = useMemo(() => {
    if (selectedGenre && selectedGenre !== 'auto') {
      return selectedGenre;
    }
    return detectedGenre?.genre || 'pop';
  }, [selectedGenre, detectedGenre]);

  /**
   * Get targets for effective genre
   */
  const genreTargets = useMemo(() => {
    return GENRE_TARGETS[effectiveGenre] || GENRE_TARGETS.pop;
  }, [effectiveGenre]);

  /**
   * Available genres for selection
   */
  const availableGenres = useMemo(() => {
    return [
      { key: 'auto', name: 'Auto-detect' },
      ...getAvailableGenres()
    ];
  }, []);

  /**
   * Reset detection
   */
  const reset = useCallback(() => {
    setDetectedGenre(null);
  }, []);

  return {
    // State
    detectedGenre,
    selectedGenre,
    effectiveGenre,
    genreTargets,
    isDetecting,
    availableGenres,

    // Methods
    detect,
    setSelectedGenre,
    reset
  };
}

/**
 * Simple genre detection from FFT data
 * @param {Uint8Array} fftData - FFT magnitude data
 * @param {number} sampleRate - Sample rate
 * @param {number} fftSize - FFT size
 * @returns {Object} Frequency profile for genre detection
 */
export function analyzeFFTForGenre(fftData, sampleRate, fftSize) {
  return calculateFrequencyProfile(fftData, sampleRate, fftSize);
}

export default useGenreDetection;
