/**
 * Reference Data
 * Reference artists, troubleshooting guide, practice exercises, quick reference
 * Based on the Music Production Master Template
 */

// Reference artists by genre
export const REFERENCE_ARTISTS = {
  pop: [
    {
      name: 'Max Martin',
      specialty: 'Structural perfection, hook density',
      techniques: ['Pre-chorus lift', 'Layered hooks', 'Dynamic contrast'],
      referenceTracks: ['...Baby One More Time', 'Blinding Lights', 'Can\'t Feel My Face'],
      signatureSound: 'Crystal clear vocals, big drums, memorable melodies'
    },
    {
      name: 'Jack Antonoff',
      specialty: 'Organic + electronic blend',
      techniques: ['Vintage synths', 'Live drums with electronic elements', 'Atmospheric production'],
      referenceTracks: ['Style (Taylor Swift)', 'Green Light (Lorde)'],
      signatureSound: 'Retro synths, emotional builds, indie-pop aesthetic'
    },
    {
      name: 'Finneas',
      specialty: 'Minimal, vocal-focused production',
      techniques: ['Sparse arrangements', 'Intimate sound', 'Creative sampling'],
      referenceTracks: ['Bad Guy', 'Ocean Eyes', 'When the Party\'s Over'],
      signatureSound: 'Whispered vocals, deep bass, minimalist approach'
    },
    {
      name: 'The Neptunes',
      specialty: 'Rhythmic innovation',
      techniques: ['Unusual drum patterns', 'Minimal instrumentation', 'Syncopation'],
      referenceTracks: ['Grindin\'', 'Drop It Like It\'s Hot'],
      signatureSound: 'Sparse beats, distinctive drums, groove-focused'
    }
  ],
  edm: [
    {
      name: 'Swedish House Mafia',
      specialty: 'Anthemic builds, emotional drops',
      techniques: ['Progressive layering', 'Massive reverbs', 'Supersaw stacks'],
      referenceTracks: ['Don\'t You Worry Child', 'Greyhound', 'Save The World'],
      signatureSound: 'Epic builds, euphoric drops, festival energy'
    },
    {
      name: 'Disclosure',
      specialty: 'UK garage influence',
      techniques: ['2-step rhythms', 'Vocal chops', 'Deep bass'],
      referenceTracks: ['Latch', 'White Noise', 'When a Fire Starts to Burn'],
      signatureSound: 'Garage rhythms, soulful vocals, UK bass culture'
    },
    {
      name: 'ODESZA',
      specialty: 'Organic electronic',
      techniques: ['Live instrumentation', 'World music samples', 'Emotional dynamics'],
      referenceTracks: ['Say My Name', 'A Moment Apart'],
      signatureSound: 'Organic textures, cinematic scope, emotional journeys'
    },
    {
      name: 'Skrillex',
      specialty: 'Bass design, impact',
      techniques: ['Heavy sound design', 'Complex automation', 'Aggressive drops'],
      referenceTracks: ['Scary Monsters and Nice Sprites', 'Bangarang'],
      signatureSound: 'Aggressive bass, innovative sound design, high energy'
    }
  ],
  afroHouse: [
    {
      name: 'Black Coffee',
      specialty: 'Deep, soulful, restrained',
      techniques: ['Subtle builds', 'Organic percussion', 'Minimal melodic elements'],
      referenceTracks: ['Drive', 'You Need Me', '10 Missed Calls'],
      signatureSound: 'Deep grooves, spiritual quality, DJ-focused arrangements'
    },
    {
      name: 'Keinemusik',
      specialty: 'European Afro house',
      techniques: ['Layered percussion', 'Vocal samples', 'Melodic house elements'],
      referenceTracks: ['&ME - The Rapture', 'Rampa - Everything'],
      signatureSound: 'Berlin meets Africa, sophisticated production, dancefloor focus'
    },
    {
      name: 'Da Capo',
      specialty: 'South African roots',
      techniques: ['Traditional percussion', 'Spiritual themes', 'Deep atmospheres'],
      referenceTracks: ['Afrika', 'Zone Out'],
      signatureSound: 'Authentic African elements, spiritual journey, deep grooves'
    },
    {
      name: 'Enoo Napa',
      specialty: 'Modern Afro tech',
      techniques: ['Tech house elements', 'Complex rhythms', 'Evolving arrangements'],
      referenceTracks: ['Forge', 'The Third'],
      signatureSound: 'Afro tech fusion, progressive builds, hypnotic grooves'
    }
  ],
  kpop: [
    {
      name: 'Teddy Park',
      specialty: 'Genre-bending (BLACKPINK)',
      techniques: ['Multiple genre switches', 'Trap + pop fusion', 'Dramatic dynamics'],
      referenceTracks: ['DDU-DU DDU-DU', 'Kill This Love', 'How You Like That'],
      signatureSound: 'Hard-hitting drops, genre blending, theatrical production'
    },
    {
      name: 'PDOGG',
      specialty: 'Emotional dynamics (BTS)',
      techniques: ['Orchestral elements', 'Hip-hop production', 'Layered arrangements'],
      referenceTracks: ['Fake Love', 'Blood Sweat & Tears', 'Spring Day'],
      signatureSound: 'Emotional depth, complex arrangements, hip-hop influence'
    },
    {
      name: 'The Stereotypes',
      specialty: 'Hybrid production (NCT)',
      techniques: ['R&B elements', 'Experimental sections', 'Dense arrangements'],
      referenceTracks: ['Kick It', 'Simon Says'],
      signatureSound: 'Experimental, R&B influenced, unpredictable structures'
    },
    {
      name: 'Ryan Jhun',
      specialty: 'Vocal production, hooks',
      techniques: ['Layered vocals', 'Catchy melodies', 'Clean mixes'],
      referenceTracks: ['Growl (EXO)', 'Tempo (EXO)'],
      signatureSound: 'Vocal-forward, melodic hooks, polished production'
    }
  ]
};

