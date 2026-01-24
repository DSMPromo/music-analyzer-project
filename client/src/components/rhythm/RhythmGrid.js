import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  DRUM_FREQUENCY_BANDS,
  RHYTHM_PATTERNS,
  gridPositionToTimestamp,
  exportDrumMidi,
  downloadMidiFile,
  GM_DRUM_MAP,
  MELODIC_DRUM_MAP,
} from '../../utils/rhythmUtils';

const DRUM_ORDER = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];

/**
 * Calculate hit alignment relative to the grid
 * Returns 'on-grid', 'near-grid', or 'off-grid'
 */
function getHitAlignment(hitTime, tempo, subdivision = 4) {
  const cellDuration = (60000 / tempo) / subdivision;
  const nearestGrid = Math.round(hitTime / cellDuration) * cellDuration;
  const offset = Math.abs(hitTime - nearestGrid);
  const tolerance = cellDuration * 0.1; // 10% tolerance for "on-grid"
  const nearTolerance = cellDuration * 0.25; // 25% tolerance for "near-grid"

  if (offset < tolerance) return 'on-grid';
  if (offset < nearTolerance) return 'near-grid';
  return 'off-grid';
}

/**
 * RhythmGrid Component - Professional DAW-style drum pattern visualization
 *
 * @param {Object} drumHits - Detected + manual hits by drum type
 * @param {number} currentBeat - Current beat position (0 to beatsPerBar-1)
 * @param {number} currentBar - Current bar number
 * @param {number} beatsPerBar - Beats per bar (e.g., 4 for 4/4)
 * @param {number} barsToShow - Number of bars to display per page (default 8)
 * @param {number} subdivision - Grid subdivision per beat (default 4 for 16ths)
 * @param {number} tempo - Current tempo in BPM
 * @param {number} tempoConfidence - Confidence of tempo detection (0-1)
 * @param {string} detectedPattern - Detected rhythm pattern name
 * @param {number} patternConfidence - Confidence of pattern detection (0-1)
 * @param {boolean} isPlaying - Whether audio is currently playing
 * @param {number} currentTimeMs - Current playback time in ms
 * @param {number} audioDuration - Total audio duration in seconds
 * @param {Function} onCellClick - Callback when a cell is clicked (drumType, bar, beat, subBeat)
 * @param {Function} onClearRow - Callback to clear a row (drumType)
 * @param {Function} onClearAll - Callback to clear all hits
 * @param {Function} onTempoChange - Callback when tempo is changed
 * @param {Function} onTapTempo - Callback for tap tempo
 * @param {string} rhythmAnalysisState - Python analysis state
 * @param {number} rhythmProgress - Python analysis progress (0-100)
 * @param {string} rhythmError - Python analysis error message
 * @param {boolean} isRhythmAnalyzing - Whether Python analysis is running
 * @param {boolean} rhythmServiceAvailable - Whether Python service is available
 * @param {boolean} usePythonRhythm - Whether using Python results
 * @param {string} rhythmAnalysisMethod - Analysis method used (madmom/librosa)
 * @param {number} swing - Detected swing percentage
 * @param {Function} onOpenFixGrid - Callback to open Fix Grid panel
 * @param {string} analysisSource - 'drums_stem' or 'full_mix'
 * @param {string} detectedGenre - Detected genre (edm, afro_house, trap, etc.)
 * @param {number} genreConfidence - Genre detection confidence (0-1)
 */
