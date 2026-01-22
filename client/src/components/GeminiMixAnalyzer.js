import React, { useState, useEffect, useRef, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.js';
import {
  analyzeWithGemini,
  sendChatMessage,
  clearChatSession,
  checkGeminiHealth,
  getPresetsForMode,
  SEGMENT_PRESETS,
  getSegmentTimes,
  AVAILABLE_MODELS
} from '../services/geminiAnalysis';

/**
 * GeminiMixAnalyzer - AI-powered mix analysis component
 *
 * Features:
 * - Model selection dropdown
 * - Engineer vs Producer mode toggle
 * - Multi-turn chat conversations
 * - Two-column layout (controls | chat)
 * - WaveSurfer waveform with region selection
 */
function GeminiMixAnalyzer({ audioFile, audioBuffer, onSeek }) {
  // Service state
  const [isServiceAvailable, setIsServiceAvailable] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [error, setError] = useState(null);

  // Analysis state
  const [analysisResult, setAnalysisResult] = useState(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('full');
  const [customSegmentStart, setCustomSegmentStart] = useState('');
  const [customSegmentEnd, setCustomSegmentEnd] = useState('');
  const [showSpectrogram, setShowSpectrogram] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  // New feature state
  const [selectedModel, setSelectedModel] = useState('gemini-2.0-flash');
  const [analysisMode, setAnalysisMode] = useState('engineer'); // 'engineer' | 'producer'
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]); // Chat history
  const [chatInput, setChatInput] = useState('');

  // Refs
  const fileInputRef = useRef(null);
  const chatContainerRef = useRef(null);
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const regionsRef = useRef(null);

  // Get the active file (uploaded or passed via props)
  const activeFile = uploadedFile || audioFile;
  const duration = audioBuffer?.duration || 0;

  // Check service health on mount
  useEffect(() => {
    const checkHealth = async () => {
      const healthy = await checkGeminiHealth();
      setIsServiceAvailable(healthy);
    };
    checkHealth();
  }, []);

  // Initialize WaveSurfer when audio file changes
  useEffect(() => {
    if (!activeFile || !waveformRef.current) return;

    // Destroy existing instance
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    // Create new WaveSurfer instance
    const ws = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4a5568',
      progressColor: '#e94560',
      cursorColor: '#e94560',
      height: 80,
      normalize: true,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
    });

    // Add regions plugin
    const regions = ws.registerPlugin(RegionsPlugin.create());
    regionsRef.current = regions;

    // Load audio file
    const url = URL.createObjectURL(activeFile);
    ws.load(url);

    // Enable region creation on drag after decode
    ws.on('decode', () => {
      regions.enableDragSelection({
        color: 'rgba(233, 69, 96, 0.3)',
      });
    });

    // Update segment times when region changes
    regions.on('region-updated', (region) => {
      setCustomSegmentStart(formatTime(region.start));
      setCustomSegmentEnd(formatTime(region.end));
      setSelectedSegment('custom');
    });

    // Sync click-to-seek with parent if onSeek is provided
    ws.on('click', (relativeX) => {
      const time = relativeX * ws.getDuration();
      if (onSeek) onSeek(time);
    });

    wavesurferRef.current = ws;

    return () => {
      URL.revokeObjectURL(url);
      ws.destroy();
    };
  }, [activeFile, onSeek]);

  // Update waveform region when segment selection changes
  useEffect(() => {
    if (!regionsRef.current || !wavesurferRef.current) return;
    if (!wavesurferRef.current.getDuration()) return;

    regionsRef.current.clearRegions();

    if (selectedSegment === 'full') return;

    const wsDuration = wavesurferRef.current.getDuration();
    let start, end;

    if (selectedSegment === 'custom') {
      start = parseTime(customSegmentStart);
      end = parseTime(customSegmentEnd);
    } else {
      const times = getSegmentTimes(selectedSegment, wsDuration);
      start = times.start;
      end = times.end;
    }

    if (start !== null && end !== null && start < end) {
      regionsRef.current.addRegion({
        start,
        end,
        color: 'rgba(233, 69, 96, 0.3)',
        drag: true,
        resize: true,
      });
    }
  }, [selectedSegment, customSegmentStart, customSegmentEnd]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    if (seconds === null || seconds === undefined) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse time string to seconds
  const parseTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    }
    return parseFloat(timeStr) || null;
  };

  // Get segment times based on selection
  const getActiveSegmentTimes = useCallback(() => {
    if (selectedSegment === 'full') {
      return { start: null, end: null };
    }
    if (selectedSegment === 'custom') {
      return {
        start: parseTime(customSegmentStart),
        end: parseTime(customSegmentEnd)
      };
    }
    return getSegmentTimes(selectedSegment, duration);
  }, [selectedSegment, customSegmentStart, customSegmentEnd, duration]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setAnalysisResult(null);
      setError(null);
      setMessages([]);
      setSessionId(null);
    }
  };

  // Handle new session (clear chat)
  const handleNewSession = async () => {
    if (sessionId) {
      try {
        await clearChatSession(sessionId);
      } catch (err) {
        // Ignore errors
      }
    }
    setMessages([]);
    setSessionId(null);
    setAnalysisResult(null);
  };

  // Handle analysis
  const handleAnalyze = async (presetKey = null, segmentOverride = null) => {
    if (!activeFile) {
      setError('No audio file selected');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const presets = getPresetsForMode(analysisMode);
      const prompt = presetKey
        ? presets[presetKey]?.prompt || presets.general?.prompt
        : customPrompt || (analysisMode === 'engineer'
            ? presets.general.prompt
            : presets.arrangement.prompt);

      // Use segment override if provided, otherwise use current selection
      let segmentTimes;
      if (segmentOverride === 'full') {
        segmentTimes = { start: null, end: null };
      } else if (segmentOverride && segmentOverride !== 'custom') {
        segmentTimes = getSegmentTimes(segmentOverride, duration);
      } else {
        segmentTimes = getActiveSegmentTimes();
      }

      const result = await analyzeWithGemini(activeFile, {
        prompt,
        startSec: segmentTimes.start,
        endSec: segmentTimes.end,
        includeSpectrogram: true,
        model: selectedModel,
        mode: analysisMode,
        sessionId: sessionId
      });

      setAnalysisResult(result);
      setSessionId(result.session_id);

      // Add to chat messages
      setMessages(prev => [
        ...prev,
        { role: 'user', content: prompt, isPreset: !!presetKey },
        { role: 'assistant', content: result.analysis, isAnalysis: true }
      ]);

    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle chat follow-up
  const handleSendChat = async () => {
    if (!chatInput.trim() || !sessionId) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setIsSendingChat(true);
    setError(null);

    // Add user message immediately
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      const result = await sendChatMessage(sessionId, userMessage, selectedModel);
      setMessages(prev => [...prev, { role: 'assistant', content: result.response }]);
    } catch (err) {
      setError(err.message || 'Failed to send message');
      // Remove the user message if failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSendingChat(false);
    }
  };

  // Handle issue click to seek
  const handleIssueClick = (timestamp) => {
    if (!timestamp || !onSeek) return;

    const startPart = timestamp.split('-')[0].trim();
    const seconds = parseTime(startPart);
    if (seconds !== null) {
      onSeek(seconds);
      if (wavesurferRef.current) {
        wavesurferRef.current.setTime(seconds);
      }
    }
  };

  // Get current presets based on mode
  const currentPresets = getPresetsForMode(analysisMode);

  // Render service unavailable message
  if (isServiceAvailable === false) {
    return (
      <div className="gemini-analyzer gemini-unavailable">
        <h2>AI Mix Engineer</h2>
        <div className="service-warning">
          <span className="warning-icon">!</span>
          <div className="warning-text">
            <strong>Gemini Analyzer service not available</strong>
            <p>Start the service with:</p>
            <code>python gemini_analyzer.py</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="gemini-analyzer gemini-two-column">
      {/* Header with mode toggle and model selection */}
      <div className="gemini-header">
        <h2>AI Mix Engineer</h2>
        <div className="header-controls">
          {/* Mode Toggle */}
          <div className="mode-toggle">
            <button
              className={`mode-btn ${analysisMode === 'engineer' ? 'active' : ''}`}
              onClick={() => setAnalysisMode('engineer')}
            >
              Engineer
            </button>
            <button
              className={`mode-btn ${analysisMode === 'producer' ? 'active' : ''}`}
              onClick={() => setAnalysisMode('producer')}
            >
              Producer
            </button>
          </div>

          {/* Model Selection */}
          <select
            className="model-select"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>

          {/* Upload Button */}
          <button
            className="upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="gemini-content">
        {/* Left Column - Controls */}
        <div className="gemini-controls">
          {/* File Info */}
          {activeFile && (
            <div className="gemini-file-info">
              <span className="file-name">{activeFile.name}</span>
              {duration > 0 && (
                <span className="file-details">
                  {formatTime(duration)} | {audioBuffer?.sampleRate || 44100}Hz
                </span>
              )}
            </div>
          )}

          {/* WaveSurfer Waveform */}
          {activeFile && (
            <div className="waveform-container">
              <div ref={waveformRef} className="waveform"></div>
              <div className="waveform-hint">Drag to select a region for analysis</div>
            </div>
          )}

          {/* Segment Selection */}
          <div className="gemini-segment-section">
            <label>Analyze Segment:</label>
            <div className="segment-buttons">
              <button
                className={`segment-btn ${selectedSegment === 'full' ? 'active' : ''}`}
                onClick={() => setSelectedSegment('full')}
                disabled={isAnalyzing}
              >
                Full Track
              </button>
              {Object.entries(SEGMENT_PRESETS).map(([key, preset]) => (
                <button
                  key={key}
                  className={`segment-btn ${selectedSegment === key ? 'active' : ''}`}
                  onClick={() => setSelectedSegment(key)}
                  disabled={isAnalyzing}
                >
                  {preset.label}
                </button>
              ))}
              <button
                className={`segment-btn ${selectedSegment === 'custom' ? 'active' : ''}`}
                onClick={() => setSelectedSegment('custom')}
                disabled={isAnalyzing}
              >
                Custom
              </button>
            </div>

            {selectedSegment === 'custom' && (
              <div className="custom-segment-inputs">
                <input
                  type="text"
                  placeholder="Start (0:45)"
                  value={customSegmentStart}
                  onChange={(e) => setCustomSegmentStart(e.target.value)}
                />
                <span>to</span>
                <input
                  type="text"
                  placeholder="End (1:30)"
                  value={customSegmentEnd}
                  onChange={(e) => setCustomSegmentEnd(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Metrics Display (if analysis exists) */}
          {analysisResult?.metrics && (
            <div className="gemini-metrics">
              <div className="metric">
                <span className="metric-label">LUFS</span>
                <span className="metric-value">{analysisResult.metrics.lufs_integrated}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Peak</span>
                <span className="metric-value">{analysisResult.metrics.true_peak_db}dBTP</span>
              </div>
              <div className="metric">
                <span className="metric-label">DR</span>
                <span className="metric-value">{analysisResult.metrics.crest_factor_db}dB</span>
              </div>
              <div className="metric">
                <span className="metric-label">Stereo</span>
                <span className="metric-value">{analysisResult.metrics.stereo_correlation}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Brightness</span>
                <span className="metric-value">{analysisResult.metrics.spectral_centroid_hz}Hz</span>
              </div>
            </div>
          )}

          {/* Custom Prompt */}
          <div className="gemini-prompt-section">
            <input
              type="text"
              className="custom-prompt-input"
              placeholder={analysisMode === 'engineer'
                ? "Custom prompt (e.g., 'Focus on the low end balance...')"
                : "Custom prompt (e.g., 'Suggest arrangement changes...')"
              }
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAnalyze()}
            />
          </div>

          {/* Quick Analysis Buttons */}
          <div className="gemini-actions">
            <button
              className="analyze-btn primary"
              onClick={() => handleAnalyze()}
              disabled={isAnalyzing || !activeFile}
            >
              {isAnalyzing ? 'Analyzing...' : 'Analyze'}
            </button>

            <div className="quick-presets">
              {Object.entries(currentPresets).map(([key, preset]) => (
                <button
                  key={key}
                  className="preset-btn"
                  onClick={() => handleAnalyze(key)}
                  disabled={isAnalyzing || !activeFile}
                  title={preset.prompt}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Spectrogram Toggle */}
          {analysisResult?.spectrogram_base64 && (
            <div className="spectrogram-toggle-section">
              <button
                className="toggle-spectrogram-btn"
                onClick={() => setShowSpectrogram(!showSpectrogram)}
              >
                {showSpectrogram ? 'Hide Spectrogram' : 'Show Spectrogram'}
              </button>
              {showSpectrogram && (
                <div className="spectrogram-image">
                  <img
                    src={`data:image/png;base64,${analysisResult.spectrogram_base64}`}
                    alt="Audio spectrogram"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Chat */}
        <div className="gemini-chat">
          <div className="chat-header">
            <span>Analysis Chat</span>
            {sessionId && (
              <button className="new-session-btn" onClick={handleNewSession}>
                New Session
              </button>
            )}
          </div>

          {/* Chat Messages */}
          <div className="chat-messages" ref={chatContainerRef}>
            {messages.length === 0 ? (
              <div className="chat-empty">
                <p>Analyze your audio to start a conversation.</p>
                <p className="chat-hint">
                  {analysisMode === 'engineer'
                    ? 'Engineer mode focuses on technical mixing issues.'
                    : 'Producer mode focuses on creative arrangement ideas.'
                  }
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={idx} className={`chat-message ${msg.role}`}>
                  {msg.role === 'user' ? (
                    <div className="user-message">
                      {msg.isPreset && <span className="preset-tag">Preset</span>}
                      <p>{typeof msg.content === 'string' ? msg.content : msg.content.summary || 'Analyzing...'}</p>
                    </div>
                  ) : (
                    <div className="assistant-message">
                      {msg.isAnalysis && msg.content ? (
                        <AnalysisContent
                          analysis={msg.content}
                          onIssueClick={handleIssueClick}
                        />
                      ) : (
                        <p className="chat-response">{msg.content}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Loading States */}
            {isAnalyzing && (
              <div className="chat-message assistant">
                <div className="assistant-message loading">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                  <span>Analyzing with Gemini...</span>
                </div>
              </div>
            )}
            {isSendingChat && (
              <div className="chat-message assistant">
                <div className="assistant-message loading">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                  <span>Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="chat-error">
              <span className="error-icon">!</span>
              <span>{error}</span>
            </div>
          )}

          {/* Chat Input */}
          <div className="chat-input-container">
            <input
              type="text"
              className="chat-input"
              placeholder={sessionId
                ? "Ask a follow-up question..."
                : "Analyze audio first to enable chat"
              }
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
              disabled={!sessionId || isSendingChat}
            />
            <button
              className="send-btn"
              onClick={handleSendChat}
              disabled={!sessionId || !chatInput.trim() || isSendingChat}
            >
              Send
            </button>
          </div>

          {/* Model Info */}
          <div className="model-info">
            Model: {selectedModel} | Mode: {analysisMode}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * AnalysisContent - Renders structured analysis results
 */
function AnalysisContent({ analysis, onIssueClick }) {
  if (!analysis) return null;

  return (
    <div className="analysis-content">
      {/* Commercial Ready Badge */}
      <div className={`commercial-badge ${analysis.is_commercial_ready ? 'ready' : 'not-ready'}`}>
        {analysis.is_commercial_ready ? 'Commercial Ready' : 'Needs Work'}
        <span className="confidence">({analysis.confidence_0_100}% confidence)</span>
      </div>

      {/* Summary */}
      <div className="analysis-summary">
        <p>{analysis.summary}</p>
        <div className="genre-tag">
          Genre: {analysis.genre_assumptions}
        </div>
      </div>

      {/* Issues */}
      {analysis.top_issues && analysis.top_issues.length > 0 ? (
        <div className="analysis-issues">
          <h4>Issues Found ({analysis.top_issues.length})</h4>
          <div className="issues-list">
            {analysis.top_issues.map((issue, idx) => (
              <div key={idx} className="issue-card">
                <div className="issue-header">
                  <span className="issue-number">{idx + 1}</span>
                  <span className="issue-description">{issue.description}</span>
                </div>
                {issue.frequency_range && (
                  <div className="issue-freq">
                    Frequency: {issue.frequency_range}
                  </div>
                )}
                <div className="issue-fix">
                  <strong>Fix:</strong> {issue.fix}
                </div>
                {issue.timestamp && (
                  <button
                    className="issue-timestamp-btn"
                    onClick={() => onIssueClick(issue.timestamp)}
                  >
                    {issue.timestamp}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="no-issues">
          <span className="check-icon">&#10003;</span>
          <p>No significant issues detected. Mix looks good!</p>
        </div>
      )}
    </div>
  );
}

export default GeminiMixAnalyzer;
