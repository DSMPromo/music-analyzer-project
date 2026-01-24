import React from 'react';

/**
 * SunoModePanel - AI artifact detection UI
 * Detects and displays common artifacts in AI-generated audio
 */
function SunoModePanel({ analysis = null, isAnalyzing = false, onAnalyze }) {
  if (!analysis && !isAnalyzing) {
    return (
      <div className="suno-mode-panel empty">
        <div className="suno-header">
          <h4>AI Artifact Detection</h4>
          <span className="suno-badge">Suno Mode</span>
        </div>
        <div className="suno-empty-state">
          <div className="suno-icon">🤖</div>
          <p>Detects common artifacts in AI-generated audio:</p>
          <ul className="artifact-list-preview">
            <li>Metallic high frequencies</li>
            <li>Phase coherence issues</li>
            <li>Unnatural transients</li>
            <li>Stereo field anomalies</li>
            <li>Spectral smearing</li>
          </ul>
          {onAnalyze && (
            <button className="analyze-suno-btn" onClick={onAnalyze}>
              Analyze for AI Artifacts
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isAnalyzing) {
    return (
      <div className="suno-mode-panel analyzing">
        <div className="suno-header">
          <h4>AI Artifact Detection</h4>
          <span className="suno-badge">Analyzing...</span>
        </div>
        <div className="suno-loading">
          <div className="loading-spinner" />
          <p>Scanning for AI generation artifacts...</p>
        </div>
      </div>
    );
  }

  const { isAIGenerated, confidence, artifactCount, artifacts, summary } = analysis;

  return (
    <div className="suno-mode-panel">
      {/* Header */}
      <div className="suno-header">
        <h4>AI Artifact Detection</h4>
        <span className={`suno-badge ${isAIGenerated ? 'detected' : 'clean'}`}>
          {isAIGenerated ? 'AI Detected' : 'Likely Human'}
        </span>
      </div>

      {/* Detection Summary */}
      <div className="suno-summary">
        <div className="summary-metric">
          <span className="metric-label">AI Confidence</span>
          <span className={`metric-value confidence-${getConfidenceLevel(confidence)}`}>
            {confidence}%
          </span>
        </div>
        <div className="summary-metric">
          <span className="metric-label">Artifacts Found</span>
          <span className="metric-value">{artifactCount}</span>
        </div>
        <div className={`summary-status status-${summary?.status || 'clean'}`}>
          {summary?.message || 'No significant artifacts detected'}
        </div>
      </div>

      {/* Artifacts List */}
      {artifacts && artifacts.length > 0 && (
        <div className="suno-artifacts">
          <h5>Detected Artifacts</h5>
          <div className="artifacts-grid">
            {artifacts.map((artifact, idx) => (
              <ArtifactCard key={idx} artifact={artifact} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {summary?.recommendations && summary.recommendations.length > 0 && (
        <div className="suno-recommendations">
          <h5>Recommended Fixes</h5>
          <div className="recommendations-list">
            {summary.recommendations.map((rec, idx) => (
              <div key={idx} className={`recommendation-item severity-${rec.severity}`}>
                <div className="rec-header">
                  <span className="rec-issue">{rec.issue}</span>
                  <span className={`rec-severity ${rec.severity}`}>{rec.severity}</span>
                  <span className="rec-confidence">{rec.confidence}%</span>
                </div>
                <div className="rec-fix">{rec.fix}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Artifacts Message */}
      {(!artifacts || artifacts.length === 0) && (
        <div className="suno-clean">
          <span className="clean-icon">✓</span>
          <p>No significant AI artifacts detected.</p>
          <p className="clean-note">
            Audio appears to be cleanly produced or any AI artifacts are minimal.
          </p>
        </div>
      )}

      {/* Re-analyze Button */}
      {onAnalyze && (
        <button className="reanalyze-btn" onClick={onAnalyze}>
          Re-analyze
        </button>
      )}
    </div>
  );
}

/**
 * ArtifactCard - Display a single detected artifact
 */
function ArtifactCard({ artifact }) {
  const severityColors = {
    severe: '#ef4444',
    moderate: '#f59e0b',
    mild: '#10b981'
  };

  return (
    <div className={`artifact-card severity-${artifact.severity}`}>
      <div className="artifact-header">
        <span className="artifact-name">{artifact.name}</span>
        <span
          className="artifact-confidence"
          style={{ color: severityColors[artifact.severity] }}
        >
          {artifact.confidence}%
        </span>
      </div>

      <div className="artifact-description">
        {artifact.description}
      </div>

      {artifact.frequencyRange && (
        <div className="artifact-freq">
          Frequency: {formatFrequencyRange(artifact.frequencyRange)}
        </div>
      )}

      {/* Specific metrics */}
      <div className="artifact-metrics">
        {artifact.peakFrequency && (
          <span>Peak: {formatFreq(artifact.peakFrequency)}</span>
        )}
        {artifact.avgCorrelation !== undefined && (
          <span>Correlation: {artifact.avgCorrelation.toFixed(2)}</span>
        )}
        {artifact.avgAttackTimeMs !== undefined && (
          <span>Attack: {artifact.avgAttackTimeMs.toFixed(1)}ms</span>
        )}
        {artifact.avgWidth !== undefined && (
          <span>Width: {artifact.avgWidth.toFixed(0)}%</span>
        )}
      </div>

      <div className="artifact-fix">
        <strong>Fix:</strong> {artifact.fix}
      </div>
    </div>
  );
}

// Helper functions
function getConfidenceLevel(confidence) {
  if (confidence >= 70) return 'high';
  if (confidence >= 40) return 'medium';
  return 'low';
}

function formatFreq(freq) {
  if (!freq) return '--';
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}kHz`;
  return `${Math.round(freq)}Hz`;
}

function formatFrequencyRange(range) {
  if (!range || !Array.isArray(range)) return '--';
  return `${formatFreq(range[0])} - ${formatFreq(range[1])}`;
}

export default SunoModePanel;
