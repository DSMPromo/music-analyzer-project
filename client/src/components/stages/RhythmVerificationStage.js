import React, { useState, useCallback, useEffect } from 'react';
import { STAGE_STATUS, getSeverityColor, getStatusIcon, confidenceToWidth } from '../../utils/verificationUtils';
import { GENRE_PRESETS } from '../../hooks/useRhythmAnalysis';

/**
 * RhythmVerificationStage Component
 * BPM/drum verification with adjustable settings
 */
export function RhythmVerificationStage({
  status,
  results,
  rhythmData,
  thresholds,
  onThresholdChange,
  onApprove,
  onReanalyze,
  onReanalyzeWithAI,
  onOpenFixGrid,
  onFindQuietHits,
  isExpanded = true,
  isAnalyzing = false,
  analysisProgress = 0,
  analysisMethod = null,
  isFindingQuietHits = false,
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [localThresholds, setLocalThresholds] = useState({
    energyThreshold: thresholds?.minEnergyThreshold || 0.1,
    hitInterval: thresholds?.minHitInterval || 40,
  });

  // Keep local thresholds in sync with parent thresholds (preserve user values)
  useEffect(() => {
    // Only update if we don't have user-modified values
    if (thresholds && !showSettings) {
      setLocalThresholds(prev => ({
        energyThreshold: prev.energyThreshold !== 0.1 ? prev.energyThreshold : (thresholds.minEnergyThreshold || 0.1),
        hitInterval: prev.hitInterval !== 40 ? prev.hitInterval : (thresholds.minHitInterval || 40),
      }));
    }
  }, [thresholds, showSettings]);

  const handleThresholdChange = useCallback((key, value) => {
    setLocalThresholds(prev => ({ ...prev, [key]: value }));
  }, []);

  const handlePresetChange = useCallback((presetKey) => {
    setSelectedPreset(presetKey);
    const preset = GENRE_PRESETS[presetKey];
    if (preset && preset.settings) {
      // Apply preset settings to local thresholds
      setLocalThresholds(prev => ({
        ...prev,
        energyThreshold: preset.settings.energyThreshold || prev.energyThreshold,
        hitInterval: preset.settings.minHitInterval || prev.hitInterval,
      }));
    }
  }, []);

  const handleApplySettings = useCallback(() => {
    // Update parent thresholds with current local values
    if (onThresholdChange) {
      onThresholdChange('minEnergyThreshold', localThresholds.energyThreshold);
      onThresholdChange('minHitInterval', localThresholds.hitInterval);
      if (selectedPreset) {
        onThresholdChange('genrePreset', selectedPreset);
      }
    }
    // Re-analyze with new settings
    if (onReanalyze) {
      onReanalyze(localThresholds);
    }
  }, [onThresholdChange, onReanalyze, localThresholds, selectedPreset]);

  if (status === STAGE_STATUS.BLOCKED) {
    return (
      <div className="verification-stage rhythm-stage blocked">
        <div className="stage-header">
          <span className="stage-icon">{getStatusIcon(STAGE_STATUS.BLOCKED)}</span>
          <h3>Rhythm Verification</h3>
          <span className="stage-status blocked">Waiting for audio check</span>
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="verification-stage rhythm-stage analyzing">
        <div className="stage-header">
          <span className="stage-icon spinning">{'\u21BB'}</span>
          <h3>Rhythm Verification</h3>
          <span className="stage-status checking">Analyzing... {analysisProgress}%</span>
        </div>
        <div className="stage-content">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${analysisProgress}%` }}
            />
          </div>
          <p className="analyzing-text">Detecting beats, onsets, and classifying drum hits...</p>
        </div>
      </div>
    );
  }

  if (!results || !rhythmData) {
    return (
      <div className="verification-stage rhythm-stage pending">
        <div className="stage-header">
          <span className="stage-icon">{getStatusIcon(STAGE_STATUS.PENDING)}</span>
          <h3>Rhythm Verification</h3>
          <span className="stage-status pending">Waiting for analysis...</span>
        </div>
      </div>
    );
  }

  const { checks, passed, warnings, metrics } = results;
  const { bpm, bpmConfidence, patternMatch, swing } = rhythmData;
  const hasWarnings = warnings?.length > 0;

  return (
    <div className={`verification-stage rhythm-stage ${status}`}>
      <div className="stage-header">
        <span
          className="stage-icon"
          style={{ color: getSeverityColor(passed ? (hasWarnings ? 'warning' : 'success') : 'error') }}
        >
          {getStatusIcon(status)}
        </span>
        <h3>Rhythm Verification</h3>
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
          {/* Main metrics display */}
          <div className="rhythm-metrics">
            {/* BPM */}
            <div className="metric-row">
              <span className="metric-label">BPM:</span>
              <span className="metric-value">{bpm ? Math.round(bpm) : '?'}</span>
              <span className="metric-label">Confidence:</span>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${confidenceToWidth(bpmConfidence)}%`,
                    backgroundColor: getSeverityColor(
                      bpmConfidence >= 0.6 ? 'success' : bpmConfidence >= 0.4 ? 'warning' : 'error'
                    ),
                  }}
                />
              </div>
              <span className="metric-percent">{Math.round((bpmConfidence || 0) * 100)}%</span>
              <span
                className="metric-status"
                style={{ color: getSeverityColor(bpmConfidence >= 0.6 ? 'success' : 'warning') }}
              >
                {bpmConfidence >= 0.6 ? '\u2713 PASS' : '\u26A0 LOW'}
              </span>
            </div>

            {/* Pattern */}
            <div className="metric-row">
              <span className="metric-label">Pattern:</span>
              <span className="metric-value">{patternMatch?.name || 'Unknown'}</span>
              <span className="metric-label">Confidence:</span>
              <div className="confidence-bar">
                <div
                  className="confidence-fill"
                  style={{
                    width: `${confidenceToWidth(patternMatch?.confidence || 0)}%`,
                    backgroundColor: getSeverityColor(
                      (patternMatch?.confidence || 0) >= 0.5 ? 'success' : 'warning'
                    ),
                  }}
                />
              </div>
              <span className="metric-percent">{Math.round((patternMatch?.confidence || 0) * 100)}%</span>
              <span
                className="metric-status"
                style={{ color: getSeverityColor((patternMatch?.confidence || 0) >= 0.5 ? 'success' : 'warning') }}
              >
                {(patternMatch?.confidence || 0) >= 0.5 ? '\u2713 PASS' : '\u26A0 LOW'}
              </span>
            </div>

            {/* Hits */}
            <div className="metric-row">
              <span className="metric-label">Hits:</span>
              <span className="metric-value hits-breakdown">
                {metrics?.hitCount || 0} total
                {metrics?.hitBreakdown && (
                  <span className="hit-details">
                    (K:{metrics.hitBreakdown.kick}, S:{metrics.hitBreakdown.snare},
                    HH:{metrics.hitBreakdown.hihat}, Other:{metrics.hitBreakdown.other})
                  </span>
                )}
              </span>
            </div>

            {/* Swing */}
            {swing !== undefined && swing !== 50 && (
              <div className="metric-row">
                <span className="metric-label">Swing:</span>
                <span className="metric-value">{swing}%</span>
              </div>
            )}
          </div>

          {/* Adjustable Settings */}
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
                  <label>Energy Threshold:</label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.25"
                    step="0.01"
                    value={localThresholds.energyThreshold}
                    onChange={(e) => handleThresholdChange('energyThreshold', parseFloat(e.target.value))}
                  />
                  <span className="setting-value">{localThresholds.energyThreshold.toFixed(2)}</span>
                </div>

                <div className="setting-row">
                  <label>Min Hit Interval:</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={localThresholds.hitInterval}
                    onChange={(e) => handleThresholdChange('hitInterval', parseInt(e.target.value))}
                  />
                  <span className="setting-value">{localThresholds.hitInterval}ms</span>
                </div>

                <div className="setting-row">
                  <label>Genre Preset:</label>
                  <select
                    value={selectedPreset}
                    onChange={(e) => handlePresetChange(e.target.value)}
                  >
                    <option value="">Select preset...</option>
                    {Object.entries(GENRE_PRESETS).map(([key, preset]) => (
                      <option key={key} value={key}>
                        {preset.name} - {preset.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Show current settings summary */}
                <div className="settings-summary">
                  <span className="summary-item">Energy: {localThresholds.energyThreshold.toFixed(2)}</span>
                  <span className="summary-item">Interval: {localThresholds.hitInterval}ms</span>
                  {selectedPreset && <span className="summary-item preset">Preset: {GENRE_PRESETS[selectedPreset]?.name}</span>}
                </div>

                <div className="settings-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleApplySettings}
                  >
                    Re-analyze
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Analysis method indicator */}
          {analysisMethod && (
            <div className="analysis-method-badge">
              <span className="method-label">Method:</span>
              <span className={`method-value ${analysisMethod.includes('gemini') ? 'ai' : ''}`}>
                {analysisMethod.includes('gemini') ? 'Gemini AI' : analysisMethod}
              </span>
            </div>
          )}

          {/* Stage actions */}
          <div className="stage-actions">
            {onOpenFixGrid && (
              <button
                className="btn btn-secondary"
                onClick={onOpenFixGrid}
              >
                Open Fix Grid
              </button>
            )}

            {onFindQuietHits && (
              <button
                className="btn btn-pattern"
                onClick={onFindQuietHits}
                disabled={isFindingQuietHits}
                title="Use pattern-based prediction to find quiet percussion hits"
              >
                {isFindingQuietHits ? (
                  <>
                    <span className="spinner-icon">&#x21BB;</span> Finding...
                  </>
                ) : (
                  <>
                    <span className="pattern-icon">&#x1F50D;</span> Find Quiet Hits
                  </>
                )}
              </button>
            )}

            {onReanalyzeWithAI && analysisMethod !== 'gemini-ai' && (
              <button
                className="btn btn-ai"
                onClick={onReanalyzeWithAI}
                title="Use Gemini 3 Pro for more accurate drum classification"
              >
                <span className="ai-icon">&#x2728;</span> Analyze with Gemini AI
              </button>
            )}

            {status !== STAGE_STATUS.VERIFIED && (
              <button
                className="btn btn-primary"
                onClick={onApprove}
              >
                Approve &amp; Continue &rarr;
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

export default RhythmVerificationStage;