// Troubleshooting guide
export const TROUBLESHOOTING = {
  muddy: {
    problem: 'Mix sounds muddy',
    symptoms: ['Lack of clarity', 'Bass and low-mids overwhelming', 'Instruments blend together'],
    causes: ['Too much energy 200-400Hz', 'No HPF on instruments', 'Overlapping bass elements'],
    solutions: [
      { action: 'HPF everything above 100Hz except kick/bass', priority: 1 },
      { action: 'Cut 200-400Hz on guitars, keys, vocals', priority: 2 },
      { action: 'Check kick/bass phase relationship', priority: 3 }
    ],
    relatedTopics: ['signal-chains/kick-bass', 'mixing/frequency-allocation']
  },
  vocalsLost: {
    problem: 'Vocals lost in mix',
    symptoms: ['Lyrics hard to understand', 'Vocal sounds buried', 'Competing frequencies'],
    causes: ['Too much 2-5kHz in instruments', 'Insufficient vocal compression', 'Masking'],
    solutions: [
      { action: 'Cut competing elements at 2-5kHz', priority: 1 },
      { action: 'Use sidechain from vocal to instruments', priority: 2 },
      { action: 'Boost vocal presence at 3-4kHz', priority: 3 }
    ],
    relatedTopics: ['signal-chains/vocal', 'mixing/frequency-allocation']
  },
  noPunch: {
    problem: 'No punch in kick',
    symptoms: ['Kick feels weak', 'Lost in mix', 'No chest impact'],
    causes: ['Phase issues with bass', 'Over-compression', 'Missing click frequency'],
    solutions: [
      { action: 'Check kick/bass phase alignment', priority: 1 },
      { action: 'Boost click at 3-5kHz', priority: 2 },
      { action: 'Try slower compressor attack to preserve transient', priority: 3 }
    ],
    relatedTopics: ['signal-chains/kick-bass', 'compression']
  },
  thin: {
    problem: 'Mix sounds thin',
    symptoms: ['Lacking warmth', 'No body', 'Sounds small'],
    causes: ['Over-cutting low end', 'Not enough layers', 'No saturation/harmonics'],
    solutions: [
      { action: 'Check low end balance - may have cut too much', priority: 1 },
      { action: 'Add subtle saturation to warm up', priority: 2 },
      { action: 'Layer sounds for fullness', priority: 3 }
    ],
    relatedTopics: ['mixing/frequency-allocation', 'signal-chains']
  },
  harsh: {
    problem: 'Mix sounds harsh/fatiguing',
    symptoms: ['Ear fatigue', 'Sibilance', 'Painful at high volume'],
    causes: ['Too much 2-4kHz', 'Aggressive limiting', 'No de-essing'],
    solutions: [
      { action: 'Cut 2-4kHz on offending elements', priority: 1 },
      { action: 'Use de-esser on vocals', priority: 2 },
      { action: 'Check limiters - may be too aggressive', priority: 3 }
    ],
    relatedTopics: ['signal-chains/vocal', 'mastering']
  },
  noWidth: {
    problem: 'No stereo width/depth',
    symptoms: ['Sounds mono', 'Flat soundstage', 'No separation'],
    causes: ['Everything panned center', 'No stereo processing', 'Mono bass taking up space'],
    solutions: [
      { action: 'Pan elements hard left and right', priority: 1 },
      { action: 'Use stereo widener on buses (mid-highs only)', priority: 2 },
      { action: 'Ensure bass is mono (frees up stereo space)', priority: 3 }
    ],
    relatedTopics: ['mixing/stereo']
  },
  clipping: {
    problem: 'Clipping/distortion',
    symptoms: ['Digital crackling', 'Red meters', 'Harsh distortion'],
    causes: ['Gain staging too hot', 'No headroom', 'Limiter overworked'],
    solutions: [
      { action: 'Check gain staging - pull everything back', priority: 1 },
      { action: 'Add headroom before master', priority: 2 },
      { action: 'Use clip gain, not faders', priority: 3 }
    ],
    relatedTopics: ['gain-staging', 'mastering']
  },
  timing: {
    problem: 'Timing feels off',
    symptoms: ['Not grooving', 'Feels mechanical or sloppy', 'Doesn\'t flow'],
    causes: ['Wrong swing setting', 'Over-quantized', 'Conflicting swing values'],
    solutions: [
      { action: 'Check swing settings match genre', priority: 1 },
      { action: 'Quantize then add subtle humanization', priority: 2 },
      { action: 'Layer rhythms with different swing values (Afro)', priority: 3 }
    ],
    relatedTopics: ['rhythm-patterns/swing', 'humanization']
  }
};

