/**
 * Spectrogram Utilities
 * FFT processing, windowing functions, color mapping, and frequency scale utilities
 * for iZotope RX-style spectrogram visualization
 */

// ============================================
// CONSTANTS
// ============================================

// Default FFT parameters
export const DEFAULT_FFT_SIZE = 2048;
export const DEFAULT_HOP_SIZE = 512;
export const DEFAULT_MIN_DB = -90;
export const DEFAULT_MAX_DB = 0;
export const DEFAULT_MIN_FREQ = 20;
export const DEFAULT_MAX_FREQ = 20000;

// iZotope-style heat map color stops (dB value to RGB)
export const COLOR_STOPS = [
  { db: -90, color: [0, 20, 40] },      // Dark blue (silence)
  { db: -60, color: [10, 40, 80] },     // Deep blue
  { db: -40, color: [46, 74, 122] },    // Blue
  { db: -25, color: [106, 76, 147] },   // Purple
  { db: -15, color: [201, 76, 76] },    // Red
  { db: -8, color: [232, 138, 60] },    // Orange
  { db: -3, color: [245, 200, 66] },    // Yellow
  { db: 0, color: [255, 255, 192] }     // Bright yellow (peaks)
];

// Pre-computed color lookup table (256 entries for fast rendering)
let colorLUT = null;

// ============================================
// WINDOWING FUNCTIONS
// ============================================

/**
 * Generate a Hann window of specified size
 * @param {number} size - Window size
 * @returns {Float32Array} Hann window coefficients
 */
export function hannWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }
  return window;
}

/**
 * Generate a Hamming window of specified size
 * @param {number} size - Window size
 * @returns {Float32Array} Hamming window coefficients
 */
export function hammingWindow(size) {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    window[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (size - 1));
  }
  return window;
}

/**
 * Generate a Blackman-Harris window of specified size
 * @param {number} size - Window size
 * @returns {Float32Array} Blackman-Harris window coefficients
 */
export function blackmanHarrisWindow(size) {
  const window = new Float32Array(size);
  const a0 = 0.35875;
  const a1 = 0.48829;
  const a2 = 0.14128;
  const a3 = 0.01168;

  for (let i = 0; i < size; i++) {
    const angle = (2 * Math.PI * i) / (size - 1);
    window[i] = a0 - a1 * Math.cos(angle) + a2 * Math.cos(2 * angle) - a3 * Math.cos(3 * angle);
  }
  return window;
}

/**
 * Apply window function to audio data
 * @param {Float32Array} data - Audio samples
 * @param {Float32Array} window - Window coefficients
 * @returns {Float32Array} Windowed audio data
 */
export function applyWindow(data, window) {
  const result = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] * window[i];
  }
  return result;
}

// ============================================
// FFT IMPLEMENTATION
// ============================================

/**
 * Compute FFT magnitude spectrum using DFT
 * For production, consider using a Web Worker or WebAssembly FFT library
 * @param {Float32Array} data - Windowed audio samples (power of 2 length)
 * @returns {Float32Array} Magnitude spectrum (half the FFT size)
 */
export function computeFFTMagnitude(data) {
  const N = data.length;
  const halfN = N / 2;
  const magnitudes = new Float32Array(halfN);

  // Simple DFT implementation - optimized with symmetry
  for (let k = 0; k < halfN; k++) {
    let real = 0;
    let imag = 0;

    const twoPiKOverN = (2 * Math.PI * k) / N;

    for (let n = 0; n < N; n++) {
      const angle = twoPiKOverN * n;
      real += data[n] * Math.cos(angle);
      imag -= data[n] * Math.sin(angle);
    }

    magnitudes[k] = Math.sqrt(real * real + imag * imag) / N;
  }

  return magnitudes;
}

/**
 * Optimized FFT using Cooley-Tukey algorithm
 * @param {Float32Array} data - Audio samples (must be power of 2)
 * @returns {{real: Float32Array, imag: Float32Array}} Complex FFT result
 */
