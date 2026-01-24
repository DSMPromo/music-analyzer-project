import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAudioOptimizer } from '../../hooks/useAudioOptimizer';
import {
  EQRecommendationChart,
  OptimizationComparisonView,
  BPMEffectsPanel,
  SunoModePanel,
  DynamicsPanel
} from '../knowledge';
import { PROBLEM_ZONES, detectProblemFrequencies } from '../../utils/mixAnalysisUtils';

/**
 * AudioOptimizer - AI-powered audio optimization advisor
 *
 * Features:
 * - Genre detection and targeting
 * - EQ recommendations with visual curve
 * - Compression/limiting settings
 * - Multi-band processing recommendations
 * - BPM-synced effects calculator
 * - Suno Mode (AI artifact detection)
 * - Export to JSON/PDF/DAW
 */
function AudioOptimizer({
  audioFile,
  audioBuffer,
  audioMetrics = null,
  spectrogramData = null,
  problemFrequencies = [],
  detectedBpm = 120,
  onExport
}) {
  // Use the optimizer hook
  const optimizer = useAudioOptimizer({ defaultPlatform: 'spotify' });

  // Local state
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);

  // Tab configuration
  const tabs = useMemo(() => [
    { key: 'overview', label: 'Overview', icon: '📊' },
    { key: 'eq', label: 'EQ Curve', icon: '🎛️' },
    { key: 'dynamics', label: 'Dynamics', icon: '📈' },
    { key: 'effects', label: 'Effects', icon: '🔊' },
    { key: 'suno', label: 'Suno Mode', icon: '🤖' },
    { key: 'export', label: 'Export', icon: '💾' }
  ], []);

  // Run analysis when metrics change
  useEffect(() => {
    if (audioMetrics && audioBuffer) {
      optimizer.analyze({
        metrics: audioMetrics,
        problemFrequencies,
        audioBuffer,
        spectrogramData,
        bpm: detectedBpm
      });
    }
  }, [audioMetrics?.lufs, audioBuffer, detectedBpm]);

  // Handle Suno analysis
  const handleSunoAnalyze = useCallback(() => {
    if (audioBuffer) {
      optimizer.analyzeSunoArtifacts(audioBuffer, spectrogramData);
    }
  }, [audioBuffer, spectrogramData, optimizer]);

  // Handle export
  const handleExport = useCallback(async (format) => {
    setIsExporting(true);
    try {
      switch (format) {
        case 'json':
          optimizer.exportJSON('audio-optimization');
          break;
        case 'pdf':
          optimizer.exportPDF('audio-optimization-report');
          break;
        case 'settings':
          optimizer.exportSettings('daw-settings');
          break;
        case 'copy':
          const success = await optimizer.copySettings('daw');
          if (success) {
            // Show toast or notification
          }
          break;
        default:
          break;
      }

      if (onExport) {
        onExport(format, optimizer.optimizationResult);
      }
    } finally {
      setIsExporting(false);
    }
  }, [optimizer, onExport]);

  // Handle genre change
  const handleGenreChange = (e) => {
    optimizer.setSelectedGenre(e.target.value);
    // Re-run analysis with new genre
    if (audioMetrics) {
      optimizer.analyze({
        metrics: audioMetrics,
        problemFrequencies,
        audioBuffer,
        spectrogramData,
        bpm: detectedBpm
      });
    }
  };

  // Handle platform change
  const handlePlatformChange = (e) => {
    optimizer.setPlatform(e.target.value);
    // Re-run analysis with new platform
    if (audioMetrics) {
      optimizer.analyze({
        metrics: audioMetrics,
        problemFrequencies,
        audioBuffer,
        spectrogramData,
        bpm: detectedBpm
      });
    }
  };

  // Handle BPM change
  const handleBpmChange = (newBpm) => {
    optimizer.updateBPM(newBpm);
  };

  // Render no-data state
  if (!audioFile && !audioBuffer) {
    return (
      <div className="audio-optimizer empty-state">
        <div className="empty-icon">🎵</div>
        <h3>Audio Optimizer</h3>
        <p>Upload or analyze an audio file to get AI-powered optimization recommendations.</p>
      </div>
    );
  }

  return (
    <div className="audio-optimizer">
      {/* Header */}
      <div className="optimizer-header">
        <h2>AI Audio Optimizer</h2>

        <div className="header-controls">
          {/* Genre Selection */}
          <div className="control-group">
            <label>Genre:</label>
            <select
              value={optimizer.selectedGenre}
              onChange={handleGenreChange}
              disabled={optimizer.isAnalyzing}
            >
              {optimizer.availableGenres.map(g => (
                <option key={g.key} value={g.key}>
                  {g.name}
                  {g.key !== 'auto' && optimizer.detectedGenre?.genre === g.key && ' (detected)'}
                </option>
              ))}
            </select>
          </div>

          {/* Platform Selection */}
          <div className="control-group">
            <label>Platform:</label>
            <select
              value={optimizer.platform}
              onChange={handlePlatformChange}
              disabled={optimizer.isAnalyzing}
            >
              <option value="spotify">Spotify (-14 LUFS)</option>
              <option value="appleMusic">Apple Music (-16 LUFS)</option>
              <option value="youtube">YouTube (-14 LUFS)</option>
              <option value="soundcloud">SoundCloud (-14 LUFS)</option>
              <option value="broadcast">Broadcast (-23 LUFS)</option>
            </select>
          </div>

          {/* Suno Mode Toggle */}
          <div className="control-group suno-toggle">
            <label>
              <input
                type="checkbox"
                checked={optimizer.sunoMode}
                onChange={(e) => optimizer.setSunoMode(e.target.checked)}
              />
              Suno Mode
            </label>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {optimizer.isAnalyzing && (
        <div className="optimizer-loading">
          <div className="loading-spinner" />
          <span>Analyzing audio...</span>
        </div>
      )}

      {/* Error State */}
      {optimizer.error && (
        <div className="optimizer-error">
          <span className="error-icon">⚠️</span>
          <span>{optimizer.error}</span>
        </div>
      )}

      {/* Main Content */}
      {optimizer.hasResults && (
        <>
          {/* Tab Navigation */}
          <div className="optimizer-tabs">
            {tabs.map(tab => (
              <button
                key={tab.key}
                className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="optimizer-content">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="tab-content overview-tab">
                {/* Score Comparison */}
                <OptimizationComparisonView
                  currentMetrics={optimizer.optimizationResult?.currentMetrics}
                  targetMetrics={optimizer.optimizationResult?.targetMetrics}
                  scores={optimizer.optimizationResult?.scores}
                  genreName={optimizer.optimizationResult?.targetGenreName}
                />

                {/* Priority Actions */}
                <div className="priority-actions">
                  <h4>Priority Actions</h4>
                  {optimizer.priorityActions.length > 0 ? (
                    <div className="actions-list">
                      {optimizer.priorityActions.slice(0, 5).map((action, idx) => (
                        <div key={idx} className={`action-item priority-${action.order <= 2 ? 'high' : action.order <= 4 ? 'medium' : 'low'}`}>
                          <span className="action-number">{idx + 1}</span>
                          <div className="action-content">
                            <span className="action-category">{action.category}</span>
                            <span className="action-text">{action.action}</span>
                            {action.reason && (
                              <span className="action-reason">{action.reason}</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="no-actions">No priority actions needed. Audio is close to optimal.</p>
                  )}
                </div>

                {/* Genre Detection Info */}
                {optimizer.detectedGenre && (
                  <div className="genre-detection">
                    <h4>Genre Detection</h4>
                    <div className="detected-genre">
                      <span className="genre-name">{optimizer.detectedGenre.genreName}</span>
                      <span className="genre-confidence">{optimizer.detectedGenre.confidence}% confidence</span>
                    </div>
                    {optimizer.detectedGenre.alternates?.length > 0 && (
                      <div className="alternate-genres">
                        <span className="label">Also possible:</span>
                        {optimizer.detectedGenre.alternates.map((alt, idx) => (
                          <span key={idx} className="alt-genre">{alt.genreName} ({alt.score}%)</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* EQ Tab */}
            {activeTab === 'eq' && (
              <div className="tab-content eq-tab">
                <EQRecommendationChart
                  recommendations={optimizer.optimizationResult?.recommendations?.eq || []}
                  width={700}
                  height={280}
                />
              </div>
            )}

            {/* Dynamics Tab */}
            {activeTab === 'dynamics' && (
              <div className="tab-content dynamics-tab">
                <DynamicsPanel
                  compression={optimizer.optimizationResult?.recommendations?.compression}
                  limiter={optimizer.optimizationResult?.recommendations?.limiter}
                  multiband={optimizer.optimizationResult?.recommendations?.multiband}
                  genreName={optimizer.optimizationResult?.targetGenreName}
                />
              </div>
            )}

            {/* Effects Tab */}
            {activeTab === 'effects' && (
              <div className="tab-content effects-tab">
                <BPMEffectsPanel
                  bpm={detectedBpm}
                  onBpmChange={handleBpmChange}
                />
              </div>
            )}

            {/* Suno Mode Tab */}
            {activeTab === 'suno' && (
              <div className="tab-content suno-tab">
                <SunoModePanel
                  analysis={optimizer.sunoAnalysis}
                  isAnalyzing={false}
                  onAnalyze={handleSunoAnalyze}
                />
              </div>
            )}

            {/* Export Tab */}
            {activeTab === 'export' && (
              <div className="tab-content export-tab">
                <div className="export-section">
                  <h4>Export Optimization Report</h4>

                  <div className="export-options">
                    <div className="export-card" onClick={() => handleExport('json')}>
                      <span className="export-icon">📄</span>
                      <span className="export-title">JSON Export</span>
                      <span className="export-desc">Full data for programmatic use</span>
                    </div>

                    <div className="export-card" onClick={() => handleExport('pdf')}>
                      <span className="export-icon">📑</span>
                      <span className="export-title">PDF Report</span>
                      <span className="export-desc">Professional documentation</span>
                    </div>

                    <div className="export-card" onClick={() => handleExport('settings')}>
                      <span className="export-icon">🎛️</span>
                      <span className="export-title">DAW Settings</span>
                      <span className="export-desc">Compact settings JSON</span>
                    </div>

                    <div className="export-card" onClick={() => handleExport('copy')}>
                      <span className="export-icon">📋</span>
                      <span className="export-title">Copy to Clipboard</span>
                      <span className="export-desc">Quick copy for pasting</span>
                    </div>
                  </div>

                  {/* DAW Format Selection */}
                  <div className="daw-format-section">
                    <h5>DAW-Specific Format</h5>
                    <div className="daw-buttons">
                      <button
                        className="daw-btn"
                        onClick={() => {
                          const text = optimizer.getDAWSettings('ableton');
                          navigator.clipboard.writeText(text);
                        }}
                      >
                        Ableton Live
                      </button>
                      <button
                        className="daw-btn"
                        onClick={() => {
                          const text = optimizer.getDAWSettings('logic');
                          navigator.clipboard.writeText(text);
                        }}
                      >
                        Logic Pro
                      </button>
                      <button
                        className="daw-btn"
                        onClick={() => {
                          const text = optimizer.getDAWSettings('protools');
                          navigator.clipboard.writeText(text);
                        }}
                      >
                        Pro Tools
                      </button>
                      <button
                        className="daw-btn"
                        onClick={() => {
                          const text = optimizer.getDAWSettings('generic');
                          navigator.clipboard.writeText(text);
                        }}
                      >
                        Generic
                      </button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="settings-preview">
                    <h5>Settings Preview</h5>
                    <pre className="preview-code">
                      {optimizer.getDAWSettings('generic')}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AudioOptimizer;
