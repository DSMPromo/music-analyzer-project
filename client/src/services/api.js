// API Service

const API_BASE = '/api';

export async function getHealth() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error('Health check failed');
  }
  return response.json();
}

export async function uploadAudio(file) {
  const validTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/ogg', 'audio/flac'];
  if (!validTypes.includes(file.type)) {
    throw new Error('Invalid file type');
  }

  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Upload failed');
  }

  return response.json();
}

export async function extractYouTube(url) {
  const response = await fetch(`${API_BASE}/youtube/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Invalid YouTube URL');
  }

  return response.json();
}

export async function generateMIDI(file, options = {}) {
  const formData = new FormData();
  formData.append('audio', file);

  if (options.onsetThreshold !== undefined) {
    formData.append('onsetThreshold', options.onsetThreshold);
  }
  if (options.frameThreshold !== undefined) {
    formData.append('frameThreshold', options.frameThreshold);
  }
  if (options.minNoteLength !== undefined) {
    formData.append('minNoteLength', options.minNoteLength);
  }

  const response = await fetch(`${API_BASE}/midi/generate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'MIDI generation failed');
  }

  return response.json();
}

export async function downloadMIDI(filename) {
  const response = await fetch(`${API_BASE}/midi/download/${filename}`);

  if (!response.ok) {
    throw new Error('File not found');
  }

  return response.blob();
}

export const api = {
  getHealth,
  uploadAudio,
  extractYouTube,
  generateMIDI,
  downloadMIDI,
};
