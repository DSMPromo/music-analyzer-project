import React from 'react';
import PropTypes from 'prop-types';
import { FREQUENCY_BANDS } from '../utils/analysisUtils';

/**
 * FrequencyPanel - Displays frequency band analysis
 * Shows energy distribution across 7 frequency bands
 */
function FrequencyPanel({ frequency }) {
  if (!frequency || !frequency.bands) {
    return (
      <div className="analysis-panel frequency-panel">
        <h3>Frequency</h3>
        <p className="no-data">No data available</p>
      </div>
    );
  }

  const { bands, tilt } = frequency;

  // Find max energy for normalization
  const maxEnergy = Math.max(...bands.map(b => b.energy), 0.01);

  // Determine tilt description
  const getTiltDescription = () => {
    if (Math.abs(tilt) < 3) return 'Balanced';
    if (tilt < -6) return 'Bass heavy';
    if (tilt < -3) return 'Warm';
    if (tilt > 6) return 'Bright/Harsh';
    if (tilt > 3) return 'Bright';
    return 'Balanced';
  };

  // Get tilt status class
  const getTiltStatus = () => {
    const absTilt = Math.abs(tilt);
    if (absTilt < 3) return 'good';
    if (absTilt < 6) return 'warning';
    return 'bad';
  };

  return (
    <div className="analysis-panel frequency-panel">
      <h3>Frequency</h3>

      {/* Frequency Band Chart */}
      <div className="frequency-chart">
        <div className="frequency-bars">
          {bands.map((band, idx) => (
            <div key={band.name} className="frequency-bar-container">
              <div className="frequency-bar-wrapper">
                <div
                  className="frequency-bar"
                  style={{
                    height: `${(band.energy / maxEnergy) * 100}%`,
                    backgroundColor: band.color || FREQUENCY_BANDS[idx]?.color || '#3B82F6'
                  }}
                />
              </div>
              <div className="frequency-bar-label">
                <span className="band-abbrev">{getAbbrev(band.name)}</span>
                <span className="band-percent">{Math.round(band.energy * 100)}%</span>
              </div>
            </div>
          ))}
        </div>

        {/* Y-axis labels */}
        <div className="frequency-y-axis">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
      </div>

      {/* Band Details */}
      <div className="frequency-details">
        {bands.map((band, idx) => (
          <div key={band.name} className="band-detail">
            <div
              className="band-color-dot"
              style={{ backgroundColor: band.color || FREQUENCY_BANDS[idx]?.color || '#3B82F6' }}
            />
            <span className="band-name">{band.name}</span>
            <span className="band-range">{band.low}-{band.high >= 1000 ? `${band.high/1000}k` : band.high} Hz</span>
            <span className="band-energy">{Math.round(band.energy * 100)}%</span>
          </div>
        ))}
      </div>

      {/* Frequency Tilt */}
      <div className="frequency-tilt">
        <div className="tilt-label">Frequency Balance</div>
        <div className="tilt-meter">
          <div className="tilt-scale">
            <span>Bass</span>
            <span>Balanced</span>
            <span>Bright</span>
          </div>
          <div className="tilt-bar">
            <div
              className={`tilt-indicator ${getTiltStatus()}`}
              style={{
                left: `${Math.min(100, Math.max(0, 50 + (tilt / 12) * 50))}%`
              }}
            />
            <div className="tilt-center-marker" />
          </div>
        </div>
        <div className={`tilt-value ${getTiltStatus()}`}>
          {getTiltDescription()} ({tilt >= 0 ? '+' : ''}{tilt.toFixed(1)} dB)
        </div>
      </div>
    </div>
  );
}

/**
 * Get abbreviated band name for mobile display
 */
function getAbbrev(name) {
  const abbrevs = {
    'Sub Bass': 'Sub',
    'Bass': 'Bass',
    'Low Mid': 'LM',
    'Mid': 'Mid',
    'High Mid': 'HM',
    'Presence': 'Pres',
    'Brilliance': 'Bril'
  };
  return abbrevs[name] || name.slice(0, 4);
}

FrequencyPanel.propTypes = {
  frequency: PropTypes.shape({
    bands: PropTypes.arrayOf(PropTypes.shape({
      name: PropTypes.string,
      low: PropTypes.number,
      high: PropTypes.number,
      energy: PropTypes.number,
      color: PropTypes.string
    })),
    tilt: PropTypes.number,
    rawData: PropTypes.instanceOf(Float32Array)
  })
};

export default FrequencyPanel;
