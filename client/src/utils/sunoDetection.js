/**
 * @module sunoDetection
 * @description AI Audio Artifact Detection
 *
 * Detects common artifacts in AI-generated audio (Suno, Udio, etc.):
 * - Metallic high frequencies
 * - Phase coherence issues
 * - Unnatural transients
 * - Stereo field anomalies
 * - Frequency gaps/spikes
 * - Harmonic distortion artifacts
 */

// ============================================
// ARTIFACT TYPES
// ============================================

export const ARTIFACT_TYPES = {
  metallicHighs: {
    name: 'Metallic High Frequencies',
    description: 'Unnatural ringing or metallic quality in upper frequencies',
    frequencyRange: [8000, 16000],
    severity: 'moderate',
    fix: 'Apply dynamic EQ cut around 10-14kHz with narrow Q, or use a de-esser'
  },
  phaseIssues: {
    name: 'Phase Coherence Issues',
    description: 'Inconsistent phase correlation causing thin or hollow sound',
    frequencyRange: [200, 800],
    severity: 'moderate',
    fix: 'Use M/S processing to reduce side channel below 200Hz, check mono compatibility'
  },
  unnaturalTransients: {
    name: 'Unnatural Transients',
    description: 'Artificial-sounding attack characteristics on drums/instruments',
    frequencyRange: [1000, 5000],
    severity: 'mild',
    fix: 'Use transient shaper to soften attacks, or layer with natural samples'
  },
  stereoAnomalies: {
    name: 'Stereo Field Anomalies',
    description: 'Inconsistent or unnatural stereo image',
    frequencyRange: [0, 20000],
    severity: 'moderate',
    fix: 'Apply stereo imaging plugin, narrow bass frequencies, check correlation'
  },
  frequencyGaps: {
    name: 'Frequency Gaps',
    description: 'Unexpected nulls or gaps in frequency spectrum',
    frequencyRange: [100, 10000],
    severity: 'mild',
    fix: 'Use gentle EQ boost to fill gaps, or harmonic exciter'
  },
  frequencySpikes: {
    name: 'Frequency Spikes',
    description: 'Unnatural narrow-band peaks in spectrum',
    frequencyRange: [500, 8000],
    severity: 'moderate',
    fix: 'Use narrow-Q notch filter or dynamic EQ to reduce peaks'
  },
  harmonicArtifacts: {
    name: 'Harmonic Distortion Artifacts',
    description: 'Unnatural harmonic content from AI generation',
    frequencyRange: [2000, 12000],
    severity: 'mild',
    fix: 'Use multiband saturation carefully, or dynamic EQ to tame harsh harmonics'
  },
  aliasing: {
    name: 'Aliasing Artifacts',
    description: 'Digital aliasing in high frequencies from AI processing',
    frequencyRange: [15000, 22000],
    severity: 'mild',
    fix: 'Apply low-pass filter around 16-18kHz with gentle slope'
  },
  temporalInconsistency: {
    name: 'Temporal Inconsistencies',
    description: 'Timing irregularities or micro-timing issues',
    frequencyRange: null, // Time-domain artifact
    severity: 'moderate',
    fix: 'Use timing correction or groove quantization'
  },
  spectralSmearing: {
    name: 'Spectral Smearing',
    description: 'Blurred or smeared frequency content, especially on transients',
    frequencyRange: [500, 5000],
    severity: 'moderate',
    fix: 'Use transient enhancement or multiband dynamics to restore clarity'
  }
};

// ============================================
// DETECTION ALGORITHMS
// ============================================

/**
 * Detect metallic high-frequency artifacts
 * @param {Float32Array} fftData - FFT magnitude data
 * @param {number} sampleRate - Sample rate
 * @param {number} fftSize - FFT size
 * @returns {Object|null} Detected artifact or null
 */
