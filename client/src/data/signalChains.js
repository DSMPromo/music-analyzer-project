/**
 * Signal Chains Data
 * Processing chains for vocals, synths, drums, and master bus
 * Based on the Music Production Master Template
 */

// Vocal chains by genre
export const VOCAL_CHAINS = {
  pop: {
    name: 'Pop Vocal Chain',
    description: 'Crystal clear, present vocals that cut through the mix',
    steps: [
      {
        order: 1,
        plugin: 'Gain Staging',
        settings: { input: '-18dBFS average' },
        note: 'Input at -18dBFS average for optimal processing headroom'
      },
      {
        order: 2,
        plugin: 'High-Pass Filter',
        settings: { freq: '80-100Hz', slope: '18dB/oct' },
        note: 'Remove rumble and low-end mud'
      },
      {
        order: 3,
        plugin: 'De-esser',
        settings: { freq: '6-8kHz', reduction: '3-6dB' },
        note: 'Control sibilance before compression emphasizes it'
      },
      {
        order: 4,
        plugin: 'Subtractive EQ',
        settings: {
          bands: [
            { freq: '200-400Hz', gain: '-2 to -3dB', q: '2', type: 'cut' }
          ]
        },
        note: 'Cut mud zone - clean up low-mid frequencies'
      },
      {
        order: 5,
        plugin: 'Compressor 1',
        settings: { threshold: '-18dBFS', ratio: '4:1', attack: '3-6ms', release: '50ms' },
        note: 'Fast compression to catch peaks and even dynamics'
      },
      {
        order: 6,
        plugin: 'Compressor 2',
        settings: { threshold: '-12dBFS', ratio: '2:1', attack: '20ms', release: '100ms' },
        note: 'Slower compression for smoothing and glue'
      },
      {
        order: 7,
        plugin: 'Additive EQ',
        settings: {
          bands: [
            { freq: '3-5kHz', gain: '+2dB', q: '1.5', type: 'boost' },
            { freq: '12kHz', gain: '+1.5dB', q: '0.7', type: 'shelf' }
          ]
        },
        note: 'Presence boost for clarity, air shelf for openness'
      },
      {
        order: 8,
        plugin: 'Saturation',
        settings: { drive: '10%', mix: '20%' },
        note: 'Subtle harmonic enhancement for warmth'
      },
      {
        order: 9,
        plugin: 'Reverb Send',
        settings: { type: 'plate', decay: '1.5-2s', predelay: '20ms' },
        note: 'Plate reverb for smooth, classic vocal sound'
      },
      {
        order: 10,
        plugin: 'Delay Send',
        settings: { time: '1/4 note', feedback: '25%', filter: 'LPF at 3kHz' },
        note: 'Filtered delay to add depth without clutter'
      }
    ]
  },
  edm: {
    name: 'EDM Vocal Chain',
    description: 'Heavily processed, compressed vocals that sit in dense mixes',
    steps: [
      {
        order: 1,
        plugin: 'High-Pass Filter',
        settings: { freq: '120Hz', slope: '24dB/oct' },
        note: 'Aggressive HPF to leave room for sub bass'
      },
      {
        order: 2,
        plugin: 'Gate',
        settings: { threshold: '-40dB', attack: '0.5ms', release: '100ms' },
        note: 'Reduce bleed between phrases'
      },
      {
        order: 3,
        plugin: 'De-esser',
        settings: { freq: '7kHz', reduction: '6-10dB' },
        note: 'Aggressive de-essing for dense mixes'
      },
      {
        order: 4,
        plugin: 'Compressor',
        settings: { threshold: '-20dBFS', ratio: '6:1', attack: '1ms', release: '50ms' },
        note: 'Heavy compression for consistent level - 6-10dB GR'
      },
      {
        order: 5,
        plugin: 'EQ',
        settings: {
          bands: [
            { freq: '300Hz', gain: '-4dB', type: 'cut' },
            { freq: '4kHz', gain: '+4dB', type: 'boost' }
          ]
        },
        note: 'Aggressive presence boost, cut mud'
      },
      {
        order: 6,
        plugin: 'Saturation/Distortion',
        settings: { type: 'parallel', mix: '30%' },
        note: 'Parallel saturation for grit and presence'
      },
      {
        order: 7,
        plugin: 'Sidechain',
        settings: { source: 'kick', ratio: '2:1', attack: '5ms', release: '100ms' },
        note: 'Gentle sidechain to kick for space'
      },
      {
        order: 8,
        plugin: 'Reverb',
        settings: { type: 'hall', decay: '3-4s', filter: 'HPF at 400Hz' },
        note: 'Long reverb for breakdowns, filtered'
      },
      {
        order: 9,
        plugin: 'Delay',
        settings: { time: 'tempo-synced', feedback: '40%', filter: 'LPF' },
        note: 'Tempo-synced delay, heavily filtered'
      }
    ]
  }
};

