/**
 * Rhythm Patterns Data
 * Grid notation patterns, swing values, and bassline architectures
 * Based on the Music Production Master Template
 */

// Grid notation guide
export const GRID_NOTATION_GUIDE = {
  description: '16-step grid represents one bar of 4/4. Each character = one 16th note.',
  positions: '1 e + a 2 e + a 3 e + a 4 e + a',
  beats: '1 . . . 2 . . . 3 . . . 4 . . .',
  steps: '1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6',
  symbols: {
    'X': 'hit (accent)',
    'x': 'hit (ghost/soft)',
    'O': 'open hi-hat (accent)',
    'o': 'open hi-hat (ghost)',
    '-': 'rest',
    '[ ]': 'optional/variation'
  }
};

/**
 * DRUM DETECTION FREQUENCY BANDS
 * Used by rhythm_analyzer.py for drum classification
 * Aligned with signalChains.js FREQUENCY_ALLOCATION
 *
 * These bands are synchronized between:
 * - rhythm_analyzer.py (Python backend)
 * - signalChains.js (Knowledge Lab)
 *
 * When modifying, update BOTH files to keep in sync.
 */
export const DRUM_DETECTION_BANDS = {
  // Per-drum frequency focus (where to look for each drum type)
  kick: {
    primary: { min: 20, max: 60, label: 'Sub-bass', note: 'Kick sub thump (50-60Hz typical)' },
    secondary: { min: 60, max: 200, label: 'Bass', note: 'Kick body/punch' },
    combined: { min: 20, max: 200, label: 'Low', note: 'Total low-end for kick detection' },
    avoid: { min: 6000, max: 20000, label: 'Highs', note: 'Kicks should have minimal highs' }
  },
  snare: {
    primary: { min: 500, max: 2000, label: 'Mids', note: 'Snare body/tone' },
    secondary: { min: 2000, max: 6000, label: 'High-mids', note: 'Snare snap/crack (crack at 3-5kHz)' },
    characteristics: ['noisy (high spectral flatness)', 'medium decay (8-60ms)']
  },
  hihat: {
    primary: { min: 6000, max: 20000, label: 'Highs', note: 'Cymbal shimmer, air' },
    specific: { min: 6000, max: 16000, label: 'Hi-hat band', note: 'Tighter hi-hat range' },
    characteristics: ['short decay (closed)', 'high spectral centroid', 'little low-end']
  },
  clap: {
    primary: { min: 1200, max: 4000, label: 'Upper-mids', note: 'Clap body - noisy, diffuse' },
    characteristics: ['very noisy (highest flatness)', 'diffuse transient', 'often has reverb/echo', 'typically on beats 2 & 4 or off-beats']
  },
  tom: {
    primary: { min: 200, max: 500, label: 'Low-mids', note: 'Tom body (mud zone for other instruments)' },
    secondary: { min: 20, max: 200, label: 'Low', note: 'Floor tom sub' },
    characteristics: ['tonal (low flatness)', 'longer decay (30ms+)']
  },

  // Knowledge Lab FREQUENCY_ALLOCATION reference
  allBands: {
    subBass: { min: 20, max: 60, note: 'Kick sub, bass sub ONLY - MONO' },
    bass: { min: 60, max: 200, note: 'Kick body, bass body' },
    lowMids: { min: 200, max: 500, note: 'MUD ZONE - cut aggressively on most elements' },
    mids: { min: 500, max: 2000, note: 'Snare body, vocal presence' },
    highMids: { min: 2000, max: 6000, note: 'Click/attack, brightness, presence. De-ess here.' },
    highs: { min: 6000, max: 20000, note: 'Air, shimmer, cymbals' }
  }
};

/**
 * EXTENDED INSTRUMENT DETECTION BANDS
 * Used by rhythm_analyzer.py /detect-instruments endpoint
 * Synchronized with INSTRUMENT_FILTERS in rhythm_analyzer.py
 */
