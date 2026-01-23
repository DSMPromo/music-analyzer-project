import React, { useState } from 'react';
import { formatFileSize, formatDuration, formatTimestamp } from '../utils/analysisCache';

/**
 * Analysis History Panel
 * Displays cached audio analyses with ability to reload or delete
 */
function AnalysisHistory({
  history = [],
  currentCacheId = null,
  onLoadAnalysis,
  onDeleteAnalysis,
  onClearAll,
  isLoading = false,
  cacheEnabled = true,
  onToggleCache,
  onReanalyze,
  currentFileName = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleToggleCache = () => {
    if (onToggleCache) {
      onToggleCache(!cacheEnabled);
    }
  };

  const handleReanalyze = () => {
    if (onReanalyze && currentFileName) {
      onReanalyze();
    }
  };

  const handleLoad = (entry) => {
    if (onLoadAnalysis) {
      onLoadAnalysis(entry);
    }
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    if (onDeleteAnalysis) {
      onDeleteAnalysis(id);
    }
  };

  const handleClearAll = () => {
    if (confirmClear) {
      if (onClearAll) {
        onClearAll();
      }
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      // Reset confirm after 3 seconds
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  // Get pattern icon
  const getPatternIcon = (pattern) => {
    const icons = {
      'four-on-floor': '4/4',
      'backbeat': 'BB',
      'breakbeat': 'BRK',
      'half-time': 'HT',
      'shuffle': 'SH',
      'custom': '?',
    };
    return icons[pattern] || '?';
  };

  if (history.length === 0) {
    return (
      <div className="analysis-history empty">
        <div className="history-header">
          <span className="history-icon">&#128197;</span>
          <span className="history-title">History</span>
        </div>
        <p className="history-empty-text">No cached analyses yet. Play a song to analyze it.</p>
      </div>
    );
  }

  return (
    <div className={`analysis-history ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="history-header" onClick={() => setIsExpanded(!isExpanded)}>
        <span className="history-icon">&#128197;</span>
        <span className="history-title">History ({history.length})</span>
        <span className="history-toggle">{isExpanded ? '▼' : '▶'}</span>
      </div>

      {isExpanded && (
        <>
          <div className="history-controls">
            <label className="cache-toggle">
              <span className="toggle-label">Cache</span>
              <div className={`toggle-switch ${cacheEnabled ? 'on' : 'off'}`} onClick={handleToggleCache}>
                <div className="toggle-slider"></div>
              </div>
              <span className="toggle-status">{cacheEnabled ? 'ON' : 'OFF'}</span>
            </label>
            {currentFileName && (
              <button
                className="reanalyze-btn"
                onClick={handleReanalyze}
                disabled={isLoading}
                title="Force re-analyze current file"
              >
                ↻ Re-analyze
              </button>
            )}
          </div>

          <div className="history-list">
            {history.map((entry) => (
              <div
                key={entry.id}
                className={`history-item ${entry.id === currentCacheId ? 'current' : ''}`}
                onClick={() => handleLoad(entry)}
                title={`Click to load: ${entry.fileName}`}
              >
                <div className="history-item-main">
                  <div className="history-item-name">{entry.fileName}</div>
                  <div className="history-item-meta">
                    <span className="meta-duration">{formatDuration(entry.duration || 0)}</span>
                    <span className="meta-size">{formatFileSize(entry.fileSize || 0)}</span>
                    {entry.detectedKey && (
                      <span className="meta-key">{entry.detectedKey}</span>
                    )}
                    {entry.tempo && (
                      <span className="meta-tempo">{Math.round(entry.tempo)} BPM</span>
                    )}
                    {entry.detectedPattern && entry.detectedPattern !== 'custom' && (
                      <span className="meta-pattern" title={entry.detectedPattern}>
                        {getPatternIcon(entry.detectedPattern)}
                      </span>
                    )}
                  </div>
                  <div className="history-item-time">{formatTimestamp(entry.timestamp)}</div>
                </div>

                <div className="history-item-actions">
                  {entry.hasMidi && (
                    <span className="history-badge midi" title="Has MIDI export">MIDI</span>
                  )}
                  {entry.hasStems && (
                    <span className="history-badge stems" title="Has stem separation">STEMS</span>
                  )}
                  <button
                    className="history-delete-btn"
                    onClick={(e) => handleDelete(e, entry.id)}
                    title="Delete from history"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="history-footer">
            <button
              className={`history-clear-btn ${confirmClear ? 'confirm' : ''}`}
              onClick={handleClearAll}
              disabled={isLoading}
            >
              {confirmClear ? 'Click again to confirm' : 'Clear All History'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default AnalysisHistory;