export function fft(data) {
  const N = data.length;

  // Bit reversal permutation
  const real = new Float32Array(N);
  const imag = new Float32Array(N);

  const bits = Math.log2(N);
  for (let i = 0; i < N; i++) {
    let reversed = 0;
    for (let j = 0; j < bits; j++) {
      reversed = (reversed << 1) | ((i >> j) & 1);
    }
    real[reversed] = data[i];
  }

  // Cooley-Tukey iterative FFT
  for (let size = 2; size <= N; size *= 2) {
    const halfSize = size / 2;
    const angle = -2 * Math.PI / size;

    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfSize; j++) {
        const tReal = Math.cos(angle * j) * real[i + j + halfSize] - Math.sin(angle * j) * imag[i + j + halfSize];
        const tImag = Math.sin(angle * j) * real[i + j + halfSize] + Math.cos(angle * j) * imag[i + j + halfSize];

        real[i + j + halfSize] = real[i + j] - tReal;
        imag[i + j + halfSize] = imag[i + j] - tImag;
        real[i + j] += tReal;
        imag[i + j] += tImag;
      }
    }
  }

  return { real, imag };
}

/**
 * Compute magnitude spectrum from FFT result
 * @param {{real: Float32Array, imag: Float32Array}} fftResult - Complex FFT result
 * @returns {Float32Array} Magnitude spectrum
 */
export function fftMagnitude(fftResult) {
  const N = fftResult.real.length;
  const halfN = N / 2;
  const magnitudes = new Float32Array(halfN);

  for (let i = 0; i < halfN; i++) {
    magnitudes[i] = Math.sqrt(
      fftResult.real[i] * fftResult.real[i] +
      fftResult.imag[i] * fftResult.imag[i]
    ) / N;
  }

  return magnitudes;
}

// ============================================
// COLOR MAPPING
// ============================================

/**
 * Build color lookup table for fast rendering
 * Maps 256 intensity values to RGBA colors
 * @returns {Uint8ClampedArray} Color LUT (256 * 4 bytes)
 */
export function buildColorLUT() {
  if (colorLUT) return colorLUT;

  colorLUT = new Uint8ClampedArray(256 * 4);

  for (let i = 0; i < 256; i++) {
    // Map 0-255 to dB range
    const db = DEFAULT_MIN_DB + (i / 255) * (DEFAULT_MAX_DB - DEFAULT_MIN_DB);
    const color = dbToColor(db);

    colorLUT[i * 4] = color[0];     // R
    colorLUT[i * 4 + 1] = color[1]; // G
    colorLUT[i * 4 + 2] = color[2]; // B
    colorLUT[i * 4 + 3] = 255;      // A
  }

  return colorLUT;
}

/**
 * Convert dB value to RGB color using gradient interpolation
 * @param {number} db - Decibel value
 * @returns {number[]} RGB array [r, g, b]
 */
export function dbToColor(db) {
  // Clamp to valid range
  db = Math.max(DEFAULT_MIN_DB, Math.min(DEFAULT_MAX_DB, db));

  // Find the two color stops to interpolate between
  let lower = COLOR_STOPS[0];
  let upper = COLOR_STOPS[COLOR_STOPS.length - 1];

  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    if (db >= COLOR_STOPS[i].db && db <= COLOR_STOPS[i + 1].db) {
      lower = COLOR_STOPS[i];
      upper = COLOR_STOPS[i + 1];
      break;
    }
  }

  // Interpolate between the two stops
  const range = upper.db - lower.db;
  const t = range === 0 ? 0 : (db - lower.db) / range;

  return [
    Math.round(lower.color[0] + t * (upper.color[0] - lower.color[0])),
    Math.round(lower.color[1] + t * (upper.color[1] - lower.color[1])),
    Math.round(lower.color[2] + t * (upper.color[2] - lower.color[2]))
  ];
}

/**
 * Convert magnitude to dB
 * @param {number} magnitude - Linear magnitude
 * @returns {number} Decibel value
 */
export function magnitudeToDb(magnitude) {
  if (magnitude <= 0) return DEFAULT_MIN_DB;
  const db = 20 * Math.log10(magnitude);
  return Math.max(DEFAULT_MIN_DB, Math.min(DEFAULT_MAX_DB, db));
}

/**
 * Get color index (0-255) from dB value
 * @param {number} db - Decibel value
 * @returns {number} Color index
 */
