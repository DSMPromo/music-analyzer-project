import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import './RhythmGridPro.css';

/**
 * RhythmGridPro - DAW-style drum grid following Logic Pro principles
 *
 * Core Concepts:
 * 1. TIME = (bar * beatsPerBar + beat + subdivision/subdivisionsPerBeat) * secondsPerBeat
 * 2. POSITION = (currentTime - downbeatTime) / secondsPerBeat = total beats from downbeat
 * 3. GRID CELL = Math.floor(position * subdivisionsPerBeat) = which subdivision we're on
 *
 * Grid Layout:
 * - Rows = drum types (kick, snare, hihat, clap, tom, perc)
 * - Columns = subdivisions (16th notes by default = 4 per beat)
 * - Each bar = beatsPerBar * subdivisionsPerBeat cells
 */

const DRUM_TYPES = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];
const DRUM_COLORS = {
  kick: '#e94560',
  snare: '#00d9ff',
  hihat: '#ffd93d',
  clap: '#6bcb77',
  tom: '#9b59b6',
  perc: '#ff8c42',
};
const DRUM_LABELS = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  clap: 'Clap',
  tom: 'Tom',
  perc: 'Perc',
};

/**
 * Convert time in seconds to grid position
 * @param {number} timeSeconds - Time in seconds
 * @param {number} bpm - Beats per minute
 * @param {number} downbeatTime - Time of first downbeat in seconds
 * @param {number} beatsPerBar - Beats per bar (time signature numerator)
 * @param {number} subdivisions - Subdivisions per beat (4 = 16th notes)
 * @returns {{ bar: number, beat: number, sub: number, totalSubs: number }}
 */
function timeToGrid(timeSeconds, bpm, downbeatTime, beatsPerBar = 4, subdivisions = 4) {
  const secondsPerBeat = 60 / bpm;
  const beatsFromDownbeat = (timeSeconds - downbeatTime) / secondsPerBeat;

  // Handle negative time (before downbeat)
  if (beatsFromDownbeat < 0) {
    return { bar: -1, beat: 0, sub: 0, totalSubs: Math.floor(beatsFromDownbeat * subdivisions) };
  }

  const totalSubs = Math.floor(beatsFromDownbeat * subdivisions);
  const subsPerBar = beatsPerBar * subdivisions;

  const bar = Math.floor(totalSubs / subsPerBar);
  const subInBar = totalSubs % subsPerBar;
  const beat = Math.floor(subInBar / subdivisions);
  const sub = subInBar % subdivisions;

  return { bar, beat, sub, totalSubs };
}

/**
 * Convert grid position to time in seconds
 */
function gridToTime(bar, beat, sub, bpm, downbeatTime, beatsPerBar = 4, subdivisions = 4) {
  const secondsPerBeat = 60 / bpm;
  const totalBeats = bar * beatsPerBar + beat + sub / subdivisions;
  return downbeatTime + totalBeats * secondsPerBeat;
}

/**
 * Quantize a hit time to the nearest grid position
 */
function quantizeToGrid(timeSeconds, bpm, downbeatTime, beatsPerBar = 4, subdivisions = 4) {
  const pos = timeToGrid(timeSeconds, bpm, downbeatTime, beatsPerBar, subdivisions);
  return gridToTime(pos.bar, pos.beat, pos.sub, bpm, downbeatTime, beatsPerBar, subdivisions);
}