// Practice exercises by week
export const PRACTICE_EXERCISES = {
  week1: {
    theme: 'Structure',
    exercises: [
      {
        days: '1-2',
        title: 'Structure Analysis',
        task: 'Map structure of 3 reference tracks (your genre)',
        criteria: ['Identify all sections', 'Mark bar numbers', 'Note energy levels']
      },
      {
        days: '3-4',
        title: 'Section Creation',
        task: 'Create 8-bar loops for intro, verse, chorus',
        criteria: ['Match genre energy levels', 'Use appropriate elements', 'Apply structure rules']
      },
      {
        days: '5-7',
        title: 'Full Arrangement',
        task: 'Arrange full structure using only loops',
        criteria: ['Follow genre template', 'Maintain energy curve', 'Add transitions']
      }
    ]
  },
  week2: {
    theme: 'Rhythm',
    exercises: [
      {
        days: '1-2',
        title: 'Drum Programming',
        task: 'Program drums for each genre without samples',
        criteria: ['Match genre patterns', 'Use correct swing', 'Layer appropriately']
      },
      {
        days: '3-4',
        title: 'Percussion Layers',
        task: 'Layer percussion (focus on variation every 8 bars)',
        criteria: ['Add fills at phrase boundaries', 'Vary intensity', 'Maintain groove']
      },
      {
        days: '5-7',
        title: 'Humanization',
        task: 'Add swing and humanization, compare before/after',
        criteria: ['Apply genre-appropriate swing', 'Add velocity variation', 'Maintain feel']
      }
    ]
  },
  week3: {
    theme: 'Harmony',
    exercises: [
      {
        days: '1-2',
        title: 'Progressions',
        task: 'Write progressions for verse and chorus',
        criteria: ['Use genre-appropriate chords', 'Create contrast', 'Support melody']
      },
      {
        days: '3-4',
        title: 'Bass Lines',
        task: 'Add bass that complements progression',
        criteria: ['Follow root movement', 'Add rhythmic interest', 'Check kick/bass relationship']
      },
      {
        days: '5-7',
        title: 'Harmonic Layers',
        task: 'Layer pads and harmonic content',
        criteria: ['Avoid frequency clashes', 'Support but don\'t dominate', 'Create movement']
      }
    ]
  },
  week4: {
    theme: 'Mixing',
    exercises: [
      {
        days: '1-2',
        title: 'Gain Staging',
        task: 'Gain stage a full session',
        criteria: ['All channels at -18dBFS average', 'Master input at -6dB', 'No clipping']
      },
      {
        days: '3-4',
        title: 'Signal Chains',
        task: 'Apply signal chains to each element',
        criteria: ['Follow chain order', 'Adjust to taste', 'Check phase']
      },
      {
        days: '5-7',
        title: 'Master & Reference',
        task: 'Master and reference against commercial track',
        criteria: ['Match loudness', 'Compare frequency balance', 'Check translation']
      }
    ]
  }
};

