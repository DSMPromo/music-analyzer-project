// MIDI Utilities

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function midiNoteToName(midiNote) {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  return `${NOTE_NAMES[noteIndex]}${octave}`;
}

export function nameToMidiNote(name) {
  const match = name.match(/^([A-G])([#b]?)(\d+)$/);
  if (!match) return null;

  const [, note, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  let noteIndex = NOTE_NAMES.indexOf(note);
  if (accidental === '#') noteIndex += 1;
  if (accidental === 'b') noteIndex -= 1;

  if (noteIndex < 0) noteIndex += 12;
  if (noteIndex >= 12) noteIndex -= 12;

  return (octave + 1) * 12 + noteIndex;
}

export function velocityToDb(velocity) {
  if (velocity <= 0) return -Infinity;
  return 20 * Math.log10(velocity / 127);
}

export function createNoteEvent(pitch, start, end, velocity = 64) {
  return {
    pitch,
    start,
    end,
    velocity,
    duration: end - start,
  };
}

export function sortNoteEvents(events) {
  return [...events].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.pitch - b.pitch;
  });
}

export function quantizeNotes(events, gridSize) {
  return events.map(event => {
    const quantizedStart = Math.round(event.start / gridSize) * gridSize;
    const duration = event.end - event.start;
    return {
      ...event,
      start: quantizedStart,
      end: quantizedStart + duration,
    };
  });
}

export function filterNotesByPitchRange(events, minPitch, maxPitch) {
  return events.filter(event => event.pitch >= minPitch && event.pitch <= maxPitch);
}
