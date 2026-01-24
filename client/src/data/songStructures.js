/**
 * Song Structure Data
 * Complete bar-by-bar structures for Pop, EDM, Afro House, and K-Pop
 * Based on the Music Production Master Template
 */

// Section type definitions with colors
export const SECTION_TYPES = [
  { id: 'intro', name: 'Intro', color: '#3b82f6', defaultBars: 8, description: 'Opening section, establishes mood' },
  { id: 'verse', name: 'Verse', color: '#10b981', defaultBars: 16, description: 'Story/lyrics section, minimal production' },
  { id: 'prechorus', name: 'Pre-Chorus', color: '#f59e0b', defaultBars: 8, description: 'Builds anticipation for chorus' },
  { id: 'chorus', name: 'Chorus', color: '#e94560', defaultBars: 16, description: 'Main hook, full production' },
  { id: 'postchorus', name: 'Post-Chorus', color: '#ec4899', defaultBars: 8, description: 'Hook extension, dance moment' },
  { id: 'bridge', name: 'Bridge', color: '#8b5cf6', defaultBars: 16, description: 'Contrast section, new perspective' },
  { id: 'breakdown', name: 'Breakdown', color: '#06b6d4', defaultBars: 32, description: 'Stripped section, emotional moment' },
  { id: 'buildup', name: 'Build-Up', color: '#fbbf24', defaultBars: 16, description: 'Rising tension before drop' },
  { id: 'drop', name: 'Drop', color: '#ef4444', defaultBars: 32, description: 'Maximum energy release' },
  { id: 'groove', name: 'Groove', color: '#14b8a6', defaultBars: 64, description: 'Sustained rhythmic section' },
  { id: 'dancebreak', name: 'Dance Break', color: '#f97316', defaultBars: 8, description: 'Instrumental choreography moment' },
  { id: 'outro', name: 'Outro', color: '#6b7280', defaultBars: 8, description: 'Closing section, resolution' }
];

// Energy level guide
export const ENERGY_LEVELS = {
  1: { label: 'Minimal', description: 'Near silence, sparse elements', bars: '1-2' },
  2: { label: 'Very Low', description: 'Minimal elements, intro/outro territory', bars: '2/10' },
  3: { label: 'Low', description: 'Stripped back, breakdown territory', bars: '3/10' },
  4: { label: 'Low-Medium', description: 'Verse territory, building', bars: '4/10' },
  5: { label: 'Medium', description: 'Pre-chorus, moderate energy', bars: '5/10' },
  6: { label: 'Medium-High', description: 'Build-up, anticipation', bars: '6/10' },
  7: { label: 'High', description: 'Strong energy, approaching peak', bars: '7/10' },
  8: { label: 'Very High', description: 'Chorus/drop territory', bars: '8/10' },
  9: { label: 'Near Max', description: 'Post-chorus, intense', bars: '9/10' },
  10: { label: 'Maximum', description: 'Final chorus, climax', bars: '10/10' }
};

