// Gemini Mix Analysis Service
// Communicates with the Python FastAPI backend for AI-powered mix analysis

import { convertToWav, needsConversion } from '../utils/audioConversion';

const GEMINI_API_URL = 'http://localhost:56401';

/**
 * Helper to ensure file is in a compatible format for analysis
 */
async function ensureCompatibleFormat(audioFile) {
  if (needsConversion(audioFile)) {
    const result = await convertToWav(audioFile);
    return result.file;
  }
  return audioFile;
}

/**
 * Analyze an audio file using Gemini AI via OpenRouter.
 *
 * @param {File} audioFile - The audio file to analyze
 * @param {Object} options - Analysis options
 * @param {string} options.prompt - Custom prompt for the AI (default: "Analyze this mix")
 * @param {number} options.startSec - Start time for segment analysis (optional)
 * @param {number} options.endSec - End time for segment analysis (optional)
 * @param {boolean} options.includeSpectrogram - Whether to include spectrogram in response (default: true)
 * @param {string} options.model - AI model to use (optional)
 * @param {string} options.mode - Analysis mode: 'engineer' or 'producer' (default: 'engineer')
 * @param {string} options.sessionId - Session ID to continue chat (optional)
 * @returns {Promise<Object>} Analysis response with metrics and AI feedback
 */
export async function analyzeWithGemini(audioFile, options = {}) {
  const {
    prompt = 'Analyze this mix',
    startSec = null,
    endSec = null,
    includeSpectrogram = true,
    model = null,
    mode = 'engineer',
    sessionId = null
  } = options;

  // Convert if needed (AIFF, etc.)
  const compatibleFile = await ensureCompatibleFormat(audioFile);

  const formData = new FormData();
  formData.append('audio', compatibleFile);
  formData.append('user_prompt', prompt);
  formData.append('include_spectrogram', includeSpectrogram.toString());
  formData.append('mode', mode);

  if (startSec !== null) {
    formData.append('start_sec', startSec.toString());
  }
  if (endSec !== null) {
    formData.append('end_sec', endSec.toString());
  }
  if (model) {
    formData.append('model', model);
  }
  if (sessionId) {
    formData.append('session_id', sessionId);
  }

  const response = await fetch(`${GEMINI_API_URL}/analyze`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Analysis failed');
  }

  return response.json();
}

/**
 * Send a follow-up message in an existing chat session.
 *
 * @param {string} sessionId - The chat session ID
 * @param {string} message - The follow-up message
 * @param {string} model - Optional model override
 * @returns {Promise<Object>} Chat response
 */
export async function sendChatMessage(sessionId, message, model = null) {
  const formData = new FormData();
  formData.append('session_id', sessionId);
  formData.append('message', message);
  if (model) {
    formData.append('model', model);
  }

  const response = await fetch(`${GEMINI_API_URL}/chat`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Chat request failed');
  }

  return response.json();
}

/**
 * Clear a chat session.
 *
 * @param {string} sessionId - The chat session ID to clear
 * @returns {Promise<Object>} Status response
 */
