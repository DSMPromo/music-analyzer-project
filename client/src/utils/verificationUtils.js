/**
 * Verification Utilities
 * Threshold checks and quality validators for the verification workflow
 */

// Default thresholds for each verification stage
export const DEFAULT_THRESHOLDS = {
  audio: {
    minRmsLevel: 0.01,        // -40dB minimum RMS level
    minDuration: 3,           // 3 seconds minimum
    maxDcOffset: 0.01,        // 1% max DC offset
    maxClipCount: 0,          // 0 clips for warning-free
    minSampleRate: 22050,     // Minimum sample rate
  },
  rhythm: {
    minBpmConfidence: 0.6,    // 60% minimum BPM confidence
    minPatternConfidence: 0.5, // 50% minimum pattern confidence
    minHitCount: 10,          // At least 10 drum hits
    minEnergyThreshold: 0.05, // Detection sensitivity
    maxEnergyThreshold: 0.25,
    minHitInterval: 10,       // Minimum ms between hits
    maxHitInterval: 100,
  },
  chord: {
    minAvgConfidence: 0.3,    // 30% average chord confidence
    minHarmonicContent: 0.1,  // 10% harmonic energy threshold
    minChordCount: 2,         // At least 2 different chords
  },
  export: {
    minQualityScore: 70,      // Grade C minimum
  },
};

// Stage status values
export const STAGE_STATUS = {
  BLOCKED: 'blocked',
  PENDING: 'pending',
  CHECKING: 'checking',
  PASSED: 'passed',
  WARNING: 'warning',
  FAILED: 'failed',
  VERIFIED: 'verified',
  SKIPPED: 'skipped',
};

// Stage names
export const STAGES = {
  AUDIO: 'audio',
  RHYTHM: 'rhythm',
  CHORD: 'chord',
  EXPORT: 'export',
};

/**
 * Audio Quality Check
 * Validates audio buffer meets minimum requirements
 */
