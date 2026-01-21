import React, { useState } from 'react';
import AudioInputManager from './AudioInputManager';
import SpectrumAnalyzer from './SpectrumAnalyzer';
import ChordDetector from './ChordDetector';
import MIDIGenerator from './MIDIGenerator';

function AnalysisDashboard() {
  const [audioFile, setAudioFile] = useState(null);
  const [analyser, setAnalyser] = useState(null);
  const [chromagram, setChromagram] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [detectedKey, setDetectedKey] = useState('--');
  const [tempo, setTempo] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleAudioReady = (data) => {
    setAudioFile(data);
    setDetectedKey('C major');
    setTempo(120);
  };

  const handleStreamReady = () => {
    // Handle live stream
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="dashboard" data-testid="analysis-dashboard">
      <header>
        <h1>Music Analyzer</h1>
      </header>

      <div className="main-content">
        <aside
          className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}
          data-testid="sidebar"
        >
          <button
            data-testid="sidebar-toggle"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? '>' : '<'}
          </button>

          <div className="audio-info">
            <p>Key: {detectedKey}</p>
            <p>BPM: {tempo}</p>
          </div>

          <div className="suggestions-section">
            <h3>AI Suggestions</h3>
            <p>Load audio to get recommendations</p>
          </div>
        </aside>

        <main>
          <AudioInputManager
            onAudioReady={handleAudioReady}
            onStreamReady={handleStreamReady}
          />

          <SpectrumAnalyzer
            analyser={analyser}
            width={800}
            height={300}
            showStats={true}
          />

          <ChordDetector
            chromagram={chromagram}
            showHistory={true}
          />

          <div className="playback-controls">
            <button
              onClick={handlePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>

            <div className="time-display" data-testid="time-display">
              {formatTime(currentTime)}
            </div>
          </div>

          <MIDIGenerator
            audioFile={audioFile}
            onMIDIGenerated={(data) => console.log('MIDI generated:', data)}
          />
        </main>
      </div>
    </div>
  );
}

export default AnalysisDashboard;
