/**
 * User Preferences & Personal Knowledge Base
 *
 * Self-learning system that remembers user favorites and provides
 * BPM-synced calculations for effects, instruments, and dial-in configs.
 */

// ============================================
// BPM-SYNCED CALCULATIONS
// ============================================

/**
 * Calculate delay/reverb times synced to BPM
 * @param {number} bpm - Beats per minute
 * @returns {object} All timing values in milliseconds
 */
export function calculateBPMSync(bpm) {
  const beatMs = 60000 / bpm;  // Duration of 1 beat in ms

  return {
    bpm,

    // Note values
    whole: beatMs * 4,
    half: beatMs * 2,
    quarter: beatMs,
    eighth: beatMs / 2,
    sixteenth: beatMs / 4,
    thirtySecond: beatMs / 8,

    // Dotted values (1.5x)
    dottedHalf: beatMs * 3,
    dottedQuarter: beatMs * 1.5,
    dottedEighth: beatMs * 0.75,
    dottedSixteenth: beatMs * 0.375,

    // Triplet values (2/3x)
    tripletHalf: (beatMs * 2) * (2/3),
    tripletQuarter: beatMs * (2/3),
    tripletEighth: (beatMs / 2) * (2/3),
    tripletSixteenth: (beatMs / 4) * (2/3),

    // Common delay presets
    delays: {
      slap: beatMs / 8,           // 1/32 - tight slap
      short: beatMs / 4,          // 1/16 - short delay
      groove: beatMs / 2,         // 1/8 - rhythmic
      musical: beatMs,            // 1/4 - musical delay
      long: beatMs * 2,           // 1/2 - long throw
      dottedEighth: beatMs * 0.75 // Dotted 1/8 - U2 style
    },

    // Reverb pre-delay suggestions
    preDelay: {
      tight: beatMs / 16,         // Tight, upfront
      natural: beatMs / 8,        // Natural space
      spacious: beatMs / 4,       // Pushed back
      huge: beatMs / 2            // Large hall feel
    },

    // Reverb decay suggestions (based on tempo)
    reverbDecay: {
      tight: beatMs * 0.5,        // Half beat
      short: beatMs,              // 1 beat
      medium: beatMs * 2,         // 2 beats
      long: beatMs * 4,           // 1 bar
      huge: beatMs * 8            // 2 bars
    },

    // Compressor timing suggestions
    compressor: {
      attack: {
        fast: 0.5,                // Catch transients
        medium: beatMs / 32,      // Musical attack
        slow: beatMs / 16         // Let transients through
      },
      release: {
        fast: beatMs / 8,         // 1/32 note
        musical: beatMs / 4,      // 1/16 note - groove
        slow: beatMs / 2          // 1/8 note
      }
    },

    // LFO rates for modulation
    lfo: {
      slow: bpm / 8,              // Very slow movement
      quarter: bpm / 4,           // Slow pulse
      half: bpm / 2,              // Moderate
      sync: bpm,                  // Beat sync
      double: bpm * 2,            // Fast
      quad: bpm * 4               // Very fast
    }
  };
}

/**
 * Format milliseconds to readable string
 */
export function formatMs(ms) {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  return `${Math.round(ms)}ms`;
}

// ============================================
// DEFAULT INSTRUMENT PRESETS
// ============================================

