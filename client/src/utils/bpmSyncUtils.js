/**
 * @module bpmSyncUtils
 * @description BPM-Synced Effect Calculations
 *
 * Provides calculations for:
 * - Delay time (straight, dotted, triplet)
 * - Reverb pre-delay and decay time
 * - Panning recommendations by instrument
 * - Clock notation conversion (L13 = 11 o'clock)
 */

// ============================================
// NOTE VALUE CONSTANTS
// ============================================

export const NOTE_VALUES = {
  '1/1': { multiplier: 4.0, name: 'Whole Note' },
  '1/2': { multiplier: 2.0, name: 'Half Note' },
  '1/4': { multiplier: 1.0, name: 'Quarter Note' },
  '1/8': { multiplier: 0.5, name: 'Eighth Note' },
  '1/16': { multiplier: 0.25, name: 'Sixteenth Note' },
  '1/32': { multiplier: 0.125, name: 'Thirty-Second Note' },
  '1/64': { multiplier: 0.0625, name: 'Sixty-Fourth Note' }
};

export const NOTE_MODIFIERS = {
  straight: { multiplier: 1.0, name: 'Straight' },
  dotted: { multiplier: 1.5, name: 'Dotted' },
  triplet: { multiplier: 0.667, name: 'Triplet' }
};

// ============================================
// DELAY CALCULATIONS
// ============================================

/**
 * Calculate delay time in milliseconds
 * @param {number} bpm - Tempo in BPM
 * @param {string} noteValue - Note value (e.g., '1/4', '1/8')
 * @param {string} modifier - Note modifier ('straight', 'dotted', 'triplet')
 * @returns {number} Delay time in milliseconds
 */
export function calculateDelayTime(bpm, noteValue = '1/4', modifier = 'straight') {
  if (bpm <= 0) return 0;

  const quarterNoteMs = 60000 / bpm;
  const noteMultiplier = NOTE_VALUES[noteValue]?.multiplier || 1.0;
  const modMultiplier = NOTE_MODIFIERS[modifier]?.multiplier || 1.0;

  return Math.round(quarterNoteMs * noteMultiplier * modMultiplier * 10) / 10;
}

/**
 * Generate full delay time table for a given BPM
 * @param {number} bpm - Tempo in BPM
 * @returns {Object[]} Array of delay times for all note values
 */
export function generateDelayTable(bpm) {
  const noteValues = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];
  const modifiers = ['straight', 'dotted', 'triplet'];

  const table = [];

  noteValues.forEach(note => {
    const row = {
      noteValue: note,
      noteName: NOTE_VALUES[note].name,
      times: {}
    };

    modifiers.forEach(mod => {
      row.times[mod] = calculateDelayTime(bpm, note, mod);
    });

    table.push(row);
  });

  return table;
}

/**
 * Get recommended delay times for different use cases
 * @param {number} bpm - Tempo in BPM
 * @returns {Object} Recommended delay settings by use case
 */
export function getDelayRecommendations(bpm) {
  return {
    vocalDoubling: {
      delay: calculateDelayTime(bpm, '1/32', 'straight'),
      note: '1/32 straight - Subtle thickening effect',
      feedback: '0-10%',
      mix: '15-25%'
    },
    slapback: {
      delay: calculateDelayTime(bpm, '1/16', 'straight'),
      note: '1/16 straight - Classic slapback delay',
      feedback: '0-15%',
      mix: '20-30%'
    },
    rhythmicDelay: {
      delay: calculateDelayTime(bpm, '1/8', 'dotted'),
      note: '1/8 dotted - Creates rhythmic interest',
      feedback: '30-50%',
      mix: '20-35%'
    },
    ambientDelay: {
      delay: calculateDelayTime(bpm, '1/4', 'straight'),
      note: '1/4 straight - Spacious ambient delay',
      feedback: '40-60%',
      mix: '15-25%'
    },
    pingPong: {
      delay: calculateDelayTime(bpm, '1/8', 'straight'),
      note: '1/8 straight - Stereo ping-pong effect',
      feedback: '30-50%',
      mix: '25-40%'
    },
    dub: {
      delay: calculateDelayTime(bpm, '1/4', 'triplet'),
      note: '1/4 triplet - Classic dub delay',
      feedback: '60-80%',
      mix: '30-50%'
    }
  };
}

