/**
 * Audio Analysis Utility Functions
 * Helper functions for loudness, frequency, stereo, and quality analysis
 */

// Platform loudness targets
export const PLATFORM_TARGETS = {
  spotify: { lufs: -14, ceiling: -1, name: 'Spotify' },
  appleMusic: { lufs: -16, ceiling: -1, name: 'Apple Music' },
  youtube: { lufs: -14, ceiling: -1, name: 'YouTube' },
  podcast: { lufs: -16, ceiling: -2, name: 'Podcast' },
  broadcast: { lufs: -23, ceiling: -1, name: 'Broadcast (EBU R128)' }
};

// Frequency band definitions
export const FREQUENCY_BANDS = [
  { name: 'Sub Bass', low: 20, high: 60, color: '#8B5CF6' },
  { name: 'Bass', low: 60, high: 250, color: '#3B82F6' },
  { name: 'Low Mid', low: 250, high: 500, color: '#10B981' },
  { name: 'Mid', low: 500, high: 2000, color: '#F59E0B' },
  { name: 'High Mid', low: 2000, high: 4000, color: '#EF4444' },
  { name: 'Presence', low: 4000, high: 6000, color: '#EC4899' },
  { name: 'Brilliance', low: 6000, high: 20000, color: '#A855F7' }
];

/**
 * Convert linear amplitude to decibels
 * @param {number} amplitude - Linear amplitude value
 * @returns {number} Value in dB
 */
export const linearToDb = (amplitude) => {
  if (amplitude <= 0) return -Infinity;
  return 20 * Math.log10(amplitude);
};

/**
 * Convert decibels to linear amplitude
 * @param {number} db - Value in decibels
 * @returns {number} Linear amplitude
 */
export const dbToLinear = (db) => {
  return Math.pow(10, db / 20);
};

/**
 * Calculate peak amplitude from audio buffer
 * @param {Float32Array} buffer - Audio sample buffer
 * @returns {number} Peak amplitude (0 to 1)
 */
export const calculatePeak = (buffer) => {
  let max = 0;
  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs > max) max = abs;
  }
  return max;
};

/**
 * Calculate RMS (Root Mean Square) level
 * @param {Float32Array} buffer - Audio sample buffer
 * @returns {number} RMS level (0 to 1)
 */
export const calculateRMS = (buffer) => {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i] * buffer[i];
  }
  return Math.sqrt(sum / buffer.length);
};

/**
 * Calculate crest factor (peak to RMS ratio)
 * @param {number} peak - Peak amplitude
 * @param {number} rms - RMS level
 * @returns {number} Crest factor in dB
 */
export const calculateCrestFactor = (peak, rms) => {
  if (rms <= 0) return 0;
  return linearToDb(peak / rms);
};

/**
 * Calculate dynamic range
 * @param {number} peakDb - Peak in dB
 * @param {number} rmsDb - RMS in dB
 * @returns {number} Dynamic range in dB
 */
export const calculateDynamicRange = (peakDb, rmsDb) => {
  return peakDb - rmsDb;
};

/**
 * Detect clipping in audio buffer
 * @param {Float32Array} buffer - Audio sample buffer
 * @param {number} threshold - Clipping threshold (default 0.99)
 * @returns {Object} Clipping info with count and positions
 */
export const detectClipping = (buffer, threshold = 0.99) => {
  const clips = [];
  let clipCount = 0;
  let inClip = false;

  for (let i = 0; i < buffer.length; i++) {
    const abs = Math.abs(buffer[i]);
    if (abs >= threshold) {
      if (!inClip) {
        clips.push(i);
        inClip = true;
      }
      clipCount++;
    } else {
      inClip = false;
    }
  }

  return { count: clipCount, positions: clips.slice(0, 100) };
};

/**
 * Calculate DC offset
 * @param {Float32Array} buffer - Audio sample buffer
 * @returns {number} DC offset value
 */
export const calculateDCOffset = (buffer) => {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    sum += buffer[i];
  }
  return sum / buffer.length;
};

/**
 * Estimate Signal-to-Noise Ratio
 * Uses quiet sections as noise floor estimation
 * @param {Float32Array} buffer - Audio sample buffer
 * @param {number} sampleRate - Sample rate
 * @returns {number} Estimated SNR in dB
 */
