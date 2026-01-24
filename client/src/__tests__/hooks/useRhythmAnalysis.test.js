import { renderHook, act, waitFor } from '@testing-library/react';
import { useRhythmAnalysis, normalizeBpm, ANALYSIS_STATES } from '../../hooks/useRhythmAnalysis';
import * as rhythmService from '../../services/rhythmAnalysis';

// Mock the rhythm analysis service
jest.mock('../../services/rhythmAnalysis');

// Suppress console.error for expected test errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

describe('useRhythmAnalysis hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    rhythmService.checkRhythmServiceHealth.mockResolvedValue({ available: true });
    rhythmService.analyzeRhythm.mockResolvedValue({
      bpm: 120,
      bpm_confidence: 0.95,
      beats: [0, 0.5, 1.0],
      downbeats: [0],
      time_signature: 4,
      hits: [],
      swing: 50,
      duration: 180,
    });
    rhythmService.formatHitsForGrid.mockReturnValue({
      kick: [], snare: [], hihat: [], clap: [], tom: [], perc: [],
    });
  });

  describe('normalizeBpm', () => {
    it('should double BPM when below 90', () => {
      const result = normalizeBpm(86);
      expect(result.bpm).toBe(172);
      expect(result.wasAutoCorrected).toBe(true);
      expect(result.correction).toBe('doubled');
      expect(result.originalBpm).toBe(86);
    });

    it('should halve BPM when above 180', () => {
      const result = normalizeBpm(240);
      expect(result.bpm).toBe(120);
      expect(result.wasAutoCorrected).toBe(true);
      expect(result.correction).toBe('halved');
    });

    it('should not modify BPM in normal range', () => {
      const result = normalizeBpm(120);
      expect(result.bpm).toBe(120);
      expect(result.wasAutoCorrected).toBe(false);
      expect(result.correction).toBeNull();
    });

    it('should handle edge case at 90 BPM (not doubled)', () => {
      const result = normalizeBpm(90);
      expect(result.bpm).toBe(90);
      expect(result.wasAutoCorrected).toBe(false);
    });

    it('should handle edge case at 180 BPM (not halved)', () => {
      const result = normalizeBpm(180);
      expect(result.bpm).toBe(180);
      expect(result.wasAutoCorrected).toBe(false);
    });

    it('should handle null/zero BPM', () => {
      expect(normalizeBpm(null).bpm).toBe(null);
      expect(normalizeBpm(0).bpm).toBe(0);
    });
  });

  describe('initial state', () => {
    it('should have idle analysis state', () => {
      const { result } = renderHook(() => useRhythmAnalysis());

      expect(result.current.analysisState).toBe(ANALYSIS_STATES.IDLE);
      expect(result.current.isAnalyzing).toBe(false);
      expect(result.current.bpm).toBeNull();
    });
  });

  describe('analyzeWithAI', () => {
    it('should call AI-guided analysis service', async () => {
      rhythmService.analyzeWithAIGuidance.mockResolvedValue({
        bpm: 171,
        bpm_confidence: 0.98,
        beats: [0, 0.35, 0.7],
        downbeats: [0],
        time_signature: 4,
        hits: [{ time: 0, type: 'kick', confidence: 0.9 }],
        swing: 50,
        duration: 180,
        ai_analysis: {
          kick_pattern: '4-on-the-floor',
          hihat_pattern: '16th notes',
          hihat_per_bar: 16,
          confidence: 0.85,
        },
        detected_genre: 'synthwave',
      });

      const { result } = renderHook(() => useRhythmAnalysis());

      // Wait for initial mount effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      await act(async () => {
        await result.current.analyzeWithAI(mockFile, { modelTier: 'free' });
      });

      expect(rhythmService.analyzeWithAIGuidance).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({
          modelTier: 'free',
          useCache: true,
        })
      );

      expect(result.current.bpm).toBe(171);
      expect(result.current.analysisMethod).toBe('ai-guided');
      expect(result.current.aiAnalysis).toEqual(
        expect.objectContaining({
          hihat_pattern: '16th notes',
        })
      );
    });

    it('should handle service unavailable', async () => {
      rhythmService.checkRhythmServiceHealth.mockResolvedValue({ available: false });

      const { result } = renderHook(() => useRhythmAnalysis());

      // Wait for initial mount effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      await act(async () => {
        const analysisResult = await result.current.analyzeWithAI(mockFile);
        expect(analysisResult).toBeNull();
      });

      expect(result.current.analysisState).toBe(ANALYSIS_STATES.SERVICE_UNAVAILABLE);
    });

    it('should handle analysis errors', async () => {
      rhythmService.analyzeWithAIGuidance.mockRejectedValue(new Error('Gemini API error'));

      const { result } = renderHook(() => useRhythmAnalysis());

      // Wait for initial mount effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      await act(async () => {
        await result.current.analyzeWithAI(mockFile);
      });

      expect(result.current.analysisState).toBe(ANALYSIS_STATES.ERROR);
      expect(result.current.analysisError).toContain('Gemini API error');
    });
  });

  describe('fetchAiCacheStatus', () => {
    it('should fetch and store cache status', async () => {
      rhythmService.getAICacheStatus.mockResolvedValue({
        cache_enabled: true,
        total_entries: 5,
        entries: [
          { cache_key: 'abc', bpm: 120 },
        ],
      });

      const { result } = renderHook(() => useRhythmAnalysis());

      // Wait for initial mount effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await act(async () => {
        await result.current.fetchAiCacheStatus();
      });

      expect(result.current.aiCacheStatus).toEqual(
        expect.objectContaining({
          cache_enabled: true,
          total_entries: 5,
        })
      );
    });

    it('should handle fetch errors gracefully', async () => {
      rhythmService.getAICacheStatus.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useRhythmAnalysis());

      // Wait for initial mount effects
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      await act(async () => {
        const status = await result.current.fetchAiCacheStatus();
        expect(status).toBeNull();
      });

      // Should not throw
      expect(result.current.aiCacheStatus).toBeNull();
    });
  });
});
