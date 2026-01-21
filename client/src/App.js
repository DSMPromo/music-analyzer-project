import React, { useState, useEffect } from 'react';
import './App.css';
import AudioInputManager from './components/AudioInputManager';
import SpectrumAnalyzer from './components/SpectrumAnalyzer';
import ChordDetector from './components/ChordDetector';
import AnalysisDashboard from './components/AnalysisDashboard';
import MIDIGenerator from './components/MIDIGenerator';
import { useAudioContext } from './hooks/useAudioContext';
import { useFFTAnalysis } from './hooks/useFFTAnalysis';

function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { audioContext, analyser, initAudio, connectSource } = useAudioContext();
  const { chromagram, getChromagram } = useFFTAnalysis(analyser);

  const handleAudioSelect = async (file) => {
    setAudioFile(file);
    if (!audioContext) {
      await initAudio();
    }
  };

  const handleAnalysisStart = () => {
    setIsAnalyzing(true);
  };

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
            <AnalysisDashboard audioFile={audioFile} />
            <MIDIGenerator audioFile={audioFile} />
          </section>
        )}
      </main>

      <footer className="App-footer">
        <p>Music Analyzer - Port 56400</p>
      </footer>
    </div>
  );
}

export default App;