export function checkAudioQuality(audioBuffer, thresholds = DEFAULT_THRESHOLDS.audio) {
  const results = {
    passed: true,
    checks: [],
    blockers: [],
    warnings: [],
  };

  if (!audioBuffer) {
    results.passed = false;
    results.blockers.push('no_audio_buffer');
    results.checks.push({
      name: 'Audio Buffer',
      status: 'error',
      message: 'No audio buffer available',
      severity: 'error',
    });
    return results;
  }

  const sampleRate = audioBuffer.sampleRate;
  const duration = audioBuffer.length / sampleRate;
  const channelData = audioBuffer.getChannelData(0);

  // 1. Check duration
  const durationCheck = {
    name: 'Duration',
    threshold: thresholds.minDuration,
    value: duration,
    unit: 'seconds',
  };
  if (duration < thresholds.minDuration) {
    results.passed = false;
    results.blockers.push('short_duration');
    durationCheck.status = 'error';
    durationCheck.message = `Audio too short (${duration.toFixed(1)}s < ${thresholds.minDuration}s)`;
    durationCheck.severity = 'error';
  } else {
    durationCheck.status = 'passed';
    durationCheck.message = `${duration.toFixed(1)}s`;
    durationCheck.severity = 'success';
  }
  results.checks.push(durationCheck);

  // 2. Check RMS level
  let sumSquares = 0;
  for (let i = 0; i < channelData.length; i++) {
    sumSquares += channelData[i] * channelData[i];
  }
  const rmsLevel = Math.sqrt(sumSquares / channelData.length);

  const rmsCheck = {
    name: 'RMS Level',
    threshold: thresholds.minRmsLevel,
    value: rmsLevel,
    valueDb: 20 * Math.log10(rmsLevel || 0.0001),
  };
  if (rmsLevel < thresholds.minRmsLevel) {
    results.passed = false;
    results.blockers.push('low_rms_level');
    rmsCheck.status = 'error';
    rmsCheck.message = `Audio too quiet (${rmsCheck.valueDb.toFixed(1)} dB < -40 dB)`;
    rmsCheck.severity = 'error';
  } else {
    rmsCheck.status = 'passed';
    rmsCheck.message = `${rmsCheck.valueDb.toFixed(1)} dB`;
    rmsCheck.severity = 'success';
  }
  results.checks.push(rmsCheck);

  // 3. Check DC offset
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i];
  }
  const dcOffset = Math.abs(sum / channelData.length);

  const dcCheck = {
    name: 'DC Offset',
    threshold: thresholds.maxDcOffset,
    value: dcOffset,
    percentage: dcOffset * 100,
  };
  if (dcOffset > thresholds.maxDcOffset) {
    results.warnings.push('high_dc_offset');
    dcCheck.status = 'warning';
    dcCheck.message = `DC offset detected (${dcCheck.percentage.toFixed(2)}%)`;
    dcCheck.severity = 'warning';
  } else {
    dcCheck.status = 'passed';
    dcCheck.message = `${dcCheck.percentage.toFixed(2)}%`;
    dcCheck.severity = 'success';
  }
  results.checks.push(dcCheck);

  // 4. Check for clipping
  let clipCount = 0;
  let consecutiveCount = 0;
  const clipThreshold = 0.9999;
  const minConsecutive = 8;

  for (let i = 0; i < channelData.length; i++) {
    if (Math.abs(channelData[i]) >= clipThreshold) {
      consecutiveCount++;
    } else {
      if (consecutiveCount >= minConsecutive) {
        clipCount++;
      }
      consecutiveCount = 0;
    }
  }
  if (consecutiveCount >= minConsecutive) clipCount++;

  const clipCheck = {
    name: 'Clipping',
    threshold: thresholds.maxClipCount,
    value: clipCount,
  };
  if (clipCount > 0) {
    results.warnings.push('clipping_detected');
    clipCheck.status = 'warning';
    clipCheck.message = `${clipCount} clipping instance(s) detected`;
    clipCheck.severity = 'warning';
  } else {
    clipCheck.status = 'passed';
    clipCheck.message = 'No clipping';
    clipCheck.severity = 'success';
  }
  results.checks.push(clipCheck);

  // 5. Check sample rate
  const sampleRateCheck = {
    name: 'Sample Rate',
    threshold: thresholds.minSampleRate,
    value: sampleRate,
    unit: 'Hz',
  };
  if (sampleRate < thresholds.minSampleRate) {
    results.warnings.push('low_sample_rate');
    sampleRateCheck.status = 'info';
    sampleRateCheck.message = `Low sample rate (${sampleRate} Hz)`;
    sampleRateCheck.severity = 'info';
  } else {
    sampleRateCheck.status = 'passed';
    sampleRateCheck.message = `${sampleRate} Hz`;
    sampleRateCheck.severity = 'success';
  }
  results.checks.push(sampleRateCheck);

  return results;
}

/**
 * Rhythm Verification Check
 * Validates rhythm detection results
 */
