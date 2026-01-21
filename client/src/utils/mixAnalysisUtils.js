/**
 * Mix Analysis Utilities
 * Problem frequency detection, masking analysis, loudness calculation
 * for professional mix/master analysis
 */

// ============================================
// PROBLEM FREQUENCY ZONES
// ============================================

export const PROBLEM_ZONES = {
  subRumble: {
    name: 'Sub Rumble',
    description: 'Excessive sub-bass energy that can cause problems in playback systems',
    lowFreq: 20,
    highFreq: 60,
    threshold: -6,  // dB above average
    severity: 'moderate'
  },
  muddy: {
    name: 'Muddiness',
    description: 'Low-mid buildup that causes lack of clarity',
    lowFreq: 200,
    highFreq: 400,
    threshold: -8,
    severity: 'moderate'
  },
  boxy: {
    name: 'Boxiness',
    description: 'Hollow or boxy sound from mid-frequency buildup',
    lowFreq: 400,
    highFreq: 800,
    threshold: -10,
    severity: 'mild'
  },
  nasal: {
    name: 'Nasal/Honky',
    description: 'Nasal or honky tonality from upper-mid buildup',
    lowFreq: 800,
    highFreq: 1500,
    threshold: -8,
    severity: 'mild'
  },
  harsh: {
    name: 'Harshness',
    description: 'Harsh, fatiguing frequencies in the presence range',
    lowFreq: 2000,
    highFreq: 5000,
    threshold: -6,
    severity: 'severe'
  },
  sibilant: {
    name: 'Sibilance',
    description: 'Excessive "S" and "T" sounds',
    lowFreq: 5000,
    highFreq: 9000,
    threshold: -8,
    severity: 'moderate'
  },
  brittle: {
    name: 'Brittleness',
    description: 'Harsh high-frequency content',
    lowFreq: 9000,
    highFreq: 16000,
    threshold: -10,
    severity: 'mild'
  }
};

// ============================================
// PROBLEM DETECTION
// ============================================

/**
 * Detect problem frequencies in spectrogram data
 * @param {Object} spectrogramData - Spectrogram data from useSpectrogramGenerator
 * @returns {Object[]} Array of detected problems
 */
