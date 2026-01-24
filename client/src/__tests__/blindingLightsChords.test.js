/**
 * Chord Detection Test - Blinding Lights by The Weeknd
 *
 * Expected chord progression: F#m - D - A - E
 * Key: F# minor (relative major: A)
 *
 * Chromagram indices:
 * C=0, C#=1, D=2, D#=3, E=4, F=5, F#=6, G=7, G#=8, A=9, A#=10, B=11
 */

import { renderHook, act } from '@testing-library/react';
import { useChordDetection } from '../hooks/useChordDetection';

// Helper to create a chromagram with specific notes emphasized
function createChromagram(notes, baseLevel = 0.1) {
  const chroma = new Array(12).fill(baseLevel);
  notes.forEach(note => {
    const noteIndex = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(note);
    if (noteIndex >= 0) {
      chroma[noteIndex] = 0.9; // Strong presence
    }
  });
  return chroma;
}

describe('Blinding Lights Chord Detection', () => {
  describe('Expected chord progression: F#m - D - A - E', () => {

    test('should detect F#m (F# minor) chord', () => {
      const { result } = renderHook(() => useChordDetection());

      // F#m = F#, A, C# (root, minor 3rd, 5th)
      const fSharpMinorChroma = createChromagram(['F#', 'A', 'C#']);

      act(() => {
        result.current.analyzeChromagram(fSharpMinorChroma);
      });

      expect(result.current.currentChord).not.toBeNull();
      expect(result.current.currentChord.root).toBe('F#');
      expect(result.current.currentChord.quality).toBe('minor');
      expect(result.current.currentChord.symbol).toBe('F#m');
    });

    test('should detect D major chord', () => {
      const { result } = renderHook(() => useChordDetection());

      // D = D, F#, A (root, major 3rd, 5th)
      const dMajorChroma = createChromagram(['D', 'F#', 'A']);

      act(() => {
        result.current.analyzeChromagram(dMajorChroma);
      });

      expect(result.current.currentChord).not.toBeNull();
      expect(result.current.currentChord.root).toBe('D');
      expect(result.current.currentChord.quality).toBe('major');
      expect(result.current.currentChord.symbol).toBe('D');
    });

    test('should detect A major chord', () => {
      const { result } = renderHook(() => useChordDetection());

      // A = A, C#, E (root, major 3rd, 5th)
      const aMajorChroma = createChromagram(['A', 'C#', 'E']);

      act(() => {
        result.current.analyzeChromagram(aMajorChroma);
      });

      expect(result.current.currentChord).not.toBeNull();
      expect(result.current.currentChord.root).toBe('A');
      expect(result.current.currentChord.quality).toBe('major');
      expect(result.current.currentChord.symbol).toBe('A');
    });

    test('should detect E major chord', () => {
      const { result } = renderHook(() => useChordDetection());

      // E = E, G#, B (root, major 3rd, 5th)
      const eMajorChroma = createChromagram(['E', 'G#', 'B']);

      act(() => {
        result.current.analyzeChromagram(eMajorChroma);
      });

      expect(result.current.currentChord).not.toBeNull();
      expect(result.current.currentChord.root).toBe('E');
      expect(result.current.currentChord.quality).toBe('major');
      expect(result.current.currentChord.symbol).toBe('E');
    });
  });

  describe('Full progression sequence', () => {
    test('should detect F#m → D → A → E progression', () => {
      const { result } = renderHook(() => useChordDetection());

      const progression = [
        { name: 'F#m', notes: ['F#', 'A', 'C#'], expected: { root: 'F#', quality: 'minor' } },
        { name: 'D', notes: ['D', 'F#', 'A'], expected: { root: 'D', quality: 'major' } },
        { name: 'A', notes: ['A', 'C#', 'E'], expected: { root: 'A', quality: 'major' } },
        { name: 'E', notes: ['E', 'G#', 'B'], expected: { root: 'E', quality: 'major' } },
      ];

      const detectedChords = [];

      progression.forEach(chord => {
        const chroma = createChromagram(chord.notes);

        act(() => {
          result.current.analyzeChromagram(chroma);
        });

        if (result.current.currentChord) {
          detectedChords.push({
            detected: result.current.currentChord.symbol,
            expected: chord.name,
            match: result.current.currentChord.root === chord.expected.root &&
                   result.current.currentChord.quality === chord.expected.quality
          });
        }
      });

      // All 4 chords should be detected correctly
      expect(detectedChords.length).toBe(4);
      detectedChords.forEach(c => {
        expect(c.match).toBe(true);
      });
    });
  });

  describe('Circle of Fifths highlighting', () => {
    test('F#m should highlight F# on minor ring', () => {
      // F#m is in the inner (minor) ring of Circle of Fifths
      // The enharmonic equivalent Gb should also work
      const { result } = renderHook(() => useChordDetection());

      const fSharpMinorChroma = createChromagram(['F#', 'A', 'C#']);

      act(() => {
        result.current.analyzeChromagram(fSharpMinorChroma);
      });

      expect(result.current.currentChord.root).toBe('F#');
      expect(result.current.currentChord.quality).toBe('minor');
    });
  });
});
