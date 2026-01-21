import React, { useState } from 'react';

function MIDIGenerator({ audioFile, onMIDIGenerated, showAdvancedOptions }) {
  const [onsetThreshold, setOnsetThreshold] = useState(0.5);
  const [frameThreshold, setFrameThreshold] = useState(0.3);
  const [minNoteLength, setMinNoteLength] = useState(58);
  const [minFreq, setMinFreq] = useState(0);
  const [maxFreq, setMaxFreq] = useState(20000);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    if (!audioFile) return;

    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('onsetThreshold', onsetThreshold);
      formData.append('frameThreshold', frameThreshold);
      formData.append('minNoteLength', minNoteLength);

      const response = await fetch('/api/midi/generate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      const data = await response.json();
      setResult(data);

      if (onMIDIGenerated) {
        onMIDIGenerated(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to generate MIDI');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.midiPath) return;

    const filename = result.midiPath.split('/').pop();
    const response = await fetch(`/api/midi/download/${filename}`);
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="midi-generator">
      <div className="options">
        <label>
          Onset Threshold
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={onsetThreshold}
            onChange={(e) => setOnsetThreshold(e.target.value)}
            aria-label="Onset Threshold"
          />
          <span>{onsetThreshold}</span>
        </label>

        <label>
          Frame Threshold
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={frameThreshold}
            onChange={(e) => setFrameThreshold(e.target.value)}
            aria-label="Frame Threshold"
          />
          <span>{frameThreshold}</span>
        </label>

        <label>
          Min Note Length (ms)
          <input
            type="number"
            value={minNoteLength}
            onChange={(e) => setMinNoteLength(e.target.value)}
            aria-label="Min Note Length"
          />
        </label>

        {showAdvancedOptions && (
          <>
            <label>
              Min Frequency (Hz)
              <input
                type="number"
                value={minFreq}
                onChange={(e) => setMinFreq(e.target.value)}
                aria-label="Min Frequency"
              />
            </label>

            <label>
              Max Frequency (Hz)
              <input
                type="number"
                value={maxFreq}
                onChange={(e) => setMaxFreq(e.target.value)}
                aria-label="Max Frequency"
              />
            </label>
          </>
        )}
      </div>

      <button
        onClick={handleGenerate}
        disabled={!audioFile || isGenerating}
        aria-label="Generate MIDI"
      >
        {isGenerating ? 'Processing...' : 'Generate MIDI'}
      </button>

      {error && <p className="error">Error: {error}</p>}

      {result && (
        <div className="result">
          <p>{result.notes} notes detected</p>
          <button onClick={handleDownload} aria-label="Download">
            Download MIDI
          </button>
        </div>
      )}
    </div>
  );
}

export default MIDIGenerator;