export function dbToColorIndex(db) {
  db = Math.max(DEFAULT_MIN_DB, Math.min(DEFAULT_MAX_DB, db));
  return Math.round(((db - DEFAULT_MIN_DB) / (DEFAULT_MAX_DB - DEFAULT_MIN_DB)) * 255);
}

// ============================================
// FREQUENCY SCALE MAPPING
// ============================================

/**
 * Generate logarithmic frequency scale mapping
 * Maps display rows to frequency bins
 * @param {number} numRows - Number of display rows (height in pixels)
 * @param {number} fftSize - FFT size
 * @param {number} sampleRate - Audio sample rate
 * @param {number} minFreq - Minimum frequency (Hz)
 * @param {number} maxFreq - Maximum frequency (Hz)
 * @returns {number[]} Array of FFT bin indices for each display row
 */
export function buildLogFrequencyScale(numRows, fftSize, sampleRate, minFreq = DEFAULT_MIN_FREQ, maxFreq = DEFAULT_MAX_FREQ) {
  // Ensure valid numRows
  const safeNumRows = Math.max(1, Math.floor(numRows) || 1);
  const binCount = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;
  const logMinFreq = Math.log10(minFreq);
  const logMaxFreq = Math.log10(maxFreq);
  const logRange = logMaxFreq - logMinFreq;

  const scale = new Array(safeNumRows);

  for (let row = 0; row < safeNumRows; row++) {
    // Map row to frequency (bottom = low freq, top = high freq)
    // Handle single row case to avoid division by zero
    const ratio = safeNumRows > 1 ? row / (safeNumRows - 1) : 0.5;
    const logFreq = logMinFreq + ratio * logRange;
    const freq = Math.pow(10, logFreq);

    // Convert frequency to FFT bin index
    const bin = Math.round(freq / freqPerBin);
    scale[row] = Math.min(Math.max(0, bin), binCount - 1);
  }

  return scale;
}

/**
 * Get frequency labels for Y-axis
 * @param {number} numLabels - Number of labels to generate
 * @param {number} minFreq - Minimum frequency
 * @param {number} maxFreq - Maximum frequency
 * @returns {{freq: number, label: string}[]} Array of frequency labels
 */
export function getFrequencyLabels(numLabels = 8, minFreq = DEFAULT_MIN_FREQ, maxFreq = DEFAULT_MAX_FREQ) {
  const labels = [];
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logRange = logMax - logMin;

  for (let i = 0; i < numLabels; i++) {
    const ratio = i / (numLabels - 1);
    const logFreq = logMin + ratio * logRange;
    const freq = Math.pow(10, logFreq);

    // Format label
    let label;
    if (freq >= 1000) {
      label = `${(freq / 1000).toFixed(freq >= 10000 ? 0 : 1)}k`;
    } else {
      label = `${Math.round(freq)}`;
    }

    labels.push({ freq, label });
  }

  return labels;
}

/**
 * Get time labels for X-axis
 * @param {number} duration - Total duration in seconds
 * @param {number} numLabels - Number of labels
 * @returns {{time: number, label: string}[]} Array of time labels
 */
export function getTimeLabels(duration, numLabels = 10) {
  const labels = [];
  const step = duration / (numLabels - 1);

  for (let i = 0; i < numLabels; i++) {
    const time = i * step;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const label = `${mins}:${secs.toString().padStart(2, '0')}`;
    labels.push({ time, label });
  }

  return labels;
}

/**
 * Convert pixel Y position to frequency
 * @param {number} y - Y position (0 = top)
 * @param {number} height - Canvas height
 * @param {number} minFreq - Minimum frequency
 * @param {number} maxFreq - Maximum frequency
 * @returns {number} Frequency in Hz
 */
export function yToFrequency(y, height, minFreq = DEFAULT_MIN_FREQ, maxFreq = DEFAULT_MAX_FREQ) {
  const ratio = 1 - (y / height); // Invert so top = high freq
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = logMin + ratio * (logMax - logMin);
  return Math.pow(10, logFreq);
}

/**
 * Convert frequency to pixel Y position
 * @param {number} freq - Frequency in Hz
 * @param {number} height - Canvas height
 * @param {number} minFreq - Minimum frequency
 * @param {number} maxFreq - Maximum frequency
 * @returns {number} Y position
 */