export function detectMetallicHighs(fftData, sampleRate, fftSize) {
  const freqPerBin = sampleRate / fftSize;
  const startBin = Math.floor(8000 / freqPerBin);
  const endBin = Math.min(Math.floor(16000 / freqPerBin), fftData.length - 1);

  // Calculate average energy in metallic range
  let metallicEnergy = 0;
  let peakBin = startBin;
  let peakValue = 0;

  for (let bin = startBin; bin <= endBin; bin++) {
    const value = fftData[bin] / 255; // Normalize
    metallicEnergy += value;
    if (value > peakValue) {
      peakValue = value;
      peakBin = bin;
    }
  }
  metallicEnergy /= (endBin - startBin + 1);

  // Calculate overall energy for comparison
  let overallEnergy = 0;
  for (let bin = 0; bin < fftData.length; bin++) {
    overallEnergy += fftData[bin] / 255;
  }
  overallEnergy /= fftData.length;

  // Calculate spectral flatness in the metallic range (metallic sounds are more flat/noisy)
  let geometricMean = 1;
  let arithmeticMean = 0;
  let count = 0;

  for (let bin = startBin; bin <= endBin; bin++) {
    const value = Math.max(0.0001, fftData[bin] / 255);
    geometricMean *= Math.pow(value, 1 / (endBin - startBin + 1));
    arithmeticMean += value;
    count++;
  }
  arithmeticMean /= count;

  const spectralFlatness = arithmeticMean > 0 ? geometricMean / arithmeticMean : 0;

  // Metallic sounds have high energy ratio AND high spectral flatness
  const energyRatio = metallicEnergy / (overallEnergy || 0.0001);

  if (energyRatio > 1.3 && spectralFlatness > 0.4) {
    return {
      type: 'metallicHighs',
      ...ARTIFACT_TYPES.metallicHighs,
      detected: true,
      peakFrequency: peakBin * freqPerBin,
      energyRatio,
      spectralFlatness,
      confidence: Math.min(100, Math.round((energyRatio - 1) * 50 + spectralFlatness * 50))
    };
  }

  return null;
}

/**
 * Detect phase coherence issues
 * @param {Float32Array} leftChannel - Left channel samples
 * @param {Float32Array} rightChannel - Right channel samples
 * @returns {Object|null} Detected artifact or null
 */
export function detectPhaseIssues(leftChannel, rightChannel) {
  if (!leftChannel || !rightChannel || leftChannel.length === 0) return null;

  const windowSize = 4096;
  const numWindows = Math.floor(leftChannel.length / windowSize);

  const correlations = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = start + windowSize;

    let sumMid = 0;
    let sumSide = 0;

    for (let i = start; i < end; i++) {
      const mid = (leftChannel[i] + rightChannel[i]) / 2;
      const side = (leftChannel[i] - rightChannel[i]) / 2;
      sumMid += mid * mid;
      sumSide += side * side;
    }

    const total = sumMid + sumSide;
    if (total > 0) {
      correlations.push((sumMid - sumSide) / total);
    }
  }

  if (correlations.length === 0) return null;

  // Calculate statistics
  const avgCorrelation = correlations.reduce((a, b) => a + b, 0) / correlations.length;
  const variance = correlations.reduce((sum, c) => sum + Math.pow(c - avgCorrelation, 2), 0) / correlations.length;
  const stdDev = Math.sqrt(variance);

  // Check for issues
  const negativeCount = correlations.filter(c => c < 0).length;
  const negativeRatio = negativeCount / correlations.length;

  // Phase issues detected if:
  // 1. Average correlation is low (<0.3)
  // 2. High variance (inconsistent)
  // 3. Many negative correlation moments
  if (avgCorrelation < 0.3 || variance > 0.2 || negativeRatio > 0.1) {
    let severity = 'mild';
    if (avgCorrelation < 0 || negativeRatio > 0.3) severity = 'severe';
    else if (avgCorrelation < 0.2 || variance > 0.3) severity = 'moderate';

    return {
      type: 'phaseIssues',
      ...ARTIFACT_TYPES.phaseIssues,
      detected: true,
      severity,
      avgCorrelation,
      correlationVariance: variance,
      correlationStdDev: stdDev,
      negativeRatio,
      confidence: Math.min(100, Math.round((1 - avgCorrelation) * 50 + variance * 100 + negativeRatio * 50))
    };
  }

  return null;
}

/**
 * Detect unnatural transients
 * @param {Float32Array} buffer - Audio samples
 * @param {number} sampleRate - Sample rate
 * @returns {Object|null} Detected artifact or null
 */
