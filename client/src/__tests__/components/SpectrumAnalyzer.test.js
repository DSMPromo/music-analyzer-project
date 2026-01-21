import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import SpectrumAnalyzer from '../../components/SpectrumAnalyzer';

// Mock canvas context
const mockCanvasContext = {
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  createLinearGradient: jest.fn(() => ({
    addColorStop: jest.fn(),
  })),
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext);

describe('SpectrumAnalyzer', () => {
  const mockAnalyser = {
    fftSize: 2048,
    frequencyBinCount: 1024,
    getByteFrequencyData: jest.fn(),
    getByteTimeDomainData: jest.fn(),
  };

  const defaultProps = {
    analyser: mockAnalyser,
    width: 800,
    height: 400,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render canvas element', () => {
    render(<SpectrumAnalyzer {...defaultProps} />);

    const canvas = screen.getByTestId('spectrum-canvas');
    expect(canvas).toBeInTheDocument();
  });

  it('should set canvas dimensions', () => {
    render(<SpectrumAnalyzer {...defaultProps} />);

    const canvas = screen.getByTestId('spectrum-canvas');
    expect(canvas).toHaveAttribute('width', '800');
    expect(canvas).toHaveAttribute('height', '400');
  });

  it('should render mode selector', () => {
    render(<SpectrumAnalyzer {...defaultProps} />);

    expect(screen.getByText(/bars/i)).toBeInTheDocument();
    expect(screen.getByText(/waveform/i)).toBeInTheDocument();
  });

  it('should switch visualization mode', () => {
    render(<SpectrumAnalyzer {...defaultProps} />);

    const waveformButton = screen.getByText(/waveform/i);
    fireEvent.click(waveformButton);

    expect(waveformButton).toHaveClass('active');
  });

  it('should render without analyser (loading state)', () => {
    render(<SpectrumAnalyzer {...defaultProps} analyser={null} />);

    expect(screen.getByText(/no audio|connect audio/i)).toBeInTheDocument();
  });

  it('should show FFT size selector', () => {
    render(<SpectrumAnalyzer {...defaultProps} showControls={true} />);

    expect(screen.getByLabelText(/fft size/i)).toBeInTheDocument();
  });

  it('should show color scheme selector', () => {
    render(<SpectrumAnalyzer {...defaultProps} showControls={true} />);

    expect(screen.getByText(/color/i)).toBeInTheDocument();
  });

  it('should display peak frequency', () => {
    render(<SpectrumAnalyzer {...defaultProps} showStats={true} />);

    expect(screen.getByText(/peak/i)).toBeInTheDocument();
  });

  it('should display RMS level', () => {
    render(<SpectrumAnalyzer {...defaultProps} showStats={true} />);

    expect(screen.getByText(/level|rms/i)).toBeInTheDocument();
  });

  it('should support spectrogram mode', () => {
    render(<SpectrumAnalyzer {...defaultProps} />);

    const spectrogramButton = screen.getByText(/spectrogram/i);
    expect(spectrogramButton).toBeInTheDocument();
  });

  it('should handle resize', () => {
    const { rerender } = render(<SpectrumAnalyzer {...defaultProps} />);

    rerender(<SpectrumAnalyzer {...defaultProps} width={1200} height={600} />);

    const canvas = screen.getByTestId('spectrum-canvas');
    expect(canvas).toHaveAttribute('width', '1200');
    expect(canvas).toHaveAttribute('height', '600');
  });
});
