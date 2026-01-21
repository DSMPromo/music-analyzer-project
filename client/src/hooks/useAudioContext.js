import { useState, useRef, useCallback, useEffect } from 'react';

export function useAudioContext() {
  const [audioContext, setAudioContext] = useState(null);
  const analyserRef = useRef(null);
  const contextRef = useRef(null);

  const initAudio = useCallback(async () => {
    const AudioContextClass = window.AudioContext || global.AudioContext || AudioContext;
    const ctx = new AudioContextClass({ sampleRate: 44100 });
    contextRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setAudioContext(ctx);
    return ctx;
  }, []);

  const connectSource = useCallback((audioElement) => {
    if (!contextRef.current || !analyserRef.current) return;

    const source = contextRef.current.createMediaElementSource(audioElement);
    source.connect(analyserRef.current);
    analyserRef.current.connect(contextRef.current.destination);

    return source;
  }, []);

  const connectStream = useCallback((stream) => {
    if (!contextRef.current || !analyserRef.current) return;

    const source = contextRef.current.createMediaStreamSource(stream);
    source.connect(analyserRef.current);

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
    initAudio,
    connectSource,
    connectStream,
  };
}
