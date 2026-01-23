import React, { useMemo, useCallback, useState, useRef, useEffect } from 'react';
import {
  DRUM_FREQUENCY_BANDS,
  RHYTHM_PATTERNS,
  gridPositionToTimestamp,
  exportDrumMidi,
  downloadMidiFile,
  GM_DRUM_MAP,
  MELODIC_DRUM_MAP,
} from '../utils/rhythmUtils';

const DRUM_ORDER = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];

/**
 * RhythmGrid Component - Interactive drum pattern visualization
 *
 * @param {Object} drumHits - Detected + manual hits by drum type
 * @param {number} currentBeat - Current beat position (0 to beatsPerBar-1)
 * @param {number} currentBar - Current bar number
 * @param {number} beatsPerBar - Beats per bar (e.g., 4 for 4/4)
 * @param {number} barsToShow - Number of bars to display (default 4)
 * @param {number} subdivision - Grid subdivision per beat (default 4 for 16ths)
 * @param {number} tempo - Current tempo in BPM
 * @param {number} tempoConfidence - Confidence of tempo detection (0-1)
 * @param {string} detectedPattern - Detected rhythm pattern name
 * @param {number} patternConfidence - Confidence of pattern detection (0-1)
 * @param {boolean} isPlaying - Whether audio is currently playing
 * @param {number} currentTimeMs - Current playback time in ms
 * @param {Function} onCellClick - Callback when a cell is clicked (drumType, bar, beat, subBeat)
 * @param {Function} onClearRow - Callback to clear a row (drumType)
 * @param {Function} onClearAll - Callback to clear all hits
 * @param {Function} onTempoChange - Callback when tempo is changed
 * @param {Function} onTapTempo - Callback for tap tempo
 */
