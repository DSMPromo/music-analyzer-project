import { useState, useCallback, useEffect, useMemo } from 'react';
import {
  DEFAULT_THRESHOLDS,
  STAGE_STATUS,
  STAGES,
  checkAudioQuality,
  checkRhythmVerification,
  checkChordVerification,
  checkExportReadiness,
} from '../utils/verificationUtils';

/**
 * Verification Workflow Hook
 * State machine for managing the verification flow between stages
 */
export function useVerificationWorkflow() {
  // Stage statuses
  const [stageStatus, setStageStatus] = useState({
    [STAGES.AUDIO]: STAGE_STATUS.PENDING,
    [STAGES.RHYTHM]: STAGE_STATUS.BLOCKED,
    [STAGES.CHORD]: STAGE_STATUS.BLOCKED,
    [STAGES.EXPORT]: STAGE_STATUS.BLOCKED,
  });

  // Stage results
  const [stageResults, setStageResults] = useState({
    [STAGES.AUDIO]: null,
    [STAGES.RHYTHM]: null,
    [STAGES.CHORD]: null,
    [STAGES.EXPORT]: null,
  });

  // Adjustable thresholds
  const [thresholds, setThresholds] = useState({ ...DEFAULT_THRESHOLDS });

  // Expert mode - bypasses verification gates
  const [isExpertMode, setExpertMode] = useState(false);

  // Current active stage
  const currentStage = useMemo(() => {
    if (stageStatus[STAGES.EXPORT] === STAGE_STATUS.VERIFIED) return STAGES.EXPORT;
    if (stageStatus[STAGES.CHORD] === STAGE_STATUS.VERIFIED) return STAGES.EXPORT;
    if (stageStatus[STAGES.RHYTHM] === STAGE_STATUS.VERIFIED) return STAGES.CHORD;
    if (stageStatus[STAGES.AUDIO] === STAGE_STATUS.PASSED ||
        stageStatus[STAGES.AUDIO] === STAGE_STATUS.VERIFIED) return STAGES.RHYTHM;
    return STAGES.AUDIO;
  }, [stageStatus]);

  // Collect all blockers across stages
  const blockers = useMemo(() => {
    const allBlockers = [];
    Object.entries(stageResults).forEach(([stage, result]) => {
      if (result?.blockers) {
        result.blockers.forEach(blocker => {
          allBlockers.push({ stage, blocker });
        });
      }
    });
    return allBlockers;
  }, [stageResults]);

  /**
   * Set a specific threshold value
   */
  const setThreshold = useCallback((stage, key, value) => {
    setThresholds(prev => ({
      ...prev,
      [stage]: {
        ...prev[stage],
        [key]: value,
      },
    }));
  }, []);

  /**
   * Run audio quality check
   */
  const runAudioQualityCheck = useCallback((audioBuffer) => {
    if (!audioBuffer) {
      setStageStatus(prev => ({ ...prev, [STAGES.AUDIO]: STAGE_STATUS.PENDING }));
      return null;
    }

    setStageStatus(prev => ({ ...prev, [STAGES.AUDIO]: STAGE_STATUS.CHECKING }));

    const result = checkAudioQuality(audioBuffer, thresholds.audio);

    setStageResults(prev => ({ ...prev, [STAGES.AUDIO]: result }));

    // Determine status
    let newStatus;
    if (result.passed) {
      newStatus = result.warnings.length > 0 ? STAGE_STATUS.WARNING : STAGE_STATUS.PASSED;
    } else {
      newStatus = STAGE_STATUS.FAILED;
    }

    setStageStatus(prev => ({
      ...prev,
      [STAGES.AUDIO]: newStatus,
      // Unlock rhythm stage if audio passed (or expert mode)
      [STAGES.RHYTHM]: (result.passed || isExpertMode) && prev[STAGES.RHYTHM] === STAGE_STATUS.BLOCKED
        ? STAGE_STATUS.PENDING
        : prev[STAGES.RHYTHM],
    }));

    return result;
  }, [thresholds.audio, isExpertMode]);

  /**
   * Run rhythm verification check
   */
  const runRhythmVerification = useCallback((rhythmData) => {
    if (!rhythmData) {
      return null;
    }

    setStageStatus(prev => ({ ...prev, [STAGES.RHYTHM]: STAGE_STATUS.CHECKING }));

    const result = checkRhythmVerification(rhythmData, thresholds.rhythm);

    setStageResults(prev => ({ ...prev, [STAGES.RHYTHM]: result }));

    // Determine status - rhythm requires explicit approval, so we leave it at warning/passed
    let newStatus;
    if (result.passed) {
      newStatus = result.warnings.length > 0 ? STAGE_STATUS.WARNING : STAGE_STATUS.PASSED;
    } else {
      newStatus = STAGE_STATUS.FAILED;
    }

    setStageStatus(prev => ({
      ...prev,
      [STAGES.RHYTHM]: newStatus,
    }));

    return result;
  }, [thresholds.rhythm]);

  /**
   * Run chord verification check
   */
  const runChordVerification = useCallback((chordData) => {
    if (!chordData) {
      return null;
    }

    setStageStatus(prev => ({ ...prev, [STAGES.CHORD]: STAGE_STATUS.CHECKING }));

    const result = checkChordVerification(chordData, thresholds.chord);

    setStageResults(prev => ({ ...prev, [STAGES.CHORD]: result }));

    // Determine status
    let newStatus;
    if (result.passed) {
      newStatus = result.warnings.length > 0 ? STAGE_STATUS.WARNING : STAGE_STATUS.PASSED;
    } else {
      newStatus = STAGE_STATUS.FAILED;
    }

    setStageStatus(prev => ({
      ...prev,
      [STAGES.CHORD]: newStatus,
    }));

    return result;
  }, [thresholds.chord]);

  /**
   * Approve a stage and unlock next
   */
  const approveStage = useCallback((stageName) => {
    setStageStatus(prev => {
      const newStatus = { ...prev, [stageName]: STAGE_STATUS.VERIFIED };

      // Unlock next stage
      switch (stageName) {
        case STAGES.AUDIO:
          if (newStatus[STAGES.RHYTHM] === STAGE_STATUS.BLOCKED) {
            newStatus[STAGES.RHYTHM] = STAGE_STATUS.PENDING;
          }
          break;
        case STAGES.RHYTHM:
          if (newStatus[STAGES.CHORD] === STAGE_STATUS.BLOCKED) {
            newStatus[STAGES.CHORD] = STAGE_STATUS.PENDING;
          }
          break;
        case STAGES.CHORD:
          if (newStatus[STAGES.EXPORT] === STAGE_STATUS.BLOCKED) {
            newStatus[STAGES.EXPORT] = STAGE_STATUS.PENDING;
          }
          break;
        default:
          break;
      }

      return newStatus;
    });
  }, []);

  /**
   * Reject stage and request adjustments
   */
  const rejectAndAdjust = useCallback((stageName) => {
    setStageStatus(prev => ({
      ...prev,
      [stageName]: STAGE_STATUS.PENDING,
    }));
  }, []);

  /**
   * Skip to next stage (expert mode only)
   */
  const skipToNext = useCallback(() => {
    if (!isExpertMode) return;

    setStageStatus(prev => {
      const newStatus = { ...prev };

      // Skip current stage
      if (prev[STAGES.AUDIO] !== STAGE_STATUS.VERIFIED && prev[STAGES.AUDIO] !== STAGE_STATUS.SKIPPED) {
        newStatus[STAGES.AUDIO] = STAGE_STATUS.SKIPPED;
        newStatus[STAGES.RHYTHM] = STAGE_STATUS.PENDING;
      } else if (prev[STAGES.RHYTHM] !== STAGE_STATUS.VERIFIED && prev[STAGES.RHYTHM] !== STAGE_STATUS.SKIPPED) {
        newStatus[STAGES.RHYTHM] = STAGE_STATUS.SKIPPED;
        newStatus[STAGES.CHORD] = STAGE_STATUS.PENDING;
      } else if (prev[STAGES.CHORD] !== STAGE_STATUS.VERIFIED && prev[STAGES.CHORD] !== STAGE_STATUS.SKIPPED) {
        newStatus[STAGES.CHORD] = STAGE_STATUS.SKIPPED;
        newStatus[STAGES.EXPORT] = STAGE_STATUS.PENDING;
      }

      return newStatus;
    });
  }, [isExpertMode]);

  /**
   * Reset entire workflow
   */
  const resetWorkflow = useCallback(() => {
    setStageStatus({
      [STAGES.AUDIO]: STAGE_STATUS.PENDING,
      [STAGES.RHYTHM]: STAGE_STATUS.BLOCKED,
      [STAGES.CHORD]: STAGE_STATUS.BLOCKED,
      [STAGES.EXPORT]: STAGE_STATUS.BLOCKED,
    });
    setStageResults({
      [STAGES.AUDIO]: null,
      [STAGES.RHYTHM]: null,
      [STAGES.CHORD]: null,
      [STAGES.EXPORT]: null,
    });
  }, []);

  /**
   * Check export readiness
   */
  const checkExport = useCallback((qualityScore) => {
    const result = checkExportReadiness(stageStatus, qualityScore, thresholds.export);
    setStageResults(prev => ({ ...prev, [STAGES.EXPORT]: result }));

    if (result.passed) {
      setStageStatus(prev => ({ ...prev, [STAGES.EXPORT]: STAGE_STATUS.VERIFIED }));
    }

    return result;
  }, [stageStatus, thresholds.export]);

  /**
   * Auto-approve all stages in expert mode when toggled on
   */
  useEffect(() => {
    if (isExpertMode) {
      setStageStatus(prev => {
        const newStatus = { ...prev };

        // Unblock all stages
        Object.keys(newStatus).forEach(stage => {
          if (newStatus[stage] === STAGE_STATUS.BLOCKED) {
            newStatus[stage] = STAGE_STATUS.PENDING;
          }
        });

        return newStatus;
      });
    }
  }, [isExpertMode]);

  /**
   * Get stage progress percentage
   */
  const progress = useMemo(() => {
    const stages = [STAGES.AUDIO, STAGES.RHYTHM, STAGES.CHORD, STAGES.EXPORT];
    let completed = 0;

    stages.forEach(stage => {
      if (stageStatus[stage] === STAGE_STATUS.VERIFIED ||
          stageStatus[stage] === STAGE_STATUS.SKIPPED) {
        completed++;
      } else if (stageStatus[stage] === STAGE_STATUS.PASSED ||
                 stageStatus[stage] === STAGE_STATUS.WARNING) {
        completed += 0.5; // Half credit for passed but not verified
      }
    });

    return Math.round((completed / stages.length) * 100);
  }, [stageStatus]);

  return {
    // State
    currentStage,
    stageStatus,
    stageResults,
    blockers,
    progress,

    // Thresholds
    thresholds,
    setThreshold,

    // Actions
    runAudioQualityCheck,
    runRhythmVerification,
    runChordVerification,
    approveStage,
    rejectAndAdjust,
    skipToNext,
    resetWorkflow,
    checkExport,

    // Settings
    isExpertMode,
    setExpertMode,
  };
}
