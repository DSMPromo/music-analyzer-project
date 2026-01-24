import React, { useState, useEffect, useRef } from 'react';
import {
  startSeparation,
  waitForCompletion,
  getStemDownloadUrl,
  downloadStem,
  cleanupJob,
  checkStemServiceHealth,
  STEM_INFO
} from '../../services/stemSeparation';
import { generateMIDI, downloadMIDI } from '../../services/api';

/**
 * StemSeparator - Audio stem separation with MIDI generation
 *
 * Separates audio into drums, bass, vocals, and other stems using Demucs,
 * then allows generating MIDI for each stem.
 */
function StemSeparator({ audioFile }) {
  // State
  const [isServiceAvailable, setIsServiceAvailable] = useState(null);
  const [isSeparating, setIsSeparating] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [stems, setStems] = useState([]);
  const [selectedModel, setSelectedModel] = useState('htdemucs');
  const [artifactReduction, setArtifactReduction] = useState(0);
  const [playingStems, setPlayingStems] = useState({});
  const [midiGenerating, setMidiGenerating] = useState({});
  const [midiFiles, setMidiFiles] = useState({});
  const [uploadedFile, setUploadedFile] = useState(null);

  const fileInputRef = useRef(null);
  const audioRefs = useRef({});

  // Get active file
  const activeFile = uploadedFile || audioFile;

  // Check service health on mount
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkStemServiceHealth();
      setIsServiceAvailable(healthy);
    };
    checkHealth();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (jobId) {
        cleanupJob(jobId).catch(() => {});
      }
    };
  }, [jobId]);

  // Handle file upload (with AIFF conversion support)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setStems([]);
      setError(null);
      setJobId(null);
      setMidiFiles({});

      // Convert if needed (AIFF, etc.)
      try {
        const { convertToWav } = await import('../utils/audioConversion');
        const result = await convertToWav(file);
        setUploadedFile(result.file);
      } catch (err) {
        console.error('File conversion error:', err);
        setUploadedFile(file); // Fallback to original
      }
    }
  };

  // Start stem separation
  const handleSeparate = async () => {
    if (!activeFile) {
      setError('No audio file selected');
      return;
    }

    setIsSeparating(true);
    setError(null);
    setStems([]);
    setProgress('Starting separation...');

    try {
      // Start the job
      const { job_id } = await startSeparation(activeFile, selectedModel, artifactReduction);
      setJobId(job_id);

      // Wait for completion
      const result = await waitForCompletion(job_id, (status) => {
        setProgress(status.progress || 'Processing...');
      });

      // Set stems
      setStems(result.result.stems);
      setProgress('');
    } catch (err) {
      setError(err.message || 'Separation failed');
    } finally {
      setIsSeparating(false);
    }
  };

  // Play/pause a stem
  const togglePlayStem = (stemName) => {
    const audio = audioRefs.current[stemName];
    if (!audio) return;

    if (playingStems[stemName]) {
      audio.pause();
      setPlayingStems(prev => ({ ...prev, [stemName]: false }));
    } else {
      // Pause other stems
      Object.keys(audioRefs.current).forEach(key => {
        if (key !== stemName && audioRefs.current[key]) {
          audioRefs.current[key].pause();
        }
      });
      setPlayingStems(prev => {
        const newState = {};
        Object.keys(prev).forEach(key => newState[key] = false);
        newState[stemName] = true;
        return newState;
      });
      // Handle play() promise to avoid "interrupted by pause()" errors
      audio.play().catch(e => {
        if (e.name !== 'AbortError') {
          console.error('Stem playback error:', e);
        }
      });
    }
  };

  // Generate MIDI for a stem
  const handleGenerateMidi = async (stem) => {
    if (!jobId) return;

    setMidiGenerating(prev => ({ ...prev, [stem.name]: true }));

    try {
      // Fetch the stem file
      const stemUrl = getStemDownloadUrl(jobId, stem.filename);
      const response = await fetch(stemUrl);
      const blob = await response.blob();
      const stemFile = new File([blob], stem.filename, { type: 'audio/mpeg' });

      // Generate MIDI
      const result = await generateMIDI(stemFile, {
        onsetThreshold: 0.5,
        frameThreshold: 0.3,
        minNoteLength: 50
      });

      setMidiFiles(prev => ({
        ...prev,
        [stem.name]: result.filename
      }));
    } catch (err) {
      setError(`MIDI generation failed for ${stem.name}: ${err.message}`);
    } finally {
      setMidiGenerating(prev => ({ ...prev, [stem.name]: false }));
    }
  };

  // Download MIDI for a stem
  const handleDownloadMidi = async (stemName) => {
    const filename = midiFiles[stemName];
    if (!filename) return;

    try {
      const blob = await downloadMIDI(filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${stemName}.mid`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(`Failed to download MIDI: ${err.message}`);
    }
  };

  // Download all stems as ZIP (simplified - downloads individually)
  const handleDownloadAll = () => {
    stems.forEach(stem => {
      downloadStem(jobId, stem.filename, `${stem.name}.mp3`);
    });
  };

  // Generate all MIDIs
  const handleGenerateAllMidi = async () => {
    for (const stem of stems) {
      if (!midiFiles[stem.name] && !midiGenerating[stem.name]) {
        await handleGenerateMidi(stem);
      }
    }
  };

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Render service unavailable
  if (isServiceAvailable === false) {
    return (
      <div className="stem-separator stem-unavailable">
        <h2>Stem Separator</h2>
        <div className="service-warning">
          <span className="warning-icon">!</span>
          <div className="warning-text">
            <strong>Stem Separator service not available</strong>
            <p>Start the service with:</p>
            <code>python stem_separator.py</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stem-separator">
      {/* Header */}
      <div className="stem-header">
        <h2>Stem Separator + MIDI</h2>
        <button
          className="upload-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Different
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
      </div>

      {/* File Info */}
      {activeFile && (
        <div className="stem-file-info">
          <span className="file-name">{activeFile.name}</span>
          <span className="file-size">{formatSize(activeFile.size)}</span>
        </div>
      )}

      {/* Model Selection */}
      <div className="stem-model-section">
        <label>Separation Model:</label>
        <div className="model-buttons">
          <button
            className={`model-btn ${selectedModel === 'htdemucs' ? 'active' : ''}`}
            onClick={() => setSelectedModel('htdemucs')}
            disabled={isSeparating}
          >
            4 Stems (Default)
          </button>
          <button
            className={`model-btn ${selectedModel === 'htdemucs_6s' ? 'active' : ''}`}
            onClick={() => setSelectedModel('htdemucs_6s')}
            disabled={isSeparating}
          >
            6 Stems (+Guitar/Piano)
          </button>
        </div>
      </div>

      {/* Artifact Reduction */}
      <div className="stem-artifact-section">
        <label>
          Artifact Reduction: {artifactReduction}%
          <span className="artifact-hint">
            {artifactReduction === 0 ? ' (Off)' :
             artifactReduction <= 30 ? ' (Light)' :
             artifactReduction <= 60 ? ' (Medium)' : ' (Heavy)'}
          </span>
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={artifactReduction}
          onChange={(e) => setArtifactReduction(parseInt(e.target.value))}
          disabled={isSeparating}
          className="artifact-slider"
        />
        <p className="artifact-note">
          Reduces separation artifacts using spectral denoising. Higher values may affect audio quality.
        </p>
      </div>

      {/* Separate Button */}
      <div className="stem-actions-top">
        <button
          className="separate-btn primary"
          onClick={handleSeparate}
          disabled={isSeparating || !activeFile}
        >
          {isSeparating ? 'Separating...' : 'Separate Stems'}
        </button>
      </div>

      {/* Progress */}
      {isSeparating && (
        <div className="stem-progress">
          <div className="spinner"></div>
          <span>{progress}</span>
          <p className="progress-note">This may take a few minutes...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="stem-error">
          <span className="error-icon">!</span>
          <span>{error}</span>
        </div>
      )}

      {/* Stems Grid */}
      {stems.length > 0 && (
        <div className="stems-container">
          <div className="stems-header">
            <h3>Separated Stems</h3>
            <div className="stems-actions">
              <button className="action-btn" onClick={handleDownloadAll}>
                Download All
              </button>
              <button className="action-btn" onClick={handleGenerateAllMidi}>
                Generate All MIDI
              </button>
            </div>
          </div>

          <div className="stems-grid">
            {stems.map(stem => {
              const info = STEM_INFO[stem.name] || { name: stem.name, color: '#666', icon: '🎵' };
              const isPlaying = playingStems[stem.name];
              const isGeneratingMidi = midiGenerating[stem.name];
              const hasMidi = midiFiles[stem.name];

              return (
                <div
                  key={stem.name}
                  className="stem-card"
                  style={{ borderColor: info.color }}
                >
                  <div className="stem-icon" style={{ backgroundColor: info.color }}>
                    {info.icon}
                  </div>

                  <div className="stem-info">
                    <h4>{info.name}</h4>
                    <span className="stem-size">{formatSize(stem.size_bytes)}</span>
                  </div>

                  {/* Audio element (hidden) */}
                  <audio
                    ref={el => audioRefs.current[stem.name] = el}
                    src={getStemDownloadUrl(jobId, stem.filename)}
                    onEnded={() => setPlayingStems(prev => ({ ...prev, [stem.name]: false }))}
                  />

                  <div className="stem-controls">
                    {/* Play/Pause */}
                    <button
                      className={`control-btn play-btn ${isPlaying ? 'playing' : ''}`}
                      onClick={() => togglePlayStem(stem.name)}
                      title={isPlaying ? 'Pause' : 'Play'}
                    >
                      {isPlaying ? '⏸' : '▶'}
                    </button>

                    {/* Download stem */}
                    <button
                      className="control-btn download-btn"
                      onClick={() => downloadStem(jobId, stem.filename, `${stem.name}.mp3`)}
                      title="Download MP3"
                    >
                      ⬇
                    </button>

                    {/* Generate MIDI */}
                    <button
                      className={`control-btn midi-btn ${hasMidi ? 'has-midi' : ''}`}
                      onClick={() => hasMidi ? handleDownloadMidi(stem.name) : handleGenerateMidi(stem)}
                      disabled={isGeneratingMidi}
                      title={hasMidi ? 'Download MIDI' : 'Generate MIDI'}
                    >
                      {isGeneratingMidi ? '...' : hasMidi ? '🎹' : 'MIDI'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="stem-info-text">
        <p>Powered by Demucs (Meta AI)</p>
      </div>
    </div>
  );
}

export default StemSeparator;
