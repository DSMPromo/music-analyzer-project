import React, { useMemo } from 'react';
import './DevModeGuidance.css';

/**
 * Developer Mode Guidance Panel
 * Analyzes all detected data and provides actionable recommendations
 */
function DevModeGuidance({
  // Audio info
  audioFile,
  duration,
  audioBuffer,

  // BPM/Rhythm data
  bpm,
  bpmConfidence,
  bpmLocked,
  bpmAutoCorrected,
  beats,
  timeSignature,
  swing,
  detectedGenre,
  genreConfidence,

  // Drum hits
  drumHits,
  totalHitCount,

  // Analysis state
  rhythmAnalysisState,
  isRhythmAnalyzing,
  rhythmServiceAvailable,

  // Chord data
  detectedKey,
  currentChord,
  chordHistory,

  // Mix analysis
  mixAnalysisResults,

  // Actions
  onOpenFixGrid,
  onFindQuietHits,
  onStartVerification,
  onAnalyzeRhythm,
  onRecalculateBPM,
  onSetManualBPM,
}) {
  // Calculate issues and recommendations
  const analysis = useMemo(() => {
    const issues = [];
    const warnings = [];
    const info = [];
    const actions = [];

    // === BPM ANALYSIS ===
    if (bpm) {
      // Half-time detection
      if (bpm < 95 && bpmConfidence < 0.5) {
        issues.push({
          type: 'bpm',
          severity: 'high',
          title: 'Possible Half-Time BPM',
          message: `Detected ${bpm.toFixed(1)} BPM with ${(bpmConfidence * 100).toFixed(0)}% confidence. This might be half the actual tempo.`,
          suggestion: `Try doubling to ${(bpm * 2).toFixed(1)} BPM`,
          action: () => onSetManualBPM && onSetManualBPM(bpm * 2),
          actionLabel: `Set ${(bpm * 2).toFixed(0)} BPM`,
        });
      }

      // Low confidence
      if (bpmConfidence < 0.4 && bpm >= 95) {
        warnings.push({
          type: 'bpm',
          severity: 'medium',
          title: 'Low BPM Confidence',
          message: `Only ${(bpmConfidence * 100).toFixed(0)}% confident in ${bpm.toFixed(1)} BPM detection.`,
          suggestion: 'Verify BPM manually or use tap tempo',
          action: onOpenFixGrid,
          actionLabel: 'Open Fix Grid',
        });
      }

      // Good BPM
      if (bpmConfidence >= 0.7) {
        info.push({
          type: 'bpm',
          title: 'BPM Detected',
          message: `${bpm.toFixed(1)} BPM (${(bpmConfidence * 100).toFixed(0)}% confidence)`,
          status: 'good',
        });
      }

      // BPM locked
      if (bpmLocked) {
        info.push({
          type: 'bpm',
          title: 'BPM Locked',
          message: 'BPM is locked. Unlock to allow auto-detection.',
          status: 'locked',
        });
      }
    } else if (audioFile && !isRhythmAnalyzing) {
      actions.push({
        type: 'bpm',
        title: 'Analyze Rhythm',
        message: 'Run rhythm analysis to detect BPM and drum patterns',
        action: onAnalyzeRhythm,
        actionLabel: 'Start Analysis',
        priority: 'high',
      });
    }

    // === DRUM HITS ANALYSIS ===
    const hitCount = totalHitCount || Object.values(drumHits || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0);

    if (hitCount > 0) {
      // Check for sparse detection
      const expectedHitsPerBar = 8; // Rough estimate
      const barsInTrack = duration && bpm ? Math.floor(duration / (60 / bpm * 4)) : 0;
      const expectedHits = barsInTrack * expectedHitsPerBar;

      if (hitCount < expectedHits * 0.3 && barsInTrack > 4) {
        warnings.push({
          type: 'hits',
          severity: 'medium',
          title: 'Low Hit Count',
          message: `Only ${hitCount} hits detected in ~${barsInTrack} bars. Expected more.`,
          suggestion: 'Try finding quiet hits or adjusting sensitivity',
          action: onFindQuietHits,
          actionLabel: 'Find Quiet Hits',
        });
      }

      // Check hit distribution
      const kickCount = drumHits?.kick?.length || 0;
      const snareCount = drumHits?.snare?.length || 0;
      const hihatCount = drumHits?.hihat?.length || 0;

      if (barsInTrack > 4) {
        // Missing kicks
        if (kickCount < barsInTrack * 0.5) {
          warnings.push({
            type: 'hits',
            severity: 'low',
            title: 'Few Kicks Detected',
            message: `Only ${kickCount} kicks in ${barsInTrack} bars`,
            suggestion: 'Check if track has sub-bass kicks that need lower frequency detection',
          });
        }

        // Missing snares
        if (snareCount < barsInTrack * 0.3) {
          warnings.push({
            type: 'hits',
            severity: 'low',
            title: 'Few Snares Detected',
            message: `Only ${snareCount} snares in ${barsInTrack} bars`,
            suggestion: 'Snares might be claps or rim shots - check classification',
          });
        }
      }

      // Good hit count
      if (hitCount >= expectedHits * 0.5) {
        info.push({
          type: 'hits',
          title: 'Hits Detected',
          message: `${hitCount} total hits (K:${kickCount} S:${snareCount} HH:${hihatCount})`,
          status: 'good',
        });
      }
    }

    // === GENRE ANALYSIS ===
    if (detectedGenre) {
      const genreAdvice = {
        'trap': 'Trap: Watch for 808 bass masking kicks. Hi-hats may have rolls.',
        'house': 'House: 4-on-the-floor kick pattern. Offbeat hi-hats common.',
        'hiphop': 'Hip-Hop: Boom-bap patterns. Snares on 2 and 4.',
        'pop': 'Pop: Standard patterns. May have synth drums.',
        'edm': 'EDM: Heavy sidechain. Watch for build-ups without drums.',
        'rock': 'Rock: Live drums with fills. Variable velocity.',
      };

      info.push({
        type: 'genre',
        title: `Genre: ${detectedGenre}`,
        message: genreAdvice[detectedGenre.toLowerCase()] || `Detected as ${detectedGenre}`,
        status: genreConfidence > 0.6 ? 'good' : 'uncertain',
      });
    }

    // === KEY/CHORD ANALYSIS ===
    if (detectedKey) {
      info.push({
        type: 'key',
        title: 'Key Detected',
        message: `Key: ${detectedKey}`,
        status: 'good',
      });
    }

    if (chordHistory?.length > 0) {
      const uniqueChords = [...new Set(chordHistory.map(c => c.chord || c))];
      info.push({
        type: 'chords',
        title: 'Chords Detected',
        message: `${uniqueChords.length} unique chords: ${uniqueChords.slice(0, 5).join(', ')}${uniqueChords.length > 5 ? '...' : ''}`,
        status: 'good',
      });
    }

    // === MIX ANALYSIS ===
    if (mixAnalysisResults) {
      if (mixAnalysisResults.problems?.length > 0) {
        warnings.push({
          type: 'mix',
          severity: 'medium',
          title: 'Mix Issues Found',
          message: `${mixAnalysisResults.problems.length} potential issues in frequency balance`,
          suggestion: 'Check Mix Analysis panel for details',
        });
      }
    }

    // === SERVICE STATUS ===
    if (!rhythmServiceAvailable) {
      issues.push({
        type: 'service',
        severity: 'high',
        title: 'Rhythm Service Offline',
        message: 'Python rhythm analyzer not available',
        suggestion: 'Run ./start-services.sh to start backend',
      });
    }

    // === SUGGESTED NEXT ACTIONS ===
    if (audioFile && !isRhythmAnalyzing && hitCount === 0) {
      actions.push({
        type: 'analyze',
        title: 'Start Analysis',
        message: 'Analyze this track to detect rhythm and chords',
        action: onAnalyzeRhythm,
        actionLabel: 'Analyze',
        priority: 'high',
      });
    }

    if (hitCount > 0 && bpm) {
      actions.push({
        type: 'verify',
        title: 'Verify Detection',
        message: 'Step through each instrument to verify accuracy',
        action: onStartVerification,
        actionLabel: 'Start Verification',
        priority: 'medium',
      });
    }

    return { issues, warnings, info, actions };
  }, [
    audioFile, duration, bpm, bpmConfidence, bpmLocked, bpmAutoCorrected,
    beats, timeSignature, swing, detectedGenre, genreConfidence,
    drumHits, totalHitCount, rhythmAnalysisState, isRhythmAnalyzing,
    rhythmServiceAvailable, detectedKey, currentChord, chordHistory,
    mixAnalysisResults, onOpenFixGrid, onFindQuietHits, onStartVerification,
    onAnalyzeRhythm, onRecalculateBPM, onSetManualBPM
  ]);

  const hasIssues = analysis.issues.length > 0;
  const hasWarnings = analysis.warnings.length > 0;

  return (
    <div className="dev-mode-guidance">
      <div className="dmg-header">
        <span className="dmg-icon">🔧</span>
        <span className="dmg-title">Developer Mode</span>
        {hasIssues && <span className="dmg-badge dmg-badge-error">{analysis.issues.length}</span>}
        {hasWarnings && <span className="dmg-badge dmg-badge-warning">{analysis.warnings.length}</span>}
      </div>

      <div className="dmg-content">
        {/* Critical Issues */}
        {analysis.issues.length > 0 && (
          <div className="dmg-section dmg-issues">
            <h4>Issues</h4>
            {analysis.issues.map((issue, i) => (
              <div key={i} className={`dmg-item dmg-item-${issue.severity}`}>
                <div className="dmg-item-header">
                  <span className="dmg-item-icon">⚠️</span>
                  <span className="dmg-item-title">{issue.title}</span>
                </div>
                <p className="dmg-item-message">{issue.message}</p>
                {issue.suggestion && (
                  <p className="dmg-item-suggestion">💡 {issue.suggestion}</p>
                )}
                {issue.action && (
                  <button className="dmg-action-btn" onClick={issue.action}>
                    {issue.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Warnings */}
        {analysis.warnings.length > 0 && (
          <div className="dmg-section dmg-warnings">
            <h4>Warnings</h4>
            {analysis.warnings.map((warning, i) => (
              <div key={i} className={`dmg-item dmg-item-${warning.severity}`}>
                <div className="dmg-item-header">
                  <span className="dmg-item-icon">⚡</span>
                  <span className="dmg-item-title">{warning.title}</span>
                </div>
                <p className="dmg-item-message">{warning.message}</p>
                {warning.suggestion && (
                  <p className="dmg-item-suggestion">💡 {warning.suggestion}</p>
                )}
                {warning.action && (
                  <button className="dmg-action-btn dmg-action-btn-secondary" onClick={warning.action}>
                    {warning.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Suggested Actions */}
        {analysis.actions.length > 0 && (
          <div className="dmg-section dmg-actions">
            <h4>Suggested Actions</h4>
            {analysis.actions.map((action, i) => (
              <div key={i} className={`dmg-item dmg-item-action dmg-priority-${action.priority}`}>
                <div className="dmg-item-header">
                  <span className="dmg-item-icon">▶️</span>
                  <span className="dmg-item-title">{action.title}</span>
                </div>
                <p className="dmg-item-message">{action.message}</p>
                {action.action && (
                  <button className="dmg-action-btn dmg-action-btn-primary" onClick={action.action}>
                    {action.actionLabel}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info/Status */}
        {analysis.info.length > 0 && (
          <div className="dmg-section dmg-info">
            <h4>Detection Status</h4>
            <div className="dmg-info-grid">
              {analysis.info.map((item, i) => (
                <div key={i} className={`dmg-info-item dmg-status-${item.status}`}>
                  <span className="dmg-info-label">{item.title}</span>
                  <span className="dmg-info-value">{item.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="dmg-section dmg-stats">
          <h4>Quick Stats</h4>
          <div className="dmg-stats-grid">
            <div className="dmg-stat">
              <span className="dmg-stat-value">{bpm ? bpm.toFixed(1) : '--'}</span>
              <span className="dmg-stat-label">BPM</span>
            </div>
            <div className="dmg-stat">
              <span className="dmg-stat-value">{bpmConfidence ? `${(bpmConfidence * 100).toFixed(0)}%` : '--'}</span>
              <span className="dmg-stat-label">Confidence</span>
            </div>
            <div className="dmg-stat">
              <span className="dmg-stat-value">{Object.values(drumHits || {}).reduce((sum, arr) => sum + (arr?.length || 0), 0)}</span>
              <span className="dmg-stat-label">Hits</span>
            </div>
            <div className="dmg-stat">
              <span className="dmg-stat-value">{duration ? `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : '--'}</span>
              <span className="dmg-stat-label">Duration</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DevModeGuidance;