// Quick reference cards
export const QUICK_REFERENCE = {
  structure: {
    title: 'Structure Quick Reference',
    content: {
      pop: 'Intro(8) V1(16) Pre(8) Ch(16) V2(16) Pre(8) Ch(16) Br(16) Ch(32) = 144 bars',
      edm: 'Intro(32) Drop(32) BD(32) Drop(32) Outro(32) = 160 bars',
      afro: 'Intro(64) GrooveA(64) BD(32) GrooveB(64) Outro(64) = 288 bars',
      kpop: 'Intro(8) V1(16) Pre(8) Ch(16) Post(8) V2(16) Pre(8) Ch(16) Br(16) Dnc(8) Ch(24) = 144 bars'
    }
  },
  frequency: {
    title: 'Frequency Quick Reference',
    content: {
      sub: '30-60Hz (Kick/Bass sub - MONO)',
      bass: '60-200Hz (Kick/Bass body)',
      lowMid: '200-500Hz (CUT - mud zone)',
      mid: '500-2kHz (Vocal/Snare body)',
      hiMid: '2-6kHz (Presence/Brightness)',
      high: '6-20kHz (Air/Shimmer)'
    }
  },
  loudness: {
    title: 'Loudness Quick Reference',
    content: {
      streaming: '-14 LUFS integrated, -1 dBTP',
      club: '-8 to -10 LUFS, -0.5 dBTP',
      headroom: '-6dB for mastering'
    }
  },
  compression: {
    title: 'Compression Quick Reference',
    content: {
      vocal: '4:1, medium attack, fast release',
      drums: '4:1-8:1, fast attack, medium release',
      bass: '4:1, medium all, sidechain to kick',
      master: '1.5:1-2:1, slow attack, auto release'
    }
  },
  swing: {
    title: 'Swing Quick Reference',
    content: {
      edm: '0-50% (straight, mechanical)',
      pop: '50-55% (slight groove)',
      afroHouse: '55-65% (heavy swing)',
      kpop: 'Variable (depends on section)'
    }
  }
};

