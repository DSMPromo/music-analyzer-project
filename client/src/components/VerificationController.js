import React, { useEffect, useCallback, useState } from 'react';
import { STAGE_STATUS, STAGES, getStatusIcon, getSeverityColor } from '../utils/verificationUtils';
import { AudioQualityStage } from './stages/AudioQualityStage';
import { RhythmVerificationStage } from './stages/RhythmVerificationStage';
import { ChordVerificationStage } from './stages/ChordVerificationStage';

/**
 * VerificationController Component
 * Main orchestrator with stage progress UI
 */
export function VerificationController({
  // Workflow state
  workflow,

  // Audio data
  audioBuffer,

  // Rhythm data
  rhythmData,
  isRhythmAnalyzing,
  rhythmProgress,
  rhythmAnalysisMethod,
  onOpenFixGrid,
  onReanalyzeRhythm,
  onReanalyzeRhythmWithAI,

  // Chord data
  chordData,

  // Callbacks
  onStageComplete,
  onFindQuietHits,
  isFindingQuietHits = false,
}) {
  const {
    currentStage,
    stageStatus,
    stageResults,
    progress,
    thresholds,
    setThreshold,
    runAudioQualityCheck,
    runRhythmVerification,
    runChordVerification,
    approveStage,
    skipToNext,
    resetWorkflow,
    isExpertMode,
    setExpertMode,
  } = workflow;

  // Track expanded stage
  const [expandedStage, setExpandedStage] = useState(STAGES.AUDIO);

  // Auto-expand current stage
  useEffect(() => {
    setExpandedStage(currentStage);
  }, [currentStage]);

  // Run audio quality check when buffer changes
  useEffect(() => {
    if (audioBuffer && stageStatus[STAGES.AUDIO] === STAGE_STATUS.PENDING) {
      runAudioQualityCheck(audioBuffer);
    }
  }, [audioBuffer, stageStatus, runAudioQualityCheck]);

  // Run rhythm verification when rhythm data changes
  useEffect(() => {
    if (
      rhythmData &&
      rhythmData.bpm &&
      !isRhythmAnalyzing &&
      (stageStatus[STAGES.RHYTHM] === STAGE_STATUS.PENDING ||
       stageStatus[STAGES.RHYTHM] === STAGE_STATUS.CHECKING)
    ) {
      runRhythmVerification(rhythmData);
    }
  }, [rhythmData, isRhythmAnalyzing, stageStatus, runRhythmVerification]);

  // Run chord verification when chord data changes
  useEffect(() => {
    if (
      chordData &&
      chordData.chordHistory &&
      chordData.chordHistory.length > 0 &&
      (stageStatus[STAGES.CHORD] === STAGE_STATUS.PENDING ||
       stageStatus[STAGES.CHORD] === STAGE_STATUS.CHECKING)
    ) {
      runChordVerification(chordData);
    }
  }, [chordData, stageStatus, runChordVerification]);

  // Handle stage approval
  const handleApproveStage = useCallback((stageName) => {
    approveStage(stageName);
    if (onStageComplete) {
      onStageComplete(stageName);
    }
  }, [approveStage, onStageComplete]);

  // Handle threshold change for rhythm
  const handleRhythmThresholdChange = useCallback((key, value) => {
    setThreshold(STAGES.RHYTHM, key, value);
  }, [setThreshold]);

  // Handle threshold change for chord
  const handleChordThresholdChange = useCallback((key, value) => {
    setThreshold(STAGES.CHORD, key, value);
  }, [setThreshold]);

  // Toggle stage expansion
  const toggleStage = useCallback((stageName) => {
    setExpandedStage(prev => prev === stageName ? null : stageName);
  }, []);

  // Get stage display info
  const getStageInfo = (stageName) => {
    const status = stageStatus[stageName];
    let label = '';
    let statusText = '';

    switch (stageName) {
      case STAGES.AUDIO:
        label = 'Audio';
        break;
      case STAGES.RHYTHM:
        label = 'Rhythm';
        break;
      case STAGES.CHORD:
        label = 'Chords';
        break;
      case STAGES.EXPORT:
        label = 'Export';
        break;
      default:
        label = stageName;
    }

    switch (status) {
      case STAGE_STATUS.BLOCKED:
        statusText = 'Waiting';
        break;
      case STAGE_STATUS.PENDING:
        statusText = 'Pending';
        break;
      case STAGE_STATUS.CHECKING:
        statusText = 'Checking';
        break;
      case STAGE_STATUS.PASSED:
        statusText = 'OK';
        break;
      case STAGE_STATUS.WARNING:
        statusText = 'Review';
        break;
      case STAGE_STATUS.FAILED:
        statusText = 'Failed';
        break;
      case STAGE_STATUS.VERIFIED:
        statusText = 'Verified';
        break;
      case STAGE_STATUS.SKIPPED:
        statusText = 'Skipped';
        break;
      default:
        statusText = '';
    }

    return { label, statusText, status };
  };

  const stages = [STAGES.AUDIO, STAGES.RHYTHM, STAGES.CHORD, STAGES.EXPORT];

  return (
    <div className="verification-controller">
      {/* Progress Bar */}
      <div className="verification-progress">
        <div className="progress-steps">
          {stages.map((stageName, idx) => {
            const info = getStageInfo(stageName);
            const isActive = currentStage === stageName;
            const isComplete = info.status === STAGE_STATUS.VERIFIED || info.status === STAGE_STATUS.SKIPPED;

            return (
              <React.Fragment key={stageName}>
                <button
                  className={`progress-step ${info.status} ${isActive ? 'active' : ''}`}
                  onClick={() => toggleStage(stageName)}
                  disabled={info.status === STAGE_STATUS.BLOCKED}
                >
                  <span
                    className="step-icon"
                    style={{
                      color: getSeverityColor(
                        info.status === STAGE_STATUS.VERIFIED ? 'success' :
                        info.status === STAGE_STATUS.WARNING ? 'warning' :
                        info.status === STAGE_STATUS.FAILED ? 'error' : 'info'
                      ),
                    }}
                  >
                    {getStatusIcon(info.status)}
                  </span>
                  <span className="step-label">{info.label}</span>
                  <span className="step-status">{info.statusText}</span>
                </button>
                {idx < stages.length - 1 && (
                  <span className={`progress-connector ${isComplete ? 'complete' : ''}`}>
                    &rarr;
                  </span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="progress-controls">
          <label className="expert-toggle">
            <input
              type="checkbox"
              checked={isExpertMode}
              onChange={(e) => setExpertMode(e.target.checked)}
            />
            Expert Mode
          </label>
          {isExpertMode && (
            <button
              className="btn btn-small"
              onClick={skipToNext}
              title="Skip current stage"
            >
              Skip
            </button>
          )}
        </div>
      </div>

      {/* Expert Mode Warning */}
      {isExpertMode && (
        <div className="expert-warning">
          <span className="warning-icon">\u26A0</span>
          Expert Mode: Verification gates are bypassed. All stages accessible.
        </div>
      )}

      {/* Stage Panels */}
      <div className="verification-stages">
        {/* Audio Quality Stage */}
        <AudioQualityStage
          status={stageStatus[STAGES.AUDIO]}
          results={stageResults[STAGES.AUDIO]}
          onContinue={() => handleApproveStage(STAGES.AUDIO)}
          onRecheck={() => runAudioQualityCheck(audioBuffer)}
          isExpanded={expandedStage === STAGES.AUDIO}
        />

        {/* Rhythm Verification Stage */}
        <RhythmVerificationStage
          status={stageStatus[STAGES.RHYTHM]}
          results={stageResults[STAGES.RHYTHM]}
          rhythmData={rhythmData}
          thresholds={thresholds.rhythm}
          onThresholdChange={handleRhythmThresholdChange}
          onApprove={() => handleApproveStage(STAGES.RHYTHM)}
          onReanalyze={onReanalyzeRhythm}
          onReanalyzeWithAI={onReanalyzeRhythmWithAI}
          onOpenFixGrid={onOpenFixGrid}
          onFindQuietHits={onFindQuietHits}
          isExpanded={expandedStage === STAGES.RHYTHM}
          isAnalyzing={isRhythmAnalyzing}
          analysisProgress={rhythmProgress}
          analysisMethod={rhythmAnalysisMethod}
          isFindingQuietHits={isFindingQuietHits}
        />

        {/* Chord Verification Stage */}
        <ChordVerificationStage
          status={stageStatus[STAGES.CHORD]}
          results={stageResults[STAGES.CHORD]}
          chordData={chordData}
          thresholds={thresholds.chord}
          onThresholdChange={handleChordThresholdChange}
          onApprove={() => handleApproveStage(STAGES.CHORD)}
          isExpanded={expandedStage === STAGES.CHORD}
        />

        {/* Export Ready Stage */}
        {stageStatus[STAGES.EXPORT] !== STAGE_STATUS.BLOCKED && (
          <div className={`verification-stage export-stage ${stageStatus[STAGES.EXPORT]}`}>
            <div className="stage-header">
              <span
                className="stage-icon"
                style={{
                  color: getSeverityColor(
                    stageStatus[STAGES.EXPORT] === STAGE_STATUS.VERIFIED ? 'success' : 'info'
                  ),
                }}
              >
                {getStatusIcon(stageStatus[STAGES.EXPORT])}
              </span>
              <h3>Export Ready</h3>
              <span className={`stage-status ${stageStatus[STAGES.EXPORT]}`}>
                {stageStatus[STAGES.EXPORT] === STAGE_STATUS.VERIFIED
                  ? 'All stages verified - Ready to export!'
                  : 'Complete all stages to enable export'}
              </span>
            </div>
            {stageStatus[STAGES.EXPORT] === STAGE_STATUS.VERIFIED && (
              <div className="stage-content">
                <div className="export-ready-banner">
                  <span className="success-icon">\u2713</span>
                  <p>All verification stages complete. You can now export MIDI and PDF files.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default VerificationController;
