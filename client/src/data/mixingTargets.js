/**
 * Mixing Targets and Fletcher-Munson Psychoacoustic Analysis
 * Frequency targets, equal-loudness curves, and genre-specific mixing guidance
 * Based on the Music Production Master Template
 */

// Frequency band definitions
export const FREQUENCY_BANDS = {
  sub: { name: 'Sub', range: '20-60Hz', low: 20, high: 60, contains: 'Kick sub, bass sub (felt more than heard)' },
  bass: { name: 'Bass', range: '60-120Hz', low: 60, high: 120, contains: 'Kick body, bass body, warmth' },
  lowMids: { name: 'Low Mids', range: '120-250Hz', low: 120, high: 250, contains: 'Body of instruments, potential mud zone' },
  mids: { name: 'Mids', range: '250Hz-1kHz', low: 250, high: 1000, contains: 'Vocal body, snare body, fundamental tones' },
  presence: { name: 'Presence', range: '1-4kHz', low: 1000, high: 4000, contains: 'Vocal clarity, attack, intelligibility (ear most sensitive)' },
  brilliance: { name: 'Brilliance', range: '4-12kHz', low: 4000, high: 12000, contains: 'Hi-hats, cymbals, brightness, sibilance' },
  air: { name: 'Air', range: '12-18kHz', low: 12000, high: 18000, contains: 'Sparkle, shimmer, openness' }
};

// Fletcher-Munson Equal-Loudness Weight Tables
// Your ear changes sensitivity based on listening volume
export const EQUAL_LOUDNESS_PROFILES = {
  quiet: {
    name: 'Quiet Profile (40 phon)',
    description: 'Low Volume Listening - Ear hates sub and air, loves presence (2-5kHz)',
    monitorLevel: 0.0,
    weights: {
      sub: -12,      // Ear very insensitive
      bass: -8,      // Still reduced
      lowMids: -3,   // Slightly reduced
      mids: 0,       // Reference
      presence: +3,  // Ear most sensitive here
      brilliance: 0, // Neutral
      air: -4        // Reduced sensitivity
    }
  },
  normal: {
    name: 'Normal Profile (60 phon)',
    description: 'Moderate Volume - Less extreme curve, still presence-sensitive',
    monitorLevel: 0.5,
    weights: {
      sub: -6,       // Still reduced
      bass: -3,      // Mild reduction
      lowMids: -1,   // Nearly flat
      mids: 0,       // Reference
      presence: +2,  // Still sensitive
      brilliance: 0, // Neutral
      air: -2        // Slight reduction
    }
  },
  loud: {
    name: 'Loud Profile (80 phon)',
    description: 'High Volume/Club - Almost flat response, slight presence boost remains',
    monitorLevel: 1.0,
    weights: {
      sub: -2,       // Nearly flat
      bass: -1,      // Almost flat
      lowMids: 0,    // Flat
      mids: 0,       // Reference
      presence: +1,  // Slight boost remains
      brilliance: 0, // Flat
      air: 0         // Flat
    }
  }
};

// Genre target curves (referenced at Normal listening level)
export const GENRE_TARGETS = {
  afroHouse: {
    name: 'Afro House Target',
    description: 'Warm, open, slightly relaxed presence for long listening',
    targets: {
      sub: +1,       // Warm sub presence
      bass: 0,       // Balanced
      lowMids: -2,   // Cut mud
      mids: 0,       // Neutral
      presence: -1,  // Slightly relaxed for long listening
      brilliance: 0, // Neutral
      air: +1        // Open, airy
    }
  },
  edm: {
    name: 'EDM Target',
    description: 'Heavy sub, aggressive presence, bright highs',
    targets: {
      sub: +2,       // Heavy sub
      bass: +1,      // Punchy
      lowMids: -3,   // Aggressive mud cut
      mids: 0,       // Neutral
      presence: +1,  // Aggressive, present
      brilliance: +1,// Bright
      air: 0         // Neutral
    }
  },
  pop: {
    name: 'Pop Target',
    description: 'Vocal-focused with clarity priority',
    targets: {
      sub: 0,        // Balanced
      bass: 0,       // Balanced
      lowMids: -1,   // Slight cut
      mids: +1,      // Vocal focus
      presence: +2,  // Vocal clarity priority
      brilliance: 0, // Neutral
      air: +1        // Open
    }
  },
  kpop: {
    name: 'K-Pop Target',
    description: 'Hyper-clear vocals, heavy low end, crisp highs',
    targets: {
      sub: +1,       // Solid sub
      bass: +1,      // Impactful
      lowMids: -2,   // Cut for clarity
      mids: 0,       // Neutral
      presence: +2,  // Vocal clarity
      brilliance: +1,// Crisp
      air: +1        // Bright
    }
  }
};

