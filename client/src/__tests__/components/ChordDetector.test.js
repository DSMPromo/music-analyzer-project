import React from 'react';
import { render, screen } from '@testing-library/react';
import ChordDetector from '../../components/ChordDetector';

// Mock the useChordDetection hook with controllable return value
let mockChordDetectionReturn = {
  currentChord: {
    root: 'C',
    quality: 'major',
    symbol: 'C',
    confidence: 0.85,
  },
  chordHistory: [
    { root: 'G', quality: 'major', symbol: 'G', timestamp: 1000 },
    { root: 'Am', quality: 'minor', symbol: 'Am', timestamp: 2000 },
  ],
  analyzeChromagram: jest.fn(),
  clearHistory: jest.fn(),
};

jest.mock('../../hooks/useChordDetection', () => ({
  useChordDetection: () => mockChordDetectionReturn,
}));

describe('ChordDetector', () => {
  const mockChromagram = [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0];

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to default mock values
    mockChordDetectionReturn = {
      currentChord: {
        root: 'C',
        quality: 'major',
        symbol: 'C',
        confidence: 0.85,
      },
      chordHistory: [
        { root: 'G', quality: 'major', symbol: 'G', timestamp: 1000 },
        { root: 'Am', quality: 'minor', symbol: 'Am', timestamp: 2000 },
      ],
      analyzeChromagram: jest.fn(),
      clearHistory: jest.fn(),
    };
  });

  it('should render current chord', () => {
    render(<ChordDetector chromagram={mockChromagram} />);

    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('should display chord quality', () => {
    render(<ChordDetector chromagram={mockChromagram} />);

    expect(screen.getByText(/major/i)).toBeInTheDocument();
  });

  it('should show confidence indicator', () => {
    render(<ChordDetector chromagram={mockChromagram} />);

    expect(screen.getByText(/85%|0\.85/)).toBeInTheDocument();
  });

  it('should display chord history', () => {
    render(<ChordDetector chromagram={mockChromagram} showHistory={true} />);

    expect(screen.getByText('G')).toBeInTheDocument();
    expect(screen.getByText('Am')).toBeInTheDocument();
  });

  it('should show no chord when chromagram is empty', () => {
    const emptyChromagram = new Array(12).fill(0);

    // Set mock to return null chord
    mockChordDetectionReturn = {
      currentChord: null,
      chordHistory: [],
      analyzeChromagram: jest.fn(),
      clearHistory: jest.fn(),
    };

    render(<ChordDetector chromagram={emptyChromagram} />);

    expect(screen.getByText(/no chord/i)).toBeInTheDocument();
  });

  it('should display chord diagram when enabled', () => {
    render(<ChordDetector chromagram={mockChromagram} showDiagram={true} />);

    expect(screen.getByTestId('chord-diagram')).toBeInTheDocument();
  });

  it('should show piano visualization', () => {
    render(<ChordDetector chromagram={mockChromagram} showPiano={true} />);

    expect(screen.getByTestId('piano-keys')).toBeInTheDocument();
  });

  it('should highlight active notes on piano', () => {
    render(<ChordDetector chromagram={mockChromagram} showPiano={true} />);

    const activeKeys = screen.getAllByTestId(/piano-key-active/);
    expect(activeKeys.length).toBeGreaterThan(0);
  });

  it('should update when chromagram changes', () => {
    const { rerender } = render(<ChordDetector chromagram={mockChromagram} />);

    const newChromagram = [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1]; // G major

    rerender(<ChordDetector chromagram={newChromagram} />);

    // Component should re-render with new data
    expect(screen.getByTestId('chord-display')).toBeInTheDocument();
  });
});