export function checkRhythmVerification(rhythmData, thresholds = DEFAULT_THRESHOLDS.rhythm) {
  const results = {
    passed: true,
    checks: [],
    blockers: [],
    warnings: [],
    metrics: {},
  };

  if (!rhythmData) {
    results.passed = false;
    results.blockers.push('no_rhythm_data');
    results.checks.push({
      name: 'Rhythm Analysis',
      status: 'error',
      message: 'No rhythm data available',
      severity: 'error',
    });
    return results;
  }

  const { bpm, bpmConfidence, hits, patternMatch } = rhythmData;

  // 1. Check BPM confidence
  const bpmCheck = {
    name: 'BPM Confidence',
    threshold: thresholds.minBpmConfidence,
    value: bpmConfidence || 0,
    percentage: ((bpmConfidence || 0) * 100).toFixed(0),
  };
  results.metrics.bpmConfidence = bpmConfidence || 0;

  if (!bpmConfidence || bpmConfidence < thresholds.minBpmConfidence) {
    results.warnings.push('low_bpm_confidence');
    bpmCheck.status = 'warning';
    bpmCheck.message = `Low confidence (${bpmCheck.percentage}% < ${thresholds.minBpmConfidence * 100}%)`;
    bpmCheck.severity = 'warning';
  } else {
    bpmCheck.status = 'passed';
    bpmCheck.message = `${bpmCheck.percentage}% - ${bpm ? Math.round(bpm) : '?'} BPM`;
    bpmCheck.severity = 'success';
  }
  results.checks.push(bpmCheck);

  // 2. Check pattern confidence
  const patternConfidence = patternMatch?.confidence || 0;
  const patternCheck = {
    name: 'Pattern Confidence',
    threshold: thresholds.minPatternConfidence,
    value: patternConfidence,
    percentage: (patternConfidence * 100).toFixed(0),
  };
  results.metrics.patternConfidence = patternConfidence;

  if (patternConfidence < thresholds.minPatternConfidence) {
    results.warnings.push('low_pattern_confidence');
    patternCheck.status = 'warning';
    patternCheck.message = `Low confidence (${patternCheck.percentage}% < ${thresholds.minPatternConfidence * 100}%)`;
    patternCheck.severity = 'warning';
  } else {
    patternCheck.status = 'passed';
    patternCheck.message = `${patternCheck.percentage}%${patternMatch?.name ? ` - ${patternMatch.name}` : ''}`;
    patternCheck.severity = 'success';
  }
  results.checks.push(patternCheck);

  // 3. Check hit count
  const hitCount = hits ? Object.values(hits).reduce((sum, arr) => sum + (arr?.length || 0), 0) : 0;
  const hitBreakdown = hits ? {
    kick: hits.kick?.length || 0,
    snare: hits.snare?.length || 0,
    hihat: hits.hihat?.length || 0,
    other: (hits.clap?.length || 0) + (hits.tom?.length || 0) + (hits.perc?.length || 0),
  } : {};

  const hitCheck = {
    name: 'Detected Hits',
    threshold: thresholds.minHitCount,
    value: hitCount,
    breakdown: hitBreakdown,
  };
  results.metrics.hitCount = hitCount;
  results.metrics.hitBreakdown = hitBreakdown;

  if (hitCount < thresholds.minHitCount) {
    results.passed = false;
    results.blockers.push('insufficient_hits');
    hitCheck.status = 'error';
    hitCheck.message = `Not enough hits (${hitCount} < ${thresholds.minHitCount})`;
    hitCheck.severity = 'error';
  } else {
    hitCheck.status = 'passed';
    hitCheck.message = `${hitCount} hits (K:${hitBreakdown.kick}, S:${hitBreakdown.snare}, HH:${hitBreakdown.hihat}, Other:${hitBreakdown.other})`;
    hitCheck.severity = 'success';
  }
  results.checks.push(hitCheck);

  return results;
}

/**
 * Chord Verification Check
 * Validates chord detection results
 */
export function checkChordVerification(chordData, thresholds = DEFAULT_THRESHOLDS.chord) {
  const results = {
    passed: true,
    checks: [],
    blockers: [],
    warnings: [],
    metrics: {},
  };

  if (!chordData) {
    results.passed = false;
    results.blockers.push('no_chord_data');
    results.checks.push({
      name: 'Chord Analysis',
      status: 'error',
      message: 'No chord data available',
      severity: 'error',
    });
    return results;
  }

  const { chordHistory, avgConfidence, maxChromaValue } = chordData;

  // 1. Check average confidence
  const confCheck = {
    name: 'Average Confidence',
    threshold: thresholds.minAvgConfidence,
    value: avgConfidence || 0,
    percentage: ((avgConfidence || 0) * 100).toFixed(0),
  };
  results.metrics.avgConfidence = avgConfidence || 0;

  if (!avgConfidence || avgConfidence < thresholds.minAvgConfidence) {
    results.warnings.push('low_chord_confidence');
    confCheck.status = 'warning';
    confCheck.message = `Low confidence (${confCheck.percentage}% < ${thresholds.minAvgConfidence * 100}%)`;
    confCheck.severity = 'warning';
  } else {
    confCheck.status = 'passed';
    confCheck.message = `${confCheck.percentage}%`;
    confCheck.severity = 'success';
  }
  results.checks.push(confCheck);

  // 2. Check harmonic content
  const harmonicCheck = {
    name: 'Harmonic Content',
    threshold: thresholds.minHarmonicContent,
    value: maxChromaValue || 0,
  };
  results.metrics.harmonicContent = maxChromaValue || 0;

  if (!maxChromaValue || maxChromaValue < thresholds.minHarmonicContent) {
    results.warnings.push('low_harmonic_content');
    harmonicCheck.status = 'warning';
    harmonicCheck.message = 'Low harmonic content detected';
    harmonicCheck.severity = 'warning';
  } else {
    harmonicCheck.status = 'passed';
    harmonicCheck.message = 'Sufficient harmonic energy';
    harmonicCheck.severity = 'success';
  }
  results.checks.push(harmonicCheck);

  // 3. Check chord count
  const uniqueChords = chordHistory
    ? [...new Set(chordHistory.map(c => c.symbol))].length
    : 0;

  const chordCountCheck = {
    name: 'Unique Chords',
    threshold: thresholds.minChordCount,
    value: uniqueChords,
    total: chordHistory?.length || 0,
  };
  results.metrics.uniqueChords = uniqueChords;
  results.metrics.totalChords = chordHistory?.length || 0;

  if (uniqueChords < thresholds.minChordCount) {
    results.warnings.push('few_unique_chords');
    chordCountCheck.status = 'warning';
    chordCountCheck.message = `Few unique chords (${uniqueChords} < ${thresholds.minChordCount})`;
    chordCountCheck.severity = 'warning';
  } else {
    chordCountCheck.status = 'passed';
    chordCountCheck.message = `${uniqueChords} unique chords detected`;
    chordCountCheck.severity = 'success';
  }
  results.checks.push(chordCountCheck);

  return results;
}

