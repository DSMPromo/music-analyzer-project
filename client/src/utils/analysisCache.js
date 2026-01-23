/**
 * Analysis Cache Utility
 * Stores processed audio analysis results in IndexedDB for fast retrieval
 */

const DB_NAME = 'MusicAnalyzerCache';
const DB_VERSION = 2;
const STORE_NAME = 'analyses';
const CHAT_STORE_NAME = 'chatLogs';
const MAX_HISTORY = 50; // Maximum number of cached analyses

/**
 * Open IndexedDB connection
 * @returns {Promise<IDBDatabase>}
 */
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create analysis store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('fileName', 'fileName', { unique: false });
      }

      // Create chat logs store if it doesn't exist
      if (!db.objectStoreNames.contains(CHAT_STORE_NAME)) {
        const chatStore = db.createObjectStore(CHAT_STORE_NAME, { keyPath: 'id' });
        chatStore.createIndex('analysisId', 'analysisId', { unique: false });
        chatStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

/**
 * Generate a unique fingerprint for an audio file
 * Uses file name, size, and duration for quick identification
 * @param {File} file - Audio file
 * @param {number} duration - Audio duration in seconds
 * @returns {string} Unique fingerprint
 */
export function generateFileFingerprint(file, duration) {
  const data = `${file.name}|${file.size}|${Math.round(duration * 1000)}`;
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `audio_${Math.abs(hash).toString(16)}`;
}

/**
 * Save analysis results to cache
 * @param {string} id - File fingerprint
 * @param {Object} data - Analysis data to cache
 */
export async function saveAnalysis(id, data) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      id,
      timestamp: Date.now(),
      ...data,
    };

    await new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Clean up old entries if we have too many
    await pruneOldEntries(db);

    db.close();
    return true;
  } catch (error) {
    console.error('Failed to save analysis:', error);
    return false;
  }
}

/**
 * Load analysis results from cache
 * @param {string} id - File fingerprint
 * @returns {Object|null} Cached analysis data or null
 */
export async function loadAnalysis(id) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);

    const result = await new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return result || null;
  } catch (error) {
    console.error('Failed to load analysis:', error);
    return null;
  }
}

/**
 * Check if analysis exists in cache
 * @param {string} id - File fingerprint
 * @returns {boolean}
 */
export async function hasAnalysis(id) {
  const result = await loadAnalysis(id);
  return result !== null;
}

/**
 * Get all cached analyses (history)
 * @returns {Array} List of cached analyses, sorted by timestamp (newest first)
 */
export async function getAnalysisHistory() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('timestamp');

    const results = await new Promise((resolve, reject) => {
      const request = index.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();

    // Sort by timestamp descending (newest first)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}

/**
 * Delete a specific analysis from cache
 * @param {string} id - File fingerprint
 */
export async function deleteAnalysis(id) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    return true;
  } catch (error) {
    console.error('Failed to delete analysis:', error);
    return false;
  }
}

/**
 * Clear all cached analyses
 */
export async function clearAllAnalyses() {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    await new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    return true;
  } catch (error) {
    console.error('Failed to clear cache:', error);
    return false;
  }
}

/**
 * Prune old entries to stay under MAX_HISTORY limit
 * @param {IDBDatabase} db - Database connection
 */
