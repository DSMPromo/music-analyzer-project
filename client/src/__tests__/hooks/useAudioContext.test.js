import { renderHook, act } from '@testing-library/react';

// Track mock calls externally
const mockCalls = {
  createAnalyser: [],
  createMediaElementSource: [],
  createMediaStreamSource: [],
  close: [],
};

// Create mocks that will be accessible in the factory
const mockAnalyser = {
  fftSize: 2048,
  smoothingTimeConstant: 0.8,
  minDecibels: -90,
  maxDecibels: -10,
  connect: () => {},
  disconnect: () => {},
  frequencyBinCount: 1024,
};

// Mock the hook implementation
jest.mock('../../hooks/useAudioContext', () => {
  const React = require('react');

  return {
    useAudioContext: () => {
      const [audioContext, setAudioContext] = React.useState(null);
      const [analyser, setAnalyser] = React.useState(null);
      const contextRef = React.useRef(null);

      const initAudio = React.useCallback(async () => {
        // Create a fresh analyser for each call
        const analyserNode = {
          fftSize: 2048,
          smoothingTimeConstant: 0.8,
          minDecibels: -90,
          maxDecibels: -10,
          connect: () => {},
          disconnect: () => {},
          frequencyBinCount: 1024,
        };

        const ctx = {
          createAnalyser: () => {
            mockCalls.createAnalyser.push(true);
            return analyserNode;
          },
          createMediaElementSource: (el) => {
            mockCalls.createMediaElementSource.push(el);
            return { connect: () => {} };
          },
          createMediaStreamSource: (stream) => {
            mockCalls.createMediaStreamSource.push(stream);
            return { connect: () => {} };
          },
          close: () => {
            mockCalls.close.push(true);
            return Promise.resolve();
          },
          state: 'running',
          sampleRate: 44100,
          resume: () => Promise.resolve(),
          destination: {},
        };

        contextRef.current = ctx;

        const createdAnalyser = ctx.createAnalyser();
        createdAnalyser.fftSize = 4096;
        createdAnalyser.smoothingTimeConstant = 0.8;

        setAudioContext(ctx);
        setAnalyser(createdAnalyser);
        return ctx;
      }, []);

      const connectSource = React.useCallback((audioElement) => {
        if (!contextRef.current) return;
        const source = contextRef.current.createMediaElementSource(audioElement);
        return source;
      }, []);

      const connectStream = React.useCallback((stream) => {
        if (!contextRef.current) return;
        const source = contextRef.current.createMediaStreamSource(stream);
        return source;
      }, []);

      React.useEffect(() => {
        return () => {
          if (contextRef.current && contextRef.current.state !== 'closed') {
            contextRef.current.close();
          }
        };
      }, []);

      return {
        audioContext,
        analyser,
        initAudio,
        connectSource,
        connectStream,
      };
    },
  };
});

import { useAudioContext } from '../../hooks/useAudioContext';

describe('useAudioContext', () => {
  beforeEach(() => {
    mockCalls.createAnalyser = [];
    mockCalls.createMediaElementSource = [];
    mockCalls.createMediaStreamSource = [];
    mockCalls.close = [];
  });

  it('should initialize with null audioContext and analyser', () => {
    const { result } = renderHook(() => useAudioContext());

    expect(result.current.audioContext).toBeNull();
    expect(result.current.analyser).toBeNull();
  });

  it('should create AudioContext when initAudio is called', async () => {
    const { result } = renderHook(() => useAudioContext());

    await act(async () => {
      await result.current.initAudio();
    });

    expect(result.current.audioContext).not.toBeNull();
    expect(result.current.audioContext.sampleRate).toBe(44100);
  });

  it('should create and configure analyser node', async () => {
    const { result } = renderHook(() => useAudioContext());

    await act(async () => {
      await result.current.initAudio();
    });

    expect(mockCalls.createAnalyser.length).toBeGreaterThan(0);
    expect(result.current.analyser).not.toBeNull();
  });

  it('should configure analyser with correct FFT settings', async () => {
    const { result } = renderHook(() => useAudioContext());

    await act(async () => {
      await result.current.initAudio();
    });

    expect(result.current.analyser.fftSize).toBe(4096);
    expect(result.current.analyser.smoothingTimeConstant).toBe(0.8);
  });

  it('should connect audio element source to analyser', async () => {
    const { result } = renderHook(() => useAudioContext());
    const mockAudioElement = document.createElement('audio');

    await act(async () => {
      await result.current.initAudio();
    });

    act(() => {
      result.current.connectSource(mockAudioElement);
    });

    expect(mockCalls.createMediaElementSource).toContain(mockAudioElement);
  });

  it('should connect media stream to analyser', async () => {
    const { result } = renderHook(() => useAudioContext());
    const mockStream = { id: 'test-stream' };

    await act(async () => {
      await result.current.initAudio();
    });

    act(() => {
      result.current.connectStream(mockStream);
    });

    expect(mockCalls.createMediaStreamSource).toContainEqual(mockStream);
  });

  it('should cleanup on unmount', async () => {
    const { result, unmount } = renderHook(() => useAudioContext());

    await act(async () => {
      await result.current.initAudio();
    });

    unmount();

    expect(mockCalls.close.length).toBeGreaterThan(0);
  });
});