export const DEFAULT_INSTRUMENT_PRESETS = {
  // KEYBOARDS
  'm1_piano': {
    name: 'Korg M1 Piano',
    category: 'keys',
    description: 'Classic 80s/90s house piano',
    settings: {
      attack: 0,
      decay: 0.3,
      sustain: 0.7,
      release: 0.4,
      brightness: 70,
      velocity_curve: 'linear'
    },
    mixSettings: {
      eq: {
        lowCut: 80,
        lowShelf: { freq: 200, gain: -2 },
        mid: { freq: 1000, gain: 2, q: 1.5 },
        highShelf: { freq: 8000, gain: 3 }
      },
      compression: {
        threshold: -12,
        ratio: 3,
        attack: 10,
        release: 'auto',  // Will be calculated from BPM
        makeup: 3
      },
      reverb: {
        type: 'plate',
        preDelay: 'natural',  // Will be calculated from BPM
        decay: 'medium',      // Will be calculated from BPM
        mix: 25
      },
      delay: {
        time: 'dottedEighth', // Will be calculated from BPM
        feedback: 25,
        mix: 15,
        pingPong: true
      }
    },
    tips: [
      'Layer with sub bass for fullness',
      'Use sidechain compression from kick',
      'Automate filter for builds',
      'Double with detuned layer for width'
    ]
  },

  'rhodes': {
    name: 'Rhodes Electric Piano',
    category: 'keys',
    description: 'Warm electric piano',
    settings: {
      tine_level: 60,
      bark: 40,
      tremolo_rate: 'quarter', // BPM synced
      tremolo_depth: 30
    },
    mixSettings: {
      eq: {
        lowCut: 60,
        lowShelf: { freq: 150, gain: 2 },
        mid: { freq: 800, gain: -2, q: 2 },
        presence: { freq: 3000, gain: 3, q: 1 }
      },
      compression: {
        threshold: -15,
        ratio: 2.5,
        attack: 15,
        release: 'musical'
      },
      chorus: {
        rate: 0.5,
        depth: 30,
        mix: 20
      }
    }
  },

  // SYNTHS
  'supersaw': {
    name: 'Supersaw Lead',
    category: 'synth',
    description: 'Massive detuned saw stack',
    settings: {
      voices: 7,
      detune: 25,
      unison_width: 80,
      filter_cutoff: 8000,
      filter_resonance: 20
    },
    mixSettings: {
      eq: {
        lowCut: 150,
        mid: { freq: 500, gain: -3, q: 1 },
        presence: { freq: 4000, gain: 2, q: 0.7 }
      },
      compression: {
        threshold: -8,
        ratio: 4,
        attack: 5,
        release: 'fast'
      },
      reverb: {
        type: 'hall',
        decay: 'long',
        mix: 30
      },
      delay: {
        time: 'eighth',
        feedback: 20,
        mix: 10
      }
    }
  },

  // BASS
  '808_bass': {
    name: '808 Sub Bass',
    category: 'bass',
    description: 'Classic 808 with sustain',
    settings: {
      pitch_decay: 50,
      tone: 40,
      saturation: 30,
      sustain: 0.8
    },
    mixSettings: {
      eq: {
        lowCut: 25,
        sub: { freq: 50, gain: 3 },
        lowMid: { freq: 200, gain: -4, q: 2 },
        highCut: 5000
      },
      compression: {
        threshold: -6,
        ratio: 4,
        attack: 30,
        release: 'slow'
      },
      saturation: {
        drive: 20,
        mix: 30
      }
    },
    tips: [
      'Keep mono below 150Hz',
      'Sidechain from kick (10-20ms attack)',
      'Layer with short 808 for attack',
      'Pitch slides for trap feel'
    ]
  },

  // DRUMS
  'acoustic_kit': {
    name: 'Acoustic Drum Kit',
    category: 'drums',
    description: 'Natural acoustic drums',
    settings: {
      room_amount: 40,
      overhead_blend: 50,
      close_mic_attack: 60
    },
    mixSettings: {
      kick: {
        eq: { lowBoost: { freq: 60, gain: 3 }, scoop: { freq: 400, gain: -4 }, click: { freq: 4000, gain: 2 } },
        compression: { threshold: -10, ratio: 4, attack: 10, release: 'fast' }
      },
      snare: {
        eq: { body: { freq: 200, gain: 2 }, crack: { freq: 3500, gain: 3 } },
        compression: { threshold: -8, ratio: 4, attack: 5, release: 'musical' }
      },
      overheads: {
        eq: { lowCut: 300, air: { freq: 12000, gain: 2 } },
        compression: { threshold: -12, ratio: 2, attack: 30, release: 'slow' }
      }
    }
  },

  // VOCALS
  'lead_vocal': {
    name: 'Lead Vocal',
    category: 'vocals',
    description: 'Modern pop/R&B vocal chain',
    settings: {},
    mixSettings: {
      eq: {
        lowCut: 80,
        lowMid: { freq: 250, gain: -3, q: 2 },
        presence: { freq: 3000, gain: 2, q: 1 },
        air: { freq: 12000, gain: 3 }
      },
      compression: {
        threshold: -18,
        ratio: 4,
        attack: 5,
        release: 'musical',
        makeup: 4
      },
      deEsser: {
        freq: 6000,
        threshold: -20,
        reduction: 6
      },
      reverb: {
        type: 'plate',
        preDelay: 'natural',
        decay: 'short',
        mix: 15
      },
      delay: {
        time: 'quarter',
        feedback: 15,
        mix: 10,
        highCut: 5000
      }
    }
  },

  // ============================================
  // SERUM PRESETS
  // ============================================

  'serum_bass': {
    name: 'Serum Bass',
    category: 'bass',
    description: 'Modern wavetable bass',
    plugin: 'Serum',
    settings: {
      osc_a: { wavetable: 'Basic Shapes', position: 128, level: 100 },
      osc_b: { wavetable: 'Analog_BD_Sin', position: 0, level: 80 },
      sub: { level: -6, octave: -1 },
      filter: { type: 'MG Low 24', cutoff: 200, resonance: 15, drive: 20 },
      env_filter: { attack: 0, decay: 150, sustain: 30, amount: 50 },
      unison: { voices: 3, detune: 0.15, blend: 0 }
    },
    mixSettings: {
      eq: {
        lowCut: 30,
        sub: { freq: 60, gain: 2 },
        lowMid: { freq: 300, gain: -3, q: 2 },
        highCut: 8000
      },
      compression: { threshold: -8, ratio: 4, attack: 20, release: 'slow' },
      saturation: { drive: 25, mix: 40, type: 'tube' }
    },
    tips: [
      'Use WT position automation for movement',
      'Layer sub oscillator for low end weight',
      'Multiband compress for consistent level',
      'Sidechain to kick with fast attack'
    ]
  },

  'serum_supersaw': {
    name: 'Serum Supersaw',
    category: 'synth',
    description: 'Massive unison lead',
    plugin: 'Serum',
    settings: {
      osc_a: { wavetable: 'Basic Shapes', position: 127, level: 100 },
      unison: { voices: 7, detune: 0.25, blend: 50, mode: 'Super' },
      filter: { type: 'MG Low 12', cutoff: 4000, resonance: 10 },
      env_amp: { attack: 5, decay: 500, sustain: 80, release: 300 },
      fx: { dimension: 30, hyper: 50 }
    },
    mixSettings: {
      eq: {
        lowCut: 120,
        scoop: { freq: 400, gain: -2, q: 1 },
        presence: { freq: 3500, gain: 3, q: 0.8 },
        air: { freq: 12000, gain: 2 }
      },
      compression: { threshold: -10, ratio: 3, attack: 10, release: 'fast' },
      reverb: { type: 'hall', decay: 'long', mix: 35, preDelay: 'spacious' },
      delay: { time: 'dottedEighth', feedback: 25, mix: 15 }
    },
    tips: [
      'Automate filter cutoff for builds',
      'Use Hyper/Dimension for width',
      'Layer with sub for drops',
      'Sidechain to kick for pumping'
    ]
  },

  'serum_pluck': {
    name: 'Serum Pluck',
    category: 'synth',
    description: 'Short percussive synth',
    plugin: 'Serum',
    settings: {
      osc_a: { wavetable: 'Basic Shapes', position: 64, level: 100 },
      osc_b: { wavetable: 'Analog_Saw_Bri', position: 0, level: 70 },
      filter: { type: 'MG Low 18', cutoff: 6000, resonance: 20, keytrack: 50 },
      env_amp: { attack: 0, decay: 200, sustain: 0, release: 150 },
      env_filter: { attack: 0, decay: 150, sustain: 0, amount: 60 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        mid: { freq: 800, gain: 2, q: 1.5 },
        presence: { freq: 5000, gain: 3, q: 0.7 }
      },
      compression: { threshold: -12, ratio: 3, attack: 5, release: 'fast' },
      reverb: { type: 'plate', decay: 'medium', mix: 30 },
      delay: { time: 'sixteenth', feedback: 30, mix: 20 }
    },
    tips: [
      'Short decay for rhythmic patterns',
      'Longer decay for melodic lines',
      'Add reverb for depth',
      'Sequence 16th note patterns'
    ]
  },

  'serum_pad': {
    name: 'Serum Pad',
    category: 'synth',
    description: 'Lush atmospheric pad',
    plugin: 'Serum',
    settings: {
      osc_a: { wavetable: 'Analog_SawRound', position: 40, level: 80 },
      osc_b: { wavetable: 'Digital_One', position: 100, level: 60 },
      unison: { voices: 4, detune: 0.20, blend: 70 },
      filter: { type: 'MG Low 12', cutoff: 2000, resonance: 5 },
      env_amp: { attack: 800, decay: 2000, sustain: 70, release: 1500 },
      lfo_1: { rate: 'quarter', amount: 15, destination: 'filter_cutoff' }
    },
    mixSettings: {
      eq: {
        lowCut: 150,
        lowMid: { freq: 300, gain: -3, q: 1 },
        highShelf: { freq: 8000, gain: 2 }
      },
      compression: { threshold: -15, ratio: 2, attack: 50, release: 'slow' },
      reverb: { type: 'hall', decay: 'huge', mix: 50, preDelay: 'spacious' },
      chorus: { rate: 0.3, depth: 40, mix: 25 }
    },
    tips: [
      'Long attack for swells',
      'LFO on filter for movement',
      'Layer multiple pads at different octaves',
      'Use reverb generously'
    ]
  },

  'serum_growl': {
    name: 'Serum Growl Bass',
    category: 'bass',
    description: 'Aggressive dubstep bass',
    plugin: 'Serum',
    settings: {
      osc_a: { wavetable: 'Monster_1', position: 128, level: 100 },
      osc_b: { wavetable: 'Wobble', position: 64, level: 80 },
      filter: { type: 'MG Low 24', cutoff: 800, resonance: 40, drive: 50 },
      lfo_1: { rate: 'eighth', amount: 80, destination: 'filter_cutoff', shape: 'saw_down' },
      env_filter: { attack: 0, decay: 100, sustain: 50, amount: 40 },
      fx: { distortion: 40, multiband: 60 }
    },
    mixSettings: {
      eq: {
        lowCut: 35,
        sub: { freq: 55, gain: 3 },
        mid: { freq: 600, gain: 4, q: 2 },
        highCut: 12000
      },
      compression: { threshold: -6, ratio: 6, attack: 5, release: 'fast' },
      saturation: { drive: 50, mix: 60, type: 'hard' },
      multiband: { low: -2, mid: 3, high: 0 }
    },
    tips: [
      'Automate LFO rate for variety',
      'Use resampling for complexity',
      'Layer with clean sub',
      'Multiband compress heavily'
    ]
  },

  // ============================================
  // MASSIVE PRESETS
  // ============================================

  'massive_bass': {
    name: 'Massive Bass',
    category: 'bass',
    description: 'Classic Massive reese bass',
    plugin: 'Massive',
    settings: {
      osc_1: { wavetable: 'Rough Math I', position: 50, level: 100 },
      osc_2: { wavetable: 'Rough Math I', position: 60, level: 80, pitch: -12 },
      filter_1: { type: 'Lowpass 4', cutoff: 400, resonance: 30 },
      modulation: { lfo_rate: 'half', lfo_amount: 40, destination: 'osc_position' },
      voicing: { unison: 2, pitch_spread: 0.10 }
    },
    mixSettings: {
      eq: {
        lowCut: 30,
        sub: { freq: 50, gain: 2 },
        lowMid: { freq: 250, gain: -4, q: 2 },
        mid: { freq: 700, gain: 3, q: 1.5 }
      },
      compression: { threshold: -10, ratio: 4, attack: 15, release: 'slow' },
      saturation: { drive: 30, mix: 40 }
    },
    tips: [
      'Modulate wavetable position for movement',
      'Use performer for complex automation',
      'Layer with sine sub',
      'Parallel distortion for grit'
    ]
  },

  'massive_lead': {
    name: 'Massive Lead',
    category: 'synth',
    description: 'Cutting lead synth',
    plugin: 'Massive',
    settings: {
      osc_1: { wavetable: 'Sqr-Sw I', position: 80, level: 100 },
      osc_2: { wavetable: 'Chrome', position: 50, level: 60, pitch: 7 },
      filter_1: { type: 'Lowpass 2', cutoff: 6000, resonance: 20 },
      voicing: { unison: 4, pitch_spread: 0.15, pan_spread: 80 },
      env_amp: { attack: 5, decay: 300, sustain: 70, release: 200 }
    },
    mixSettings: {
      eq: {
        lowCut: 150,
        presence: { freq: 3000, gain: 4, q: 1 },
        air: { freq: 10000, gain: 2 }
      },
      compression: { threshold: -12, ratio: 3, attack: 8, release: 'musical' },
      delay: { time: 'dottedEighth', feedback: 30, mix: 20 },
      reverb: { type: 'plate', decay: 'medium', mix: 25 }
    },
    tips: [
      'Use 5th interval on OSC2 for power',
      'Automate filter for expression',
      'Add pitch bend for leads',
      'Layer octaves for hooks'
    ]
  },

  'massive_wobble': {
    name: 'Massive Wobble',
    category: 'bass',
    description: 'Classic dubstep wobble',
    plugin: 'Massive',
    settings: {
      osc_1: { wavetable: 'Screamer', position: 64, level: 100 },
      osc_2: { wavetable: 'Crusher', position: 30, level: 70 },
      filter_1: { type: 'Lowpass 4', cutoff: 200, resonance: 50 },
      lfo_5: { rate: 'eighth', sync: true, amount: 100, destination: 'filter_cutoff' },
      insert_1: { type: 'Classic Tube', drive: 40 }
    },
    mixSettings: {
      eq: {
        lowCut: 35,
        sub: { freq: 55, gain: 3 },
        scoop: { freq: 400, gain: -3, q: 1.5 },
        presence: { freq: 2000, gain: 4, q: 1 }
      },
      compression: { threshold: -8, ratio: 5, attack: 5, release: 'fast' },
      saturation: { drive: 40, mix: 50 }
    },
    tips: [
      'Change LFO rate for half-time/double-time',
      'Use stepper for rhythmic patterns',
      'Automate LFO rate in drops',
      'Layer with clean sub sine'
    ]
  },

  'massive_pluck': {
    name: 'Massive Pluck',
    category: 'synth',
    description: 'Punchy pluck synth',
    plugin: 'Massive',
    settings: {
      osc_1: { wavetable: 'Sqr-Sw II', position: 100, level: 100 },
      filter_1: { type: 'Lowpass 2', cutoff: 8000, resonance: 25 },
      env_1: { attack: 0, decay: 120, sustain: 0, level: 80 },
      env_amp: { attack: 0, decay: 180, sustain: 0, release: 100 },
      voicing: { unison: 2, pitch_spread: 0.08 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        mid: { freq: 1000, gain: 2, q: 1 },
        presence: { freq: 4000, gain: 3, q: 0.8 }
      },
      compression: { threshold: -10, ratio: 3, attack: 3, release: 'fast' },
      delay: { time: 'eighth', feedback: 35, mix: 25, pingPong: true },
      reverb: { type: 'room', decay: 'short', mix: 20 }
    },
    tips: [
      'Short decay for arps',
      'Sequence 16th note patterns',
      'Use velocity to decay amount',
      'Add ping pong delay for width'
    ]
  },

  // ============================================
  // SYLENTH1 PRESETS
  // ============================================

  'sylenth_lead': {
    name: 'Sylenth1 Lead',
    category: 'synth',
    description: 'Classic trance lead',
    plugin: 'Sylenth1',
    settings: {
      osc_a1: { wave: 'Saw', voices: 4, detune: 3.50, phase: 'free' },
      osc_a2: { wave: 'Saw', voices: 4, detune: 3.50, octave: 1 },
      filter_a: { type: 'Lowpass', cutoff: 7.5, resonance: 4, keytrack: 64 },
      env_amp: { attack: 0, decay: 5.0, sustain: 8.0, release: 4.0 },
      env_filter: { attack: 0, decay: 4.0, sustain: 0, amount: 3.0 }
    },
    mixSettings: {
      eq: {
        lowCut: 120,
        scoop: { freq: 350, gain: -2, q: 1 },
        presence: { freq: 3500, gain: 4, q: 0.7 },
        air: { freq: 12000, gain: 2 }
      },
      compression: { threshold: -10, ratio: 3, attack: 8, release: 'fast' },
      reverb: { type: 'hall', decay: 'long', mix: 35, preDelay: 'natural' },
      delay: { time: 'dottedEighth', feedback: 25, mix: 15 }
    },
    tips: [
      'Classic trance sound with 8 voices',
      'Automate cutoff for builds',
      'Layer with supersaws for drops',
      'Use portamento for lead lines'
    ]
  },

  'sylenth_supersaw': {
    name: 'Sylenth1 Supersaw',
    category: 'synth',
    description: 'EDM supersaw stack',
    plugin: 'Sylenth1',
    settings: {
      osc_a1: { wave: 'Saw', voices: 8, detune: 5.00, stereo: 10 },
      osc_b1: { wave: 'Saw', voices: 8, detune: 5.00, stereo: 10, octave: -1 },
      filter_a: { type: 'Lowpass', cutoff: 8.0, resonance: 2 },
      filter_b: { type: 'Lowpass', cutoff: 8.0, resonance: 2 },
      mix: { a: 80, b: 60 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        low: { freq: 200, gain: -2, q: 1 },
        presence: { freq: 4000, gain: 3, q: 0.6 },
        air: { freq: 14000, gain: 2 }
      },
      compression: { threshold: -8, ratio: 4, attack: 5, release: 'fast' },
      reverb: { type: 'hall', decay: 'long', mix: 40 },
      delay: { time: 'eighth', feedback: 20, mix: 10 }
    },
    tips: [
      '16 total voices for massive sound',
      'Use both filter sections',
      'Sidechain heavily to kick',
      'Automate filter for drops'
    ]
  },

  'sylenth_bass': {
    name: 'Sylenth1 Bass',
    category: 'bass',
    description: 'Punchy synth bass',
    plugin: 'Sylenth1',
    settings: {
      osc_a1: { wave: 'Saw', voices: 2, detune: 0.50, octave: -1 },
      osc_a2: { wave: 'Square', voices: 1, octave: -2 },
      filter_a: { type: 'Lowpass', cutoff: 3.5, resonance: 5, drive: 3 },
      env_amp: { attack: 0, decay: 6.0, sustain: 6.0, release: 3.0 },
      env_filter: { attack: 0, decay: 3.0, sustain: 2.0, amount: 4.0 }
    },
    mixSettings: {
      eq: {
        lowCut: 30,
        sub: { freq: 60, gain: 2 },
        lowMid: { freq: 250, gain: -3, q: 2 },
        highCut: 6000
      },
      compression: { threshold: -8, ratio: 4, attack: 15, release: 'slow' },
      saturation: { drive: 25, mix: 35 }
    },
    tips: [
      'Layer square sub for weight',
      'Use filter envelope for pluck',
      'Mono below 150Hz',
      'Sidechain to kick'
    ]
  },

  'sylenth_pluck': {
    name: 'Sylenth1 Pluck',
    category: 'synth',
    description: 'Bright pluck synth',
    plugin: 'Sylenth1',
    settings: {
      osc_a1: { wave: 'Saw', voices: 4, detune: 2.00 },
      osc_a2: { wave: 'Pulse', voices: 2, detune: 1.50, pw: 30 },
      filter_a: { type: 'Lowpass', cutoff: 10, resonance: 3 },
      env_amp: { attack: 0, decay: 2.5, sustain: 0, release: 2.0 },
      env_filter: { attack: 0, decay: 2.0, sustain: 0, amount: 5.0 }
    },
    mixSettings: {
      eq: {
        lowCut: 120,
        mid: { freq: 1200, gain: 2, q: 1 },
        presence: { freq: 5000, gain: 3, q: 0.7 }
      },
      compression: { threshold: -12, ratio: 3, attack: 3, release: 'fast' },
      delay: { time: 'sixteenth', feedback: 40, mix: 25, pingPong: true },
      reverb: { type: 'plate', decay: 'medium', mix: 25 }
    },
    tips: [
      'Great for arpeggios',
      'Use velocity to filter cutoff',
      'Layer with pads for fullness',
      'Ping pong delay for width'
    ]
  },

  'sylenth_pad': {
    name: 'Sylenth1 Pad',
    category: 'synth',
    description: 'Warm analog-style pad',
    plugin: 'Sylenth1',
    settings: {
      osc_a1: { wave: 'Saw', voices: 4, detune: 4.00 },
      osc_b1: { wave: 'Triangle', voices: 2, detune: 2.00, octave: 1 },
      filter_a: { type: 'Lowpass', cutoff: 5.0, resonance: 2 },
      env_amp: { attack: 7.0, decay: 8.0, sustain: 7.0, release: 6.0 },
      lfo_1: { wave: 'Sine', rate: 0.5, amount: 1.5, destination: 'cutoff' }
    },
    mixSettings: {
      eq: {
        lowCut: 150,
        lowMid: { freq: 300, gain: -2, q: 1 },
        presence: { freq: 3000, gain: 2, q: 0.8 },
        air: { freq: 10000, gain: 2 }
      },
      compression: { threshold: -15, ratio: 2, attack: 50, release: 'slow' },
      reverb: { type: 'hall', decay: 'huge', mix: 50, preDelay: 'spacious' },
      chorus: { rate: 0.4, depth: 35, mix: 20 }
    },
    tips: [
      'Slow LFO for movement',
      'Long attack for swells',
      'Use both parts for thickness',
      'Heavy reverb works well'
    ]
  },

  // ============================================
  // MORE SYNTHS & INSTRUMENTS
  // ============================================

  'nexus_edm': {
    name: 'Nexus EDM Lead',
    category: 'synth',
    description: 'Big room house lead',
    plugin: 'Nexus',
    settings: {
      expansion: 'EDM',
      layer: 'Lead 01',
      filter: { cutoff: 80, resonance: 20 },
      mod: { amount: 30, destination: 'cutoff' }
    },
    mixSettings: {
      eq: {
        lowCut: 120,
        presence: { freq: 3500, gain: 4, q: 0.7 },
        air: { freq: 12000, gain: 3 }
      },
      compression: { threshold: -10, ratio: 4, attack: 5, release: 'fast' },
      reverb: { type: 'hall', decay: 'long', mix: 35 }
    }
  },

  'omnisphere_pad': {
    name: 'Omnisphere Pad',
    category: 'synth',
    description: 'Cinematic texture pad',
    plugin: 'Omnisphere',
    settings: {
      layer_a: { source: 'Psychoacoustic', granular: true },
      layer_b: { source: 'Analog', wave: 'Saw' },
      filter: { type: 'Lowpass', cutoff: 60 },
      fx: { reverb: 60, chorus: 30 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        low: { freq: 200, gain: -3, q: 1 },
        air: { freq: 10000, gain: 3 }
      },
      compression: { threshold: -18, ratio: 2, attack: 80, release: 'slow' },
      reverb: { type: 'hall', decay: 'huge', mix: 55 }
    }
  },

  'diva_analog': {
    name: 'Diva Analog Lead',
    category: 'synth',
    description: 'Vintage analog emulation',
    plugin: 'Diva',
    settings: {
      model: 'Jupe-8',
      osc_1: { wave: 'Saw', level: 100 },
      osc_2: { wave: 'Saw', level: 80, detune: 10 },
      filter: { type: 'Ladder', cutoff: 70, resonance: 25, env_amount: 40 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        mid: { freq: 800, gain: 2, q: 1 },
        presence: { freq: 4000, gain: 3, q: 0.8 }
      },
      compression: { threshold: -12, ratio: 3, attack: 10, release: 'musical' },
      delay: { time: 'dottedEighth', feedback: 25, mix: 20 },
      chorus: { rate: 0.6, depth: 25, mix: 15 }
    }
  },

  'vital_modern': {
    name: 'Vital Modern Bass',
    category: 'bass',
    description: 'Modern wavetable bass',
    plugin: 'Vital',
    settings: {
      osc_1: { wavetable: 'Init', spectral_morph: 'smear', position: 50 },
      osc_2: { wavetable: 'Basic Shapes', position: 0, level: 60 },
      filter: { type: 'Dirty', cutoff: 400, drive: 40 },
      unison: { voices: 4, detune: 20 }
    },
    mixSettings: {
      eq: {
        lowCut: 30,
        sub: { freq: 55, gain: 2 },
        mid: { freq: 500, gain: 3, q: 1.5 },
        highCut: 10000
      },
      compression: { threshold: -8, ratio: 4, attack: 10, release: 'slow' },
      saturation: { drive: 35, mix: 45 }
    },
    tips: [
      'Free alternative to Serum',
      'Use spectral morph for texture',
      'Great for modern bass sounds',
      'Layer with sub oscillator'
    ]
  },

  'phase_plant_texture': {
    name: 'Phase Plant Texture',
    category: 'synth',
    description: 'Complex modular texture',
    plugin: 'Phase Plant',
    settings: {
      generator_1: { type: 'Wavetable', table: 'Harmonic' },
      generator_2: { type: 'Sample', sample: 'Noise' },
      generator_3: { type: 'Analog', wave: 'Saw' },
      filter: { type: 'Ladder', cutoff: 50 },
      modulators: 'Complex LFO routing'
    },
    mixSettings: {
      eq: {
        lowCut: 80,
        mid: { freq: 600, gain: -2, q: 1 },
        air: { freq: 12000, gain: 3 }
      },
      compression: { threshold: -15, ratio: 2, attack: 30, release: 'slow' },
      reverb: { type: 'hall', decay: 'long', mix: 40 }
    }
  },

  'pigments_fm': {
    name: 'Pigments FM Bass',
    category: 'bass',
    description: 'FM synthesis bass',
    plugin: 'Pigments',
    settings: {
      engine_1: { type: 'Analog', wave: 'Sine' },
      engine_2: { type: 'Wavetable', fm_from_1: 50 },
      filter: { type: 'Multimode', cutoff: 800, drive: 30 }
    },
    mixSettings: {
      eq: {
        lowCut: 35,
        sub: { freq: 60, gain: 3 },
        mid: { freq: 400, gain: -2, q: 2 },
        presence: { freq: 2000, gain: 2, q: 1 }
      },
      compression: { threshold: -10, ratio: 4, attack: 15, release: 'slow' }
    }
  },

  // ============================================
  // HARDWARE EMULATIONS
  // ============================================

  'juno_106': {
    name: 'Juno-106 Pad',
    category: 'synth',
    description: 'Classic 80s pad',
    plugin: 'TAL-U-NO-LX / Juno emulation',
    settings: {
      dco: { saw: 100, pulse: 0, sub: 50, noise: 0 },
      hpf: 1,
      vcf: { freq: 60, res: 30, env: 40 },
      vca: { env: true },
      env: { attack: 50, decay: 60, sustain: 70, release: 60 },
      chorus: 2
    },
    mixSettings: {
      eq: {
        lowCut: 80,
        warmth: { freq: 200, gain: 2, q: 0.8 },
        presence: { freq: 3000, gain: 2, q: 1 }
      },
      compression: { threshold: -15, ratio: 2, attack: 40, release: 'slow' },
      reverb: { type: 'plate', decay: 'long', mix: 35 }
    },
    tips: [
      'Chorus is essential for Juno sound',
      'Use HPF to clear low end',
      'Classic for synthwave and house',
      'Layer with modern basses'
    ]
  },

  'minimoog': {
    name: 'Minimoog Bass',
    category: 'bass',
    description: 'Classic analog bass',
    plugin: 'Minimoog emulation',
    settings: {
      osc_1: { wave: 'Saw', octave: -1 },
      osc_2: { wave: 'Square', octave: -2, detune: 3 },
      osc_3: { wave: 'Triangle', octave: -2 },
      filter: { cutoff: 40, emphasis: 30, contour: 50 },
      loudness: { attack: 0, decay: 60, sustain: 80 }
    },
    mixSettings: {
      eq: {
        lowCut: 30,
        sub: { freq: 60, gain: 2 },
        lowMid: { freq: 200, gain: -2, q: 2 },
        presence: { freq: 1500, gain: 2, q: 1 }
      },
      compression: { threshold: -10, ratio: 4, attack: 20, release: 'slow' },
      saturation: { drive: 20, mix: 30, type: 'tube' }
    },
    tips: [
      'Three oscillators for thickness',
      'Filter resonance adds character',
      'Classic for funk and hip-hop',
      'Use glide for slides'
    ]
  },

  'dx7_epiano': {
    name: 'DX7 E-Piano',
    category: 'keys',
    description: 'Classic FM electric piano',
    plugin: 'Dexed / FM8',
    settings: {
      algorithm: 5,
      operators: 'Classic E.Piano patch',
      velocity_sensitivity: 70,
      feedback: 5
    },
    mixSettings: {
      eq: {
        lowCut: 60,
        warmth: { freq: 250, gain: 2, q: 1 },
        presence: { freq: 2500, gain: 3, q: 0.8 },
        air: { freq: 8000, gain: 2 }
      },
      compression: { threshold: -15, ratio: 2.5, attack: 15, release: 'musical' },
      chorus: { rate: 0.4, depth: 25, mix: 20 },
      reverb: { type: 'plate', decay: 'medium', mix: 20 }
    },
    tips: [
      'Velocity is crucial for dynamics',
      'Classic 80s sound',
      'Works great with chorus',
      'Layer with real piano for depth'
    ]
  },

  'prophet_5': {
    name: 'Prophet-5 Brass',
    category: 'synth',
    description: 'Classic poly synth brass',
    plugin: 'Prophet emulation',
    settings: {
      osc_a: { wave: 'Saw', level: 100 },
      osc_b: { wave: 'Saw', level: 80, detune: 5, sync: false },
      filter: { cutoff: 50, resonance: 15, env_amount: 60, keytrack: 50 },
      env_filter: { attack: 0, decay: 40, sustain: 60, release: 30 }
    },
    mixSettings: {
      eq: {
        lowCut: 100,
        mid: { freq: 800, gain: 2, q: 1 },
        presence: { freq: 3000, gain: 3, q: 0.7 }
      },
      compression: { threshold: -12, ratio: 3, attack: 10, release: 'musical' },
      reverb: { type: 'hall', decay: 'medium', mix: 25 }
    },
    tips: [
      'Classic brass stabs',
      'Filter envelope is key',
      'Great for chord stabs',
      'Use unison for leads'
    ]
  }
};