export const EXTENDED_DETECTION_BANDS = {
  // === BASS INSTRUMENTS ===
  bass: {
    subBass: { min: 20, max: 80, note: '808s, sub synths - mono only' },
    bass: { min: 60, max: 250, note: 'Bass guitar, synth bass body' },
    bassHarmonics: { min: 200, max: 600, note: 'Upper harmonics for definition' }
  },

  // === MELODIC INSTRUMENTS ===
  melodic: {
    pianoLow: { min: 80, max: 400, note: 'Piano left hand, low chords' },
    pianoMid: { min: 250, max: 2000, note: 'Piano middle range' },
    pianoHigh: { min: 2000, max: 5000, note: 'Piano right hand, brightness' },
    guitar: { min: 80, max: 1200, note: 'Acoustic/electric guitar body' },
    guitarBright: { min: 2000, max: 5000, note: 'Guitar presence, pick attack' },
    synthLead: { min: 500, max: 8000, note: 'Lead synths, arpeggios' },
    synthPad: { min: 200, max: 4000, note: 'Pads, atmospheres, strings' },
    strings: { min: 200, max: 4000, note: 'Orchestral strings' },
    brass: { min: 100, max: 3000, note: 'Horns, trumpets, brass stabs' },
    pluck: { min: 2000, max: 12000, note: 'Plucks, bells, bright synths' }
  },

  // === VOCALS ===
  vocals: {
    vocalLow: { min: 80, max: 300, note: 'Male chest voice, low harmonics' },
    vocalBody: { min: 200, max: 2000, note: 'Core vocal tone, lyrics clarity' },
    vocalPresence: { min: 2000, max: 5000, note: 'Vocal clarity, cut-through' },
    vocalAir: { min: 5000, max: 12000, note: 'Breathiness, air, sparkle' },
    sibilance: { min: 5000, max: 9000, note: 'S, T, F, SH sounds - de-ess zone' }
  },

  // === BACKGROUND VOCALS ===
  backgroundVocals: {
    adlib: { min: 200, max: 5000, note: 'Ad-libs, background vocals, often panned' },
    harmony: { min: 300, max: 4000, note: 'Vocal harmonies, stacks' }
  },

  // === SOUND FX / TRANSITIONS ===
  soundFx: {
    uplifter: { min: 2000, max: 15000, note: 'White noise risers, upward sweeps' },
    downlifter: { min: 100, max: 10000, note: 'Downward sweeps, reverse risers' },
    impact: { min: 20, max: 2000, note: 'Hits, booms, thuds - strong transients' },
    subDrop: { min: 20, max: 100, note: 'Sub bass drops, 808 slides' },
    reverseCrash: { min: 3000, max: 15000, note: 'Reverse cymbals, crash buildups' },
    whiteNoise: { min: 1000, max: 15000, note: 'White noise sweeps, fills' },
    swoosh: { min: 1000, max: 8000, note: 'Wooshes, transitions' },
    tapeStop: { min: 50, max: 2000, note: 'Tape stop effects, slowdowns' },
    stutter: { min: 200, max: 8000, note: 'Glitch, stutter, beat repeat' },
    vocalChop: { min: 300, max: 5000, note: 'Chopped vocal FX, one-shots' }
  }
};

/**
 * RECOMMENDED DETECTION THRESHOLDS
 * Lower = more sensitive (detects quieter elements)
 * Use energyMultiplier to adjust sensitivity
 */
export const DETECTION_THRESHOLDS = {
  // Drums (from DRUM_DETECTION_BANDS)
  drums: {
    kick: 0.008, snare: 0.006, hihat: 0.004,
    clap: 0.005, tom: 0.006, perc: 0.003
  },
  // Bass
  bass: {
    subBass: 0.010, bass: 0.008, bassHarmonics: 0.005
  },
  // Melodic
  melodic: {
    pianoLow: 0.006, pianoMid: 0.005, pianoHigh: 0.004,
    guitar: 0.005, guitarBright: 0.004, synthLead: 0.004,
    synthPad: 0.003, strings: 0.004, brass: 0.005, pluck: 0.003
  },
  // Vocals
  vocals: {
    vocalLow: 0.006, vocalBody: 0.005, vocalPresence: 0.004,
    vocalAir: 0.003, sibilance: 0.004
  },
  // Background vocals - very sensitive
  backgroundVocals: {
    adlib: 0.002,    // Very sensitive for quiet ad-libs
    harmony: 0.003   // Sensitive for background harmonies
  },
  // Sound FX
  soundFx: {
    uplifter: 0.003, downlifter: 0.004, impact: 0.008,
    subDrop: 0.010, reverseCrash: 0.003, whiteNoise: 0.002,
    swoosh: 0.003, tapeStop: 0.005, stutter: 0.002, vocalChop: 0.003
  }
};

