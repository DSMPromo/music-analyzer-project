/**
 * Music Theory Data
 * Modes, chord progressions, melody construction, tension/release
 * Based on the Music Production Master Template
 */

// Modal color palette
export const MODES = {
  ionian: {
    name: 'Ionian (Major)',
    intervals: [0, 2, 4, 5, 7, 9, 11],
    character: 'Bright, resolved',
    emotion: 'Happy, triumphant',
    genreUse: 'Pop choruses, uplifting EDM',
    color: '#f59e0b',
    tips: ['Default "happy" sound', 'Strong resolution to tonic', 'Great for feel-good sections']
  },
  dorian: {
    name: 'Dorian',
    intervals: [0, 2, 3, 5, 7, 9, 10],
    character: 'Minor but hopeful',
    emotion: 'Soulful, groovy',
    genreUse: 'Afro House (primary), Neo-soul',
    color: '#10b981',
    tips: ['Minor with raised 6th', 'Less dark than natural minor', 'Perfect for groovy, soulful music']
  },
  phrygian: {
    name: 'Phrygian',
    intervals: [0, 1, 3, 5, 7, 8, 10],
    character: 'Dark, exotic',
    emotion: 'Tension, mystery',
    genreUse: 'Flamenco, metal, dark EDM',
    color: '#6366f1',
    tips: ['Flat 2nd creates tension', 'Spanish/Middle Eastern flavor', 'Great for dark, mysterious sections']
  },
  lydian: {
    name: 'Lydian',
    intervals: [0, 2, 4, 6, 7, 9, 11],
    character: 'Dreamy, floating',
    emotion: 'Wonder, ethereal',
    genreUse: 'Film scores, ambient',
    color: '#ec4899',
    tips: ['Raised 4th creates dreamy quality', 'Floating, unresolved feeling', 'Common in film scores']
  },
  mixolydian: {
    name: 'Mixolydian',
    intervals: [0, 2, 4, 5, 7, 9, 10],
    character: 'Major but earthy',
    emotion: 'Relaxed groove',
    genreUse: 'Blues, rock, funk',
    color: '#f97316',
    tips: ['Major with flat 7th', 'Bluesy, earthy quality', 'Great for relaxed grooves']
  },
  aeolian: {
    name: 'Aeolian (Natural Minor)',
    intervals: [0, 2, 3, 5, 7, 8, 10],
    character: 'Dark, melancholic',
    emotion: 'Sad, introspective',
    genreUse: 'Pop verses, emotional EDM',
    color: '#3b82f6',
    tips: ['Default "sad" sound', 'Natural minor scale', 'Very common in pop and EDM']
  },
  locrian: {
    name: 'Locrian',
    intervals: [0, 1, 3, 5, 6, 8, 10],
    character: 'Unstable, dissonant',
    emotion: 'Unresolved tension',
    genreUse: 'Rarely used (experimental)',
    color: '#94a3b8',
    tips: ['Diminished tonic chord', 'Very unstable', 'Use sparingly for effect']
  }
};

// Genre-specific key recommendations
export const KEY_RECOMMENDATIONS = {
  pop: {
    recommended: ['C Major', 'G Major', 'A Minor', 'E Minor'],
    reason: 'Guitar-friendly keys, easy singalong range',
    tips: ['C Major and G Major most common', 'Minor keys for emotional verses', 'Consider vocal range']
  },
  edm: {
    recommended: ['A Minor', 'F Minor', 'C Minor', 'F Major'],
    reason: 'Dark energy (minor) or euphoric (F Major)',
    tips: ['A Minor most common in EDM', 'F Major for euphoric, uplifting tracks', 'Minor keys for dark energy']
  },
  afroHouse: {
    recommended: ['D Dorian', 'G Dorian', 'A Dorian'],
    reason: 'Soulful groove, positive minor feel',
    tips: ['Dorian is THE Afro House mode', 'Raised 6th adds soul without darkness', 'Stay in one key for hypnotic effect']
  },
  kpop: {
    recommended: ['Variable - may modulate 2-3 times'],
    reason: 'Genre fluidity demands key changes',
    tips: ['Key changes are a K-pop signature', '+2 semitone modulation common for final chorus', 'Different keys for different sections']
  }
};

