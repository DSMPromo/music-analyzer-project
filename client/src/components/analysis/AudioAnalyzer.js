import React, { useState, useCallback, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAudioAnalyzer } from '../../hooks/useAudioAnalyzer';
import LoudnessPanel from '../panels/LoudnessPanel';
import FrequencyPanel from '../panels/FrequencyPanel';
import StereoPanel from '../panels/StereoPanel';
import QualityPanel from '../panels/QualityPanel';

/**
 * AudioAnalyzer - Main container for professional audio analysis
 * Integrates all analysis panels and handles file upload/analysis
 */
function AudioAnalyzer({ audioFile, onFileSelect }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const fileInputRef = useRef(null);
  const channelDataRef = useRef({ left: null, right: null });
  const lastAnalyzedFileRef = useRef(null);

  const {
    isAnalyzing,
    progress,
    analysisResults,
    error,
    targetPlatform,
    analyzeFile,
    cancelAnalysis,
    clearResults,
    changeTargetPlatform
  } = useAudioAnalyzer();

  // Internal analysis function (doesn't notify parent)
  const runAnalysis = useCallback(async (file) => {
    if (!file) return;

    // Store channel data for vectorscope (we'll extract during analysis)
    channelDataRef.current = { left: null, right: null };

    // Extract channel data for vectorscope
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const tempCtx = new AudioContextClass({ sampleRate: 44100 });
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);

      // Downsample for vectorscope (every 100th sample)
      const step = 100;
      const length = Math.floor(audioBuffer.getChannelData(0).length / step);
      const leftFull = audioBuffer.getChannelData(0);
      const rightFull = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftFull;

      const left = new Float32Array(length);
      const right = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        left[i] = leftFull[i * step];
        right[i] = rightFull[i * step];
      }

      channelDataRef.current = { left, right };
      await tempCtx.close();
    } catch (e) {
      console.warn('Could not extract channel data for vectorscope:', e);
    }

    // Track which file we analyzed
    lastAnalyzedFileRef.current = file;

    // Start analysis
    await analyzeFile(file);
  }, [analyzeFile]);

  // Handle file selection from dropzone (notifies parent)
  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('audio/')) {
      alert('Please select an audio file');
      return;
    }

    // Notify parent
    if (onFileSelect) {
      onFileSelect(file);
    }

    await runAnalysis(file);
  }, [runAnalysis, onFileSelect]);

  // Auto-analyze when audioFile prop changes from parent
  useEffect(() => {
    if (audioFile && audioFile !== lastAnalyzedFileRef.current && !isAnalyzing) {
      runAnalysis(audioFile);
    }
  }, [audioFile, isAnalyzing, runAnalysis]);

  // Handle drag and drop
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  }, [handleFileSelect]);

  // Trigger file input click
  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Re-analyze with same file
  const handleReanalyze = useCallback(() => {
    if (audioFile) {
      lastAnalyzedFileRef.current = null; // Reset to allow re-analysis
      runAnalysis(audioFile);
    }
  }, [audioFile, runAnalysis]);

  // Format file size
  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Tabs configuration
  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'loudness', label: 'Loudness' },
    { id: 'frequency', label: 'Frequency' },
    { id: 'stereo', label: 'Stereo' },
    { id: 'quality', label: 'Quality' }
  ];

  return (
    <div className="audio-analyzer">
      <div className="analyzer-header">
        <h2>Professional Audio Analysis</h2>
        <p className="analyzer-subtitle">Comprehensive metrics for loudness, frequency, stereo imaging, and quality</p>
      </div>

      {/* File Drop Zone */}
      {!analysisResults && !isAnalyzing && (
        <div
          className={`analyzer-dropzone ${isDragOver ? 'dragover' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleBrowseClick}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleInputChange}
            style={{ display: 'none' }}
          />
          <div className="dropzone-content">
            <div className="dropzone-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="dropzone-text">
              <strong>Drop audio file here</strong>
              <span>or click to browse</span>
            </div>
            <div className="dropzone-formats">
              Supports WAV, MP3, FLAC, AAC, OGG, and more
            </div>
          </div>
        </div>
      )}

      {/* Progress Indicator */}
      {isAnalyzing && (
        <div className="analyzer-progress">
          <div className="progress-header">
            <span>Analyzing audio...</span>
            <button className="cancel-button" onClick={cancelAnalysis}>Cancel</button>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="progress-text">{progress}%</div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="analyzer-error">
          <span className="error-icon">!</span>
          <span className="error-message">{error}</span>
          <button onClick={clearResults}>Dismiss</button>
        </div>
      )}

      {/* Analysis Results */}
      {analysisResults && !isAnalyzing && (
        <div className="analyzer-results">
          {/* File Info Bar */}
          <div className="file-info-bar">
            <div className="file-info">
              <span className="file-name">{analysisResults.file.name}</span>
              <span className="file-details">
                {formatDuration(analysisResults.file.duration)} |{' '}
                {analysisResults.file.numChannels === 1 ? 'Mono' : 'Stereo'} |{' '}
                {analysisResults.file.sampleRate / 1000} kHz |{' '}
                {formatSize(analysisResults.file.size)}
              </span>
            </div>
            <div className="file-actions">
              <button className="action-button" onClick={handleReanalyze}>
                Re-analyze
              </button>
              <button className="action-button secondary" onClick={clearResults}>
                Clear
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="analyzer-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel Grid */}
          <div className={`analyzer-panels ${activeTab}`}>
            {(activeTab === 'all' || activeTab === 'loudness') && (
              <LoudnessPanel
                loudness={analysisResults.loudness}
                targetPlatform={targetPlatform}
              />
            )}

            {(activeTab === 'all' || activeTab === 'frequency') && (
              <FrequencyPanel
                frequency={analysisResults.frequency}
              />
            )}

            {(activeTab === 'all' || activeTab === 'stereo') && (
              <StereoPanel
                stereo={analysisResults.stereo}
                leftChannel={channelDataRef.current.left}
                rightChannel={channelDataRef.current.right}
              />
            )}

            {(activeTab === 'all' || activeTab === 'quality') && (
              <QualityPanel
                quality={analysisResults.quality}
                recommendations={analysisResults.recommendations}
                targetPlatform={targetPlatform}
                onPlatformChange={changeTargetPlatform}
              />
            )}
          </div>

          {/* Analysis Timestamp */}
          <div className="analysis-timestamp">
            Analyzed at {new Date(analysisResults.analyzedAt).toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
}

AudioAnalyzer.propTypes = {
  audioFile: PropTypes.instanceOf(File),
  onFileSelect: PropTypes.func
};

export default AudioAnalyzer;
