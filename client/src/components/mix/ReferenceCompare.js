/**
 * @module ReferenceCompare
 * @description React component for A/B reference track comparison
 *
 * Allows uploading a reference track and comparing frequency balance
 * against the main mix. Displays bar charts, difference views, and
 * EQ recommendations.
 *
 * @author Music Analyzer Team
 * @version 1.0.0
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';

/**
 * ReferenceCompare Component
 *
 * Upload and compare your mix against a professional reference track.
 * Shows frequency band comparison, difference view, and recommendations.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Object} [props.comparisonResults] - Comparison results from useMixAnalysis
 * @param {AudioBuffer} [props.referenceBuffer] - Loaded reference audio buffer
 * @param {number} [props.mainLoudness] - Main track LUFS value
 * @param {number} [props.referenceLoudness] - Reference track LUFS value
 * @param {function} props.onLoadReference - Callback to load reference file
 * @param {function} props.onClearReference - Callback to clear reference
 * @param {boolean} [props.isLoading=false] - True while loading reference
 * @returns {JSX.Element} Reference comparison component
 *
 * @example
 * <ReferenceCompare
 *   comparisonResults={comparisonResults}
 *   referenceBuffer={referenceBuffer}
 *   mainLoudness={analysisResults?.loudness?.integratedLUFS}
 *   onLoadReference={(file) => loadReferenceTrack(file)}
 *   onClearReference={() => clearReference()}
 * />
 */