// DAW configurations
export const DAW_CONFIGS = {
  logicPro: {
    name: 'Logic Pro',
    projectSettings: {
      sampleRate: '48kHz (or 44.1kHz for purely music)',
      bitDepth: '24-bit',
      bufferSize: '128 samples (recording) / 1024 (mixing)',
      ioBuffer: 'Enabled'
    },
    trackOrganization: [
      '01-10: Drums (Kick, Snare, Hats, Perc)',
      '11-20: Bass (Sub, Mid, Layer)',
      '21-40: Synths (Leads, Pads, Arps)',
      '41-50: Vocals (Lead, Backs, FX)',
      '51-60: FX (Risers, Downlifters, Impacts)',
      '61-70: Buses (Drum Bus, Music Bus, Vocal Bus)'
    ],
    keyCommands: ['R: Record', 'C: Cycle', 'X: Mixer', 'B: Smart Controls', 'Cmd+K: Keyboard']
  },
  ableton: {
    name: 'Ableton Live',
    projectSettings: {
      sampleRate: '48kHz',
      bufferSize: '128 (performance) / 512+ (mixing)',
      warpMode: 'Complex Pro (for full tracks)'
    },
    sessionViewOrganization: [
      'Group 1: DRUMS (Kick, Snare, Hats, Perc)',
      'Group 2: BASS (Sub, Mid)',
      'Group 3: MUSIC (Synths, Keys, Guitars)',
      'Group 4: VOCALS (Lead, Backs)',
      'Group 5: FX (Risers, Impacts)'
    ],
    tips: [
      'Create locators at every 8 bars',
      'Color-code sections (Intro=Blue, Verse=Green, etc.)',
      'Use arrangement loop for section editing'
    ]
  },
  flStudio: {
    name: 'FL Studio',
    audioSettings: {
      driver: 'ASIO (essential for low latency)',
      bufferSize: '256-512 samples',
      sampleRate: '48kHz'
    },
    mixerOrganization: [
      'Insert 1-10: Drums',
      'Insert 11-15: Bass',
      'Insert 16-30: Synths',
      'Insert 31-40: Vocals',
      'Insert 90-99: Buses',
      'Insert 100: Master'
    ],
    tips: [
      'Name patterns clearly (Kick_Main, Snare_Verse, etc.)',
      'Color-code by type',
      'Group related patterns in playlist'
    ]
  },
  proTools: {
    name: 'Pro Tools',
    sessionSettings: {
      sampleRate: '48kHz',
      bitDepth: '24-bit',
      buffer: '128 (tracking) / 1024 (mixing)',
      delayCompensation: 'On'
    },
    trackLayout: [
      'Aux 1-4: Drum Bus, Bass Bus, Music Bus, Vocal Bus',
      'Audio Tracks organized by type',
      'VCA Masters for group control'
    ],
    editModes: [
      'Slip Mode: General editing',
      'Grid Mode: Quantized edits',
      'Shuffle: Maintains arrangement'
    ]
  }
};

// Stem export standards
export const STEM_EXPORT_STANDARDS = {
  format: 'WAV 48kHz/24-bit',
  dithering: 'None (save for final master)',
  normalize: 'Off',
  startPoint: 'All from bar 1 (same start point)',
  stems: [
    { name: 'DRUMS', contents: 'All drums summed', processing: 'Bus compression, no limiting' },
    { name: 'BASS', contents: 'All bass elements', processing: 'Sidechain intact' },
    { name: 'MUSIC', contents: 'Synths, keys, guitars', processing: 'Effects printed' },
    { name: 'VOCALS', contents: 'Lead + backs', processing: 'Tuning done, light compression' },
    { name: 'FX', contents: 'Risers, impacts, etc.', processing: 'Fully printed' }
  ]
};

// Helper function to search troubleshooting
export function searchTroubleshooting(query) {
  const normalizedQuery = query.toLowerCase();
  const results = [];

  Object.entries(TROUBLESHOOTING).forEach(([key, item]) => {
    const searchText = `${item.problem} ${item.symptoms.join(' ')} ${item.causes.join(' ')}`.toLowerCase();
    if (searchText.includes(normalizedQuery)) {
      results.push({ id: key, ...item });
    }
  });

  return results;
}

// Helper function to get artist by genre
export function getArtistsByGenre(genre) {
  return REFERENCE_ARTISTS[genre] || [];
}

// Helper function to get exercise by week
export function getExercisesByWeek(weekNumber) {
  return PRACTICE_EXERCISES[`week${weekNumber}`] || null;
}

export default {
  REFERENCE_ARTISTS,
  TROUBLESHOOTING,
  PRACTICE_EXERCISES,
  QUICK_REFERENCE,
  DAW_CONFIGS,
  STEM_EXPORT_STANDARDS
};