// ============================================
// REVERB CALCULATIONS
// ============================================

/**
 * Calculate reverb pre-delay in milliseconds
 * @param {number} bpm - Tempo in BPM
 * @param {string} noteValue - Note value for pre-delay
 * @returns {number} Pre-delay in milliseconds
 */
export function calculatePreDelay(bpm, noteValue = '1/32') {
  return calculateDelayTime(bpm, noteValue, 'straight');
}

/**
 * Get reverb recommendations for different elements
 * @param {number} bpm - Tempo in BPM
 * @returns {Object} Reverb settings by element type
 */
export function getReverbRecommendations(bpm) {
  const quarterNoteMs = 60000 / bpm;

  return {
    vocals: {
      preDelay: calculatePreDelay(bpm, '1/32'),
      preDelayNote: '1/32 - Keeps vocal upfront',
      decayTime: '1.2-2.0s',
      size: 'medium-large',
      mix: '15-25%',
      highCut: '8000Hz',
      lowCut: '200Hz',
      note: 'Plate or hall reverb, keep pre-delay short for presence'
    },
    snare: {
      preDelay: calculatePreDelay(bpm, '1/16'),
      preDelayNote: '1/16 - Adds depth without muddiness',
      decayTime: '0.8-1.5s',
      size: 'medium',
      mix: '20-35%',
      highCut: '6000Hz',
      lowCut: '300Hz',
      note: 'Plate reverb classic for snare, adjust decay to tempo'
    },
    drums: {
      preDelay: calculatePreDelay(bpm, '1/64'),
      preDelayNote: '1/64 - Tight room sound',
      decayTime: '0.3-0.8s',
      size: 'small-medium',
      mix: '10-20%',
      highCut: '8000Hz',
      lowCut: '150Hz',
      note: 'Room reverb for cohesion, keep it tight'
    },
    synths: {
      preDelay: calculatePreDelay(bpm, '1/8'),
      preDelayNote: '1/8 - Creates space around sound',
      decayTime: '1.5-3.0s',
      size: 'large',
      mix: '20-40%',
      highCut: '10000Hz',
      lowCut: '150Hz',
      note: 'Hall or plate, longer decay for ambient pads'
    },
    guitar: {
      preDelay: calculatePreDelay(bpm, '1/16'),
      preDelayNote: '1/16 - Natural room sound',
      decayTime: '0.8-1.8s',
      size: 'medium',
      mix: '15-30%',
      highCut: '7000Hz',
      lowCut: '200Hz',
      note: 'Plate or spring reverb depending on style'
    },
    fullMix: {
      preDelay: calculatePreDelay(bpm, '1/16'),
      preDelayNote: '1/16 - Glues the mix together',
      decayTime: Math.round(quarterNoteMs * 2) / 1000 + 's (half note)',
      size: 'large',
      mix: '5-15%',
      highCut: '8000Hz',
      lowCut: '250Hz',
      note: 'Light hall reverb on master bus for cohesion'
    }
  };
}

/**
 * Calculate tempo-synced decay time
 * @param {number} bpm - Tempo in BPM
 * @param {number} beats - Number of beats for decay
 * @returns {number} Decay time in seconds
 */
export function calculateDecayTime(bpm, beats = 2) {
  const beatMs = 60000 / bpm;
  return Math.round((beatMs * beats) / 100) / 10; // Round to 0.1s
}

// ============================================
// PANNING UTILITIES
// ============================================

/**
 * Panning scale definitions
 */
export const PANNING_SCALE = {
  center: 0,
  slightLeft: -15,
  slightRight: 15,
  moderateLeft: -35,
  moderateRight: 35,
  wideLeft: -65,
  wideRight: 65,
  hardLeft: -100,
  hardRight: 100
};

/**
 * Convert pan position to clock notation
 * @param {number} panValue - Pan value (-100 to 100)
 * @returns {string} Clock notation (e.g., "11h" for L15)
 */
