// Audio Conversion Utility
// Handles conversion of unsupported audio formats (AIFF, etc.) to WAV

const CONVERT_API_URL = 'http://localhost:56404/api/convert';

// File extensions that need server-side conversion
const NEEDS_CONVERSION = ['.aif', '.aiff', '.aiff-c'];

/**
 * Check if a file needs conversion based on its extension
 * @param {File|string} file - File object or filename
 * @returns {boolean}
 */
export function needsConversion(file) {
  const fileName = typeof file === 'string' ? file : file.name;
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return NEEDS_CONVERSION.includes(ext);
}

/**
 * Convert an audio file to browser-compatible format using the backend server
 * @param {File} file - The audio file to convert
 * @param {Object} options - Conversion options
 * @param {string} options.format - Output format: 'mp3' (default, smaller) or 'wav' (lossless)
 * @returns {Promise<{blob: Blob, file: File, url: string, converted: boolean}>} Converted audio data
 */
export async function convertToWav(file, options = {}) {
  if (!needsConversion(file)) {
    // No conversion needed - return original
    const url = URL.createObjectURL(file);
    return { blob: file, file, url, converted: false };
  }

  const format = options.format || 'mp3'; // MP3 by default for smaller size
  console.log(`Converting ${file.name} to ${format.toUpperCase()}...`);

  const formData = new FormData();
  formData.append('audio', file);

  const response = await fetch(`${CONVERT_API_URL}?format=${format}`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.details || 'Audio conversion failed');
  }

  const outputBlob = await response.blob();
  const ext = format === 'wav' ? '.wav' : '.mp3';
  const mimeType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
  const newFileName = file.name.replace(/\.aiff?(-c)?$/i, ext);
  const outputFile = new File([outputBlob], newFileName, { type: mimeType });
  const url = URL.createObjectURL(outputBlob);

  console.log(`Converted ${file.name} to ${format.toUpperCase()} successfully (${(outputBlob.size / 1024 / 1024).toFixed(1)}MB)`);

  return { blob: outputBlob, file: outputFile, url, converted: true };
}

/**
 * Get a playable audio URL for any supported file
 * Converts if necessary, otherwise returns blob URL of original
 * @param {File} file - The audio file
 * @returns {Promise<string>} URL that can be used for audio playback
 */
export async function getPlayableUrl(file) {
  const result = await convertToWav(file);
  return result.url;
}

/**
 * Get a File object that browsers can decode
 * Converts if necessary, otherwise returns original
 * @param {File} file - The audio file
 * @returns {Promise<File>} File that can be decoded by Web Audio API
 */
export async function getDecodableFile(file) {
  const result = await convertToWav(file);
  return result.file;
}

/**
 * Decode an audio file to AudioBuffer, converting if necessary
 * @param {File} file - The audio file
 * @param {AudioContext} audioContext - Optional AudioContext to use
 * @returns {Promise<AudioBuffer>} Decoded audio buffer
 */
export async function decodeAudioFile(file, audioContext = null) {
  const decodableFile = await getDecodableFile(file);

  const ctx = audioContext || new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 44100 });
  const arrayBuffer = await decodableFile.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

  // Close context if we created it
  if (!audioContext && ctx.state !== 'closed') {
    await ctx.close();
  }

  return audioBuffer;
}

/**
 * Check if the conversion server is available
 * @returns {Promise<boolean>}
 */
export async function isConversionServerAvailable() {
  try {
    const response = await fetch('http://localhost:56404/api/health');
    return response.ok;
  } catch {
    return false;
  }
}
