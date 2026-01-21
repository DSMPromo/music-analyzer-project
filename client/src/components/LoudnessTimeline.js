import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';

/**
 * LoudnessTimeline Component
 * LUFS heatmap bar chart synced with spectrogram
 */
function LoudnessTimeline({
  loudnessData,
  currentTime = 0,
  duration = 0,
  onSeek,
  height = 60,
  showLabels = true
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [hoveredSegment, setHoveredSegment] = useState(null);

  // Constants
  const PADDING_LEFT = 50;
  const PADDING_RIGHT = 30;
  const BAR_HEIGHT = height - 25;

  // Handle resize
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

  // Calculate segment widths
  const barWidth = useMemo(() => {
    if (!loudnessData?.segments?.length) return 0;
    const availableWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT;
    return availableWidth / loudnessData.segments.length;
  }, [loudnessData, containerWidth]);

  // Get color for LUFS value
  const getLufsColor = useCallback((lufs, status) => {
    if (status === 'hot') return '#EF4444';
    if (status === 'warm') return '#F59E0B';
    if (status === 'quiet') return '#3B82F6';
    return '#10B981'; // good
  }, []);

  // Calculate bar height from LUFS
  const getLufsBarHeight = useCallback((lufs) => {
    // Map LUFS (-70 to 0) to bar height
    const normalized = Math.max(0, Math.min(1, (lufs + 70) / 70));
    return normalized * BAR_HEIGHT;
  }, [BAR_HEIGHT]);

  // Render canvas
  useEffect(() => {
    if (!canvasRef.current || !loudnessData?.segments) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Clear
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const segments = loudnessData.segments;
    const availableWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT;

    // Draw grid lines
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;

    // LUFS reference lines
    const lufsLevels = [-24, -18, -14, -10, -6];
    lufsLevels.forEach(lufs => {
      const y = BAR_HEIGHT - getLufsBarHeight(lufs);
      ctx.beginPath();
      ctx.moveTo(PADDING_LEFT, y);
      ctx.lineTo(containerWidth - PADDING_RIGHT, y);
      ctx.stroke();
    });

    // Draw bars
    segments.forEach((segment, idx) => {
      const x = PADDING_LEFT + idx * barWidth;
      const barHeight = getLufsBarHeight(segment.lufs);
      const y = BAR_HEIGHT - barHeight;

      // Bar fill
      ctx.fillStyle = getLufsColor(segment.lufs, segment.status);
      ctx.fillRect(x + 1, y, Math.max(1, barWidth - 2), barHeight);

      // Highlight hovered segment
      if (hoveredSegment === idx) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y - 1, barWidth, barHeight + 2);
      }
    });

    // Draw playhead
    if (duration > 0) {
      const playheadX = PADDING_LEFT + (currentTime / duration) * availableWidth;
      ctx.strokeStyle = '#e94560';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, BAR_HEIGHT);
      ctx.stroke();
    }

    // Draw Y-axis labels
    if (showLabels) {
      ctx.fillStyle = '#666';
      ctx.font = '9px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';

      lufsLevels.forEach(lufs => {
        const y = BAR_HEIGHT - getLufsBarHeight(lufs);
        ctx.fillText(`${lufs}`, PADDING_LEFT - 5, y);
      });
    }

    // Draw legend
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // Average LUFS
    if (loudnessData.integratedLUFS) {
      const avgText = `Avg: ${loudnessData.integratedLUFS.toFixed(1)} LUFS`;
      ctx.fillStyle = '#888';
      ctx.fillText(avgText, containerWidth / 2, BAR_HEIGHT + 5);
    }

    // Dynamic range
    if (loudnessData.dynamicRange) {
      const drText = `DR: ${loudnessData.dynamicRange.toFixed(1)}dB`;
      ctx.fillStyle = '#666';
      ctx.textAlign = 'right';
      ctx.fillText(drText, containerWidth - 5, BAR_HEIGHT + 5);
    }

  }, [loudnessData, containerWidth, currentTime, duration, hoveredSegment, barWidth, getLufsColor, getLufsBarHeight, showLabels, BAR_HEIGHT]);

  // Handle mouse move
  const handleMouseMove = useCallback((e) => {
    if (!loudnessData?.segments || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x >= PADDING_LEFT && x <= containerWidth - PADDING_RIGHT) {
      const segmentIdx = Math.floor((x - PADDING_LEFT) / barWidth);
      if (segmentIdx >= 0 && segmentIdx < loudnessData.segments.length) {
        setHoveredSegment(segmentIdx);
      } else {
        setHoveredSegment(null);
      }
    } else {
      setHoveredSegment(null);
    }
  }, [loudnessData, containerWidth, barWidth]);

  // Handle click
  const handleClick = useCallback((e) => {
    if (!onSeek || !containerRef.current || duration <= 0) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;

    if (x >= PADDING_LEFT && x <= containerWidth - PADDING_RIGHT) {
      const availableWidth = containerWidth - PADDING_LEFT - PADDING_RIGHT;
      const time = ((x - PADDING_LEFT) / availableWidth) * duration;
      onSeek(Math.max(0, Math.min(duration, time)));
    }
  }, [onSeek, duration, containerWidth]);

  // Handle mouse leave
  const handleMouseLeave = useCallback(() => {
    setHoveredSegment(null);
  }, []);

  // Render empty state
  if (!loudnessData?.segments?.length) {
    return (
      <div className="loudness-timeline" ref={containerRef}>
        <div className="loudness-header">
          <h4>Loudness Timeline</h4>
        </div>
        <div className="loudness-empty">
          <p>Run mix analysis to view loudness timeline</p>
        </div>
      </div>
    );
  }

  // Format time
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const hoveredData = hoveredSegment !== null
    ? loudnessData.segments[hoveredSegment]
    : null;

  return (
    <div className="loudness-timeline" ref={containerRef}>
      <div className="loudness-header">
        <h4>Loudness Timeline (LUFS)</h4>
        <div className="loudness-legend">
          <span className="legend-item good">Good (&lt;-14)</span>
          <span className="legend-item warm">Warm (-14 to -10)</span>
          <span className="legend-item hot">Hot (&gt;-10)</span>
        </div>
      </div>

      <div
        className="loudness-canvas-container"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        <canvas
          ref={canvasRef}
          width={containerWidth}
          height={height}
          className="loudness-canvas"
        />

        {/* Hover tooltip */}
        {hoveredData && (
          <div
            className="loudness-tooltip"
            style={{
              left: PADDING_LEFT + hoveredSegment * barWidth + barWidth / 2,
              top: 0
            }}
          >
            <div className="tooltip-time">
              {formatTime(hoveredData.startTime)} - {formatTime(hoveredData.endTime)}
            </div>
            <div className={`tooltip-lufs ${hoveredData.status}`}>
              {hoveredData.lufs.toFixed(1)} LUFS
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div className="loudness-stats">
        <div className="stat">
          <span className="stat-label">Integrated</span>
          <span className="stat-value">{loudnessData.integratedLUFS?.toFixed(1) || '-'} LUFS</span>
        </div>
        <div className="stat">
          <span className="stat-label">Peak</span>
          <span className="stat-value">{loudnessData.maxLUFS?.toFixed(1) || '-'} LUFS</span>
        </div>
        <div className="stat">
          <span className="stat-label">Range</span>
          <span className="stat-value">{loudnessData.dynamicRange?.toFixed(1) || '-'} dB</span>
        </div>
        <div className="stat">
          <span className="stat-label">Loudest</span>
          <span className="stat-value">{formatTime(loudnessData.loudestMoment || 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default LoudnessTimeline;
