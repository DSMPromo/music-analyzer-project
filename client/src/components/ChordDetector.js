import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { jsPDF } from 'jspdf';
import { useChordDetection } from '../hooks/useChordDetection';
import { useAdvancedChordDetection } from '../hooks/useAdvancedChordDetection';

// Drum to note mapping for Rhythmic Mode
const DRUM_NOTE_MAP = {
  kick: 'C',
  snare: 'G',
  hihat: 'D',
  clap: 'A',
  tom: 'E',
  perc: 'B',
};

function ChordDetector({
  chromagram,
  chromagramByOctave,
  showHistory,
  showDiagram,
  showPiano,
  tempo,
  detectedKey,
  // Rhythmic mode props
  drumHits,
  currentTimeMs,
  isPlaying,
  // Advanced mode props
  analyser,
  stems, // { vocals, bass, drums, other } if available
}) {
  const {
    currentChord: basicChord,
    chordHistory: basicHistory,
    hasHarmonicContent,
    analyzeChromagram,
    clearHistory: clearBasicHistory,
  } = useChordDetection();

  // Advanced chord detection
  const [advancedMode, setAdvancedMode] = useState(false);
  const [autoDetect, setAutoDetect] = useState(true); // Auto-switch modes
  const [gridAlign, setGridAlign] = useState(true);   // Align chords to grid
  const [showDebug, setShowDebug] = useState(false);  // Show debug panel
  const {
    isEnabled: advancedEnabled,
    currentChord: advancedChord,
    confidence: advancedConfidence,
    chordHistory: advancedHistory,
    instrumentContributions,
    bassNote,
    chromaTotal,
    isStable,
    mode: detectionMode,
    debugInfo,
    enable: enableAdvanced,
    disable: disableAdvanced,
    reset: resetAdvanced,
    processFullMix,
    getChordSymbol,
    getConfidenceColor,
    HARMONIC_INSTRUMENTS,
  } = useAdvancedChordDetection({
    enabled: advancedMode || autoDetect, // Enable if either mode is on
    stems
  });

  // Auto-detection: use advanced when confidence is better
  const useAdvancedResult = autoDetect
    ? (advancedConfidence > (basicChord?.confidence || 0) + 0.1)
    : advancedMode;

  // Use advanced or basic detection based on mode
  const currentChord = useAdvancedResult && advancedChord ? {
    ...advancedChord,
    symbol: `${advancedChord.root}${advancedChord.type === 'maj' ? '' : advancedChord.type}`,
    quality: advancedChord.type,
    confidence: advancedConfidence,
    source: 'advanced'
  } : basicChord ? { ...basicChord, source: 'basic' } : null;

  // Grid alignment helper - quantize timestamp to nearest beat
  const quantizeToGrid = useCallback((timestampMs) => {
    if (!tempo || !gridAlign) return timestampMs;
    const beatDurationMs = 60000 / tempo;
    const beats = Math.round(timestampMs / beatDurationMs);
    return beats * beatDurationMs;
  }, [tempo, gridAlign]);

  const chordHistory = (useAdvancedResult || advancedMode) ? advancedHistory.map(h => ({
    ...h.chord,
    symbol: `${h.chord.root}${h.chord.type === 'maj' ? '' : h.chord.type}`,
    quality: h.chord.type,
    confidence: h.confidence,
    timestamp: quantizeToGrid(h.timestamp),
    source: 'advanced'
  })) : basicHistory;

  const clearHistory = advancedMode ? resetAdvanced : clearBasicHistory;

  const [timeSignature, setTimeSignature] = useState('4/4'); // '4/4', '6/8', '3/4'
  const [voicingType, setVoicingType] = useState('root'); // 'root', 'inv1', 'inv2', 'inv3', 'shell', 'open'
  const [autoPlay, setAutoPlay] = useState(false);
  const [autoDetectVoicing, setAutoDetectVoicing] = useState(false);
  const [detectedVoicing, setDetectedVoicing] = useState(null);
  const [bassInstrument, setBassInstrument] = useState('bass'); // 'bass', 'piano'
  const [chordInstrument, setChordInstrument] = useState('piano'); // 'piano', 'pad'
  const audioContextRef = useRef(null);
  const lastPlayedChordRef = useRef(null);

  // Circle of Fifths order
  const CIRCLE_OF_FIFTHS = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
  const MINOR_CIRCLE = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'Ebm', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];

  // Enharmonic equivalents: sharps to flats mapping
  const ENHARMONIC_MAP = {
    'A#': 'Bb', 'C#': 'Db', 'D#': 'Eb', 'F#': 'F#', 'G#': 'Ab',
    'Bb': 'Bb', 'Db': 'Db', 'Eb': 'Eb', 'Ab': 'Ab', // Already flat
    'C': 'C', 'D': 'D', 'E': 'E', 'F': 'F', 'G': 'G', 'A': 'A', 'B': 'B' // Natural
  };

  // Normalize note name for Circle of Fifths comparison
  const normalizeNote = (note) => ENHARMONIC_MAP[note] || note;

  // Calculate which drums are currently active (for rhythmic circle)
  const activeDrums = useMemo(() => {
    if (!drumHits || !isPlaying) return {};

    const active = {};
    const lookbackMs = 150; // How long a hit stays "active" visually

    Object.entries(drumHits).forEach(([drumType, hits]) => {
      if (!hits || !Array.isArray(hits)) return;

      // Check if any hit is within the lookback window
      const recentHit = hits.find(hit => {
        const hitTime = hit.timestamp;
        return hitTime <= currentTimeMs && hitTime > currentTimeMs - lookbackMs;
      });

      if (recentHit) {
        active[drumType] = true;
      }
    });

    return active;
  }, [drumHits, currentTimeMs, isPlaying]);

  // Initialize AudioContext on first interaction
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  // Play a note using Web Audio API synthesis with multiple instrument options
  const playNote = useCallback((noteIndex, instrument = 'piano') => {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Calculate frequency for the note (C4 = 261.63 Hz as base)
    const baseFreq = 261.63; // C4
    const frequency = baseFreq * Math.pow(2, noteIndex / 12);

    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (instrument === 'bass') {
      // Synth bass: sawtooth with filter + sub octave
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const subOsc = ctx.createOscillator();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, now);

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(frequency / 2, now); // Sub octave

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, now);
      filter.Q.setValueAtTime(2, now);

      const oscGain = ctx.createGain();
      const subGain = ctx.createGain();
      oscGain.gain.setValueAtTime(0.3, now);
      subGain.gain.setValueAtTime(0.4, now);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(masterGain);
      subOsc.connect(subGain);
      subGain.connect(masterGain);

      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 1.5);
      subOsc.stop(now + 1.5);

    } else if (instrument === 'pad') {
      // Synth pad: detuned oscillators, slow attack
      const oscs = [0, 0.03, -0.03].map(detune => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frequency * (1 + detune), now);
        return osc;
      });

      const padFilter = ctx.createBiquadFilter();
      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(2000, now);

      const padGain = ctx.createGain();
      padGain.gain.setValueAtTime(0, now);
      padGain.gain.linearRampToValueAtTime(0.15, now + 0.3); // Slow attack
      padGain.gain.setValueAtTime(0.15, now + 2.5);
      padGain.gain.exponentialRampToValueAtTime(0.001, now + 3);

      oscs.forEach(osc => {
        osc.connect(padFilter);
        osc.start(now);
        osc.stop(now + 3);
      });
      padFilter.connect(padGain);
      padGain.connect(masterGain);
      masterGain.gain.setValueAtTime(0.3, now);

    } else {
      // Piano (default) - harmonic synthesis
      const harmonics = [1, 2, 3, 4, 5, 6];
      const harmonicGains = [1, 0.5, 0.25, 0.125, 0.0625, 0.03];

      masterGain.gain.setValueAtTime(0.3, now);

      harmonics.forEach((harmonic, i) => {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(frequency * harmonic, now);

        // ADSR envelope for piano-like decay
        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(harmonicGains[i] * 0.8, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(harmonicGains[i] * 0.3, now + 0.1);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2);

        osc.connect(gainNode);
        gainNode.connect(masterGain);

        osc.start(now);
        osc.stop(now + 2);
      });

      // Add a slight detuned oscillator for richness
      const detuned = ctx.createOscillator();
      const detunedGain = ctx.createGain();
      detuned.type = 'sine';
      detuned.frequency.setValueAtTime(frequency * 1.002, now);
      detunedGain.gain.setValueAtTime(0, now);
      detunedGain.gain.linearRampToValueAtTime(0.15, now + 0.01);
      detunedGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
      detuned.connect(detunedGain);
      detunedGain.connect(masterGain);
      detuned.start(now);
      detuned.stop(now + 1.5);
    }
  }, [getAudioContext]);

  const beatsPerBar = useMemo(() => {
    switch (timeSignature) {
      case '6/8': return 6;
      case '3/4': return 3;
      default: return 4;
    }
  }, [timeSignature]);

  // Enable/disable advanced mode
  useEffect(() => {
    if (advancedMode) {
      enableAdvanced();
    } else {
      disableAdvanced();
    }
  }, [advancedMode, enableAdvanced, disableAdvanced]);

  // Basic mode: analyze chromagram
  useEffect(() => {
    if (chromagram && !advancedMode) {
      analyzeChromagram(chromagram);
    }
  }, [chromagram, analyzeChromagram, advancedMode]);

  // Advanced mode: process with multi-instrument fusion
  useEffect(() => {
    if (!advancedMode || !analyser || !isPlaying) return;

    const interval = setInterval(() => {
      processFullMix(analyser);
    }, 50); // 20 fps

    return () => clearInterval(interval);
  }, [advancedMode, analyser, isPlaying, processFullMix]);

  const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  // Helper function to play all notes in the current voicing
  const playChordVoicing = useCallback((voicingMap) => {
    voicingMap.forEach((info, keyId) => {
      const match = keyId.match(/([A-G]#?)(\d)/);
      if (match) {
        const [, note, octave] = match;
        const noteIdx = NOTE_NAMES.indexOf(note);
        const semitonesFromC4 = (parseInt(octave) - 4) * 12 + noteIdx;
        // Use bass instrument for bass notes, chord instrument for others
        const instrument = info.label === 'Bass' ? bassInstrument : chordInstrument;
        playNote(semitonesFromC4, instrument);
      }
    });
  }, [playNote, bassInstrument, chordInstrument]);

  // Get related chords on Circle of Fifths (IV, V, vi)
  const getRelatedChords = useCallback((root) => {
    const idx = CIRCLE_OF_FIFTHS.indexOf(root);
    if (idx === -1) return [];
    return [
      CIRCLE_OF_FIFTHS[(idx + 1) % 12],  // V (clockwise)
      CIRCLE_OF_FIFTHS[(idx + 11) % 12], // IV (counter-clockwise)
      MINOR_CIRCLE[idx],                  // vi (relative minor)
    ];
  }, [CIRCLE_OF_FIFTHS, MINOR_CIRCLE]);

  // Chord intervals for voicing detection (duplicate for early reference)
  const CHORD_INTERVALS = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
  };

  // Detect voicing from audio by analyzing which octave has strongest energy for each chord tone
  const detectVoicingFromAudio = useCallback(() => {
    if (!currentChord || !chromagramByOctave) return null;

    const rootIndex = NOTE_NAMES.indexOf(currentChord.root);
    if (rootIndex === -1) return null;

    const intervals = CHORD_INTERVALS[currentChord.quality] || [0, 4, 7];
    const has7th = intervals.length > 3;

    // Find which octave has strongest energy for each chord tone
    const toneOctaves = intervals.map(interval => {
      const pitchClass = (rootIndex + interval) % 12;
      let maxOctave = 3;
      let maxEnergy = 0;

      for (let oct = 1; oct <= 6; oct++) {
        const energy = chromagramByOctave[oct]?.[pitchClass] || 0;
        if (energy > maxEnergy) {
          maxEnergy = energy;
          maxOctave = oct;
        }
      }
      return { octave: maxOctave, energy: maxEnergy, interval };
    });

    // Find the lowest sounding tone (bass note)
    const bassIdx = toneOctaves.reduce((minIdx, tone, idx, arr) => {
      // Compare by octave first, then by energy if same octave
      if (tone.octave < arr[minIdx].octave) return idx;
      if (tone.octave === arr[minIdx].octave && tone.energy > arr[minIdx].energy) return idx;
      return minIdx;
    }, 0);

    // Determine inversion based on which chord tone is in the bass
    let detected = 'root';
    let confidence = 0;

    if (bassIdx === 0) {
      detected = 'root';
      confidence = toneOctaves[0].energy;
    } else if (bassIdx === 1) {
      detected = 'inv1';
      confidence = toneOctaves[1].energy;
    } else if (bassIdx === 2) {
      detected = 'inv2';
      confidence = toneOctaves[2].energy;
    } else if (bassIdx === 3 && has7th) {
      detected = 'inv3';
      confidence = toneOctaves[3].energy;
    }

    // Check if voicing is "open" by looking at spread across octaves
    const octaveSpread = Math.max(...toneOctaves.map(t => t.octave)) - Math.min(...toneOctaves.map(t => t.octave));
    if (octaveSpread >= 2 && bassIdx === 0) {
      detected = 'open';
    }

    return {
      type: detected,
      confidence: confidence,
      toneOctaves: toneOctaves,
      bassNote: intervals[bassIdx]
    };
  }, [currentChord, chromagramByOctave, CHORD_INTERVALS]);

  // Auto-detect voicing when enabled
  useEffect(() => {
    if (!autoDetectVoicing || !currentChord || !chromagramByOctave) return;

    const detected = detectVoicingFromAudio();
    if (detected && detected.confidence > 0.3) {
      setDetectedVoicing(detected);
      setVoicingType(detected.type);
    }
  }, [autoDetectVoicing, currentChord, chromagramByOctave, detectVoicingFromAudio]);

  // Calculate bar/beat from timestamp using tempo
  const getBarBeatFromTime = useCallback((timestampMs) => {
    if (!tempo) return { bar: 0, beat: 0 };
    const beatDurationMs = 60000 / tempo;
    const totalBeats = timestampMs / beatDurationMs;
    const bar = Math.floor(totalBeats / beatsPerBar);
    const beat = Math.floor(totalBeats % beatsPerBar);
    return { bar, beat };
  }, [tempo, beatsPerBar]);

  // Current bar/beat position from playhead (calculated directly for accuracy)
  const currentBarBeat = useMemo(() => {
    if (!tempo) return { bar: 0, beat: 0 };
    const beatDurationMs = 60000 / tempo;
    const barDurationMs = beatDurationMs * beatsPerBar;
    const totalMs = currentTimeMs || 0;
    const bar = Math.floor(totalMs / barDurationMs);
    const beatInBar = Math.floor((totalMs % barDurationMs) / beatDurationMs);
    return { bar, beat: beatInBar };
  }, [currentTimeMs, tempo, beatsPerBar]);

  // Group consecutive same chords with proper timestamps
  const groupedChords = useMemo(() => {
    if (chordHistory.length === 0) return [];

    const groups = [];
    let currentGroup = {
      chord: chordHistory[0]?.symbol,
      count: 1,
      startTime: chordHistory[0]?.timestamp || 0,
      startIndex: 0
    };

    for (let i = 1; i < chordHistory.length; i++) {
      if (chordHistory[i].symbol === currentGroup.chord) {
        currentGroup.count++;
      } else {
        currentGroup.endTime = chordHistory[i]?.timestamp || currentGroup.startTime;
        groups.push(currentGroup);
        currentGroup = {
          chord: chordHistory[i].symbol,
          count: 1,
          startTime: chordHistory[i]?.timestamp || 0,
          startIndex: i
        };
      }
    }
    currentGroup.endTime = currentGroup.startTime + 1000; // Assume 1 second for last chord
    groups.push(currentGroup);

    return groups;
  }, [chordHistory]);

  // Create bar structure based on tempo and absolute time (from 0)
  const bars = useMemo(() => {
    if (!tempo) return [];

    const beatDurationMs = 60000 / tempo;
    const barDurationMs = beatDurationMs * beatsPerBar;

    // Calculate current bar from playhead position (absolute from song start)
    const currentBar = Math.floor((currentTimeMs || 0) / barDurationMs);

    // Calculate total bars to show (8 bars centered around current)
    const startBar = Math.max(0, currentBar - 3);
    const endBar = startBar + 8;

    // Create bar array from absolute time 0
    const barArray = [];
    for (let barIdx = startBar; barIdx < endBar; barIdx++) {
      const barStartMs = barIdx * barDurationMs;
      const barEndMs = barStartMs + barDurationMs;

      // Find chords that fall within this bar
      const barBeats = Array(beatsPerBar).fill(null);

      chordHistory.forEach(chord => {
        const chordTime = chord.timestamp || 0;
        if (chordTime >= barStartMs && chordTime < barEndMs) {
          const beatInBar = Math.floor((chordTime - barStartMs) / beatDurationMs);
          if (beatInBar >= 0 && beatInBar < beatsPerBar) {
            barBeats[beatInBar] = chord.symbol;
          }
        }
      });

      barArray.push({
        beats: barBeats,
        startMs: barStartMs,
        endMs: barEndMs,
        barNumber: barIdx + 1,
        isCurrentBar: barIdx === currentBar
      });
    }

    return barArray;
  }, [chordHistory, tempo, beatsPerBar, currentTimeMs]);

  // Calculate playhead position within current bar (0-100%)
  const playheadPosition = useMemo(() => {
    if (!tempo || currentTimeMs === undefined) return 0;
    const beatDurationMs = 60000 / tempo;
    const barDurationMs = beatDurationMs * beatsPerBar;
    // Position within current bar
    const positionInBar = (currentTimeMs % barDurationMs) / barDurationMs;
    return positionInBar * 100;
  }, [tempo, currentTimeMs, beatsPerBar]);

  // Get unique chords for legend
  const uniqueChords = useMemo(() => {
    const unique = [...new Set(chordHistory.map(c => c.symbol))];
    return unique.slice(0, 8); // Max 8 unique chords
  }, [chordHistory]);

  // Chord intervals for highlighting piano keys
  const CHORD_INTERVALS_MAP = {
    major: [0, 4, 7],
    minor: [0, 3, 7],
    dom7: [0, 4, 7, 10],
    maj7: [0, 4, 7, 11],
    min7: [0, 3, 7, 10],
    dim: [0, 3, 6],
    aug: [0, 4, 8],
  };

  // Tone colors for different chord functions
  const TONE_COLORS = {
    bass: '#22c55e',    // Green - Bass note (low octave)
    root: '#e94560',    // Red/Pink - Root note
    third: '#f97316',   // Orange - 3rd (major or minor)
    fifth: '#3b82f6',   // Blue - 5th
    seventh: '#a855f7', // Purple - 7th
  };

  // Get interval info (color and label)
  const getIntervalInfo = (interval) => {
    if (interval === 0) return { color: TONE_COLORS.root, label: 'R' };
    if (interval === 3) return { color: TONE_COLORS.third, label: 'm3' };
    if (interval === 4) return { color: TONE_COLORS.third, label: 'M3' };
    if (interval === 6) return { color: TONE_COLORS.fifth, label: 'd5' };
    if (interval === 7) return { color: TONE_COLORS.fifth, label: '5' };
    if (interval === 8) return { color: TONE_COLORS.fifth, label: 'a5' };
    if (interval === 10) return { color: TONE_COLORS.seventh, label: '7' };
    if (interval === 11) return { color: TONE_COLORS.seventh, label: 'M7' };
    return { color: TONE_COLORS.root, label: '' };
  };

  // Get chord voicing with colors for each note based on voicing type
  // Fixed implementation with correct octave and inversion logic
  const getChordVoicing = useMemo(() => {
    if (!currentChord) return new Map();

    const rootIndex = NOTE_NAMES.indexOf(currentChord.root);
    if (rootIndex === -1) return new Map();

    const intervals = CHORD_INTERVALS_MAP[currentChord.quality] || [0, 4, 7];
    const voicing = new Map(); // keyId -> { color, label }
    const has7th = intervals.length > 3;

    // Helper to add a note to voicing
    const addNote = (pitchClass, octave, interval, isBass = false) => {
      const noteName = NOTE_NAMES[(pitchClass + 12) % 12];
      const keyId = `${noteName}${octave}`;
      if (isBass) {
        voicing.set(keyId, { color: TONE_COLORS.bass, label: 'Bass' });
      } else {
        voicing.set(keyId, getIntervalInfo(interval));
      }
    };

    // Calculate actual pitch classes for chord tones
    const chordTones = intervals.map(interval => ({
      pitchClass: (rootIndex + interval) % 12,
      interval: interval
    }));

    // Build voicing based on type
    switch (voicingType) {
      case 'root': {
        // Bass: Root in octave 2
        addNote(rootIndex, 2, 0, true);
        // Chord: Stack in octave 3, overflow to 4 when pitch class wraps
        let oct = 3;
        let prevPitchClass = -1;
        chordTones.forEach((tone) => {
          // Move up an octave if pitch class is lower than previous (wrapped around)
          if (prevPitchClass !== -1 && tone.pitchClass <= prevPitchClass) {
            oct = 4;
          }
          addNote(tone.pitchClass, oct, tone.interval);
          prevPitchClass = tone.pitchClass;
        });
        break;
      }
      case 'inv1': {
        // Bass: 3rd in octave 2
        addNote(chordTones[1].pitchClass, 2, chordTones[1].interval, true);
        // Chord: 5th, 7th (if exists), Root (up octave)
        addNote(chordTones[2].pitchClass, 3, chordTones[2].interval); // 5th
        if (has7th) {
          // 7th - check if it should be oct 3 or 4
          const seventhOct = chordTones[3].pitchClass <= chordTones[2].pitchClass ? 4 : 3;
          addNote(chordTones[3].pitchClass, seventhOct, chordTones[3].interval);
        }
        addNote(chordTones[0].pitchClass, 4, chordTones[0].interval); // Root up
        break;
      }
      case 'inv2': {
        // Bass: 5th in octave 2
        addNote(chordTones[2].pitchClass, 2, chordTones[2].interval, true);
        // Chord: 7th (if exists), Root, 3rd (up octave)
        if (has7th) {
          addNote(chordTones[3].pitchClass, 3, chordTones[3].interval); // 7th
        }
        addNote(chordTones[0].pitchClass, has7th ? 4 : 3, chordTones[0].interval); // Root
        addNote(chordTones[1].pitchClass, 4, chordTones[1].interval); // 3rd
        break;
      }
      case 'inv3': {
        if (!has7th) break; // Only for 7th chords
        // Bass: 7th in octave 2
        addNote(chordTones[3].pitchClass, 2, chordTones[3].interval, true);
        // Chord: Root, 3rd, 5th
        addNote(chordTones[0].pitchClass, 3, chordTones[0].interval); // Root
        addNote(chordTones[1].pitchClass, 3, chordTones[1].interval); // 3rd
        // 5th - check if it should be oct 3 or 4
        const fifthOct = chordTones[2].pitchClass <= chordTones[1].pitchClass ? 4 : 3;
        addNote(chordTones[2].pitchClass, fifthOct, chordTones[2].interval);
        break;
      }
      case 'shell': {
        // Bass: Root in octave 2
        addNote(rootIndex, 2, 0, true);
        // Shell: Root, 3rd, 7th (no 5th) - jazz comping
        addNote(chordTones[0].pitchClass, 3, chordTones[0].interval); // Root
        addNote(chordTones[1].pitchClass, 3, chordTones[1].interval); // 3rd
        if (has7th) {
          // 7th in upper register
          const seventhOct = chordTones[3].pitchClass <= chordTones[1].pitchClass ? 4 : 3;
          addNote(chordTones[3].pitchClass, seventhOct, chordTones[3].interval);
        } else {
          // For triads, add 5th instead
          const fifthOct = chordTones[2].pitchClass <= chordTones[1].pitchClass ? 4 : 3;
          addNote(chordTones[2].pitchClass, fifthOct, chordTones[2].interval);
        }
        break;
      }
      case 'open': {
        // Bass: Root in octave 2
        addNote(rootIndex, 2, 0, true);
        // Open: Root-5th low (oct 3), 3rd-7th high (oct 4)
        addNote(chordTones[0].pitchClass, 3, chordTones[0].interval); // Root
        addNote(chordTones[2].pitchClass, 3, chordTones[2].interval); // 5th
        addNote(chordTones[1].pitchClass, 4, chordTones[1].interval); // 3rd (high)
        if (has7th) {
          addNote(chordTones[3].pitchClass, 4, chordTones[3].interval); // 7th (high)
        }
        break;
      }
      default:
        break;
    }

    return voicing;
  }, [currentChord, voicingType]);

  // Auto-play when chord changes
  useEffect(() => {
    if (!autoPlay || !currentChord) return;

    // Don't replay same chord
    if (lastPlayedChordRef.current === currentChord.symbol) return;
    lastPlayedChordRef.current = currentChord.symbol;

    // Play all notes in current voicing
    playChordVoicing(getChordVoicing);
  }, [currentChord, autoPlay, getChordVoicing, playChordVoicing]);

  // Drum colors for rhythmic circle
  const DRUM_COLORS = {
    kick: '#e94560',    // Red
    snare: '#3b82f6',   // Blue
    hihat: '#22c55e',   // Green
    clap: '#f97316',    // Orange
    tom: '#a855f7',     // Purple
    perc: '#eab308',    // Yellow
  };

  // Get active drum names for center display
  const activeDrumNames = useMemo(() => {
    return Object.keys(activeDrums).map(drum =>
      drum.charAt(0).toUpperCase() + drum.slice(1)
    );
  }, [activeDrums]);

  // Render Harmonic Circle of Fifths (LEFT - for chords)
  const renderHarmonicCircle = () => {
    const radius = 80;
    const innerRadius = 48;
    const centerX = 95;
    const centerY = 95;

    const getPosition = (index, r) => {
      const angle = (index * 30 - 90) * (Math.PI / 180);
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle)
      };
    };

    const rootNote = currentChord?.root || '';
    const normalizedRoot = normalizeNote(rootNote); // Convert A# to Bb, etc.
    const isMinor = currentChord?.quality?.includes('min');
    const relatedChords = getRelatedChords(normalizedRoot);

    return (
      <svg width="190" height="190" className="circle-of-fifths harmonic-circle" data-testid="circle-of-fifths">
        {/* Title */}
        <text x={centerX} y={15} textAnchor="middle" fill="#e94560" fontSize="11" fontWeight="600">
          HARMONIC
        </text>

        {/* Background circle */}
        <circle cx={centerX} cy={centerY} r={radius + 12} fill="#0a0a14" stroke="#e94560" strokeWidth="2" />

        {/* Outer ring - Major keys */}
        {CIRCLE_OF_FIFTHS.map((note, i) => {
          const pos = getPosition(i, radius);
          const isActive = normalizedRoot === note && !isMinor;
          const isRelated = relatedChords.includes(note);
          return (
            <g key={note}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 16 : 14}
                fill={isActive ? '#e94560' : isRelated ? '#0f3460' : '#16213e'}
                stroke={isActive ? '#e94560' : isRelated ? '#3b82f6' : '#0f3460'}
                strokeWidth={isActive ? 3 : isRelated ? 2 : 1}
                style={isActive ? { filter: 'drop-shadow(0 0 6px #e94560)' } : {}}
              />
              <text x={pos.x} y={pos.y} textAnchor="middle" dy="4" fill="white" fontSize="10" fontWeight={isActive ? 700 : 500}>
                {note}
              </text>
            </g>
          );
        })}

        {/* Inner ring - Minor keys */}
        {MINOR_CIRCLE.map((note, i) => {
          const pos = getPosition(i, innerRadius);
          const minorRoot = note.replace('m', '');
          const isActive = normalizedRoot === minorRoot && isMinor;
          return (
            <g key={note}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={isActive ? 12 : 10}
                fill={isActive ? '#a855f7' : '#0f3460'}
                stroke={isActive ? '#a855f7' : '#16213e'}
                strokeWidth={isActive ? 2 : 1}
                style={isActive ? { filter: 'drop-shadow(0 0 6px #a855f7)' } : {}}
              />
              <text x={pos.x} y={pos.y} textAnchor="middle" dy="3" fill="white" fontSize="7" fontWeight="500">
                {note}
              </text>
            </g>
          );
        })}

        {/* Center - chord symbol */}
        <text x={centerX} y={centerY + 5} textAnchor="middle" fill="white" fontSize="18" fontWeight="bold">
          {currentChord?.symbol || '—'}
        </text>
      </svg>
    );
  };

  // Render Rhythmic Circle (RIGHT - for drums)
  const renderRhythmicCircle = () => {
    const radius = 80;
    const centerX = 95;
    const centerY = 95;

    const getPosition = (index, r) => {
      const angle = (index * 30 - 90) * (Math.PI / 180);
      return {
        x: centerX + r * Math.cos(angle),
        y: centerY + r * Math.sin(angle)
      };
    };

    // Check if this note is mapped to an active drum
    const isNoteActiveDrum = (note) => {
      for (const [drumType, drumNote] of Object.entries(DRUM_NOTE_MAP)) {
        if (drumNote === note && activeDrums[drumType]) {
          return drumType;
        }
      }
      return null;
    };

    return (
      <svg width="190" height="190" className="circle-of-fifths rhythmic-circle" data-testid="rhythmic-circle">
        {/* Title */}
        <text x={centerX} y={15} textAnchor="middle" fill="#22c55e" fontSize="11" fontWeight="600">
          RHYTHMIC
        </text>

        {/* Background circle */}
        <circle cx={centerX} cy={centerY} r={radius + 12} fill="#0a0a14" stroke="#22c55e" strokeWidth="2" />

        {/* Drum positions on circle */}
        {CIRCLE_OF_FIFTHS.map((note, i) => {
          const pos = getPosition(i, radius);
          const activeDrum = isNoteActiveDrum(note);
          const drumColor = activeDrum ? DRUM_COLORS[activeDrum] : null;
          const hasDrumMapping = Object.values(DRUM_NOTE_MAP).includes(note);

          return (
            <g key={note}>
              <circle
                cx={pos.x}
                cy={pos.y}
                r={activeDrum ? 18 : 14}
                fill={activeDrum ? drumColor : hasDrumMapping ? '#1a1a2e' : '#0f0f1a'}
                stroke={activeDrum ? drumColor : hasDrumMapping ? '#333' : '#222'}
                strokeWidth={activeDrum ? 3 : 1}
                opacity={hasDrumMapping ? 1 : 0.3}
                style={activeDrum ? {
                  filter: `drop-shadow(0 0 10px ${drumColor})`,
                  transition: 'all 0.05s ease'
                } : {}}
              />
              <text
                x={pos.x}
                y={pos.y}
                textAnchor="middle"
                dy="4"
                fill={activeDrum ? 'white' : hasDrumMapping ? '#888' : '#444'}
                fontSize={activeDrum ? 11 : 10}
                fontWeight={activeDrum ? 700 : 400}
              >
                {note}
              </text>
              {/* Show drum name below active note */}
              {activeDrum && (
                <text x={pos.x} y={pos.y + 22} textAnchor="middle" fill={drumColor} fontSize="7" fontWeight="600">
                  {activeDrum.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}

        {/* Center - active drums */}
        <text x={centerX} y={centerY - 5} textAnchor="middle" fill="#22c55e" fontSize="12" fontWeight="bold">
          {activeDrumNames.length > 0 ? activeDrumNames.slice(0, 2).join('+') : '—'}
        </text>
        {activeDrumNames.length > 2 && (
          <text x={centerX} y={centerY + 10} textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="bold">
            +{activeDrumNames.length - 2}
          </text>
        )}
        {activeDrumNames.length === 0 && (
          <text x={centerX} y={centerY + 12} textAnchor="middle" fill="#666" fontSize="9">
            drums
          </text>
        )}
      </svg>
    );
  };

  // Generate piano keys from C1 to B5 (5 full octaves = 60 keys)
  const START_OCTAVE = 1;
  const END_OCTAVE = 6; // Up to but not including octave 6

  const renderPianoKeys = () => {
    const keys = [];
    const voicing = getChordVoicing;

    // Generate 5 full octaves (C1-B5)
    for (let octave = START_OCTAVE; octave < END_OCTAVE; octave++) {
      NOTE_NAMES.forEach((note, noteIndex) => {
        const keyId = `${note}${octave}`;
        const voiceInfo = voicing.get(keyId);
        const isChordNote = !!voiceInfo;
        const isSharp = note.includes('#');

        // Calculate semitones from C4 (middle C) for playNote
        // C4 = 0, C1 = -36, C5 = 12
        const semitonesFromC4 = (octave - 4) * 12 + noteIndex;

        const keyStyle = voiceInfo ? {
          background: `linear-gradient(180deg, ${voiceInfo.color} 0%, ${voiceInfo.color}dd 100%)`,
          boxShadow: `0 0 15px ${voiceInfo.color}80`
        } : {};

        // Determine which instrument to use when key is clicked
        const clickInstrument = voiceInfo?.label === 'Bass' ? bassInstrument : chordInstrument;

        keys.push(
          <div
            key={keyId}
            data-testid={isChordNote ? 'piano-key-active' : 'piano-key'}
            className={`piano-key ${isSharp ? 'black' : 'white'} ${isChordNote ? 'active' : ''}`}
            style={keyStyle}
            onClick={() => playNote(semitonesFromC4, isChordNote ? clickInstrument : 'piano')}
            onMouseDown={(e) => e.currentTarget.classList.add('pressed')}
            onMouseUp={(e) => e.currentTarget.classList.remove('pressed')}
            onMouseLeave={(e) => e.currentTarget.classList.remove('pressed')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                playNote(semitonesFromC4);
              }
            }}
          >
            <span className="note-name">{note}</span>
            {noteIndex === 0 && <span className="octave-num">{octave}</span>}
            {voiceInfo && <span className="voice-label">{voiceInfo.label}</span>}
          </div>
        );
      });
    }

    return keys;
  };

  // Render voicing legend
  const renderVoicingLegend = () => (
    <div className="voicing-legend">
      <span className="legend-title">Voicing:</span>
      <span className="legend-item" style={{ color: TONE_COLORS.bass }}>● Bass</span>
      <span className="legend-item" style={{ color: TONE_COLORS.root }}>● Root</span>
      <span className="legend-item" style={{ color: TONE_COLORS.third }}>● 3rd</span>
      <span className="legend-item" style={{ color: TONE_COLORS.fifth }}>● 5th</span>
      <span className="legend-item" style={{ color: TONE_COLORS.seventh }}>● 7th</span>
    </div>
  );

  // Chord colors by root note
  const CHORD_COLORS = {
    'C': '#e94560', 'D': '#f39c12', 'E': '#2ecc71', 'F': '#3498db',
    'G': '#9b59b6', 'A': '#1abc9c', 'B': '#e74c3c',
    'C#': '#c0392b', 'D#': '#d35400', 'F#': '#27ae60',
    'G#': '#8e44ad', 'A#': '#16a085'
  };

  // Get chord color based on root note
  const getChordColor = useCallback((chord) => {
    if (!chord) return 'transparent';
    const root = chord.replace(/m|7|maj|dim|aug/g, '');
    return CHORD_COLORS[root] || '#0f3460';
  }, []);

  // Convert chord to Nashville Number System
  const toNashvilleNumber = useCallback((chord, key) => {
    if (!chord || !key) return chord;

    const noteOrder = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const root = chord.replace(/m|7|maj|dim|aug/g, '');
    const quality = chord.replace(root, '');

    const keyRoot = key.replace(/m| major| minor/gi, '').trim();
    const keyIndex = noteOrder.indexOf(keyRoot);
    const chordIndex = noteOrder.indexOf(root);

    if (keyIndex === -1 || chordIndex === -1) return chord;

    let degree = ((chordIndex - keyIndex + 12) % 12);

    // Map semitones to scale degrees
    const degreeMap = { 0: '1', 2: '2', 4: '3', 5: '4', 7: '5', 9: '6', 11: '7' };
    const flatMap = { 1: 'b2', 3: 'b3', 6: 'b5', 8: 'b6', 10: 'b7' };

    let nashville = degreeMap[degree] || flatMap[degree] || degree.toString();

    // Add quality indicators
    if (quality.includes('m') && !quality.includes('maj')) {
      nashville = nashville.toLowerCase(); // minor = lowercase
    }
    if (quality.includes('7')) nashville += '7';
    if (quality.includes('dim')) nashville += '°';
    if (quality.includes('aug')) nashville += '+';

    return nashville;
  }, []);

  // Get musical notation symbol for chord
  const getMusicalNotation = (chord) => {
    if (!chord) return '';
    const root = chord.replace(/m|7|maj|dim|aug/g, '');
    const quality = chord.replace(root, '');

    let notation = root;
    if (quality.includes('m') && !quality.includes('maj')) notation += 'm';
    if (quality.includes('maj7')) notation += 'Δ7';
    else if (quality.includes('7')) notation += '7';
    if (quality.includes('dim')) notation += '°';
    if (quality.includes('aug')) notation += '+';

    return notation;
  };

  // Export chord progression to PDF
  const exportToPDF = useCallback(() => {
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;

    // Title
    pdf.setFontSize(24);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Chord Progression', margin, 20);

    // Metadata
    pdf.setFontSize(10);
    pdf.setTextColor(100, 100, 100);
    const keyText = detectedKey ? `Key: ${detectedKey}` : 'Key: Not detected';
    const tempoText = tempo ? `Tempo: ${Math.round(tempo)} BPM` : '';
    const tsText = `Time Signature: ${timeSignature}`;
    pdf.text(`${keyText}  |  ${tempoText}  |  ${tsText}`, margin, 28);
    pdf.text(`Generated: ${new Date().toLocaleDateString()}`, margin, 34);

    // Legend
    let legendY = 45;
    pdf.setFontSize(12);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Chord Legend:', margin, legendY);

    let legendX = margin;
    legendY += 8;
    uniqueChords.forEach((chord, idx) => {
      const color = getChordColor(chord);
      const rgb = hexToRgb(color);

      // Color box
      pdf.setFillColor(rgb.r, rgb.g, rgb.b);
      pdf.rect(legendX, legendY - 4, 8, 6, 'F');

      // Chord name and Nashville number
      pdf.setTextColor(40, 40, 40);
      const nashville = toNashvilleNumber(chord, detectedKey);
      pdf.setFontSize(9);
      pdf.text(`${chord} (${nashville})`, legendX + 10, legendY);

      legendX += 35;
      if (legendX > pageWidth - 50) {
        legendX = margin;
        legendY += 10;
      }
    });

    // Bar Grid
    let barY = legendY + 20;
    const barWidth = (pageWidth - margin * 2) / 4;
    const barHeight = 25;
    const beatWidth = barWidth / beatsPerBar;

    pdf.setFontSize(14);
    pdf.setTextColor(40, 40, 40);
    pdf.text('Progression (Bar Grid):', margin, barY);
    barY += 8;

    bars.forEach((bar, barIdx) => {
      const barX = margin + (barIdx % 4) * barWidth;
      const rowY = barY + Math.floor(barIdx / 4) * (barHeight + 10);

      // Bar number (use barNumber from structure or fallback to index)
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`${bar.barNumber || barIdx + 1}`, barX + 2, rowY - 2);

      // Bar outline
      pdf.setDrawColor(180, 180, 180);
      pdf.rect(barX, rowY, barWidth, barHeight);

      // Beats (use bar.beats if available, otherwise bar is the array)
      const beats = bar.beats || bar;
      beats.forEach((beat, beatIdx) => {
        const beatX = barX + beatIdx * beatWidth;

        if (beat) {
          const color = getChordColor(beat);
          const rgb = hexToRgb(color);
          pdf.setFillColor(rgb.r, rgb.g, rgb.b);
          pdf.rect(beatX, rowY, beatWidth, barHeight, 'F');

          // Chord symbol
          pdf.setTextColor(255, 255, 255);
          pdf.setFontSize(10);
          pdf.text(getMusicalNotation(beat), beatX + 2, rowY + 10);

          // Nashville number
          pdf.setFontSize(8);
          const nashville = toNashvilleNumber(beat, detectedKey);
          pdf.text(nashville, beatX + 2, rowY + 18);
        } else {
          pdf.setFillColor(240, 240, 240);
          pdf.rect(beatX, rowY, beatWidth, barHeight, 'F');
        }

        // Beat divider
        if (beatIdx > 0) {
          pdf.setDrawColor(200, 200, 200);
          pdf.line(beatX, rowY, beatX, rowY + barHeight);
        }
      });
    });

    // Nashville Number Reference
    const refY = barY + Math.ceil(bars.length / 4) * (barHeight + 10) + 20;
    if (refY < pageHeight - 30) {
      pdf.setFontSize(12);
      pdf.setTextColor(40, 40, 40);
      pdf.text('Nashville Number System Reference:', margin, refY);

      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      const refText = '1=Tonic  2=Supertonic  3=Mediant  4=Subdominant  5=Dominant  6=Submediant  7=Leading Tone';
      pdf.text(refText, margin, refY + 7);
      pdf.text('Lowercase = minor  |  ° = diminished  |  + = augmented  |  7 = seventh', margin, refY + 14);
    }

    // Save
    const filename = `chord-progression-${detectedKey || 'unknown'}-${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
  }, [bars, uniqueChords, beatsPerBar, timeSignature, tempo, detectedKey, getChordColor, toNashvilleNumber]);

  // Helper: Convert hex color to RGB
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 100, g: 100, b: 100 };
  };

  return (
    <div className="chord-detector" data-testid="chord-display">
      {/* Detection Mode Controls */}
      <div className="detection-mode-toggle">
        <div className="mode-controls-row">
          {/* Auto-Detect Toggle */}
          <label className="mode-switch" title="Automatically switch between Basic and Advanced based on confidence">
            <input
              type="checkbox"
              checked={autoDetect}
              onChange={(e) => {
                setAutoDetect(e.target.checked);
                if (e.target.checked) setAdvancedMode(false);
              }}
            />
            <span className="mode-slider auto"></span>
            <span className="mode-label">Auto</span>
          </label>

          {/* Manual Advanced Toggle */}
          <label className="mode-switch" title="Force advanced multi-instrument detection">
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => {
                setAdvancedMode(e.target.checked);
                if (e.target.checked) setAutoDetect(false);
              }}
            />
            <span className="mode-slider"></span>
            <span className="mode-label">Advanced</span>
          </label>

          {/* Grid Align Toggle */}
          <label className="mode-switch" title="Align chord changes to beat grid">
            <input
              type="checkbox"
              checked={gridAlign}
              onChange={(e) => setGridAlign(e.target.checked)}
            />
            <span className="mode-slider grid"></span>
            <span className="mode-label">Grid</span>
          </label>

          {/* Debug Toggle */}
          <button
            className={`debug-toggle ${showDebug ? 'active' : ''}`}
            onClick={() => setShowDebug(!showDebug)}
            title="Show debug information"
          >
            Debug
          </button>
        </div>

        {/* Status Info */}
        <div className="advanced-info">
          <span className={`mode-badge ${currentChord?.source || ''}`}>
            {currentChord?.source === 'advanced' ? 'Advanced' : 'Basic'}
          </span>
          {stems && <span className="mode-badge stems">Stems</span>}
          {!stems && <span className="mode-badge fullmix">Full Mix</span>}
          {bassNote && <span className="bass-note">Bass: {bassNote}</span>}
          {isStable && <span className="stable-badge">Stable</span>}
          {gridAlign && tempo && <span className="grid-badge">Grid: {Math.round(tempo)}BPM</span>}
        </div>
      </div>

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <div className="debug-panel">
          <h5>Detection Debug</h5>
          <div className="debug-grid">
            <div className="debug-item">
              <span className="debug-label">Sample Rate:</span>
              <span className="debug-value">{debugInfo.sampleRate}Hz</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">FFT Size:</span>
              <span className="debug-value">{debugInfo.fftSize}</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Avg Level:</span>
              <span className="debug-value">{(debugInfo.avgLevel * 100).toFixed(1)}%</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Primary Max:</span>
              <span className="debug-value">{(debugInfo.primaryMax * 100).toFixed(1)}%</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">Bass Max:</span>
              <span className="debug-value">{(debugInfo.bassMax * 100).toFixed(1)}%</span>
            </div>
            <div className="debug-item">
              <span className="debug-label">High Max:</span>
              <span className="debug-value">{(debugInfo.highMax * 100).toFixed(1)}%</span>
            </div>
          </div>
          {chromaTotal && (
            <div className="chroma-visual">
              <h6>Chroma (C-B)</h6>
              <div className="chroma-bars">
                {Array.from(chromaTotal).map((val, i) => (
                  <div key={i} className="chroma-bar-container">
                    <div
                      className="chroma-bar"
                      style={{
                        height: `${val * 100}%`,
                        backgroundColor: `hsl(${i * 30}, 70%, 50%)`
                      }}
                    />
                    <span className="chroma-note">
                      {['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][i]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Chord Display */}
      <div className="current-chord-section">
        <div className="current-chord-display">
          {currentChord ? (
            <>
              <span className="chord-symbol-large">{currentChord.symbol}</span>
              <div className="chord-details">
                <span className="chord-quality-tag">{currentChord.quality}</span>
                <span className="chord-confidence-bar">
                  <span
                    className="confidence-fill"
                    style={{
                      width: `${currentChord.confidence * 100}%`,
                      backgroundColor: advancedMode ? getConfidenceColor() : undefined
                    }}
                  />
                </span>
                {advancedMode && (
                  <span className="confidence-value">
                    {Math.round(currentChord.confidence * 100)}%
                  </span>
                )}
              </div>
            </>
          ) : (
            <span className="no-chord">
              {!hasHarmonicContent
                ? 'No chord sound detected (percussion only)'
                : 'Play audio to detect chords'}
            </span>
          )}
        </div>

        {/* Instrument Contributions (Advanced Mode) */}
        {advancedMode && instrumentContributions.length > 0 && (
          <div className="instrument-contributions">
            <h5>Instrument Weights</h5>
            <div className="contribution-bars">
              {instrumentContributions
                .filter(ic => ic.weight > 0.1)
                .sort((a, b) => b.weight - a.weight)
                .slice(0, 5)
                .map(ic => (
                  <div key={ic.instrument} className="contribution-item">
                    <span className="inst-name">{ic.instrument.replace('_', ' ')}</span>
                    <div className="inst-bar">
                      <div
                        className="inst-fill"
                        style={{ width: `${ic.weight * 100}%` }}
                      />
                    </div>
                    <span className="inst-value">{Math.round(ic.weight * 100)}%</span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {showHistory && chordHistory.length > 0 && (
        <div className="chord-progression-section">
          <div className="progression-header">
            <h4>Chord Progression</h4>
            <div className="header-controls">
              <div className="time-signature-select">
                {['4/4', '3/4', '6/8'].map((ts) => (
                  <button
                    key={ts}
                    className={`ts-btn ${timeSignature === ts ? 'active' : ''}`}
                    onClick={() => setTimeSignature(ts)}
                  >
                    {ts}
                  </button>
                ))}
              </div>
              <button className="clear-btn" onClick={clearHistory}>Clear</button>
              <button className="export-btn" onClick={exportToPDF} title="Export to PDF">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                PDF
              </button>
            </div>
          </div>

          {/* Chord Legend */}
          {uniqueChords.length > 0 && (
            <div className="chord-legend">
              {uniqueChords.map((chord, idx) => (
                <span
                  key={idx}
                  className="legend-item"
                  style={{ backgroundColor: getChordColor(chord) }}
                >
                  {chord}
                </span>
              ))}
            </div>
          )}

          {/* Bar Grid - tempo-synced with playhead */}
          <div className="bar-grid compact synced">
            {bars.map((bar, barIdx) => {
              // Get dominant chord for this bar (most common, or first non-null)
              const chordCounts = {};
              bar.beats.forEach(beat => {
                if (beat) chordCounts[beat] = (chordCounts[beat] || 0) + 1;
              });
              const dominantChord = Object.entries(chordCounts)
                .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

              return (
                <div
                  key={barIdx}
                  className={`bar compact ${bar.isCurrentBar ? 'current' : ''}`}
                >
                  <span className="bar-number">{bar.barNumber || barIdx + 1}</span>
                  <div
                    className={`bar-chord ${dominantChord ? 'has-chord' : 'empty'}`}
                    style={{ backgroundColor: dominantChord ? getChordColor(dominantChord) : undefined }}
                  >
                    {dominantChord || '-'}
                    {/* Playhead line for current bar */}
                    {bar.isCurrentBar && isPlaying && (
                      <div
                        className="bar-playhead"
                        style={{ left: `${playheadPosition}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
            {/* Show current position info */}
            {tempo && (
              <div className="grid-position-info">
                Bar {currentBarBeat.bar + 1} | Beat {currentBarBeat.beat + 1}
              </div>
            )}
          </div>

          {/* Recent Changes */}
          <div className="recent-changes">
            <span className="label">Recent:</span>
            {groupedChords.slice(-6).map((group, idx) => (
              <span
                key={idx}
                className="change-item"
                style={{ backgroundColor: getChordColor(group.chord) }}
              >
                {group.chord}
              </span>
            ))}
          </div>
        </div>
      )}

      {showDiagram && (
        <div className="chord-diagram" data-testid="chord-diagram">
          <div className="dual-circles">
            {/* Left: Harmonic Circle (Chords) */}
            <div className="circle-container harmonic">
              {renderHarmonicCircle()}
              <div className="circle-legend">
                <span className="legend-item" style={{ color: '#e94560' }}>● Chord Root</span>
                <span className="legend-item" style={{ color: '#3b82f6' }}>● Related</span>
                <span className="legend-item" style={{ color: '#a855f7' }}>● Minor</span>
              </div>
            </div>

            {/* Right: Rhythmic Circle (Drums) */}
            <div className="circle-container rhythmic">
              {renderRhythmicCircle()}
              <div className="circle-legend">
                <span className="legend-item" style={{ color: DRUM_COLORS.kick }}>● Kick</span>
                <span className="legend-item" style={{ color: DRUM_COLORS.snare }}>● Snare</span>
                <span className="legend-item" style={{ color: DRUM_COLORS.hihat }}>● HiHat</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPiano && (
        <div className="piano-section">
          <div className="piano-header">
            <h4>Piano Voicing</h4>
            <span className="piano-hint">Click keys to play</span>
            {renderVoicingLegend()}
          </div>

          {/* Voicing Type Selector */}
          <div className="voicing-selector">
            <span className="selector-label">Voicing:</span>
            <div className="voicing-buttons">
              <button
                className={`voicing-btn ${voicingType === 'root' ? 'active' : ''}`}
                onClick={() => setVoicingType('root')}
                title="Root position - R 3 5 7"
              >
                Root
              </button>
              <button
                className={`voicing-btn ${voicingType === 'inv1' ? 'active' : ''}`}
                onClick={() => setVoicingType('inv1')}
                title="1st inversion - 3rd in bass"
              >
                1st Inv
              </button>
              <button
                className={`voicing-btn ${voicingType === 'inv2' ? 'active' : ''}`}
                onClick={() => setVoicingType('inv2')}
                title="2nd inversion - 5th in bass"
              >
                2nd Inv
              </button>
              <button
                className={`voicing-btn ${voicingType === 'inv3' ? 'active' : ''}`}
                onClick={() => setVoicingType('inv3')}
                title="3rd inversion - 7th in bass (7th chords only)"
                disabled={!currentChord || !currentChord.quality.includes('7')}
              >
                3rd Inv
              </button>
              <button
                className={`voicing-btn ${voicingType === 'shell' ? 'active' : ''}`}
                onClick={() => setVoicingType('shell')}
                title="Shell voicing - R 3 7 (jazz style, no 5th)"
              >
                Shell
              </button>
              <button
                className={`voicing-btn ${voicingType === 'open' ? 'active' : ''}`}
                onClick={() => setVoicingType('open')}
                title="Open voicing - spread across octaves"
              >
                Open
              </button>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="playback-controls">
            <label className="auto-play-toggle">
              <input
                type="checkbox"
                checked={autoPlay}
                onChange={(e) => setAutoPlay(e.target.checked)}
              />
              <span>Auto-play chords</span>
            </label>

            <label className="auto-detect-toggle">
              <input
                type="checkbox"
                checked={autoDetectVoicing}
                onChange={(e) => setAutoDetectVoicing(e.target.checked)}
              />
              <span>Detect voicing</span>
            </label>

            <button
              className="play-chord-btn"
              onClick={() => playChordVoicing(getChordVoicing)}
              disabled={!currentChord}
              title="Play current voicing"
            >
              ▶ Play Chord
            </button>

            <div className="instrument-select">
              <label>
                Bass:
                <select value={bassInstrument} onChange={e => setBassInstrument(e.target.value)}>
                  <option value="bass">Synth Bass</option>
                  <option value="piano">Piano</option>
                </select>
              </label>
              <label>
                Chord:
                <select value={chordInstrument} onChange={e => setChordInstrument(e.target.value)}>
                  <option value="piano">Piano</option>
                  <option value="pad">Synth Pad</option>
                </select>
              </label>
            </div>
          </div>

          {/* Detected Voicing Info */}
          {autoDetectVoicing && detectedVoicing && (
            <div className="detected-voicing-info">
              <span className="detection-label">Detected:</span>
              <span className="detection-type">{detectedVoicing.type}</span>
              <span className="detection-confidence">
                ({Math.round(detectedVoicing.confidence * 100)}% confidence)
              </span>
              {detectedVoicing.toneOctaves && (
                <span className="detection-octaves">
                  Octaves: {detectedVoicing.toneOctaves.map((t, i) =>
                    `${['R', '3', '5', '7'][i]}:${t.octave}`
                  ).join(' ')}
                </span>
              )}
            </div>
          )}

          <div className="piano-keys" data-testid="piano-keys">
            {renderPianoKeys()}
          </div>

          {currentChord && (
            <div className="voicing-instructions">
              <strong>{currentChord.symbol}</strong>
              <span className="instruction-text">
                {voicingType === 'root' && 'Root position: R-3-5-7 stacked'}
                {voicingType === 'inv1' && '1st inversion: 3rd in bass'}
                {voicingType === 'inv2' && '2nd inversion: 5th in bass'}
                {voicingType === 'inv3' && '3rd inversion: 7th in bass'}
                {voicingType === 'shell' && 'Shell: R-3-7 (no 5th) - jazz comping'}
                {voicingType === 'open' && 'Open: R-5 (low) + 3-7 (high) - full sound'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ChordDetector;