function RhythmGrid({
  drumHits = {},
  currentBeat = 0,
  currentBar = 0,
  beatsPerBar = 4,
  barsToShow = 4,
  subdivision = 4,
  tempo = 120,
  tempoConfidence = 0,
  detectedPattern = 'custom',
  patternConfidence = 0,
  isPlaying = false,
  currentTimeMs = 0,
  onCellClick,
  onClearRow,
  onClearAll,
  onTempoChange,
  onTapTempo,
}) {
  const [editingTempo, setEditingTempo] = useState(false);
  const [tempTempoValue, setTempTempoValue] = useState(tempo.toString());
  const [tapActive, setTapActive] = useState(false);
  const [useMelodicMap, setUseMelodicMap] = useState(false); // Piano roll mode for samplers
  const [autoScroll, setAutoScroll] = useState(true); // Auto-scroll to follow playhead

  const gridContentRef = useRef(null);

  // Handle MIDI export
  const handleExportMidi = useCallback(() => {
    const midiData = exportDrumMidi(drumHits, tempo, beatsPerBar, barsToShow, useMelodicMap);
    const filename = useMelodicMap ? 'drum-pattern-melodic' : 'drum-pattern-gm';
    downloadMidiFile(midiData, filename);
  }, [drumHits, tempo, beatsPerBar, barsToShow, useMelodicMap]);

  // Count total hits for export button state
  const totalHits = useMemo(() => {
    return Object.values(drumHits).reduce((sum, hits) => sum + hits.length, 0);
  }, [drumHits]);

  // Get pattern info
  const patternInfo = RHYTHM_PATTERNS[detectedPattern] || RHYTHM_PATTERNS['custom'];

  // Calculate total cells
  const totalCells = barsToShow * beatsPerBar * subdivision;

  // Calculate which cell is currently active (under playhead)
  const currentCell = useMemo(() => {
    if (!isPlaying) return -1;
    const beatDuration = 60000 / tempo;
    const cellDuration = beatDuration / subdivision;
    const totalCellsPlayed = currentTimeMs / cellDuration;
    return Math.floor(totalCellsPlayed) % totalCells;
  }, [isPlaying, currentTimeMs, tempo, subdivision, totalCells]);

  // Simple scroll - just keep current cell visible
  useEffect(() => {
    if (!autoScroll || !isPlaying || currentCell < 0 || !gridContentRef.current) return;

    const container = gridContentRef.current;
    const cells = container.querySelectorAll('.beat-cell');

    if (cells.length > 0 && cells[currentCell]) {
      const cell = cells[currentCell];
      const cellRect = cell.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();

      // Check if cell is outside visible area
      const cellCenter = cellRect.left + cellRect.width / 2;
      const containerCenter = containerRect.left + containerRect.width / 2;

      // Scroll to center the current cell
      const offset = cellCenter - containerCenter;
      if (Math.abs(offset) > containerRect.width * 0.3) {
        container.scrollLeft += offset * 0.1;
      }
    }
  }, [autoScroll, isPlaying, currentCell]);

  // Reset scroll when playback stops
  useEffect(() => {
    if (!isPlaying && gridContentRef.current) {
      gridContentRef.current.scrollLeft = 0;
    }
  }, [isPlaying]);

  // Check if a cell has a hit
  const hasHitAtCell = useCallback((drumType, bar, beat, subBeat) => {
    const hits = drumHits[drumType] || [];
    const targetTime = gridPositionToTimestamp(bar, beat, subBeat, tempo, beatsPerBar, subdivision);
    const tolerance = (60000 / tempo / subdivision) * 0.4; // 40% of cell duration

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
    // Reset tap visual feedback after animation
    setTimeout(() => setTapActive(false), 150);
  }, [onTapTempo]);

  // Render beat header
  const renderBeatHeader = () => {
    const headers = [];

    for (let bar = 0; bar < barsToShow; bar++) {
      for (let beat = 0; beat < beatsPerBar; beat++) {
        for (let sub = 0; sub < subdivision; sub++) {
          const cellIndex = bar * beatsPerBar * subdivision + beat * subdivision + sub;
          const isBarStart = beat === 0 && sub === 0;
          const isBeatStart = sub === 0;

          let label = '';
          if (isBeatStart) {
            label = (beat + 1).toString();
          } else {
            label = '.';
          }

          headers.push(
            <div
              key={`header-${cellIndex}`}
              className={`beat-header-cell ${isBarStart ? 'bar-start' : ''} ${isBeatStart ? 'beat-start' : ''} ${cellIndex === currentCell ? 'current' : ''}`}
            >
              {label}
            </div>
          );
        }
      }
    }

    return <div className="beat-header">{headers}</div>;
  };

  // Render a drum row
  const renderDrumRow = (drumType) => {
    const bandInfo = DRUM_FREQUENCY_BANDS[drumType];
    const cells = [];

    for (let bar = 0; bar < barsToShow; bar++) {
      for (let beat = 0; beat < beatsPerBar; beat++) {
        for (let sub = 0; sub < subdivision; sub++) {
          const cellIndex = bar * beatsPerBar * subdivision + beat * subdivision + sub;
          const isBarStart = beat === 0 && sub === 0;
          const isBeatStart = sub === 0;
          const hit = hasHitAtCell(drumType, bar, beat, sub);

          cells.push(
            <div
              key={`${drumType}-${cellIndex}`}
              className={`beat-cell ${isBarStart ? 'bar-start' : ''} ${isBeatStart ? 'beat-start' : ''} ${cellIndex === currentCell ? 'current' : ''}`}
              onClick={() => handleCellClick(drumType, bar, beat, sub)}
              title={`Bar ${bar + 1}, Beat ${beat + 1}.${sub + 1}`}
            >
              {hit && (
                <div
                  className={`hit-marker ${hit.isManual ? 'manual' : 'detected'} drum-${drumType}`}
                  style={{ opacity: 0.4 + (hit.velocity || 0.6) * 0.6 }}
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

  // Render playhead
  const renderPlayhead = () => {
    if (!isPlaying || currentCell < 0) return null;

    // Calculate playhead position as percentage
    const cellWidth = 100 / totalCells;
    const playheadPosition = currentCell * cellWidth + cellWidth / 2;

    return (
      <div
        className="rhythm-playhead"
        style={{ left: `calc(60px + ${playheadPosition}% * (100% - 60px) / 100)` }}
      />
    );
  };

  return (
    <div className="rhythm-grid" data-testid="rhythm-grid">
      {/* Header */}
      <div className="rhythm-grid-header">
        <div className="rhythm-grid-title-row">
          <span className="rhythm-grid-title">Rhythm Map</span>
          <label className="auto-scroll-toggle" title="Auto-scroll to follow playhead">
            <div className={`toggle-switch-mini ${autoScroll ? 'on' : 'off'}`} onClick={() => setAutoScroll(!autoScroll)}>
              <div className="toggle-slider-mini"></div>
            </div>
            <span className="toggle-label-mini">Scroll</span>
          </label>
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
        </div>

        <div className="pattern-display">
          <span className="pattern-badge" title={patternInfo.description}>
            {patternInfo.name}
          </span>
        </div>
      </div>

      {/* Grid Content */}
      <div className="rhythm-grid-content" ref={gridContentRef}>
        {/* Beat numbers header */}
        <div className="grid-row header-row">
          <div className="drum-label spacer" />
          {renderBeatHeader()}
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
          {isPlaying && (
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
