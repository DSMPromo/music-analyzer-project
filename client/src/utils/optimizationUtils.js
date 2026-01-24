/**
 * @module optimizationUtils
 * @description Audio Optimization Utilities for professional mastering recommendations
 *
 * Provides algorithms for:
 * - Genre-specific target calculations
 * - EQ recommendation generation
 * - Compression/limiting settings
 * - Multi-band processing recommendations
 * - Harmonic enhancement suggestions
 */

// ============================================
// GENRE TARGETS
// ============================================

/**
 * Genre-specific mastering targets
 * Each genre has optimal LUFS, dynamic range, and frequency balance targets
 */
export const GENRE_TARGETS = {
  'hip-hop': {
    name: 'Hip-Hop / Trap',
    lufs: { min: -10, max: -8, optimal: -9 },
    dynamicRange: { min: 6, max: 8 },
    truePeak: -0.5,
    frequencyBalance: {
      sub: { target: 'heavy', boost: 3 },      // 20-60Hz: Heavy 808s
      bass: { target: 'present', boost: 2 },    // 60-250Hz: Kick punch
      lowMid: { target: 'controlled', cut: -2 }, // 250-500Hz: Avoid mud
      mid: { target: 'clear', boost: 0 },       // 500-2kHz: Vocal clarity
      highMid: { target: 'crisp', boost: 1 },   // 2-4kHz: Snap/presence
      presence: { target: 'bright', boost: 2 }, // 4-6kHz: Hi-hat clarity
      brilliance: { target: 'airy', boost: 1 }  // 6-20kHz: Air
    },
    compression: { threshold: -6, ratio: 4, attack: 10, release: 100 },
    limiter: { threshold: -1, release: 50 }
  },
  'edm': {
    name: 'EDM / House / Electronic',
    lufs: { min: -8, max: -6, optimal: -7 },
    dynamicRange: { min: 4, max: 6 },
    truePeak: -0.3,
    frequencyBalance: {
      sub: { target: 'powerful', boost: 4 },
      bass: { target: 'punchy', boost: 3 },
      lowMid: { target: 'tight', cut: -3 },
      mid: { target: 'present', boost: 1 },
      highMid: { target: 'aggressive', boost: 2 },
      presence: { target: 'bright', boost: 3 },
      brilliance: { target: 'sparkle', boost: 2 }
    },
    compression: { threshold: -4, ratio: 6, attack: 5, release: 50 },
    limiter: { threshold: -0.5, release: 30 }
  },
  'pop': {
    name: 'Pop',
    lufs: { min: -12, max: -10, optimal: -11 },
    dynamicRange: { min: 8, max: 10 },
    truePeak: -1,
    frequencyBalance: {
      sub: { target: 'controlled', boost: 0 },
      bass: { target: 'balanced', boost: 1 },
      lowMid: { target: 'clean', cut: -1 },
      mid: { target: 'full', boost: 1 },
      highMid: { target: 'clear', boost: 1 },
      presence: { target: 'present', boost: 2 },
      brilliance: { target: 'open', boost: 1 }
    },
    compression: { threshold: -8, ratio: 3, attack: 15, release: 150 },
    limiter: { threshold: -1.5, release: 100 }
  },
  'rock': {
    name: 'Rock / Alternative',
    lufs: { min: -12, max: -10, optimal: -11 },
    dynamicRange: { min: 10, max: 12 },
    truePeak: -1,
    frequencyBalance: {
      sub: { target: 'controlled', boost: 0 },
      bass: { target: 'punchy', boost: 2 },
      lowMid: { target: 'warm', boost: 0 },
      mid: { target: 'full', boost: 1 },
      highMid: { target: 'present', boost: 2 },
      presence: { target: 'aggressive', boost: 2 },
      brilliance: { target: 'crisp', boost: 1 }
    },
    compression: { threshold: -10, ratio: 3, attack: 20, release: 200 },
    limiter: { threshold: -1.5, release: 150 }
  },
  'acoustic': {
    name: 'Acoustic / Folk / Classical',
    lufs: { min: -16, max: -14, optimal: -15 },
    dynamicRange: { min: 12, max: 16 },
    truePeak: -1.5,
    frequencyBalance: {
      sub: { target: 'minimal', cut: -2 },
      bass: { target: 'natural', boost: 0 },
      lowMid: { target: 'warm', boost: 1 },
      mid: { target: 'natural', boost: 0 },
      highMid: { target: 'present', boost: 1 },
      presence: { target: 'clear', boost: 1 },
      brilliance: { target: 'airy', boost: 0 }
    },
    compression: { threshold: -12, ratio: 2, attack: 30, release: 300 },
    limiter: { threshold: -2, release: 200 }
  },
  'rnb': {
    name: 'R&B / Soul',
    lufs: { min: -11, max: -9, optimal: -10 },
    dynamicRange: { min: 8, max: 10 },
    truePeak: -0.5,
    frequencyBalance: {
      sub: { target: 'present', boost: 2 },
      bass: { target: 'smooth', boost: 2 },
      lowMid: { target: 'warm', boost: 0 },
      mid: { target: 'vocal-focused', boost: 1 },
      highMid: { target: 'silky', boost: 1 },
      presence: { target: 'smooth', boost: 1 },
      brilliance: { target: 'airy', boost: 1 }
    },
    compression: { threshold: -8, ratio: 3, attack: 15, release: 150 },
    limiter: { threshold: -1, release: 100 }
  },
  'jazz': {
    name: 'Jazz',
    lufs: { min: -18, max: -14, optimal: -16 },
    dynamicRange: { min: 14, max: 18 },
    truePeak: -2,
    frequencyBalance: {
      sub: { target: 'natural', boost: 0 },
      bass: { target: 'round', boost: 1 },
      lowMid: { target: 'warm', boost: 1 },
      mid: { target: 'natural', boost: 0 },
      highMid: { target: 'smooth', boost: 0 },
      presence: { target: 'clear', boost: 1 },
      brilliance: { target: 'natural', boost: 0 }
    },
    compression: { threshold: -14, ratio: 2, attack: 40, release: 400 },
    limiter: { threshold: -2.5, release: 300 }
  },
  'metal': {
    name: 'Metal / Heavy Rock',
    lufs: { min: -10, max: -8, optimal: -9 },
    dynamicRange: { min: 6, max: 10 },
    truePeak: -0.5,
    frequencyBalance: {
      sub: { target: 'tight', boost: 1 },
      bass: { target: 'aggressive', boost: 3 },
      lowMid: { target: 'scooped', cut: -2 },
      mid: { target: 'aggressive', boost: 1 },
      highMid: { target: 'cutting', boost: 3 },
      presence: { target: 'aggressive', boost: 2 },
      brilliance: { target: 'sharp', boost: 2 }
    },
    compression: { threshold: -6, ratio: 4, attack: 5, release: 50 },
    limiter: { threshold: -1, release: 50 }
  },
  'lofi': {
    name: 'Lo-Fi / Chill',
    lufs: { min: -14, max: -12, optimal: -13 },
    dynamicRange: { min: 8, max: 12 },
    truePeak: -1,
    frequencyBalance: {
      sub: { target: 'warm', boost: 1 },
      bass: { target: 'round', boost: 2 },
      lowMid: { target: 'warm', boost: 1 },
      mid: { target: 'mellow', cut: -1 },
      highMid: { target: 'soft', cut: -2 },
      presence: { target: 'rolled-off', cut: -3 },
      brilliance: { target: 'dark', cut: -4 }
    },
    compression: { threshold: -10, ratio: 3, attack: 20, release: 200 },
    limiter: { threshold: -1.5, release: 150 }
  },
  'cinematic': {
    name: 'Cinematic / Film Score',
    lufs: { min: -18, max: -14, optimal: -16 },
    dynamicRange: { min: 14, max: 20 },
    truePeak: -1.5,
    frequencyBalance: {
      sub: { target: 'powerful', boost: 2 },
      bass: { target: 'full', boost: 1 },
      lowMid: { target: 'rich', boost: 1 },
      mid: { target: 'detailed', boost: 0 },
      highMid: { target: 'present', boost: 1 },
      presence: { target: 'clear', boost: 1 },
      brilliance: { target: 'spacious', boost: 1 }
    },
    compression: { threshold: -14, ratio: 2, attack: 50, release: 500 },
    limiter: { threshold: -2, release: 300 }
  }
};