export function frequencyToY(freq, height, minFreq = DEFAULT_MIN_FREQ, maxFreq = DEFAULT_MAX_FREQ) {
  const logMin = Math.log10(minFreq);
  const logMax = Math.log10(maxFreq);
  const logFreq = Math.log10(Math.max(minFreq, Math.min(maxFreq, freq)));
  const ratio = (logFreq - logMin) / (logMax - logMin);
  return height * (1 - ratio); // Invert so high freq = top
}

/**
 * Convert pixel X position to time
 * @param {number} x - X position
 * @param {number} width - Canvas width
 * @param {number} duration - Total duration
 * @returns {number} Time in seconds
 */
export function xToTime(x, width, duration) {
  return (x / width) * duration;
}

/**
 * Convert time to pixel X position
 * @param {number} time - Time in seconds
 * @param {number} width - Canvas width
 * @param {number} duration - Total duration
 * @returns {number} X position
 */
export function timeToX(time, width, duration) {
  return (time / duration) * width;
}

// ============================================
// SPECTROGRAM COMPUTATION
// ============================================

/**
 * Compute full spectrogram data from audio buffer
 * @param {Float32Array} audioData - Audio samples
 * @param {number} sampleRate - Sample rate
 * @param {Object} options - Configuration options
 * @returns {{data: Float32Array[], numFrames: number, numBins: number, duration: number}}
 */
export function computeSpectrogram(audioData, sampleRate, options = {}) {
  const {
    fftSize = DEFAULT_FFT_SIZE,
    hopSize = DEFAULT_HOP_SIZE,
    windowFn = hannWindow,
    onProgress = null
  } = options;

  const numSamples = audioData.length;
  const numBins = fftSize / 2;
  const duration = numSamples / sampleRate;

  // Handle case where audio is shorter than FFT size
  if (numSamples < fftSize) {
    // Pad with zeros or return minimal spectrogram
    const paddedData = new Float32Array(fftSize);
    paddedData.set(audioData);
    const window = windowFn(fftSize);
    const frameData = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frameData[i] = paddedData[i] * window[i];
    }
    const fftResult = fft(frameData);
    const magnitudes = fftMagnitude(fftResult);
    const dbData = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      dbData[i] = magnitudeToDb(magnitudes[i]);
    }
    return {
      data: [dbData],
      numFrames: 1,
      numBins,
      duration,
      sampleRate,
      fftSize,
      hopSize
    };
  }

  const numFrames = Math.max(1, Math.floor((numSamples - fftSize) / hopSize) + 1);

  // Pre-compute window
  const window = windowFn(fftSize);

  // Storage for spectrogram data (array of magnitude arrays)
  const data = new Array(numFrames);

  // Process each frame
  for (let frame = 0; frame < numFrames; frame++) {
    const startSample = frame * hopSize;

    // Extract and window the frame
    const frameData = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      frameData[i] = audioData[startSample + i] * window[i];
    }

    // Compute FFT
    const fftResult = fft(frameData);
    const magnitudes = fftMagnitude(fftResult);

    // Convert to dB
    const dbData = new Float32Array(numBins);
    for (let i = 0; i < numBins; i++) {
      dbData[i] = magnitudeToDb(magnitudes[i]);
    }

    data[frame] = dbData;

    // Report progress
    if (onProgress && frame % 100 === 0) {
      onProgress(frame / numFrames);
    }
  }

  return {
    data,
    numFrames,
    numBins,
    duration,
    sampleRate,
    fftSize,
    hopSize
  };
}

/**
 * Render spectrogram to ImageData
 * @param {Object} spectrogram - Spectrogram data from computeSpectrogram
 * @param {number} width - Output width
 * @param {number} height - Output height
 * @param {Object} options - Rendering options
 * @returns {ImageData} Rendered spectrogram image
 */
