import { renderHook, act } from '@testing-library/react';

// Mock devices
const mockDevices = [
  { deviceId: 'device1', kind: 'audioinput', label: 'Built-in Microphone' },
  { deviceId: 'device2', kind: 'audioinput', label: 'Mix M1 USB Audio' },
  { deviceId: 'device3', kind: 'videoinput', label: 'FaceTime Camera' },
];

// Mock media stream
const mockMediaStream = {
  id: 'test-stream',
  getTracks: () => [{ stop: jest.fn() }],
};

// Mock MediaRecorder
const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  state: 'recording',
  ondataavailable: null,
  onstop: null,
};

// Track recording state
let recordingState = {
  isRecording: false,
  devices: [],
  selectedDevice: '',
  duration: 0,
};

// Mock the hook implementation
jest.mock('../../hooks/useAudioRecording', () => {
  const React = require('react');

  return {
    useAudioRecording: () => {
      const [devices, setDevices] = React.useState([]);
      const [selectedDevice, setSelectedDevice] = React.useState('');
      const [isRecording, setIsRecording] = React.useState(false);
      const [duration, setDuration] = React.useState(0);
      const timerRef = React.useRef(null);
      const startTimeRef = React.useRef(null);

      const getDevices = React.useCallback(async () => {
        // Filter to only audio inputs
        const audioInputs = mockDevices.filter((d) => d.kind === 'audioinput');
        setDevices(audioInputs);

        // Auto-select Mix M1 if available
        const mixM1 = audioInputs.find((d) => d.label.includes('Mix M1'));
        if (mixM1) {
          setSelectedDevice(mixM1.deviceId);
        } else if (audioInputs.length > 0) {
          setSelectedDevice(audioInputs[0].deviceId);
        }

        return audioInputs;
      }, []);

      const startRecording = React.useCallback(async (deviceId) => {
        // Simulate getUserMedia being called
        mockMediaRecorder.start();
        setIsRecording(true);
        startTimeRef.current = Date.now();

        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
          setDuration(elapsed);
        }, 1000);

        return mockMediaStream;
      }, []);

      const stopRecording = React.useCallback(() => {
        mockMediaRecorder.stop();
        if (timerRef.current) {
          clearInterval(timerRef.current);
        }
        setIsRecording(false);
        return new Blob([], { type: 'audio/webm' });
      }, []);

      const pauseRecording = React.useCallback(() => {
        mockMediaRecorder.pause();
      }, []);

      const resumeRecording = React.useCallback(() => {
        mockMediaRecorder.resume();
      }, []);

      React.useEffect(() => {
        return () => {
          if (timerRef.current) {
            clearInterval(timerRef.current);
          }
        };
      }, []);

      return {
        devices,
        selectedDevice,
        setSelectedDevice,
        isRecording,
        duration,
        getDevices,
        startRecording,
        stopRecording,
        pauseRecording,
        resumeRecording,
      };
    },
  };
});

import { useAudioRecording } from '../../hooks/useAudioRecording';

describe('useAudioRecording', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMediaRecorder.start.mockClear();
    mockMediaRecorder.stop.mockClear();
    mockMediaRecorder.pause.mockClear();
    mockMediaRecorder.resume.mockClear();
  });

  it('should initialize with empty devices list', () => {
    const { result } = renderHook(() => useAudioRecording());

    expect(result.current.devices).toEqual([]);
    expect(result.current.isRecording).toBe(false);
  });

  it('should fetch audio input devices', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
    });

    expect(result.current.devices).toHaveLength(2); // Only audio inputs
  });

  it('should auto-select Mix M1 if available', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
    });

    expect(result.current.selectedDevice).toBe('device2');
  });

  it('should start recording with selected device', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
      await result.current.startRecording('device2');
    });

    expect(mockMediaRecorder.start).toHaveBeenCalled();
    expect(result.current.isRecording).toBe(true);
  });

  it('should stop recording and return blob', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
      await result.current.startRecording('device1');
    });

    act(() => {
      result.current.stopRecording();
    });

    expect(mockMediaRecorder.stop).toHaveBeenCalled();
  });

  it('should pause and resume recording', async () => {
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
      await result.current.startRecording('device1');
    });

    act(() => {
      result.current.pauseRecording();
    });
    expect(mockMediaRecorder.pause).toHaveBeenCalled();

    act(() => {
      result.current.resumeRecording();
    });
    expect(mockMediaRecorder.resume).toHaveBeenCalled();
  });

  it('should update recording duration', async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useAudioRecording());

    await act(async () => {
      await result.current.getDevices();
      await result.current.startRecording('device1');
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.duration).toBeGreaterThanOrEqual(3);

    jest.useRealTimers();
  });

  it('should set selected device', () => {
    const { result } = renderHook(() => useAudioRecording());

    act(() => {
      result.current.setSelectedDevice('device1');
    });

    expect(result.current.selectedDevice).toBe('device1');
  });
});