// ============================================
// FREQUENCY BAND DEFINITIONS
// ============================================

export const OPTIMIZATION_BANDS = [
  { name: 'Sub', key: 'sub', low: 20, high: 60, color: '#8B5CF6' },
  { name: 'Bass', key: 'bass', low: 60, high: 250, color: '#3B82F6' },
  { name: 'Low-Mid', key: 'lowMid', low: 250, high: 500, color: '#10B981' },
  { name: 'Mid', key: 'mid', low: 500, high: 2000, color: '#F59E0B' },
  { name: 'High-Mid', key: 'highMid', low: 2000, high: 4000, color: '#EF4444' },
  { name: 'Presence', key: 'presence', low: 4000, high: 6000, color: '#EC4899' },
  { name: 'Brilliance', key: 'brilliance', low: 6000, high: 20000, color: '#A855F7' }
];

// ============================================
// GENRE DETECTION
// ============================================

/**
 * Auto-detect genre from audio characteristics
 * @param {Object} metrics - Audio metrics (LUFS, spectral data, etc.)
 * @returns {Object} Detected genre with confidence
 */
export function detectGenre(metrics) {
  const scores = {};

  Object.entries(GENRE_TARGETS).forEach(([genreKey, genre]) => {
    let score = 0;

    // LUFS matching
    if (metrics.lufs >= genre.lufs.min && metrics.lufs <= genre.lufs.max) {
      score += 30;
    } else if (metrics.lufs >= genre.lufs.min - 2 && metrics.lufs <= genre.lufs.max + 2) {
      score += 15;
    }

    // Dynamic range matching
    if (metrics.dynamicRange >= genre.dynamicRange.min &&
        metrics.dynamicRange <= genre.dynamicRange.max) {
      score += 25;
    }

    // Frequency balance characteristics
    if (metrics.frequencyProfile) {
      const { subBassRatio, bassRatio, highRatio } = metrics.frequencyProfile;

      // Heavy sub-bass genres
      if (genreKey === 'hip-hop' || genreKey === 'edm') {
        if (subBassRatio > 0.15) score += 20;
      }

      // Bright genres
      if (genreKey === 'edm' || genreKey === 'pop') {
        if (highRatio > 0.25) score += 15;
      }

      // Dark/warm genres
      if (genreKey === 'lofi' || genreKey === 'jazz') {
        if (highRatio < 0.15) score += 15;
      }
    }

    // Crest factor (transient vs sustained)
    if (metrics.crestFactor) {
      if (genreKey === 'edm' && metrics.crestFactor < 8) score += 10;
      if (genreKey === 'jazz' && metrics.crestFactor > 12) score += 10;
      if (genreKey === 'acoustic' && metrics.crestFactor > 14) score += 10;
    }

    scores[genreKey] = score;
  });

  // Find best match
  const sortedGenres = Object.entries(scores)
    .sort(([, a], [, b]) => b - a);

  const [topGenre, topScore] = sortedGenres[0];
  const confidence = Math.min(100, topScore);

  return {
    genre: topGenre,
    genreName: GENRE_TARGETS[topGenre].name,
    confidence,
    alternates: sortedGenres.slice(1, 3).map(([g, s]) => ({
      genre: g,
      genreName: GENRE_TARGETS[g].name,
      score: s
    }))
  };
}

