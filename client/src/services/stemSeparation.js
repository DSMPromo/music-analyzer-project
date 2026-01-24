// Stem Separation Service
// Communicates with the Python FastAPI backend for stem separation

const STEM_API_URL = 'http://localhost:56402';

/**
 * Start a stem separation job.
 *
 * @param {File} audioFile - The audio file to separate
 * @param {string} model - Demucs model to use (htdemucs, htdemucs_ft, htdemucs_6s)
 * @param {number} artifactReduction - Artifact reduction level 0-100 (0 = off)
 * @returns {Promise<Object>} Job info with job_id
 */
export async function startSeparation(audioFile, model = 'htdemucs', artifactReduction = 0) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  formData.append('model', model);
  formData.append('artifact_reduction', artifactReduction.toString());

  const response = await fetch(`${STEM_API_URL}/separate`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Separation failed to start');
  }

  return response.json();
}

/**
 * Get the status of a separation job.
 *
 * @param {string} jobId - The job ID
 * @returns {Promise<Object>} Job status
 */
export async function getJobStatus(jobId) {
  const response = await fetch(`${STEM_API_URL}/jobs/${jobId}`);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to get job status');
  }

  return response.json();
}

/**
 * Poll for job completion.
 *
 * @param {string} jobId - The job ID
 * @param {Function} onProgress - Callback for progress updates
 * @param {number} interval - Polling interval in ms
 * @returns {Promise<Object>} Final job result
 */
export async function waitForCompletion(jobId, onProgress = null, interval = 2000) {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);

        if (onProgress) {
          onProgress(status);
        }

        if (status.status === 'completed') {
          resolve(status);
        } else if (status.status === 'failed') {
          reject(new Error(status.error || 'Separation failed'));
        } else {
          setTimeout(poll, interval);
        }
      } catch (err) {
        reject(err);
      }
    };

    poll();
  });
}

/**
 * Get the download URL for a stem.
 *
 * @param {string} jobId - The job ID
 * @param {string} filename - The stem filename
 * @returns {string} Download URL
 */
export function getStemDownloadUrl(jobId, filename) {
  return `${STEM_API_URL}/stems/${jobId}/${filename}`;
}

/**
 * Get stem audio as base64 for inline playback.
 *
 * @param {string} jobId - The job ID
 * @param {string} filename - The stem filename
 * @returns {Promise<Object>} Object with data (base64) and mime_type
 */
export async function getStemBase64(jobId, filename) {
  const response = await fetch(`${STEM_API_URL}/stems/${jobId}/${filename}/base64`);

  if (!response.ok) {
    throw new Error('Failed to get stem data');
  }

  return response.json();
}

/**
 * Download a stem file.
 *
 * @param {string} jobId - The job ID
 * @param {string} filename - The stem filename
 * @param {string} saveName - Optional name to save as
 */
export function downloadStem(jobId, filename, saveName = null) {
  const url = getStemDownloadUrl(jobId, filename);
  const a = document.createElement('a');
  a.href = url;
  a.download = saveName || filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Clean up a job and its files.
 *
 * @param {string} jobId - The job ID
 */
export async function cleanupJob(jobId) {
  await fetch(`${STEM_API_URL}/jobs/${jobId}`, { method: 'DELETE' });
}

/**
 * Check if the stem separator service is healthy.
 *
 * @returns {Promise<boolean>} True if service is healthy
 */
export async function checkStemServiceHealth() {
  try {
    const response = await fetch(`${STEM_API_URL}/health`);
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ok';
  } catch (error) {
    return false;
  }
}

/**
 * Get available Demucs models.
 *
 * @returns {Promise<Object>} Models info
 */
export async function getAvailableModels() {
  const response = await fetch(`${STEM_API_URL}/models`);
  if (!response.ok) {
    throw new Error('Failed to fetch models');
  }
  return response.json();
}

/**
 * Stem display names and colors.
 */
export const STEM_INFO = {
  drums: { name: 'Drums', color: '#e94560', icon: '🥁' },
  bass: { name: 'Bass', color: '#0f3460', icon: '🎸' },
  vocals: { name: 'Vocals', color: '#16c79a', icon: '🎤' },
  other: { name: 'Other', color: '#f5c842', icon: '🎹' },
  guitar: { name: 'Guitar', color: '#ff6b6b', icon: '🎸' },
  piano: { name: 'Piano', color: '#4ecdc4', icon: '🎹' }
};
