import React from 'react';
import PropTypes from 'prop-types';
import { formatDb, formatLUFS, PLATFORM_TARGETS } from '../../utils/analysisUtils';

/**
 * LoudnessPanel - Displays loudness analysis metrics
 * Peak, RMS, Dynamic Range, Crest Factor, and LUFS
 */
function LoudnessPanel({ loudness, targetPlatform }) {
  if (!loudness) {
    return (
      <div className="analysis-panel loudness-panel">
        <h3>Loudness</h3>
        <p className="no-data">No data available</p>
      </div>
    );
  }

  const { peakDb, rmsDb, dynamicRange, crestFactor, lufs } = loudness;
  const target = PLATFORM_TARGETS[targetPlatform] || PLATFORM_TARGETS.spotify;
  const lufsDiff = lufs - target.lufs;

  // Determine LUFS status
  const getLufsStatus = () => {
    const diff = Math.abs(lufsDiff);
    if (diff <= 1) return 'good';
    if (diff <= 3) return 'warning';
    return 'bad';
  };

  // Determine peak status
  const getPeakStatus = () => {
    if (peakDb > target.ceiling) return 'bad';
    if (peakDb > target.ceiling - 0.5) return 'warning';
    return 'good';
  };

  return (
    <div className="analysis-panel loudness-panel">
      <h3>Loudness</h3>

      <div className="metric-grid">
        {/* Peak Level */}
        <div className="metric-item">
          <div className="metric-label">Peak</div>
          <div className={`metric-value ${getPeakStatus()}`}>
            {formatDb(peakDb)}
          </div>
          <div className="metric-bar">
            <div
              className={`metric-bar-fill ${getPeakStatus()}`}
              style={{ width: `${Math.min(100, Math.max(0, (peakDb + 60) / 60 * 100))}%` }}
            />
          </div>
          <div className="metric-scale">
            <span>-60</span>
            <span>-30</span>
            <span>0 dBFS</span>
          </div>
        </div>

        {/* RMS Level */}
        <div className="metric-item">
          <div className="metric-label">RMS Level</div>
          <div className="metric-value">
            {formatDb(rmsDb)}
          </div>
          <div className="metric-bar">
            <div
              className="metric-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, (rmsDb + 60) / 60 * 100))}%` }}
            />
          </div>
          <div className="metric-scale">
            <span>-60</span>
            <span>-30</span>
            <span>0 dBFS</span>
          </div>
        </div>

        {/* LUFS */}
        <div className="metric-item lufs-metric">
          <div className="metric-label">Integrated LUFS</div>
          <div className={`metric-value large ${getLufsStatus()}`}>
            {formatLUFS(lufs)}
          </div>
          <div className="metric-bar lufs-bar">
            <div
              className={`metric-bar-fill ${getLufsStatus()}`}
              style={{ width: `${Math.min(100, Math.max(0, (lufs + 30) / 30 * 100))}%` }}
            />
            {/* Target indicator */}
            <div
              className="lufs-target-marker"
              style={{ left: `${Math.min(100, Math.max(0, (target.lufs + 30) / 30 * 100))}%` }}
              title={`${target.name} target: ${target.lufs} LUFS`}
            />
          </div>
          <div className="metric-scale">
            <span>-30</span>
            <span>-20</span>
            <span>-10</span>
            <span>0 LUFS</span>
          </div>
          {Math.abs(lufsDiff) > 0.5 && (
            <div className={`lufs-diff ${getLufsStatus()}`}>
              {lufsDiff > 0 ? '+' : ''}{lufsDiff.toFixed(1)} LUFS vs {target.name} target
            </div>
          )}
        </div>

        {/* Dynamic Range */}
        <div className="metric-item compact">
          <div className="metric-label">Dynamic Range</div>
          <div className="metric-value">
            {dynamicRange.toFixed(1)} dB
          </div>
          <div className="metric-subtext">
            {dynamicRange < 6 ? 'Heavily compressed' :
             dynamicRange < 10 ? 'Moderately compressed' :
             dynamicRange < 14 ? 'Good dynamics' : 'Very dynamic'}
          </div>
        </div>

        {/* Crest Factor */}
        <div className="metric-item compact">
          <div className="metric-label">Crest Factor</div>
          <div className="metric-value">
            {crestFactor.toFixed(1)} dB
          </div>
          <div className="metric-subtext">
            Peak to RMS ratio
          </div>
        </div>
      </div>
    </div>
  );
}

LoudnessPanel.propTypes = {
  loudness: PropTypes.shape({
    peak: PropTypes.number,
    peakDb: PropTypes.number,
    rms: PropTypes.number,
    rmsDb: PropTypes.number,
    dynamicRange: PropTypes.number,
    crestFactor: PropTypes.number,
    lufs: PropTypes.number
  }),
  targetPlatform: PropTypes.string
};

LoudnessPanel.defaultProps = {
  targetPlatform: 'spotify'
};

export default LoudnessPanel;
