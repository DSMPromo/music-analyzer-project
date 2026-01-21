import { api, uploadAudio, extractYouTube, generateMIDI, downloadMIDI, getHealth } from '../../services/api';

// Mock fetch
global.fetch = jest.fn();

describe('api service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  describe('getHealth', () => {
    it('should call health endpoint', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ status: 'ok', timestamp: '2024-01-01' }),
      });

      const result = await getHealth();

      expect(global.fetch).toHaveBeenCalledWith('/api/health');
      expect(result.status).toBe('ok');
    });

    it('should throw on error', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(getHealth()).rejects.toThrow();
    });
  });

  describe('uploadAudio', () => {
    it('should upload audio file', async () => {
      const file = new File(['audio'], 'test.mp3', { type: 'audio/mpeg' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          filename: 'test.mp3',
          path: '/temp/test.mp3',
        }),
      });

      const result = await uploadAudio(file);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
      expect(result.success).toBe(true);
    });

    it('should throw on invalid file type', async () => {
      const file = new File(['data'], 'test.txt', { type: 'text/plain' });

      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid file type' }),
      });

      await expect(uploadAudio(file)).rejects.toThrow(/invalid/i);
    });
  });

  describe('extractYouTube', () => {
    it('should extract audio from YouTube URL', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          title: 'Test Video',
          duration: 180,
          path: '/temp/test.wav',
        }),
      });

      const result = await extractYouTube('https://www.youtube.com/watch?v=test123');

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/youtube/extract',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=test123' }),
        })
      );
      expect(result.title).toBe('Test Video');
    });

    it('should throw on invalid URL', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid YouTube URL' }),
      });

      await expect(extractYouTube('not-a-url')).rejects.toThrow(/invalid/i);
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(extractYouTube('https://youtube.com/watch?v=test')).rejects.toThrow();
    });
  });

  describe('generateMIDI', () => {
    it('should generate MIDI from audio file', async () => {
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          midiPath: '/temp/test.mid',
          notes: 50,
          events: [],
        }),
      });

      const result = await generateMIDI(file);

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/midi/generate',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(result.notes).toBe(50);
    });

    it('should pass options to API', async () => {
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });
      const options = {
        onsetThreshold: 0.6,
        frameThreshold: 0.4,
        minNoteLength: 100,
      };

      await generateMIDI(file, options);

      const callArgs = global.fetch.mock.calls[0];
      const formData = callArgs[1].body;

      expect(formData).toBeInstanceOf(FormData);
    });

    it('should handle generation errors', async () => {
      const file = new File(['audio'], 'test.wav', { type: 'audio/wav' });

      global.fetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: 'Generation failed' }),
      });

      await expect(generateMIDI(file)).rejects.toThrow();
    });
  });

  describe('downloadMIDI', () => {
    it('should download MIDI file', async () => {
      const mockBlob = new Blob(['midi data'], { type: 'audio/midi' });

      global.fetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(mockBlob),
      });

      const result = await downloadMIDI('test.mid');

      expect(global.fetch).toHaveBeenCalledWith('/api/midi/download/test.mid');
      expect(result).toBeInstanceOf(Blob);
    });

    it('should throw on file not found', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404,
      });

      await expect(downloadMIDI('nonexistent.mid')).rejects.toThrow();
    });
  });
});