export async function clearChatSession(sessionId) {
  const response = await fetch(`${GEMINI_API_URL}/chat/${sessionId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error('Failed to clear session');
  }

  return response.json();
}

/**
 * Check if the Gemini analyzer service is healthy.
 *
 * @returns {Promise<boolean>} True if service is healthy
 */
export async function checkGeminiHealth() {
  try {
    const response = await fetch(`${GEMINI_API_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Get available AI models from the Gemini analyzer service.
 *
 * @returns {Promise<Object>} Object with recommended models and current model
 */
export async function getAvailableModels() {
  const response = await fetch(`${GEMINI_API_URL}/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch available models');
  }
  return response.json();
}

/**
 * Analysis presets organized by mode.
 */
export const ANALYSIS_PRESETS = {
  engineer: {
    general: {
      label: 'Full Technical',
      prompt: 'Analyze this mix comprehensively - evaluate frequency balance, dynamics, stereo image, and overall translation potential.'
    },
    lowEnd: {
      label: 'Low End',
      prompt: 'Focus on the low end: analyze sub bass (20-60Hz), bass (60-200Hz), and low-mid interaction. Check for muddiness, boominess, or lack of punch.'
    },
    dynamics: {
      label: 'Dynamics',
      prompt: 'Analyze the dynamics: evaluate compression levels, transient preservation, loudness consistency, and dynamic range. Is it over-compressed or too dynamic?'
    },
    translation: {
      label: 'Translation',
      prompt: 'Evaluate how well this mix will translate across different playback systems - earbuds, car speakers, club PA, laptop speakers.'
    },
    vocals: {
      label: 'Vocals',
      prompt: 'Focus on vocal presence and clarity: evaluate vocal positioning, de-essing, presence frequencies (2-5kHz), and how vocals sit in the mix.'
    },
    stereo: {
      label: 'Stereo Image',
      prompt: 'Analyze the stereo image: evaluate width, mono compatibility, panning decisions, and spatial balance between elements.'
    },
    mastering: {
      label: 'Master Ready?',
      prompt: 'Evaluate if this mix is ready for mastering: check headroom, frequency balance, dynamics, and any issues that should be fixed before mastering.'
    }
  },
  producer: {
    arrangement: {
      label: 'Arrangement',
      prompt: 'Analyze the arrangement structure: evaluate intro, verses, choruses, bridges, build-ups, drops, and outro. Suggest improvements to the song structure and energy flow.'
    },
    vibe: {
      label: 'Vibe & Energy',
      prompt: 'Analyze the emotional impact and energy flow of this track. How does it make you feel? Where does the energy peak? How could the emotional journey be improved?'
    },
    hooks: {
      label: 'Hooks & Melody',
      prompt: 'Evaluate the melodic hooks and memorable elements. Are there catchy motifs? Is the main melody compelling? Suggest ways to make it more memorable.'
    },
    production: {
      label: 'Production Ideas',
      prompt: 'Suggest creative production techniques and sounds that could enhance this track. Think about textures, layers, effects, and modern production techniques.'
    },
    layers: {
      label: 'Layer Suggestions',
      prompt: 'What additional instruments or layers could enhance this production? Be specific about what to add and when (with timestamps).'
    },
    reference: {
      label: 'Reference Match',
      prompt: 'What commercial tracks does this remind you of? How could it be developed to achieve a similar level of polish and impact?'
    }
  }
};

/**
 * Get presets for a specific mode.
 *
 * @param {string} mode - 'engineer' or 'producer'
 * @returns {Object} Presets for the specified mode
 */
export function getPresetsForMode(mode) {
  return ANALYSIS_PRESETS[mode] || ANALYSIS_PRESETS.engineer;
}

/**
 * Segment presets for analyzing specific parts of a track.
 */
export const SEGMENT_PRESETS = {
  intro: { label: 'Intro', start: 0, end: 30 },
  verse: { label: 'Verse', start: 30, end: 90 },
  chorus: { label: 'Chorus', start: 90, end: 150 },
  drop: { label: 'Drop', start: 60, end: 120 },
  outro: { label: 'Outro', start: -60, end: null } // -60 means 60 seconds from end
};

/**
 * Calculate segment times based on track duration.
 *
 * @param {string} presetKey - Key from SEGMENT_PRESETS
 * @param {number} duration - Track duration in seconds
 * @returns {Object} Object with start and end times
 */
export function getSegmentTimes(presetKey, duration) {
  const preset = SEGMENT_PRESETS[presetKey];
  if (!preset) return { start: null, end: null };

  let start = preset.start;
  let end = preset.end;

  // Handle negative values (from end)
  if (start < 0) {
    start = Math.max(0, duration + start);
  }
  if (end === null) {
    end = duration;
  } else if (end < 0) {
    end = Math.max(0, duration + end);
  }

  // Clamp to valid range
  start = Math.max(0, Math.min(start, duration));
  end = Math.max(start, Math.min(end, duration));

  return { start, end };
}

/**
 * Available AI models for selection (fallback if API unavailable).
 */
export const AVAILABLE_MODELS = [
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Latest and most capable (recommended)' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Fast and capable' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'High quality analysis' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Balanced speed/quality' }
];

/**
 * OpenRouter models (used when OpenRouter provider is selected).
 */
export const OPENROUTER_MODELS = [
  { id: 'google/gemini-3-pro-preview', name: 'Gemini 3 Pro (Recommended)' },
  { id: 'openai/gpt-5.2', name: 'GPT-5.2' },
  { id: 'openai/gpt-5.2-chat', name: 'GPT-5.2 Chat (Fast)' },
  { id: 'google/gemini-2.5-pro-preview-05-06', name: 'Gemini 2.5 Pro' },
  { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)' },
  { id: 'anthropic/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet' },
  { id: 'anthropic/claude-3-opus', name: 'Claude 3 Opus' },
  { id: 'meta-llama/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision' },
];

/**
 * Get current API settings.
 *
 * @returns {Promise<Object>} Settings object
 */
export async function getSettings() {
  const response = await fetch(`${GEMINI_API_URL}/settings`);
  if (!response.ok) {
    throw new Error('Failed to fetch settings');
  }
  return response.json();
}

/**
 * Update API settings.
 *
 * @param {Object} settings - Settings to update
 * @param {string} settings.provider - 'google' or 'openrouter'
 * @param {string} settings.google_api_key - Google API key
 * @param {string} settings.openrouter_api_key - OpenRouter API key
 * @param {string} settings.default_model - Default model ID
 * @returns {Promise<Object>} Updated settings
 */
export async function updateSettings(settings) {
  const formData = new FormData();

  if (settings.provider !== undefined) {
    formData.append('provider', settings.provider);
  }
  if (settings.google_api_key !== undefined) {
    formData.append('google_api_key', settings.google_api_key);
  }
  if (settings.openrouter_api_key !== undefined) {
    formData.append('openrouter_api_key', settings.openrouter_api_key);
  }
  if (settings.default_model !== undefined) {
    formData.append('default_model', settings.default_model);
  }

  const response = await fetch(`${GEMINI_API_URL}/settings`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to update settings');
  }

  return response.json();
}