async function pruneOldEntries(db) {
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('timestamp');

  // Get all entries sorted by timestamp
  const entries = await new Promise((resolve, reject) => {
    const request = index.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  // If over limit, delete oldest entries
  if (entries.length > MAX_HISTORY) {
    const toDelete = entries
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, entries.length - MAX_HISTORY);

    for (const entry of toDelete) {
      store.delete(entry.id);
    }
  }
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted size string
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted duration string (MM:SS)
 */
export function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Format timestamp for display
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // Less than 1 hour ago
  if (diff < 60 * 60 * 1000) {
    const mins = Math.floor(diff / (60 * 1000));
    return mins <= 1 ? 'Just now' : `${mins} mins ago`;
  }

  // Today
  if (date.toDateString() === now.toDateString()) {
    return `Today ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  }

  // This week
  if (diff < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short', hour: '2-digit', minute: '2-digit' });
  }

  // Older
  return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

// ===== CHAT LOG FUNCTIONS =====

/**
 * Save a chat message to the log
 * @param {string} analysisId - ID of the associated analysis
 * @param {Object} message - Chat message { role: 'user'|'assistant', content: string, metadata?: object }
 * @returns {string} Message ID
 */
export async function saveChatMessage(analysisId, message) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHAT_STORE_NAME);

    const id = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const record = {
      id,
      analysisId,
      timestamp: Date.now(),
      role: message.role,
      content: message.content,
      metadata: message.metadata || {},
    };

    await new Promise((resolve, reject) => {
      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    db.close();
    return id;
  } catch (error) {
    console.error('Failed to save chat message:', error);
    return null;
  }
}

/**
 * Get all chat messages for an analysis
 * @param {string} analysisId - ID of the analysis
 * @returns {Array} Chat messages sorted by timestamp
 */
export async function getChatLog(analysisId) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(CHAT_STORE_NAME, 'readonly');
    const store = tx.objectStore(CHAT_STORE_NAME);
    const index = store.index('analysisId');

    const results = await new Promise((resolve, reject) => {
      const request = index.getAll(analysisId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    db.close();
    return results.sort((a, b) => a.timestamp - b.timestamp);
  } catch (error) {
    console.error('Failed to get chat log:', error);
    return [];
  }
}

/**
 * Save entire chat conversation
 * @param {string} analysisId - ID of the associated analysis
 * @param {Array} messages - Array of chat messages
 */
export async function saveChatLog(analysisId, messages) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHAT_STORE_NAME);

    // Clear existing messages for this analysis
    const index = store.index('analysisId');
    const existing = await new Promise((resolve, reject) => {
      const request = index.getAll(analysisId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const msg of existing) {
      store.delete(msg.id);
    }

    // Save new messages
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const record = {
        id: `chat_${analysisId}_${i}_${Date.now()}`,
        analysisId,
        timestamp: msg.timestamp || Date.now() + i,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
      };
      store.put(record);
    }

    db.close();
    return true;
  } catch (error) {
    console.error('Failed to save chat log:', error);
    return false;
  }
}

/**
 * Delete all chat messages for an analysis
 * @param {string} analysisId - ID of the analysis
 */
export async function deleteChatLog(analysisId) {
  try {
    const db = await openDatabase();
    const tx = db.transaction(CHAT_STORE_NAME, 'readwrite');
    const store = tx.objectStore(CHAT_STORE_NAME);
    const index = store.index('analysisId');

    const messages = await new Promise((resolve, reject) => {
      const request = index.getAll(analysisId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    for (const msg of messages) {
      store.delete(msg.id);
    }

    db.close();
    return true;
  } catch (error) {
    console.error('Failed to delete chat log:', error);
    return false;
  }
}

/**
 * Export chat log as text file
 * @param {string} analysisId - ID of the analysis
 * @param {string} fileName - Original audio file name
 */
export async function exportChatLog(analysisId, fileName) {
  const messages = await getChatLog(analysisId);

  if (messages.length === 0) {
    alert('No chat history to export.');
    return;
  }

  let text = `Chat Log for: ${fileName}\n`;
  text += `Exported: ${new Date().toLocaleString()}\n`;
  text += `${'='.repeat(50)}\n\n`;

  for (const msg of messages) {
    const time = new Date(msg.timestamp).toLocaleTimeString();
    const role = msg.role === 'user' ? 'You' : 'AI';
    text += `[${time}] ${role}:\n${msg.content}\n\n`;

    // Include metadata if present
    if (msg.metadata && Object.keys(msg.metadata).length > 0) {
      text += `  (${JSON.stringify(msg.metadata)})\n`;
    }
    text += '-'.repeat(40) + '\n\n';
  }

  // Download as text file
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `chat-log-${fileName.replace(/\.[^/.]+$/, '')}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