export function detectUnnaturalTransients(buffer, sampleRate) {
  const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
  const hopSize = Math.floor(windowSize / 2);
  const numWindows = Math.floor((buffer.length - windowSize) / hopSize);

  const energies = [];
  const energyDiffs = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * hopSize;
    let energy = 0;

    for (let i = start; i < start + windowSize; i++) {
      energy += buffer[i] * buffer[i];
    }
    energy = Math.sqrt(energy / windowSize);
    energies.push(energy);

    if (energies.length > 1) {
      energyDiffs.push(energies[energies.length - 1] - energies[energies.length - 2]);
    }
  }

  if (energyDiffs.length === 0) return null;

  // Analyze transient characteristics
  const attacks = [];
  const releases = [];
  let inTransient = false;
  let transientStart = 0;

  for (let i = 0; i < energyDiffs.length; i++) {
    if (energyDiffs[i] > 0.1 && !inTransient) {
      // Start of transient (attack)
      inTransient = true;
      transientStart = i;
    } else if (energyDiffs[i] < -0.05 && inTransient) {
      // End of transient (release)
      inTransient = false;
      const attackLength = i - transientStart;
      attacks.push(attackLength);
    }
  }

  if (attacks.length < 3) return null;

  // Calculate attack time statistics
  const avgAttack = attacks.reduce((a, b) => a + b, 0) / attacks.length;
  const attackVariance = attacks.reduce((sum, a) => sum + Math.pow(a - avgAttack, 2), 0) / attacks.length;

  // Unnatural transients often have:
  // 1. Very uniform attack times (low variance - too perfect)
  // 2. Extremely fast attacks (instant)
  // 3. Unnatural attack shapes

  const attackTimeMs = avgAttack * (hopSize / sampleRate) * 1000;
  const normalizedVariance = attackVariance / (avgAttack * avgAttack || 1);

  if (normalizedVariance < 0.1 && attackTimeMs < 5) {
    return {
      type: 'unnaturalTransients',
      ...ARTIFACT_TYPES.unnaturalTransients,
      detected: true,
      avgAttackTimeMs: attackTimeMs,
      attackVariance: normalizedVariance,
      transientCount: attacks.length,
      confidence: Math.min(100, Math.round((1 - normalizedVariance) * 50 + (10 - attackTimeMs) * 5))
    };
  }

  return null;
}

/**
 * Detect stereo field anomalies
 * @param {Float32Array} leftChannel - Left channel samples
 * @param {Float32Array} rightChannel - Right channel samples
 * @param {number} sampleRate - Sample rate
 * @returns {Object|null} Detected artifact or null
 */
export function detectStereoAnomalies(leftChannel, rightChannel, sampleRate) {
  if (!leftChannel || !rightChannel || leftChannel.length === 0) return null;

  const windowSize = Math.floor(sampleRate * 0.1); // 100ms windows
  const numWindows = Math.floor(leftChannel.length / windowSize);

  const widths = [];
  const balances = [];

  for (let w = 0; w < numWindows; w++) {
    const start = w * windowSize;
    const end = start + windowSize;

    let sumL = 0, sumR = 0, sumLR = 0;
    let sumL2 = 0, sumR2 = 0;

    for (let i = start; i < end; i++) {
      const l = leftChannel[i];
      const r = rightChannel[i];
      sumL += l;
      sumR += r;
      sumLR += l * r;
      sumL2 += l * l;
      sumR2 += r * r;
    }

    const meanL = sumL / windowSize;
    const meanR = sumR / windowSize;

    // Calculate correlation
    let num = 0, denomL = 0, denomR = 0;
    for (let i = start; i < end; i++) {
      const diffL = leftChannel[i] - meanL;
      const diffR = rightChannel[i] - meanR;
      num += diffL * diffR;
      denomL += diffL * diffL;
      denomR += diffR * diffR;
    }

    const denom = Math.sqrt(denomL * denomR);
    const correlation = denom > 0 ? num / denom : 1;
    const width = (1 - correlation) * 100;
    widths.push(width);

    // Calculate balance
    const leftRMS = Math.sqrt(sumL2 / windowSize);
    const rightRMS = Math.sqrt(sumR2 / windowSize);
    const balance = leftRMS > 0 ? 20 * Math.log10(rightRMS / leftRMS) : 0;
    balances.push(balance);
  }

  // Calculate variance in width and balance
  const avgWidth = widths.reduce((a, b) => a + b, 0) / widths.length;
  const widthVariance = widths.reduce((sum, w) => sum + Math.pow(w - avgWidth, 2), 0) / widths.length;

  const avgBalance = balances.reduce((a, b) => a + b, 0) / balances.length;
  const balanceVariance = balances.reduce((sum, b) => sum + Math.pow(b - avgBalance, 2), 0) / balances.length;

  // Anomalies include:
  // 1. Rapidly changing stereo width
  // 2. Inconsistent balance
  // 3. Extreme width values

  if (widthVariance > 500 || balanceVariance > 4 || avgWidth > 120) {
    let severity = 'mild';
    if (widthVariance > 800 || balanceVariance > 8) severity = 'severe';
    else if (widthVariance > 600 || balanceVariance > 6) severity = 'moderate';

    return {
      type: 'stereoAnomalies',
      ...ARTIFACT_TYPES.stereoAnomalies,
      detected: true,
      severity,
      avgWidth,
      widthVariance,
      avgBalance,
      balanceVariance,
      confidence: Math.min(100, Math.round(widthVariance / 10 + balanceVariance * 10))
    };
  }

  return null;
}

