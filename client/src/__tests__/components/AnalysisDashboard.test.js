import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalysisDashboard from '../../components/AnalysisDashboard';

// Mock child components
jest.mock('../../components/AudioInputManager', () => {
  return function MockAudioInputManager({ onAudioReady }) {
    return (
      <div data-testid="audio-input-manager">
        <button onClick={() => onAudioReady({})}>Mock Load Audio</button>
      </div>
    );
  };
});

jest.mock('../../components/SpectrumAnalyzer', () => {
  return function MockSpectrumAnalyzer() {
    return <div data-testid="spectrum-analyzer">Spectrum Analyzer</div>;
  };
});

jest.mock('../../components/ChordDetector', () => {
  return function MockChordDetector() {
    return <div data-testid="chord-detector">Chord Detector</div>;
  };
});

jest.mock('../../components/MIDIGenerator', () => {
  return function MockMIDIGenerator() {
    return <div data-testid="midi-generator">MIDI Generator</div>;
  };
});

describe('AnalysisDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render main layout', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('analysis-dashboard')).toBeInTheDocument();
  });

  it('should render AudioInputManager', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('audio-input-manager')).toBeInTheDocument();
  });

  it('should render SpectrumAnalyzer', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('spectrum-analyzer')).toBeInTheDocument();
  });

  it('should render ChordDetector', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('chord-detector')).toBeInTheDocument();
  });

  it('should render MIDIGenerator', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('midi-generator')).toBeInTheDocument();
  });

  it('should show app title', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByText(/music analyzer/i)).toBeInTheDocument();
  });

  it('should handle audio load', async () => {
    render(<AnalysisDashboard />);

    const loadButton = screen.getByText('Mock Load Audio');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByTestId('spectrum-analyzer')).toBeInTheDocument();
    });
  });

  it('should show playback controls when audio is loaded', async () => {
    render(<AnalysisDashboard />);

    const loadButton = screen.getByText('Mock Load Audio');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /play|pause/i })).toBeInTheDocument();
    });
  });

  it('should show time display', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByTestId('time-display')).toBeInTheDocument();
  });

  it('should show detected key', async () => {
    render(<AnalysisDashboard />);

    const loadButton = screen.getByText('Mock Load Audio');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/key:/i)).toBeInTheDocument();
    });
  });

  it('should show tempo/BPM', async () => {
    render(<AnalysisDashboard />);

    const loadButton = screen.getByText('Mock Load Audio');
    fireEvent.click(loadButton);

    await waitFor(() => {
      expect(screen.getByText(/bpm|tempo/i)).toBeInTheDocument();
    });
  });

  it('should have responsive layout', () => {
    render(<AnalysisDashboard />);

    const dashboard = screen.getByTestId('analysis-dashboard');
    expect(dashboard).toHaveClass('dashboard');
  });

  it('should show AI suggestions section', () => {
    render(<AnalysisDashboard />);

    expect(screen.getByText(/suggestions|analysis/i)).toBeInTheDocument();
  });

  it('should allow toggling sidebar', () => {
    render(<AnalysisDashboard />);

    const toggleButton = screen.getByTestId('sidebar-toggle');
    fireEvent.click(toggleButton);

    expect(screen.getByTestId('sidebar')).toHaveClass('collapsed');
  });
});
