import React, { useState, useCallback, useMemo } from 'react';
import { STAGE_STATUS, getSeverityColor, getStatusIcon, confidenceToWidth } from '../../utils/verificationUtils';

// Chord root colors
const CHORD_COLORS = {
  'C': '#FF6B6B',
  'C#': '#FF8E72',
  'D': '#FFA94D',
  'D#': '#FFD43B',
  'E': '#A9E34B',
  'F': '#69DB7C',
  'F#': '#38D9A9',
  'G': '#22B8CF',
  'G#': '#4DABF7',
  'A': '#748FFC',
  'A#': '#9775FA',
  'B': '#DA77F2',
};

/**
 * ChordVerificationStage Component
 * Chord verification panel with timeline preview and confidence indicator
 */
export function ChordVerificationStage({
  status,
  results,
  chordData,
  thresholds,
  onThresholdChange,
  onApprove,
  isExpanded = true,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [localThresholds, setLocalThresholds] = useState({
    minConfidence: thresholds?.minAvgConfidence || 0.3,
    sensitivity: 0.5,
  });

  const handleThresholdChange = useCallback((key, value) => {
    setLocalThresholds(prev => ({ ...prev, [key]: value }));
  }, []);

  // Get unique chords from history
  const uniqueChords = useMemo(() => {
    if (!chordData?.chordHistory) return [];
    const seen = new Set();
    return chordData.chordHistory.filter(chord => {
      if (seen.has(chord.symbol)) return false;
      seen.add(chord.symbol);
      return true;
    });
  }, [chordData?.chordHistory]);

  // Get recent chord progression (last N chords)
  const recentProgression = useMemo(() => {
    if (!chordData?.chordHistory) return [];
    return chordData.chordHistory.slice(-16);
  }, [chordData?.chordHistory]);

  if (status === STAGE_STATUS.BLOCKED) {
    return (
      <div className="verification-stage chord-stage blocked">
        <div className="stage-header">
          <span className="stage-icon">{getStatusIcon(STAGE_STATUS.BLOCKED)}</span>
          <h3>Chord Verification</h3>
          <span className="stage-status blocked">Waiting for rhythm check</span>
        </div>
      </div>
    );
  }

  if (!results || !chordData) {
    return (
      <div className="verification-stage chord-stage pending">
        <div className="stage-header">
          <span className="stage-icon">{getStatusIcon(STAGE_STATUS.PENDING)}</span>
          <h3>Chord Verification</h3>
          <span className="stage-status pending">Waiting for chord analysis...</span>
        </div>
        {isExpanded && (
          <div className="stage-content">
            <p className="help-text">
              Play the audio to detect chords in real-time. Chords will be verified once enough data is collected.
            </p>
          </div>
        )}
      </div>
    );
  }

  const { checks, passed, warnings, metrics } = results;
  const hasWarnings = warnings?.length > 0;

  return (
    <div className={`verification-stage chord-stage ${status}`}>
      <div className="stage-header">
        <span
          className="stage-icon"
          style={{ color: getSeverityColor(passed ? (hasWarnings ? 'warning' : 'success') : 'error') }}
        >
          {getStatusIcon(status)}
        </span>
        <h3>Chord Verification</h3>
        <span className={`stage-status ${status}`}>
          {status === STAGE_STATUS.PASSED && 'Ready for review'}
          {status === STAGE_STATUS.WARNING && 'Review recommended'}
          {status === STAGE_STATUS.FAILED && 'Issues detected'}
          {status === STAGE_STATUS.VERIFIED && 'Verified'}
          {status === STAGE_STATUS.PENDING && 'Pending'}
        </span>
      </div>

      {isExpanded && (
        <div className="stage-content">
          {/* Confidence metrics */}
          <div className="chord-metrics">
            <div className="metric-row">
              <span className="metric-label">Avg Confidence:</span>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${confidenceToWidth(metrics?.avgConfidence || 0)}%`,
                    backgroundColor: getSeverityColor(
                      (metrics?.avgConfidence || 0) >= 0.3 ? 'success' : 'warning'
                    ),
                  }}
                />
              </div>
              <span className="metric-percent">{Math.round((metrics?.avgConfidence || 0) * 100)}%</span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Harmonic Content:</span>
              <span className="metric-value">
                {(metrics?.harmonicContent || 0) >= 0.1 ? 'Sufficient' : 'Low'}
              </span>
              <span
                className="metric-status"
                style={{ color: getSeverityColor((metrics?.harmonicContent || 0) >= 0.1 ? 'success' : 'warning') }}
              >
                {(metrics?.harmonicContent || 0) >= 0.1 ? '\u2713' : '\u26A0'}
              </span>
            </div>

            <div className="metric-row">
              <span className="metric-label">Unique Chords:</span>
              <span className="metric-value">{metrics?.uniqueChords || 0}</span>
              <span className="metric-label">Total Detected:</span>
              <span className="metric-value">{metrics?.totalChords || 0}</span>
            </div>
          </div>

          {/* Chord timeline preview */}
          {recentProgression.length > 0 && (
            <div className="chord-timeline">
              <h4>Recent Progression</h4>
              <div className="chord-sequence">
                {recentProgression.map((chord, idx) => (
                  <div
                    key={idx}
                    className="chord-chip"
                    style={{
                      backgroundColor: CHORD_COLORS[chord.root] || '#666',
                      opacity: 0.5 + (chord.confidence * 0.5),
                    }}
                    title={`${chord.symbol} (${Math.round(chord.confidence * 100)}%)`}
                  >
                    {chord.symbol}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unique chords legend */}
          {uniqueChords.length > 0 && (
            <div className="chord-legend">
              <h4>Detected Chords</h4>
              <div className="chord-list">
                {uniqueChords.map((chord, idx) => (
                  <span
                    key={idx}
                    className="chord-badge"
                    style={{ borderColor: CHORD_COLORS[chord.root] || '#666' }}
                  >
                    {chord.symbol}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Warnings */}
          {hasWarnings && (
            <div className="stage-warnings">
              <ul>
                {warnings.map((warning, idx) => (
                  <li key={idx}>{formatWarning(warning)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Settings */}
          <div className="settings-section">
            <button
              className="settings-toggle"
              onClick={() => setShowSettings(!showSettings)}
            >
              {showSettings ? '\u25BC' : '\u25B6'} Adjust Settings
            </button>

            {showSettings && (
              <div className="settings-panel">
                <div className="setting-row">
                  <label>Min Confidence Threshold:</label>
                  <input
                    type="range"
                    min="0.1"
                    max="0.6"
                    step="0.05"
                    value={localThresholds.minConfidence}
                    onChange={(e) => handleThresholdChange('minConfidence', parseFloat(e.target.value))}
                  />
                  <span className="setting-value">{Math.round(localThresholds.minConfidence * 100)}%</span>
                </div>

                <div className="setting-row">
                  <label>Detection Sensitivity:</label>
                  <input
                    type="range"
                    min="0.1"
                    max="1.0"
                    step="0.1"
                    value={localThresholds.sensitivity}
                    onChange={(e) => handleThresholdChange('sensitivity', parseFloat(e.target.value))}
                  />
                  <span className="setting-value">{localThresholds.sensitivity.toFixed(1)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Stage actions */}
          <div className="stage-actions">
            {status !== STAGE_STATUS.VERIFIED && (
              <button
                className="btn btn-primary"
                onClick={onApprove}
              >
                Approve &rarr;
              </button>
            )}

            {status === STAGE_STATUS.VERIFIED && (
              <span className="verified-badge">
                <span className="verified-icon">\u2713</span> Verified
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatWarning(warning) {
  switch (warning) {
    case 'low_chord_confidence':
      return 'Low chord detection confidence - try playing clearer harmonic sections';
    case 'low_harmonic_content':
      return 'Low harmonic content - this may be a drum track or very percussive audio';
    case 'few_unique_chords':
      return 'Few unique chords detected - progression may be simple or repetitive';
    default:
      return warning.replace(/_/g, ' ');
  }
}

export default ChordVerificationStage;