// ============================================
// EQ RECOMMENDATIONS
// ============================================

/**
 * Generate EQ recommendations based on current vs target
 * @param {Object} currentMetrics - Current frequency analysis
 * @param {string} targetGenre - Target genre key
 * @param {Object} problemFrequencies - Detected problems from mixAnalysisUtils
 * @returns {Object[]} EQ band recommendations
 */
export function generateEQRecommendations(currentMetrics, targetGenre, problemFrequencies = []) {
  const target = GENRE_TARGETS[targetGenre] || GENRE_TARGETS.pop;
  const recommendations = [];

  // Process each frequency band
  OPTIMIZATION_BANDS.forEach(band => {
    const targetBalance = target.frequencyBalance[band.key];
    const currentEnergy = currentMetrics.bandEnergies?.[band.key] || 0;

    // Check for problem frequencies in this band
    const problems = problemFrequencies.filter(p =>
      p.frequencyRange[0] >= band.low && p.frequencyRange[1] <= band.high
    );

    let recommendation = {
      band: band.name,
      frequencyRange: [band.low, band.high],
      targetDescription: targetBalance.target,
      currentDb: currentEnergy,
      recommendedChange: targetBalance.boost || targetBalance.cut || 0,
      problems: problems.map(p => p.name),
      priority: 'low',
      type: 'shelf', // shelf, bell, or notch
      q: 1.0
    };

    // Adjust for detected problems
    if (problems.some(p => p.severity === 'severe')) {
      recommendation.priority = 'high';
      recommendation.recommendedChange = Math.min(recommendation.recommendedChange, -3);
      recommendation.type = 'bell';
      recommendation.q = 2.0;
    } else if (problems.some(p => p.severity === 'moderate')) {
      recommendation.priority = 'medium';
      recommendation.recommendedChange = Math.min(recommendation.recommendedChange, -2);
    }

    // Add specific frequency for problematic areas
    if (problems.length > 0) {
      recommendation.specificFrequency = problems[0].frequency;
    }

    recommendations.push(recommendation);
  });

  // Add specific cut recommendations for common problems
  const additionalCuts = [];

  // Muddy frequencies (200-400Hz)
  const muddyProblems = problemFrequencies.filter(p => p.type === 'muddy');
  if (muddyProblems.length > 0) {
    additionalCuts.push({
      band: 'Mud Cut',
      frequencyRange: [200, 400],
      specificFrequency: muddyProblems[0]?.frequency || 300,
      recommendedChange: -3,
      type: 'bell',
      q: 2.0,
      priority: 'high',
      reason: 'Reduce muddy buildup for clarity'
    });
  }

  // Harsh frequencies (2-5kHz)
  const harshProblems = problemFrequencies.filter(p => p.type === 'harsh');
  if (harshProblems.length > 0) {
    additionalCuts.push({
      band: 'Harsh Cut',
      frequencyRange: [2000, 5000],
      specificFrequency: harshProblems[0]?.frequency || 3500,
      recommendedChange: -2,
      type: 'bell',
      q: 3.0,
      priority: 'high',
      reason: 'Reduce harsh, fatiguing frequencies'
    });
  }

  // Sibilance (5-9kHz)
  const sibilantProblems = problemFrequencies.filter(p => p.type === 'sibilant');
  if (sibilantProblems.length > 0) {
    additionalCuts.push({
      band: 'De-ess',
      frequencyRange: [5000, 9000],
      specificFrequency: sibilantProblems[0]?.frequency || 7000,
      recommendedChange: -2,
      type: 'dynamic', // Use dynamic EQ or de-esser
      q: 4.0,
      priority: 'medium',
      reason: 'Control excessive sibilance'
    });
  }

  return [...recommendations, ...additionalCuts];
}

