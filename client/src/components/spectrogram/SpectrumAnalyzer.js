import React, { useRef, useEffect, useState } from 'react';

function SpectrumAnalyzer({ analyser, width, height, showControls, showStats }) {
  const canvasRef = useRef(null);
  const [mode, setMode] = useState('bars');
  const [fftSize, setFftSize] = useState(2048);
  const [colorScheme, setColorScheme] = useState('default');
  const [peakFreq, setPeakFreq] = useState(0);
  const [rmsLevel, setRmsLevel] = useState(0);
  const animationRef = useRef(null);

  useEffect(() => {
    if (!analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);

    const draw = () => {
      animationRef.current = requestAnimationFrame(draw);

      if (mode === 'bars' || mode === 'spectrogram') {
        analyser.getByteFrequencyData(dataArray);
      } else {
        analyser.getByteTimeDomainData(timeDataArray);
      }

      ctx.clearRect(0, 0, width, height);

      if (mode === 'bars') {
        const barWidth = (width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;
          ctx.fillStyle = `rgb(50, ${dataArray[i] + 100}, 50)`;
          ctx.fillRect(x, height - barHeight, barWidth, barHeight);
          x += barWidth + 1;
        }
      } else if (mode === 'waveform') {
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#00ff00';
        ctx.beginPath();

        const sliceWidth = width / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const v = timeDataArray[i] / 128.0;
          const y = (v * height) / 2;

          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
          x += sliceWidth;
        }
        ctx.stroke();
      }

      // Calculate stats
      if (showStats) {
        let maxVal = 0;
        let maxIdx = 0;
        let sum = 0;

        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > maxVal) {
            maxVal = dataArray[i];
            maxIdx = i;
          }
          const norm = (dataArray[i] - 128) / 128;
          sum += norm * norm;
        }

        setPeakFreq(Math.round((maxIdx * 44100) / (bufferLength * 2)));
        setRmsLevel(Math.sqrt(sum / bufferLength).toFixed(2));
      }
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, width, height, mode, showStats]);

  if (!analyser) {
    return (
      <div className="spectrum-analyzer">
        <p>No audio source connected</p>
      </div>
    );
  }

  return (
    <div className="spectrum-analyzer">
      <div className="mode-selector">
        <button
          className={mode === 'bars' ? 'active' : ''}
          onClick={() => setMode('bars')}
        >
          Bars
        </button>
        <button
          className={mode === 'waveform' ? 'active' : ''}
          onClick={() => setMode('waveform')}
        >
          Waveform
        </button>
        <button
          className={mode === 'spectrogram' ? 'active' : ''}
          onClick={() => setMode('spectrogram')}
        >
          Spectrogram
        </button>
      </div>

      <canvas
        ref={canvasRef}
        data-testid="spectrum-canvas"
        width={width}
        height={height}
      />

      {showControls && (
        <div className="controls">
          <label>
            FFT Size
            <select
              value={fftSize}
              onChange={(e) => setFftSize(Number(e.target.value))}
              aria-label="FFT Size"
            >
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
              <option value={8192}>8192</option>
            </select>
          </label>

          <label>
            Color Scheme
            <select
              value={colorScheme}
              onChange={(e) => setColorScheme(e.target.value)}
            >
              <option value="default">Default</option>
              <option value="gradient">Gradient</option>
              <option value="rainbow">Rainbow</option>
            </select>
          </label>
        </div>
      )}

      {showStats && (
        <div className="stats">
          <span>Peak: {peakFreq} Hz</span>
          <span>Level (RMS): {rmsLevel}</span>
        </div>
      )}
    </div>
  );
}

export default SpectrumAnalyzer;