// Musical tolerance rules - don't correct everything
export const TOLERANCE_RULES = {
  sub: { tolerance: 3, reason: 'Hardest to hear, more variance OK' },
  bass: { tolerance: 2, reason: 'Important but forgiving' },
  lowMids: { tolerance: 2, reason: 'Mud zone, cut if needed' },
  mids: { tolerance: 1.5, reason: 'Core body, moderate precision' },
  presence: { tolerance: 1, reason: 'Most audible, tightest tolerance' },
  brilliance: { tolerance: 1.5, reason: 'Harshness zone, careful' },
  air: { tolerance: 2, reason: 'Subtle, more variance OK' }
};

// Loudness standards by platform
export const LOUDNESS_STANDARDS = {
  spotify: { lufs: -14, ceiling: -1, unit: 'dBTP', note: 'Normalized down' },
  appleMusic: { lufs: -16, ceiling: -1, unit: 'dBTP', note: 'Sound Check on' },
  youtube: { lufs: -14, ceiling: -1, unit: 'dBTP', note: 'Normalized' },
  clubDjPool: { lufs: '-6 to -9', ceiling: -0.5, unit: 'dBTP', note: 'Hot for DJ systems' },
  beatport: { lufs: '-8 to -10', ceiling: -0.5, unit: 'dBTP', note: 'Dance music standard' },
  soundcloud: { lufs: '-10 to -14', ceiling: -1, unit: 'dBTP', note: 'Variable' }
};

// Club sound system frequency considerations
export const CLUB_FREQUENCY_GUIDE = {
  subBass: {
    range: '20-60Hz',
    consideration: 'MONO ONLY. Check on sub. Highpass everything else.'
  },
  bass: {
    range: '60-200Hz',
    consideration: 'Kick and bass must not clash. Use sidechain.'
  },
  lowMids: {
    range: '200-500Hz',
    consideration: 'Mud zone. Cut aggressively on most elements.'
  },
  mids: {
    range: '500-2kHz',
    consideration: 'Vocal presence. Synth body. Careful EQ.'
  },
  highMids: {
    range: '2-6kHz',
    consideration: 'Brightness, presence. Can be harsh on big systems.'
  },
  highs: {
    range: '6-20kHz',
    consideration: 'Air, shimmer. Rolls off naturally in clubs.'
  }
};

// Three-way translation test
export const TRANSLATION_TEST = {
  title: 'The Three-Way Test',
  tests: [
    { name: 'LOUD', question: 'Does it sound good LOUD?', issue: 'Harshness, imbalance' },
    { name: 'QUIET', question: 'Does it sound good QUIET?', issue: 'Thin bass, buried vocals' },
    { name: 'PHONE', question: 'Does it translate to PHONE speakers?', issue: 'Missing low end, no sub harmonics' }
  ]
};

// Calculate perceived energy at monitor level
export function calculatePerceivedEnergy(bandEnergies, monitorLevel) {
  const weights = interpolateWeights(monitorLevel);
  const result = {};

  Object.keys(bandEnergies).forEach(band => {
    result[band] = {
      measured: bandEnergies[band],
      weight: weights[band],
      perceived: bandEnergies[band] + weights[band]
    };
  });

  return result;
}

// Interpolate weights based on monitor level (0 = quiet, 0.5 = normal, 1 = loud)
export function interpolateWeights(monitorLevel) {
  const quiet = EQUAL_LOUDNESS_PROFILES.quiet.weights;
  const normal = EQUAL_LOUDNESS_PROFILES.normal.weights;
  const loud = EQUAL_LOUDNESS_PROFILES.loud.weights;

  const result = {};
  const t = monitorLevel;

  Object.keys(quiet).forEach(band => {
    if (t < 0.5) {
      // Interpolate between quiet and normal
      const factor = t * 2;
      result[band] = quiet[band] + (normal[band] - quiet[band]) * factor;
    } else {
      // Interpolate between normal and loud
      const factor = (t - 0.5) * 2;
      result[band] = normal[band] + (loud[band] - normal[band]) * factor;
    }
  });

  return result;
}

// Generate corrections based on perceived energy vs genre target
export function generateCorrections(perceivedEnergy, genreTarget, tolerances) {
  const corrections = [];

  Object.keys(perceivedEnergy).forEach(band => {
    const perceived = perceivedEnergy[band].perceived;
    const target = genreTarget[band] || 0;
    const tolerance = tolerances[band]?.tolerance || 2;
    const delta = perceived - target;

    if (Math.abs(delta) > tolerance) {
      // Suggested move is 60% of delta, max 3dB
      const suggestedMove = Math.min(Math.max(-delta * 0.6, -3), 3);

      corrections.push({
        band,
        delta: delta.toFixed(1),
        direction: delta > 0 ? 'too loud' : 'too quiet',
        suggestedMove: suggestedMove.toFixed(1),
        priority: Math.abs(delta) > tolerance * 2 ? 'high' : 'medium'
      });
    }
  });

  // Sort by priority and absolute delta
  corrections.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority === 'high' ? -1 : 1;
    return Math.abs(parseFloat(b.delta)) - Math.abs(parseFloat(a.delta));
  });

  return corrections;
}

