// Audio Utilities

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQ = 440;
const A4_MIDI = 69;

export function freqToNote(freq) {
  const semitones = 12 * Math.log2(freq / A4_FREQ);
  const nearestSemitone = Math.round(semitones);
  const cents = Math.round((semitones - nearestSemitone) * 100);

  const midiNote = A4_MIDI + nearestSemitone;
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = ((midiNote % 12) + 12) % 12;

  return {
    note: `${NOTE_NAMES[noteIndex]}${octave}`,
    cents,
  };
}

export function noteToFreq(noteName) {
  const match = noteName.match(/^([A-G])([#b]?)(\d+)$/);
  if (!match) return 0;

  const [, note, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  let noteIndex = NOTE_NAMES.indexOf(note);
  if (accidental === '#') noteIndex += 1;
  if (accidental === 'b') noteIndex -= 1;

  const midiNote = (octave + 1) * 12 + noteIndex;
  return A4_FREQ * Math.pow(2, (midiNote - A4_MIDI) / 12);
}

export function computeChromagram(frequencyData, sampleRate) {
  const chromagram = new Array(12).fill(0);
  const fftSize = frequencyData.length * 2;

  for (let i = 1; i < frequencyData.length; i++) {
    const freq = (i * sampleRate) / fftSize;
    if (freq < 20 || freq > 5000) continue;

    const { note } = freqToNote(freq);
    const noteWithoutOctave = note.replace(/\d+$/, '');
    const pitchClass = NOTE_NAMES.indexOf(noteWithoutOctave);

    if (pitchClass >= 0 && pitchClass < 12) {
      chromagram[pitchClass] += frequencyData[i] / 255;
    }
  }

  const max = Math.max(...chromagram);
  if (max > 0) {
    for (let i = 0; i < 12; i++) {
      chromagram[i] /= max;
    }
  }

  return chromagram;
}

export function calculateRMS(data) {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const normalized = (data[i] - 128) / 128;
    sum += normalized * normalized;
  }
  return Math.sqrt(sum / data.length);
}

export function findPeakFrequency(frequencyData, sampleRate) {
  let maxValue = 0;
  let maxIndex = 0;

  for (let i = 1; i < frequencyData.length; i++) {
    if (frequencyData[i] > maxValue) {
      maxValue = frequencyData[i];
      maxIndex = i;
    }
  }

  if (maxValue === 0) return 0;

  const fftSize = frequencyData.length * 2;
  return (maxIndex * sampleRate) / fftSize;
}

export function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

export function linearToDb(linear) {
  if (linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}
