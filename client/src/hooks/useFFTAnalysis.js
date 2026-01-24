import { useState, useRef, useCallback, useEffect } from 'react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Octave range for chromagram analysis (C1 to B6)
const MIN_OCTAVE = 1;
const MAX_OCTAVE = 6;

export function useFFTAnalysis() {
  const [frequencyData, setFrequencyData] = useState([]);
  const [waveformData, setWaveformData] = useState([]);
  const [chromagram, setChromagram] = useState(new Array(12).fill(0));
  const [chromagramByOctave, setChromagramByOctave] = useState(() => {
    // Initialize octave chromagram: { 1: [12 zeros], 2: [12 zeros], ... 6: [12 zeros] }
    const initial = {};
    for (let oct = MIN_OCTAVE; oct <= MAX_OCTAVE; oct++) {
      initial[oct] = new Array(12).fill(0);
    }
    return initial;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [peakFrequency, setPeakFrequency] = useState(0);
  const [rmsLevel, setRmsLevel] = useState(0);

  const analyserRef = useRef(null);
  const animationRef = useRef(null);
  const intervalRef = useRef(null);

  // Reuse typed arrays to prevent memory allocation on every frame
  const freqDataArrayRef = useRef(null);
  const timeDataArrayRef = useRef(null);

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

  // Compute octave-aware chromagram: energy per pitch class per octave
  const computeChromagramByOctave = useCallback((freqData, sampleRate, fftSize) => {
    const octaveChroma = {};
    for (let oct = MIN_OCTAVE; oct <= MAX_OCTAVE; oct++) {
      octaveChroma[oct] = new Array(12).fill(0);
    }

    const binSize = sampleRate / fftSize;

    for (let i = 1; i < freqData.length; i++) {
      const freq = i * binSize;
      if (freq < 20 || freq > 8000) continue;

      // Convert frequency to MIDI note number
      // A4 = 440Hz = MIDI 69
      const midiNote = 12 * Math.log2(freq / 440) + 69;
      const roundedMidi = Math.round(midiNote);

      // Calculate octave (MIDI 12-23 = octave 1, 24-35 = octave 2, etc.)
      // C1 = MIDI 24, C2 = MIDI 36, C3 = MIDI 48, C4 = MIDI 60
      const octave = Math.floor(roundedMidi / 12) - 1;
      const pitchClass = ((roundedMidi % 12) + 12) % 12;

      if (octave >= MIN_OCTAVE && octave <= MAX_OCTAVE && pitchClass >= 0 && pitchClass < 12) {
        // Weight by amplitude (convert from 0-255 to 0-1)
        octaveChroma[octave][pitchClass] += freqData[i] / 255;
      }
    }

    // Normalize each octave independently
    for (let oct = MIN_OCTAVE; oct <= MAX_OCTAVE; oct++) {
      const max = Math.max(...octaveChroma[oct]);
      if (max > 0) {
        for (let i = 0; i < 12; i++) {
          octaveChroma[oct][i] /= max;
        }
      }
    }

    return octaveChroma;
  }, []);

  const analyze = useCallback(() => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;

    // Reuse typed arrays instead of creating new ones every frame
    // This prevents ~40 allocations/sec and reduces GC pressure
    if (!freqDataArrayRef.current || freqDataArrayRef.current.length !== bufferLength) {
      freqDataArrayRef.current = new Uint8Array(bufferLength);
    }
    if (!timeDataArrayRef.current || timeDataArrayRef.current.length !== bufferLength) {
      timeDataArrayRef.current = new Uint8Array(bufferLength);
    }

    const freqDataArray = freqDataArrayRef.current;
    const timeDataArray = timeDataArrayRef.current;

    analyser.getByteFrequencyData(freqDataArray);
    analyser.getByteTimeDomainData(timeDataArray);

    // Update frequency data
    setFrequencyData(Array.from(freqDataArray));

    // Update waveform data
    setWaveformData(Array.from(timeDataArray));

    // Compute chromagram (flattened)
    const chroma = computeChromagram(freqDataArray, 44100, analyser.fftSize);
    setChromagram(chroma);

    // Compute octave-aware chromagram
    const octaveChroma = computeChromagramByOctave(freqDataArray, 44100, analyser.fftSize);
    setChromagramByOctave(octaveChroma);

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
  }, [computeChromagram, computeChromagramByOctave]);

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
    chromagramByOctave,
    isAnalyzing,
    peakFrequency,
    rmsLevel,
    startAnalysis,
    stopAnalysis,
  };
}