// ============================================
// COMPRESSION RECOMMENDATIONS
// ============================================

/**
 * Generate compression settings for optimal dynamics
 * @param {Object} metrics - Current audio metrics
 * @param {string} targetGenre - Target genre
 * @returns {Object} Compression recommendation
 */
export function generateCompressionRecommendation(metrics, targetGenre) {
  const target = GENRE_TARGETS[targetGenre] || GENRE_TARGETS.pop;
  const targetComp = target.compression;

  const currentDynamicRange = metrics.dynamicRange || 10;
  const targetDynamicRange = (target.dynamicRange.min + target.dynamicRange.max) / 2;

  // Calculate needed compression
  const drDifference = currentDynamicRange - targetDynamicRange;

  let recommendation = {
    threshold: targetComp.threshold,
    ratio: targetComp.ratio,
    attack: targetComp.attack,
    release: targetComp.release,
    makeupGain: 0,
    knee: 3, // Soft knee default
    currentDynamicRange,
    targetDynamicRange,
    adjustment: 'none'
  };

  if (drDifference > 4) {
    // Too dynamic, need more compression
    recommendation.threshold += 2; // Lower threshold
    recommendation.ratio = Math.min(8, targetComp.ratio + 1);
    recommendation.adjustment = 'increase';
    recommendation.makeupGain = Math.round(drDifference / 2);
    recommendation.note = `Reduce dynamic range by ~${Math.round(drDifference)}dB`;
  } else if (drDifference < -2) {
    // Over-compressed
    recommendation.threshold -= 2; // Higher threshold
    recommendation.ratio = Math.max(2, targetComp.ratio - 1);
    recommendation.adjustment = 'decrease';
    recommendation.note = 'Audio may be over-compressed. Consider lighter compression.';
  } else {
    recommendation.note = 'Dynamic range is appropriate for genre';
  }

  return recommendation;
}

/**
 * Generate multi-band compression recommendations
 * @param {Object} metrics - Current audio metrics with band energies
 * @param {string} targetGenre - Target genre
 * @returns {Object[]} Multi-band compression settings
 */
