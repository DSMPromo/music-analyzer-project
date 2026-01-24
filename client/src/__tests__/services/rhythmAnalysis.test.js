import {
  checkRhythmServiceHealth,
  analyzeRhythm,
  analyzeWithAIGuidance,
  getAICacheStatus,
  deleteAICacheEntry,
  clearAICache,
} from '../../services/rhythmAnalysis';

// Mock fetch
global.fetch = jest.fn();

describe('rhythmAnalysis service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkRhythmServiceHealth', () => {
    it('should return available when service is healthy', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'ok',
          version: '1.0.0',
          beat_detection_methods: ['librosa', 'madmom'],
        }),
      });

      const result = await checkRhythmServiceHealth();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:56403/health');
      expect(result.available).toBe(true);
    });

    it('should return unavailable when service is down', async () => {
      global.fetch.mockRejectedValue(new Error('Connection refused'));

      const result = await checkRhythmServiceHealth();

      expect(result.available).toBe(false);
      expect(result.error).toContain('Connection refused');
    });
  });

  describe('analyzeRhythm', () => {
    it('should analyze audio file and return rhythm data', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          bpm: 120,
          bpm_confidence: 0.95,
          beats: [0, 0.5, 1.0, 1.5],
          downbeats: [0, 2.0],
          time_signature: 4,
          hits: [
            { time: 0, type: 'kick', confidence: 0.9 },
            { time: 0.5, type: 'snare', confidence: 0.85 },
          ],
          swing: 50,
          detected_genre: 'house',
          analysis_method: 'librosa',
          duration: 180,
        }),
      });

      const result = await analyzeRhythm(mockFile);

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:56403/analyze-rhythm',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result.bpm).toBe(120);
      expect(result.hits).toHaveLength(2);
    });

    it('should use AI endpoint when useAI option is true', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bpm: 120, hits: [] }),
      });

      await analyzeRhythm(mockFile, { useAI: true });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:56403/analyze-rhythm-ai',
        expect.any(Object)
      );
    });

    it('should throw on analysis error', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ detail: 'Analysis failed' }),
      });

      await expect(analyzeRhythm(mockFile)).rejects.toThrow('Analysis failed');
    });
  });

  describe('analyzeWithAIGuidance', () => {
    it('should call AI-guided detection endpoint', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          bpm: 171,
          bpm_confidence: 0.98,
          beats: [0, 0.35, 0.7, 1.05],
          downbeats: [0],
          hits: [
            { time: 0, type: 'kick', confidence: 0.95 },
          ],
          ai_analysis: {
            kick_pattern: '4-on-the-floor',
            hihat_pattern: '16th notes',
            hihat_per_bar: 16,
            confidence: 0.85,
          },
          detection_config: {
            hihat_grid: 'sixteenth',
            hihat_per_bar: 16,
          },
          cache_key: 'abc123',
          cached: false,
          model_tier: 'free',
        }),
      });

      const result = await analyzeWithAIGuidance(mockFile, {
        modelTier: 'free',
        useCache: true,
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:56403/analyze-with-ai',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result.ai_analysis.hihat_pattern).toBe('16th notes');
      expect(result.cache_key).toBe('abc123');
    });

    it('should pass model tier to endpoint', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bpm: 120 }),
      });

      await analyzeWithAIGuidance(mockFile, { modelTier: 'premium' });

      const formData = global.fetch.mock.calls[0][1].body;
      expect(formData.get('model_tier')).toBe('premium');
    });

    it('should handle force_reanalyze option', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ bpm: 120 }),
      });

      await analyzeWithAIGuidance(mockFile, { forceReanalyze: true });

      const formData = global.fetch.mock.calls[0][1].body;
      expect(formData.get('force_reanalyze')).toBe('true');
    });

    it('should throw on AI analysis error', async () => {
      const mockFile = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ detail: 'Gemini not available' }),
      });

      await expect(analyzeWithAIGuidance(mockFile)).rejects.toThrow('Gemini not available');
    });
  });

  describe('getAICacheStatus', () => {
    it('should return cache status and entries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          cache_enabled: true,
          cache_ttl_days: 30,
          total_entries: 5,
          total_size_kb: 12.5,
          entries: [
            {
              cache_key: 'abc123',
              source_file: 'test.wav',
              cached_at: '2026-01-24T10:00:00',
              bpm: 120,
              detected_genre: 'house',
            },
          ],
          models: {
            free: { id: 'gemini-2.0-flash', cost_per_1k: 0 },
            premium: { id: 'gemini-3-pro', cost_per_1k: 0.005 },
          },
        }),
      });

      const result = await getAICacheStatus();

      expect(global.fetch).toHaveBeenCalledWith('http://localhost:56403/ai-cache-status');
      expect(result.cache_enabled).toBe(true);
      expect(result.total_entries).toBe(5);
      expect(result.entries).toHaveLength(1);
    });

    it('should throw on error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
      });

      await expect(getAICacheStatus()).rejects.toThrow();
    });
  });

  describe('deleteAICacheEntry', () => {
    it('should delete specific cache entry', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'deleted',
          cache_key: 'abc123',
        }),
      });

      const result = await deleteAICacheEntry('abc123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:56403/ai-cache/abc123',
        { method: 'DELETE' }
      );
      expect(result.status).toBe('deleted');
    });

    it('should return not_found for missing entry', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'not_found',
          cache_key: 'nonexistent',
        }),
      });

      const result = await deleteAICacheEntry('nonexistent');

      expect(result.status).toBe('not_found');
    });
  });

  describe('clearAICache', () => {
    it('should clear all cache entries', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'cleared',
          deleted_count: 10,
        }),
      });

      const result = await clearAICache();

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:56403/ai-cache',
        { method: 'DELETE' }
      );
      expect(result.status).toBe('cleared');
      expect(result.deleted_count).toBe(10);
    });
  });
});