/**
 * Export Readiness Check
 * Final validation before MIDI/PDF export
 */
export function checkExportReadiness(stageStatus, qualityScore, thresholds = DEFAULT_THRESHOLDS.export) {
  const results = {
    passed: true,
    checks: [],
    blockers: [],
  };

  // 1. Check all stages verified
  const stageCheck = {
    name: 'All Stages Verified',
    stages: stageStatus,
  };

  const allVerified =
    (stageStatus.audio === STAGE_STATUS.PASSED || stageStatus.audio === STAGE_STATUS.VERIFIED || stageStatus.audio === STAGE_STATUS.SKIPPED) &&
    (stageStatus.rhythm === STAGE_STATUS.VERIFIED || stageStatus.rhythm === STAGE_STATUS.SKIPPED) &&
    (stageStatus.chord === STAGE_STATUS.VERIFIED || stageStatus.chord === STAGE_STATUS.SKIPPED);

  if (!allVerified) {
    results.passed = false;
    results.blockers.push('stages_not_verified');
    stageCheck.status = 'error';
    stageCheck.message = 'Not all stages have been verified';
    stageCheck.severity = 'error';
  } else {
    stageCheck.status = 'passed';
    stageCheck.message = 'All stages verified';
    stageCheck.severity = 'success';
  }
  results.checks.push(stageCheck);

  // 2. Check quality score
  const qualityCheck = {
    name: 'Quality Score',
    threshold: thresholds.minQualityScore,
    value: qualityScore || 0,
  };

  if (!qualityScore || qualityScore < thresholds.minQualityScore) {
    results.blockers.push('low_quality_score');
    qualityCheck.status = 'warning';
    qualityCheck.message = `Quality score below threshold (${qualityScore || 0} < ${thresholds.minQualityScore})`;
    qualityCheck.severity = 'warning';
  } else {
    qualityCheck.status = 'passed';
    qualityCheck.message = `Score: ${qualityScore}`;
    qualityCheck.severity = 'success';
  }
  results.checks.push(qualityCheck);

  return results;
}

/**
 * Get severity color for UI
 */
export function getSeverityColor(severity) {
  switch (severity) {
    case 'success':
      return '#10B981';
    case 'warning':
      return '#F59E0B';
    case 'error':
      return '#EF4444';
    case 'info':
      return '#3B82F6';
    default:
      return '#6B7280';
  }
}

/**
 * Get status icon for UI
 */
export function getStatusIcon(status) {
  switch (status) {
    case STAGE_STATUS.PASSED:
    case STAGE_STATUS.VERIFIED:
      return '\u2713'; // checkmark
    case STAGE_STATUS.WARNING:
      return '\u26A0'; // warning
    case STAGE_STATUS.FAILED:
      return '\u2717'; // x
    case STAGE_STATUS.CHECKING:
      return '\u2026'; // ellipsis
    case STAGE_STATUS.BLOCKED:
      return '\u25CB'; // empty circle
    case STAGE_STATUS.SKIPPED:
      return '\u21B7'; // skip arrow
    default:
      return '\u25CB'; // empty circle
  }
}

/**
 * Format confidence as percentage bar width
 */
export function confidenceToWidth(confidence, max = 100) {
  return Math.min(100, Math.max(0, (confidence || 0) * max));
}