/**
 * ADVANCED PROCESSING PIPELINE
 * Applied before detection for better instrument isolation
 * Order: Bandpass → De-reverb → Dynamic EQ → Compression → Onset Detection
 *
 * Synchronized with rhythm_analyzer.py DYNAMIC_EQ_PROFILES, COMPRESSION_PRESETS, DEREVERB_PRESETS
 */
export const ADVANCED_PROCESSING = {
  // Dynamic EQ - boost target frequencies, cut competing
  dynamicEq: {
    description: 'Frequency shaping to isolate each instrument',
    options: {
      use_dynamic_eq: { type: 'boolean', default: true, description: 'Enable EQ shaping' },
      eq_strength: { type: 'number', min: 0, max: 2, default: 1.0, description: 'EQ intensity' }
    },
    examples: {
      kick: { boost: [[60, 6], [100, 4]], cut: [[300, -6], [5000, -12]], transientEnhance: true },
      snare: { boost: [[200, 4], [3000, 6]], cut: [[60, -12], [8000, -6]], transientEnhance: true },
      hihat: { boost: [[8000, 6], [12000, 4]], cut: [[200, -18], [500, -12]], transientEnhance: false },
      vocalBody: { boost: [[800, 3], [1500, 2]], cut: [[100, -9], [6000, -6]], transientEnhance: false },
      uplifter: { boost: [[4000, 4], [8000, 3]], cut: [[200, -12]], transientEnhance: false }
    }
  },

  // Compression - bring up quiet elements
  compression: {
    description: 'Dynamic range control for consistent detection',
    options: {
      use_compression: { type: 'boolean', default: false, description: 'Enable compression' }
    },
    presetsByCategory: {
      drums: { threshold: '-12 to -18dB', ratio: '3:1 to 4:1', attack: '1-8ms', release: '40-100ms' },
      bass: { threshold: '-10 to -15dB', ratio: '4:1 to 6:1', attack: '15-20ms', release: '100-150ms' },
      vocals: { threshold: '-15 to -20dB', ratio: '2.5:1 to 3.5:1', attack: '3-10ms', release: '50-100ms' },
      soundFx: { threshold: '-10 to -20dB', ratio: '2:1 to 6:1', attack: '1-30ms', release: '30-200ms' }
    }
  },

  // De-reverb/De-delay - remove room ambience
  dereverb: {
    description: 'Remove reverb and delay for cleaner transient detection',
    options: {
      use_dereverb: { type: 'boolean', default: false, description: 'Enable de-reverb' },
      dereverb_strength: { type: 'number', min: 0, max: 1, default: 0.5, description: 'Intensity' }
    },
    presetsByCategory: {
      drums: { reverb: '0.4-0.7', delay: '0.3-0.5', transientPreserve: '0.8-0.9', note: 'Aggressive, keep transients' },
      bass: { reverb: '0.3-0.4', delay: '0.2-0.3', transientPreserve: '0.7-0.8', note: 'Less aggressive, preserve body' },
      vocals: { reverb: '0.3-0.5', delay: '0.2-0.4', transientPreserve: '0.5-0.7', note: 'Careful processing' },
      soundFx: { reverb: '0.2-0.6', delay: '0.2-0.6', transientPreserve: '0.5-0.9', note: 'Varies by type' }
    }
  },

  // Self-validation endpoints
  validation: {
    selfTest: 'GET /self-test - Run all validation tests',
    singleInstrument: 'GET /validate-detection/{instrument} - Test specific instrument',
    instrumentFilters: 'GET /instrument-filters - Get all filters and processing presets'
  }
};

/**
 * SOUND FX CATEGORIES
 * Production elements for transitions, drops, and builds
 */