export function detectProblemFrequencies(spectrogramData) {
  if (!spectrogramData?.mono?.spectrogram) return [];

  const { data, numFrames, sampleRate, fftSize, duration } = spectrogramData.mono.spectrogram;
  const numBins = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;
  const timePerFrame = duration / numFrames;

  const problems = [];

  // Calculate average spectrum across all frames
  const avgSpectrum = new Float32Array(numBins);
  for (let frame = 0; frame < numFrames; frame++) {
    for (let bin = 0; bin < numBins; bin++) {
      avgSpectrum[bin] += data[frame][bin];
    }
  }
  for (let bin = 0; bin < numBins; bin++) {
    avgSpectrum[bin] /= numFrames;
  }

  // Calculate overall average energy
  let overallAvg = 0;
  let count = 0;
  for (let bin = 0; bin < numBins; bin++) {
    const freq = bin * freqPerBin;
    if (freq >= 100 && freq <= 10000) { // Focus on main frequency range
      overallAvg += avgSpectrum[bin];
      count++;
    }
  }
  overallAvg /= count;

  // Analyze each problem zone
  Object.entries(PROBLEM_ZONES).forEach(([zoneKey, zone]) => {
    const lowBin = Math.floor(zone.lowFreq / freqPerBin);
    const highBin = Math.ceil(zone.highFreq / freqPerBin);

    // Track consecutive frames with problem energy
    let problemStart = null;
    let peakDb = -Infinity;
    let peakFreq = zone.lowFreq;

    for (let frame = 0; frame < numFrames; frame++) {
      // Calculate energy in this zone for this frame
      let zoneEnergy = 0;
      let zoneMaxDb = -Infinity;
      let zoneMaxBin = lowBin;

      for (let bin = lowBin; bin <= highBin && bin < numBins; bin++) {
        const db = data[frame][bin];
        zoneEnergy += db;
        if (db > zoneMaxDb) {
          zoneMaxDb = db;
          zoneMaxBin = bin;
        }
      }
      zoneEnergy /= (highBin - lowBin + 1);

      // Check if this zone has excessive energy relative to average
      const excessDb = zoneEnergy - overallAvg;

      if (excessDb > zone.threshold) {
        if (problemStart === null) {
          problemStart = frame;
        }
        if (zoneMaxDb > peakDb) {
          peakDb = zoneMaxDb;
          peakFreq = zoneMaxBin * freqPerBin;
        }
      } else {
        // End of problem region
        if (problemStart !== null) {
          const duration = (frame - problemStart) * timePerFrame;
          // Only report if problem persists for at least 0.3 seconds
          if (duration >= 0.3) {
            problems.push({
              type: zoneKey,
              name: zone.name,
              description: zone.description,
              severity: zone.severity,
              startTime: problemStart * timePerFrame,
              endTime: frame * timePerFrame,
              frequency: peakFreq,
              frequencyRange: [zone.lowFreq, zone.highFreq],
              peakDb: peakDb,
              excessDb: peakDb - overallAvg
            });
          }
          problemStart = null;
          peakDb = -Infinity;
        }
      }
    }

    // Handle problem that extends to end
    if (problemStart !== null) {
      const duration = (numFrames - problemStart) * timePerFrame;
      if (duration >= 0.3) {
        problems.push({
          type: zoneKey,
          name: zone.name,
          description: zone.description,
          severity: zone.severity,
          startTime: problemStart * timePerFrame,
          endTime: numFrames * timePerFrame,
          frequency: peakFreq,
          frequencyRange: [zone.lowFreq, zone.highFreq],
          peakDb: peakDb,
          excessDb: peakDb - overallAvg
        });
      }
    }
  });

  // Merge adjacent/overlapping problems of the same type
  const mergedProblems = mergeAdjacentProblems(problems);

  return mergedProblems.sort((a, b) => {
    // Sort by severity then start time
    const severityOrder = { severe: 0, moderate: 1, mild: 2 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    return a.startTime - b.startTime;
  });
}

/**
 * Merge adjacent problems of the same type
 */
function mergeAdjacentProblems(problems) {
  const sorted = [...problems].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.startTime - b.startTime;
  });

  const merged = [];
  let current = null;

  for (const problem of sorted) {
    if (!current || current.type !== problem.type || problem.startTime > current.endTime + 0.5) {
      if (current) merged.push(current);
      current = { ...problem };
    } else {
      // Merge
      current.endTime = Math.max(current.endTime, problem.endTime);
      current.peakDb = Math.max(current.peakDb, problem.peakDb);
      current.excessDb = Math.max(current.excessDb, problem.excessDb);
    }
  }

  if (current) merged.push(current);
  return merged;
}

// ============================================
// FREQUENCY MASKING DETECTION
// ============================================

/**
 * Detect frequency masking/crowding in the mix
 * @param {Object} spectrogramData - Spectrogram data
 * @returns {Object[]} Array of masking regions
 */
export function detectFrequencyMasking(spectrogramData) {
  if (!spectrogramData?.mono?.spectrogram) return [];

  const { data, numFrames, sampleRate, fftSize, duration } = spectrogramData.mono.spectrogram;
  const numBins = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;
  const timePerFrame = duration / numFrames;

  const maskingRegions = [];

  // Define octave bands for analysis
  const octaveBands = [
    { name: 'Sub', low: 20, high: 60 },
    { name: 'Bass', low: 60, high: 250 },
    { name: 'Low-Mid', low: 250, high: 500 },
    { name: 'Mid', low: 500, high: 2000 },
    { name: 'Upper-Mid', low: 2000, high: 4000 },
    { name: 'Presence', low: 4000, high: 6000 },
    { name: 'Brilliance', low: 6000, high: 20000 }
  ];

  // Analyze each time frame for crowding
  for (let frame = 0; frame < numFrames; frame += 10) { // Sample every 10 frames for performance
    // Calculate energy in each band
    const bandEnergies = octaveBands.map(band => {
      const lowBin = Math.floor(band.low / freqPerBin);
      const highBin = Math.min(Math.ceil(band.high / freqPerBin), numBins - 1);

      let totalEnergy = 0;
      let maxDb = -Infinity;

      for (let bin = lowBin; bin <= highBin; bin++) {
        const db = data[frame][bin];
        totalEnergy += Math.pow(10, db / 10); // Convert to linear for proper averaging
        maxDb = Math.max(maxDb, db);
      }

      return {
        name: band.name,
        energy: totalEnergy / (highBin - lowBin + 1),
        maxDb,
        lowFreq: band.low,
        highFreq: band.high
      };
    });

    // Check for masking (multiple bands with similar high energy)
    const highEnergyBands = bandEnergies.filter(b => b.maxDb > -20);

    if (highEnergyBands.length >= 3) {
      // Check for adjacent bands with similar energy (potential masking)
      for (let i = 0; i < highEnergyBands.length - 1; i++) {
        const band1 = highEnergyBands[i];
        const band2 = highEnergyBands[i + 1];

        const energyRatio = Math.abs(band1.maxDb - band2.maxDb);
        if (energyRatio < 6) { // Within 6dB - potential masking
          maskingRegions.push({
            time: frame * timePerFrame,
            bands: [band1.name, band2.name],
            frequencyRange: [band1.lowFreq, band2.highFreq],
            severity: energyRatio < 3 ? 'severe' : 'moderate',
            description: `${band1.name} and ${band2.name} frequencies competing`
          });
        }
      }
    }
  }

  // Consolidate masking regions
  return consolidateMaskingRegions(maskingRegions);
}