/**
 * Detect frequency gaps and spikes
 * @param {Float32Array} avgSpectrum - Average spectrum in dB
 * @param {number} sampleRate - Sample rate
 * @param {number} fftSize - FFT size
 * @returns {Object[]} Array of detected gaps and spikes
 */
export function detectFrequencyAnomalies(avgSpectrum, sampleRate, fftSize) {
  const freqPerBin = sampleRate / fftSize;
  const anomalies = [];

  // Skip very low and very high frequencies
  const startBin = Math.floor(80 / freqPerBin);
  const endBin = Math.min(Math.floor(16000 / freqPerBin), avgSpectrum.length - 1);

  // Calculate local statistics using a sliding window
  const windowBins = 10;

  for (let bin = startBin + windowBins; bin < endBin - windowBins; bin++) {
    const current = avgSpectrum[bin];

    // Calculate average of surrounding bins
    let surroundingSum = 0;
    let surroundingCount = 0;

    for (let offset = -windowBins; offset <= windowBins; offset++) {
      if (offset !== 0) {
        surroundingSum += avgSpectrum[bin + offset];
        surroundingCount++;
      }
    }

    const surroundingAvg = surroundingSum / surroundingCount;
    const difference = current - surroundingAvg;
    const frequency = bin * freqPerBin;

    // Detect gaps (sudden dips)
    if (difference < -10) {
      anomalies.push({
        type: 'frequencyGaps',
        ...ARTIFACT_TYPES.frequencyGaps,
        detected: true,
        frequency,
        magnitude: Math.abs(difference),
        confidence: Math.min(100, Math.round(Math.abs(difference) * 5))
      });
    }

    // Detect spikes (sudden peaks)
    if (difference > 12) {
      anomalies.push({
        type: 'frequencySpikes',
        ...ARTIFACT_TYPES.frequencySpikes,
        detected: true,
        frequency,
        magnitude: difference,
        confidence: Math.min(100, Math.round(difference * 5))
      });
    }
  }

  return anomalies;
}

/**
 * Detect spectral smearing
 * @param {Object} spectrogramData - Spectrogram data
 * @returns {Object|null} Detected artifact or null
 */
export function detectSpectralSmearing(spectrogramData) {
  if (!spectrogramData?.mono?.spectrogram) return null;

  const { data, numFrames, sampleRate, fftSize } = spectrogramData.mono.spectrogram;
  const numBins = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;

  // Focus on transient frequencies (1-5kHz)
  const startBin = Math.floor(1000 / freqPerBin);
  const endBin = Math.min(Math.floor(5000 / freqPerBin), numBins - 1);

  // Calculate spectral flux (change between frames)
  const fluxValues = [];

  for (let frame = 1; frame < numFrames; frame++) {
    let flux = 0;
    for (let bin = startBin; bin <= endBin; bin++) {
      const diff = data[frame][bin] - data[frame - 1][bin];
      flux += diff > 0 ? diff : 0; // Only positive changes (onsets)
    }
    fluxValues.push(flux);
  }

  if (fluxValues.length === 0) return null;

  // Calculate average flux and its temporal spread
  const avgFlux = fluxValues.reduce((a, b) => a + b, 0) / fluxValues.length;
  const fluxVariance = fluxValues.reduce((sum, f) => sum + Math.pow(f - avgFlux, 2), 0) / fluxValues.length;

  // Detect peaks in flux (transients)
  const threshold = avgFlux + Math.sqrt(fluxVariance) * 2;
  const transients = [];

  for (let i = 1; i < fluxValues.length - 1; i++) {
    if (fluxValues[i] > threshold &&
        fluxValues[i] > fluxValues[i - 1] &&
        fluxValues[i] > fluxValues[i + 1]) {
      transients.push(i);
    }
  }

  if (transients.length < 2) return null;

  // Analyze transient spread (smearing causes wider transient responses)
  let totalSpread = 0;
  transients.forEach(t => {
    let spread = 0;
    for (let offset = 1; offset <= 5; offset++) {
      if (t + offset < fluxValues.length && fluxValues[t + offset] > avgFlux) {
        spread++;
      }
    }
    totalSpread += spread;
  });

  const avgSpread = totalSpread / transients.length;

  // High spread indicates smearing
  if (avgSpread > 3) {
    return {
      type: 'spectralSmearing',
      ...ARTIFACT_TYPES.spectralSmearing,
      detected: true,
      avgTransientSpread: avgSpread,
      transientCount: transients.length,
      confidence: Math.min(100, Math.round(avgSpread * 20))
    };
  }

  return null;
}