function RhythmGrid({
  drumHits = {},
  currentBeat = 0,
  currentBar = 0,
  beatsPerBar = 4,
  barsToShow = 8,
  subdivision = 4,
  tempo = 120,
  tempoConfidence = 0,
  detectedPattern = 'custom',
  patternConfidence = 0,
  isPlaying = false,
  currentTimeMs = 0,
  audioDuration = 0,
  onCellClick,
  onClearRow,
  onClearAll,
  onTempoChange,
  onTapTempo,
  // Python rhythm analysis props
  rhythmAnalysisState,
  rhythmProgress = 0,
  rhythmError,
  isRhythmAnalyzing = false,
  rhythmServiceAvailable,
  usePythonRhythm = false,
  rhythmAnalysisMethod,
  swing = 50,
  bpmAutoCorrected = null, // { correction: 'doubled'|'halved', originalBpm }
  onOpenFixGrid,
  // Analysis source and genre props
  analysisSource,
  detectedGenre,
  genreConfidence = 0,
  // Pattern matching props
  patternMatch,
  patternMatchLoading = false,
  onMatchPattern,
}) {
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempTempoValue, setTempTempoValue] = useState(tempo.toString());
  const [tapActive, setTapActive] = useState(false);
  const [useMelodicMap, setUseMelodicMap] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [barsPerPage, setBarsPerPage] = useState(8);
  const [metronomeOn, setMetronomeOn] = useState(false);
  const [lastClickedBeat, setLastClickedBeat] = useState(-1);

  const gridContentRef = useRef(null);
  const minimapRef = useRef(null);
  const audioContextRef = useRef(null);

  // Initialize audio context for metronome
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play metronome click sound
  const playClick = useCallback((isDownbeat = false) => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Higher pitch for downbeat (beat 1), lower for other beats
    osc.frequency.setValueAtTime(isDownbeat ? 1200 : 800, now);
    osc.type = 'sine';

    // Short click envelope
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }, [getAudioContext]);

  // Calculate total bars from audio duration
  const totalBars = useMemo(() => {
    if (!audioDuration || !tempo) return barsPerPage;
    const beatsTotal = (audioDuration / 60) * tempo;
    return Math.max(barsPerPage, Math.ceil(beatsTotal / beatsPerBar));
  }, [audioDuration, tempo, beatsPerBar, barsPerPage]);

  const totalPages = Math.ceil(totalBars / barsPerPage);

  // Calculate visible bars - always page-based for consistent jumping
  // Enforce minimum 2 bars displayed at all times
  const visibleBars = useMemo(() => {
    const effectiveBarsPerPage = Math.max(2, barsPerPage);
    const startBar = currentPage * effectiveBarsPerPage;
    const effectiveEndBar = Math.min(startBar + effectiveBarsPerPage, totalBars);
    // Ensure we always show at least 2 bars
    const count = Math.max(2, effectiveEndBar - startBar);
    const endBar = startBar + count;
    return { startBar, endBar, count };
  }, [currentPage, barsPerPage, totalBars]);

  // Calculate total cells for visible bars
  const totalCellsVisible = visibleBars.count * beatsPerBar * subdivision;

  // Handle MIDI export (exports ALL bars, not just visible)
  const handleExportMidi = useCallback(() => {
    const midiData = exportDrumMidi(drumHits, tempo, beatsPerBar, totalBars, useMelodicMap);
    const filename = useMelodicMap ? 'drum-pattern-melodic' : 'drum-pattern-gm';
    downloadMidiFile(midiData, filename);
  }, [drumHits, tempo, beatsPerBar, totalBars, useMelodicMap]);

  // Count total hits for export button state
  const totalHits = useMemo(() => {
    return Object.values(drumHits).reduce((sum, hits) => sum + hits.length, 0);
  }, [drumHits]);

  // Get pattern info
  const patternInfo = RHYTHM_PATTERNS[detectedPattern] || RHYTHM_PATTERNS['custom'];

  // Calculate which cell is currently active (under playhead) within visible range
  // Calculate even when paused so cell highlight works during seek
  const currentCellGlobal = useMemo(() => {
    if (currentTimeMs <= 0) return -1;
    const beatDuration = 60000 / tempo;
    const cellDuration = beatDuration / subdivision;
    return Math.floor(currentTimeMs / cellDuration);
  }, [currentTimeMs, tempo, subdivision]);

  // Current cell relative to visible page
  const currentCellVisible = useMemo(() => {
    if (currentCellGlobal < 0) return -1;
    const cellsPerBar = beatsPerBar * subdivision;
    const startCellGlobal = visibleBars.startBar * cellsPerBar;
    const endCellGlobal = visibleBars.endBar * cellsPerBar;
    if (currentCellGlobal >= startCellGlobal && currentCellGlobal < endCellGlobal) {
      return currentCellGlobal - startCellGlobal;
    }
    return -1;
  }, [currentCellGlobal, visibleBars, beatsPerBar, subdivision]);

  // Current bar from playback position (always calculate, even when not playing)
  const currentBarFromTime = useMemo(() => {
    const beatsPlayed = (currentTimeMs / 60000) * tempo;
    return Math.floor(beatsPlayed / beatsPerBar);
  }, [currentTimeMs, tempo, beatsPerBar]);

  // Page navigation functions
  const goToPage = useCallback((page) => {
    const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(clampedPage);
  }, [totalPages]);

  const goToBar = useCallback((bar) => {
    const clampedBar = Math.max(0, Math.min(bar, totalBars - 1));
    const page = Math.floor(clampedBar / barsPerPage);
    setCurrentPage(page);
  }, [barsPerPage, totalBars]);

  // Auto-scroll follows playhead - jump when playhead reaches end of visible bars
  useEffect(() => {
    if (!isPlaying || !autoScroll) return;

    const currentBar = currentBarFromTime;

    // Jump when playhead reaches or passes the end of visible area
    if (currentBar >= visibleBars.endBar && currentBar < totalBars) {
      // Calculate new page so current bar is at the start
      const newPage = Math.floor(currentBar / barsPerPage);
      if (newPage !== currentPage) {
        setCurrentPage(newPage);
      }
    }
  }, [currentBarFromTime, visibleBars.endBar, barsPerPage, currentPage, isPlaying, autoScroll, totalBars]);

  // Reset to first page when playback stops or resets
  useEffect(() => {
    if (!isPlaying && currentTimeMs < 100) {
      setCurrentPage(0);
      setLastClickedBeat(-1);
    }
  }, [isPlaying, currentTimeMs]);

  // Metronome - play click on each beat
  useEffect(() => {
    if (!metronomeOn || !isPlaying) return;

    // Calculate current beat number (global beat across entire song)
    const beatDuration = 60000 / tempo;
    const currentBeat = Math.floor(currentTimeMs / beatDuration);

    // Only play click once per beat
    if (currentBeat !== lastClickedBeat && currentBeat >= 0) {
      const beatInBar = currentBeat % beatsPerBar;
      const isDownbeat = beatInBar === 0;
      playClick(isDownbeat);
      setLastClickedBeat(currentBeat);
    }
  }, [metronomeOn, isPlaying, currentTimeMs, tempo, beatsPerBar, lastClickedBeat, playClick]);

  // Handle minimap click
  const handleMinimapClick = useCallback((e) => {
    if (!minimapRef.current) return;
    const rect = minimapRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = clickX / rect.width;
    const targetBar = Math.floor(fraction * totalBars);
    goToBar(targetBar);
  }, [totalBars, goToBar]);

  // Check if a cell has a hit
  const hasHitAtCell = useCallback((drumType, bar, beat, subBeat) => {
    const hits = drumHits[drumType] || [];
    const targetTime = gridPositionToTimestamp(bar, beat, subBeat, tempo, beatsPerBar, subdivision);
    // Use 50% tolerance to catch hits that are slightly off-grid
    const tolerance = (60000 / tempo / subdivision) * 0.5;

    return hits.find(hit => Math.abs(hit.timestamp - targetTime) < tolerance);
  }, [drumHits, tempo, beatsPerBar, subdivision]);

  // Handle cell click
  const handleCellClick = useCallback((drumType, bar, beat, subBeat) => {
    if (onCellClick) {
      onCellClick(drumType, bar, beat, subBeat);
    }
  }, [onCellClick]);

  // Handle row label double-click to clear
  const handleRowDoubleClick = useCallback((drumType) => {
    if (onClearRow) {
      onClearRow(drumType);
    }
  }, [onClearRow]);

  // Handle tempo input
  const handleTempoSubmit = useCallback(() => {
    const newTempo = parseInt(tempTempoValue, 10);
    if (!isNaN(newTempo) && newTempo >= 30 && newTempo <= 300) {
      if (onTempoChange) {
        onTempoChange(newTempo);
      }
    } else {
      setTempTempoValue(tempo.toString());
    }
    setEditingTempo(false);
  }, [tempTempoValue, tempo, onTempoChange]);

  // Handle tap tempo
  const handleTapTempo = useCallback(() => {
    setTapActive(true);
    if (onTapTempo) {
      onTapTempo();
    }
    setTimeout(() => setTapActive(false), 150);
  }, [onTapTempo]);

  // Calculate minimap hit density
  const minimapHits = useMemo(() => {
    const density = [];
    const barsForDensity = Math.min(totalBars, 200); // Limit for performance
    const cellDuration = (60000 / tempo) / subdivision;

    for (let bar = 0; bar < barsForDensity; bar++) {
      const barStartMs = (bar * beatsPerBar * 60000) / tempo;
      const barEndMs = ((bar + 1) * beatsPerBar * 60000) / tempo;

      let hitCount = 0;
      Object.values(drumHits).forEach(hits => {
        hits.forEach(hit => {
          if (hit.timestamp >= barStartMs && hit.timestamp < barEndMs) {
            hitCount++;
          }
        });
      });

      density.push({ bar, hitCount });
    }
    return density;
  }, [drumHits, tempo, beatsPerBar, totalBars, subdivision]);

  // Render minimap
  const renderMinimap = () => {
    if (totalBars <= barsPerPage) return null;

    const viewportLeft = (currentPage * barsPerPage / totalBars) * 100;
    const viewportWidth = (barsPerPage / totalBars) * 100;
    const maxHits = Math.max(...minimapHits.map(d => d.hitCount), 1);

    return (
      <div
        className="rhythm-minimap"
        ref={minimapRef}
        onClick={handleMinimapClick}
        title="Click to navigate"
      >
        {/* Hit density markers */}
        <div className="minimap-hits">
          {minimapHits.map(({ bar, hitCount }) => (
            <div
              key={bar}
              className="minimap-hit"
              style={{
                left: `${(bar / totalBars) * 100}%`,
                opacity: 0.2 + (hitCount / maxHits) * 0.6,
              }}
            />
          ))}
        </div>

        {/* Current viewport indicator */}
        <div
          className="minimap-viewport"
          style={{ left: `${viewportLeft}%`, width: `${viewportWidth}%` }}
        />

        {/* Playhead on minimap */}
        {isPlaying && (
          <div
            className="minimap-playhead"
            style={{ left: `${(currentBarFromTime / totalBars) * 100}%` }}
          />
        )}
      </div>
    );
  };

  // Render timeline (bar and beat numbers)
  // Note: We don't render individual beat numbers anymore to avoid layout issues
  // The bar headers and grid cells provide enough visual reference

  // Render a drum row
  const renderDrumRow = (drumType) => {
    const bandInfo = DRUM_FREQUENCY_BANDS[drumType];
    const cells = [];

    for (let barOffset = 0; barOffset < visibleBars.count; barOffset++) {
      const bar = visibleBars.startBar + barOffset;
      for (let beat = 0; beat < beatsPerBar; beat++) {
        for (let sub = 0; sub < subdivision; sub++) {
          const cellIndex = barOffset * beatsPerBar * subdivision + beat * subdivision + sub;
          const isBarStart = beat === 0 && sub === 0;
          const isBeatStart = sub === 0;
          const hit = hasHitAtCell(drumType, bar, beat, sub);

          let hitOpacity = 0.4 + (hit?.velocity || 0.6) * 0.6;
          if (hit?.isPythonAnalysis && hit.confidence !== undefined) {
            hitOpacity = 0.3 + hit.confidence * 0.7;
          }

          const hitAlignment = hit ? getHitAlignment(hit.timestamp, tempo, subdivision) : null;

          cells.push(
            <div
              key={`${drumType}-${cellIndex}`}
              className={`beat-cell ${isBarStart ? 'bar-start' : ''} ${isBeatStart ? 'beat-start' : ''} ${cellIndex === currentCellVisible ? 'current' : ''}`}
              onClick={() => handleCellClick(drumType, bar, beat, sub)}
              title={hit?.isPythonAnalysis
                ? `Bar ${bar + 1}, Beat ${beat + 1}.${sub + 1} (Confidence: ${Math.round((hit.confidence || 0) * 100)}%, ${hitAlignment})`
                : `Bar ${bar + 1}, Beat ${beat + 1}.${sub + 1}`
              }
            >
              {hit && (
                <div
                  className={`hit-marker ${hit.isManual ? 'manual' : 'detected'} ${hit.isPythonAnalysis ? 'python-hit' : ''} ${hit.isQuantized ? 'quantized' : ''} ${hitAlignment} drum-${drumType}`}
                  style={{ opacity: hitOpacity }}
                />
              )}
            </div>
          );
        }
      }
    }

    return (
      <div key={drumType} className="drum-row">
        <div
          className="drum-label"
          onDoubleClick={() => handleRowDoubleClick(drumType)}
          title="Double-click to clear row"
        >
          <span className="drum-dot" style={{ backgroundColor: bandInfo.color }} />
          <span className="drum-name">{bandInfo.name}</span>
        </div>
        <div className="beat-cells">{cells}</div>
      </div>
    );
  };

  // Render playhead - shows current position as a vertical line
  // Show playhead when playing OR when there's a valid position (for seeking)
  const renderPlayhead = () => {
    if (currentTimeMs <= 0) return null;

    // Calculate position based on current time relative to visible bars
    const beatDuration = 60000 / tempo;
    const barDuration = beatDuration * beatsPerBar;
    const visibleStartTime = visibleBars.startBar * barDuration;
    const visibleEndTime = visibleBars.endBar * barDuration;
    const visibleDuration = visibleEndTime - visibleStartTime;

    // Check if playhead is within visible range
    if (currentTimeMs < visibleStartTime || currentTimeMs >= visibleEndTime) {
      return null;
    }

    // Calculate percentage position within visible area (0-100%)
    const positionPercent = ((currentTimeMs - visibleStartTime) / visibleDuration) * 100;

    // The grid content starts after 70px label column
    // Use calc to position: 70px + (percent of remaining width)
    return (
      <div
        className="rhythm-playhead"
        style={{
          left: `calc(70px + (100% - 70px) * ${positionPercent / 100})`,
        }}
      />
    );
  };

  return (
    <div className="rhythm-grid rhythm-grid-pro" data-testid="rhythm-grid">
      {/* Header */}
      <div className="rhythm-grid-header">
        <div className="rhythm-grid-title-row">
          <span className="rhythm-grid-title">Rhythm Map</span>

          {/* Python Analysis Status */}
          {isRhythmAnalyzing && (
            <div className="rhythm-analysis-status analyzing">
              <span className="status-spinner"></span>
              <span className="status-text">Analyzing... {rhythmProgress}%</span>
            </div>
          )}
          {usePythonRhythm && !isRhythmAnalyzing && (
            <div className="rhythm-analysis-status complete" title={`Analyzed with ${rhythmAnalysisMethod}`}>
              <span className="status-badge python">Python</span>
              <span className="status-method">{rhythmAnalysisMethod}</span>
            </div>
          )}

          {/* Analysis Source Badge */}
          {usePythonRhythm && !isRhythmAnalyzing && analysisSource && (
            <div
              className={`analysis-source-badge ${analysisSource === 'drums_stem' ? 'drums-stem' : 'full-mix'}`}
              title={analysisSource === 'drums_stem'
                ? 'Analysis performed on isolated drums stem for maximum accuracy'
                : 'Analysis performed on full mix (less accurate - stem separation may have failed)'}
            >
              {analysisSource === 'drums_stem' ? (
                <>
                  <span className="source-icon">🎯</span>
                  <span className="source-text">Drums Stem</span>
                </>
              ) : (
                <>
                  <span className="source-icon">⚠️</span>
                  <span className="source-text">Full Mix</span>
                </>
              )}
            </div>
          )}

          {/* Detected Genre Badge */}
          {usePythonRhythm && !isRhythmAnalyzing && detectedGenre && (
            <div
              className={`genre-badge ${genreConfidence >= 0.7 ? 'high-confidence' : genreConfidence >= 0.5 ? 'medium-confidence' : 'low-confidence'}`}
              title={`Detected genre: ${detectedGenre} (${Math.round(genreConfidence * 100)}% confidence)`}
            >
              <span className="genre-label">Genre:</span>
              <span className="genre-name">{detectedGenre.replace('_', ' ').toUpperCase()}</span>
              <span className="genre-confidence">({Math.round(genreConfidence * 100)}%)</span>
            </div>
          )}
          {rhythmError && (
            <div className="rhythm-analysis-status error" title={rhythmError}>
              <span className="status-badge error">Error</span>
            </div>
          )}

          {/* Fix Grid Button */}
          {usePythonRhythm && onOpenFixGrid && (
            <button
              className="fix-grid-btn"
              onClick={onOpenFixGrid}
              title="Adjust BPM, downbeat, and swing"
            >
              Fix Grid
            </button>
          )}
        </div>

        <div className="tempo-display">
          {editingTempo ? (
            <input
              type="number"
              className="tempo-input"
              value={tempTempoValue}
              onChange={(e) => setTempTempoValue(e.target.value)}
              onBlur={handleTempoSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleTempoSubmit();
                if (e.key === 'Escape') {
                  setTempTempoValue(tempo.toString());
                  setEditingTempo(false);
                }
              }}
              min="30"
              max="300"
              autoFocus
            />
          ) : (
            <span
              className="tempo-value"
              onClick={() => {
                setTempTempoValue(tempo.toString());
                setEditingTempo(true);
              }}
              title="Click to edit tempo"
            >
              {Math.round(tempo)} BPM
            </span>
          )}

          <button
            className={`tap-tempo-btn ${tapActive ? 'active' : ''}`}
            onClick={handleTapTempo}
            title="Tap to set tempo"
          >
            Tap
          </button>

          {tempoConfidence > 0 && (
            <div className="tempo-confidence" title={`Confidence: ${Math.round(tempoConfidence * 100)}%`}>
              <div className="confidence-bar" style={{ width: `${tempoConfidence * 100}%` }} />
            </div>
          )}

          {/* Auto-correction indicator */}
          {bpmAutoCorrected && (
            <div
              className={`bpm-autocorrect-badge ${bpmAutoCorrected.correction}`}
              title={`Auto-corrected from ${Math.round(bpmAutoCorrected.originalBpm)} BPM (${bpmAutoCorrected.correction})`}
            >
              {bpmAutoCorrected.correction === 'doubled' ? '×2' : '÷2'}
            </div>
          )}

          {usePythonRhythm && swing !== 50 && (
            <div className="swing-indicator" title={`Swing: ${swing}%`}>
              <span className="swing-label">Swing:</span>
              <span className="swing-value">{swing.toFixed(1)}%</span>
            </div>
          )}

          {/* Pattern Match from Knowledge Lab */}
          {patternMatch && patternMatch.best_match && (
            <div
              className="pattern-match-indicator"
              title={`${patternMatch.best_match.description}\nGenre: ${patternMatch.best_match.genre}\nScore: ${patternMatch.best_match.score}%`}
            >
              <span className="pattern-label">Pattern:</span>
              <span className={`pattern-name ${patternMatch.best_match.score >= 70 ? 'high-confidence' : patternMatch.best_match.score >= 40 ? 'medium-confidence' : 'low-confidence'}`}>
                {patternMatch.best_match.pattern_name}
              </span>
              <span className="pattern-score">({patternMatch.best_match.score}%)</span>
            </div>
          )}

          {onMatchPattern && (
            <button
              className="match-pattern-btn"
              onClick={onMatchPattern}
              disabled={patternMatchLoading}
              title="Match pattern from Knowledge Lab"
            >
              {patternMatchLoading ? '...' : '🎵'}
            </button>
          )}
        </div>

        {/* Page Navigation */}
        {totalBars > barsPerPage && (
          <div className="page-navigation">
            <button
              className="page-btn"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 0}
              title="Previous page"
            >
              ◀
            </button>
            <span className="page-info">
              Page {currentPage + 1} of {totalPages}
            </span>
            <button
              className="page-btn"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages - 1}
              title="Next page"
            >
              ▶
            </button>
            <select
              className="bars-per-page-select"
              value={barsPerPage}
              onChange={(e) => {
                const newValue = parseInt(e.target.value, 10);
                setBarsPerPage(Math.max(2, newValue)); // Enforce minimum 2 bars
              }}
              title="Bars per page (minimum 2)"
            >
              <option value={2}>2 bars</option>
              <option value={4}>4 bars</option>
              <option value={8}>8 bars</option>
              <option value={16}>16 bars</option>
            </select>
            <span className="bar-count-info">
              ({totalBars} bars total)
            </span>
          </div>
        )}

        <div className="rhythm-header-right">
          <label className="auto-scroll-toggle" title="Auto-scroll to follow playhead">
            <div className={`toggle-switch-mini ${autoScroll ? 'on' : 'off'}`} onClick={() => setAutoScroll(!autoScroll)}>
              <div className="toggle-slider-mini"></div>
            </div>
            <span className="toggle-label-mini">Scroll</span>
          </label>

          <label className="metronome-toggle" title="Click on each beat to verify grid timing">
            <div className={`toggle-switch-mini ${metronomeOn ? 'on' : 'off'}`} onClick={() => setMetronomeOn(!metronomeOn)}>
              <div className="toggle-slider-mini"></div>
            </div>
            <span className="toggle-label-mini">Metro</span>
          </label>

          <span className="pattern-badge" title={patternInfo.description}>
            {patternInfo.name}
          </span>
        </div>
      </div>

      {/* Minimap */}
      {renderMinimap()}

      {/* Grid Content - contains bar headers and drum rows */}
      <div className="rhythm-grid-content" ref={gridContentRef}>
        {/* Bar Headers - row of bar numbers aligned with grid */}
        <div className="drum-row bar-header-row">
          <div className="drum-label" style={{ background: 'transparent' }}>
            <span className="drum-name" style={{ color: '#888', fontSize: '0.7rem' }}>Bar</span>
          </div>
          <div className="beat-cells bar-numbers">
            {Array.from({ length: visibleBars.count }, (_, barOffset) => {
              const barNum = visibleBars.startBar + barOffset + 1;
              // Show current bar highlight when playing OR when there's a valid position
              const isCurrent = currentBarFromTime === visibleBars.startBar + barOffset && currentTimeMs > 0;
              const cellsPerBar = beatsPerBar * subdivision;

              return Array.from({ length: cellsPerBar }, (_, cellIdx) => {
                const isFirstCell = cellIdx === 0;
                return (
                  <div
                    key={`bar-${barOffset}-cell-${cellIdx}`}
                    className={`beat-cell ${cellIdx === 0 ? 'bar-start' : ''} ${cellIdx % subdivision === 0 ? 'beat-start' : ''}`}
                    style={{
                      background: isFirstCell && isCurrent ? 'rgba(233, 69, 96, 0.3)' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isFirstCell && (
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: isCurrent ? '#e94560' : '#fff',
                      }}>
                        {barNum}
                      </span>
                    )}
                  </div>
                );
              });
            }).flat()}
          </div>
        </div>

        {/* Drum rows */}
        {DRUM_ORDER.map(drumType => renderDrumRow(drumType))}

        {/* Playhead overlay */}
        {renderPlayhead()}
      </div>

      {/* Footer */}
      <div className="rhythm-grid-footer">
        <div className="grid-legend">
          <span className="legend-item">
            <span className="legend-marker detected" /> Detected
          </span>
          <span className="legend-item">
            <span className="legend-marker manual" /> Manual
          </span>
          <span className="legend-item" title="Hits perfectly aligned to grid">
            <span className="legend-marker on-grid" /> On Grid
          </span>
          <span className="legend-item" title="Hits slightly off grid">
            <span className="legend-marker near-grid" /> Near
          </span>
          <span className="legend-item" title="Hits significantly off grid">
            <span className="legend-marker off-grid" /> Off
          </span>
          {currentTimeMs > 0 && (
            <span className="legend-item">
              <span className="legend-playhead" /> Playhead
            </span>
          )}
        </div>

        <div className="rhythm-grid-actions">
          {/* Piano Roll / GM Drum Toggle */}
          <label className="midi-mode-toggle" title="Piano Roll mode: Maps drums to chromatic notes (C2-A2) for sampler instruments. GM Drums: Uses standard General MIDI drum mapping (Ch10) for drum machines.">
            <input
              type="checkbox"
              checked={useMelodicMap}
              onChange={(e) => setUseMelodicMap(e.target.checked)}
            />
            <span className="toggle-label">Piano Roll</span>
          </label>

          {/* Export MIDI Button */}
          <button
            className="export-midi-btn"
            onClick={handleExportMidi}
            disabled={totalHits === 0}
            title={totalHits === 0 ? 'No hits to export' : `Export ${totalHits} hits as MIDI (${useMelodicMap ? 'Melodic/Sampler' : 'GM Drums'})`}
          >
            Export MIDI
          </button>

          <button
            className="clear-all-btn"
            onClick={onClearAll}
            title="Clear all hits"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* MIDI Mapping Info (shown when Piano Roll is enabled) */}
      {useMelodicMap && (
        <div className="midi-mapping-info">
          <span className="mapping-title">Piano Roll Mapping:</span>
          {DRUM_ORDER.map(drumType => (
            <span key={drumType} className="mapping-item">
              <span className="drum-dot-small" style={{ backgroundColor: DRUM_FREQUENCY_BANDS[drumType].color }} />
              {DRUM_FREQUENCY_BANDS[drumType].name}: {['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][MELODIC_DRUM_MAP[drumType] % 12]}{Math.floor(MELODIC_DRUM_MAP[drumType] / 12) - 1}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default RhythmGrid;