/**
 * Consolidate nearby masking regions
 */
function consolidateMaskingRegions(regions) {
  if (regions.length === 0) return [];

  const consolidated = [];
  let current = null;

  for (const region of regions) {
    const key = region.bands.join('-');
    if (!current || current.key !== key || region.time > current.endTime + 1) {
      if (current) consolidated.push(current);
      current = {
        ...region,
        key,
        startTime: region.time,
        endTime: region.time + 0.5
      };
    } else {
      current.endTime = region.time + 0.5;
    }
  }

  if (current) consolidated.push(current);

  return consolidated.filter(r => r.endTime - r.startTime >= 1); // At least 1 second
}

// ============================================
// RESONANCE DETECTION
// ============================================

/**
 * Detect resonant frequencies (sustained narrow peaks)
 * @param {Object} spectrogramData - Spectrogram data
 * @returns {Object[]} Array of detected resonances
 */
export function detectResonances(spectrogramData) {
  if (!spectrogramData?.mono?.spectrogram) return [];

  const { data, numFrames, sampleRate, fftSize } = spectrogramData.mono.spectrogram;
  const numBins = fftSize / 2;
  const freqPerBin = sampleRate / fftSize;

  const resonances = [];

  // Calculate average spectrum
  const avgSpectrum = new Float32Array(numBins);
  for (let frame = 0; frame < numFrames; frame++) {
    for (let bin = 0; bin < numBins; bin++) {
      avgSpectrum[bin] += data[frame][bin];
    }
  }
  for (let bin = 0; bin < numBins; bin++) {
    avgSpectrum[bin] /= numFrames;
  }

  // Find peaks that are significantly above neighbors
  const peakThreshold = 6; // dB above neighbors
  for (let bin = 5; bin < numBins - 5; bin++) {
    const current = avgSpectrum[bin];
    const leftAvg = (avgSpectrum[bin - 3] + avgSpectrum[bin - 4] + avgSpectrum[bin - 5]) / 3;
    const rightAvg = (avgSpectrum[bin + 3] + avgSpectrum[bin + 4] + avgSpectrum[bin + 5]) / 3;
    const neighborAvg = (leftAvg + rightAvg) / 2;

    if (current - neighborAvg > peakThreshold && current > -30) {
      const freq = bin * freqPerBin;

      // Determine severity based on excess
      const excess = current - neighborAvg;
      let severity = 'mild';
      if (excess > 12) severity = 'severe';
      else if (excess > 9) severity = 'moderate';

      resonances.push({
        frequency: freq,
        peakDb: current,
        excessDb: excess,
        severity,
        description: `Resonant peak at ${formatFreq(freq)}`
      });
    }
  }

  // Filter out closely spaced resonances (keep the strongest)
  return filterCloseResonances(resonances);
}

/**
 * Filter out resonances that are too close together
 */
function filterCloseResonances(resonances) {
  const sorted = [...resonances].sort((a, b) => b.excessDb - a.excessDb);
  const filtered = [];

  for (const res of sorted) {
    const tooClose = filtered.some(existing => {
      const ratio = Math.max(res.frequency, existing.frequency) /
                    Math.min(res.frequency, existing.frequency);
      return ratio < 1.1; // Within 10% frequency
    });

    if (!tooClose) {
      filtered.push(res);
    }
  }

  return filtered.sort((a, b) => a.frequency - b.frequency);
}

// ============================================
// LOUDNESS ANALYSIS
// ============================================

