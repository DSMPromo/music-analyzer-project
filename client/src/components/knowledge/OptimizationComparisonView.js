import React from 'react';

/**
 * OptimizationComparisonView - Before/after metrics comparison
 * Shows current metrics vs optimal targets with visual comparison
 */
function OptimizationComparisonView({
  currentMetrics = {},
  targetMetrics = {},
  scores = {},
  genreName = 'Unknown'
}) {
  // Metric comparison data
  const metrics = [
    {
      label: 'Loudness',
      key: 'lufs',
      current: currentMetrics.lufs,
      target: targetMetrics.lufs,
      unit: 'LUFS',
      direction: 'higher', // higher is louder
      format: (v) => v?.toFixed(1)
    },
    {
      label: 'Dynamic Range',
      key: 'dynamicRange',
      current: currentMetrics.dynamicRange,
      target: targetMetrics.dynamicRange,
      unit: 'dB',
      direction: 'target', // depends on genre
      format: (v) => v?.toFixed(1)
    },
    {
      label: 'True Peak',
      key: 'truePeak',
      current: currentMetrics.truePeak,
      target: targetMetrics.truePeak,
      unit: 'dBFS',
      direction: 'lower', // lower (less hot) is often better
      format: (v) => v?.toFixed(1)
    },
    {
      label: 'Stereo Width',
      key: 'stereoWidth',
      current: currentMetrics.stereoWidth,
      target: null,
      unit: '%',
      direction: 'target',
      format: (v) => Math.round(v)
    },
    {
      label: 'Phase Correlation',
      key: 'phaseCorrelation',
      current: currentMetrics.phaseCorrelation,
      target: 0.7, // Good mono compatibility
      unit: '',
      direction: 'higher',
      format: (v) => v?.toFixed(2)
    }
  ];

  // Calculate metric status
  const getMetricStatus = (metric) => {
    if (metric.current === undefined || metric.current === null) return 'unknown';
    if (metric.target === undefined || metric.target === null) return 'info';

    const diff = Math.abs(metric.current - metric.target);
    const threshold = metric.key === 'lufs' ? 2 : metric.key === 'truePeak' ? 0.5 : 3;

    if (diff < threshold * 0.5) return 'good';
    if (diff < threshold) return 'warning';
    return 'needs-work';
  };

  // Calculate improvement arrow
  const getArrow = (metric) => {
    if (metric.current === undefined || metric.target === undefined) return '';

    const diff = metric.target - metric.current;
    if (Math.abs(diff) < 0.5) return '→';
    return diff > 0 ? '↑' : '↓';
  };

  return (
    <div className="optimization-comparison">
      {/* Score Cards */}
      <div className="score-cards">
        <div className="score-card current">
          <div className="score-label">Current Score</div>
          <div className="score-value">{scores.current || '--'}</div>
          <div className="score-grade">{getGrade(scores.current)}</div>
        </div>

        <div className="score-arrow">→</div>

        <div className="score-card potential">
          <div className="score-label">Potential Score</div>
          <div className="score-value">{scores.potential || '--'}</div>
          <div className="score-grade">{getGrade(scores.potential)}</div>
        </div>

        <div className="score-improvement">
          <span className="improvement-label">Improvement</span>
          <span className="improvement-value">+{scores.improvement || 0}</span>
        </div>
      </div>

      {/* Genre Target */}
      <div className="genre-target">
        <span className="genre-label">Target Genre:</span>
        <span className="genre-name">{genreName}</span>
      </div>

      {/* Metrics Comparison */}
      <div className="metrics-comparison">
        <div className="comparison-header">
          <span className="col-metric">Metric</span>
          <span className="col-current">Current</span>
          <span className="col-arrow"></span>
          <span className="col-target">Target</span>
          <span className="col-status">Status</span>
        </div>

        {metrics.map((metric, idx) => {
          const status = getMetricStatus(metric);
          const arrow = getArrow(metric);

          return (
            <div key={idx} className={`comparison-row status-${status}`}>
              <span className="col-metric">
                {metric.label}
              </span>
              <span className="col-current">
                {metric.format(metric.current) || '--'} {metric.unit}
              </span>
              <span className="col-arrow">{arrow}</span>
              <span className="col-target">
                {metric.target !== null
                  ? `${metric.format(metric.target)} ${metric.unit}`
                  : '--'
                }
              </span>
              <span className="col-status">
                <span className={`status-badge ${status}`}>
                  {status === 'good' && '✓'}
                  {status === 'warning' && '!'}
                  {status === 'needs-work' && '✗'}
                  {status === 'info' && 'i'}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      {/* Visual Progress Bars */}
      <div className="progress-section">
        <h4>Progress to Commercial Ready</h4>

        {/* LUFS Progress */}
        <div className="progress-item">
          <span className="progress-label">Loudness</span>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-fill lufs"
                style={{
                  width: `${Math.min(100, Math.max(0, calculateLUFSProgress(currentMetrics.lufs, targetMetrics.lufs)))}%`
                }}
              />
              <div
                className="progress-target-marker"
                style={{ left: '80%' }}
                title="Target zone"
              />
            </div>
          </div>
          <span className="progress-value">
            {currentMetrics.lufs?.toFixed(1) || '--'} / {targetMetrics.lufs?.toFixed(1) || '--'} LUFS
          </span>
        </div>

        {/* Dynamic Range Progress */}
        <div className="progress-item">
          <span className="progress-label">Dynamics</span>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-fill dynamics"
                style={{
                  width: `${Math.min(100, Math.max(0, calculateDRProgress(currentMetrics.dynamicRange, targetMetrics.dynamicRange)))}%`
                }}
              />
            </div>
          </div>
          <span className="progress-value">
            {currentMetrics.dynamicRange?.toFixed(1) || '--'} / {targetMetrics.dynamicRange?.toFixed(1) || '--'} dB
          </span>
        </div>

        {/* Phase Correlation */}
        <div className="progress-item">
          <span className="progress-label">Mono Compat</span>
          <div className="progress-bar-container">
            <div className="progress-bar">
              <div
                className="progress-fill phase"
                style={{
                  width: `${Math.min(100, Math.max(0, (currentMetrics.phaseCorrelation || 0) * 100))}%`
                }}
              />
            </div>
          </div>
          <span className="progress-value">
            {((currentMetrics.phaseCorrelation || 0) * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="comparison-summary">
        {scores.improvement > 10 ? (
          <p className="summary-text needs-work">
            Significant improvements available. Focus on priority actions to reach commercial quality.
          </p>
        ) : scores.improvement > 5 ? (
          <p className="summary-text moderate">
            Audio is close to target. A few adjustments will bring it to commercial standard.
          </p>
        ) : (
          <p className="summary-text good">
            Audio is already near commercial quality. Fine-tuning recommended for best results.
          </p>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getGrade(score) {
  if (score === null || score === undefined) return '-';
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

function calculateLUFSProgress(current, target) {
  if (current === undefined || target === undefined) return 0;
  // LUFS is negative, so higher (closer to 0) is louder
  // Map from -24 to target as 0-100%
  const range = 24 + target; // e.g., -24 to -11 = 13dB range
  const progress = 24 + current; // e.g., -18 = 6dB progress
  return (progress / range) * 100;
}

function calculateDRProgress(current, target) {
  if (current === undefined || target === undefined) return 0;
  // Closer to target is better
  const maxDR = 20;
  const diff = Math.abs(current - target);
  return Math.max(0, (1 - diff / maxDR) * 100);
}

export default OptimizationComparisonView;
