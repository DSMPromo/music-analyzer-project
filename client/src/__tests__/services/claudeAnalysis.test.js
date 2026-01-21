import { analyzeWithClaude, getSuggestions } from '../../services/claudeAnalysis';

// Mock fetch
global.fetch = jest.fn();

describe('claudeAnalysis service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('analyzeWithClaude', () => {
    const mockAnalysisData = {
      chordProgression: [
        { root: 'C', quality: 'major', symbol: 'C' },
        { root: 'G', quality: 'major', symbol: 'G' },
        { root: 'A', quality: 'minor', symbol: 'Am' },
        { root: 'F', quality: 'major', symbol: 'F' },
      ],
      key: 'C major',
      tempo: 120,
      structure: [
        { name: 'Intro', startBar: 1, endBar: 4 },
        { name: 'Verse', startBar: 5, endBar: 12 },
      ],
    };

    it('should send analysis data to API', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          suggestions: [
            {
              type: 'harmony',
              description: 'Chord Substitution',
              suggestion: 'Try a tritone substitution',
            },
          ],
        }),
      });

      await analyzeWithClaude(mockAnalysisData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/claude/analyze',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should return suggestions array', async () => {
      const mockSuggestions = [
        { type: 'harmony', description: 'Test', suggestion: 'Test suggestion' },
      ];

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: mockSuggestions }),
      });

      const result = await analyzeWithClaude(mockAnalysisData);

      expect(result).toEqual(mockSuggestions);
    });

    it('should include chord progression in request', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await analyzeWithClaude(mockAnalysisData);

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.chordProgression).toBeDefined();
    });

    it('should include key and tempo', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      await analyzeWithClaude(mockAnalysisData);

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.key).toBe('C major');
      expect(requestBody.tempo).toBe(120);
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal error' }),
      });

      await expect(analyzeWithClaude(mockAnalysisData)).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(analyzeWithClaude(mockAnalysisData)).rejects.toThrow('Network error');
    });
  });

  describe('getSuggestions', () => {
    it('should return formatted suggestions', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          suggestions: [
            { type: 'harmony', description: 'Chord Sub', suggestion: 'Try Em instead of G' },
            { type: 'rhythm', description: 'Syncopation', suggestion: 'Add off-beat accents' },
          ],
        }),
      });

      const result = await getSuggestions({
        chords: ['C', 'G', 'Am', 'F'],
        key: 'C major',
      });

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('harmony');
    });

    it('should filter suggestions by type', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          suggestions: [
            { type: 'harmony', description: 'Chord', suggestion: 'Test' },
            { type: 'rhythm', description: 'Beat', suggestion: 'Test' },
            { type: 'structure', description: 'Form', suggestion: 'Test' },
          ],
        }),
      });

      const result = await getSuggestions(
        { chords: ['C'], key: 'C' },
        { filterType: 'harmony' }
      );

      expect(result.every(s => s.type === 'harmony')).toBe(true);
    });

    it('should return empty array when no suggestions', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ suggestions: [] }),
      });

      const result = await getSuggestions({ chords: [], key: '' });

      expect(result).toEqual([]);
    });
  });
});
