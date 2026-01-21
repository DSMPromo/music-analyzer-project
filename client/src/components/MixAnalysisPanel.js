import React, { useMemo } from 'react';

/**
 * MixAnalysisPanel Component
 * Displays detected mix issues with jump/solo buttons
 */
function MixAnalysisPanel({
  analysisResults,
  isAnalyzing,
  progress,
  onSeek,
  onSoloFrequency,
  collapsed = false,
  onToggleCollapse
}) {
  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Format frequency for display
  const formatFreq = (freq) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return `${Math.round(freq)}`;
  };

  // Group issues by category
  const groupedIssues = useMemo(() => {
    if (!analysisResults) return null;

    const { problems, masking, resonances, summary } = analysisResults;

    return {
      severe: [
        ...problems.filter(p => p.severity === 'severe'),
        ...masking.filter(m => m.severity === 'severe'),
        ...resonances.filter(r => r.severity === 'severe')
      ],
      moderate: [
        ...problems.filter(p => p.severity === 'moderate'),
        ...masking.filter(m => m.severity === 'moderate'),
        ...resonances.filter(r => r.severity === 'moderate')
      ],
      mild: [
        ...problems.filter(p => p.severity === 'mild'),
        ...resonances.filter(r => r.severity === 'mild')
      ],
      summary
    };
  }, [analysisResults]);

  // Get status icon based on overall status
  const getStatusIcon = (status) => {
    switch (status) {
      case 'good': return { icon: '\u2713', color: '#10B981' };
      case 'minor': return { icon: '\u26A0', color: '#3B82F6' };
      case 'warning': return { icon: '\u26A0', color: '#F59E0B' };
      case 'issues': return { icon: '\u2717', color: '#EF4444' };
      default: return { icon: '?', color: '#666' };
    }
  };

  // Render loading state
  if (isAnalyzing) {
    return (
      <div className="mix-analysis-panel">
        <div className="panel-header">
          <h3>Mix Analysis</h3>
        </div>
        <div className="panel-loading">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          <span className="progress-text">
            Analyzing mix... {Math.round(progress * 100)}%
          </span>
        </div>
      </div>
    );
  }

  // Render empty state
  if (!analysisResults) {
    return (
      <div className="mix-analysis-panel">
        <div className="panel-header">
          <h3>Mix Analysis</h3>
        </div>
        <div className="panel-empty">
          <p>Generate a spectrogram to analyze your mix</p>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusIcon(groupedIssues.summary.overallStatus);

  return (
    <div className={`mix-analysis-panel ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="panel-header"
        onClick={onToggleCollapse}
        style={{ cursor: onToggleCollapse ? 'pointer' : 'default' }}
      >
        <h3>
          <span
            className="status-icon"
            style={{ color: statusInfo.color }}
          >
            {statusInfo.icon}
          </span>
          Mix Issues Detected
        </h3>
        <div className="issue-summary">
          {groupedIssues.summary.severeCount > 0 && (
            <span className="issue-badge severe">
              {groupedIssues.summary.severeCount} Severe
            </span>
          )}
          {groupedIssues.summary.moderateCount > 0 && (
            <span className="issue-badge moderate">
              {groupedIssues.summary.moderateCount} Moderate
            </span>
          )}
          {groupedIssues.summary.mildCount > 0 && (
            <span className="issue-badge mild">
              {groupedIssues.summary.mildCount} Mild
            </span>
          )}
          {groupedIssues.summary.totalIssues === 0 && (
            <span className="issue-badge good">No Issues</span>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="panel-content">
          {/* Severe Issues */}
          {groupedIssues.severe.length > 0 && (
            <div className="issue-section severe">
              <h4>Severe Issues</h4>
              <ul className="issue-list">
                {groupedIssues.severe.map((issue, idx) => (
                  <IssueItem
                    key={`severe-${idx}`}
                    issue={issue}
                    onSeek={onSeek}
                    onSolo={onSoloFrequency}
                    formatTime={formatTime}
                    formatFreq={formatFreq}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Moderate Issues */}
          {groupedIssues.moderate.length > 0 && (
            <div className="issue-section moderate">
              <h4>Moderate Issues</h4>
              <ul className="issue-list">
                {groupedIssues.moderate.map((issue, idx) => (
                  <IssueItem
                    key={`moderate-${idx}`}
                    issue={issue}
                    onSeek={onSeek}
                    onSolo={onSoloFrequency}
                    formatTime={formatTime}
                    formatFreq={formatFreq}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Mild Issues */}
          {groupedIssues.mild.length > 0 && (
            <div className="issue-section mild">
              <h4>Mild Issues</h4>
              <ul className="issue-list">
                {groupedIssues.mild.map((issue, idx) => (
                  <IssueItem
                    key={`mild-${idx}`}
                    issue={issue}
                    onSeek={onSeek}
                    onSolo={onSoloFrequency}
                    formatTime={formatTime}
                    formatFreq={formatFreq}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* All Good */}
          {groupedIssues.summary.totalIssues === 0 && (
            <div className="all-good">
              <span className="checkmark">\u2713</span>
              <p>Your mix looks balanced! No significant issues detected.</p>
            </div>
          )}

          {/* Resonances (if any) */}
          {analysisResults.resonances.length > 0 && (
            <div className="resonances-section">
              <h4>Resonant Frequencies</h4>
              <div className="resonance-list">
                {analysisResults.resonances.map((res, idx) => (
                  <div key={idx} className={`resonance-item ${res.severity}`}>
                    <span className="resonance-freq">{formatFreq(res.frequency)}Hz</span>
                    <span className="resonance-excess">+{res.excessDb.toFixed(1)}dB</span>
                    {onSoloFrequency && (
                      <button
                        className="solo-btn"
                        onClick={() => onSoloFrequency(res.frequency)}
                        title={`Solo ${formatFreq(res.frequency)}Hz`}
                      >
                        Solo
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual issue item component
 */
function IssueItem({ issue, onSeek, onSolo, formatTime, formatFreq }) {
  const hasTimeRange = issue.startTime !== undefined && issue.endTime !== undefined;
  const hasFrequency = issue.frequency !== undefined || issue.frequencyRange !== undefined;

  // Get description based on issue type
  const getDescription = () => {
    if (issue.description) return issue.description;
    if (issue.name) return issue.name;
    if (issue.bands) return `Frequency masking between ${issue.bands.join(' and ')}`;
    return 'Unknown issue';
  };

  // Get frequency display
  const getFreqDisplay = () => {
    if (issue.frequencyRange) {
      return `${formatFreq(issue.frequencyRange[0])}-${formatFreq(issue.frequencyRange[1])}Hz`;
    }
    if (issue.frequency) {
      return `${formatFreq(issue.frequency)}Hz`;
    }
    return '';
  };

  return (
    <li className={`issue-item ${issue.severity || 'moderate'}`}>
      <div className="issue-icon">!</div>
      <div className="issue-content">
        <div className="issue-title">
          <span className="issue-name">{issue.name || getDescription()}</span>
          {hasFrequency && (
            <span className="issue-freq">({getFreqDisplay()})</span>
          )}
        </div>
        {hasTimeRange && (
          <div className="issue-time">
            {formatTime(issue.startTime)} - {formatTime(issue.endTime)}
          </div>
        )}
        {issue.excessDb && (
          <div className="issue-excess">
            {issue.excessDb > 0 ? '+' : ''}{issue.excessDb.toFixed(1)}dB excess
          </div>
        )}
      </div>
      <div className="issue-actions">
        {hasTimeRange && onSeek && (
          <button
            className="action-btn jump"
            onClick={() => onSeek(issue.startTime)}
            title="Jump to this issue"
          >
            Jump
          </button>
        )}
        {hasFrequency && onSolo && (
          <button
            className="action-btn solo"
            onClick={() => onSolo(issue.frequency || issue.frequencyRange?.[0])}
            title="Solo this frequency"
          >
            Solo
          </button>
        )}
      </div>
    </li>
  );
}

export default MixAnalysisPanel;
