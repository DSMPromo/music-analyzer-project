import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { formatDb } from '../../utils/analysisUtils';

/**
 * StereoPanel - Displays stereo analysis metrics
 * Stereo width, phase correlation, channel balance, and vectorscope
 */
function StereoPanel({ stereo, leftChannel, rightChannel }) {
  const vectorscopeRef = useRef(null);

  // Draw vectorscope visualization
  useEffect(() => {
    if (!vectorscopeRef.current || !leftChannel || !rightChannel) return;

    const canvas = vectorscopeRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    // Clear canvas
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;

    // Diagonal lines (L-R axis and M-S axis)
    ctx.beginPath();
    ctx.moveTo(0, height);
    ctx.lineTo(width, 0);
    ctx.moveTo(0, 0);
    ctx.lineTo(width, height);
    ctx.stroke();

    // Center cross
    ctx.beginPath();
    ctx.moveTo(centerX, 0);
    ctx.lineTo(centerX, height);
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // Draw labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px monospace';
    ctx.fillText('L', 5, centerY - 5);
    ctx.fillText('R', width - 15, centerY - 5);
    ctx.fillText('M', centerX + 5, 12);
    ctx.fillText('+S', centerX + 5, height - 5);

    // Plot samples (downsample for performance)
    const sampleStep = Math.max(1, Math.floor(leftChannel.length / 5000));
    ctx.fillStyle = 'rgba(233, 69, 96, 0.3)';

    for (let i = 0; i < leftChannel.length; i += sampleStep) {
      const l = leftChannel[i];
      const r = rightChannel[i];

      // Convert L/R to X/Y (rotated 45 degrees for vectorscope)
      // X = (L - R) / sqrt(2), Y = (L + R) / sqrt(2)
      const x = centerX + ((r - l) / Math.SQRT2) * (width / 2) * 0.9;
      const y = centerY - ((l + r) / Math.SQRT2) * (height / 2) * 0.9;

      ctx.fillRect(x, y, 2, 2);
    }

    // Draw outer boundary circle
    ctx.strokeStyle = '#374151';
    ctx.beginPath();
    ctx.arc(centerX, centerY, Math.min(width, height) / 2 - 10, 0, Math.PI * 2);
    ctx.stroke();

  }, [leftChannel, rightChannel]);

  if (!stereo) {
    return (
      <div className="analysis-panel stereo-panel">
        <h3>Stereo</h3>
        <p className="no-data">No data available</p>
      </div>
    );
  }

  const { width: stereoWidth, phaseCorrelation, balance, isMono } = stereo;

  // Get phase correlation status
  const getPhaseStatus = () => {
    if (phaseCorrelation < 0) return 'bad';
    if (phaseCorrelation < 0.3) return 'warning';
    return 'good';
  };

  // Get balance status
  const getBalanceStatus = () => {
    const absBalance = Math.abs(balance);
    if (absBalance > 3) return 'warning';
    if (absBalance > 6) return 'bad';
    return 'good';
  };

  // Get width status
  const getWidthStatus = () => {
    if (stereoWidth > 150) return 'bad';
    if (stereoWidth > 95) return 'warning';
    return 'good';
  };

  return (
    <div className="analysis-panel stereo-panel">
      <h3>Stereo</h3>

      {isMono ? (
        <div className="mono-indicator">
          <span className="mono-badge">MONO</span>
          <span className="mono-text">Single channel or identical L/R</span>
        </div>
      ) : (
        <div className="stereo-content">
          {/* Stereo Width Meter */}
          <div className="metric-item">
            <div className="metric-label">Stereo Width</div>
            <div className={`metric-value ${getWidthStatus()}`}>
              {Math.round(stereoWidth)}%
            </div>
            <div className="stereo-width-meter">
              <div className="width-meter-bg">
                <div
                  className={`width-meter-fill ${getWidthStatus()}`}
                  style={{ width: `${Math.min(100, stereoWidth)}%` }}
                />
                {stereoWidth > 100 && (
                  <div
                    className="width-meter-overflow"
                    style={{ width: `${Math.min(100, stereoWidth - 100)}%` }}
                  />
                )}
              </div>
              <div className="width-meter-labels">
                <span>Mono</span>
                <span>Wide</span>
                <span>Out of Phase</span>
              </div>
            </div>
          </div>

          {/* Phase Correlation Meter */}
          <div className="metric-item">
            <div className="metric-label">Phase Correlation</div>
            <div className={`metric-value ${getPhaseStatus()}`}>
              {phaseCorrelation.toFixed(2)}
            </div>
            <div className="phase-meter">
              <div className="phase-meter-bg">
                <div
                  className={`phase-meter-fill ${getPhaseStatus()}`}
                  style={{
                    width: `${Math.abs(phaseCorrelation) * 50}%`,
                    left: phaseCorrelation >= 0 ? '50%' : `${50 - Math.abs(phaseCorrelation) * 50}%`
                  }}
                />
                <div className="phase-meter-center" />
              </div>
              <div className="phase-meter-labels">
                <span className="bad">-1</span>
                <span>0</span>
                <span className="good">+1</span>
              </div>
            </div>
            <div className="metric-subtext">
              {phaseCorrelation < 0 ? 'Out of phase - may cancel in mono!' :
               phaseCorrelation < 0.3 ? 'Wide stereo - check mono compatibility' :
               phaseCorrelation > 0.9 ? 'Very correlated (near mono)' : 'Good mono compatibility'}
            </div>
          </div>

          {/* Channel Balance */}
          <div className="metric-item">
            <div className="metric-label">Channel Balance</div>
            <div className={`metric-value ${getBalanceStatus()}`}>
              {formatDb(balance)}
            </div>
            <div className="balance-meter">
              <div className="balance-meter-bg">
                <div
                  className={`balance-meter-fill ${getBalanceStatus()}`}
                  style={{
                    width: `${Math.min(50, Math.abs(balance) / 12 * 50)}%`,
                    left: balance >= 0 ? '50%' : `${50 - Math.abs(balance) / 12 * 50}%`
                  }}
                />
                <div className="balance-meter-center" />
              </div>
              <div className="balance-meter-labels">
                <span>L</span>
                <span>C</span>
                <span>R</span>
              </div>
            </div>
            <div className="metric-subtext">
              {Math.abs(balance) < 0.5 ? 'Centered' :
               balance < 0 ? `Left heavy by ${Math.abs(balance).toFixed(1)} dB` :
               `Right heavy by ${balance.toFixed(1)} dB`}
            </div>
          </div>

          {/* Vectorscope */}
          <div className="vectorscope-container">
            <div className="vectorscope-label">Vectorscope</div>
            <canvas
              ref={vectorscopeRef}
              width={150}
              height={150}
              className="vectorscope-canvas"
            />
          </div>
        </div>
      )}
    </div>
  );
}

StereoPanel.propTypes = {
  stereo: PropTypes.shape({
    width: PropTypes.number,
    phaseCorrelation: PropTypes.number,
    balance: PropTypes.number,
    isMono: PropTypes.bool
  }),
  leftChannel: PropTypes.instanceOf(Float32Array),
  rightChannel: PropTypes.instanceOf(Float32Array)
};

export default StereoPanel;
