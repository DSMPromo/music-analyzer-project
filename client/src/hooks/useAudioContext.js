import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState(null);
  const analyserRef = useRef(null);
  const leftAnalyserRef = useRef(null);
  const rightAnalyserRef = useRef(null);
  const splitterRef = useRef(null);
  const contextRef = useRef(null);

  const initAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext || global.AudioContext || AudioContext;
    const ctx = new AudioContextClass({ sampleRate: 44100 });
    contextRef.current = ctx;

    // Main analyser (mono/mixed)
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Channel splitter for stereo analysis
    const splitter = ctx.createChannelSplitter(2);
    splitterRef.current = splitter;

    // Left channel analyser
    const leftAnalyser = ctx.createAnalyser();
    leftAnalyser.fftSize = 2048;
    leftAnalyser.smoothingTimeConstant = 0.8;
    leftAnalyserRef.current = leftAnalyser;

    // Right channel analyser
    const rightAnalyser = ctx.createAnalyser();
    rightAnalyser.fftSize = 2048;
    rightAnalyser.smoothingTimeConstant = 0.8;
    rightAnalyserRef.current = rightAnalyser;

    // Connect splitter to individual analysers
    splitter.connect(leftAnalyser, 0);
    splitter.connect(rightAnalyser, 1);

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setAudioContext(ctx);
    return ctx;
  }, []);

  const connectSource = useCallback((audioElement) => {
    if (!contextRef.current || !analyserRef.current) return;

    const source = contextRef.current.createMediaElementSource(audioElement);

    // Connect to main analyser
    source.connect(analyserRef.current);
    analyserRef.current.connect(contextRef.current.destination);

    // Connect to stereo splitter for L/R analysis
    if (splitterRef.current) {
      source.connect(splitterRef.current);
    }

    return source;
  }, []);

  const connectStream = useCallback((stream) => {
    if (!contextRef.current || !analyserRef.current) return;

    const source = contextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);

    // Connect to stereo splitter for L/R analysis
    if (splitterRef.current) {
      source.connect(splitterRef.current);
    }

    return source;
  }, []);

  useEffect(() => {
    return () => {
      if (contextRef.current && contextRef.current.state !== 'closed') {
        contextRef.current.close();
      }
    };
  }, []);

  return {
    audioContext,
    analyser: analyserRef.current,
    leftAnalyser: leftAnalyserRef.current,
    rightAnalyser: rightAnalyserRef.current,
    initAudio,
    connectSource,
    connectStream,
  };
}
