import React, { useState } from 'react';

const PRESETS = {
  balanced: {
    name: 'Balanced (Recommended)',
    onset: 0.55,
    frame: 0.4,
    minNote: 80,
    minFreq: null,
    maxFreq: null,
  },
  stems: {
    name: 'Mixed/Stems',
    onset: 0.5,
    frame: 0.35,
    minNote: 70,
    minFreq: null,
    maxFreq: null,
  },
  vocals: {
    name: 'Vocals',
    onset: 0.6,
    frame: 0.5,
    minNote: 80,
    minFreq: 80,
    maxFreq: 1000,
  },
  bass: {
    name: 'Bass',
    onset: 0.5,
    frame: 0.4,
    minNote: 100,
    minFreq: 30,
    maxFreq: 300,
  },
  piano: {
    name: 'Piano/Keys',
    onset: 0.55,
    frame: 0.45,
    minNote: 70,
    minFreq: 27,
    maxFreq: 4200,
  },
  guitar: {
    name: 'Guitar',
    onset: 0.6,
    frame: 0.5,
    minNote: 80,
    minFreq: 80,
    maxFreq: 1200,
  },
  melody: {
    name: 'Melody/Lead',
    onset: 0.65,
    frame: 0.55,
    minNote: 100,
    minFreq: 200,
    maxFreq: 2000,
  },
  clean: {
    name: 'Clean (Strict)',
    onset: 0.75,
    frame: 0.65,
    minNote: 120,
    minFreq: null,
    maxFreq: null,
  },
  sensitive: {
    name: 'Sensitive (More Notes)',
    onset: 0.4,
    frame: 0.25,
    minNote: 50,
    minFreq: null,
    maxFreq: null,
  },
};

function MIDIGenerator({ audioFile, onMIDIGenerated, showAdvancedOptions = true }) {
  const [preset, setPreset] = useState('');
  const [onsetThreshold, setOnsetThreshold] = useState(0.6);
  const [frameThreshold, setFrameThreshold] = useState(0.5);
  const [minNoteLength, setMinNoteLength] = useState(100);
  const [minFreq, setMinFreq] = useState('');
  const [maxFreq, setMaxFreq] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const applyPreset = (presetKey) => {
    if (!presetKey || !PRESETS[presetKey]) {
      setPreset('');
      return;
    }
    const p = PRESETS[presetKey];
    setPreset(presetKey);
    setOnsetThreshold(p.onset);
    setFrameThreshold(p.frame);
    setMinNoteLength(p.minNote);
    setMinFreq(p.minFreq || '');
    setMaxFreq(p.maxFreq || '');
  };

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
      if (minFreq) formData.append('minFreq', minFreq);
      if (maxFreq) formData.append('maxFreq', maxFreq);

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
      <div className="presets">
        <label>
          Preset
          <select
            value={preset}
            onChange={(e) => applyPreset(e.target.value)}
            aria-label="Select Preset"
          >
            <option value="">Custom</option>
            {Object.entries(PRESETS).map(([key, p]) => (
              <option key={key} value={key}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="options">
        <label>
          Onset Threshold
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={onsetThreshold}
            onChange={(e) => {
              setOnsetThreshold(parseFloat(e.target.value));
              setPreset('');
            }}
            aria-label="Onset Threshold"
          />
          <span>{onsetThreshold.toFixed(2)}</span>
        </label>

        <label>
          Frame Threshold
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={frameThreshold}
            onChange={(e) => {
              setFrameThreshold(parseFloat(e.target.value));
              setPreset('');
            }}
            aria-label="Frame Threshold"
          />
          <span>{frameThreshold.toFixed(2)}</span>
        </label>

        <label>
          Min Note Length (ms)
          <input
            type="number"
            min="10"
            max="500"
            value={minNoteLength}
            onChange={(e) => {
              setMinNoteLength(parseInt(e.target.value) || 50);
              setPreset('');
            }}
            aria-label="Min Note Length"
          />
        </label>

        {showAdvancedOptions && (
          <>
            <label>
              Min Frequency (Hz)
              <input
                type="number"
                min="20"
                max="20000"
                placeholder="Auto"
                value={minFreq}
                onChange={(e) => {
                  setMinFreq(e.target.value);
                  setPreset('');
                }}
                aria-label="Min Frequency"
              />
            </label>

            <label>
              Max Frequency (Hz)
              <input
                type="number"
                min="20"
                max="20000"
                placeholder="Auto"
                value={maxFreq}
                onChange={(e) => {
                  setMaxFreq(e.target.value);
                  setPreset('');
                }}
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
          {result.stats && (
            <div className="stats">
              <p>Key: {result.stats.likely_key}</p>
              <p>Range: {result.stats.pitch_range?.min_note} - {result.stats.pitch_range?.max_note}</p>
              <p>Avg duration: {result.stats.duration_stats?.avg_ms}ms</p>
            </div>
          )}
          <button onClick={handleDownload} aria-label="Download">
            Download MIDI
          </button>
        </div>
      )}
    </div>
  );
}

export default MIDIGenerator;
