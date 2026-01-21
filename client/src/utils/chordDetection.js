// Chord Detection Utilities

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  '7': [0, 4, 7, 10],
  dom7: [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
};

function matchChord(chromagram, root, intervals) {
  let score = 0;
  let total = 0;

  for (const interval of intervals) {
    const noteIndex = (root + interval) % 12;
    score += chromagram[noteIndex];
    total += 1;
  }

  // Calculate how much energy is in chord tones vs non-chord tones
  let chordEnergy = score;
  let totalEnergy = chromagram.reduce((a, b) => a + b, 0);

  if (totalEnergy === 0) return 0;

  // Score based on presence of chord tones and ratio of chord energy to total
  const avgChordTone = chordEnergy / total;
  const energyRatio = chordEnergy / totalEnergy;

  return avgChordTone * energyRatio;
}

function countActiveNotes(chromagram, threshold = 0.3) {
  return chromagram.filter(v => v >= threshold).length;
}

export function detectChord(chromagram) {
  // Check if chromagram is too quiet
  const maxVal = Math.max(...chromagram);
  if (maxVal < 0.1) {
    return null;
  }

  // Check if there are enough active notes for a chord (at least 3)
  const activeNotes = countActiveNotes(chromagram, maxVal * 0.5);
  if (activeNotes < 2) {
    return null;
  }

  let bestMatch = { root: 0, quality: 'major', score: -1 };

  // Try each root note
  for (let root = 0; root < 12; root++) {
    // Try each chord quality
    for (const [quality, intervals] of Object.entries(CHORD_INTERVALS)) {
      const score = matchChord(chromagram, root, intervals);

      if (score > bestMatch.score) {
        bestMatch = { root, quality, score };
      }
    }
  }

  if (bestMatch.score < 0.1) {
    return null;
  }

  const rootName = NOTE_NAMES[bestMatch.root];
  let symbol = rootName;
  let displayQuality = bestMatch.quality;

  if (bestMatch.quality === 'minor') {
    symbol += 'm';
  } else if (bestMatch.quality === '7' || bestMatch.quality === 'dom7') {
    symbol += '7';
    displayQuality = 'dominant 7th';
  } else if (bestMatch.quality === 'maj7') {
    symbol += 'maj7';
    displayQuality = 'major 7th';
  } else if (bestMatch.quality === 'min7') {
    symbol += 'm7';
    displayQuality = 'minor 7th';
  } else if (bestMatch.quality === 'dim') {
    symbol += 'dim';
    displayQuality = 'diminished';
  } else if (bestMatch.quality === 'aug') {
    symbol += 'aug';
    displayQuality = 'augmented';
  }

  return {
    root: rootName,
    quality: displayQuality,
    symbol,
    confidence: bestMatch.score,
    notes: getChordNotes(rootName, bestMatch.quality),
  };
}

export function calculateConfidence(chromagram, chord) {
  if (!chord || !chord.notes) return 0;

  const noteIndices = chord.notes.map(note => {
    const baseNote = note.replace(/\d+$/, '');
    return NOTE_NAMES.indexOf(baseNote);
  }).filter(idx => idx >= 0);

  if (noteIndices.length === 0) return 0;

  // Calculate how much energy is in the chord notes vs outside
  let chordEnergy = 0;
  let totalEnergy = 0;

  for (let i = 0; i < 12; i++) {
    totalEnergy += chromagram[i];
    if (noteIndices.includes(i)) {
      chordEnergy += chromagram[i];
    }
  }

  if (totalEnergy === 0) return 0;

  return chordEnergy / totalEnergy;
}

export function getChordNotes(root, quality) {
  const rootIndex = NOTE_NAMES.indexOf(root);
  if (rootIndex < 0) return [];

  const intervals = CHORD_INTERVALS[quality] || CHORD_INTERVALS.major;

  return intervals.map(interval => {
    const noteIndex = (rootIndex + interval) % 12;
    return NOTE_NAMES[noteIndex];
  });
}
