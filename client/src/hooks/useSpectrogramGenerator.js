/**
 * @module useSpectrogramGenerator
 * @description React hook for generating spectrograms from AudioBuffer
 *
 * Provides a complete spectrogram generation pipeline with:
 * - Stereo L/R channel support
 * - Progress tracking with abort capability
 * - Automatic rendering to ImageData
 * - Re-rendering at different dimensions
 *
 * ## Usage
 * ```javascript
 * import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
 *
 * function SpectrogramComponent({ audioBuffer }) {
 *   const {
 *     isGenerating,
 *     progress,
 *     spectrogramData,
 *     error,
 *     generateSpectrogram
 *   } = useSpectrogramGenerator();
 *
 *   useEffect(() => {
 *     if (audioBuffer) {
 *       generateSpectrogram(audioBuffer, { width: 1200, height: 256 });
 *     }
 *   }, [audioBuffer]);
 *
 *   return isGenerating
 *     ? <ProgressBar value={progress} />
 *     : <SpectrogramCanvas data={spectrogramData} />;
 * }
 * ```
 *
 * @author Music Analyzer Team
 * @version 1.0.0
 */

import { useState, useCallback, useRef } from 'react';
import {
  computeSpectrogram,
  renderSpectrogramToImageData,
  DEFAULT_FFT_SIZE,
  DEFAULT_HOP_SIZE,
  DEFAULT_MIN_FREQ,
  DEFAULT_MAX_FREQ
} from '../utils/spectrogramUtils';

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * @typedef {Object} SpectrogramOptions
 * @property {number} [fftSize=2048] - FFT window size
 * @property {number} [hopSize=512] - Hop size between frames
 * @property {number} [minFreq=20] - Minimum frequency in Hz
 * @property {number} [maxFreq=20000] - Maximum frequency in Hz
 * @property {number} [width=1200] - Output image width in pixels
 * @property {number} [height=256] - Output image height in pixels
 */

/**
 * @typedef {Object} ChannelData
 * @property {Object} spectrogram - Raw spectrogram data
 * @property {ImageData} imageData - Rendered image data
 */

/**
 * @typedef {Object} SpectrogramResult
 * @property {ChannelData} mono - Mono mix spectrogram (always present)
 * @property {ChannelData} [left] - Left channel spectrogram (stereo only)
 * @property {ChannelData} [right] - Right channel spectrogram (stereo only)
 * @property {number} duration - Audio duration in seconds
 * @property {number} sampleRate - Sample rate in Hz
 * @property {number} numChannels - Number of audio channels
 * @property {number} fftSize - FFT size used
 * @property {number} hopSize - Hop size used
 * @property {number} width - Image width
 * @property {number} height - Image height
 * @property {number} minFreq - Minimum frequency
 * @property {number} maxFreq - Maximum frequency
 */

/**
 * @typedef {Object} UseSpectrogramGeneratorReturn
 * @property {boolean} isGenerating - True while generating
 * @property {number} progress - Generation progress (0-1)
 * @property {SpectrogramResult|null} spectrogramData - Generated data
 * @property {string|null} error - Error message if failed
 * @property {function} generateSpectrogram - Generate from AudioBuffer
 * @property {function} generateFromFile - Generate from File
 * @property {function} rerenderSpectrogram - Re-render at new dimensions
 * @property {function} cancelGeneration - Cancel ongoing generation
 * @property {function} clearSpectrogram - Clear all data
 */

/**
 * Custom hook for generating spectrograms from AudioBuffer
 *
 * Handles stereo channels, progress tracking, abort capability,
 * and automatic rendering to ImageData for canvas display.
 *
 * @returns {UseSpectrogramGeneratorReturn} Hook state and methods
 *
 * @example
 * const { generateSpectrogram, spectrogramData, isGenerating } = useSpectrogramGenerator();
 *
 * // Generate from AudioBuffer
 * await generateSpectrogram(audioBuffer, { width: 1200, height: 300 });
 *
 * // Access the rendered data
 * if (spectrogramData) {
 *   ctx.putImageData(spectrogramData.mono.imageData, 0, 0);
 * }
 */