export function generateMultibandCompression(metrics, targetGenre) {
  const target = GENRE_TARGETS[targetGenre] || GENRE_TARGETS.pop;

  const bands = [
    {
      name: 'Low',
      range: [20, 250],
      threshold: target.compression.threshold - 2,
      ratio: Math.min(target.compression.ratio + 1, 6),
      attack: target.compression.attack * 2, // Slower for low end
      release: target.compression.release * 1.5,
      note: 'Control low-end dynamics without losing punch'
    },
    {
      name: 'Mid',
      range: [250, 2000],
      threshold: target.compression.threshold,
      ratio: target.compression.ratio,
      attack: target.compression.attack,
      release: target.compression.release,
      note: 'Main body compression for consistency'
    },
    {
      name: 'High',
      range: [2000, 20000],
      threshold: target.compression.threshold + 2, // Higher threshold for highs
      ratio: Math.max(target.compression.ratio - 1, 2),
      attack: Math.max(target.compression.attack * 0.5, 1), // Fast for transients
      release: target.compression.release * 0.5,
      note: 'Gentle high-frequency control, preserve air'
    }
  ];

  return bands;
}

// ============================================
// LIMITER RECOMMENDATIONS
// ============================================

/**
 * Generate limiter settings for final loudness
 * @param {Object} metrics - Current metrics
 * @param {string} targetGenre - Target genre
 * @param {string} platform - Target platform (spotify, apple, youtube)
 * @returns {Object} Limiter recommendation
 */
export function generateLimiterRecommendation(metrics, targetGenre, platform = 'spotify') {
  const target = GENRE_TARGETS[targetGenre] || GENRE_TARGETS.pop;

  const platformCeilings = {
    spotify: -1.0,
    appleMusic: -1.0,
    youtube: -1.0,
    soundcloud: -1.0,
    broadcast: -1.0
  };

  const ceiling = platformCeilings[platform] || -1.0;
  const currentLUFS = metrics.lufs || -14;
  const targetLUFS = target.lufs.optimal;

  const lufsDiff = targetLUFS - currentLUFS;

  return {
    threshold: Math.max(target.limiter.threshold, ceiling),
    ceiling: ceiling,
    release: target.limiter.release,
    lookahead: 5, // 5ms lookahead typical
    currentLUFS,
    targetLUFS,
    gainToApply: Math.max(0, lufsDiff),
    oversampling: true,
    note: lufsDiff > 0
      ? `Apply ~${lufsDiff.toFixed(1)}dB gain before limiter to reach ${targetLUFS} LUFS`
      : `Already at or above target loudness. Be careful not to over-limit.`
  };
}

// ============================================
// STEREO RECOMMENDATIONS
// ============================================

/**
 * Generate stereo field recommendations
 * @param {Object} metrics - Current stereo metrics
 * @param {string} targetGenre - Target genre
 * @returns {Object} Stereo recommendation
 */