// Complete song structures by genre
export const SONG_STRUCTURES = {
  pop: {
    id: 'pop',
    name: 'Pop Standard',
    totalBars: 144,
    bpmRange: [100, 128],
    description: 'Radio-friendly structure with quick hook delivery. Prioritizes immediate emotional connection and memorable hooks.',
    philosophy: 'Pop prioritizes immediate emotional connection and memorable hooks. The structure delivers the chorus quickly while maintaining variation. Every element serves the vocal.',
    whyItWorks: 'Radio/streaming demand hooks within 30-45 seconds. Verse-chorus alternation creates familiarity; bridge provides contrast before the final peak.',
    sections: [
      {
        id: 'intro',
        name: 'Intro',
        startBar: 1,
        bars: 8,
        energy: 2,
        purpose: 'Hook tease, establish mood',
        elements: ['Hook hint/atmosphere (bars 1-4)', 'Light rhythm (bars 5-8)'],
        tips: ['Grab attention in first 4 bars', 'Prepare for vocal entry', 'Instrumental hook OR ambient pad establishes mood'],
        production: 'Subtle percussion or bass pulse. Create momentum.'
      },
      {
        id: 'verse1',
        name: 'Verse 1',
        startBar: 9,
        bars: 16,
        energy: 4,
        purpose: 'Establish story, minimal production',
        elements: ['Lead vocal', 'Simple beat', 'Sparse chords', 'Subtle layers (bars 17-24)'],
        tips: ['Vocal is KING - everything supports, nothing competes', 'Production feels incomplete - listener should WANT more', 'Add synth pad or guitar in second half'],
        production: 'Kick, hi-hat, bass simple. Sparse chords. Fuller bass in second 8 bars.'
      },
      {
        id: 'prechorus1',
        name: 'Pre-Chorus 1',
        startBar: 25,
        bars: 8,
        energy: 6,
        purpose: 'Create ANTICIPATION',
        elements: ['Rising melody', 'More instruments', 'Increased rhythm', 'Peak tension (bar 32)', 'Riser', 'Drum fill'],
        tips: ['Melodically: Notes RISE (creates lift)', 'Lyrically: Often "but" or "and then" - pivoting to chorus', 'Maximum tension before release - the "inhale"'],
        production: 'Vocal lifts. More instruments. Riser. Drum fill bar 32.'
      },
      {
        id: 'chorus1',
        name: 'Chorus 1',
        startBar: 33,
        bars: 16,
        energy: 8,
        purpose: 'DELIVER THE PAYOFF',
        elements: ['Full production', 'Main hook', 'Full drums', 'Bass', 'Synths', 'Hook repetition (bars 41-48)', 'Ad-libs', 'Harmonies'],
        tips: ['SONG TITLE embedded in hook', 'Simple, singable melody', 'Everything playing - this is why they\'re listening', 'Reinforce memorability'],
        production: 'Everything playing. Main hook. Full drums, bass, synths. Repeat hook. Add ad-libs, harmonies.'
      },
      {
        id: 'verse2',
        name: 'Verse 2',
        startBar: 49,
        bars: 16,
        energy: 5,
        purpose: 'Continue story with development',
        elements: ['Strip back (but more than V1)', 'Story continues', 'Build again (bars 57-64)', 'New lyrics'],
        tips: ['Contrast after chorus', 'Don\'t fully regress', 'Develop story', 'New info maintains interest'],
        production: 'Remove elements but more than V1. Add layers second half.'
      },
      {
        id: 'prechorus2',
        name: 'Pre-Chorus 2',
        startBar: 65,
        bars: 8,
        energy: 6,
        purpose: 'Build to second chorus',
        elements: ['Similar to Pre-Chorus 1', 'Possible variations', 'New fills'],
        tips: ['Can be slightly more energetic than first pre-chorus', 'Build anticipation for bigger chorus'],
        production: 'Repeat with variations: new ad-libs, different fills.'
      },
      {
        id: 'chorus2',
        name: 'Chorus 2',
        startBar: 73,
        bars: 24,
        energy: 8,
        purpose: 'Extended payoff',
        elements: ['Full production', 'Extended hook', 'New variations'],
        tips: ['Possibly extend chorus 8 bars', 'Add new elements to keep interesting'],
        production: 'Repeat with variations. Possibly extend 8 bars.'
      },
      {
        id: 'bridge',
        name: 'Bridge',
        startBar: 97,
        bars: 16,
        energy: 3,
        energyEnd: 7,
        purpose: 'CONTRAST - prevent fatigue',
        elements: ['New chords OR key change', 'Different melody', 'Strip down (bars 97-104)', 'Build to finale (bars 105-112)', 'Biggest riser'],
        tips: ['Must feel DIFFERENT from rest of song', 'Lyrically: New perspective or realization', 'Give something unexpected', 'Set up final chorus as ULTIMATE payoff'],
        production: 'Strip down. Biggest riser. Maximum anticipation.'
      },
      {
        id: 'finalchorus',
        name: 'Final Chorus',
        startBar: 113,
        bars: 32,
        energy: 10,
        energyEnd: 4,
        purpose: 'CLIMAX - biggest emotional moment',
        elements: ['MAXIMUM everything', 'Key change possible', 'Extra instruments', 'Bigger drums', 'Extended hook', 'Vocal runs', 'Harmonies everywhere', 'Resolution', 'Outro'],
        tips: ['Everything PLUS: key change, extra instruments, bigger drums', 'Maximum satisfaction', 'Begin emotional resolution', 'Hook + minimal for satisfying conclusion'],
        production: 'Everything PLUS. Repeat hook. Vocal runs. Pull back slightly. Fade or clean end.'
      }
    ],
    structureMap: 'INTRO(8) | VERSE 1(16) | PRE(8) | CHORUS 1(16) | VERSE 2(16) | PRE(8) | CHORUS 2(24) | BRIDGE(16) | FINAL CHORUS(32)',
    energyCurve: [2, 4, 6, 8, 5, 6, 8, 3, 7, 10, 4]
  },

  edm: {
    id: 'edm',
    name: 'EDM Standard',
    totalBars: 160,
    bpmRange: [124, 150],
    description: 'Engineered for maximum physical and emotional impact. Structure revolves around BUILD and DROP.',
    philosophy: 'EDM is engineered for maximum physical and emotional impact. Structure revolves around BUILD and DROP - creating anticipation then delivering explosive release. DJ-friendly intros/outros are essential.',
    whyItWorks: 'The build/drop cycle mirrors physical release. Tension accumulates during builds, drops provide cathartic release. Crowds go wild at drops - it\'s designed physiological response.',
    djCompatible: true,
    sections: [
      {
        id: 'djintro',
        name: 'DJ Intro',
        startBar: 1,
        bars: 32,
        energy: 2,
        energyEnd: 4,
        purpose: 'DJ MIXING ZONE',
        elements: ['Kick only (bars 1-8)', 'Hi-hats (bars 9-16)', 'Filtered bass (bars 17-24)', 'Melodic hints (bars 25-32)', 'Riser begins'],
        tips: ['NO melodic content bars 1-16 (prevents harmonic clash)', 'Bass enters FILTERED - DJ controls full bass entry', 'Beat-matching with previous track'],
        production: 'Four-on-floor kick. Add closed hi-hats. Bass with HPF (200Hz -> 60Hz opening). Filtered synth or pad.'
      },
      {
        id: 'drop1',
        name: 'Drop 1',
        startBar: 33,
        bars: 32,
        energy: 8,
        purpose: 'First energy release',
        elements: ['FULL DROP (bars 33-40)', 'Variation A (bars 41-48)', 'Variation B with FX (bars 49-56)', 'Transition (bars 57-64)'],
        tips: ['Heavy SIDECHAIN creates "pumping" effect', 'Variation every 8 bars', 'Establish track identity'],
        production: 'Everything hits. Kick, bass, synth, percussion. Add FX, vocal chop. Remove elements and filter for transition.'
      },
      {
        id: 'breakdown',
        name: 'Breakdown',
        startBar: 65,
        bars: 32,
        energy: 3,
        energyEnd: 7,
        purpose: 'CONTRAST - ears rest, emotional content',
        elements: ['Strip to melodic (bars 65-72)', 'Emotional peak (bars 73-80)', 'Begin build (bars 81-88)', 'MAXIMUM BUILD (bars 89-96)'],
        tips: ['If vocal, this is where it shines', 'Build should make listener CRAVE the drop', 'The "song" moment - human connection'],
        production: 'Remove kick. Feature melody/vocal. Riser starts. Snare roll begins. Snare accelerates. White noise. Filter up.'
      },
      {
        id: 'drop2',
        name: 'Drop 2',
        startBar: 97,
        bars: 32,
        energy: 10,
        purpose: 'Main event - must feel BIGGER',
        elements: ['DROP 2 bigger (bars 97-104)', 'Peak energy (bars 105-112)', 'Variation (bars 113-120)', 'Transition (bars 121-128)'],
        tips: ['Drop 1 PLUS: extra layer, different bass, harder kick', 'CLIMAX of the track', 'Interest at peak energy with variation or fake-out'],
        production: 'Must feel BIGGER. Maximum elements. Highest energy. Filter out. Remove layers. Downlifter.'
      },
      {
        id: 'djoutro',
        name: 'DJ Outro',
        startBar: 129,
        bars: 32,
        energy: 5,
        energyEnd: 2,
        purpose: 'DJ MIXING ZONE - clean exit',
        elements: ['Remove melodics (bars 129-136)', 'Filter bass up (bars 137-144)', 'Kick + minimal (bars 145-152)', 'Kick only (bars 153-160)'],
        tips: ['MIRROR YOUR INTRO', 'NO reverb tails past final bar', 'Clean, predictable ending for DJs'],
        production: 'Filter out synths. HPF on bass (60->200Hz->out). Just kick, hats. Kick only. Clean stop. NO tails.'
      }
    ],
    structureMap: 'DJ INTRO(32) | DROP 1(32) | BREAKDOWN(32) | DROP 2(32) | DJ OUTRO(32)',
    energyCurve: [2, 3, 4, 8, 8, 8, 8, 3, 5, 7, 10, 10, 10, 10, 5, 3, 2]
  },

  afroHouse: {
    id: 'afroHouse',
    name: 'Afro House',
    totalBars: 288,
    bpmRange: [118, 124],
    swingRange: [55, 65],
    description: 'About the JOURNEY, not the destination. Hypnotic groove that slowly evolves.',
    philosophy: 'Afro house is about the JOURNEY, not the destination. Unlike EDM\'s dramatic builds, Afro creates hypnotic groove that slowly evolves. Prioritizes gradual introduction/removal of elements for meditative dance experience.',
    whyItWorks: 'Draws from African traditions where music is functional - designed for extended dancing and communal experience. Gradual changes allow dancers to fall into trance-like state while variations maintain interest.',
    djCompatible: true,
    sections: [
      {
        id: 'groovebuild',
        name: 'DJ Intro / Groove Build',
        startBar: 1,
        bars: 64,
        energy: 2,
        energyEnd: 6,
        purpose: 'Establish groove foundation gradually',
        elements: [
          'Percussion seed (bars 1-8) - single percussion, 60% swing',
          'Second layer (bars 9-16) - hi-hat or conga, 55% swing',
          'Kick enters (bars 17-24) - sparse: 1 and 3',
          'Full percussion (bars 25-32) - djembe, congas, full stack',
          'Filtered bass (bars 33-40) - sub bass with HPF',
          'Bass opens (bars 41-48) - full bass',
          'Melodic hint (bars 49-56) - filtered marimba, Dorian mode',
          'Full melody (bars 57-64) - groove complete'
        ],
        tips: [
          'Each 8-bar section adds ONE new element',
          'The intro IS the song beginning - don\'t rush',
          'Different swing per layer creates organic feel'
        ],
        production: 'Shaker OR rim -> hi-hat/conga -> kick (sparse) -> full percussion -> filtered bass -> open bass -> melodic hint -> full melody'
      },
      {
        id: 'grooveA',
        name: 'Main Groove A',
        startBar: 65,
        bars: 64,
        energy: 7,
        purpose: 'Let groove BREATHE - meditative section',
        elements: [
          'Establish groove (bars 65-80) - SUBTLE variations every 4 bars',
          'Vocal chant (bars 81-96) - call-response, mantra repetition',
          'Subtle variation (bars 97-112) - new fill, different melodic phrase',
          'Peak Groove A (bars 113-128) - maximum elements for this section'
        ],
        tips: [
          'About CONSISTENCY not growth',
          'Variations SUBTLE - fills, velocity shifts',
          'Repetition is the point - meditative, trance-inducing'
        ],
        production: 'Full groove. SUBTLE variations every 4 bars. Introduce vocal chant. New fill. Same energy.'
      },
      {
        id: 'afroBreakdown',
        name: 'Breakdown',
        startBar: 129,
        bars: 32,
        energy: 3,
        energyEnd: 7,
        purpose: 'CONTRAST - dancers breathe',
        elements: [
          'Strip to essence (bars 129-136) - remove kick, keep shaker + vocal',
          'Vocal feature (bars 137-144) - spiritual moment',
          'Gradual rebuild (bars 145-152) - kick returns, layers one by one',
          'Full return (bars 153-160) - maybe new percussion added'
        ],
        tips: [
          'Afro breakdowns are GENTLE, not dramatic like EDM',
          'Rebuild feels NATURAL, not manufactured',
          'Spiritual moment - connection'
        ],
        production: 'Remove kick. Keep shaker + vocal. Pad swells. Vocal prominent. Sparse percussion. Kick returns. All elements.'
      },
      {
        id: 'grooveB',
        name: 'Main Groove B',
        startBar: 161,
        bars: 64,
        energy: 8,
        purpose: 'Highest sustained energy',
        elements: [
          'Similar to Groove A with key differences:',
          'New percussion element or fill',
          'Possible new vocal phrase',
          'Melodic variation (same mode)',
          'Highest sustained energy'
        ],
        tips: [
          'Energy is SUSTAINED, not peaking',
          'New elements keep interest',
          'Same hypnotic quality, fresh details'
        ],
        production: 'New percussion element. Possible new vocal phrase. Melodic variation (same mode).'
      },
      {
        id: 'afroOutro',
        name: 'DJ Outro',
        startBar: 225,
        bars: 64,
        energy: 6,
        energyEnd: 2,
        purpose: 'Gradual exit for DJ mixing',
        elements: [
          'Remove melodics (bars 225-240) - filter out melody',
          'Reduce bass (bars 241-256) - filter bass up',
          'Core percussion (bars 257-272) - kick + shaker + minimal',
          'Percussion fade (bars 273-288) - remove kick, percussion fading'
        ],
        tips: [
          'Mirror your intro in reverse',
          'Room for incoming track',
          'Next track takes over'
        ],
        production: 'Filter out melody. Room for incoming track. Kick + shaker + minimal only. Remove kick. Clean stop.'
      }
    ],
    structureMap: 'INTRO/BUILD(64) | MAIN GROOVE A(64) | BREAKDOWN(32) | MAIN GROOVE B(64) | DJ OUTRO(64)',
    energyCurve: [2, 3, 4, 5, 6, 7, 7, 7, 7, 7, 3, 5, 7, 8, 8, 8, 8, 8, 6, 4, 2]
  },

  kpop: {
    id: 'kpop',
    name: 'K-Pop',
    totalBars: 144,
    bpmRange: [90, 140],
    description: 'Maximizes hook density and genre fluidity. Multiple viral moments.',
    philosophy: 'K-pop maximizes hook density and genre fluidity. A single song might contain pop verses, trap sections, EDM drops, and R&B bridges. Every section competes to be memorable. Structure creates multiple viral moments.',
    whyItWorks: 'Engineered for modern attention economy. Multiple hooks ensure something sticks. Genre changes keep engaged. Post-chorus and dance break designed for choreography and social media clips.',
    hookDensity: '5-7 hooks per song (vs Pop: 1-2, EDM: 1-2, Afro: 0-1)',
    sections: [
      {
        id: 'kpopIntro',
        name: 'Intro',
        startBar: 1,
        bars: 8,
        energy: 5,
        purpose: 'HOOK #1 - Immediate memorability',
        elements: ['Chant/catchphrase/signature (bars 1-4)', 'Setup/transition (bars 5-8)'],
        tips: [
          'Chant, catchphrase, or signature. "Du-du-du" style.',
          'ID song in 3 seconds',
          'Build anticipation'
        ],
        hookNumber: 1,
        production: 'Chant, catchphrase, or signature. Transition to verse. Spoken word or ad-lib.'
      },
      {
        id: 'kpopVerse1',
        name: 'Verse 1',
        startBar: 9,
        bars: 16,
        energy: 4,
        purpose: 'HOOK #2 opportunity - possibly RAP',
        elements: ['Verse A - possibly RAP (bars 9-16)', 'Verse B - different member (bars 17-24)'],
        tips: [
          'Verses can be COMPLETELY different genre from chorus',
          'Rap sections common - give rapper memorable flow',
          'Showcase multiple members'
        ],
        hookNumber: 2,
        production: 'Possibly rap. Different genre feel from chorus. Different member. Build energy.'
      },
      {
        id: 'kpopPrechorus1',
        name: 'Pre-Chorus 1',
        startBar: 25,
        bars: 8,
        energy: 6,
        energyEnd: 0,
        purpose: 'HOOK #3 possible - BUILD AND STOP',
        elements: ['Lift - energy rises (bars 25-28)', 'BUILD -> STOP - silence bar 32'],
        tips: [
          '"BUILD AND STOP" is K-pop signature',
          'Brief silence creates massive impact',
          'May include chant'
        ],
        hookNumber: 3,
        production: 'Energy rises. Melody ascends. May include chant. Build then SILENCE bar 32.'
      },
      {
        id: 'kpopChorus1',
        name: 'Chorus 1',
        startBar: 33,
        bars: 16,
        energy: 8,
        purpose: 'MAIN HOOK (#4) - THE hook',
        elements: ['Main hook (bars 33-40)', 'Hook extension (bars 41-48)'],
        tips: [
          'Song title MUST be in chorus',
          '2-4 words repeated 2-4 times',
          'Must be instantly memorable',
          'Extended singalong moment'
        ],
        hookNumber: 4,
        production: 'Title embedded. Maximum catchiness. Repetitive. Repeat or variation. Harmonies, ad-libs.'
      },
      {
        id: 'kpopPostchorus',
        name: 'Post-Chorus / Drop',
        startBar: 49,
        bars: 8,
        energy: 9,
        purpose: 'HOOK #5 - CHOREOGRAPHY MOMENT',
        elements: ['Chant/EDM drop/dance hook', 'Minimal lyrics'],
        tips: [
          'Exists for the DANCE',
          'Often most viral moment',
          'Social media clip territory'
        ],
        hookNumber: 5,
        production: 'Chant, EDM drop, dance hook. Minimal lyrics. Choreography moment.'
      },
      {
        id: 'kpopVerse2',
        name: 'Verse 2, Pre-Chorus 2, Chorus 2',
        startBar: 57,
        bars: 40,
        energy: 8,
        purpose: 'Repeat with variations',
        elements: ['Similar with variations', 'Different members', 'Slightly more produced'],
        tips: [
          'Different members featured',
          'Slightly more produced than first pass'
        ],
        production: 'Similar with variations. Different members. Slightly more produced.'
      },
      {
        id: 'kpopBridge',
        name: 'Bridge',
        startBar: 97,
        bars: 16,
        energy: 3,
        energyEnd: 6,
        purpose: 'CONTRAST - maximum variety',
        elements: ['Complete contrast (bars 97-104)', 'Build/key change setup (bars 105-112)'],
        tips: [
          'Completely different - R&B, ballad, stripped',
          'Main vocalist moment',
          'High notes, emotional delivery',
          'Often sets up key change'
        ],
        hookNumber: 6,
        production: 'R&B, ballad, stripped. Energy back. Often sets up key change.'
      },
      {
        id: 'kpopDancebreak',
        name: 'Dance Break',
        startBar: 113,
        bars: 8,
        energy: 9,
        purpose: 'Choreography showcase - viral clip',
        elements: ['Instrumental', 'Heavy beat', 'No/minimal vocals'],
        tips: [
          'For the PERFORMANCE',
          'Complex choreography',
          'Viral clip territory'
        ],
        production: 'Instrumental. Heavy beat. No/minimal vocals.'
      },
      {
        id: 'kpopFinalchorus',
        name: 'Final Chorus',
        startBar: 121,
        bars: 24,
        energy: 10,
        energyEnd: 5,
        purpose: 'CLIMAX - maximum energy',
        elements: [
          'Key change +2 semitones (bars 121-128)',
          'Extended hook - all members (bars 129-136)',
          'Outro - return to intro hook (bars 137-144)'
        ],
        tips: [
          '+2 semitones key change common',
          'Maximum energy',
          'All members',
          'Fan singalong',
          'Leave hook in head'
        ],
        production: 'Key change. Maximum energy. Hook repeats. All members. Ad-libs. Return to intro hook OR fade.'
      }
    ],
    structureMap: 'INTRO(8) | V1(16) | PRE(8) | CH(16) | POST(8) | V2/PRE2/CH2(40) | BRIDGE(16) | DANCE(8) | FINAL CH(24)',
    energyCurve: [5, 4, 6, 0, 8, 9, 4, 6, 8, 3, 6, 9, 10, 5]
  }
};