export const estimateSNR = (buffer, sampleRate) => {
  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const numWindows = Math.floor(buffer.length / windowSize);

  if (numWindows < 2) return 60; // Default for short samples

  const windowRMS = [];
  for (let i = 0; i < numWindows; i++) {
    const start = i * windowSize;
    const end = start + windowSize;
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += buffer[j] * buffer[j];
    }
    windowRMS.push(Math.sqrt(sum / windowSize));
  }

  // Sort to find quiet sections (noise floor)
  windowRMS.sort((a, b) => a - b);

  // Use bottom 10% as noise floor estimate
  const noiseFloorIdx = Math.max(0, Math.floor(numWindows * 0.1));
  const noiseFloor = windowRMS[noiseFloorIdx] || 0.0001;

  // Use top 10% as signal level
  const signalIdx = Math.floor(numWindows * 0.9);
  const signalLevel = windowRMS[signalIdx] || noiseFloor;

  if (noiseFloor <= 0) return 80; // Very clean signal

  return linearToDb(signalLevel / noiseFloor);
};

/**
 * Calculate stereo width (correlation-based)
 * @param {Float32Array} leftChannel - Left channel samples
 * @param {Float32Array} rightChannel - Right channel samples
 * @returns {number} Stereo width (0 to 100%)
 */
export const calculateStereoWidth = (leftChannel, rightChannel) => {
  if (!leftChannel || !rightChannel || leftChannel.length === 0) return 0;

  let sumL = 0, sumR = 0, sumLR = 0;
  let sumL2 = 0, sumR2 = 0;

  const length = Math.min(leftChannel.length, rightChannel.length);

  for (let i = 0; i < length; i++) {
    const l = leftChannel[i];
    const r = rightChannel[i];
    sumL += l;
    sumR += r;
    sumLR += l * r;
    sumL2 += l * l;
    sumR2 += r * r;
  }

  const meanL = sumL / length;
  const meanR = sumR / length;

  // Calculate correlation coefficient
  let numerator = 0;
  let denomL = 0, denomR = 0;

  for (let i = 0; i < length; i++) {
    const diffL = leftChannel[i] - meanL;
    const diffR = rightChannel[i] - meanR;
    numerator += diffL * diffR;
    denomL += diffL * diffL;
    denomR += diffR * diffR;
  }

  const denom = Math.sqrt(denomL * denomR);
  if (denom === 0) return 0;

  const correlation = numerator / denom;

  // Convert correlation to width (1 = mono, 0 = full stereo, -1 = out of phase)
  // Width = (1 - correlation) * 50 for positive correlation
  // Width > 100% for out of phase content
  const width = (1 - correlation) * 100;
  return Math.min(200, Math.max(0, width));
};

/**
 * Calculate phase correlation (mono compatibility)
 * @param {Float32Array} leftChannel - Left channel samples
 * @param {Float32Array} rightChannel - Right channel samples
 * @returns {number} Phase correlation (-1 to 1)
 */
export const calculatePhaseCorrelation = (leftChannel, rightChannel) => {
  if (!leftChannel || !rightChannel || leftChannel.length === 0) return 1;

  const length = Math.min(leftChannel.length, rightChannel.length);

  let sumMid = 0;
  let sumSide = 0;

  for (let i = 0; i < length; i++) {
    const mid = (leftChannel[i] + rightChannel[i]) / 2;
    const side = (leftChannel[i] - rightChannel[i]) / 2;
    sumMid += mid * mid;
    sumSide += side * side;
  }

  const total = sumMid + sumSide;
  if (total === 0) return 1;

  // +1 = mono, 0 = uncorrelated, -1 = out of phase
  return (sumMid - sumSide) / total;
};

/**
 * Calculate channel balance (L/R level difference)
 * @param {Float32Array} leftChannel - Left channel samples
 * @param {Float32Array} rightChannel - Right channel samples
 * @returns {number} Balance in dB (negative = left heavy, positive = right heavy)
 */
