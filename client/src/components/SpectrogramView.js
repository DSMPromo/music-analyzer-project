import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useSpectrogramGenerator } from '../hooks/useSpectrogramGenerator';
import {
  getFrequencyLabels,
  getTimeLabels,
  xToTime,
  yToFrequency,
  timeToX,
  formatDb,
  formatFrequency,
  getDbAtTimeFreq
} from '../utils/spectrogramUtils';

/**
 * SpectrogramView Component
 * Professional spectrogram visualization with L/R channel display,
 * playhead sync, click-to-seek, and frequency/time axes
 */
function SpectrogramView({
  audioBuffer,
  currentTime = 0,
  duration = 0,
  isPlaying = false,
  onSeek,
  height = 300,
  showStereo = true,
  problemMarkers = [],
  onHover = null
}) {
  // Refs
  const containerRef = useRef(null);
  const spectrogramCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const animationRef = useRef(null);

  // State
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [viewMode, setViewMode] = useState('stereo'); // 'stereo' or 'mono'

  // Spectrogram generator hook
  const {
    isGenerating,
    progress,
    spectrogramData,
    error,
    generateSpectrogram,
    clearSpectrogram
  } = useSpectrogramGenerator();

  // Calculate dimensions with safe minimums
  const AXIS_LEFT_PADDING = 50;
  const AXIS_BOTTOM_PADDING = 25;
  const spectrogramWidth = Math.max(100, containerWidth - AXIS_LEFT_PADDING);
  const spectrogramHeight = Math.max(100, height - AXIS_BOTTOM_PADDING);

  // Frequency and time labels
  const frequencyLabels = useMemo(() =>
    getFrequencyLabels(8, 20, 20000),
    []
  );

  const timeLabels = useMemo(() =>
    duration > 0 ? getTimeLabels(duration, Math.max(5, Math.floor(containerWidth / 100))) : [],
    [duration, containerWidth]
  );

  // Handle container resize
  useEffect(() => {
    if (!containerRef.current) return;

    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    resizeObserver.observe(containerRef.current);

    return () => resizeObserver.disconnect();
  }, []);

  // Generate spectrogram when audioBuffer changes
  useEffect(() => {
    if (audioBuffer) {
      generateSpectrogram(audioBuffer, {
        width: spectrogramWidth,
        height: spectrogramHeight
      });
    } else {
      clearSpectrogram();
    }
  }, [audioBuffer, spectrogramWidth, spectrogramHeight, generateSpectrogram, clearSpectrogram]);

  // Render spectrogram to canvas
  useEffect(() => {
    if (!spectrogramData || !spectrogramCanvasRef.current) return;

    const canvas = spectrogramCanvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear canvas
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const isStereo = spectrogramData.numChannels > 1 && viewMode === 'stereo';

    if (isStereo && spectrogramData.left && spectrogramData.right) {
      // Draw stereo view (L on top, R on bottom)
      const channelHeight = Math.floor(spectrogramHeight / 2);

      // Left channel
      if (spectrogramData.left.imageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = spectrogramData.left.imageData.width;
        tempCanvas.height = spectrogramData.left.imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(spectrogramData.left.imageData, 0, 0);
        ctx.drawImage(tempCanvas, AXIS_LEFT_PADDING, 0, spectrogramWidth, channelHeight);
      }

      // Channel separator
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(AXIS_LEFT_PADDING, channelHeight);
      ctx.lineTo(canvas.width, channelHeight);
      ctx.stroke();

      // Right channel
      if (spectrogramData.right.imageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = spectrogramData.right.imageData.width;
        tempCanvas.height = spectrogramData.right.imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(spectrogramData.right.imageData, 0, 0);
        ctx.drawImage(tempCanvas, AXIS_LEFT_PADDING, channelHeight, spectrogramWidth, channelHeight);
      }

      // Channel labels
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText('L', 5, 15);
      ctx.fillText('R', 5, channelHeight + 15);

    } else {
      // Mono view
      if (spectrogramData.mono.imageData) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = spectrogramData.mono.imageData.width;
        tempCanvas.height = spectrogramData.mono.imageData.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(spectrogramData.mono.imageData, 0, 0);
        ctx.drawImage(tempCanvas, AXIS_LEFT_PADDING, 0, spectrogramWidth, spectrogramHeight);
      }
    }

    // Draw frequency axis (Y)
    ctx.fillStyle = '#666';
    ctx.font = '9px monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    frequencyLabels.forEach(({ freq, label }) => {
      // Calculate Y position (inverted: top = high freq)
      const ratio = Math.log10(freq / 20) / Math.log10(20000 / 20);
      const y = spectrogramHeight * (1 - ratio);

      // Draw tick
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(AXIS_LEFT_PADDING - 3, y);
      ctx.lineTo(AXIS_LEFT_PADDING, y);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#666';
      ctx.fillText(label, AXIS_LEFT_PADDING - 5, y);
    });

    // Draw time axis (X)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    timeLabels.forEach(({ time, label }) => {
      const x = AXIS_LEFT_PADDING + (time / duration) * spectrogramWidth;

      // Draw tick
      ctx.strokeStyle = '#333';
      ctx.beginPath();
      ctx.moveTo(x, spectrogramHeight);
      ctx.lineTo(x, spectrogramHeight + 3);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = '#666';
      ctx.fillText(label, x, spectrogramHeight + 5);
    });

    // Draw dB scale on right side
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const dbLabels = [0, -10, -20, -30, -60, -90];
    dbLabels.forEach((db, i) => {
      const y = (i / (dbLabels.length - 1)) * 60 + 10;
      ctx.fillStyle = '#555';
      ctx.fillText(`${db}`, canvas.width - 25, y);
    });

    // Draw problem markers
    if (problemMarkers.length > 0) {
      problemMarkers.forEach(marker => {
        const x1 = AXIS_LEFT_PADDING + (marker.startTime / duration) * spectrogramWidth;
        const x2 = AXIS_LEFT_PADDING + (marker.endTime / duration) * spectrogramWidth;

        // Calculate Y position for frequency
        const freqRatio = Math.log10(marker.frequency / 20) / Math.log10(20000 / 20);
        const y = spectrogramHeight * (1 - freqRatio);

        // Draw marker
        ctx.strokeStyle = marker.severity === 'severe' ? '#ef4444' :
                          marker.severity === 'moderate' ? '#f59e0b' : '#3b82f6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
        ctx.stroke();

        // Draw marker icon
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.arc(x1, y, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }

  }, [spectrogramData, viewMode, frequencyLabels, timeLabels, duration, spectrogramWidth, spectrogramHeight, problemMarkers]);

  // Animate playhead
  useEffect(() => {
    if (!overlayCanvasRef.current) return;

    const drawOverlay = () => {
      const canvas = overlayCanvasRef.current;
      const ctx = canvas.getContext('2d');

      // Clear overlay
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (duration > 0) {
        // Draw playhead
        const playheadX = AXIS_LEFT_PADDING + (currentTime / duration) * spectrogramWidth;

        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, spectrogramHeight);
        ctx.stroke();

        // Draw playhead handle
        ctx.fillStyle = '#e94560';
        ctx.beginPath();
        ctx.moveTo(playheadX - 6, 0);
        ctx.lineTo(playheadX + 6, 0);
        ctx.lineTo(playheadX, 8);
        ctx.closePath();
        ctx.fill();
      }

      // Draw hover info
      if (hoverInfo) {
        const { x, y, time, freq, db } = hoverInfo;

        // Draw crosshairs
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, spectrogramHeight);
        ctx.moveTo(AXIS_LEFT_PADDING, y);
        ctx.lineTo(AXIS_LEFT_PADDING + spectrogramWidth, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw info tooltip
        const tooltipText = `${formatFrequency(freq)} | ${formatDb(db)} | ${time.toFixed(2)}s`;
        ctx.font = '11px monospace';
        const textWidth = ctx.measureText(tooltipText).width;

        const tooltipX = Math.min(x + 10, canvas.width - textWidth - 20);
        const tooltipY = Math.max(y - 25, 5);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(tooltipX - 5, tooltipY - 3, textWidth + 10, 18);

        ctx.fillStyle = '#fff';
        ctx.fillText(tooltipText, tooltipX, tooltipY + 10);
      }
    };

    if (isPlaying) {
      const animate = () => {
        drawOverlay();
        animationRef.current = requestAnimationFrame(animate);
      };
      animate();
    } else {
      drawOverlay();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTime, duration, isPlaying, hoverInfo, spectrogramWidth, spectrogramHeight]);

  // Handle mouse move for hover info
  const handleMouseMove = useCallback((e) => {
    if (!spectrogramData || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if within spectrogram area
    if (x >= AXIS_LEFT_PADDING && x <= AXIS_LEFT_PADDING + spectrogramWidth &&
        y >= 0 && y <= spectrogramHeight) {

      const time = xToTime(x - AXIS_LEFT_PADDING, spectrogramWidth, duration);
      const freq = yToFrequency(y, spectrogramHeight);

      // Get dB at this position
      const db = spectrogramData.mono?.spectrogram
        ? getDbAtTimeFreq(spectrogramData.mono.spectrogram, time, freq)
        : -90;

      const info = { x, y, time, freq, db };
      setHoverInfo(info);

      if (onHover) {
        onHover(info);
      }
    } else {
      setHoverInfo(null);
    }
  }, [spectrogramData, spectrogramWidth, spectrogramHeight, duration, onHover]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoverInfo(null);
  }, []);

  // Handle click to seek
  const handleClick = useCallback((e) => {
    if (!onSeek || !containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    // Check if within spectrogram area
    if (x >= AXIS_LEFT_PADDING && x <= AXIS_LEFT_PADDING + spectrogramWidth) {
      const time = xToTime(x - AXIS_LEFT_PADDING, spectrogramWidth, duration);
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  }, [onSeek, duration, spectrogramWidth]);

  // Toggle view mode
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'stereo' ? 'mono' : 'stereo');
  }, []);

  // Render loading state
  if (isGenerating) {
    return (
      <div className="spectrogram-view">
        <div className="spectrogram-header">
          <h3>Spectrogram</h3>
        </div>
        <div className="spectrogram-loading">
          <div className="spectrogram-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="progress-text">
              Computing spectrogram... {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="spectrogram-view">
        <div className="spectrogram-header">
          <h3>Spectrogram</h3>
        </div>
        <div className="spectrogram-error">
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!audioBuffer || !spectrogramData) {
    return (
      <div className="spectrogram-view">
        <div className="spectrogram-header">
          <h3>Spectrogram</h3>
        </div>
        <div className="spectrogram-empty">
          <p>Load an audio file to view the spectrogram</p>
        </div>
      </div>
    );
  }

  return (
    <div className="spectrogram-view" ref={containerRef}>
      <div className="spectrogram-header">
        <h3>Spectrogram</h3>
        <div className="spectrogram-controls">
          {spectrogramData.numChannels > 1 && (
            <button
              className={`view-mode-btn ${viewMode === 'stereo' ? 'active' : ''}`}
              onClick={toggleViewMode}
            >
              {viewMode === 'stereo' ? 'L/R' : 'Mono'}
            </button>
          )}
          <span className="spectrogram-info">
            {spectrogramData.numChannels}ch | {spectrogramData.sampleRate}Hz | FFT {spectrogramData.fftSize}
          </span>
        </div>
      </div>

      <div
        className="spectrogram-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ cursor: 'crosshair' }}
      >
        <canvas
          ref={spectrogramCanvasRef}
          width={containerWidth}
          height={height}
          className="spectrogram-canvas"
        />
        <canvas
          ref={overlayCanvasRef}
          width={containerWidth}
          height={height}
          className="spectrogram-overlay"
        />
      </div>

      <div className="spectrogram-legend">
        <span className="legend-label">Quiet</span>
        <div className="legend-gradient" />
        <span className="legend-label">Loud</span>
      </div>
    </div>
  );
}

export default SpectrogramView;
