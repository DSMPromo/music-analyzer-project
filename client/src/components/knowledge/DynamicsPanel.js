import React from 'react';

/**
 * DynamicsPanel - Compression, limiting, and multi-band recommendations
 */
function DynamicsPanel({
  compression = null,
  limiter = null,
  multiband = [],
  genreName = ''
}) {
  return (
    <div className="dynamics-panel">
      {/* Compression Section */}
      <div className="dynamics-section compression-section">
        <h4>Master Bus Compression</h4>

        {compression ? (
          <>
            <div className="dynamics-meter">
              <CompressionMeter
                threshold={compression.threshold}
                ratio={compression.ratio}
              />
            </div>

            <div className="settings-grid">
              <SettingCard
                label="Threshold"
                value={`${compression.threshold} dB`}
                icon="⬇️"
              />
              <SettingCard
                label="Ratio"
                value={`${compression.ratio}:1`}
                icon="📊"
              />
              <SettingCard
                label="Attack"
                value={`${compression.attack} ms`}
                icon="⚡"
              />
              <SettingCard
                label="Release"
                value={`${compression.release} ms`}
                icon="↩️"
              />
              <SettingCard
                label="Makeup"
                value={`+${compression.makeupGain || 0} dB`}
                icon="🔊"
              />
              <SettingCard
                label="Knee"
                value={`${compression.knee || 3} dB`}
                icon="📐"
              />
            </div>

            {/* Status */}
            <div className={`compression-status status-${compression.adjustment}`}>
              {compression.adjustment === 'increase' && (
                <span className="status-icon">↑</span>
              )}
              {compression.adjustment === 'decrease' && (
                <span className="status-icon">↓</span>
              )}
              {compression.adjustment === 'none' && (
                <span className="status-icon">✓</span>
              )}
              <span className="status-text">{compression.note}</span>
            </div>

            {/* Dynamic Range Comparison */}
            <div className="dr-comparison">
              <div className="dr-bar">
                <div
                  className="dr-fill current"
                  style={{ width: `${Math.min(100, (compression.currentDynamicRange / 20) * 100)}%` }}
                  title={`Current: ${compression.currentDynamicRange?.toFixed(1)}dB`}
                />
                <div
                  className="dr-marker target"
                  style={{ left: `${(compression.targetDynamicRange / 20) * 100}%` }}
                  title={`Target: ${compression.targetDynamicRange?.toFixed(1)}dB`}
                />
              </div>
              <div className="dr-labels">
                <span>Current: {compression.currentDynamicRange?.toFixed(1)}dB</span>
                <span>Target: {compression.targetDynamicRange?.toFixed(1)}dB</span>
              </div>
            </div>
          </>
        ) : (
          <div className="no-data">No compression data available</div>
        )}
      </div>

      {/* Multi-band Compression */}
      <div className="dynamics-section multiband-section">
        <h4>Multi-band Compression</h4>

        {multiband && multiband.length > 0 ? (
          <div className="multiband-grid">
            {multiband.map((band, idx) => (
              <div key={idx} className="multiband-card">
                <div className="band-header">
                  <span className="band-name">{band.name}</span>
                  <span className="band-range">
                    {formatFreq(band.range[0])} - {formatFreq(band.range[1])}
                  </span>
                </div>
                <div className="band-settings">
                  <div className="band-setting">
                    <span className="setting-label">Threshold</span>
                    <span className="setting-value">{band.threshold}dB</span>
                  </div>
                  <div className="band-setting">
                    <span className="setting-label">Ratio</span>
                    <span className="setting-value">{band.ratio}:1</span>
                  </div>
                  <div className="band-setting">
                    <span className="setting-label">Attack</span>
                    <span className="setting-value">{band.attack}ms</span>
                  </div>
                  <div className="band-setting">
                    <span className="setting-label">Release</span>
                    <span className="setting-value">{band.release}ms</span>
                  </div>
                </div>
                <div className="band-note">{band.note}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-data">No multi-band data available</div>
        )}
      </div>

      {/* Limiter Section */}
      <div className="dynamics-section limiter-section">
        <h4>Limiter Settings</h4>

        {limiter ? (
          <>
            <div className="limiter-visual">
              <LimiterMeter
                threshold={limiter.threshold}
                ceiling={limiter.ceiling}
                gain={limiter.gainToApply}
              />
            </div>

            <div className="settings-grid limiter-grid">
              <SettingCard
                label="Threshold"
                value={`${limiter.threshold} dBFS`}
                icon="🎯"
              />
              <SettingCard
                label="Ceiling"
                value={`${limiter.ceiling} dBFS`}
                icon="📏"
              />
              <SettingCard
                label="Release"
                value={`${limiter.release} ms`}
                icon="↩️"
              />
              <SettingCard
                label="Lookahead"
                value={`${limiter.lookahead || 5} ms`}
                icon="👁️"
              />
            </div>

            {/* Gain Recommendation */}
            {limiter.gainToApply > 0 && (
              <div className="gain-recommendation">
                <div className="gain-header">
                  <span className="gain-icon">🔊</span>
                  <span className="gain-label">Pre-Limiter Gain</span>
                </div>
                <div className="gain-value">+{limiter.gainToApply.toFixed(1)} dB</div>
                <div className="gain-note">{limiter.note}</div>
              </div>
            )}

            {/* LUFS Target */}
            <div className="lufs-target">
              <div className="lufs-row">
                <span className="lufs-label">Current</span>
                <span className="lufs-value">{limiter.currentLUFS?.toFixed(1)} LUFS</span>
              </div>
              <div className="lufs-arrow">→</div>
              <div className="lufs-row">
                <span className="lufs-label">Target</span>
                <span className="lufs-value">{limiter.targetLUFS?.toFixed(1)} LUFS</span>
              </div>
            </div>
          </>
        ) : (
          <div className="no-data">No limiter data available</div>
        )}
      </div>

      {/* Quick Copy Section */}
      <div className="quick-copy-section">
        <h4>Quick Copy</h4>
        <div className="copy-buttons">
          <CopyButton
            label="Compression"
            data={compression ? formatCompressionForCopy(compression) : ''}
            disabled={!compression}
          />
          <CopyButton
            label="Limiter"
            data={limiter ? formatLimiterForCopy(limiter) : ''}
            disabled={!limiter}
          />
          <CopyButton
            label="All Settings"
            data={formatAllForCopy(compression, limiter, multiband)}
            disabled={!compression && !limiter}
          />
        </div>
      </div>
    </div>
  );
}

// Setting Card Component
function SettingCard({ label, value, icon }) {
  return (
    <div className="setting-card">
      <span className="setting-icon">{icon}</span>
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
    </div>
  );
}

// Compression Meter Visualization
function CompressionMeter({ threshold, ratio }) {
  const thresholdPos = Math.max(0, Math.min(100, ((threshold + 20) / 20) * 100));

  return (
    <div className="compression-meter">
      <div className="meter-bg">
        <div className="meter-threshold" style={{ left: `${thresholdPos}%` }}>
          <div className="threshold-line" />
          <span className="threshold-label">{threshold}dB</span>
        </div>
        <div className="meter-gradient" />
      </div>
      <div className="meter-scale">
        <span>-20dB</span>
        <span>-10dB</span>
        <span>0dB</span>
      </div>
      <div className="ratio-display">
        <span className="ratio-label">Ratio</span>
        <span className="ratio-value">{ratio}:1</span>
      </div>
    </div>
  );
}

// Limiter Meter Visualization
function LimiterMeter({ threshold, ceiling, gain = 0 }) {
  return (
    <div className="limiter-meter">
      <div className="meter-column">
        <div className="meter-bar">
          <div
            className="meter-fill"
            style={{ height: `${Math.max(0, 100 + ceiling * 5)}%` }}
          />
          <div
            className="ceiling-line"
            style={{ bottom: `${Math.max(0, 100 + ceiling * 5)}%` }}
          />
        </div>
        <span className="meter-label">Ceiling</span>
        <span className="meter-value">{ceiling}dBFS</span>
      </div>
      {gain > 0 && (
        <div className="gain-indicator">
          <span className="gain-arrow">↑</span>
          <span className="gain-amount">+{gain.toFixed(1)}dB</span>
        </div>
      )}
    </div>
  );
}

// Copy Button Component
function CopyButton({ label, data, disabled }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    if (disabled || !data) return;

    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  return (
    <button
      className={`copy-btn ${copied ? 'copied' : ''}`}
      onClick={handleCopy}
      disabled={disabled}
    >
      {copied ? '✓ Copied' : `Copy ${label}`}
    </button>
  );
}

// Formatters
function formatFreq(freq) {
  if (freq >= 1000) return `${(freq / 1000).toFixed(1)}k`;
  return `${freq}Hz`;
}

function formatCompressionForCopy(comp) {
  return `Threshold: ${comp.threshold}dB | Ratio: ${comp.ratio}:1 | Attack: ${comp.attack}ms | Release: ${comp.release}ms | Makeup: ${comp.makeupGain || 0}dB`;
}

function formatLimiterForCopy(lim) {
  return `Ceiling: ${lim.ceiling}dBFS | Release: ${lim.release}ms | Gain: +${lim.gainToApply?.toFixed(1) || 0}dB`;
}

function formatAllForCopy(comp, lim, multi) {
  let text = '=== Dynamics Settings ===\n\n';

  if (comp) {
    text += '--- Compression ---\n';
    text += `Threshold: ${comp.threshold}dB\n`;
    text += `Ratio: ${comp.ratio}:1\n`;
    text += `Attack: ${comp.attack}ms\n`;
    text += `Release: ${comp.release}ms\n`;
    text += `Makeup: ${comp.makeupGain || 0}dB\n\n`;
  }

  if (lim) {
    text += '--- Limiter ---\n';
    text += `Ceiling: ${lim.ceiling}dBFS\n`;
    text += `Release: ${lim.release}ms\n`;
    text += `Pre-Gain: +${lim.gainToApply?.toFixed(1) || 0}dB\n`;
  }

  return text;
}

export default DynamicsPanel;
