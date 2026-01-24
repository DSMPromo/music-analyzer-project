import React, { useState, useMemo } from 'react';
import {
  generateDelayTable,
  getDelayRecommendations,
  getReverbRecommendations,
  getPanningRecommendations,
  formatMs,
  panToLR,
  panToClock
} from '../../utils/bpmSyncUtils';

/**
 * BPMEffectsPanel - BPM-synced delay, reverb, and panning calculator
 */
function BPMEffectsPanel({ bpm: initialBpm = 120, onBpmChange }) {
  const [bpm, setBpm] = useState(initialBpm);
  const [activeTab, setActiveTab] = useState('delay'); // 'delay', 'reverb', 'panning'

  // Compute synced values
  const delayTable = useMemo(() => generateDelayTable(bpm), [bpm]);
  const delayRecommendations = useMemo(() => getDelayRecommendations(bpm), [bpm]);
  const reverbRecommendations = useMemo(() => getReverbRecommendations(bpm), [bpm]);
  const panningRecommendations = useMemo(() => getPanningRecommendations(), []);

  // Handle BPM change
  const handleBpmChange = (newBpm) => {
    const value = Math.max(20, Math.min(300, newBpm));
    setBpm(value);
    if (onBpmChange) onBpmChange(value);
  };

  // Quarter note reference
  const quarterNoteMs = Math.round(60000 / bpm);

  return (
    <div className="bpm-effects-panel">
      {/* BPM Input */}
      <div className="bpm-input-section">
        <label>BPM</label>
        <div className="bpm-controls">
          <button onClick={() => handleBpmChange(bpm - 1)}>-</button>
          <input
            type="number"
            value={bpm}
            onChange={(e) => handleBpmChange(parseInt(e.target.value) || 120)}
            min="20"
            max="300"
          />
          <button onClick={() => handleBpmChange(bpm + 1)}>+</button>
        </div>
        <span className="quarter-note-ref">1/4 note = {quarterNoteMs}ms</span>
      </div>

      {/* Tab Navigation */}
      <div className="effects-tabs">
        <button
          className={`tab-btn ${activeTab === 'delay' ? 'active' : ''}`}
          onClick={() => setActiveTab('delay')}
        >
          Delay
        </button>
        <button
          className={`tab-btn ${activeTab === 'reverb' ? 'active' : ''}`}
          onClick={() => setActiveTab('reverb')}
        >
          Reverb
        </button>
        <button
          className={`tab-btn ${activeTab === 'panning' ? 'active' : ''}`}
          onClick={() => setActiveTab('panning')}
        >
          Panning
        </button>
      </div>

      {/* Delay Tab */}
      {activeTab === 'delay' && (
        <div className="delay-section">
          {/* Delay Time Table */}
          <div className="delay-table">
            <h4>Delay Time Chart</h4>
            <table>
              <thead>
                <tr>
                  <th>Note</th>
                  <th>Straight</th>
                  <th>Dotted</th>
                  <th>Triplet</th>
                </tr>
              </thead>
              <tbody>
                {delayTable.map((row) => (
                  <tr key={row.noteValue}>
                    <td className="note-value">{row.noteValue}</td>
                    <td>
                      <CopyableValue value={row.times.straight} />
                    </td>
                    <td>
                      <CopyableValue value={row.times.dotted} />
                    </td>
                    <td>
                      <CopyableValue value={row.times.triplet} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Delay Use Cases */}
          <div className="delay-presets">
            <h4>Delay Presets</h4>
            {Object.entries(delayRecommendations).map(([key, preset]) => (
              <div key={key} className="preset-card">
                <div className="preset-header">
                  <span className="preset-name">{formatPresetName(key)}</span>
                  <span className="preset-time">{formatMs(preset.delay)}</span>
                </div>
                <div className="preset-details">
                  <span className="preset-note">{preset.note}</span>
                </div>
                <div className="preset-settings">
                  <span>Feedback: {preset.feedback}</span>
                  <span>Mix: {preset.mix}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reverb Tab */}
      {activeTab === 'reverb' && (
        <div className="reverb-section">
          <h4>Reverb Settings by Element</h4>
          <div className="reverb-grid">
            {Object.entries(reverbRecommendations).map(([key, settings]) => (
              <div key={key} className="reverb-card">
                <div className="reverb-header">
                  <span className="reverb-element">{formatPresetName(key)}</span>
                </div>
                <div className="reverb-settings">
                  <div className="reverb-row">
                    <span className="label">Pre-delay:</span>
                    <span className="value">{formatMs(settings.preDelay)}</span>
                  </div>
                  <div className="reverb-row">
                    <span className="label">Decay:</span>
                    <span className="value">{settings.decayTime}</span>
                  </div>
                  <div className="reverb-row">
                    <span className="label">Size:</span>
                    <span className="value">{settings.size}</span>
                  </div>
                  <div className="reverb-row">
                    <span className="label">Mix:</span>
                    <span className="value">{settings.mix}</span>
                  </div>
                  <div className="reverb-row filters">
                    <span>HPF: {settings.lowCut}</span>
                    <span>LPF: {settings.highCut}</span>
                  </div>
                </div>
                <div className="reverb-note">
                  {settings.note}
                </div>
                <div className="reverb-note-hint">
                  {settings.preDelayNote}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panning Tab */}
      {activeTab === 'panning' && (
        <div className="panning-section">
          <h4>Panning Recommendations</h4>

          {/* Panning Visualization */}
          <div className="panning-visual">
            <svg viewBox="0 0 300 100" className="panning-diagram">
              {/* Center line */}
              <line x1="150" y1="10" x2="150" y2="90" stroke="#4a5568" strokeWidth="2" />

              {/* Scale markers */}
              {[-100, -50, 0, 50, 100].map(pos => {
                const x = 150 + (pos / 100) * 140;
                return (
                  <g key={pos}>
                    <line x1={x} y1="85" x2={x} y2="95" stroke="#718096" />
                    <text x={x} y="78" fill="#a0aec0" fontSize="8" textAnchor="middle">
                      {pos === 0 ? 'C' : pos < 0 ? `L${Math.abs(pos)}` : `R${pos}`}
                    </text>
                  </g>
                );
              })}

              {/* Instrument markers */}
              <PanMarker x={150} y={20} label="Kick" color="#ef4444" />
              <PanMarker x={150} y={30} label="Bass" color="#3b82f6" />
              <PanMarker x={150} y={40} label="Vocal" color="#10b981" />
              <PanMarker x={185} y={25} label="HiHat" color="#f59e0b" />
              <PanMarker x={115} y={35} label="Keys" color="#8b5cf6" />
              <PanMarker x={50} y={50} label="Gtr L" color="#ec4899" />
              <PanMarker x={250} y={50} label="Gtr R" color="#ec4899" />
              <PanMarker x={70} y={60} label="Pad L" color="#06b6d4" />
              <PanMarker x={230} y={60} label="Pad R" color="#06b6d4" />
            </svg>
          </div>

          {/* Panning Reference */}
          <div className="panning-reference">
            <div className="panning-categories">
              <div className="panning-category">
                <h5>Always Centered (12h)</h5>
                <ul>
                  {['kick', 'bass', 'leadVocal', 'snareCenter'].map(key => {
                    const rec = panningRecommendations[key];
                    if (!rec) return null;
                    return (
                      <li key={key}>
                        <span className="element-name">{formatPresetName(key)}</span>
                        <span className="pan-value">{rec.lr}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="panning-category">
                <h5>Slight Pan (11h-1h)</h5>
                <ul>
                  {['hiHat', 'ride'].map(key => {
                    const rec = panningRecommendations[key];
                    if (!rec) return null;
                    return (
                      <li key={key}>
                        <span className="element-name">{formatPresetName(key)}</span>
                        <span className="pan-value">{rec.lr} ({rec.clock})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="panning-category">
                <h5>Moderate Pan (10h-2h)</h5>
                <ul>
                  {['acousticGuitarL', 'acousticGuitarR', 'keys'].map(key => {
                    const rec = panningRecommendations[key];
                    if (!rec) return null;
                    return (
                      <li key={key}>
                        <span className="element-name">{formatPresetName(key)}</span>
                        <span className="pan-value">{rec.lr} ({rec.clock})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="panning-category">
                <h5>Wide Pan (9h-3h)</h5>
                <ul>
                  {['electricGuitarL', 'electricGuitarR', 'overheadsL', 'overheadsR'].map(key => {
                    const rec = panningRecommendations[key];
                    if (!rec) return null;
                    return (
                      <li key={key}>
                        <span className="element-name">{formatPresetName(key)}</span>
                        <span className="pan-value">{rec.lr} ({rec.clock})</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>

          {/* Clock Notation Reference */}
          <div className="clock-reference">
            <h5>Clock Notation Reference</h5>
            <div className="clock-grid">
              <span>9h = L100 (Hard Left)</span>
              <span>10h = L65</span>
              <span>11h = L35</span>
              <span>12h = Center</span>
              <span>1h = R35</span>
              <span>2h = R65</span>
              <span>3h = R100 (Hard Right)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Copyable value component
function CopyableValue({ value }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(Math.round(value).toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 1000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <span
      className={`copyable-value ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      title="Click to copy"
    >
      {formatMs(value)}
    </span>
  );
}

// Panning marker for SVG
function PanMarker({ x, y, label, color }) {
  return (
    <g>
      <circle cx={x} cy={y} r="4" fill={color} />
      <text x={x} y={y + 12} fill="#a0aec0" fontSize="7" textAnchor="middle">{label}</text>
    </g>
  );
}

// Format preset key to display name
function formatPresetName(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace(/([LR])$/, ' $1');
}

export default BPMEffectsPanel;