// Synth and instrument chains
export const SYNTH_CHAINS = {
  edmLead: {
    name: 'EDM Lead Synth',
    description: 'Cutting, present lead that dominates the drop',
    steps: [
      {
        order: 1,
        plugin: 'High-Pass Filter',
        settings: { freq: '80Hz' },
        note: 'Leave room for bass'
      },
      {
        order: 2,
        plugin: 'Multiband Compression',
        settings: { bands: 3, ratio: '2:1', threshold: 'per band' },
        note: 'Control dynamics per frequency band'
      },
      {
        order: 3,
        plugin: 'EQ',
        settings: {
          bands: [
            { freq: '200-400Hz', gain: '-3dB', type: 'cut' },
            { freq: '3kHz', gain: '+3dB', type: 'boost' }
          ]
        },
        note: 'Cut mud, boost presence'
      },
      {
        order: 4,
        plugin: 'Saturation',
        settings: { type: 'tape', drive: '20%' },
        note: 'Add harmonics for bite'
      },
      {
        order: 5,
        plugin: 'Stereo Widener',
        settings: { width: '120%', lowCut: '300Hz' },
        note: 'Widen only mid-highs, keep lows centered'
      },
      {
        order: 6,
        plugin: 'Sidechain',
        settings: { source: 'kick', ratio: '4:1', release: '100ms' },
        note: 'Sidechain to kick for pumping'
      },
      {
        order: 7,
        plugin: 'Reverb Send',
        settings: { type: 'room', decay: '1s' },
        note: 'Short-medium reverb for space'
      },
      {
        order: 8,
        plugin: 'Delay Send',
        settings: { time: '1/8 or 1/16', feedback: '30%' },
        note: 'Tempo-synced delay for rhythm'
      }
    ]
  },
  pad: {
    name: 'Pad/Atmosphere',
    description: 'Lush, wide pads that fill space',
    steps: [
      {
        order: 1,
        plugin: 'High-Pass Filter',
        settings: { freq: '150Hz' },
        note: 'Leave room for bass and kick'
      },
      {
        order: 2,
        plugin: 'Low-Pass Filter',
        settings: { freq: '10kHz' },
        note: 'Prevent harshness, create space for vocals'
      },
      {
        order: 3,
        plugin: 'Light Compression',
        settings: { ratio: '2:1', threshold: '-20dB' },
        note: 'Even out dynamics gently'
      },
      {
        order: 4,
        plugin: 'Reverb',
        settings: { type: 'hall', decay: '3-5s', mix: '50%' },
        note: 'Long, lush reverb'
      },
      {
        order: 5,
        plugin: 'Sidechain',
        settings: { source: 'kick', ratio: '6:1', release: '200ms' },
        note: 'Heavy duck for pumping effect'
      },
      {
        order: 6,
        plugin: 'Stereo Width',
        settings: { width: '150%' },
        note: 'Full stereo spread for envelopment'
      }
    ]
  }
};

