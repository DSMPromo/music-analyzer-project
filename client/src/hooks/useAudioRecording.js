import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioRecording() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  const getDevices = useCallback(async () => {
    const allDevices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = (allDevices || []).filter((d) => d.kind === 'audioinput');
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

  const startRecording = useCallback(async (deviceId) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        deviceId: { exact: deviceId },
        sampleRate: 44100,
        echoCancellation: false,
        noiseSuppression: false,
      },
    });

    streamRef.current = stream;
    chunksRef.current = [];

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    mediaRecorder.start(100);
    setIsRecording(true);
    startTimeRef.current = Date.now();

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setDuration(elapsed);
    }, 1000);

    return stream;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    setIsRecording(false);

    return new Blob(chunksRef.current, { type: 'audio/webm' });
  }, []);

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
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
}
