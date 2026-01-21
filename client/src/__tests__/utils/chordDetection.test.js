import { detectChord, calculateConfidence, getChordNotes } from '../../utils/chordDetection';

describe('chordDetection', () => {
  describe('detectChord', () => {
    it('should detect C major chord', () => {
      // C (0), E (4), G (7)
      const chromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('C');
      expect(result.quality).toMatch(/major/i);
    });

    it('should detect C minor chord', () => {
      // C (0), Eb (3), G (7)
      const chromagram = [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('C');
      expect(result.quality).toMatch(/minor/i);
    });

    it('should detect G major chord', () => {
      // G (7), B (11), D (2)
      const chromagram = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('G');
    });

    it('should detect D minor chord', () => {
      // D (2), F (5), A (9)
      const chromagram = [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('D');
      expect(result.quality).toMatch(/minor/i);
    });

    it('should detect F major chord', () => {
      // F (5), A (9), C (0)
      const chromagram = [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('F');
    });

    it('should return null for quiet input', () => {
      const chromagram = [0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01, 0.01];
      const result = detectChord(chromagram);

      expect(result).toBeNull();
    });

    it('should return null for single note', () => {
      const chromagram = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const result = detectChord(chromagram);

      expect(result).toBeNull();
    });

    it('should include confidence score', () => {
      const chromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
      const result = detectChord(chromagram);

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should detect seventh chords', () => {
      // G7: G (7), B (11), D (2), F (5)
      const chromagram = [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
      expect(result.root).toBe('G');
    });

    it('should handle normalized chromagram values', () => {
      const chromagram = [0.8, 0.1, 0.1, 0.1, 0.7, 0.1, 0.1, 0.75, 0.1, 0.1, 0.1, 0.1];
      const result = detectChord(chromagram);

      expect(result).not.toBeNull();
    });
  });

  describe('calculateConfidence', () => {
    it('should return high confidence for clear chords', () => {
      const chromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
      const chord = { notes: ['C', 'E', 'G'] };

      const confidence = calculateConfidence(chromagram, chord);

      expect(confidence).toBeGreaterThan(0.7);
    });

    it('should return lower confidence for noisy input', () => {
      const chromagram = [0.8, 0.3, 0.2, 0.3, 0.7, 0.2, 0.3, 0.6, 0.2, 0.3, 0.2, 0.3];
      const chord = { notes: ['C', 'E', 'G'] };

      const confidence = calculateConfidence(chromagram, chord);

      expect(confidence).toBeLessThan(0.9);
    });
  });

  describe('getChordNotes', () => {
    it('should return notes for C major', () => {
      const notes = getChordNotes('C', 'major');

      expect(notes).toContain('C');
      expect(notes).toContain('E');
      expect(notes).toContain('G');
    });

    it('should return notes for A minor', () => {
      const notes = getChordNotes('A', 'minor');

      expect(notes).toContain('A');
      expect(notes).toContain('C');
      expect(notes).toContain('E');
    });

    it('should return notes for G7', () => {
      const notes = getChordNotes('G', '7');

      expect(notes).toContain('G');
      expect(notes).toContain('B');
      expect(notes).toContain('D');
      expect(notes).toContain('F');
    });
  });
});