// Kick and bass processing
export const KICK_BASS_CHAINS = {
  kick: {
    name: 'Kick Processing',
    description: 'Punchy, controlled kick drum',
    steps: [
      {
        order: 1,
        plugin: 'Gain Staging',
        settings: { peak: '-6dB' },
        note: 'Peak at -6dB for headroom'
      },
      {
        order: 2,
        plugin: 'High-Pass Filter',
        settings: { freq: '30Hz' },
        note: 'Remove subsonic rumble'
      },
      {
        order: 3,
        plugin: 'EQ',
        settings: {
          bands: [
            { freq: '50-60Hz', gain: '+3dB', type: 'boost', note: 'Sub thump' },
            { freq: '300Hz', gain: '-3dB', type: 'cut', note: 'Remove mud' },
            { freq: '3-5kHz', gain: '+2dB', type: 'boost', note: 'Click/attack' }
          ]
        },
        note: 'Shape frequency balance'
      },
      {
        order: 4,
        plugin: 'Compression',
        settings: {
          ratio: '4:1',
          attack: '10-30ms (slow for transient, fast for control)',
          release: '100ms'
        },
        note: 'Slow attack preserves punch, fast attack controls peaks'
      },
      {
        order: 5,
        plugin: 'Saturation',
        settings: { type: 'parallel', mix: '20%' },
        note: 'Blend saturation for harmonics'
      },
      {
        order: 6,
        plugin: 'Limiter',
        settings: { ceiling: '-1dB' },
        note: 'Catch any remaining peaks'
      }
    ]
  },
  subBass: {
    name: 'Sub Bass Processing',
    description: 'Clean, controlled sub frequencies',
    steps: [
      {
        order: 1,
        plugin: 'High-Pass Filter',
        settings: { freq: '30Hz' },
        note: 'Remove subsonic'
      },
      {
        order: 2,
        plugin: 'Low-Pass Filter',
        settings: { freq: '120-150Hz' },
        note: 'Keep it in sub range only'
      },
      {
        order: 3,
        plugin: 'Mono',
        settings: { mode: 'mono below 150Hz' },
        note: 'ESSENTIAL - sub must be mono'
      },
      {
        order: 4,
        plugin: 'Saturation',
        settings: { type: 'subtle', harmonics: '2nd + 3rd' },
        note: 'Adds harmonics audible on small speakers'
      },
      {
        order: 5,
        plugin: 'Compression',
        settings: { ratio: '3:1', attack: '20ms', release: '100ms' },
        note: 'Even out dynamics'
      },
      {
        order: 6,
        plugin: 'Sidechain',
        settings: { source: 'kick', ratio: '8:1', attack: '0.1ms', release: '150ms' },
        note: 'CRITICAL - duck under kick'
      }
    ]
  },
  kickBassRelationship: {
    name: 'Kick/Bass Relationship Options',
    description: 'Three approaches to kick and bass coexistence',
    options: [
      {
        name: 'Option A: Long Kick + Short Bass',
        description: 'Bass ducks under sustained kick',
        settings: 'Heavy sidechain on bass, kick dominates sub'
      },
      {
        name: 'Option B: Short Kick + Sustained Bass',
        description: 'Kick punches through sustained bass',
        settings: 'Tight kick tail, bass fills between kicks'
      },
      {
        name: 'Option C: Frequency Split',
        description: 'Different frequency emphasis',
        settings: 'Kick = 50Hz, Bass = 80Hz, EQ carving'
      }
    ]
  }
};

// Sidechain configuration
export const SIDECHAIN_CONFIG = {
  edm: {
    name: 'EDM Sidechain Settings',
    description: 'Aggressive pumping for electronic music',
    elements: {
      bass: { ratio: '8:1 to ∞:1', attack: '0.1-1ms', release: '100-200ms (tempo-synced)' },
      pads: { ratio: '4:1 to 8:1', attack: '1-5ms', release: '150-300ms' },
      leads: { ratio: '2:1 to 4:1', attack: '5-10ms', release: '100-150ms' }
    }
  },
  afroHouse: {
    name: 'Afro House Sidechain',
    description: 'Gentler than EDM, creates groove without obvious pumping',
    settings: {
      ratio: '2:1 to 4:1',
      attack: '5-15ms (slower, more natural)',
      release: '200-400ms (longer, smoother)',
      threshold: 'Higher (less aggressive)'
    }
  }
};