export const SOUND_FX_TYPES = {
  risers: {
    types: ['uplifter', 'reverse_crash', 'white_noise'],
    description: 'Building elements before drops/choruses',
    frequencyRange: '2000-15000Hz',
    detectSettings: { energyMultiplier: 0.3, useDynamicEq: true }
  },
  drops: {
    types: ['downlifter', 'impact', 'sub_drop'],
    description: 'Impact elements at section starts',
    frequencyRange: '20-10000Hz',
    detectSettings: { energyMultiplier: 0.4, useCompression: true }
  },
  transitions: {
    types: ['swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
    description: 'Connective elements between sections',
    frequencyRange: '50-8000Hz',
    detectSettings: { energyMultiplier: 0.3, useDereverb: true }  // Factory default
  }
};

// Swing values by genre
export const SWING_VALUES = {
  edm: { min: 0, max: 50, typical: 0, description: 'Straight, mechanical, precise' },
  pop: { min: 50, max: 55, typical: 52, description: 'Slight groove, mostly straight' },
  afroHouse: { min: 55, max: 65, typical: 60, description: 'Heavy swing, organic feel' },
  kpop: { min: 0, max: 60, typical: 'Variable', description: 'Depends on section genre' }
};

// Humanization techniques
export const HUMANIZATION = {
  velocityVariation: '±10-20% from base velocity',
  timingVariation: '±5-15ms from grid',
  noteLengthVariation: 'Vary slightly for organic feel',
  ghostNotes: 'Add quiet notes between main hits'
};

// Pop patterns
export const POP_PATTERNS = {
  standard: {
    name: 'Standard Pop Beat',
    description: 'Basic backbeat pattern - most common pop drum pattern',
    notation: {
      kick: 'X - - - - - - - X - - - - - - -',
      snare: '- - - - X - - - - - - - X - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 50,
    tips: ['Snare on 2 and 4', 'Kick on 1 and 3 (or variations)', 'Hi-hats on 8th notes']
  },
  fourOnFloor: {
    name: 'Four-on-Floor Pop',
    description: 'Dance-pop pattern with kick on every beat',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      snare: '- - - - X - - - - - - - X - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 50,
    tips: ['Common in dance-pop and disco-influenced tracks', 'Kick provides consistent pulse']
  },
  halftime: {
    name: 'Halftime Pop',
    description: 'Half-time feel with snare on beat 3',
    notation: {
      kick: 'X - - - - - - - - - - - - - - -',
      snare: '- - - - - - - - X - - - - - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 50,
    tips: ['Creates heavier, slower feel', 'Common in ballads and power ballads', 'Snare hit feels more impactful']
  },
  syncopated: {
    name: 'Syncopated Pop',
    description: 'More complex rhythm with off-beat kicks',
    notation: {
      kick: 'X - - - - - X - - - X - - - - -',
      snare: '- - - - X - - - - - - - X - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 52,
    tips: ['Off-beat kicks add interest', 'Common in modern pop']
  }
};

// EDM patterns
export const EDM_PATTERNS = {
  fourOnFloor: {
    name: 'Four-on-Floor (Foundation)',
    description: 'The foundation of house, techno, and most EDM',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      clap: '- - - - X - - - - - - - X - - -',
      hihat: '- - x - - - x - - - x - - - x -',
      openHat: '- - - - - - - - - - - - - - O -'
    },
    swing: 0,
    tips: ['Kick on every quarter note', 'Clap/snare on 2 and 4', 'Off-beat hi-hats are signature house sound']
  },
  offbeatHouse: {
    name: 'Offbeat House',
    description: 'Classic house pattern with off-beat hi-hats',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      clap: '- - - - X - - - - - - - X - - -',
      hihat: '- x - x - x - x - x - x - x - x'
    },
    swing: 0,
    tips: ['Hi-hats on every off-beat (the "and")', 'Creates driving, rhythmic feel']
  },
  build: {
    name: 'Build Pattern (Pre-Drop)',
    description: 'Accelerating snare pattern for tension',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      snare: 'x - x - x - x - x x x x x x x x',
      hihat: 'x x x x x x x x x x x x x x x x'
    },
    swing: 0,
    tips: ['Snare accelerates toward the drop', 'Often starts sparse and fills in', 'Add white noise riser']
  },
  techno: {
    name: 'Techno Pattern',
    description: 'Driving techno groove',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      clap: '- - - - X - - - - - - - X - - -',
      hihat: 'x - x - x - x - x - x - x - x -',
      ride: '- - - - - - - x - - - - - - - x'
    },
    swing: 0,
    tips: ['Minimal variation', 'Hypnotic repetition', 'Subtle changes over 16-32 bars']
  },
  dubstep: {
    name: 'Dubstep Half-Time',
    description: 'Heavy half-time dubstep pattern',
    notation: {
      kick: 'X - - - - - - - - - - - - - - -',
      snare: '- - - - - - - - X - - - - - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 0,
    tips: ['Half-time feel is key', 'Leave space for bass wobbles', 'Kick and snare are sparse']
  }
};

// Afro House patterns
export const AFRO_HOUSE_PATTERNS = {
  foundation: {
    name: 'Afro Foundation',
    description: 'Basic Afro house groove with layered swing',
    notation: {
      kick: 'X - - - - - - - X - - - - - - -',
      shaker: 'x - x - x - x - x - x - x - x -',
      clave: 'X - - X - - X - - - X - X - - -'
    },
    swingByLayer: { kick: 60, shaker: 55, clave: 0 },
    tips: [
      'Different swing values per layer creates organic feel',
      'Clave is often straight while percussion swings',
      'Kick is sparse - 1 and 3, or variations'
    ]
  },
  fullStack: {
    name: 'Full Percussion Stack',
    description: 'Complete Afro house percussion arrangement',
    notation: {
      kick: 'X - - - - - - - X - - - - - X -',
      shaker: 'x - x - x - x - x - x - x - x -',
      congaH: '- - X - - - X - - - X - - - - -',
      congaL: '- - - - X - - - - - - - X - - -',
      djembe: 'X - - X - - - X - - X - - - X -',
      rim: '- X - - - X - - - X - - - X - -'
    },
    swingByLayer: { kick: 60, shaker: 55, congaH: 58, congaL: 58, djembe: 62, rim: 0 },
    tips: [
      'Each layer can have different swing percentage',
      'Creates "human ensemble" feel',
      'Rim often stays straight as anchor'
    ]
  },
  minimal: {
    name: 'Minimal Afro',
    description: 'Stripped down Afro groove',
    notation: {
      kick: 'X - - - - - - - X - - - - - - -',
      shaker: 'x - x - x - x - x - x - x - x -',
      rim: '- - - X - - - - - - - X - - - -'
    },
    swingByLayer: { kick: 58, shaker: 55, rim: 0 },
    tips: ['Less is more', 'Space between hits is as important as the hits', 'Great for intros and breakdowns']
  },
  polyrhythmic: {
    name: 'Polyrhythmic Pattern',
    description: 'Complex interlocking rhythms',
    notation: {
      kick: 'X - - - - - - - X - - - - - - -',
      bell: 'X - X - - X - X - - X - X - - -',
      shaker: 'x - x - x - x - x - x - x - x -',
      conga: '- - X - - - X - - X - - - X - -'
    },
    swingByLayer: { kick: 60, bell: 0, shaker: 55, conga: 58 },
    tips: [
      'Bell pattern creates cross-rhythm',
      'Multiple layers interlock like puzzle pieces',
      'Each pattern makes sense alone and together'
    ]
  }
};

// K-Pop patterns
export const KPOP_PATTERNS = {
  trapVerse: {
    name: 'Trap-Influenced Verse',
    description: 'Modern K-pop trap-style verse',
    notation: {
      kick: 'X - - - - - - - - - - X - - - -',
      snare: '- - - - - - - - X - - - - - - -',
      hihat: 'x x x x x x x x x x x x x x x x',
      bass808: 'X - - - - - - - - - X - - - - X'
    },
    swing: 0,
    tips: ['Sparse kick and snare', 'Busy hi-hats (often triplets)', '808 bass adds weight']
  },
  explosiveChorus: {
    name: 'Explosive Chorus',
    description: 'High-energy K-pop chorus pattern',
    notation: {
      kick: 'X - - - X - - - X - - - X - - -',
      snare: '- - - - X - - - - - - - X - - -',
      clap: '- - - - X - - - - - - - X - - -',
      hihat: 'x - x - x - x - x - x - x - x -'
    },
    swing: 50,
    tips: ['Layered clap and snare for impact', 'Four-on-floor kick', 'Maximum energy']
  },
  danceBreak: {
    name: 'Dance Break Pattern',
    description: 'Hard-hitting dance break',
    notation: {
      kick: 'X - - X - - X - X - - X - - X -',
      snare: '- - - - X - - - - - - - X - - -',
      perc: '- X - - - X - X - X - - - X - X'
    },
    swing: 0,
    tips: ['Syncopated kicks', 'Percussion fills add complexity', 'Designed for choreography']
  },
  rnbBridge: {
    name: 'R&B Bridge',
    description: 'Smooth R&B-influenced bridge',
    notation: {
      kick: 'X - - - - - - - X - - - - - - -',
      snare: '- - - - X - - - - - - - X - - -',
      hihat: 'x - - x - - x - x - - x - - x -'
    },
    swing: 55,
    tips: ['More sparse and smooth', 'Swing adds groove', 'Space for vocals']
  }
};

// Bassline architectures
export const BASSLINE_PATTERNS = {
  popRootFifth: {
    name: 'Pop Root-Fifth Movement',
    genre: 'pop',
    description: 'Simple root-fifth movement, common in pop',
    notation: 'C - - - G - - - C - - - G - - -',
    explanation: '(root)   (5th)   (root)   (5th)',
    tips: ['Simple and effective', 'Follows chord roots', 'Stays out of vocal range']
  },
  edmSidechain: {
    name: 'EDM Sidechain Pumping',
    genre: 'edm',
    description: 'Sustained bass ducking under kick',
    notation: 'C>>>--- C>>>--- C>>>--- C>>>---',
    explanation: '(attack then duck under kick)',
    tips: ['Sustained note', 'Sidechain creates pumping', 'Attack on kick, sustain between']
  },
  afroRolling: {
    name: 'Afro House Rolling',
    genre: 'afroHouse',
    description: 'Melodic, groove-locked bassline with swing',
    notation: 'C - D - E - D - C - - - G - - -',
    explanation: '(scalar movement, groove-locked) 55% swing',
    tips: ['More melodic than EDM bass', 'Follows the groove', 'Scalar movement adds interest']
  },
  kpop808: {
    name: 'K-Pop 808 Style',
    genre: 'kpop',
    description: 'Sparse, heavy 808-style bass with slides',
    notation: 'C - - - - - - - - - - C - - - C',
    explanation: '(sparse, heavy, pitch slides)',
    tips: ['Sparse hits for impact', 'Pitch slides between notes', 'Heavy sub-bass']
  },
  walkingBass: {
    name: 'Walking Bass',
    genre: 'jazz',
    description: 'Stepwise movement through chord tones',
    notation: 'C - E - G - Bb- C - - - - - - -',
    explanation: '(walking through chord tones)',
    tips: ['Chromatic approaches', 'Quarter note rhythm', 'Outlines harmony']
  }
};

// Pattern categories for UI organization
export const PATTERN_CATEGORIES = [
  { id: 'pop', name: 'Pop', patterns: POP_PATTERNS },
  { id: 'edm', name: 'EDM', patterns: EDM_PATTERNS },
  { id: 'afroHouse', name: 'Afro House', patterns: AFRO_HOUSE_PATTERNS },
  { id: 'kpop', name: 'K-Pop', patterns: KPOP_PATTERNS }
];

// Helper function to parse notation to array
export function parseNotation(notation) {
  return notation.split(' ').map(char => {
    if (char === 'X') return { hit: true, accent: true };
    if (char === 'x') return { hit: true, accent: false };
    if (char === 'O') return { hit: true, accent: true, open: true };
    if (char === 'o') return { hit: true, accent: false, open: true };
    return { hit: false };
  });
}

// Helper function to apply swing to timing
export function applySwing(stepIndex, swingPercent) {
  // Swing affects off-beats (even indices in 16th notes)
  if (stepIndex % 2 === 1) {
    // Swing range: 50% = no swing, 66% = triplet swing
    const swingAmount = (swingPercent - 50) / 100;
    return stepIndex + swingAmount;
  }
  return stepIndex;
}

// Get all patterns as flat list
export function getAllPatterns() {
  const allPatterns = [];
  Object.entries(POP_PATTERNS).forEach(([key, pattern]) => {
    allPatterns.push({ ...pattern, id: `pop-${key}`, genre: 'pop' });
  });
  Object.entries(EDM_PATTERNS).forEach(([key, pattern]) => {
    allPatterns.push({ ...pattern, id: `edm-${key}`, genre: 'edm' });
  });
  Object.entries(AFRO_HOUSE_PATTERNS).forEach(([key, pattern]) => {
    allPatterns.push({ ...pattern, id: `afro-${key}`, genre: 'afroHouse' });
  });
  Object.entries(KPOP_PATTERNS).forEach(([key, pattern]) => {
    allPatterns.push({ ...pattern, id: `kpop-${key}`, genre: 'kpop' });
  });
  return allPatterns;
}

export default {
  GRID_NOTATION_GUIDE,
  DRUM_DETECTION_BANDS,
  SWING_VALUES,
  HUMANIZATION,
  POP_PATTERNS,
  EDM_PATTERNS,
  AFRO_HOUSE_PATTERNS,
  KPOP_PATTERNS,
  BASSLINE_PATTERNS,
  PATTERN_CATEGORIES
};
