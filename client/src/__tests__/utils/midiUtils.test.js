import {
  midiNoteToName,
  nameToMidiNote,
  velocityToDb,
  createNoteEvent,
  sortNoteEvents,
  quantizeNotes,
  filterNotesByPitchRange,
} from '../../utils/midiUtils';

describe('midiUtils', () => {
  describe('midiNoteToName', () => {
    it('should convert MIDI note 60 to C4', () => {
      expect(midiNoteToName(60)).toBe('C4');
    });

    it('should convert MIDI note 69 to A4', () => {
      expect(midiNoteToName(69)).toBe('A4');
    });

    it('should convert MIDI note 21 to A0', () => {
      expect(midiNoteToName(21)).toBe('A0');
    });

    it('should convert MIDI note 108 to C8', () => {
      expect(midiNoteToName(108)).toBe('C8');
    });

    it('should handle sharps', () => {
      expect(midiNoteToName(61)).toBe('C#4');
    });
  });

  describe('nameToMidiNote', () => {
    it('should convert C4 to MIDI note 60', () => {
      expect(nameToMidiNote('C4')).toBe(60);
    });

    it('should convert A4 to MIDI note 69', () => {
      expect(nameToMidiNote('A4')).toBe(69);
    });

    it('should handle sharps', () => {
      expect(nameToMidiNote('C#4')).toBe(61);
    });

    it('should handle flats', () => {
      expect(nameToMidiNote('Db4')).toBe(61);
    });

    it('should be inverse of midiNoteToName', () => {
      for (let note = 21; note <= 108; note++) {
        const name = midiNoteToName(note);
        expect(nameToMidiNote(name)).toBe(note);
      }
    });
  });

  describe('velocityToDb', () => {
    it('should convert velocity 127 to 0 dB', () => {
      expect(velocityToDb(127)).toBeCloseTo(0, 0);
    });

    it('should convert velocity 64 to approximately -6 dB', () => {
      const db = velocityToDb(64);
      expect(db).toBeLessThan(0);
      expect(db).toBeGreaterThan(-12);
    });

    it('should convert velocity 1 to very low dB', () => {
      expect(velocityToDb(1)).toBeLessThan(-30);
    });
  });

  describe('createNoteEvent', () => {
    it('should create a note event with all properties', () => {
      const event = createNoteEvent(60, 0.5, 1.0, 100);

      expect(event).toEqual({
        pitch: 60,
        start: 0.5,
        end: 1.0,
        velocity: 100,
        duration: 0.5,
      });
    });

    it('should calculate duration correctly', () => {
      const event = createNoteEvent(60, 1.0, 2.5, 80);

      expect(event.duration).toBe(1.5);
    });

    it('should use default velocity if not provided', () => {
      const event = createNoteEvent(60, 0, 1);

      expect(event.velocity).toBe(64);
    });
  });

  describe('sortNoteEvents', () => {
    it('should sort events by start time', () => {
      const events = [
        { pitch: 60, start: 2.0, end: 2.5, velocity: 100 },
        { pitch: 64, start: 0.5, end: 1.0, velocity: 100 },
        { pitch: 67, start: 1.0, end: 1.5, velocity: 100 },
      ];

      const sorted = sortNoteEvents(events);

      expect(sorted[0].start).toBe(0.5);
      expect(sorted[1].start).toBe(1.0);
      expect(sorted[2].start).toBe(2.0);
    });

    it('should handle empty array', () => {
      expect(sortNoteEvents([])).toEqual([]);
    });

    it('should sort by pitch when start times are equal', () => {
      const events = [
        { pitch: 67, start: 0, end: 1, velocity: 100 },
        { pitch: 60, start: 0, end: 1, velocity: 100 },
        { pitch: 64, start: 0, end: 1, velocity: 100 },
      ];

      const sorted = sortNoteEvents(events);

      expect(sorted[0].pitch).toBe(60);
      expect(sorted[1].pitch).toBe(64);
      expect(sorted[2].pitch).toBe(67);
    });
  });

  describe('quantizeNotes', () => {
    it('should quantize note start times to grid', () => {
      const events = [
        { pitch: 60, start: 0.12, end: 0.5, velocity: 100 },
        { pitch: 64, start: 0.48, end: 1.0, velocity: 100 },
      ];

      const quantized = quantizeNotes(events, 0.25); // Quarter note grid

      expect(quantized[0].start).toBe(0);
      expect(quantized[1].start).toBe(0.5);
    });

    it('should preserve note duration', () => {
      const events = [
        { pitch: 60, start: 0.12, end: 0.62, velocity: 100, duration: 0.5 },
      ];

      const quantized = quantizeNotes(events, 0.25);

      expect(quantized[0].end - quantized[0].start).toBeCloseTo(0.5, 2);
    });

    it('should handle empty array', () => {
      expect(quantizeNotes([], 0.25)).toEqual([]);
    });
  });

  describe('filterNotesByPitchRange', () => {
    it('should filter notes within pitch range', () => {
      const events = [
        { pitch: 36, start: 0, end: 1, velocity: 100 }, // C2 - below range
        { pitch: 60, start: 0, end: 1, velocity: 100 }, // C4 - in range
        { pitch: 72, start: 0, end: 1, velocity: 100 }, // C5 - in range
        { pitch: 96, start: 0, end: 1, velocity: 100 }, // C7 - above range
      ];

      const filtered = filterNotesByPitchRange(events, 48, 84);

      expect(filtered).toHaveLength(2);
      expect(filtered[0].pitch).toBe(60);
      expect(filtered[1].pitch).toBe(72);
    });

    it('should include boundary notes', () => {
      const events = [
        { pitch: 48, start: 0, end: 1, velocity: 100 },
        { pitch: 84, start: 0, end: 1, velocity: 100 },
      ];

      const filtered = filterNotesByPitchRange(events, 48, 84);

      expect(filtered).toHaveLength(2);
    });

    it('should handle empty array', () => {
      expect(filterNotesByPitchRange([], 48, 84)).toEqual([]);
    });
  });
});