export const calculateChannelBalance = (leftChannel, rightChannel) => {
  if (!leftChannel || !rightChannel || leftChannel.length === 0) return 0;

  const leftRMS = calculateRMS(leftChannel);
  const rightRMS = calculateRMS(rightChannel);

  if (leftRMS === 0 && rightRMS === 0) return 0;
  if (leftRMS === 0) return Infinity;
  if (rightRMS === 0) return -Infinity;

  return linearToDb(rightRMS / leftRMS);
};

/**
 * Calculate frequency band energy from FFT data
 * @param {Uint8Array|Float32Array} fftData - FFT magnitude data
 * @param {number} lowHz - Lower frequency bound
 * @param {number} highHz - Upper frequency bound
 * @param {number} sampleRate - Audio sample rate
 * @param {number} fftSize - FFT size
 * @returns {number} Band energy (normalized 0-1)
 */
export const getBandEnergy = (fftData, lowHz, highHz, sampleRate, fftSize) => {
  const binWidth = sampleRate / fftSize;
  const lowBin = Math.floor(lowHz / binWidth);
  const highBin = Math.min(Math.floor(highHz / binWidth), fftData.length - 1);

  if (highBin <= lowBin) return 0;

  let energy = 0;
  for (let i = lowBin; i <= highBin; i++) {
    // FFT data is typically 0-255 for Uint8Array
    const normalized = fftData[i] / 255;
    energy += normalized * normalized;
  }

  return Math.sqrt(energy / (highBin - lowBin + 1));
};

/**
 * Analyze all frequency bands
 * @param {Uint8Array|Float32Array} fftData - FFT magnitude data
 * @param {number} sampleRate - Audio sample rate
 * @param {number} fftSize - FFT size
 * @returns {Array} Band energies with metadata
 */
export const analyzeFrequencyBands = (fftData, sampleRate, fftSize) => {
  return FREQUENCY_BANDS.map(band => ({
    ...band,
    energy: getBandEnergy(fftData, band.low, band.high, sampleRate, fftSize)
  }));
};

/**
 * Apply K-weighting filter coefficients (simplified)
 * For accurate LUFS calculation
 * @param {Float32Array} buffer - Audio samples
 * @param {number} sampleRate - Sample rate
 * @returns {Float32Array} Filtered samples
 */
export const applyKWeighting = (buffer, sampleRate) => {
  // Simplified K-weighting implementation
  // Real implementation would use biquad filters
  const output = new Float32Array(buffer.length);

  // High-shelf filter approximation (+4dB at high frequencies)
  const alpha = 0.95;
  let prev = 0;

  for (let i = 0; i < buffer.length; i++) {
    output[i] = buffer[i] + alpha * (buffer[i] - prev);
    prev = buffer[i];
  }

  return output;
};

/**
 * Calculate LUFS (Loudness Units Full Scale) - ITU-R BS.1770
 * Simplified implementation for client-side use
 * @param {AudioBuffer} audioBuffer - Web Audio API AudioBuffer
 * @returns {number} Integrated LUFS value
 */