// Chord progressions by genre
export const CHORD_PROGRESSIONS = {
  pop: {
    canon: {
      name: 'Pop Canon',
      numerals: 'I - V - vi - IV',
      example: 'C - G - Am - F',
      songs: ['Let It Be', 'No Woman No Cry', "Don't Stop Believin'"],
      emotion: 'Uplifting, familiar',
      tips: ['Most common pop progression', 'Works in almost any genre', 'Rotate starting position for variation']
    },
    sensitive: {
      name: 'Sensitive',
      numerals: 'vi - IV - I - V',
      example: 'Am - F - C - G',
      songs: ['Titanium', 'Grenade', 'Poker Face'],
      emotion: 'Emotional, minor start',
      tips: ['Same chords as Canon, different start', 'Starting on vi creates emotional quality', 'Very common in modern pop']
    },
    doowop: {
      name: '50s Doo-Wop',
      numerals: 'I - vi - IV - V',
      example: 'C - Am - F - G',
      songs: ['Stand By Me', 'Earth Angel'],
      emotion: 'Nostalgic, classic',
      tips: ['Classic 50s sound', 'Creates nostalgic feeling', 'Works well with vocal harmonies']
    },
    optimistic: {
      name: 'Optimistic',
      numerals: 'I - IV - vi - V',
      example: 'C - F - Am - G',
      songs: ['Counting Stars', 'Shut Up and Dance'],
      emotion: 'Bright, energetic',
      tips: ['Starts major, dips to minor', 'Creates motion and energy', 'Great for upbeat tracks']
    }
  },
  edm: {
    anthemic: {
      name: 'Anthemic',
      numerals: 'i - VI - III - VII',
      example: 'Am - F - C - G',
      songs: ['Wake Me Up', 'Animals'],
      emotion: 'Epic, powerful',
      tips: ['Standard EDM progression', 'Works for builds and drops', 'Creates anthemic feel']
    },
    darkDrive: {
      name: 'Dark Drive',
      numerals: 'i - VII - VI - VII',
      example: 'Am - G - F - G',
      songs: ['Scary Monsters', 'Bangarang'],
      emotion: 'Dark, driving',
      tips: ['VII chord creates momentum', 'Dark but energetic', 'Good for aggressive drops']
    },
    epicBuild: {
      name: 'Epic Build',
      numerals: 'i - iv - VI - V',
      example: 'Am - Dm - F - E',
      songs: ['Levels', 'Strobe'],
      emotion: 'Building, emotional',
      tips: ['V chord creates strong pull', 'Perfect for build sections', 'Resolves dramatically']
    }
  },
  afroHouse: {
    classic: {
      name: 'Classic Afro',
      numerals: 'i - IV - i - IV',
      example: 'Dm - G - Dm - G',
      songs: ['Black Coffee tracks'],
      emotion: 'Hypnotic, groovy',
      tips: ['Simple but effective', 'Two-chord vamp creates hypnotic feel', 'Let the groove do the work']
    },
    extended: {
      name: 'Extended',
      numerals: 'i - IV - VII - IV',
      example: 'Dm - G - C - G',
      songs: ['Keinemusik releases'],
      emotion: 'Soulful, moving',
      tips: ['Adds VII for movement', 'More melodic interest', 'Still maintains groove']
    },
    hypnotic: {
      name: 'Hypnotic',
      numerals: 'i - ii (2 bars each)',
      example: 'Dm - Em (sustained)',
      songs: ['Deep Afro tracks'],
      emotion: 'Trance-like, meditative',
      tips: ['Minimal chord movement', 'Long sustains', 'Meditative, trance-inducing']
    }
  }
};

// Melody and hook construction
export const MELODY_CONSTRUCTION = {
  hookFormula: {
    title: 'Hook Formula',
    description: 'Great hooks share common characteristics',
    elements: [
      { name: 'Rhythmic Identity', description: 'Distinctive rhythm that\'s instantly recognizable' },
      { name: 'Repetition', description: '2-4 word phrase repeated 2-4 times' },
      { name: 'Range', description: 'Usually within one octave (singable)' },
      { name: 'Peak Note', description: 'One clear high point for emotional impact' },
      { name: 'Resolution', description: 'Ends on stable note (usually root or fifth)' }
    ]
  },
  contours: {
    ascending: {
      symbol: '↗',
      name: 'Ascending',
      emotion: 'Creates anticipation, energy, hope',
      use: 'Pre-choruses, builds'
    },
    descending: {
      symbol: '↘',
      name: 'Descending',
      emotion: 'Creates resolution, sadness, calm',
      use: 'Endings, resolutions'
    },
    arch: {
      symbol: '↗↘',
      name: 'Arch',
      emotion: 'Tension then release',
      use: 'Most common - choruses, hooks'
    },
    inverse: {
      symbol: '↘↗',
      name: 'Inverse Arch',
      emotion: 'Surprising, question-answer feel',
      use: 'Interesting variation'
    },
    wave: {
      symbol: '↗↘↗↘',
      name: 'Wave',
      emotion: 'Extended emotional journey',
      use: 'Longer melodies, verses'
    }
  },
  noteDuration: {
    verse: 'Mix of short and long notes, more rhythmic variety',
    prechorus: 'Notes tend to get longer, building tension',
    chorus: 'Longer, sustained notes on key words',
    hook: 'Simple rhythm, emphasis on title words'
  }
};

