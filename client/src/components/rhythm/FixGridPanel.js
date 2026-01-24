import React, { useState, useCallback, useRef } from 'react';
import { ANALYSIS_STATES, GENRE_PRESETS, PATTERN_TEMPLATES } from '../../hooks/useRhythmAnalysis';

const DRUM_ORDER = ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'];

const DRUM_COLORS = {
  kick: '#e94560',
  snare: '#fbbf24',
  hihat: '#10b981',
  clap: '#f472b6',
  tom: '#8b5cf6',
  perc: '#06b6d4',
};

const DRUM_NAMES = {
  kick: 'Kick',
  snare: 'Snare',
  hihat: 'Hi-Hat',
  clap: 'Clap',
  tom: 'Tom',
  perc: 'Perc',
};

/**
 * FixGridPanel Component - Manual correction UI for rhythm detection
 *
 * Enhanced with per-instrument swing and quantization controls:
 * - Individual swing per instrument (e.g., straight kicks, swung hats)
 * - Per-instrument quantize strength (0-100%)
 * - Per-instrument grid subdivision (1/4, 1/8, 1/16, 1/32)
 * - Genre presets (4-on-Floor, Afro House, Trap, Breakbeat)
 * - Align-to-first-kick button
 * - Pattern generation buttons
 */