// Calculate stem contributions to a band
export function calculateStemContributions(stemEnergies, band) {
  const totalEnergy = Object.values(stemEnergies).reduce((sum, stem) => {
    return sum + (stem[band] || 0);
  }, 0);

  if (totalEnergy === 0) return [];

  const contributions = Object.entries(stemEnergies).map(([name, energy]) => ({
    stem: name,
    energy: energy[band] || 0,
    percentage: ((energy[band] || 0) / totalEnergy * 100).toFixed(1)
  }));

  return contributions.sort((a, b) => b.energy - a.energy);
}

// Dual-level analysis (check at quiet and loud)
export function dualLevelAnalysis(bandEnergies, genreTarget) {
  const quietAnalysis = calculatePerceivedEnergy(bandEnergies, 0.1);
  const loudAnalysis = calculatePerceivedEnergy(bandEnergies, 0.9);

  const quietCorrections = generateCorrections(quietAnalysis, genreTarget, TOLERANCE_RULES);
  const loudCorrections = generateCorrections(loudAnalysis, genreTarget, TOLERANCE_RULES);

  // Volume shift analysis
  const shifts = {};
  Object.keys(bandEnergies).forEach(band => {
    shifts[band] = loudAnalysis[band].perceived - quietAnalysis[band].perceived;
  });

  return {
    quiet: {
      analysis: quietAnalysis,
      corrections: quietCorrections,
      issues: quietCorrections.filter(c => c.priority === 'high').map(c =>
        `${c.band} is ${c.direction} at low volume`
      )
    },
    loud: {
      analysis: loudAnalysis,
      corrections: loudCorrections,
      issues: loudCorrections.filter(c => c.priority === 'high').map(c =>
        `${c.band} is ${c.direction} at high volume`
      )
    },
    volumeShifts: shifts,
    translationIssues: Object.entries(shifts)
      .filter(([band, shift]) => Math.abs(shift) > 3)
      .map(([band, shift]) => ({
        band,
        shift: shift.toFixed(1),
        issue: shift > 0 ? 'Gets harsh when loud' : 'Gets thin when loud'
      }))
  };
}

// Masking score calculation
export function calculateMaskingScore(stem1Energy, stem2Energy, band) {
  const energy1 = stem1Energy[band] || 0;
  const energy2 = stem2Energy[band] || 0;

  // Calculate overlap as geometric mean of both energies
  const overlap = Math.sqrt(energy1 * energy2);
  const maxEnergy = Math.max(energy1, energy2);

  if (maxEnergy === 0) return 0;

  // Masking score: how much overlap relative to max
  return overlap / maxEnergy * 100;
}

// Get masking recommendations
export function getMaskingRecommendations(maskingScore, stem1Name, stem2Name) {
  if (maskingScore < 30) return null;

  const recommendations = [];

  if (maskingScore >= 70) {
    recommendations.push({
      severity: 'high',
      suggestion: `${stem1Name} and ${stem2Name} are fighting for the same space`,
      solutions: [
        'Use sidechain compression',
        'EQ carving - one cuts, other boosts',
        'Consider mid/side separation'
      ]
    });
  } else if (maskingScore >= 50) {
    recommendations.push({
      severity: 'medium',
      suggestion: `Moderate overlap between ${stem1Name} and ${stem2Name}`,
      solutions: [
        'Subtle EQ carving',
        'Light sidechain',
        'Pan separation'
      ]
    });
  } else {
    recommendations.push({
      severity: 'low',
      suggestion: `Minor overlap between ${stem1Name} and ${stem2Name}`,
      solutions: ['Monitor but may not need action']
    });
  }

  return recommendations;
}

// Transient score (crest factor analysis)
export function calculateTransientScore(peakLevel, rmsLevel) {
  // Crest factor = peak to RMS ratio in dB
  const crestFactor = peakLevel - rmsLevel;

  let assessment = '';
  let recommendations = [];

  if (crestFactor < 6) {
    assessment = 'Drums feel soft/squashed';
    recommendations = [
      'Use transient shaper to add attack',
      'Try parallel compression',
      'Reduce limiting on drum bus'
    ];
  } else if (crestFactor > 12) {
    assessment = 'Good punch, may need taming';
    recommendations = [
      'Good transient preservation',
      'May want to control peaks if too spiky'
    ];
  } else {
    assessment = 'Balanced transients';
    recommendations = ['Transients well controlled'];
  }

  return {
    crestFactor: crestFactor.toFixed(1),
    assessment,
    recommendations
  };
}

export default {
  FREQUENCY_BANDS,
  EQUAL_LOUDNESS_PROFILES,
  GENRE_TARGETS,
  TOLERANCE_RULES,
  LOUDNESS_STANDARDS,
  CLUB_FREQUENCY_GUIDE,
  TRANSLATION_TEST,
  calculatePerceivedEnergy,
  interpolateWeights,
  generateCorrections,
  dualLevelAnalysis
};