// Tension and release devices
export const TENSION_RELEASE = {
  harmonic: {
    suspension: {
      name: 'Suspension',
      description: 'Hold note from previous chord (e.g., Csus4 → C)',
      effect: 'Creates gentle tension then resolution',
      example: 'Csus4 → C, Dsus2 → D'
    },
    dominant7th: {
      name: 'Dominant 7th',
      description: 'V7 chord creates strong pull to I',
      effect: 'Maximum harmonic tension',
      example: 'G7 → C (in key of C)'
    },
    deceptiveCadence: {
      name: 'Deceptive Cadence',
      description: 'V → vi instead of V → I',
      effect: 'Surprise, prolongs journey',
      example: 'G → Am instead of G → C'
    },
    modalInterchange: {
      name: 'Modal Interchange',
      description: 'Borrow chord from parallel minor/major',
      effect: 'Color change, unexpected flavor',
      example: 'In C Major, use Fm (from C minor)'
    }
  },
  production: {
    filterSweep: {
      name: 'Filter Sweep',
      howItWorks: 'Low-pass → open or high-pass → close',
      whenToUse: 'Builds, transitions, intros',
      tips: 'Automate cutoff frequency over 4-16 bars'
    },
    riser: {
      name: 'Riser',
      howItWorks: 'White noise + pitch ascending',
      whenToUse: 'Pre-drop builds',
      tips: 'Increase length with section length'
    },
    snareRoll: {
      name: 'Snare Roll',
      howItWorks: 'Accelerating snare hits',
      whenToUse: '8-16 bars before drop',
      tips: 'Start slow, accelerate to drop point'
    },
    downlifter: {
      name: 'Downlifter',
      howItWorks: 'Pitch descending noise',
      whenToUse: 'After drop, transitions',
      tips: 'Signals energy decrease'
    },
    dropout: {
      name: 'Dropout',
      howItWorks: 'Sudden silence/minimal elements',
      whenToUse: 'Before chorus, surprise',
      tips: 'K-pop signature: build then STOP'
    },
    reverseReverb: {
      name: 'Reverse Reverb',
      howItWorks: 'Reversed reverb tail before sound',
      whenToUse: 'Vocal entrances',
      tips: 'Creates "sucking in" effect'
    }
  }
};

// Common chord substitutions
export const CHORD_SUBSTITUTIONS = {
  tritone: {
    name: 'Tritone Substitution',
    description: 'Replace V7 with bII7 (same tritone)',
    example: 'G7 → Db7 before C',
    effect: 'Jazz flavor, chromatic bass movement'
  },
  relative: {
    name: 'Relative Major/Minor',
    description: 'Replace major with its relative minor (or vice versa)',
    example: 'C can be substituted with Am',
    effect: 'Changes mood while keeping similar function'
  },
  secondary: {
    name: 'Secondary Dominant',
    description: 'V7 of any chord, not just I',
    example: 'D7 → G (D7 is V7/V in key of C)',
    effect: 'Creates momentary tonicization'
  },
  parallel: {
    name: 'Parallel Major/Minor',
    description: 'Replace with same root, opposite quality',
    example: 'C → Cm',
    effect: 'Dramatic mood shift'
  }
};

// Helper function to get mode by name
export function getMode(modeName) {
  const normalizedName = modeName.toLowerCase();
  return MODES[normalizedName] || MODES.ionian;
}

// Helper function to transpose chord progression
export function transposeProgression(progression, semitones) {
  const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  return progression.split(' - ').map(chord => {
    const match = chord.match(/^([A-G][#b]?)(.*)/);
    if (!match) return chord;

    const [, root, quality] = match;
    const rootIndex = noteOrder.indexOf(root.replace('b', '#'));
    if (rootIndex === -1) return chord;

    const newIndex = (rootIndex + semitones + 12) % 12;
    return noteOrder[newIndex] + quality;
  }).join(' - ');
}

// Helper function to get progressions for genre
export function getProgressionsForGenre(genre) {
  return CHORD_PROGRESSIONS[genre] || CHORD_PROGRESSIONS.pop;
}

export default {
  MODES,
  KEY_RECOMMENDATIONS,
  CHORD_PROGRESSIONS,
  MELODY_CONSTRUCTION,
  TENSION_RELEASE,
  CHORD_SUBSTITUTIONS
};
