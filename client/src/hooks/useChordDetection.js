import { useState, useCallback, useMemo } from 'react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CHORD_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
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

  let chordEnergy = score;
  let totalEnergy = chromagram.reduce((a, b) => a + b, 0);

  if (totalEnergy === 0) return 0;

  const avgChordTone = chordEnergy / total;
  const energyRatio = chordEnergy / totalEnergy;

  return avgChordTone * energyRatio;
}

export function useChordDetection() {
  const [currentChord, setCurrentChord] = useState(null);
  const [chordHistory, setChordHistory] = useState([]);
  const [maxChromaValue, setMaxChromaValue] = useState(0);

  const analyzeChromagram = useCallback((chromagram) => {
    // Check if chromagram is too quiet
    const maxVal = Math.max(...chromagram);
    setMaxChromaValue(maxVal);

    if (maxVal < 0.1) {
      setCurrentChord(null);
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
      setCurrentChord(null);
      return null;
    }

    const rootName = NOTE_NAMES[bestMatch.root];
    let symbol = rootName;

    if (bestMatch.quality === 'minor') {
      symbol += 'm';
    } else if (bestMatch.quality === 'dom7') {
      symbol += '7';
    } else if (bestMatch.quality === 'maj7') {
      symbol += 'maj7';
    } else if (bestMatch.quality === 'min7') {
      symbol += 'm7';
    } else if (bestMatch.quality === 'dim') {
      symbol += 'dim';
    } else if (bestMatch.quality === 'aug') {
      symbol += 'aug';
    }

    const chord = {
      root: rootName,
      quality: bestMatch.quality,
      symbol,
      confidence: bestMatch.score,
      timestamp: Date.now(),
    };

    setCurrentChord(chord);
    setChordHistory((prev) => [...prev, chord]);

    return chord;
  }, []);

  const clearHistory = useCallback(() => {
    setChordHistory([]);
    setMaxChromaValue(0);
  }, []);

  // Aggregate confidence calculations for verification
  const avgConfidence = useMemo(() => {
    if (chordHistory.length === 0) return 0;
    const sum = chordHistory.reduce((acc, chord) => acc + (chord.confidence || 0), 0);
    return sum / chordHistory.length;
  }, [chordHistory]);

  // Get verification data object
  const verificationData = useMemo(() => ({
    chordHistory,
    avgConfidence,
    maxChromaValue,
    uniqueChords: [...new Set(chordHistory.map(c => c.symbol))].length,
    totalChords: chordHistory.length,
  }), [chordHistory, avgConfidence, maxChromaValue]);

  return {
    currentChord,
    chordHistory,
    analyzeChromagram,
    clearHistory,
    // Verification exports
    avgConfidence,
    maxChromaValue,
    verificationData,
  };
}