function ReferenceCompare({
  comparisonResults,
  referenceBuffer,
  mainLoudness,
  referenceLoudness,
  onLoadReference,
  onClearReference,
  isLoading = false
}) {
  const fileInputRef = useRef(null);
  const [viewMode, setViewMode] = useState('bars'); // 'bars' or 'diff'

  // Handle file selection
  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file && onLoadReference) {
      onLoadReference(file);
    }
  }, [onLoadReference]);

  // Trigger file input
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Format frequency for display
  const formatFreq = (freq) => {
    if (freq >= 1000) {
      return `${(freq / 1000).toFixed(1)}k`;
    }
    return `${Math.round(freq)}`;
  };

  // Get color for difference
  const getDiffColor = (diff) => {
    if (Math.abs(diff) < 2) return '#10B981'; // matched
    if (diff > 0) return '#EF4444'; // louder
    return '#3B82F6'; // quieter
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'matched': return 'Matched';
      case 'louder': return 'Louder';
      case 'quieter': return 'Quieter';
      default: return '-';
    }
  };

  // Render upload state
  if (!referenceBuffer) {
    return (
      <div className="reference-compare">
        <div className="reference-header">
          <h3>Reference Comparison</h3>
        </div>
        <div className="reference-upload">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <button
            className="upload-reference-btn"
            onClick={handleUploadClick}
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Upload Reference Track'}
          </button>
          <p className="upload-hint">
            Compare your mix against a professional reference
          </p>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isLoading) {
    return (
      <div className="reference-compare">
        <div className="reference-header">
          <h3>Reference Comparison</h3>
        </div>
        <div className="reference-loading">
          <div className="spinner"></div>
          <p>Analyzing reference track...</p>
        </div>
      </div>
    );
  }

  // Render comparison results
  return (
    <div className="reference-compare">
      <div className="reference-header">
        <h3>Reference Comparison</h3>
        <div className="reference-controls">
          <button
            className={`view-btn ${viewMode === 'bars' ? 'active' : ''}`}
            onClick={() => setViewMode('bars')}
          >
            Bars
          </button>
          <button
            className={`view-btn ${viewMode === 'diff' ? 'active' : ''}`}
            onClick={() => setViewMode('diff')}
          >
            Difference
          </button>
          <button
            className="clear-btn"
            onClick={onClearReference}
          >
            Clear
          </button>
        </div>
      </div>

      {comparisonResults ? (
        <div className="reference-content">
          {viewMode === 'bars' ? (
            <BandComparisonBars bands={comparisonResults.bandComparison} />
          ) : (
            <DifferenceView bands={comparisonResults.bandComparison} />
          )}

          {/* Overall difference */}
          <div className="overall-diff">
            <span className="diff-label">Overall Difference:</span>
            <span className={`diff-value ${comparisonResults.overallDifference < 3 ? 'good' : 'warning'}`}>
              {comparisonResults.overallDifference.toFixed(1)} dB
            </span>
          </div>

          {/* Recommendations */}
          {comparisonResults.recommendations?.length > 0 && (
            <div className="comparison-recommendations">
              <h4>Recommendations</h4>
              <ul className="rec-list">
                {comparisonResults.recommendations.map((rec, idx) => (
                  <li key={idx} className={`rec-item ${rec.type}`}>
                    <span className="rec-icon">
                      {rec.type === 'boost' ? '+' : '-'}
                    </span>
                    <span className="rec-message">{rec.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* LUFS comparison (if available) */}
          {mainLoudness && referenceLoudness && (
            <div className="lufs-comparison">
              <h4>Loudness Comparison</h4>
              <div className="lufs-row">
                <div className="lufs-item">
                  <span className="lufs-label">Your Mix</span>
                  <span className="lufs-value">{mainLoudness.toFixed(1)} LUFS</span>
                </div>
                <div className="lufs-item">
                  <span className="lufs-label">Reference</span>
                  <span className="lufs-value">{referenceLoudness.toFixed(1)} LUFS</span>
                </div>
                <div className="lufs-item diff">
                  <span className="lufs-label">Difference</span>
                  <span className={`lufs-value ${Math.abs(mainLoudness - referenceLoudness) < 1 ? 'good' : 'warning'}`}>
                    {(mainLoudness - referenceLoudness) > 0 ? '+' : ''}
                    {(mainLoudness - referenceLoudness).toFixed(1)} dB
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="no-comparison">
          <p>Generate a spectrogram to compare with reference</p>
        </div>
      )}
    </div>
  );
}

/**
 * Band comparison bar chart component
 *
 * Displays side-by-side bars for each frequency band showing
 * the main mix vs reference levels.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.bands - Band comparison data array
 * @returns {JSX.Element|null} Bar chart or null if no data
 * @private
 */
function BandComparisonBars({ bands }) {
  if (!bands?.length) return null;

  const maxDb = Math.max(...bands.flatMap(b => [Math.abs(b.mainDb), Math.abs(b.referenceDb)]));
  const scale = 100 / (maxDb || 1);

  return (
    <div className="band-comparison-bars">
      <div className="bars-legend">
        <span className="legend-your">Your Mix</span>
        <span className="legend-ref">Reference</span>
      </div>
      <div className="bars-chart">
        {bands.map((band, idx) => (
          <div key={idx} className="band-column">
            <div className="band-bars">
              <div
                className="bar main"
                style={{ height: `${Math.max(5, (band.mainDb + 60) * scale * 0.8)}%` }}
                title={`Your mix: ${band.mainDb.toFixed(1)}dB`}
              />
              <div
                className="bar reference"
                style={{ height: `${Math.max(5, (band.referenceDb + 60) * scale * 0.8)}%` }}
                title={`Reference: ${band.referenceDb.toFixed(1)}dB`}
              />
            </div>
            <div className="band-label">{band.name}</div>
            <div className={`band-diff ${band.status}`}>
              {band.difference > 0 ? '+' : ''}{band.difference.toFixed(1)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Difference view showing frequency balance deltas
 *
 * Displays a centered chart where bars extend up (louder than reference)
 * or down (quieter than reference) from the zero line.
 *
 * @component
 * @param {Object} props - Component props
 * @param {Array} props.bands - Band comparison data array
 * @returns {JSX.Element|null} Difference chart or null if no data
 * @private
 */
function DifferenceView({ bands }) {
  if (!bands?.length) return null;

  const maxDiff = Math.max(...bands.map(b => Math.abs(b.difference)));
  const scale = 40 / Math.max(maxDiff, 6);

  return (
    <div className="difference-view">
      <div className="diff-axis">
        <span className="axis-label louder">Louder</span>
        <span className="axis-center">0 dB</span>
        <span className="axis-label quieter">Quieter</span>
      </div>
      <div className="diff-chart">
        {bands.map((band, idx) => {
          const barHeight = Math.abs(band.difference) * scale;
          const isLouder = band.difference > 0;

          return (
            <div key={idx} className="diff-column">
              <div className="diff-bar-container">
                <div className="diff-bar-area upper">
                  {isLouder && (
                    <div
                      className="diff-bar louder"
                      style={{ height: `${barHeight}%` }}
                    />
                  )}
                </div>
                <div className="diff-center-line" />
                <div className="diff-bar-area lower">
                  {!isLouder && band.difference !== 0 && (
                    <div
                      className="diff-bar quieter"
                      style={{ height: `${barHeight}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="diff-label">{band.name}</div>
              <div className={`diff-value ${band.status}`}>
                {band.difference > 0 ? '+' : ''}{band.difference.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReferenceCompare;
