import React from 'react';
import { STAGE_STATUS, getSeverityColor, getStatusIcon } from '../../../utils/verificationUtils';

/**
 * AudioQualityStage Component
 * Pre-detection audio validation with pass/fail checklist
 */
export function AudioQualityStage({
  status,
  results,
  onContinue,
  onRecheck,
  isExpanded = true,
}) {
  if (!results) {
    return (
      <div className="verification-stage audio-quality-stage">
        <div className="stage-header">
          <span className="stage-icon">{getStatusIcon(STAGE_STATUS.PENDING)}</span>
          <h3>Audio Quality Check</h3>
          <span className="stage-status pending">Waiting for audio...</span>
        </div>
      </div>
    );
  }

  const { checks, passed, warnings, blockers } = results;
  const hasWarnings = warnings?.length > 0;
  const hasBlockers = blockers?.length > 0;

  return (
    <div className={`verification-stage audio-quality-stage ${status}`}>
      <div className="stage-header">
        <span
          className="stage-icon"
          style={{ color: getSeverityColor(passed ? (hasWarnings ? 'warning' : 'success') : 'error') }}
        >
          {getStatusIcon(status)}
        </span>
        <h3>Audio Quality Check</h3>
        <span className={`stage-status ${status}`}>
          {status === STAGE_STATUS.PASSED && 'Passed'}
          {status === STAGE_STATUS.WARNING && 'Passed with warnings'}
          {status === STAGE_STATUS.FAILED && 'Failed'}
          {status === STAGE_STATUS.VERIFIED && 'Verified'}
          {status === STAGE_STATUS.CHECKING && 'Checking...'}
        </span>
      </div>

      {isExpanded && (
        <div className="stage-content">
          <div className="quality-checklist">
            {checks.map((check, idx) => (
              <div
                key={idx}
                className={`check-item ${check.severity}`}
              >
                <span
                  className="check-icon"
                  style={{ color: getSeverityColor(check.severity) }}
                >
                  {check.status === 'passed' ? '\u2713' : check.status === 'warning' ? '\u26A0' : '\u2717'}
                </span>
                <span className="check-name">{check.name}</span>
                <span className="check-message">{check.message}</span>
              </div>
            ))}
          </div>

          {hasBlockers && (
            <div className="stage-blockers">
              <p className="blocker-message">
                <strong>Issues found:</strong> The following issues must be resolved before proceeding.
              </p>
              <ul>
                {blockers.map((blocker, idx) => (
                  <li key={idx}>{formatBlocker(blocker)}</li>
                ))}
              </ul>
            </div>
          )}

          {hasWarnings && !hasBlockers && (
            <div className="stage-warnings">
              <p className="warning-message">
                <strong>Warnings:</strong> These issues may affect analysis quality but won&apos;t block you.
              </p>
              <ul>
                {warnings.map((warning, idx) => (
                  <li key={idx}>{formatWarning(warning)}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="stage-actions">
            {passed && status !== STAGE_STATUS.VERIFIED && (
              <button
                className="btn btn-primary"
                onClick={onContinue}
              >
                {hasWarnings ? 'Continue Anyway' : 'Continue'} &rarr;
              </button>
            )}
            {!passed && (
              <button
                className="btn btn-secondary"
                onClick={onRecheck}
              >
                Re-check Audio
              </button>
            )}
            {status === STAGE_STATUS.VERIFIED && (
              <span className="verified-badge">
                <span className="verified-icon">\u2713</span> Verified
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatBlocker(blocker) {
  switch (blocker) {
    case 'no_audio_buffer':
      return 'No audio loaded';
    case 'short_duration':
      return 'Audio is too short (minimum 3 seconds)';
    case 'low_rms_level':
      return 'Audio is too quiet (below -40 dB)';
    default:
      return blocker.replace(/_/g, ' ');
  }
}

function formatWarning(warning) {
  switch (warning) {
    case 'high_dc_offset':
      return 'DC offset detected - consider applying a high-pass filter';
    case 'clipping_detected':
      return 'Clipping detected - audio may be distorted';
    case 'low_sample_rate':
      return 'Low sample rate - may affect analysis accuracy';
    default:
      return warning.replace(/_/g, ' ');
  }
}

export default AudioQualityStage;