function FixGridPanel({
  isOpen,
  onClose,
  pendingChanges,
  setPendingChanges,
  onApply,
  onReset,
  onRecalculateBPM,
  onShiftDownbeat,
  onAlignToFirstKick,
  onSnapToPosition,
  onQuantizeInstrument,
  onGeneratePattern,
  onClearInstrument,
  onApplyPreset,
  bpmConfidence = 0,
  timeSignature = 4,
  analysisState = ANALYSIS_STATES.IDLE,
  analysisMethod = null,
  hasKicks = false,
}) {
  const [tapTimes, setTapTimes] = useState([]);
  const [tapActive, setTapActive] = useState(false);
  const [expandedSection, setExpandedSection] = useState('instruments'); // instruments, patterns, presets
  const tapTimeoutRef = useRef(null);

  // Handle BPM input change
  const handleBpmChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 30 && value <= 300) {
      setPendingChanges(prev => ({ ...prev, bpm: value }));
    }
  }, [setPendingChanges]);

  // Handle BPM lock toggle
  const handleBpmLockToggle = useCallback(() => {
    setPendingChanges(prev => ({ ...prev, bpmLocked: !prev.bpmLocked }));
  }, [setPendingChanges]);

  // Double the BPM (for half-time detection fix)
  const handleDoubleBpm = useCallback(() => {
    setPendingChanges(prev => ({
      ...prev,
      bpm: Math.min(300, (prev.bpm || 120) * 2),
      bpmLocked: true, // Lock after manual adjustment
    }));
  }, [setPendingChanges]);

  // Halve the BPM (for double-time detection fix)
  const handleHalveBpm = useCallback(() => {
    setPendingChanges(prev => ({
      ...prev,
      bpm: Math.max(30, (prev.bpm || 120) / 2),
      bpmLocked: true, // Lock after manual adjustment
    }));
  }, [setPendingChanges]);

  // Handle global swing slider change
  const handleSwingChange = useCallback((e) => {
    const value = parseFloat(e.target.value);
    setPendingChanges(prev => ({ ...prev, swing: value }));
  }, [setPendingChanges]);

  // Handle per-instrument setting change
  const handleInstrumentSettingChange = useCallback((drumType, field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      swingSettings: {
        ...prev.swingSettings,
        [drumType]: {
          ...prev.swingSettings?.[drumType],
          [field]: value,
        },
      },
    }));
  }, [setPendingChanges]);

  // Handle tap tempo
  const handleTapTempo = useCallback(() => {
    const now = performance.now();

    // Clear old taps if more than 2 seconds since last tap
    const recentTaps = tapTimes.filter(t => now - t < 2000);
    const newTaps = [...recentTaps, now];
    setTapTimes(newTaps);

    // Calculate BPM from tap intervals
    if (newTaps.length >= 2) {
      const intervals = [];
      for (let i = 1; i < newTaps.length; i++) {
        intervals.push(newTaps[i] - newTaps[i - 1]);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      const tapBpm = 60000 / avgInterval;

      if (tapBpm >= 30 && tapBpm <= 300) {
        setPendingChanges(prev => ({
          ...prev,
          bpm: Math.round(tapBpm * 10) / 10,
          bpmLocked: true,
        }));
      }
    }

    // Visual feedback
    setTapActive(true);
    clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => {
      setTapActive(false);
    }, 150);
  }, [tapTimes, setPendingChanges]);

  // Clear tap history
  const clearTapHistory = useCallback(() => {
    setTapTimes([]);
  }, []);

  // Handle downbeat shift
  const handleShiftDownbeat = useCallback((direction) => {
    if (onShiftDownbeat) {
      onShiftDownbeat(direction);
    }
  }, [onShiftDownbeat]);

  // Detect swing from audio
  const handleDetectSwing = useCallback(() => {
    setPendingChanges(prev => ({ ...prev, swing: 50 }));
  }, [setPendingChanges]);

  // Handle preset swing values
  const handleSwingPreset = useCallback((value) => {
    setPendingChanges(prev => ({ ...prev, swing: value }));
  }, [setPendingChanges]);

  // Handle genre preset
  const handleGenrePreset = useCallback((presetKey) => {
    const preset = GENRE_PRESETS[presetKey];
    if (preset && onApplyPreset) {
      onApplyPreset(presetKey);
      setPendingChanges(prev => ({
        ...prev,
        swingSettings: { ...preset.settings },
      }));
    }
  }, [onApplyPreset, setPendingChanges]);

  if (!isOpen || !pendingChanges) return null;

  const isAnalyzing = analysisState === ANALYSIS_STATES.ANALYZING_BEATS ||
                      analysisState === ANALYSIS_STATES.DETECTING_ONSETS ||
                      analysisState === ANALYSIS_STATES.CLASSIFYING_HITS;

  const currentDownbeatPosition = pendingChanges.downbeats?.[0]?.beat_position || 1;
  const swingSettings = pendingChanges.swingSettings || {};

  return (
    <div className="fix-grid-overlay" onClick={onClose}>
      <div className="fix-grid-panel fix-grid-panel-expanded" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="fix-grid-header">
          <h3>Fix Grid</h3>
          <button className="close-btn" onClick={onClose} title="Close">
            &times;
          </button>
        </div>

        {/* Analysis Method Badge */}
        {analysisMethod && (
          <div className="analysis-method-badge">
            Analyzed with: <span className="method-name">{analysisMethod}</span>
          </div>
        )}

        {/* BPM Section */}
        <div className="fix-grid-section">
          <div className="section-header">
            <span className="section-title">BPM</span>
            <button
              className={`lock-btn ${pendingChanges.bpmLocked ? 'locked' : ''}`}
              onClick={handleBpmLockToggle}
              title={pendingChanges.bpmLocked ? 'Unlock BPM' : 'Lock BPM'}
            >
              {pendingChanges.bpmLocked ? '🔒' : '🔓'}
            </button>
          </div>

          <div className="bpm-controls">
            <input
              type="number"
              className="bpm-input"
              value={pendingChanges.bpm?.toFixed(1) || '120.0'}
              onChange={handleBpmChange}
              min="30"
              max="300"
              step="0.1"
            />

            <button
              className="bpm-multiply-btn"
              onClick={handleHalveBpm}
              title="Halve BPM (86 → 43)"
            >
              ÷2
            </button>

            <button
              className="bpm-multiply-btn double"
              onClick={handleDoubleBpm}
              title="Double BPM (86 → 172)"
            >
              ×2
            </button>

            <button
              className="recalculate-btn"
              onClick={onRecalculateBPM}
              disabled={isAnalyzing}
              title="Recalculate BPM from audio"
            >
              {isAnalyzing ? '...' : '↻'}
            </button>

            <button
              className={`tap-btn ${tapActive ? 'active' : ''}`}
              onClick={handleTapTempo}
              onDoubleClick={clearTapHistory}
              title="Tap to set tempo (double-click to reset)"
            >
              Tap
            </button>
          </div>

          {/* BPM Confidence Bar */}
          <div className="confidence-row">
            <span className="confidence-label">Confidence:</span>
            <div className="confidence-bar-container">
              <div
                className="confidence-bar-fill"
                style={{ width: `${bpmConfidence * 100}%` }}
              />
            </div>
            <span className="confidence-value">{Math.round(bpmConfidence * 100)}%</span>
          </div>

          {tapTimes.length > 0 && (
            <div className="tap-count">
              {tapTimes.length} tap{tapTimes.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* Downbeat Section */}
        <div className="fix-grid-section">
          <div className="section-header">
            <span className="section-title">Downbeat Alignment</span>
            <span className="section-info">
              Beat {currentDownbeatPosition} of {timeSignature}
            </span>
          </div>

          <div className="downbeat-controls">
            <button
              className="shift-btn"
              onClick={() => handleShiftDownbeat(-1)}
              title="Shift downbeat back 1 beat"
            >
              ◀ -1 Beat
            </button>

            <button
              className="shift-btn"
              onClick={() => handleShiftDownbeat(1)}
              title="Shift downbeat forward 1 beat"
            >
              +1 Beat ▶
            </button>

            <button
              className="align-kick-btn"
              onClick={onAlignToFirstKick}
              disabled={!hasKicks}
              title={hasKicks ? 'Move downbeat to align with first kick' : 'No kicks detected'}
            >
              Align to First Kick
            </button>
          </div>

          {/* Quick Alignment Presets */}
          <div className="alignment-presets">
            <span className="preset-label">Snap to:</span>
            <button
              className={`align-preset-btn ${currentDownbeatPosition === 1 ? 'active' : ''}`}
              onClick={() => onSnapToPosition && onSnapToPosition('on-bar')}
              title="Snap to Bar 1 Beat 1 (on the bar)"
            >
              On Bar
            </button>
            <button
              className="align-preset-btn"
              onClick={() => onSnapToPosition && onSnapToPosition('offbeat')}
              title="Shift by half a beat (offbeat feel)"
            >
              Offbeat
            </button>
            <button
              className="align-preset-btn"
              onClick={() => onSnapToPosition && onSnapToPosition('beat-2')}
              title="Align to beat 2"
            >
              Beat 2
            </button>
            <button
              className="align-preset-btn"
              onClick={() => onSnapToPosition && onSnapToPosition('beat-3')}
              title="Align to beat 3"
            >
              Beat 3
            </button>
          </div>
        </div>

        {/* Global Swing Section (kept for backward compatibility) */}
        <div className="fix-grid-section">
          <div className="section-header">
            <span className="section-title">Global Swing</span>
            <span className="section-info">{pendingChanges.swing?.toFixed(0) || 50}%</span>
          </div>

          <div className="swing-controls">
            <input
              type="range"
              className="swing-slider"
              value={pendingChanges.swing || 50}
              onChange={handleSwingChange}
              min="40"
              max="75"
              step="1"
            />

            <div className="swing-presets">
              <button
                className={`preset-btn ${pendingChanges.swing === 50 ? 'active' : ''}`}
                onClick={() => handleSwingPreset(50)}
                title="Straight (no swing)"
              >
                Straight
              </button>
              <button
                className={`preset-btn ${pendingChanges.swing === 58 ? 'active' : ''}`}
                onClick={() => handleSwingPreset(58)}
                title="Light shuffle feel"
              >
                Light
              </button>
              <button
                className={`preset-btn ${pendingChanges.swing === 67 ? 'active' : ''}`}
                onClick={() => handleSwingPreset(67)}
                title="Triplet swing feel"
              >
                Triplet
              </button>
              <button
                className="detect-btn"
                onClick={handleDetectSwing}
                title="Detect swing from audio"
              >
                ↻
              </button>
            </div>
          </div>

          <div className="swing-description">
            {pendingChanges.swing <= 52 && 'Straight 8ths'}
            {pendingChanges.swing > 52 && pendingChanges.swing <= 60 && 'Light shuffle'}
            {pendingChanges.swing > 60 && pendingChanges.swing <= 70 && 'Triplet feel'}
            {pendingChanges.swing > 70 && 'Heavy swing'}
          </div>
        </div>

        {/* Per-Instrument Settings Section */}
        <div className="fix-grid-section instrument-section">
          <div
            className="section-header clickable"
            onClick={() => setExpandedSection(expandedSection === 'instruments' ? null : 'instruments')}
          >
            <span className="section-title">Per-Instrument Settings</span>
            <span className="expand-icon">{expandedSection === 'instruments' ? '▼' : '▶'}</span>
          </div>

          {expandedSection === 'instruments' && (
            <div className="instrument-settings-table">
              <div className="instrument-settings-header">
                <span className="col-name">Instrument</span>
                <span className="col-swing">Swing</span>
                <span className="col-quantize">Quantize</span>
                <span className="col-grid">Grid</span>
                <span className="col-action"></span>
              </div>
              {DRUM_ORDER.map(drumType => {
                const settings = swingSettings[drumType] || { swing: 50, quantizeStrength: 1.0, subdivision: 4 };
                return (
                  <div key={drumType} className="instrument-settings-row">
                    <div className="col-name">
                      <span className="drum-dot" style={{ background: DRUM_COLORS[drumType] }} />
                      <span>{DRUM_NAMES[drumType]}</span>
                    </div>
                    <div className="col-swing">
                      <input
                        type="range"
                        min="40"
                        max="75"
                        value={settings.swing}
                        onChange={(e) => handleInstrumentSettingChange(drumType, 'swing', parseInt(e.target.value))}
                        className="mini-slider"
                      />
                      <span className="value-label">{settings.swing}%</span>
                    </div>
                    <div className="col-quantize">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={settings.quantizeStrength * 100}
                        onChange={(e) => handleInstrumentSettingChange(drumType, 'quantizeStrength', parseInt(e.target.value) / 100)}
                        className="mini-slider"
                      />
                      <span className="value-label">{Math.round(settings.quantizeStrength * 100)}%</span>
                    </div>
                    <div className="col-grid">
                      <select
                        value={settings.subdivision}
                        onChange={(e) => handleInstrumentSettingChange(drumType, 'subdivision', parseInt(e.target.value))}
                        className="grid-select"
                      >
                        <option value={4}>1/4</option>
                        <option value={8}>1/8</option>
                        <option value={16}>1/16</option>
                        <option value={32}>1/32</option>
                      </select>
                    </div>
                    <div className="col-action">
                      <button
                        className="quantize-btn"
                        onClick={() => onQuantizeInstrument && onQuantizeInstrument(drumType)}
                        title={`Quantize ${DRUM_NAMES[drumType]} with these settings`}
                      >
                        Q
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Genre Presets Section */}
        <div className="fix-grid-section">
          <div
            className="section-header clickable"
            onClick={() => setExpandedSection(expandedSection === 'presets' ? null : 'presets')}
          >
            <span className="section-title">Genre Presets</span>
            <span className="expand-icon">{expandedSection === 'presets' ? '▼' : '▶'}</span>
          </div>

          {expandedSection === 'presets' && (
            <div className="genre-presets">
              {Object.entries(GENRE_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className="genre-preset-btn"
                  onClick={() => handleGenrePreset(key)}
                  title={preset.description}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pattern Generation Section */}
        <div className="fix-grid-section">
          <div
            className="section-header clickable"
            onClick={() => setExpandedSection(expandedSection === 'patterns' ? null : 'patterns')}
          >
            <span className="section-title">Generate Patterns</span>
            <span className="expand-icon">{expandedSection === 'patterns' ? '▼' : '▶'}</span>
          </div>

          {expandedSection === 'patterns' && (
            <div className="pattern-generators">
              <div className="pattern-row">
                <span className="pattern-label">
                  <span className="drum-dot" style={{ background: DRUM_COLORS.kick }} />
                  Kick:
                </span>
                <button onClick={() => onGeneratePattern && onGeneratePattern('kick', '4-on-floor')}>4-on-Floor</button>
                <button onClick={() => onGeneratePattern && onGeneratePattern('kick', 'offbeat')}>Offbeat</button>
                <button className="clear-btn" onClick={() => onClearInstrument && onClearInstrument('kick')}>Clear</button>
              </div>
              <div className="pattern-row">
                <span className="pattern-label">
                  <span className="drum-dot" style={{ background: DRUM_COLORS.snare }} />
                  Snare:
                </span>
                <button onClick={() => onGeneratePattern && onGeneratePattern('snare', '2-and-4')}>2 & 4</button>
                <button onClick={() => onGeneratePattern && onGeneratePattern('snare', 'backbeat')}>Backbeat</button>
                <button className="clear-btn" onClick={() => onClearInstrument && onClearInstrument('snare')}>Clear</button>
              </div>
              <div className="pattern-row">
                <span className="pattern-label">
                  <span className="drum-dot" style={{ background: DRUM_COLORS.hihat }} />
                  Hi-Hat:
                </span>
                <button onClick={() => onGeneratePattern && onGeneratePattern('hihat', '8ths')}>1/8 Notes</button>
                <button onClick={() => onGeneratePattern && onGeneratePattern('hihat', '16ths')}>1/16 Notes</button>
                <button className="clear-btn" onClick={() => onClearInstrument && onClearInstrument('hihat')}>Clear</button>
              </div>
              <div className="pattern-row">
                <span className="pattern-label">
                  <span className="drum-dot" style={{ background: DRUM_COLORS.clap }} />
                  Clap:
                </span>
                <button onClick={() => onGeneratePattern && onGeneratePattern('clap', '2-and-4')}>2 & 4</button>
                <button className="clear-btn" onClick={() => onClearInstrument && onClearInstrument('clap')}>Clear</button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="fix-grid-footer">
          <button
            className="reset-btn"
            onClick={onReset}
            title="Reset to originally detected values"
          >
            Reset to Detected
          </button>

          <div className="apply-actions">
            <button
              className="cancel-btn"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="apply-btn"
              onClick={onApply}
            >
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FixGridPanel;
