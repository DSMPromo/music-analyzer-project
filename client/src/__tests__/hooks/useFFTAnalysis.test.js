import { renderHook, act } from '@testing-library/react';
import { useFFTAnalysis } from '../../hooks/useFFTAnalysis';

// Mock analyser node
const createMockAnalyser = (fftSize = 2048) => ({
  fftSize,
  frequencyBinCount: fftSize / 2,
  getByteFrequencyData: jest.fn((array) => {
    // Simulate some frequency data
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }),
  getByteTimeDomainData: jest.fn((array) => {
    // Simulate waveform data
    for (let i = 0; i < array.length; i++) {
      array[i] = 128 + Math.floor(Math.sin(i * 0.1) * 50);
    }
  }),
  getFloatFrequencyData: jest.fn((array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = -50 + Math.random() * 30;
    }
  }),
});

describe('useFFTAnalysis', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize with empty data arrays', () => {
    const { result } = renderHook(() => useFFTAnalysis());

    expect(result.current.frequencyData).toEqual([]);
    expect(result.current.waveformData).toEqual([]);
    expect(result.current.chromagram).toEqual([]);
  });

  it('should start analysis when analyser is provided', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    expect(result.current.isAnalyzing).toBe(true);
  });

  it('should update frequency data on each frame', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    // Simulate animation frame
    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.frequencyData.length).toBeGreaterThan(0);
  });

  it('should compute chromagram from frequency data', () => {
    const mockAnalyser = createMockAnalyser(4096);
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Chromagram should have 12 elements (one per pitch class)
    expect(result.current.chromagram).toHaveLength(12);
  });

  it('should stop analysis', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    act(() => {
      result.current.stopAnalysis();
    });

    expect(result.current.isAnalyzing).toBe(false);
  });

  it('should compute peak frequency', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(typeof result.current.peakFrequency).toBe('number');
  });

  it('should compute RMS level', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(typeof result.current.rmsLevel).toBe('number');
    expect(result.current.rmsLevel).toBeGreaterThanOrEqual(0);
  });

  it('should update waveform data', () => {
    const mockAnalyser = createMockAnalyser();
    const { result } = renderHook(() => useFFTAnalysis());

    act(() => {
      result.current.startAnalysis(mockAnalyser);
    });

    act(() => {
      jest.advanceTimersByTime(100);
    });

    expect(result.current.waveformData.length).toBeGreaterThan(0);
  });
});