// ============================================
// COMPREHENSIVE SUNO ANALYSIS
// ============================================

/**
 * Run comprehensive AI artifact detection
 * @param {AudioBuffer} audioBuffer - Audio buffer to analyze
 * @param {Object} spectrogramData - Optional pre-computed spectrogram
 * @returns {Object} Complete artifact analysis
 */
export function analyzeAIArtifacts(audioBuffer, spectrogramData = null) {
  if (!audioBuffer) return { isAIGenerated: false, confidence: 0, artifacts: [] };

  const sampleRate = audioBuffer.sampleRate;
  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

  const artifacts = [];

  // Run all detection algorithms
  const phaseResult = detectPhaseIssues(leftChannel, rightChannel);
  if (phaseResult) artifacts.push(phaseResult);

  const stereoResult = detectStereoAnomalies(leftChannel, rightChannel, sampleRate);
  if (stereoResult) artifacts.push(stereoResult);

  const transientResult = detectUnnaturalTransients(leftChannel, sampleRate);
  if (transientResult) artifacts.push(transientResult);

  // FFT-based detection (using first second of audio)
  const fftSize = 4096;
  const analysisLength = Math.min(sampleRate, leftChannel.length);
  const numFrames = Math.floor(analysisLength / fftSize);

  if (numFrames > 0) {
    // Simple FFT averaging (would use Web Audio API AnalyserNode in real implementation)
    const avgSpectrum = new Float32Array(fftSize / 2);
    // Note: In actual implementation, this would use proper FFT computation
    // For now, we'll skip FFT-based detection in this simplified version
  }

  // Spectral smearing (requires spectrogram data)
  if (spectrogramData) {
    const smearingResult = detectSpectralSmearing(spectrogramData);
    if (smearingResult) artifacts.push(smearingResult);
  }

  // Calculate overall AI generation probability
  const totalConfidence = artifacts.reduce((sum, a) => sum + a.confidence, 0);
  const avgConfidence = artifacts.length > 0 ? totalConfidence / artifacts.length : 0;

  // Weight by number of different artifact types
  const typeWeight = Math.min(1, artifacts.length / 3);
  const isAIGenerated = artifacts.length >= 2 || avgConfidence > 60;
  const overallConfidence = Math.round(avgConfidence * 0.6 + typeWeight * 40);

  return {
    isAIGenerated,
    confidence: overallConfidence,
    artifactCount: artifacts.length,
    artifacts: artifacts.sort((a, b) => b.confidence - a.confidence),
    summary: generateArtifactSummary(artifacts)
  };
}

/**
 * Generate human-readable summary of artifacts
 * @param {Object[]} artifacts - Array of detected artifacts
 * @returns {Object} Summary with recommendations
 */
function generateArtifactSummary(artifacts) {
  if (artifacts.length === 0) {
    return {
      status: 'clean',
      message: 'No significant AI artifacts detected',
      recommendations: []
    };
  }

  const severe = artifacts.filter(a => a.severity === 'severe');
  const moderate = artifacts.filter(a => a.severity === 'moderate');
  const mild = artifacts.filter(a => a.severity === 'mild');

  let status = 'minor';
  if (severe.length > 0) status = 'significant';
  else if (moderate.length > 1) status = 'moderate';

  const recommendations = artifacts.slice(0, 5).map(a => ({
    issue: a.name,
    severity: a.severity,
    fix: a.fix,
    confidence: a.confidence
  }));

  return {
    status,
    message: `Found ${artifacts.length} potential AI artifact${artifacts.length > 1 ? 's' : ''} (${severe.length} severe, ${moderate.length} moderate, ${mild.length} mild)`,
    recommendations
  };
}

/**
 * Get artifact type information
 * @param {string} type - Artifact type key
 * @returns {Object} Artifact type info
 */
export function getArtifactInfo(type) {
  return ARTIFACT_TYPES[type] || null;
}

/**
 * Get all artifact types
 * @returns {Object} All artifact types
 */
export function getAllArtifactTypes() {
  return ARTIFACT_TYPES;
}
