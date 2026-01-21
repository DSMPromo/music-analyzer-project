import React, { useState, useRef, useEffect, useCallback } from 'react';
import './App.css';
import AudioInputManager from './components/AudioInputManager';
import SpectrumAnalyzer from './components/SpectrumAnalyzer';
import ChordDetector from './components/ChordDetector';
import MIDIGenerator from './components/MIDIGenerator';
import AudioAnalyzer from './components/AudioAnalyzer';
import SpectrogramView from './components/SpectrogramView';
import MixAnalysisPanel from './components/MixAnalysisPanel';
import LoudnessTimeline from './components/LoudnessTimeline';
import ReferenceCompare from './components/ReferenceCompare';
import { useAudioContext } from './hooks/useAudioContext';
import { useFFTAnalysis } from './hooks/useFFTAnalysis';
import { useSpectrogramGenerator } from './hooks/useSpectrogramGenerator';
import { useMixAnalysis } from './hooks/useMixAnalysis';

function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [detectedKey, setDetectedKey] = useState(null);
  const [estimatedTempo, setEstimatedTempo] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [aiQuery, setAiQuery] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const audioRef = useRef(null);
  const sourceRef = useRef(null);

  // Audio buffer for spectrogram (decoded from file)
  const [audioBuffer, setAudioBuffer] = useState(null);

  const { audioContext, analyser, initAudio, connectSource } = useAudioContext();

  // Spectrogram generator hook
  const {
    isGenerating: isGeneratingSpectrogram,
    progress: spectrogramProgress,
    spectrogramData,
    generateSpectrogram,
    clearSpectrogram
  } = useSpectrogramGenerator();

  // Mix analysis hook
  const {
    isAnalyzing: isAnalyzingMix,
    progress: mixAnalysisProgress,
    analysisResults: mixAnalysisResults,
    referenceBuffer,
    referenceSpectrogram,
    comparisonResults,
    analyzeMix,
    loadReferenceTrack,
    clearReference,
    getProblemMarkers
  } = useMixAnalysis();
  const {
    chromagram,
    peakFrequency,
    rmsLevel,
    startAnalysis,
    stopAnalysis,
    isAnalyzing
  } = useFFTAnalysis();

  const handleAudioSelect = async (file) => {
    setAudioFile(file);

    // Create object URL for audio playback
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    const url = URL.createObjectURL(file);
    setAudioUrl(url);

    // Reset state
    setIsPlaying(false);
    setCurrentTime(0);
    setDetectedKey(null);
    setEstimatedTempo(null);
    setAiSuggestions([]);
    clearSpectrogram();

    // Decode audio for spectrogram
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const tempContext = new AudioContextClass({ sampleRate: 44100 });
      const arrayBuffer = await file.arrayBuffer();
      const decodedBuffer = await tempContext.decodeAudioData(arrayBuffer);
      setAudioBuffer(decodedBuffer);
      await tempContext.close();
    } catch (err) {
      console.error('Error decoding audio for spectrogram:', err);
    }
  };

  const handlePlay = async () => {
    if (!audioRef.current) return;

    // Initialize audio context on first play
    let ctx = audioContext;
    if (!ctx) {
      ctx = await initAudio();
    }

    // Connect source only once
    if (ctx && !sourceRef.current && audioRef.current) {
      sourceRef.current = connectSource(audioRef.current);
    }

    // Start FFT analysis
    if (analyser && !isAnalyzing) {
      startAnalysis(analyser);
    }

    audioRef.current.play();
    setIsPlaying(true);
  };

  const handlePause = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  // Handle spectrogram seek
  const handleSpectrogramSeek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // Run mix analysis when spectrogram data is available
  useEffect(() => {
    if (spectrogramData && audioBuffer && !mixAnalysisResults) {
      analyzeMix(spectrogramData, audioBuffer);
    }
  }, [spectrogramData, audioBuffer, mixAnalysisResults, analyzeMix]);

  // Handle reference track loading
  const handleLoadReference = useCallback(async (file) => {
    await loadReferenceTrack(file, generateSpectrogram);
  }, [loadReferenceTrack, generateSpectrogram]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Detect key from chromagram
  useEffect(() => {
    if (chromagram && chromagram.length === 12) {
      const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
      const maxIdx = chromagram.indexOf(Math.max(...chromagram));
      if (chromagram[maxIdx] > 0.3) {
        // Simple major/minor detection based on chromagram pattern
        const third = chromagram[(maxIdx + 4) % 12];
        const minorThird = chromagram[(maxIdx + 3) % 12];
        const quality = third > minorThird ? 'major' : 'minor';
        setDetectedKey(`${NOTE_NAMES[maxIdx]} ${quality}`);
      }
    }
  }, [chromagram]);

  // Simple tempo estimation from RMS changes
  const rmsHistoryRef = useRef([]);
  useEffect(() => {
    if (rmsLevel > 0 && isPlaying) {
      rmsHistoryRef.current.push({ time: Date.now(), level: rmsLevel });
      // Keep last 5 seconds
      const cutoff = Date.now() - 5000;
      rmsHistoryRef.current = rmsHistoryRef.current.filter(r => r.time > cutoff);

      if (rmsHistoryRef.current.length > 20) {
        // Count peaks (simple beat detection)
        let peaks = 0;
        const levels = rmsHistoryRef.current.map(r => r.level);
        const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
        for (let i = 1; i < levels.length - 1; i++) {
          if (levels[i] > avg * 1.2 && levels[i] > levels[i-1] && levels[i] > levels[i+1]) {
            peaks++;
          }
        }
        const duration = (rmsHistoryRef.current[rmsHistoryRef.current.length - 1].time - rmsHistoryRef.current[0].time) / 1000;
        if (duration > 2) {
          const bpm = Math.round((peaks / duration) * 60);
          if (bpm > 60 && bpm < 200) {
            setEstimatedTempo(bpm);
          }
        }
      }
    }
  }, [rmsLevel, isPlaying]);

  // AI Assistant
  const handleAiQuery = async () => {
    if (!aiQuery.trim()) return;

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/claude/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery,
          key: detectedKey,
          tempo: estimatedTempo,
          context: 'User is analyzing audio in a music production app'
        }),
      });

      const data = await response.json();
      setAiSuggestions(prev => [...prev, { query: aiQuery, response: data.suggestions }]);
      setAiQuery('');
    } catch (err) {
      setAiSuggestions(prev => [...prev, { query: aiQuery, response: [{ description: 'Error', suggestion: 'Could not get AI response' }] }]);
    } finally {
      setIsAiLoading(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      stopAnalysis();
    };
  }, [audioUrl, stopAnalysis]);

  return (
    <div className="App">
      <header className="App-header">
        <h1>Music Analyzer</h1>
        <p>AI-powered music analysis with chord detection and MIDI generation</p>
      </header>

      <main className="App-main">
        <section className="input-section">
          <AudioInputManager
            onAudioReady={handleAudioSelect}
            onStreamReady={handleAudioSelect}
          />
        </section>

        {audioUrl && (
          <section className="player-section">
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={handleLoadedMetadata}
              onEnded={handleEnded}
            />
            <div className="player-controls">
              <button onClick={isPlaying ? handlePause : handlePlay}>
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <span className="time">{formatTime(currentTime)}</span>
              <input
                type="range"
                min="0"
                max={duration || 0}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="seek-bar"
              />
              <span className="time">{formatTime(duration)}</span>
            </div>

            <div className="audio-info">
              <div className="info-item">
                <strong>Key:</strong> {detectedKey || 'Detecting...'}
              </div>
              <div className="info-item">
                <strong>Tempo:</strong> {estimatedTempo ? `~${estimatedTempo} BPM` : 'Detecting...'}
              </div>
              <div className="info-item">
                <strong>Peak Freq:</strong> {Math.round(peakFrequency)} Hz
              </div>
              <div className="info-item">
                <strong>Level:</strong> {(rmsLevel * 100).toFixed(1)}%
              </div>
            </div>
          </section>
        )}

        {/* Spectrogram & Mix Analysis Section */}
        {audioBuffer && (
          <section className="spectrogram-section">
            <SpectrogramView
              audioBuffer={audioBuffer}
              currentTime={currentTime}
              duration={duration}
              isPlaying={isPlaying}
              onSeek={handleSpectrogramSeek}
              height={300}
              showStereo={true}
              problemMarkers={getProblemMarkers()}
            />

            {/* Loudness Timeline */}
            {mixAnalysisResults?.loudness && (
              <LoudnessTimeline
                loudnessData={mixAnalysisResults.loudness}
                currentTime={currentTime}
                duration={duration}
                onSeek={handleSpectrogramSeek}
                height={60}
              />
            )}

            {/* Mix Analysis & Reference Comparison Grid */}
            <div className="mix-analysis-grid">
              <MixAnalysisPanel
                analysisResults={mixAnalysisResults}
                isAnalyzing={isAnalyzingMix}
                progress={mixAnalysisProgress}
                onSeek={handleSpectrogramSeek}
              />
              <ReferenceCompare
                comparisonResults={comparisonResults}
                referenceBuffer={referenceBuffer}
                mainLoudness={mixAnalysisResults?.loudness?.integratedLUFS}
                onLoadReference={handleLoadReference}
                onClearReference={clearReference}
              />
            </div>
          </section>
        )}

        {/* Professional Audio Analyzer */}
        <section className="pro-analyzer-section">
          <AudioAnalyzer
            audioFile={audioFile}
            onFileSelect={handleAudioSelect}
          />
        </section>

        {analyser && (
          <section className="visualization-section">
            <div className="visualizers">
              <SpectrumAnalyzer
                analyser={analyser}
                width={600}
                height={200}
                showControls={true}
                showStats={true}
              />
              <ChordDetector
                chromagram={chromagram}
                showHistory={true}
                showPiano={true}
              />
            </div>
          </section>
        )}

        {audioFile && (
          <section className="analysis-section">
            <MIDIGenerator audioFile={audioFile} />
          </section>
        )}

        <section className="ai-section">
          <h2>AI Audio Engineer Assistant</h2>
          <div className="ai-chat">
            <div className="ai-messages">
              {aiSuggestions.length === 0 && (
                <p className="ai-hint">Ask questions about mixing, production, chord progressions, or get suggestions for your track.</p>
              )}
              {aiSuggestions.map((item, idx) => (
                <div key={idx} className="ai-exchange">
                  <div className="ai-query"><strong>You:</strong> {item.query}</div>
                  <div className="ai-response">
                    {item.response.map((r, i) => (
                      <div key={i} className="suggestion">
                        <strong>{r.type || r.description}:</strong> {r.suggestion}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="ai-input">
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Ask the AI assistant..."
                onKeyPress={(e) => e.key === 'Enter' && handleAiQuery()}
              />
              <button onClick={handleAiQuery} disabled={isAiLoading}>
                {isAiLoading ? 'Thinking...' : 'Ask'}
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="App-footer">
        <p>Music Analyzer - Port 56400</p>
      </footer>
    </div>
  );
}

export default App;
