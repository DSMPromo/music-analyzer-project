import React, { useState, useCallback, useEffect } from 'react';
import { analyzeRhythmSteps, applyVerifiedHits, formatStepResultsForGrid } from '../../services/rhythmAnalysis';

/**
 * Step-by-step rhythm verification panel.
 * Allows users to:
 * 1. See each detection step (beat tracking, kick, snare, hihat, clap)
 * 2. Adjust sensitivity per instrument
 * 3. Accept/reject detected hits
 * 4. Apply verified hits to the grid
 */
function RhythmVerificationPanel({
  audioFile,
  onHitsVerified,
  onClose,
  initialBpm,
}) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [error, setError] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);

  // Per-instrument sensitivity (0 = sensitive, 1 = strict)
  const [sensitivities, setSensitivities] = useState({
    kick: 0.5,
    snare: 0.5,
    hihat: 0.5,
    clap: 0.5,
  });

  // Per-instrument verification state
  const [verifiedHits, setVerifiedHits] = useState({
    kick: [],
    snare: [],
    hihat: [],
    clap: [],
  });

  // Track which drums are verified
  const [verified, setVerified] = useState({
    kick: false,
    snare: false,
    hihat: false,
    clap: false,
  });

  const DRUM_COLORS = {
    kick: '#e94560',
    snare: '#3b82f6',
    hihat: '#22c55e',
    clap: '#f97316',
  };

  const DRUM_LABELS = {
    kick: 'Kick/808',
    snare: 'Snare',
    hihat: 'Hi-Hat',
    clap: 'Clap',
  };

  // Run analysis with current sensitivities
  const runAnalysis = useCallback(async () => {
    if (!audioFile) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const result = await analyzeRhythmSteps(audioFile, sensitivities);
      setAnalysisResult(result);

      // Initialize verified hits from analysis
      const newVerifiedHits = { kick: [], snare: [], hihat: [], clap: [] };
      for (const step of result.steps) {
        if (step.drum_type && step.hits) {
          newVerifiedHits[step.drum_type] = step.hits.map(h => ({
            ...h,
            verified: true,
          }));
        }
      }
      setVerifiedHits(newVerifiedHits);

    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [audioFile, sensitivities]);

  // Run initial analysis
  useEffect(() => {
    if (audioFile) {
      runAnalysis();
    }
  }, [audioFile]); // Only run on mount, not on sensitivity change

  // Update sensitivity and re-analyze
  const handleSensitivityChange = (drumType, value) => {
    setSensitivities(prev => ({
      ...prev,
      [drumType]: value,
    }));
  };

  // Toggle individual hit verification
  const toggleHitVerification = (drumType, hitIndex) => {
    setVerifiedHits(prev => {
      const hits = [...prev[drumType]];
      hits[hitIndex] = {
        ...hits[hitIndex],
        verified: !hits[hitIndex].verified,
      };
      return { ...prev, [drumType]: hits };
    });
  };

  // Verify all hits for a drum type
  const verifyAllHits = (drumType) => {
    setVerifiedHits(prev => ({
      ...prev,
      [drumType]: prev[drumType].map(h => ({ ...h, verified: true })),
    }));
    setVerified(prev => ({ ...prev, [drumType]: true }));
  };

  // Reject all hits for a drum type
  const rejectAllHits = (drumType) => {
    setVerifiedHits(prev => ({
      ...prev,
      [drumType]: prev[drumType].map(h => ({ ...h, verified: false })),
    }));
    setVerified(prev => ({ ...prev, [drumType]: true }));
  };

  // Apply verified hits
  const handleApply = async () => {
    const allVerifiedHits = [];
    Object.entries(verifiedHits).forEach(([drumType, hits]) => {
      hits.filter(h => h.verified).forEach(h => {
        allVerifiedHits.push({
          time: h.time,
          type: drumType,
          confidence: h.confidence,
        });
      });
    });

    try {
      const result = await applyVerifiedHits(
        allVerifiedHits,
        analysisResult?.bpm || initialBpm,
        analysisResult?.time_signature || 4
      );

      // Format for grid and pass back
      const formattedHits = formatStepResultsForGrid(
        { ...analysisResult, steps: Object.entries(verifiedHits).map(([type, hits]) => ({
          drum_type: type,
          hits: hits.filter(h => h.verified),
        }))},
        analysisResult?.bpm || initialBpm,
        analysisResult?.time_signature || 4
      );

      onHitsVerified({
        hits: formattedHits,
        bpm: analysisResult?.bpm,
        timeSignature: analysisResult?.time_signature,
        swing: result.swing,
        genre: result.detected_genre,
        genreConfidence: result.genre_confidence,
      });

      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  // Get step for a drum type
  const getStepForDrum = (drumType) => {
    if (!analysisResult?.steps) return null;
    return analysisResult.steps.find(s => s.drum_type === drumType);
  };

  const steps = ['beat', 'kick', 'snare', 'hihat', 'clap'];
  const currentDrum = steps[currentStep];

  return (
    <div className="rhythm-verification-panel">
      <div className="rvp-header">
        <h3>🔍 Rhythm Verification</h3>
        <button className="rvp-close" onClick={onClose}>✕</button>
      </div>

      {error && (
        <div className="rvp-error">
          ⚠️ {error}
          <button onClick={runAnalysis}>Retry</button>
        </div>
      )}

      {isAnalyzing ? (
        <div className="rvp-loading">
          <div className="rvp-spinner" />
          <span>Analyzing rhythm...</span>
        </div>
      ) : analysisResult ? (
        <>
          {/* BPM and Overview */}
          <div className="rvp-overview">
            <div className="rvp-bpm">
              <span className="label">BPM</span>
              <span className="value">{analysisResult.bpm?.toFixed(1)}</span>
              <span className="confidence">
                {(analysisResult.bpm_confidence * 100).toFixed(0)}% conf
              </span>
            </div>
            <div className="rvp-genre">
              <span className="label">Genre</span>
              <span className="value">{analysisResult.detected_genre || 'Unknown'}</span>
              <span className="confidence">
                {((analysisResult.genre_confidence || 0) * 100).toFixed(0)}%
              </span>
            </div>
            <div className="rvp-beats">
              <span className="label">Beats</span>
              <span className="value">{analysisResult.beats?.length || 0}</span>
            </div>
          </div>

          {/* Step Navigation */}
          <div className="rvp-steps">
            {steps.map((step, idx) => (
              <button
                key={step}
                className={`rvp-step-btn ${currentStep === idx ? 'active' : ''} ${
                  step !== 'beat' && verified[step] ? 'verified' : ''
                }`}
                onClick={() => setCurrentStep(idx)}
                style={{
                  borderColor: DRUM_COLORS[step] || '#666',
                  backgroundColor: currentStep === idx ? (DRUM_COLORS[step] || '#333') + '33' : 'transparent',
                }}
              >
                {step === 'beat' ? '🎵 Beats' : DRUM_LABELS[step]}
                {step !== 'beat' && (
                  <span className="hit-count">
                    {verifiedHits[step]?.filter(h => h.verified).length || 0}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Step Content */}
          <div className="rvp-content">
            {currentStep === 0 ? (
              /* Beat Detection Step */
              <div className="rvp-beat-step">
                <h4>Beat Detection</h4>
                <div className="rvp-beat-info">
                  <p>Detected <strong>{analysisResult.beats?.length}</strong> beats</p>
                  <p>Time Signature: <strong>{analysisResult.time_signature}/4</strong></p>
                  <p>Downbeats: <strong>{analysisResult.downbeats?.length}</strong></p>
                </div>
                <button
                  className="rvp-next-btn"
                  onClick={() => setCurrentStep(1)}
                >
                  Next: Verify Kicks →
                </button>
              </div>
            ) : (
              /* Drum Detection Steps */
              <div className="rvp-drum-step">
                <div className="rvp-drum-header" style={{ borderColor: DRUM_COLORS[currentDrum] }}>
                  <h4 style={{ color: DRUM_COLORS[currentDrum] }}>
                    {DRUM_LABELS[currentDrum]} Detection
                  </h4>
                  <span className="hit-count">
                    {verifiedHits[currentDrum]?.filter(h => h.verified).length} / {verifiedHits[currentDrum]?.length} hits
                  </span>
                </div>

                {/* Sensitivity Slider */}
                <div className="rvp-sensitivity">
                  <label>
                    Sensitivity:
                    <span className="sens-value">
                      {sensitivities[currentDrum] < 0.3 ? 'High' :
                       sensitivities[currentDrum] > 0.7 ? 'Low' : 'Medium'}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={sensitivities[currentDrum]}
                    onChange={(e) => handleSensitivityChange(currentDrum, parseFloat(e.target.value))}
                    style={{
                      accentColor: DRUM_COLORS[currentDrum],
                    }}
                  />
                  <div className="sens-labels">
                    <span>More hits</span>
                    <span>Fewer hits</span>
                  </div>
                  <button
                    className="rvp-reanalyze"
                    onClick={runAnalysis}
                    disabled={isAnalyzing}
                  >
                    🔄 Re-analyze
                  </button>
                </div>

                {/* Energy Stats */}
                {getStepForDrum(currentDrum)?.energy_stats && (
                  <div className="rvp-energy-stats">
                    <span>Threshold: {getStepForDrum(currentDrum).threshold_used?.toFixed(4)}</span>
                    <span>Median: {getStepForDrum(currentDrum).energy_stats.median?.toFixed(4)}</span>
                  </div>
                )}

                {/* Hits List */}
                <div className="rvp-hits-list">
                  {verifiedHits[currentDrum]?.length > 0 ? (
                    verifiedHits[currentDrum].map((hit, idx) => (
                      <div
                        key={idx}
                        className={`rvp-hit ${hit.verified ? 'verified' : 'rejected'}`}
                        onClick={() => toggleHitVerification(currentDrum, idx)}
                        style={{
                          borderLeftColor: hit.verified ? DRUM_COLORS[currentDrum] : '#444',
                        }}
                      >
                        <span className="hit-time">{hit.time?.toFixed(3)}s</span>
                        <span className="hit-conf">{(hit.confidence * 100).toFixed(0)}%</span>
                        <span className="hit-check">{hit.verified ? '✓' : '✗'}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rvp-no-hits">No hits detected. Try increasing sensitivity.</div>
                  )}
                </div>

                {/* Bulk Actions */}
                <div className="rvp-bulk-actions">
                  <button
                    className="rvp-accept-all"
                    onClick={() => verifyAllHits(currentDrum)}
                    style={{ borderColor: DRUM_COLORS[currentDrum] }}
                  >
                    ✓ Accept All
                  </button>
                  <button
                    className="rvp-reject-all"
                    onClick={() => rejectAllHits(currentDrum)}
                  >
                    ✗ Reject All
                  </button>
                </div>

                {/* Navigation */}
                <div className="rvp-nav">
                  {currentStep > 1 && (
                    <button onClick={() => setCurrentStep(currentStep - 1)}>
                      ← Previous
                    </button>
                  )}
                  {currentStep < steps.length - 1 ? (
                    <button
                      className="rvp-next-btn"
                      onClick={() => {
                        setVerified(prev => ({ ...prev, [currentDrum]: true }));
                        setCurrentStep(currentStep + 1);
                      }}
                    >
                      Next →
                    </button>
                  ) : (
                    <button
                      className="rvp-apply-btn"
                      onClick={handleApply}
                    >
                      ✓ Apply Verified Hits
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="rvp-empty">
          <p>Load an audio file to start verification</p>
        </div>
      )}
    </div>
  );
}

export default RhythmVerificationPanel;