// Structure comparison data
export const STRUCTURE_COMPARISON = {
  headers: ['Element', 'Pop', 'EDM', 'Afro House', 'K-Pop'],
  rows: [
    ['Total Runtime', '3:00-4:00', '5:00-6:00', '6:00-8:00', '3:00-4:00'],
    ['Intro Length', '4-8 bars', '32 bars (DJ)', '32-64 bars', '4-8 bars'],
    ['Outro Length', '4-8 bars', '32 bars (DJ)', '32-64 bars', '4-8 bars'],
    ['Primary Focus', 'Vocal hook', 'The drop', 'The groove', 'Multiple hooks'],
    ['Hooks Per Song', '1-2', '1-2', '0-1', '5-7'],
    ['Genre Fluidity', 'Low', 'Low-Med', 'Low', 'Very High'],
    ['Energy Curve', 'Peaks/valleys', 'Build/drop', 'Gradual arc', 'Constant peaks'],
    ['DJ Compatible', 'N/A', 'Essential', 'Essential', 'N/A'],
    ['Contrast Method', 'Bridge', 'Breakdown', 'Minimal strip', 'Genre change']
  ]
};

// Helper function to get section type by id
export function getSectionType(id) {
  return SECTION_TYPES.find(s => s.id === id) || SECTION_TYPES[0];
}

// Helper function to get structure by genre
export function getStructure(genreId) {
  return SONG_STRUCTURES[genreId] || SONG_STRUCTURES.pop;
}

// Helper function to calculate duration from bars and BPM
export function calculateDuration(bars, bpm, beatsPerBar = 4) {
  return (bars * beatsPerBar * 60) / bpm;
}

// Helper function to format duration as mm:ss
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default SONG_STRUCTURES;