export function renderSpectrogramToImageData(spectrogram, width, height, options = {}) {
  const {
    minFreq = DEFAULT_MIN_FREQ,
    maxFreq = DEFAULT_MAX_FREQ,
    minDb = DEFAULT_MIN_DB,
    maxDb = DEFAULT_MAX_DB
  } = options;

  // Validate dimensions
  const safeWidth = Math.max(1, Math.floor(width) || 1);
  const safeHeight = Math.max(1, Math.floor(height) || 1);

  const { data, numFrames, sampleRate, fftSize } = spectrogram;
  const numBins = fftSize / 2;

  // Handle empty or invalid spectrogram
  if (!data || data.length === 0 || numFrames <= 0) {
    const imageData = new ImageData(safeWidth, safeHeight);
    return imageData;
  }

  // Build lookup tables
  const lut = buildColorLUT();
  const freqScale = buildLogFrequencyScale(safeHeight, fftSize, sampleRate, minFreq, maxFreq);

  // Create ImageData
  const imageData = new ImageData(safeWidth, safeHeight);
  const pixels = imageData.data;

  // Render each pixel
  for (let y = 0; y < safeHeight; y++) {
    // Get FFT bin for this row (inverted: top = high freq)
    const bin = freqScale[safeHeight - 1 - y];

    for (let x = 0; x < safeWidth; x++) {
      // Get frame index for this column
      const frameIdx = Math.floor((x / safeWidth) * numFrames);
      const frame = data[Math.min(frameIdx, numFrames - 1)];

      // Get dB value and map to color
      const db = frame[bin];
      const colorIdx = dbToColorIndex(db);

      // Set pixel color from LUT
      const pixelIdx = (y * safeWidth + x) * 4;
      pixels[pixelIdx] = lut[colorIdx * 4];
      pixels[pixelIdx + 1] = lut[colorIdx * 4 + 1];
      pixels[pixelIdx + 2] = lut[colorIdx * 4 + 2];
      pixels[pixelIdx + 3] = 255;
    }
  }

  return imageData;
}

/**
 * Get dB value at specific time and frequency
 * @param {Object} spectrogram - Spectrogram data
 * @param {number} time - Time in seconds
 * @param {number} frequency - Frequency in Hz
 * @returns {number} dB value
 */
export function getDbAtTimeFreq(spectrogram, time, frequency) {
  const { data, numFrames, duration, sampleRate, fftSize } = spectrogram;

  // Get frame index
  const frameIdx = Math.floor((time / duration) * numFrames);
  if (frameIdx < 0 || frameIdx >= numFrames) return DEFAULT_MIN_DB;

  // Get bin index
  const freqPerBin = sampleRate / fftSize;
  const bin = Math.round(frequency / freqPerBin);
  if (bin < 0 || bin >= fftSize / 2) return DEFAULT_MIN_DB;

  return data[frameIdx][bin];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Format dB value for display
 * @param {number} db - Decibel value
 * @returns {string} Formatted string
 */
export function formatDb(db) {
  if (db <= DEFAULT_MIN_DB) return '-inf';
  return `${db.toFixed(1)} dB`;
}

/**
 * Format frequency for display
 * @param {number} freq - Frequency in Hz
 * @returns {string} Formatted string
 */
export function formatFrequency(freq) {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(freq >= 10000 ? 1 : 2)} kHz`;
  }
  return `${Math.round(freq)} Hz`;
}

/**
 * Calculate average spectrum for a time range
 * @param {Object} spectrogram - Spectrogram data
 * @param {number} startTime - Start time in seconds
 * @param {number} endTime - End time in seconds
 * @returns {Float32Array} Average spectrum in dB
 */
export function getAverageSpectrum(spectrogram, startTime, endTime) {
  const { data, numFrames, duration, fftSize } = spectrogram;
  const numBins = fftSize / 2;

  const startFrame = Math.max(0, Math.floor((startTime / duration) * numFrames));
  const endFrame = Math.min(numFrames - 1, Math.floor((endTime / duration) * numFrames));

  const avgSpectrum = new Float32Array(numBins);
  const frameCount = endFrame - startFrame + 1;

  if (frameCount <= 0) return avgSpectrum;

  // Sum all frames
  for (let frame = startFrame; frame <= endFrame; frame++) {
    for (let bin = 0; bin < numBins; bin++) {
      // Convert from dB to linear for averaging
      avgSpectrum[bin] += Math.pow(10, data[frame][bin] / 20);
    }
  }

  // Average and convert back to dB
  for (let bin = 0; bin < numBins; bin++) {
    avgSpectrum[bin] = magnitudeToDb(avgSpectrum[bin] / frameCount);
  }

  return avgSpectrum;
}