// Master bus chain
export const MASTER_BUS_CHAIN = {
  name: 'Master Bus Chain',
  description: 'Final processing for cohesive, polished mix',
  rules: [
    'If you need heavy processing here, fix it in the mix',
    'Less than 3dB total gain reduction ideal',
    'Always A/B with bypass',
    'Check mono compatibility',
    'Reference against commercial tracks'
  ],
  steps: [
    {
      order: 1,
      plugin: 'Gain',
      settings: { input: '-6dB headroom' },
      note: 'Set input to -6dB headroom for mastering'
    },
    {
      order: 2,
      plugin: 'Subtractive EQ',
      settings: { mode: 'surgical cuts only' },
      note: 'Only cut problem frequencies, no boosts'
    },
    {
      order: 3,
      plugin: 'Multiband Compression',
      settings: { bands: '3-4', ratio: '1.5:1', gr: '1-2dB per band' },
      note: 'Gentle, 1-2dB per band maximum'
    },
    {
      order: 4,
      plugin: 'Stereo Width',
      settings: { mode: 'mid-side', enhancement: 'subtle' },
      note: 'Subtle mid-side enhancement'
    },
    {
      order: 5,
      plugin: 'Soft Clipper',
      settings: { ceiling: '-2dB', gr: '1-2dB' },
      note: 'Catch transients, 1-2dB'
    },
    {
      order: 6,
      plugin: 'Limiter',
      settings: { ceiling: '-1dBTP', lookahead: '5ms' },
      note: 'Final ceiling, True Peak -1dB'
    },
    {
      order: 7,
      plugin: 'Meter',
      settings: { mode: 'LUFS + True Peak' },
      note: 'Monitor LUFS and True Peak'
    }
  ]
};

// Gain staging reference
export const GAIN_STAGING = {
  input: { level: '-18 to -12dBFS avg', peak: '-6dBFS max', note: 'Recording input' },
  trackFaders: { level: 'Near 0dB (unity)', note: 'Use clip/trim gain instead of faders' },
  busOutputs: { level: '-6 to -3dBFS', note: 'Headroom for summing' },
  masterInput: { level: '-6dBFS avg', note: 'Headroom for mastering' }
};

// Frequency allocation guide
export const FREQUENCY_ALLOCATION = {
  subBass: {
    range: '20-60Hz',
    elements: 'Kick sub, Bass sub ONLY',
    tip: 'MONO ONLY. Check on sub. Highpass everything else.'
  },
  bass: {
    range: '60-200Hz',
    elements: 'Kick body, Bass body, warm synths',
    tip: 'Kick and bass must not clash. Use sidechain.'
  },
  lowMids: {
    range: '200-500Hz',
    elements: 'Body of instruments, potential mud zone',
    tip: 'MUD ZONE. Cut aggressively on most elements.'
  },
  mids: {
    range: '500Hz-2kHz',
    elements: 'Vocal presence, snare body, synth presence',
    tip: 'Careful EQ. Important range for clarity.'
  },
  highMids: {
    range: '2-6kHz',
    elements: 'Brightness, presence, vocal clarity',
    tip: 'Can be harsh on big systems. De-ess here.'
  },
  highs: {
    range: '6-20kHz',
    elements: 'Air, shimmer, cymbals',
    tip: 'Rolls off naturally in clubs. Add for studio.'
  }
};

// Helper function to get chain by type
export function getChain(type, subtype) {
  switch (type) {
    case 'vocal':
      return VOCAL_CHAINS[subtype] || VOCAL_CHAINS.pop;
    case 'synth':
      return SYNTH_CHAINS[subtype] || SYNTH_CHAINS.edmLead;
    case 'kickBass':
      return KICK_BASS_CHAINS[subtype] || KICK_BASS_CHAINS.kick;
    case 'master':
      return MASTER_BUS_CHAIN;
    default:
      return null;
  }
}

// Helper function to format settings as string
export function formatSettings(settings) {
  if (typeof settings === 'string') return settings;
  return Object.entries(settings)
    .map(([key, value]) => `${key}: ${value}`)
    .join(', ');
}

export default {
  VOCAL_CHAINS,
  SYNTH_CHAINS,
  KICK_BASS_CHAINS,
  SIDECHAIN_CONFIG,
  MASTER_BUS_CHAIN,
  GAIN_STAGING,
  FREQUENCY_ALLOCATION
};
