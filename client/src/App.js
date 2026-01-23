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
import GeminiMixAnalyzer from './components/GeminiMixAnalyzer';
import StemSeparator from './components/StemSeparator';
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
  const [staticPeakFreq, setStaticPeakFreq] = useState(null);
  const [staticRmsLevel, setStaticRmsLevel] = useState(null);
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
    chromagramByOctave,
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
    setStaticPeakFreq(null);
    setStaticRmsLevel(null);
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
    let currentAnalyser = analyser;
    if (!ctx) {
      const result = await initAudio();
      ctx = result.ctx;
      currentAnalyser = result.analyser;
    }

    // Connect source only once
    if (ctx && !sourceRef.current && audioRef.current) {
      sourceRef.current = connectSource(audioRef.current);
    }

    // Start FFT analysis (use currentAnalyser which is guaranteed to be set)
    if (currentAnalyser && !isAnalyzing) {
      startAnalysis(currentAnalyser);
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

  // Analyze key and tempo from full audio buffer when loaded (lightweight version)
  useEffect(() => {
    if (!audioBuffer) return;

    // Use setTimeout to avoid blocking UI during load
    const timeoutId = setTimeout(() => {
      try {
        const sampleRate = audioBuffer.sampleRate;
        const leftChannel = audioBuffer.getChannelData(0);
        const rightChannel = audioBuffer.numberOfChannels > 1
          ? audioBuffer.getChannelData(1)
          : leftChannel;

        // === KEY DETECTION (simplified) ===
        const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
        const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

        // Sample a few segments and use energy in frequency bands
        const chromagram = new Array(12).fill(0);
        const segmentSize = 4096;
        const numSegments = Math.min(20, Math.floor(leftChannel.length / segmentSize / 10));

        for (let seg = 0; seg < numSegments; seg++) {
          const startIdx = Math.floor((seg / numSegments) * (leftChannel.length - segmentSize));

          // Calculate energy for each note using simple bandpass approximation
          for (let note = 0; note < 12; note++) {
            for (let octave = 2; octave <= 5; octave++) {
              const freq = 440 * Math.pow(2, (note - 9 + (octave - 4) * 12) / 12);
              const period = Math.round(sampleRate / freq);

              if (period > 2 && startIdx + period * 4 < leftChannel.length) {
                // Simple autocorrelation at this frequency
                let corr = 0;
                for (let i = 0; i < period * 2; i++) {
                  const idx = startIdx + i;
                  corr += leftChannel[idx] * leftChannel[idx + period];
                }
                chromagram[note] += Math.max(0, corr);
              }
            }
          }
        }

        // Normalize and find best key
        const maxChroma = Math.max(...chromagram);
        if (maxChroma > 0) {
          const normChroma = chromagram.map(v => v / maxChroma);

          let bestKey = 'C major';
          let bestCorr = -Infinity;

          for (let root = 0; root < 12; root++) {
            const corrMajor = normChroma.reduce((sum, val, i) =>
              sum + val * MAJOR_PROFILE[(i - root + 12) % 12], 0);
            const corrMinor = normChroma.reduce((sum, val, i) =>
              sum + val * MINOR_PROFILE[(i - root + 12) % 12], 0);

            if (corrMajor > bestCorr) { bestCorr = corrMajor; bestKey = `${NOTE_NAMES[root]} major`; }
            if (corrMinor > bestCorr) { bestCorr = corrMinor; bestKey = `${NOTE_NAMES[root]} minor`; }
          }
          setDetectedKey(bestKey);
        }

        // === TEMPO DETECTION (energy-based, lightweight) ===
        const hopSize = 2048;  // Larger hop = fewer calculations
        const numFrames = Math.floor(leftChannel.length / hopSize);
        const energies = [];

        // Calculate RMS energy per frame
        for (let frame = 0; frame < numFrames; frame++) {
          let energy = 0;
          const start = frame * hopSize;
          for (let i = 0; i < hopSize; i++) {
            const sample = leftChannel[start + i] || 0;
            energy += sample * sample;
          }
          energies.push(Math.sqrt(energy / hopSize));
        }

        // Find peaks in energy (onsets)
        const threshold = energies.reduce((a, b) => a + b, 0) / energies.length * 1.3;
        const peakFrames = [];
        for (let i = 1; i < energies.length - 1; i++) {
          if (energies[i] > threshold && energies[i] > energies[i-1] && energies[i] >= energies[i+1]) {
            if (peakFrames.length === 0 || i - peakFrames[peakFrames.length - 1] > 3) {
              peakFrames.push(i);
            }
          }
        }

        // Calculate intervals between peaks
        if (peakFrames.length >= 8) {
          const intervals = [];
          for (let i = 1; i < peakFrames.length; i++) {
            intervals.push(peakFrames[i] - peakFrames[i - 1]);
          }

          // Find most common interval
          const histogram = {};
          intervals.forEach(interval => {
            const bin = Math.round(interval);
            histogram[bin] = (histogram[bin] || 0) + 1;
          });

          let bestInterval = 10;
          let bestCount = 0;
          for (const [bin, count] of Object.entries(histogram)) {
            if (count > bestCount) {
              bestCount = count;
              bestInterval = parseInt(bin);
            }
          }

          // Convert to BPM
          const secondsPerBeat = (bestInterval * hopSize) / sampleRate;
          let bpm = Math.round(60 / secondsPerBeat);

          // Normalize to 70-160 range
          while (bpm > 160) bpm = Math.round(bpm / 2);
          while (bpm < 70 && bpm > 0) bpm = Math.round(bpm * 2);

          if (bpm >= 70 && bpm <= 160) {
            setEstimatedTempo(bpm);
          }
        }

        // === PEAK FREQUENCY & RMS LEVEL ===
        // Calculate overall RMS level
        let sumSquares = 0;
        for (let i = 0; i < leftChannel.length; i++) {
          sumSquares += leftChannel[i] * leftChannel[i];
        }
        const rms = Math.sqrt(sumSquares / leftChannel.length);
        setStaticRmsLevel(rms);

        // Find dominant frequency using autocorrelation
        // Sample from middle of track for representative frequency
        const sampleStart = Math.floor(leftChannel.length * 0.4);
        const sampleLength = Math.min(8192, leftChannel.length - sampleStart);
        let bestFreq = 100;
        let bestCorr = 0;

        // Check frequencies from 30Hz to 500Hz (bass/low-mid range)
        for (let freq = 30; freq <= 500; freq += 5) {
          const period = Math.round(sampleRate / freq);
          if (period < sampleLength / 2) {
            let corr = 0;
            for (let i = 0; i < sampleLength - period; i++) {
              corr += leftChannel[sampleStart + i] * leftChannel[sampleStart + i + period];
            }
            if (corr > bestCorr) {
              bestCorr = corr;
              bestFreq = freq;
            }
          }
        }
        setStaticPeakFreq(bestFreq);

      } catch (err) {
        console.error('Error analyzing audio:', err);
      }
    }, 100); // Small delay to let UI render first

    return () => clearTimeout(timeoutId);
  }, [audioBuffer]);

  // Handle reference track loading
  const handleLoadReference = useCallback(async (file) => {
    await loadReferenceTrack(file, generateSpectrogram);
  }, [loadReferenceTrack, generateSpectrogram]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Note: Key and tempo are now detected from full audio buffer on load (see above)
  // Real-time detection removed to prevent unstable switching during playback

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
                <strong>Peak Freq:</strong> {Math.round(isPlaying ? peakFrequency : (staticPeakFreq || 0))} Hz
              </div>
              <div className="info-item">
                <strong>Level:</strong> {((isPlaying ? rmsLevel : (staticRmsLevel || 0)) * 100).toFixed(1)}%
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
            </div>
          </section>
        )}

        {/* Chord Detector with Piano - always visible */}
        <section className="chord-section">
          <ChordDetector
            chromagram={chromagram}
            chromagramByOctave={chromagramByOctave}
            showHistory={true}
            showPiano={true}
            showDiagram={true}
            detectedKey={detectedKey}
            tempo={estimatedTempo}
          />
        </section>

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

        {/* Gemini Mix Analyzer Section */}
        <section className="gemini-section">
          <GeminiMixAnalyzer
            audioFile={audioFile}
            audioBuffer={audioBuffer}
            onSeek={handleSpectrogramSeek}
          />
        </section>

        {/* Stem Separator Section */}
        <section className="stem-section">
          <StemSeparator audioFile={audioFile} />
        </section>
      </main>

      <footer className="App-footer">
        <p>Music Analyzer - Port 56400</p>
      </footer>
    </div>
  );
}

export default App;