export default function RhythmGridPro({
  // Audio state
  bpm = 120,
  downbeatTime = 0, // Time of first downbeat in seconds
  audioDuration = 0, // Total audio duration in seconds
  currentTime = 0, // Current playback time in seconds
  isPlaying = false,

  // Grid settings
  beatsPerBar = 4,
  subdivisions = 4, // 4 = 16th notes, 2 = 8th notes
  barsPerPage = 4,

  // Hit data - array of { time: seconds, type: drumType, confidence: 0-1 }
  hits = [],

  // Callbacks
  onHitAdd,
  onHitRemove,
  onSeek,
  onBpmChange,
  onDownbeatChange,
  onAnalyzeWithAI, // Trigger Gemini AI analysis
  onVerifyHits, // Open step-by-step verification panel
  onFindQuietHits, // Find quiet percussion hits
  isFindingQuietHits = false, // Loading state for quiet hit detection
  onDetectPatterns, // AI pattern detection (perc, clap)
  isDetectingPattern = false, // Loading state for pattern detection

  // Analysis info
  analysisSource, // 'drums_stem', 'full_mix', or 'gemini_ai'
  detectedGenre,
  genreConfidence,
  isAnalyzing = false,
  analysisProgress = 0,
  // Pattern filter stats
  patternFilterApplied = false,
  hitsBeforeFilter = 0,
  hitsAfterFilter = 0,
  // AI-guided analysis (Gemini 3 Pro)
  isAiAnalyzing = false,
  aiAnalysis = null,
}) {
  // State
  const [currentPage, setCurrentPage] = useState(0);
  const [debugMode, setDebugMode] = useState(false);
  const [syncOffset, setSyncOffset] = useState(0); // Manual sync offset in seconds
  const gridRef = useRef(null);

  // Apply sync offset to current time
  const adjustedCurrentTime = currentTime + syncOffset;

  // Computed values
  const secondsPerBeat = 60 / bpm;
  const secondsPerBar = secondsPerBeat * beatsPerBar;
  const totalBars = Math.max(1, Math.ceil(audioDuration / secondsPerBar));
  const totalPages = Math.max(1, Math.ceil(totalBars / barsPerPage));
  const cellsPerBar = beatsPerBar * subdivisions;

  // Current playhead position (using adjusted time with sync offset)
  const playheadPosition = useMemo(() => {
    return timeToGrid(adjustedCurrentTime, bpm, downbeatTime, beatsPerBar, subdivisions);
  }, [adjustedCurrentTime, bpm, downbeatTime, beatsPerBar, subdivisions]);

  // Auto-advance page during playback
  useEffect(() => {
    if (isPlaying && playheadPosition.bar >= 0) {
      const playheadPage = Math.floor(playheadPosition.bar / barsPerPage);
      if (playheadPage !== currentPage && playheadPage < totalPages) {
        setCurrentPage(playheadPage);
      }
    }
  }, [isPlaying, playheadPosition.bar, barsPerPage, currentPage, totalPages]);

  // Visible bars for current page
  const visibleBars = useMemo(() => {
    const startBar = currentPage * barsPerPage;
    const endBar = Math.min(startBar + barsPerPage, totalBars);
    return Array.from({ length: endBar - startBar }, (_, i) => startBar + i);
  }, [currentPage, barsPerPage, totalBars]);

  // Organize hits by grid position for fast lookup
  const hitsByPosition = useMemo(() => {
    const map = new Map(); // key: "bar-beat-sub-type", value: hit

    hits.forEach(hit => {
      const pos = timeToGrid(hit.time, bpm, downbeatTime, beatsPerBar, subdivisions);
      if (pos.bar >= 0) {
        const key = `${pos.bar}-${pos.beat}-${pos.sub}-${hit.type}`;
        // Keep highest confidence hit if duplicate
        const existing = map.get(key);
        if (!existing || hit.confidence > existing.confidence) {
          map.set(key, { ...hit, gridPos: pos });
        }
      }
    });

    return map;
  }, [hits, bpm, downbeatTime, beatsPerBar, subdivisions]);

  // Get hit at a specific grid position
  const getHitAt = useCallback((bar, beat, sub, drumType) => {
    const key = `${bar}-${beat}-${sub}-${drumType}`;
    return hitsByPosition.get(key);
  }, [hitsByPosition]);

  // Handle cell click
  const handleCellClick = useCallback((bar, beat, sub, drumType) => {
    const existingHit = getHitAt(bar, beat, sub, drumType);
    const time = gridToTime(bar, beat, sub, bpm, downbeatTime, beatsPerBar, subdivisions);

    if (existingHit) {
      onHitRemove?.(existingHit);
    } else {
      onHitAdd?.({ time, type: drumType, confidence: 1.0, isManual: true });
    }
  }, [getHitAt, bpm, downbeatTime, beatsPerBar, subdivisions, onHitAdd, onHitRemove]);

  // Handle seek by clicking on bar header
  const handleBarClick = useCallback((bar) => {
    const time = gridToTime(bar, 0, 0, bpm, downbeatTime, beatsPerBar, subdivisions);
    onSeek?.(time);
  }, [bpm, downbeatTime, beatsPerBar, subdivisions, onSeek]);

  // Calculate playhead position within visible grid
  const playheadLeft = useMemo(() => {
    const visibleStartBar = currentPage * barsPerPage;
    const visibleEndBar = visibleStartBar + barsPerPage;

    if (playheadPosition.bar < visibleStartBar || playheadPosition.bar >= visibleEndBar) {
      return null; // Playhead not visible
    }

    const barInPage = playheadPosition.bar - visibleStartBar;
    const subInPage = barInPage * cellsPerBar + playheadPosition.beat * subdivisions + playheadPosition.sub;
    const totalCellsVisible = barsPerPage * cellsPerBar;

    // Account for label column width (80px)
    const labelWidth = 80;
    const gridWidth = gridRef.current ? gridRef.current.offsetWidth - labelWidth : 600;
    const cellWidth = gridWidth / totalCellsVisible;

    return labelWidth + subInPage * cellWidth + cellWidth / 2;
  }, [playheadPosition, currentPage, barsPerPage, cellsPerBar, subdivisions]);

  // Count hits per type for stats
  const hitCounts = useMemo(() => {
    const counts = {};
    DRUM_TYPES.forEach(type => {
      counts[type] = hits.filter(h => h.type === type).length;
    });
    return counts;
  }, [hits]);

  return (
    <div className="rhythm-grid-pro" ref={gridRef}>
      {/* Header */}
      <div className="rgp-header">
        <div className="rgp-title">
          <span className="rgp-icon">🥁</span>
          <span>Rhythm Grid</span>
        </div>

        {/* BPM Display */}
        <div className="rgp-bpm">
          <span className="rgp-bpm-value">{bpm.toFixed(1)}</span>
          <span className="rgp-bpm-label">BPM</span>
        </div>

        {/* Analysis Source Badge */}
        {analysisSource && (
          <div className={`rgp-source-badge ${analysisSource === 'drums_stem' ? 'stem' : 'mix'}`}>
            {analysisSource === 'drums_stem' ? '🎯 Drums Stem' : '⚠️ Full Mix'}
          </div>
        )}

        {/* Genre Badge */}
        {detectedGenre && (
          <div className="rgp-genre-badge">
            {detectedGenre.toUpperCase()} ({Math.round(genreConfidence * 100)}%)
          </div>
        )}

        {/* Pattern Filter Stats */}
        {patternFilterApplied && hitsBeforeFilter > 0 && (
          <div className="rgp-filter-badge" title={`Filtered ${hitsBeforeFilter - hitsAfterFilter} false positives`}>
            🎯 {hitsAfterFilter} hits
            <span className="rgp-filter-removed">
              (-{hitsBeforeFilter - hitsAfterFilter})
            </span>
          </div>
        )}

        {/* Analyze with AI Button */}
        {onAnalyzeWithAI && (
          <button
            className={`rgp-ai-btn ${aiAnalysis ? 'active' : ''}`}
            onClick={onAnalyzeWithAI}
            disabled={isAnalyzing || isAiAnalyzing}
            title="Analyze with Gemini 3 Pro AI (spectrogram analysis)"
          >
            {isAiAnalyzing ? (
              <>🔄 AI Analyzing...</>
            ) : aiAnalysis ? (
              <>✨ AI: 16th notes</>
            ) : (
              <>🤖 Gemini AI</>
            )}
          </button>
        )}

        {/* AI Analysis Badge */}
        {aiAnalysis && aiAnalysis.confidence > 0 && (
          <div
            className="rgp-ai-badge"
            title={`AI detected: ${aiAnalysis.kick_pattern}, ${aiAnalysis.hihat_pattern} (${Math.round(aiAnalysis.confidence * 100)}% confidence)`}
          >
            🎯 {Math.round(aiAnalysis.confidence * 100)}%
          </div>
        )}

        {/* Step-by-Step Verification Button */}
        {onVerifyHits && (
          <button
            className="rgp-verify-btn"
            onClick={onVerifyHits}
            disabled={isAnalyzing}
            title="Step-by-step verification with sensitivity controls"
          >
            🔍 Verify
          </button>
        )}

        {/* Find Quiet Hits Button */}
        {onFindQuietHits && (
          <button
            className="rgp-quiet-btn"
            onClick={onFindQuietHits}
            disabled={isAnalyzing || isFindingQuietHits}
            title="Find quiet percussion (starts from bar 21)"
          >
            {isFindingQuietHits ? '🔄 Finding...' : '🔉 Quiet Hits'}
          </button>
        )}

        {/* AI Pattern Detection Button */}
        {onDetectPatterns && (
          <button
            className="rgp-ai-btn"
            onClick={onDetectPatterns}
            disabled={isAnalyzing || isDetectingPattern}
            title="AI identifies patterns from spectrogram, then generates timestamps (perc, clap)"
          >
            {isDetectingPattern ? '🔄 Detecting...' : '🎯 Detect Patterns'}
          </button>
        )}

        {/* Debug Toggle */}
        <button
          className={`rgp-debug-btn ${debugMode ? 'active' : ''}`}
          onClick={() => setDebugMode(!debugMode)}
          title="Toggle debug info"
        >
          🔧
        </button>

        {/* Page Navigation */}
        <div className="rgp-nav">
          <button
            onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
          >
            ◀
          </button>
          <span className="rgp-page-info">
            Page {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Debug Info */}
      {debugMode && (
        <div className="rgp-debug">
          <div><strong>Debug Info:</strong></div>
          <div>BPM: {bpm} | Downbeat: {downbeatTime.toFixed(3)}s | Duration: {audioDuration.toFixed(2)}s</div>
          <div>Current Time: {currentTime.toFixed(3)}s | Adjusted: {adjustedCurrentTime.toFixed(3)}s | Time from downbeat: {(adjustedCurrentTime - downbeatTime).toFixed(3)}s</div>
          <div>Seconds/Beat: {secondsPerBeat.toFixed(3)}s | Beats from downbeat: {((adjustedCurrentTime - downbeatTime) / secondsPerBeat).toFixed(2)}</div>
          <div>Position: Bar {playheadPosition.bar + 1}, Beat {playheadPosition.beat + 1}, Sub {playheadPosition.sub + 1} (totalSubs: {playheadPosition.totalSubs})</div>
          <div>Total Bars: {totalBars} | Visible: {visibleBars[0] + 1} - {visibleBars[visibleBars.length - 1] + 1} | Page: {currentPage + 1}/{totalPages}</div>
          <div>Total Hits: {hits.length} | Kick: {hitCounts.kick} | Snare: {hitCounts.snare} | HiHat: {hitCounts.hihat} | Clap: {hitCounts.clap}</div>

          {/* Sync Offset Control */}
          <div className="rgp-sync-control">
            <label>
              <strong>Sync Offset:</strong> {syncOffset >= 0 ? '+' : ''}{syncOffset.toFixed(2)}s
              {syncOffset !== 0 && (
                <span style={{color: '#10b981', marginLeft: '0.5rem'}}>
                  ({syncOffset > 0 ? 'playhead ahead' : 'playhead behind'} by {Math.abs(syncOffset).toFixed(2)}s)
                </span>
              )}
            </label>
            <div className="rgp-sync-buttons">
              <button onClick={() => setSyncOffset(s => s - 0.5)} title="Move playhead back 0.5s">-0.5s</button>
              <button onClick={() => setSyncOffset(s => s - 0.1)} title="Move playhead back 0.1s">-0.1s</button>
              <button onClick={() => setSyncOffset(0)} title="Reset offset">Reset</button>
              <button onClick={() => setSyncOffset(s => s + 0.1)} title="Move playhead forward 0.1s">+0.1s</button>
              <button onClick={() => setSyncOffset(s => s + 0.5)} title="Move playhead forward 0.5s">+0.5s</button>
            </div>
            <input
              type="range"
              min="-5"
              max="5"
              step="0.05"
              value={syncOffset}
              onChange={(e) => setSyncOffset(parseFloat(e.target.value))}
              style={{width: '100%', marginTop: '0.25rem'}}
            />
          </div>

          <div style={{color: '#f59e0b', marginTop: '0.5rem'}}>
            Playhead late? Use + offset. Playhead early? Use - offset.
          </div>
        </div>
      )}

      {/* Bar Numbers Row */}
      <div className="rgp-bar-numbers">
        <div className="rgp-label-cell"></div>
        {visibleBars.map(barNum => (
          <div
            key={barNum}
            className="rgp-bar-number"
            onClick={() => handleBarClick(barNum)}
            title={`Click to seek to bar ${barNum + 1}`}
          >
            {barNum + 1}
          </div>
        ))}
      </div>

      {/* Grid Body */}
      <div className="rgp-body">
        {/* Playhead */}
        {playheadLeft !== null && (
          <div
            className="rgp-playhead"
            style={{ left: `${playheadLeft}px` }}
          />
        )}

        {/* Drum Rows */}
        {DRUM_TYPES.map(drumType => (
          <div key={drumType} className="rgp-row">
            {/* Label */}
            <div
              className="rgp-label"
              style={{ borderLeftColor: DRUM_COLORS[drumType] }}
            >
              <span className="rgp-label-text">{DRUM_LABELS[drumType]}</span>
              <span className="rgp-hit-count">{hitCounts[drumType]}</span>
            </div>

            {/* Cells for each bar */}
            {visibleBars.map(barNum => (
              <div key={barNum} className="rgp-bar">
                {Array.from({ length: cellsPerBar }).map((_, cellIndex) => {
                  const beat = Math.floor(cellIndex / subdivisions);
                  const sub = cellIndex % subdivisions;
                  const hit = getHitAt(barNum, beat, sub, drumType);
                  const isDownbeat = beat === 0 && sub === 0;
                  const isBeat = sub === 0;

                  return (
                    <div
                      key={cellIndex}
                      className={`rgp-cell ${isDownbeat ? 'downbeat' : ''} ${isBeat ? 'beat' : ''} ${hit ? 'has-hit' : ''}`}
                      onClick={() => handleCellClick(barNum, beat, sub, drumType)}
                      title={`Bar ${barNum + 1}, Beat ${beat + 1}, Sub ${sub + 1}`}
                    >
                      {hit && (
                        <div
                          className="rgp-hit"
                          style={{
                            backgroundColor: DRUM_COLORS[drumType],
                            opacity: 0.4 + hit.confidence * 0.6,
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer - Legend and Stats */}
      <div className="rgp-footer">
        <div className="rgp-legend">
          {DRUM_TYPES.map(type => (
            <div key={type} className="rgp-legend-item">
              <div
                className="rgp-legend-color"
                style={{ backgroundColor: DRUM_COLORS[type] }}
              />
              <span>{DRUM_LABELS[type]}</span>
            </div>
          ))}
        </div>
        <div className="rgp-stats">
          {hits.length} hits detected
        </div>
      </div>
    </div>
  );
}