// ============================================
// USER PREFERENCES STORAGE
// ============================================

const STORAGE_KEY = 'musicAnalyzer_userKnowledge';

/**
 * Load user preferences from localStorage
 */
export function loadUserPreferences() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load user preferences:', e);
  }

  return {
    favorites: [],           // Favorite instruments/presets
    customPresets: {},       // User-created presets
    recentBPMs: [],          // Recent BPMs used
    defaultBPM: 120,         // Default BPM
    preferences: {
      defaultReverb: 'plate',
      defaultDelay: 'dottedEighth',
      preferredKey: 'C',
      autoSyncEffects: true  // Auto-calculate from BPM
    },
    learnings: [],           // Things the system has learned
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

/**
 * Save user preferences to localStorage
 */
export function saveUserPreferences(prefs) {
  try {
    prefs.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    return true;
  } catch (e) {
    console.error('Failed to save user preferences:', e);
    return false;
  }
}

/**
 * Add a favorite instrument/preset
 */
export function addFavorite(presetId, customSettings = null) {
  const prefs = loadUserPreferences();

  // Check if already favorited
  const existingIndex = prefs.favorites.findIndex(f => f.id === presetId);

  if (existingIndex >= 0) {
    // Update existing
    prefs.favorites[existingIndex] = {
      ...prefs.favorites[existingIndex],
      customSettings,
      useCount: (prefs.favorites[existingIndex].useCount || 0) + 1,
      lastUsed: new Date().toISOString()
    };
  } else {
    // Add new
    prefs.favorites.push({
      id: presetId,
      customSettings,
      useCount: 1,
      addedAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    });
  }

  saveUserPreferences(prefs);
  return prefs;
}

/**
 * Create a custom preset
 */
export function createCustomPreset(name, category, settings, mixSettings, tips = []) {
  const prefs = loadUserPreferences();
  const id = `custom_${Date.now()}`;

  prefs.customPresets[id] = {
    id,
    name,
    category,
    description: 'Custom preset',
    settings,
    mixSettings,
    tips,
    createdAt: new Date().toISOString()
  };

  saveUserPreferences(prefs);
  return id;
}

/**
 * Add a learning (something the system learned about user preferences)
 */
export function addLearning(type, data) {
  const prefs = loadUserPreferences();

  prefs.learnings.push({
    type,
    data,
    timestamp: new Date().toISOString()
  });

  // Keep only last 100 learnings
  if (prefs.learnings.length > 100) {
    prefs.learnings = prefs.learnings.slice(-100);
  }

  saveUserPreferences(prefs);
}

/**
 * Track BPM usage
 */
export function trackBPMUsage(bpm) {
  const prefs = loadUserPreferences();

  prefs.recentBPMs.unshift({
    bpm,
    timestamp: new Date().toISOString()
  });

  // Keep only last 20
  prefs.recentBPMs = prefs.recentBPMs.slice(0, 20);

  // Calculate most common BPM
  const bpmCounts = {};
  prefs.recentBPMs.forEach(r => {
    const rounded = Math.round(r.bpm);
    bpmCounts[rounded] = (bpmCounts[rounded] || 0) + 1;
  });

  const mostCommon = Object.entries(bpmCounts)
    .sort((a, b) => b[1] - a[1])[0];

  if (mostCommon) {
    prefs.defaultBPM = parseInt(mostCommon[0]);
  }

  saveUserPreferences(prefs);
}

// ============================================
// DIAL-IN CONFIGURATION GENERATOR
// ============================================

/**
 * Generate complete dial-in configuration for an instrument at a given BPM
 */
export function generateDialInConfig(presetId, bpm) {
  // Get preset (built-in or custom)
  const prefs = loadUserPreferences();
  let preset = DEFAULT_INSTRUMENT_PRESETS[presetId];

  if (!preset && prefs.customPresets[presetId]) {
    preset = prefs.customPresets[presetId];
  }

  // Check favorites for custom settings
  const favorite = prefs.favorites.find(f => f.id === presetId);
  if (favorite?.customSettings) {
    preset = { ...preset, ...favorite.customSettings };
  }

  if (!preset) {
    return null;
  }

  // Calculate BPM-synced values
  const timing = calculateBPMSync(bpm);

  // Build dial-in config
  const config = {
    preset: preset.name,
    bpm,
    category: preset.category,

    // Instrument settings (as-is)
    instrumentSettings: { ...preset.settings },

    // Mix settings with calculated values
    mixSettings: {}
  };

  // Process mix settings
  if (preset.mixSettings) {
    const mix = preset.mixSettings;

    // EQ (no BPM calculation needed)
    if (mix.eq) {
      config.mixSettings.eq = { ...mix.eq };
    }

    // Compression with BPM-synced release
    if (mix.compression) {
      config.mixSettings.compression = { ...mix.compression };

      if (mix.compression.release === 'auto' || mix.compression.release === 'musical') {
        config.mixSettings.compression.release = Math.round(timing.compressor.release.musical);
        config.mixSettings.compression.releaseNote = '1/16 note';
      } else if (mix.compression.release === 'fast') {
        config.mixSettings.compression.release = Math.round(timing.compressor.release.fast);
        config.mixSettings.compression.releaseNote = '1/32 note';
      } else if (mix.compression.release === 'slow') {
        config.mixSettings.compression.release = Math.round(timing.compressor.release.slow);
        config.mixSettings.compression.releaseNote = '1/8 note';
      }
    }

    // Reverb with BPM-synced times
    if (mix.reverb) {
      config.mixSettings.reverb = { ...mix.reverb };

      // Pre-delay
      if (typeof mix.reverb.preDelay === 'string') {
        const preDelayValue = timing.preDelay[mix.reverb.preDelay];
        config.mixSettings.reverb.preDelayMs = Math.round(preDelayValue);
        config.mixSettings.reverb.preDelayNote = mix.reverb.preDelay;
      }

      // Decay
      if (typeof mix.reverb.decay === 'string') {
        const decayValue = timing.reverbDecay[mix.reverb.decay];
        config.mixSettings.reverb.decayMs = Math.round(decayValue);
        config.mixSettings.reverb.decayNote = mix.reverb.decay;
      }
    }

    // Delay with BPM-synced time
    if (mix.delay) {
      config.mixSettings.delay = { ...mix.delay };

      if (typeof mix.delay.time === 'string') {
        const delayValue = timing.delays[mix.delay.time] || timing[mix.delay.time];
        config.mixSettings.delay.timeMs = Math.round(delayValue);
        config.mixSettings.delay.timeNote = mix.delay.time;
      }
    }

    // Copy other settings
    ['chorus', 'saturation', 'deEsser'].forEach(key => {
      if (mix[key]) {
        config.mixSettings[key] = { ...mix[key] };
      }
    });
  }

  // Add tips
  config.tips = preset.tips || [];

  // Add timing reference
  config.timingReference = {
    quarterNote: `${Math.round(timing.quarter)}ms`,
    eighthNote: `${Math.round(timing.eighth)}ms`,
    sixteenthNote: `${Math.round(timing.sixteenth)}ms`,
    dottedEighth: `${Math.round(timing.dottedEighth)}ms`,
    tripletEighth: `${Math.round(timing.tripletEighth)}ms`
  };

  return config;
}

/**
 * Get all dial-in configs for favorites at current BPM
 */
export function getAllFavoriteConfigs(bpm) {
  const prefs = loadUserPreferences();

  return prefs.favorites.map(fav => ({
    ...fav,
    config: generateDialInConfig(fav.id, bpm)
  })).filter(f => f.config !== null);
}

/**
 * Get suggested instruments for a genre
 */
export function getSuggestedInstruments(genre) {
  const suggestions = {
    'house': ['m1_piano', 'supersaw', '808_bass', 'acoustic_kit'],
    'techno': ['supersaw', '808_bass'],
    'hip-hop': ['808_bass', 'rhodes', 'lead_vocal'],
    'pop': ['rhodes', 'lead_vocal', 'acoustic_kit', 'supersaw'],
    'rnb': ['rhodes', 'lead_vocal', '808_bass'],
    'edm': ['supersaw', '808_bass', 'm1_piano']
  };

  return suggestions[genre.toLowerCase()] || Object.keys(DEFAULT_INSTRUMENT_PRESETS);
}

// ============================================
// EXPORT ALL
// ============================================

export default {
  calculateBPMSync,
  formatMs,
  DEFAULT_INSTRUMENT_PRESETS,
  loadUserPreferences,
  saveUserPreferences,
  addFavorite,
  createCustomPreset,
  addLearning,
  trackBPMUsage,
  generateDialInConfig,
  getAllFavoriteConfigs,
  getSuggestedInstruments
};