export function panToClock(panValue) {
  // 12h = center (0)
  // 9h = hard left (-100)
  // 3h = hard right (100)
  // Each 33.33 units = 1 hour

  const normalized = Math.max(-100, Math.min(100, panValue));
  const hours = 12 + (normalized / 33.33);

  if (hours < 9) return '9h (hard L)';
  if (hours > 15) return '3h (hard R)';

  // Format as clock position
  const hourValue = Math.round(hours);
  return `${hourValue}h`;
}

/**
 * Convert pan position to L/R notation
 * @param {number} panValue - Pan value (-100 to 100)
 * @returns {string} L/R notation (e.g., "L35" or "R50")
 */
export function panToLR(panValue) {
  const normalized = Math.round(Math.max(-100, Math.min(100, panValue)));

  if (normalized === 0) return 'Center';
  if (normalized < 0) return `L${Math.abs(normalized)}`;
  return `R${normalized}`;
}

/**
 * Get comprehensive panning recommendations by instrument
 * @returns {Object} Panning recommendations
 */
export function getPanningRecommendations() {
  return {
    // Always centered
    kick: {
      recommended: 0,
      range: [-5, 5],
      clock: '12h',
      lr: 'Center',
      reason: 'Kick provides foundation, must be centered for power'
    },
    bass: {
      recommended: 0,
      range: [-10, 10],
      clock: '12h',
      lr: 'Center',
      reason: 'Bass provides low-end foundation, centered for mono compatibility'
    },
    leadVocal: {
      recommended: 0,
      range: [-5, 5],
      clock: '12h',
      lr: 'Center',
      reason: 'Lead vocal is the focal point, must be centered'
    },
    snareCenter: {
      recommended: 0,
      range: [-10, 10],
      clock: '12h',
      lr: 'Center',
      reason: 'Snare typically centered, provides punch'
    },

    // Slight panning
    hiHat: {
      recommended: 25,
      range: [15, 40],
      clock: '1h',
      lr: 'R25',
      reason: "From drummer's perspective, hi-hat slightly right"
    },
    ride: {
      recommended: -20,
      range: [-30, -10],
      clock: '11h',
      lr: 'L20',
      reason: "From drummer's perspective, ride slightly left"
    },

    // Moderate panning
    acousticGuitarL: {
      recommended: -45,
      range: [-60, -30],
      clock: '10h',
      lr: 'L45',
      reason: 'Create stereo width, leave room for other elements'
    },
    acousticGuitarR: {
      recommended: 45,
      range: [30, 60],
      clock: '2h',
      lr: 'R45',
      reason: 'Mirror position for stereo balance'
    },
    keys: {
      recommended: -30,
      range: [-50, -20],
      clock: '11h',
      lr: 'L30',
      reason: 'Provide harmonic support without cluttering center'
    },
    backingVocals: {
      recommended: { L: -50, R: 50 },
      range: [-70, 70],
      clock: '10h/2h',
      lr: 'L50/R50',
      reason: 'Wide backing vocals frame the lead vocal'
    },

    // Wide panning
    electricGuitarL: {
      recommended: -80,
      range: [-100, -60],
      clock: '9h',
      lr: 'L80',
      reason: 'Wide guitars for wall of sound'
    },
    electricGuitarR: {
      recommended: 80,
      range: [60, 100],
      clock: '3h',
      lr: 'R80',
      reason: 'Mirror position for stereo power'
    },
    pads: {
      recommended: { L: -60, R: 60 },
      range: [-100, 100],
      clock: '10h/2h',
      lr: 'L60/R60 (stereo)',
      reason: 'Wide pads fill the stereo field'
    },
    percussion: {
      recommended: { L: -55, R: 55 },
      range: [-80, 80],
      clock: 'Various',
      lr: 'Various',
      reason: 'Spread percussion across field for interest'
    },
    tom1: {
      recommended: -40,
      range: [-60, -25],
      clock: '10h',
      lr: 'L40',
      reason: 'High tom left from audience perspective'
    },
    tom2: {
      recommended: 0,
      range: [-15, 15],
      clock: '12h',
      lr: 'Center',
      reason: 'Mid tom centered'
    },
    tom3: {
      recommended: 40,
      range: [25, 60],
      clock: '2h',
      lr: 'R40',
      reason: 'Floor tom right from audience perspective'
    },
    overheadsL: {
      recommended: -100,
      range: [-100, -80],
      clock: '9h',
      lr: 'L100',
      reason: 'Hard panned for natural drum kit width'
    },
    overheadsR: {
      recommended: 100,
      range: [80, 100],
      clock: '3h',
      lr: 'R100',
      reason: 'Hard panned for natural drum kit width'
    },

    // Special elements
    fxSweeps: {
      recommended: { L: -100, R: 100 },
      range: [-100, 100],
      clock: '9h-3h',
      lr: 'Various/Moving',
      reason: 'FX can move across stereo field for interest'
    },
    strings: {
      recommended: { violins: -40, violas: -10, cellos: 30, basses: 60 },
      range: [-80, 80],
      clock: 'Various',
      lr: 'Orchestra layout',
      reason: 'Traditional orchestra seating arrangement'
    }
  };
}

