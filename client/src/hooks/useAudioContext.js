import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [leftAnalyser, setLeftAnalyser] = useState(null);
  const [rightAnalyser, setRightAnalyser] = useState(null);
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
    const newAnalyser = ctx.createAnalyser();
    newAnalyser.fftSize = 4096;
    newAnalyser.smoothingTimeConstant = 0.8;
    analyserRef.current = newAnalyser;
    setAnalyser(newAnalyser);

    // Channel splitter for stereo analysis
    const splitter = ctx.createChannelSplitter(2);
    splitterRef.current = splitter;

    // Left channel analyser
    const newLeftAnalyser = ctx.createAnalyser();
    newLeftAnalyser.fftSize = 2048;
    newLeftAnalyser.smoothingTimeConstant = 0.8;
    leftAnalyserRef.current = newLeftAnalyser;
    setLeftAnalyser(newLeftAnalyser);

    // Right channel analyser
    const newRightAnalyser = ctx.createAnalyser();
    newRightAnalyser.fftSize = 2048;
    newRightAnalyser.smoothingTimeConstant = 0.8;
    rightAnalyserRef.current = newRightAnalyser;
    setRightAnalyser(newRightAnalyser);

    // Connect splitter to individual analysers
    splitter.connect(newLeftAnalyser, 0);
    splitter.connect(newRightAnalyser, 1);

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setAudioContext(ctx);
    return { ctx, analyser: newAnalyser };
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
      // Disconnect all audio nodes before closing context to prevent leaks
      try {
        if (analyserRef.current) {
          analyserRef.current.disconnect();
        }
      } catch (e) { /* Ignore disconnect errors */ }

      try {
        if (leftAnalyserRef.current) {
          leftAnalyserRef.current.disconnect();
        }
      } catch (e) { /* Ignore disconnect errors */ }

      try {
        if (rightAnalyserRef.current) {
          rightAnalyserRef.current.disconnect();
        }
      } catch (e) { /* Ignore disconnect errors */ }

      try {
        if (splitterRef.current) {
          splitterRef.current.disconnect();
        }
      } catch (e) { /* Ignore disconnect errors */ }

      // Now close the context
      if (contextRef.current && contextRef.current.state !== 'closed') {
        try {
          contextRef.current.close();
        } catch (e) { /* Ignore close errors */ }
      }
    };
  }, []);

  return {
    audioContext,
    analyser,
    leftAnalyser,
    rightAnalyser,
    initAudio,
    connectSource,
    connectStream,
  };
}
