import { useState, useCallback, useRef } from 'react';
import {
  computeSpectrogram,
  renderSpectrogramToImageData,
  DEFAULT_FFT_SIZE,
  DEFAULT_HOP_SIZE,
  DEFAULT_MIN_FREQ,
  DEFAULT_MAX_FREQ
} from '../utils/spectrogramUtils';

/**
 * Custom hook for generating spectrograms from AudioBuffer
 * Handles stereo channels, progress tracking, and rendering
 */
export function useSpectrogramGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [spectrogramData, setSpectrogramData] = useState(null);
  const [error, setError] = useState(null);

  const abortRef = useRef(false);

  /**
   * Generate spectrogram from AudioBuffer
   * @param {AudioBuffer} audioBuffer - Decoded audio buffer
   * @param {Object} options - Configuration options
   * @returns {Object} Spectrogram data with rendered images
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
   * @param {File} audioFile - Audio file
   * @param {Object} options - Configuration options
   * @returns {Object} Spectrogram data with rendered images
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
   * @param {number} width - New width
   * @param {number} height - New height
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
   * Cancel ongoing generation
   */
  const cancelGeneration = useCallback(() => {
    abortRef.current = true;
    setIsGenerating(false);
    setProgress(0);
  }, []);

  /**
   * Clear spectrogram data
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
