import React from 'react';
import PropTypes from 'prop-types';
import { getScoreColor, getStatusColor, PLATFORM_TARGETS } from '../../utils/analysisUtils';

/**
 * QualityPanel - Displays quality metrics and recommendations
 * SNR, DC offset, clipping detection, quality score, and smart recommendations
 */
function QualityPanel({ quality, recommendations, targetPlatform, onPlatformChange }) {
  if (!quality) {
    return (
      <div className="analysis-panel quality-panel">
        <h3>Quality</h3>
        <p className="no-data">No data available</p>
      </div>
    );
  }

  const { score, grade, issues, snr, dcOffset, clipCount } = quality;

  return (
    <div className="analysis-panel quality-panel">
      <h3>Quality</h3>

      <div className="quality-content">
        {/* Overall Score */}
        <div className="quality-score-section">
          <div className="quality-score-circle" style={{ borderColor: getScoreColor(score) }}>
            <span className="score-value" style={{ color: getScoreColor(score) }}>{score}</span>
            <span className="score-grade">{grade}</span>
          </div>
          <div className="score-label">Quality Score</div>
        </div>

        {/* Quality Metrics */}
        <div className="quality-metrics">
          <div className="quality-metric">
            <div className="quality-metric-label">Signal-to-Noise</div>
            <div className={`quality-metric-value ${snr > 60 ? 'good' : snr > 40 ? 'warning' : 'bad'}`}>
              {snr.toFixed(0)} dB
            </div>
            <div className="quality-metric-status">
              {snr > 70 ? 'Excellent' : snr > 60 ? 'Good' : snr > 40 ? 'Acceptable' : 'Noisy'}
            </div>
          </div>

          <div className="quality-metric">
            <div className="quality-metric-label">DC Offset</div>
            <div className={`quality-metric-value ${Math.abs(dcOffset) < 0.001 ? 'good' : Math.abs(dcOffset) < 0.01 ? 'warning' : 'bad'}`}>
              {(dcOffset * 100).toFixed(3)}%
            </div>
            <div className="quality-metric-status">
              {Math.abs(dcOffset) < 0.001 ? 'None' : Math.abs(dcOffset) < 0.01 ? 'Minor' : 'Present'}
            </div>
          </div>

          <div className="quality-metric">
            <div className="quality-metric-label">Clipping</div>
            <div className={`quality-metric-value ${clipCount === 0 ? 'good' : clipCount < 10 ? 'warning' : 'bad'}`}>
              {clipCount}
            </div>
            <div className="quality-metric-status">
              {clipCount === 0 ? 'Clean' : clipCount < 10 ? 'Minor' : 'Severe'}
            </div>
          </div>
        </div>

        {/* Issues */}
        {issues && issues.length > 0 && (
          <div className="quality-issues">
            <div className="issues-header">Issues Detected</div>
            <ul className="issues-list">
              {issues.map((issue, idx) => (
                <li
                  key={idx}
                  className={`issue-item ${issue.severity}`}
                >
                  <span className="issue-icon">
                    {issue.severity === 'high' ? '!' :
                     issue.severity === 'medium' ? '?' : 'i'}
                  </span>
                  <span className="issue-message">{issue.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Platform Selector */}
        <div className="platform-selector">
          <label htmlFor="platform-select">Target Platform:</label>
          <select
            id="platform-select"
            value={targetPlatform}
            onChange={(e) => onPlatformChange && onPlatformChange(e.target.value)}
          >
            {Object.entries(PLATFORM_TARGETS).map(([key, platform]) => (
              <option key={key} value={key}>
                {platform.name} ({platform.lufs} LUFS)
              </option>
            ))}
          </select>
        </div>

        {/* Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <div className="recommendations-section">
            <div className="recommendations-header">Recommendations</div>
            <ul className="recommendations-list">
              {recommendations.map((rec, idx) => (
                <li
                  key={idx}
                  className={`recommendation-item ${rec.status}`}
                >
                  <span
                    className="recommendation-icon"
                    style={{ color: getStatusColor(rec.status) }}
                  >
                    {rec.status === 'success' ? '\u2713' :
                     rec.status === 'warning' ? '\u26A0' :
                     rec.status === 'error' ? '\u2717' : '\u2139'}
                  </span>
                  <span className="recommendation-message">{rec.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

QualityPanel.propTypes = {
  quality: PropTypes.shape({
    score: PropTypes.number,
    grade: PropTypes.string,
    issues: PropTypes.arrayOf(PropTypes.shape({
      type: PropTypes.string,
      severity: PropTypes.string,
      message: PropTypes.string
    })),
    snr: PropTypes.number,
    dcOffset: PropTypes.number,
    clipCount: PropTypes.number,
    clipPositions: PropTypes.array
  }),
  recommendations: PropTypes.arrayOf(PropTypes.shape({
    type: PropTypes.string,
    status: PropTypes.string,
    message: PropTypes.string
  })),
  targetPlatform: PropTypes.string,
  onPlatformChange: PropTypes.func
};

QualityPanel.defaultProps = {
  targetPlatform: 'spotify'
};

export default QualityPanel;
