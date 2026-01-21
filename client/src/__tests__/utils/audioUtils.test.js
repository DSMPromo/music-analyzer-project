import {
  freqToNote,
  noteToFreq,
  computeChromagram,
  calculateRMS,
  findPeakFrequency,
  formatTime,
  dbToLinear,
  linearToDb,
} from '../../utils/audioUtils';

describe('audioUtils', () => {
  describe('freqToNote', () => {
    it('should convert 440 Hz to A4', () => {
      const result = freqToNote(440);

      expect(result.note).toBe('A4');
      expect(result.cents).toBe(0);
    });

    it('should convert 261.63 Hz to C4', () => {
      const result = freqToNote(261.63);

      expect(result.note).toBe('C4');
      expect(Math.abs(result.cents)).toBeLessThan(5);
    });

    it('should convert 880 Hz to A5', () => {
      const result = freqToNote(880);

      expect(result.note).toBe('A5');
      expect(result.cents).toBe(0);
    });

    it('should handle frequencies with cents offset', () => {
      const result = freqToNote(450); // Slightly sharp A4

      expect(result.note).toBe('A4');
      expect(result.cents).toBeGreaterThan(0);
    });

    it('should handle low frequencies', () => {
      const result = freqToNote(82.41); // E2

      expect(result.note).toBe('E2');
    });

    it('should handle high frequencies', () => {
      const result = freqToNote(4186); // C8

      expect(result.note).toBe('C8');
    });
  });

  describe('noteToFreq', () => {
    it('should convert A4 to 440 Hz', () => {
      const freq = noteToFreq('A4');

      expect(freq).toBeCloseTo(440, 1);
    });

    it('should convert C4 to ~261.63 Hz', () => {
      const freq = noteToFreq('C4');

      expect(freq).toBeCloseTo(261.63, 0);
    });

    it('should convert A5 to 880 Hz', () => {
      const freq = noteToFreq('A5');

      expect(freq).toBeCloseTo(880, 1);
    });

    it('should handle sharps', () => {
      const freq = noteToFreq('C#4');

      expect(freq).toBeCloseTo(277.18, 0);
    });

    it('should handle flats', () => {
      const freq = noteToFreq('Bb3');

      expect(freq).toBeCloseTo(233.08, 0);
    });
  });

  describe('computeChromagram', () => {
    it('should return array of 12 elements', () => {
      const frequencyData = new Uint8Array(1024).fill(128);
      const sampleRate = 44100;

      const chromagram = computeChromagram(frequencyData, sampleRate);

      expect(chromagram).toHaveLength(12);
    });

    it('should return normalized values between 0 and 1', () => {
      const frequencyData = new Uint8Array(1024);
      for (let i = 0; i < frequencyData.length; i++) {
        frequencyData[i] = Math.floor(Math.random() * 256);
      }
      const sampleRate = 44100;

      const chromagram = computeChromagram(frequencyData, sampleRate);

      chromagram.forEach(value => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });

    it('should handle empty frequency data', () => {
      const frequencyData = new Uint8Array(1024).fill(0);
      const sampleRate = 44100;

      const chromagram = computeChromagram(frequencyData, sampleRate);

      expect(chromagram).toHaveLength(12);
    });
  });

  describe('calculateRMS', () => {
    it('should return 0 for silent audio', () => {
      const data = new Uint8Array(256).fill(128); // 128 is silence for unsigned bytes

      const rms = calculateRMS(data);

      expect(rms).toBeCloseTo(0, 1);
    });

    it('should return positive value for audio', () => {
      const data = new Uint8Array(256);
      for (let i = 0; i < data.length; i++) {
        data[i] = 128 + Math.floor(Math.sin(i * 0.1) * 100);
      }

      const rms = calculateRMS(data);

      expect(rms).toBeGreaterThan(0);
    });

    it('should return higher value for louder audio', () => {
      const quiet = new Uint8Array(256);
      const loud = new Uint8Array(256);

      for (let i = 0; i < 256; i++) {
        quiet[i] = 128 + Math.floor(Math.sin(i * 0.1) * 20);
        loud[i] = 128 + Math.floor(Math.sin(i * 0.1) * 100);
      }

      expect(calculateRMS(loud)).toBeGreaterThan(calculateRMS(quiet));
    });
  });

  describe('findPeakFrequency', () => {
    it('should find the peak frequency bin', () => {
      const frequencyData = new Uint8Array(1024).fill(50);
      frequencyData[100] = 255; // Peak at bin 100
      const sampleRate = 44100;

      const peak = findPeakFrequency(frequencyData, sampleRate);

      expect(peak).toBeGreaterThan(0);
    });

    it('should return 0 for silent audio', () => {
      const frequencyData = new Uint8Array(1024).fill(0);
      const sampleRate = 44100;

      const peak = findPeakFrequency(frequencyData, sampleRate);

      expect(peak).toBe(0);
    });
  });

  describe('formatTime', () => {
    it('should format seconds to mm:ss', () => {
      expect(formatTime(65)).toBe('1:05');
      expect(formatTime(120)).toBe('2:00');
      expect(formatTime(0)).toBe('0:00');
    });

    it('should handle hours', () => {
      expect(formatTime(3665)).toBe('1:01:05');
    });
  });

  describe('dbToLinear', () => {
    it('should convert 0 dB to 1', () => {
      expect(dbToLinear(0)).toBeCloseTo(1, 5);
    });

    it('should convert -6 dB to ~0.5', () => {
      expect(dbToLinear(-6)).toBeCloseTo(0.5, 1);
    });

    it('should convert -20 dB to 0.1', () => {
      expect(dbToLinear(-20)).toBeCloseTo(0.1, 1);
    });
  });

  describe('linearToDb', () => {
    it('should convert 1 to 0 dB', () => {
      expect(linearToDb(1)).toBeCloseTo(0, 5);
    });

    it('should convert 0.5 to ~-6 dB', () => {
      expect(linearToDb(0.5)).toBeCloseTo(-6, 0);
    });

    it('should handle very small values', () => {
      expect(linearToDb(0.001)).toBeLessThan(-50);
    });
  });
});
