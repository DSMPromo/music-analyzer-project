import { useState, useCallback, useEffect } from 'react';
import {
  generateFileFingerprint,
  saveAnalysis,
  loadAnalysis,
  hasAnalysis,
  getAnalysisHistory,
  deleteAnalysis,
  clearAllAnalyses,
} from '../utils/analysisCache';

/**
 * Hook for managing audio analysis cache
 * Provides caching, history, and retrieval of processed audio data
 */
export function useAnalysisCache() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCacheId, setCurrentCacheId] = useState(null);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  /**
   * Load analysis history from IndexedDB
   */
  const loadHistory = useCallback(async () => {
    const entries = await getAnalysisHistory();
    setHistory(entries);
  }, []);

  /**
   * Check if a file has cached analysis
   * @param {File} file - Audio file
   * @param {number} duration - Audio duration
   * @returns {Object|null} Cached data or null
   */
  const checkCache = useCallback(async (file, duration) => {
    const id = generateFileFingerprint(file, duration);
    setCurrentCacheId(id);
    const cached = await loadAnalysis(id);
    return cached;
  }, []);

  /**
   * Save current analysis to cache
   * @param {File} file - Audio file
   * @param {Object} analysisData - All analysis results to cache
   */
  const cacheAnalysis = useCallback(async (file, analysisData) => {
    if (!currentCacheId) return false;

    setIsLoading(true);
    try {
      const data = {
        fileName: file.name,
        fileSize: file.size,
        ...analysisData,
      };

      await saveAnalysis(currentCacheId, data);
      await loadHistory(); // Refresh history
      return true;
    } finally {
      setIsLoading(false);
    }
  }, [currentCacheId, loadHistory]);

  /**
   * Load a previous analysis from history
   * @param {string} id - Cache ID
   * @returns {Object|null} Cached analysis data
   */
  const loadFromHistory = useCallback(async (id) => {
    setIsLoading(true);
    try {
      const data = await loadAnalysis(id);
      if (data) {
        setCurrentCacheId(id);
      }
      return data;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Delete a history entry
   * @param {string} id - Cache ID to delete
   */
  const deleteFromHistory = useCallback(async (id) => {
    await deleteAnalysis(id);
    await loadHistory();
  }, [loadHistory]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(async () => {
    await clearAllAnalyses();
    setHistory([]);
    setCurrentCacheId(null);
  }, []);

  /**
   * Update specific fields in current cache entry
   * @param {Object} updates - Fields to update
   */
  const updateCache = useCallback(async (updates) => {
    if (!currentCacheId) return false;

    const existing = await loadAnalysis(currentCacheId);
    if (!existing) return false;

    const updated = { ...existing, ...updates };
    await saveAnalysis(currentCacheId, updated);
    await loadHistory();
    return true;
  }, [currentCacheId, loadHistory]);

  return {
    // State
    history,
    isLoading,
    currentCacheId,

    // Actions
    checkCache,
    cacheAnalysis,
    loadFromHistory,
    deleteFromHistory,
    clearHistory,
    updateCache,
    refreshHistory: loadHistory,
  };
}

export default useAnalysisCache;
