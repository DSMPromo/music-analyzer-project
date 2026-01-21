import { renderHook, act } from '@testing-library/react';
import { useChordDetection } from '../../hooks/useChordDetection';

describe('useChordDetection', () => {
  it('should initialize with null current chord', () => {
    const { result } = renderHook(() => useChordDetection());

    expect(result.current.currentChord).toBeNull();
    expect(result.current.chordHistory).toEqual([]);
  });

  it('should detect C major chord from chromagram', () => {
    const { result } = renderHook(() => useChordDetection());

    // C major: C (0), E (4), G (7)
    const cMajorChromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];

    act(() => {
      result.current.analyzeChromagram(cMajorChromagram);
    });

    expect(result.current.currentChord).not.toBeNull();
    expect(result.current.currentChord.root).toBe('C');
    expect(result.current.currentChord.quality).toContain('major');
  });

  it('should detect A minor chord from chromagram', () => {
    const { result } = renderHook(() => useChordDetection());

    // A minor: A (9), C (0), E (4)
    const aMinorChromagram = [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0];

    act(() => {
      result.current.analyzeChromagram(aMinorChromagram);
    });

    expect(result.current.currentChord).not.toBeNull();
    expect(result.current.currentChord.root).toBe('A');
    expect(result.current.currentChord.quality).toContain('minor');
  });

  it('should detect G7 chord from chromagram', () => {
    const { result } = renderHook(() => useChordDetection());

    // G7: G (7), B (11), D (2), F (5)
    const g7Chromagram = [0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1];

    act(() => {
      result.current.analyzeChromagram(g7Chromagram);
    });

    expect(result.current.currentChord).not.toBeNull();
    expect(result.current.currentChord.root).toBe('G');
  });

  it('should return null for quiet/empty chromagram', () => {
    const { result } = renderHook(() => useChordDetection());

    const quietChromagram = [0.01, 0.02, 0.01, 0.02, 0.01, 0.01, 0.02, 0.01, 0.01, 0.02, 0.01, 0.01];

    act(() => {
      result.current.analyzeChromagram(quietChromagram);
    });

    expect(result.current.currentChord).toBeNull();
  });

  it('should track chord history', () => {
    const { result } = renderHook(() => useChordDetection());

    const cMajor = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];
    const gMajor = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1];

    act(() => {
      result.current.analyzeChromagram(cMajor);
    });

    act(() => {
      result.current.analyzeChromagram(gMajor);
    });

    expect(result.current.chordHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('should include confidence score', () => {
    const { result } = renderHook(() => useChordDetection());

    const cMajorChromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];

    act(() => {
      result.current.analyzeChromagram(cMajorChromagram);
    });

    expect(result.current.currentChord.confidence).toBeGreaterThan(0);
    expect(result.current.currentChord.confidence).toBeLessThanOrEqual(1);
  });

  it('should clear chord history', () => {
    const { result } = renderHook(() => useChordDetection());

    const cMajor = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];

    act(() => {
      result.current.analyzeChromagram(cMajor);
      result.current.analyzeChromagram(cMajor);
    });

    act(() => {
      result.current.clearHistory();
    });

    expect(result.current.chordHistory).toEqual([]);
  });
});
