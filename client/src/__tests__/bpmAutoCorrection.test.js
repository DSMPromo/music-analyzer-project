/**
 * BPM Auto-Correction Tests
 * Tests the normalizeBpm function for half-time/double-time detection fixes
 *
 * Thresholds: < 90 BPM = double, > 180 BPM = halve
 * Normal range: 90-180 (covers house, pop, DNB)
 *
 * Test case: Blinding Lights by The Weeknd
 * - True BPM: 171
 * - Often detected as: 86 (half-time)
 * - Expected: Auto-double 86 to 172
 */

import { normalizeBpm } from '../hooks/useRhythmAnalysis';

describe('BPM Auto-Correction', () => {
  describe('normalizeBpm function', () => {
    // Half-time detection (BPM < 90, should double)
    test('should double BPM when < 90 (half-time detection)', () => {
      const result = normalizeBpm(86);
      expect(result.bpm).toBe(172);
      expect(result.wasAutoCorrected).toBe(true);
      expect(result.correction).toBe('doubled');
      expect(result.originalBpm).toBe(86);
    });

    test('should double 80 BPM to 160', () => {
      const result = normalizeBpm(80);
      expect(result.bpm).toBe(160);
      expect(result.correction).toBe('doubled');
    });

    test('should double 60 BPM to 120', () => {
      const result = normalizeBpm(60);
      expect(result.bpm).toBe(120);
      expect(result.correction).toBe('doubled');
    });

    test('should double 89 BPM (just below threshold)', () => {
      const result = normalizeBpm(89);
      expect(result.bpm).toBe(178);
      expect(result.correction).toBe('doubled');
    });

    // Double-time detection (BPM > 180, should halve)
    test('should halve BPM when > 180 (double-time detection)', () => {
      const result = normalizeBpm(190);
      expect(result.bpm).toBe(95);
      expect(result.wasAutoCorrected).toBe(true);
      expect(result.correction).toBe('halved');
      expect(result.originalBpm).toBe(190);
    });

    test('should halve 200 BPM to 100', () => {
      const result = normalizeBpm(200);
      expect(result.bpm).toBe(100);
      expect(result.correction).toBe('halved');
    });

    test('should halve 181 BPM (just above threshold)', () => {
      const result = normalizeBpm(181);
      expect(result.bpm).toBe(90.5);
      expect(result.correction).toBe('halved');
    });

    // Normal range (90-180) - no correction
    test('should NOT correct BPM in normal range (90-180)', () => {
      const result = normalizeBpm(120);
      expect(result.bpm).toBe(120);
      expect(result.wasAutoCorrected).toBe(false);
      expect(result.correction).toBe(null);
    });

    test('should NOT correct 90 BPM (lower edge)', () => {
      const result = normalizeBpm(90);
      expect(result.bpm).toBe(90);
      expect(result.wasAutoCorrected).toBe(false);
    });

    test('should NOT correct 180 BPM (upper edge)', () => {
      const result = normalizeBpm(180);
      expect(result.bpm).toBe(180);
      expect(result.wasAutoCorrected).toBe(false);
    });

    test('should NOT correct 171 BPM (Blinding Lights true BPM)', () => {
      const result = normalizeBpm(171);
      expect(result.bpm).toBe(171);
      expect(result.wasAutoCorrected).toBe(false);
    });

    // Edge cases
    test('should handle null BPM', () => {
      const result = normalizeBpm(null);
      expect(result.bpm).toBe(null);
      expect(result.wasAutoCorrected).toBe(false);
    });

    test('should handle 0 BPM', () => {
      const result = normalizeBpm(0);
      expect(result.bpm).toBe(0);
      expect(result.wasAutoCorrected).toBe(false);
    });

    test('should handle negative BPM', () => {
      const result = normalizeBpm(-100);
      expect(result.bpm).toBe(-100);
      expect(result.wasAutoCorrected).toBe(false);
    });

    // Decimal precision
    test('should round to 1 decimal place (in normal range)', () => {
      const result = normalizeBpm(125.55);
      expect(result.bpm).toBe(125.6); // No correction, just rounding check
    });

    test('should round doubled value to 1 decimal', () => {
      const result = normalizeBpm(42.75);
      expect(result.bpm).toBe(85.5); // 42.75 * 2 = 85.5
    });
  });

  describe('Blinding Lights specific test', () => {
    test('Blinding Lights: 86 BPM should auto-correct to 172 BPM', () => {
      // This simulates what happens when the rhythm analyzer detects 86 BPM
      const detected = 86;
      const result = normalizeBpm(detected);

      expect(result.bpm).toBe(172);
      expect(result.wasAutoCorrected).toBe(true);
      expect(result.correction).toBe('doubled');
      expect(result.originalBpm).toBe(86);

      // Verify it's close to the true BPM of 171
      expect(Math.abs(result.bpm - 171)).toBeLessThanOrEqual(2);
    });
  });
});