export function generateStereoRecommendation(metrics, targetGenre) {
  const correlation = metrics.phaseCorrelation || 0.8;
  const width = metrics.stereoWidth || 50;
  const balance = metrics.balance || 0;

  const recommendation = {
    currentCorrelation: correlation,
    currentWidth: width,
    currentBalance: balance,
    issues: [],
    fixes: []
  };

  // Phase issues
  if (correlation < 0) {
    recommendation.issues.push({
      type: 'phase',
      severity: 'severe',
      description: 'Out of phase content - will cancel in mono'
    });
    recommendation.fixes.push({
      action: 'Use M/S processing to reduce side channel below 200Hz',
      tool: 'Mid-Side EQ or Stereo Imager'
    });
  } else if (correlation < 0.3) {
    recommendation.issues.push({
      type: 'phase',
      severity: 'moderate',
      description: 'Very wide stereo - may not translate well to mono'
    });
    recommendation.fixes.push({
      action: 'Check mono compatibility, consider narrowing low frequencies',
      tool: 'Correlation Meter, Stereo Imager'
    });
  }

  // Width recommendations
  if (width < 20) {
    recommendation.issues.push({
      type: 'width',
      severity: 'low',
      description: 'Narrow stereo image'
    });
    recommendation.fixes.push({
      action: 'Add stereo width with subtle widener on mid/high frequencies',
      tool: 'Stereo Widener (Ozone Imager, S1, etc.)'
    });
  } else if (width > 150) {
    recommendation.issues.push({
      type: 'width',
      severity: 'moderate',
      description: 'Extremely wide stereo - may cause phase issues'
    });
    recommendation.fixes.push({
      action: 'Narrow the stereo image, especially on low frequencies',
      tool: 'Stereo Imager, Mid-Side Processing'
    });
  }

  // Balance issues
  if (Math.abs(balance) > 1) {
    recommendation.issues.push({
      type: 'balance',
      severity: Math.abs(balance) > 3 ? 'moderate' : 'low',
      description: `${Math.abs(balance).toFixed(1)}dB ${balance > 0 ? 'right' : 'left'} channel imbalance`
    });
    recommendation.fixes.push({
      action: `Apply ${Math.abs(balance).toFixed(1)}dB gain to ${balance > 0 ? 'left' : 'right'} channel`,
      tool: 'Utility/Gain plugin or Balance control'
    });
  }

  // Genre-specific width targets
  const widthTargets = {
    'hip-hop': { min: 40, max: 80, note: 'Keep bass/kick centered, wide hi-hats' },
    'edm': { min: 60, max: 100, note: 'Wide synths, centered kick/bass' },
    'pop': { min: 50, max: 80, note: 'Balanced width, clear center' },
    'rock': { min: 50, max: 90, note: 'Wide guitars, centered bass/drums' },
    'acoustic': { min: 30, max: 60, note: 'Natural width, avoid artificial widening' },
    'jazz': { min: 40, max: 70, note: 'Natural stereo placement' }
  };

  const widthTarget = widthTargets[targetGenre] || widthTargets.pop;
  recommendation.targetWidth = widthTarget;

  return recommendation;
}

// ============================================
// OVERALL OPTIMIZATION SUMMARY
// ============================================

/**
 * Generate complete optimization summary
 * @param {Object} metrics - All current audio metrics
 * @param {string} targetGenre - Target genre (or auto-detect)
 * @param {Object} problemFrequencies - Detected problems
 * @param {string} platform - Target streaming platform
 * @returns {Object} Complete optimization recommendations
 */
export function generateOptimizationSummary(metrics, targetGenre, problemFrequencies = [], platform = 'spotify') {
  // Auto-detect genre if not specified
  let detectedGenre = null;
  if (!targetGenre || targetGenre === 'auto') {
    detectedGenre = detectGenre(metrics);
    targetGenre = detectedGenre.genre;
  }

  const target = GENRE_TARGETS[targetGenre] || GENRE_TARGETS.pop;

  // Generate all recommendations
  const eqRecommendations = generateEQRecommendations(metrics, targetGenre, problemFrequencies);
  const compressionRecommendation = generateCompressionRecommendation(metrics, targetGenre);
  const multibandRecommendation = generateMultibandCompression(metrics, targetGenre);
  const limiterRecommendation = generateLimiterRecommendation(metrics, targetGenre, platform);
  const stereoRecommendation = generateStereoRecommendation(metrics, targetGenre);

  // Calculate improvement score
  const currentScore = calculateCurrentScore(metrics, target);
  const potentialScore = calculatePotentialScore(metrics, target, problemFrequencies);

  return {
    detectedGenre,
    targetGenre,
    targetGenreName: target.name,
    platform,

    currentMetrics: {
      lufs: metrics.lufs,
      dynamicRange: metrics.dynamicRange,
      truePeak: metrics.peakDb,
      stereoWidth: metrics.stereoWidth,
      phaseCorrelation: metrics.phaseCorrelation
    },

    targetMetrics: {
      lufs: target.lufs.optimal,
      dynamicRange: (target.dynamicRange.min + target.dynamicRange.max) / 2,
      truePeak: target.truePeak,
      frequencyBalance: target.frequencyBalance
    },

    recommendations: {
      eq: eqRecommendations,
      compression: compressionRecommendation,
      multiband: multibandRecommendation,
      limiter: limiterRecommendation,
      stereo: stereoRecommendation
    },

    scores: {
      current: currentScore,
      potential: potentialScore,
      improvement: potentialScore - currentScore
    },

    priority: prioritizeRecommendations(eqRecommendations, compressionRecommendation, stereoRecommendation)
  };
}

/**
 * Calculate current audio score vs genre target
 */