export function useSpectrogramGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(false);

  /**
   * Generate spectrogram from AudioBuffer
   *
   * Computes spectrograms for all channels (mono mix always, plus L/R for stereo)
   * and renders them to ImageData for canvas display. Progress is reported
   * during generation and can be cancelled via cancelGeneration().
   *
   * @param {AudioBuffer} audioBuffer - Decoded Web Audio API AudioBuffer
   * @param {SpectrogramOptions} [options={}] - Configuration options
   * @returns {Promise<SpectrogramResult|null>} Spectrogram data or null on error/cancel
   *
   * @example
   * const result = await generateSpectrogram(audioBuffer, {
   *   fftSize: 2048,
   *   width: 1200,
   *   height: 300
   * });
   */
  const generateSpectrogram = useCallback(async (audioBuffer, options = {}) => {
    if (!audioBuffer) {
      setError('No audio buffer provided');
      return null;
    }

    const {
      fftSize = DEFAULT_FFT_SIZE,
      hopSize = DEFAULT_HOP_SIZE,
      minFreq = DEFAULT_MIN_FREQ,
      maxFreq = DEFAULT_MAX_FREQ,
      width = 1200,
      height = 256
    } = options;

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      const sampleRate = audioBuffer.sampleRate;
      const numChannels = audioBuffer.numberOfChannels;
      const duration = audioBuffer.duration;

      // Get channel data
      const leftChannel = audioBuffer.getChannelData(0);
      const rightChannel = numChannels > 1
        ? audioBuffer.getChannelData(1)
        : leftChannel;

      // Calculate mono mix for single-view analysis
      const monoBuffer = new Float32Array(leftChannel.length);
      for (let i = 0; i < leftChannel.length; i++) {
        monoBuffer[i] = numChannels > 1
          ? (leftChannel[i] + rightChannel[i]) / 2
          : leftChannel[i];
      }

      // Process in chunks to avoid blocking UI
      const processChannel = async (channelData, channelName) => {
        return new Promise((resolve) => {
          // Use setTimeout to yield to the event loop periodically
          setTimeout(() => {
            const spectrogram = computeSpectrogram(channelData, sampleRate, {
              fftSize,
              hopSize,
              onProgress: (p) => {
                if (channelName === 'left') {
                  setProgress(p * 0.33);
                } else if (channelName === 'right') {
                  setProgress(0.33 + p * 0.33);
                } else {
                  setProgress(0.66 + p * 0.34);
                }
              }
            });
            resolve(spectrogram);
          }, 0);
        });
      };

      // Check for abort
      if (abortRef.current) {
        throw new Error('Generation cancelled');
      }

      // Generate spectrograms for each channel
      let leftSpectrogram, rightSpectrogram, monoSpectrogram;

      if (numChannels > 1) {
        // Stereo: compute both channels
        setProgress(0);
        leftSpectrogram = await processChannel(leftChannel, 'left');

        if (abortRef.current) throw new Error('Generation cancelled');

        rightSpectrogram = await processChannel(rightChannel, 'right');

        if (abortRef.current) throw new Error('Generation cancelled');
      }

      // Always compute mono for combined analysis
      monoSpectrogram = await processChannel(monoBuffer, 'mono');

      if (abortRef.current) throw new Error('Generation cancelled');

      // Render to images
      setProgress(0.9);

      const renderOptions = { minFreq, maxFreq };

      const renderedData = {
        mono: {
          spectrogram: monoSpectrogram,
          imageData: renderSpectrogramToImageData(monoSpectrogram, width, height, renderOptions)
        },
        duration,
        sampleRate,
        numChannels,
        fftSize,
        hopSize,
        width,
        height,
        minFreq,
        maxFreq
      };

      if (numChannels > 1) {
        renderedData.left = {
          spectrogram: leftSpectrogram,
          imageData: renderSpectrogramToImageData(leftSpectrogram, width, height / 2, renderOptions)
        };
        renderedData.right = {
          spectrogram: rightSpectrogram,
          imageData: renderSpectrogramToImageData(rightSpectrogram, width, height / 2, renderOptions)
        };
      }

      setSpectrogramData(renderedData);
      setProgress(1);

      return renderedData;

    } catch (err) {
      if (err.message !== 'Generation cancelled') {
        setError(err.message || 'Failed to generate spectrogram');
        console.error('Spectrogram generation error:', err);
      }
      return null;

    } finally {
      setIsGenerating(false);
    }
  }, []);

  /**
   * Generate spectrogram directly from an audio file
   *
   * Convenience method that handles file reading and audio decoding.
   * Creates a temporary AudioContext for decoding which is cleaned up after.
   *
   * @param {File} audioFile - Audio file (WAV, MP3, etc.)
   * @param {SpectrogramOptions} [options={}] - Configuration options
   * @returns {Promise<SpectrogramResult|null>} Spectrogram data or null on error
   *
   * @example
   * const fileInput = document.querySelector('input[type="file"]');
   * const result = await generateFromFile(fileInput.files[0]);
   */
  const generateFromFile = useCallback(async (audioFile, options = {}) => {
    if (!audioFile) {
      setError('No audio file provided');
      return null;
    }

    setIsGenerating(true);
    setProgress(0);
    setError(null);
    abortRef.current = false;

    try {
      // Create audio context for decoding
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass({ sampleRate: 44100 });

      // Read file
      setProgress(0.05);
      const arrayBuffer = await audioFile.arrayBuffer();

      if (abortRef.current) {
        await audioContext.close();
        throw new Error('Generation cancelled');
      }

      // Decode audio
      setProgress(0.1);
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      if (abortRef.current) {
        await audioContext.close();
        throw new Error('Generation cancelled');
      }

      // Generate spectrogram
      const result = await generateSpectrogram(audioBuffer, options);

      // Cleanup
      await audioContext.close();

      return result;

    } catch (err) {
      if (err.message !== 'Generation cancelled') {
        setError(err.message || 'Failed to generate spectrogram');
        console.error('Spectrogram generation error:', err);
      }
      return null;

    } finally {
      setIsGenerating(false);
    }
  }, [generateSpectrogram]);

  /**
   * Re-render spectrogram at different dimensions
   *
   * Uses the existing spectrogram data to render at new dimensions.
   * Much faster than regenerating since FFT computation is skipped.
   * Useful for responsive layouts or zooming.
   *
   * @param {number} width - New width in pixels
   * @param {number} height - New height in pixels
   * @returns {SpectrogramResult|null} Updated data or null if no spectrogram loaded
   */
  const rerenderSpectrogram = useCallback((width, height) => {
    if (!spectrogramData) return null;

    const renderOptions = {
      minFreq: spectrogramData.minFreq,
      maxFreq: spectrogramData.maxFreq
    };

    const newData = {
      ...spectrogramData,
      width,
      height,
      mono: {
        ...spectrogramData.mono,
        imageData: renderSpectrogramToImageData(
          spectrogramData.mono.spectrogram, width, height, renderOptions
        )
      }
    };

    if (spectrogramData.numChannels > 1) {
      newData.left = {
        ...spectrogramData.left,
        imageData: renderSpectrogramToImageData(
          spectrogramData.left.spectrogram, width, height / 2, renderOptions
        )
      };
      newData.right = {
        ...spectrogramData.right,
        imageData: renderSpectrogramToImageData(
          spectrogramData.right.spectrogram, width, height / 2, renderOptions
        )
      };
    }

    setSpectrogramData(newData);
    return newData;
  }, [spectrogramData]);

  /**
   * Cancel ongoing spectrogram generation
   *
   * Sets abort flag and resets state. The generateSpectrogram promise
   * will reject with 'Generation cancelled' message (not treated as error).
   *
   * @returns {void}
   */
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setProgress(0);
  }, []);

  /**
   * Clear all spectrogram data and reset state
   *
   * Removes loaded spectrogram, clears any errors, and resets progress.
   * Use when unloading audio or switching to a new file.
   *
   * @returns {void}
   */
  const clearSpectrogram = useCallback(() => {
    setSpectrogramData(null);
    setError(null);
    setProgress(0);
  }, []);

  return {
    isGenerating,
    progress,
    spectrogramData,
    error,
    generateSpectrogram,
    generateFromFile,
    rerenderSpectrogram,
    cancelGeneration,
    clearSpectrogram
  };
}

export default useSpectrogramGenerator;