/**
 * Calculate LUFS for each segment of audio
 * @param {AudioBuffer} audioBuffer - Audio buffer
 * @param {number} segmentDuration - Duration of each segment in seconds
 * @returns {Object[]} Array of LUFS values per segment
 */
export function calculateSegmentLUFS(audioBuffer, segmentDuration = 1) {
  if (!audioBuffer) return [];

  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const totalSamples = audioBuffer.length;
  const duration = audioBuffer.duration;

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;

  const samplesPerSegment = Math.floor(sampleRate * segmentDuration);
  const numSegments = Math.floor(totalSamples / samplesPerSegment);

  const segments = [];

  for (let i = 0; i < numSegments; i++) {
    const startSample = i * samplesPerSegment;
    const endSample = Math.min(startSample + samplesPerSegment, totalSamples);

    // Calculate RMS for each channel
    let leftSum = 0;
    let rightSum = 0;

    for (let j = startSample; j < endSample; j++) {
      leftSum += leftChannel[j] * leftChannel[j];
      rightSum += rightChannel[j] * rightChannel[j];
    }

    const numSamples = endSample - startSample;
    const leftRMS = Math.sqrt(leftSum / numSamples);
    const rightRMS = Math.sqrt(rightSum / numSamples);

    // Combine channels (simplified - not true LUFS but approximation)
    const combinedRMS = Math.sqrt((leftRMS * leftRMS + rightRMS * rightRMS) / 2);

    // Convert to dB-like scale (simplified LUFS approximation)
    const lufs = combinedRMS > 0 ? 20 * Math.log10(combinedRMS) - 0.691 : -70;

    segments.push({
      startTime: i * segmentDuration,
      endTime: Math.min((i + 1) * segmentDuration, duration),
      lufs: Math.max(-70, Math.min(0, lufs)),
      rms: combinedRMS
    });
  }

  return segments;
}

/**
 * Analyze loudness dynamics
 * @param {Object[]} segments - Array of LUFS segments
 * @returns {Object} Loudness analysis results
 */
export function analyzeLoudnessDynamics(segments) {
  if (!segments || segments.length === 0) {
    return {
      integratedLUFS: -70,
      maxLUFS: -70,
      minLUFS: -70,
      dynamicRange: 0,
      loudestMoment: 0,
      quietestMoment: 0,
      segments: []
    };
  }

  const lufsValues = segments.map(s => s.lufs);
  const maxLUFS = Math.max(...lufsValues);
  const minLUFS = Math.min(...lufsValues.filter(l => l > -60)); // Ignore silent parts
  const avgLUFS = lufsValues.reduce((a, b) => a + b, 0) / lufsValues.length;

  const maxIdx = lufsValues.indexOf(maxLUFS);
  const minIdx = lufsValues.findIndex(l => l === minLUFS && l > -60);

  // Classify segments
  const classifiedSegments = segments.map(segment => {
    let status = 'good';
    if (segment.lufs > -10) status = 'hot';
    else if (segment.lufs > -14) status = 'warm';
    else if (segment.lufs < -24) status = 'quiet';

    return { ...segment, status };
  });

  return {
    integratedLUFS: avgLUFS,
    maxLUFS,
    minLUFS,
    dynamicRange: maxLUFS - minLUFS,
    loudestMoment: segments[maxIdx]?.startTime || 0,
    quietestMoment: segments[minIdx]?.startTime || 0,
    segments: classifiedSegments
  };
}

// ============================================
// REFERENCE TRACK COMPARISON
// ============================================

/**
 * Compare two audio analyses
 * @param {Object} mainAnalysis - Main track analysis
 * @param {Object} referenceAnalysis - Reference track analysis
 * @returns {Object} Comparison results
 */