export const calculateLUFS = (audioBuffer) => {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;

  // Get channel data
  const channels = [];
  for (let c = 0; c < numChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  // Block size: 400ms with 75% overlap (100ms hop)
  const blockSize = Math.floor(sampleRate * 0.4);
  const hopSize = Math.floor(sampleRate * 0.1);
  const numBlocks = Math.floor((channels[0].length - blockSize) / hopSize) + 1;

  if (numBlocks < 1) {
    // For very short samples, just calculate mean square
    let totalPower = 0;
    for (let c = 0; c < numChannels; c++) {
      const weighted = applyKWeighting(channels[c], sampleRate);
      for (let i = 0; i < weighted.length; i++) {
        totalPower += weighted[i] * weighted[i];
      }
    }
    totalPower /= (channels[0].length * numChannels);
    if (totalPower <= 0) return -70;
    return -0.691 + 10 * Math.log10(totalPower);
  }

  // Calculate mean square per block
  const blockLoudness = [];

  for (let b = 0; b < numBlocks; b++) {
    const start = b * hopSize;
    let blockPower = 0;

    for (let c = 0; c < numChannels; c++) {
      const channelWeight = 1.0; // L/R = 1.0, surround would be different

      // Apply K-weighting
      let sum = 0;
      for (let i = start; i < start + blockSize && i < channels[c].length; i++) {
        sum += channels[c][i] * channels[c][i];
      }
      blockPower += channelWeight * (sum / blockSize);
    }

    blockPower /= numChannels;
    blockLoudness.push(blockPower);
  }

  // Absolute gating at -70 LUFS
  const absoluteThreshold = Math.pow(10, (-70 + 0.691) / 10);
  const gatedBlocks = blockLoudness.filter(l => l > absoluteThreshold);

  if (gatedBlocks.length === 0) return -70;

  // Calculate mean of gated blocks for relative threshold
  const gatedMean = gatedBlocks.reduce((a, b) => a + b, 0) / gatedBlocks.length;
  const relativeThreshold = gatedMean * Math.pow(10, -10 / 10); // -10 LUFS below

  // Final gating
  const finalGated = gatedBlocks.filter(l => l > relativeThreshold);

  if (finalGated.length === 0) return -70;

  // Integrated loudness
  const integratedPower = finalGated.reduce((a, b) => a + b, 0) / finalGated.length;

  if (integratedPower <= 0) return -70;

  return -0.691 + 10 * Math.log10(integratedPower);
};

/**
 * Calculate overall quality score (0-100)
 * @param {Object} metrics - Analysis metrics
 * @returns {Object} Quality score with breakdown
 */
export const calculateQualityScore = (metrics) => {
  const { peakDb, rmsDb, dynamicRange, snr, dcOffset, clipCount, phaseCorrelation, balance } = metrics;

  let score = 100;
  const issues = [];

  // Clipping penalty (major issue)
  if (clipCount > 0) {
    score -= Math.min(30, clipCount * 2);
    issues.push({ type: 'clipping', severity: 'high', message: `${clipCount} clipping points detected` });
  }

  // DC offset penalty
  if (Math.abs(dcOffset) > 0.01) {
    score -= 10;
    issues.push({ type: 'dc_offset', severity: 'medium', message: 'DC offset detected' });
  }

  // Phase correlation penalty
  if (phaseCorrelation < 0) {
    score -= 15;
    issues.push({ type: 'phase', severity: 'high', message: 'Phase issues detected - may sound thin in mono' });
  } else if (phaseCorrelation < 0.3) {
    score -= 5;
    issues.push({ type: 'phase', severity: 'low', message: 'Wide stereo image - check mono compatibility' });
  }

  // Balance penalty
  if (Math.abs(balance) > 3) {
    score -= 10;
    issues.push({ type: 'balance', severity: 'medium', message: `Channel imbalance: ${balance > 0 ? 'right' : 'left'} heavy` });
  } else if (Math.abs(balance) > 1) {
    score -= 3;
    issues.push({ type: 'balance', severity: 'low', message: 'Slight channel imbalance' });
  }

  // SNR bonus/penalty
  if (snr < 40) {
    score -= 10;
    issues.push({ type: 'snr', severity: 'medium', message: 'Low signal-to-noise ratio' });
  } else if (snr > 70) {
    // Clean signal, no penalty
  }

  // Dynamic range check
  if (dynamicRange < 6) {
    score -= 5;
    issues.push({ type: 'dynamics', severity: 'low', message: 'Limited dynamic range (heavily compressed)' });
  }

  // Peak too low
  if (peakDb < -6) {
    score -= 5;
    issues.push({ type: 'level', severity: 'low', message: 'Audio level is low - consider normalizing' });
  }

  return {
    score: Math.max(0, Math.min(100, Math.round(score))),
    issues,
    grade: score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F'
  };
};

/**
 * Generate recommendations based on analysis
 * @param {Object} metrics - Analysis metrics
 * @param {string} platform - Target platform (default: 'spotify')
 * @returns {Array} Recommendations
 */
export const generateRecommendations = (metrics, platform = 'spotify') => {
  const recommendations = [];
  const target = PLATFORM_TARGETS[platform] || PLATFORM_TARGETS.spotify;

  // LUFS recommendations
  const lufsDiff = metrics.lufs - target.lufs;
  if (Math.abs(lufsDiff) > 1) {
    if (lufsDiff > 0) {
      recommendations.push({
        type: 'loudness',
        status: 'warning',
        message: `Audio is ${Math.abs(lufsDiff).toFixed(1)} LUFS louder than ${target.name} target (${target.lufs} LUFS). May be turned down by ${Math.abs(lufsDiff).toFixed(1)} dB.`
      });
    } else {
      recommendations.push({
        type: 'loudness',
        status: 'info',
        message: `Audio is ${Math.abs(lufsDiff).toFixed(1)} LUFS quieter than ${target.name} target (${target.lufs} LUFS). Consider increasing loudness.`
      });
    }
  } else {
    recommendations.push({
      type: 'loudness',
      status: 'success',
      message: `Loudness is appropriate for ${target.name} (target: ${target.lufs} LUFS)`
    });
  }

  // Peak/headroom recommendations
  if (metrics.peakDb > target.ceiling) {
    recommendations.push({
      type: 'peak',
      status: 'error',
      message: `Peak exceeds ${target.name} ceiling (${target.ceiling} dBFS). Use a limiter to reduce peaks.`
    });
  } else if (metrics.peakDb > target.ceiling - 0.5) {
    recommendations.push({
      type: 'peak',
      status: 'warning',
      message: 'Peaks very close to ceiling. Consider leaving more headroom.'
    });
  } else {
    recommendations.push({
      type: 'peak',
      status: 'success',
      message: 'Adequate headroom maintained'
    });
  }

  // Clipping
  if (metrics.clipCount > 0) {
    recommendations.push({
      type: 'clipping',
      status: 'error',
      message: `${metrics.clipCount} clipping instances detected. Use a limiter or reduce gain.`
    });
  }

  // Stereo recommendations
  if (metrics.phaseCorrelation < 0) {
    recommendations.push({
      type: 'stereo',
      status: 'error',
      message: 'Out-of-phase content detected. Audio may cancel out in mono.'
    });
  } else if (metrics.stereoWidth > 95) {
    recommendations.push({
      type: 'stereo',
      status: 'warning',
      message: 'Very wide stereo image. Check mono compatibility.'
    });
  } else if (metrics.stereoWidth < 5 && metrics.numChannels > 1) {
    recommendations.push({
      type: 'stereo',
      status: 'info',
      message: 'Audio is essentially mono. Consider adding stereo width if appropriate.'
    });
  }

  // Balance
  if (Math.abs(metrics.balance) > 3) {
    recommendations.push({
      type: 'balance',
      status: 'warning',
      message: `${Math.abs(metrics.balance).toFixed(1)} dB imbalance toward ${metrics.balance > 0 ? 'right' : 'left'} channel.`
    });
  }

  // DC offset
  if (Math.abs(metrics.dcOffset) > 0.01) {
    recommendations.push({
      type: 'dc_offset',
      status: 'warning',
      message: 'DC offset detected. Apply a high-pass filter to remove.'
    });
  }

  return recommendations;
};

/**
 * Format dB value for display
 * @param {number} db - Decibel value
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
export const formatDb = (db, decimals = 1) => {
  if (!isFinite(db)) return '-inf dB';
  return `${db >= 0 ? '+' : ''}${db.toFixed(decimals)} dB`;
};

/**
 * Format LUFS value for display
 * @param {number} lufs - LUFS value
 * @returns {string} Formatted string
 */
export const formatLUFS = (lufs) => {
  if (!isFinite(lufs) || lufs < -70) return '< -70 LUFS';
  return `${lufs.toFixed(1)} LUFS`;
};

/**
 * Get color for quality score
 * @param {number} score - Quality score (0-100)
 * @returns {string} CSS color
 */
export const getScoreColor = (score) => {
  if (score >= 90) return '#10B981'; // Green
  if (score >= 70) return '#F59E0B'; // Yellow
  if (score >= 50) return '#EF4444'; // Orange
  return '#DC2626'; // Red
};

/**
 * Get status color
 * @param {string} status - Status type
 * @returns {string} CSS color
 */
export const getStatusColor = (status) => {
  switch (status) {
    case 'success': return '#10B981';
    case 'warning': return '#F59E0B';
    case 'error': return '#EF4444';
    case 'info': return '#3B82F6';
    default: return '#6B7280';
  }
};