function calculateCurrentScore(metrics, target) {
  let score = 100;

  // LUFS deviation
  const lufsOptimal = target.lufs.optimal;
  const lufsDiff = Math.abs((metrics.lufs || -14) - lufsOptimal);
  score -= Math.min(20, lufsDiff * 3);

  // Dynamic range deviation
  const drOptimal = (target.dynamicRange.min + target.dynamicRange.max) / 2;
  const drDiff = Math.abs((metrics.dynamicRange || 10) - drOptimal);
  score -= Math.min(15, drDiff * 2);

  // Phase correlation penalty
  if ((metrics.phaseCorrelation || 0.8) < 0) {
    score -= 20;
  } else if ((metrics.phaseCorrelation || 0.8) < 0.3) {
    score -= 10;
  }

  // Balance penalty
  if (Math.abs(metrics.balance || 0) > 1) {
    score -= Math.min(10, Math.abs(metrics.balance) * 3);
  }

  return Math.max(0, Math.round(score));
}

/**
 * Calculate potential score after optimization
 */
function calculatePotentialScore(metrics, target, problemFrequencies) {
  let score = 95; // Assume near-perfect after optimization

  // Some issues can't be fully fixed
  if (problemFrequencies.some(p => p.severity === 'severe')) {
    score -= 5;
  }

  // Phase issues are hard to fix without remix
  if ((metrics.phaseCorrelation || 0.8) < 0) {
    score -= 10;
  }

  return Math.max(0, Math.round(score));
}

/**
 * Prioritize recommendations by impact
 */
function prioritizeRecommendations(eqRecs, compRec, stereoRec) {
  const priorities = [];

  // High priority EQ issues
  eqRecs.filter(r => r.priority === 'high').forEach(r => {
    priorities.push({
      order: 1,
      category: 'EQ',
      action: `Cut ${r.band}: ${r.recommendedChange}dB at ${r.specificFrequency || r.frequencyRange[0]}Hz`,
      reason: r.problems?.join(', ') || r.reason
    });
  });

  // Stereo issues
  stereoRec.issues.filter(i => i.severity === 'severe').forEach((issue, idx) => {
    priorities.push({
      order: 2,
      category: 'Stereo',
      action: stereoRec.fixes[idx]?.action || 'Fix stereo issues',
      reason: issue.description
    });
  });

  // Compression adjustments
  if (compRec.adjustment !== 'none') {
    priorities.push({
      order: 3,
      category: 'Dynamics',
      action: compRec.note,
      reason: `Current DR: ${compRec.currentDynamicRange.toFixed(1)}dB, Target: ${compRec.targetDynamicRange.toFixed(1)}dB`
    });
  }

  // Medium priority EQ
  eqRecs.filter(r => r.priority === 'medium').forEach(r => {
    priorities.push({
      order: 4,
      category: 'EQ',
      action: `Adjust ${r.band}: ${r.recommendedChange > 0 ? '+' : ''}${r.recommendedChange}dB`,
      reason: r.problems?.join(', ') || 'Genre optimization'
    });
  });

  return priorities.sort((a, b) => a.order - b.order);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Get all available genres
 */
export function getAvailableGenres() {
  return Object.entries(GENRE_TARGETS).map(([key, value]) => ({
    key,
    name: value.name
  }));
}

/**
 * Get targets for a specific genre
 */
export function getGenreTargets(genre) {
  return GENRE_TARGETS[genre] || null;
}

/**
 * Calculate frequency profile from FFT data
 */
export function calculateFrequencyProfile(fftData, sampleRate, fftSize) {
  if (!fftData || fftData.length === 0) return null;

  const numBins = fftData.length;
  const freqPerBin = sampleRate / fftSize;

  // Calculate energy in key bands
  let subBassEnergy = 0, bassEnergy = 0, midEnergy = 0, highEnergy = 0;
  let totalEnergy = 0;

  for (let bin = 0; bin < numBins; bin++) {
    const freq = bin * freqPerBin;
    const energy = Math.pow(fftData[bin] / 255, 2);
    totalEnergy += energy;

    if (freq < 60) subBassEnergy += energy;
    else if (freq < 250) bassEnergy += energy;
    else if (freq < 2000) midEnergy += energy;
    else highEnergy += energy;
  }

  if (totalEnergy === 0) return null;

  return {
    subBassRatio: subBassEnergy / totalEnergy,
    bassRatio: bassEnergy / totalEnergy,
    midRatio: midEnergy / totalEnergy,
    highRatio: highEnergy / totalEnergy
  };
}