/**
 * Analyze stereo placement and suggest improvements
 * @param {Object[]} elements - Array of {name, currentPan} objects
 * @returns {Object[]} Recommendations for each element
 */
export function analyzeStereoPlacement(elements) {
  const recommendations = getPanningRecommendations();
  const results = [];

  elements.forEach(element => {
    const key = element.name.toLowerCase().replace(/\s+/g, '');
    const rec = recommendations[key];

    if (rec) {
      const currentPan = element.currentPan || 0;
      const recommendedPan = typeof rec.recommended === 'number'
        ? rec.recommended
        : (rec.recommended.L + rec.recommended.R) / 2;

      const difference = Math.abs(currentPan - recommendedPan);

      results.push({
        element: element.name,
        currentPan,
        currentNotation: panToLR(currentPan),
        currentClock: panToClock(currentPan),
        recommendedPan,
        recommendedNotation: panToLR(recommendedPan),
        recommendedClock: panToClock(recommendedPan),
        difference,
        status: difference < 15 ? 'good' : difference < 30 ? 'adjust' : 'review',
        reason: rec.reason
      });
    }
  });

  return results;
}

// ============================================
// COMBINED EFFECTS PANEL DATA
// ============================================

/**
 * Get all BPM-synced effect recommendations
 * @param {number} bpm - Tempo in BPM
 * @returns {Object} Complete effects recommendations
 */
export function getBPMSyncedEffects(bpm) {
  return {
    bpm,
    quarterNoteMs: Math.round(60000 / bpm),
    delay: {
      table: generateDelayTable(bpm),
      recommendations: getDelayRecommendations(bpm)
    },
    reverb: {
      recommendations: getReverbRecommendations(bpm),
      decayTimes: {
        oneBar: calculateDecayTime(bpm, 4) + 's',
        twoBeats: calculateDecayTime(bpm, 2) + 's',
        oneBeat: calculateDecayTime(bpm, 1) + 's',
        halfBeat: calculateDecayTime(bpm, 0.5) + 's'
      }
    },
    panning: getPanningRecommendations()
  };
}

/**
 * Format milliseconds for display
 * @param {number} ms - Milliseconds
 * @returns {string} Formatted string
 */
export function formatMs(ms) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Get the closest musical note value for a given delay time
 * @param {number} bpm - Tempo in BPM
 * @param {number} delayMs - Delay time in milliseconds
 * @returns {Object} Closest note value with deviation
 */
export function findClosestNoteValue(bpm, delayMs) {
  const noteValues = ['1/1', '1/2', '1/4', '1/8', '1/16', '1/32'];
  const modifiers = ['straight', 'dotted', 'triplet'];

  let closest = null;
  let smallestDiff = Infinity;

  noteValues.forEach(note => {
    modifiers.forEach(mod => {
      const calcMs = calculateDelayTime(bpm, note, mod);
      const diff = Math.abs(calcMs - delayMs);

      if (diff < smallestDiff) {
        smallestDiff = diff;
        closest = {
          noteValue: note,
          modifier: mod,
          calculatedMs: calcMs,
          deviationMs: delayMs - calcMs,
          deviationPercent: ((delayMs - calcMs) / calcMs) * 100
        };
      }
    });
  });

  return closest;
}
