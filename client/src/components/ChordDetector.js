import React, { useEffect } from 'react';
import { useChordDetection } from '../hooks/useChordDetection';

function ChordDetector({ chromagram, showHistory, showDiagram, showPiano }) {
  const {
    currentChord,
    chordHistory,
    analyzeChromagram,
  } = useChordDetection();

  useEffect(() => {
    if (chromagram) {
      analyzeChromagram(chromagram);
    }
  }, [chromagram, analyzeChromagram]);

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  const renderPianoKeys = () => {
    return NOTE_NAMES.map((note, index) => {
      const isActive = chromagram && chromagram[index] > 0.5;
      const isSharp = note.includes('#');

      return (
        <div
          key={note}
          data-testid={isActive ? 'piano-key-active' : 'piano-key'}
          className={`piano-key ${isSharp ? 'black' : 'white'} ${isActive ? 'active' : ''}`}
        >
          {note}
        </div>
      );
    });
  };

  return (
    <div className="chord-detector" data-testid="chord-display">
      <div className="current-chord">
        {currentChord ? (
          <>
            <span className="chord-symbol">{currentChord.symbol}</span>
            <span className="chord-quality">{currentChord.quality}</span>
            <span className="chord-confidence">
              {Math.round(currentChord.confidence * 100)}%
            </span>
          </>
        ) : (
          <span className="no-chord">No chord detected</span>
        )}
      </div>

      {showHistory && (
        <div className="chord-history">
          <h4>History</h4>
          <div className="history-list">
            {chordHistory.map((chord, index) => (
              <span key={index} className="history-chord">
                {chord.symbol}
              </span>
            ))}
          </div>
        </div>
      )}

      {showDiagram && (
        <div className="chord-diagram" data-testid="chord-diagram">
          {currentChord && (
            <div className="diagram-content">
              <p>{currentChord.symbol}</p>
            </div>
          )}
        </div>
      )}

      {showPiano && (
        <div className="piano-keys" data-testid="piano-keys">
          {renderPianoKeys()}
        </div>
      )}
    </div>
  );
}

export default ChordDetector;
