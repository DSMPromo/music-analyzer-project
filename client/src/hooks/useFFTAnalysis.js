import { useState, useRef, useCallback, useEffect } from 'react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function useFFTAnalysis() {
  const [frequencyData, setFrequencyData] = useState([]);
  const [waveformData, setWaveformData] = useState([]);
  const [chromagram, setChromagram] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [peakFrequency, setPeakFrequency] = useState(0);
  const [rmsLevel, setRmsLevel] = useState(0);

  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const intervalRef = useRef(null);

  const computeChromagram = useCallback((freqData, sampleRate, fftSize) => {
    const chroma = new Array(12).fill(0);
    const binSize = sampleRate / fftSize;

    for (let i = 1; i < freqData.length; i++) {
      const freq = i * binSize;
      if (freq < 20 || freq > 5000) continue;

      // Convert frequency to MIDI note
      const midiNote = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = Math.round(midiNote) % 12;

      if (pitchClass >= 0 && pitchClass < 12) {
        chroma[pitchClass] += freqData[i] / 255;
      }
    }

    // Normalize
    const max = Math.max(...chroma);
    if (max > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= max;
      }
    }

    return chroma;
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const freqDataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    analyser.getByteFrequencyData(freqDataArray);
    analyser.getByteTimeDomainData(timeDataArray);

    // Update frequency data
    setFrequencyData(Array.from(freqDataArray));

    // Update waveform data
    setWaveformData(Array.from(timeDataArray));

    // Compute chromagram
    const chroma = computeChromagram(freqDataArray, 44100, analyser.fftSize);
    setChromagram(chroma);

    // Find peak frequency
    let maxVal = 0;
    let maxIdx = 0;
    for (let i = 0; i < bufferLength; i++) {
      if (freqDataArray[i] > maxVal) {
        maxVal = freqDataArray[i];
        maxIdx = i;
      }
    }
    const peakFreq = (maxIdx * 44100) / (bufferLength * 2);
    setPeakFrequency(peakFreq);

    // Compute RMS
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeDataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    setRmsLevel(Math.sqrt(sum / bufferLength));
  }, [computeChromagram]);

  const startAnalysis = useCallback((analyser) => {
    analyserRef.current = analyser;
    setIsAnalyzing(true);

    // Use interval for analysis (works better in tests)
    intervalRef.current = setInterval(() => {
      analyze();
    }, 50);
  }, [analyze]);

  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    frequencyData,
    waveformData,
    chromagram,
    isAnalyzing,
    peakFrequency,
    rmsLevel,
    startAnalysis,
    stopAnalysis,
  };
}