export function compareToReference(mainSpectrogram, referenceSpectrogram) {
  if (!mainSpectrogram?.mono?.spectrogram || !referenceSpectrogram?.mono?.spectrogram) {
    return null;
  }

  const mainData = mainSpectrogram.mono.spectrogram;
  const refData = referenceSpectrogram.mono.spectrogram;

  const mainNumBins = mainData.fftSize / 2;
  const refNumBins = refData.fftSize / 2;

  // Calculate average spectra
  const mainAvgSpectrum = calculateAverageSpectrum(mainData);
  const refAvgSpectrum = calculateAverageSpectrum(refData);

  // Compare frequency bands
  const bands = [
    { name: 'Sub', low: 20, high: 60 },
    { name: 'Bass', low: 60, high: 250 },
    { name: 'Low-Mid', low: 250, high: 500 },
    { name: 'Mid', low: 500, high: 2000 },
    { name: 'Upper-Mid', low: 2000, high: 4000 },
    { name: 'Presence', low: 4000, high: 8000 },
    { name: 'Air', low: 8000, high: 20000 }
  ];

  const bandComparison = bands.map(band => {
    const mainEnergy = getBandEnergy(mainAvgSpectrum, band, mainData.sampleRate, mainData.fftSize);
    const refEnergy = getBandEnergy(refAvgSpectrum, band, refData.sampleRate, refData.fftSize);
    const difference = mainEnergy - refEnergy;

    return {
      name: band.name,
      frequencyRange: [band.low, band.high],
      mainDb: mainEnergy,
      referenceDb: refEnergy,
      difference,
      status: Math.abs(difference) < 2 ? 'matched' :
              difference > 0 ? 'louder' : 'quieter'
    };
  });

  return {
    bandComparison,
    overallDifference: bandComparison.reduce((sum, b) => sum + Math.abs(b.difference), 0) / bands.length,
    recommendations: generateComparisonRecommendations(bandComparison)
  };
}

/**
 * Calculate average spectrum from spectrogram data
 */
function calculateAverageSpectrum(spectrogramData) {
  const { data, numFrames, fftSize } = spectrogramData;
  const numBins = fftSize / 2;
  const avgSpectrum = new Float32Array(numBins);

  for (let frame = 0; frame < numFrames; frame++) {
    for (let bin = 0; bin < numBins; bin++) {
      avgSpectrum[bin] += data[frame][bin];
    }
  }

  for (let bin = 0; bin < numBins; bin++) {
    avgSpectrum[bin] /= numFrames;
  }

  return avgSpectrum;
}

/**
 * Get energy in a frequency band
 */
function getBandEnergy(spectrum, band, sampleRate, fftSize) {
  const freqPerBin = sampleRate / fftSize;
  const lowBin = Math.floor(band.low / freqPerBin);
  const highBin = Math.min(Math.ceil(band.high / freqPerBin), spectrum.length - 1);

  let totalDb = 0;
  for (let bin = lowBin; bin <= highBin; bin++) {
    totalDb += spectrum[bin];
  }

  return totalDb / (highBin - lowBin + 1);
}

/**
 * Generate recommendations based on reference comparison
 */
function generateComparisonRecommendations(bandComparison) {
  const recommendations = [];

  bandComparison.forEach(band => {
    if (band.difference > 3) {
      recommendations.push({
        type: 'cut',
        band: band.name,
        amount: Math.round(band.difference),
        message: `Consider reducing ${band.name} by ~${Math.round(band.difference)}dB to match reference`
      });
    } else if (band.difference < -3) {
      recommendations.push({
        type: 'boost',
        band: band.name,
        amount: Math.round(Math.abs(band.difference)),
        message: `Consider boosting ${band.name} by ~${Math.round(Math.abs(band.difference))}dB to match reference`
      });
    }
  });

  return recommendations;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Format frequency for display
 */
function formatFreq(freq) {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(1)}kHz`;
  }
  return `${Math.round(freq)}Hz`;
}

/**
 * Get mix analysis summary
 * @param {Object[]} problems - Detected problems
 * @param {Object[]} masking - Masking regions
 * @param {Object[]} resonances - Detected resonances
 * @returns {Object} Summary of mix issues
 */
export function getMixAnalysisSummary(problems, masking, resonances) {
  const severeCount = problems.filter(p => p.severity === 'severe').length +
                      masking.filter(m => m.severity === 'severe').length +
                      resonances.filter(r => r.severity === 'severe').length;

  const moderateCount = problems.filter(p => p.severity === 'moderate').length +
                        masking.filter(m => m.severity === 'moderate').length +
                        resonances.filter(r => r.severity === 'moderate').length;

  const mildCount = problems.filter(p => p.severity === 'mild').length +
                    resonances.filter(r => r.severity === 'mild').length;

  let overallStatus = 'good';
  if (severeCount > 0) overallStatus = 'issues';
  else if (moderateCount > 2) overallStatus = 'warning';
  else if (mildCount > 3) overallStatus = 'minor';

  return {
    overallStatus,
    severeCount,
    moderateCount,
    mildCount,
    totalIssues: severeCount + moderateCount + mildCount,
    problems,
    masking,
    resonances
  };
}
