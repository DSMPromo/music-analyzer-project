/**
 * usePersonalKnowledge Hook
 *
 * Self-learning knowledge base that remembers user preferences
 * and provides AI-assisted sound design recommendations.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  calculateBPMSync,
  formatMs,
  DEFAULT_INSTRUMENT_PRESETS,
  loadUserPreferences,
  saveUserPreferences,
  addFavorite,
  createCustomPreset,
  addLearning,
  trackBPMUsage,
  generateDialInConfig,
  getAllFavoriteConfigs,
} from '../data/userPreferences';

// AI System prompt for sound design assistance
const SOUND_DESIGN_SYSTEM_PROMPT = `You are a professional sound designer and mix engineer assistant. You help users:

1. Create and dial in sounds they love
2. Calculate BPM-synced effect settings (delays, reverbs, compressors)
3. Remember their favorite instruments and settings
4. Suggest processing chains and mix techniques
5. Explain the "why" behind settings

When the user mentions they like something (e.g., "I love M1 piano"), remember this preference.
When asked for settings, always provide EXACT dial-in values based on the current BPM.

Format recommendations like this:
**[Instrument Name] @ [BPM] BPM**
- Delay: [X]ms (1/8 dotted)
- Reverb Pre-delay: [X]ms
- Reverb Decay: [X]ms (2 beats)
- Compressor Release: [X]ms (1/16 note)

Always explain WHY these values work musically.`;

export function usePersonalKnowledge(currentBPM = 120) {
  const [preferences, setPreferences] = useState(null);
  const [bpmSync, setBpmSync] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load preferences on mount
  useEffect(() => {
    const prefs = loadUserPreferences();
    setPreferences(prefs);
    setIsLoaded(true);
  }, []);

  // Update BPM sync calculations when BPM changes
  useEffect(() => {
    if (currentBPM > 0) {
      const sync = calculateBPMSync(currentBPM);
      setBpmSync(sync);
      trackBPMUsage(currentBPM);
    }
  }, [currentBPM]);

  // Reload preferences
  const reloadPreferences = useCallback(() => {
    const prefs = loadUserPreferences();
    setPreferences(prefs);
    return prefs;
  }, []);

  // Add to favorites
  const addToFavorites = useCallback((presetId, customSettings = null) => {
    const updatedPrefs = addFavorite(presetId, customSettings);
    setPreferences(updatedPrefs);

    // Track learning
    addLearning('favorite_added', { presetId, customSettings });

    return updatedPrefs;
  }, []);

  // Create custom preset from AI conversation
  const createPresetFromAI = useCallback((name, category, settings, mixSettings, tips) => {
    const presetId = createCustomPreset(name, category, settings, mixSettings, tips);
    reloadPreferences();

    addLearning('preset_created', { name, category, presetId });

    return presetId;
  }, [reloadPreferences]);

  // Get dial-in config for instrument at current BPM
  const getDialInConfig = useCallback((presetId) => {
    return generateDialInConfig(presetId, currentBPM);
  }, [currentBPM]);

  // Get all favorite configs at current BPM
  const getFavoriteConfigs = useCallback(() => {
    return getAllFavoriteConfigs(currentBPM);
  }, [currentBPM]);

  // Get available presets (built-in + custom)
  const getAllPresets = useCallback(() => {
    const builtIn = Object.entries(DEFAULT_INSTRUMENT_PRESETS).map(([id, preset]) => ({
      id,
      ...preset,
      isBuiltIn: true
    }));

    const custom = preferences?.customPresets
      ? Object.entries(preferences.customPresets).map(([id, preset]) => ({
          id,
          ...preset,
          isCustom: true
        }))
      : [];

    return [...builtIn, ...custom];
  }, [preferences]);

  // Check if preset is favorited
  const isFavorite = useCallback((presetId) => {
    return preferences?.favorites?.some(f => f.id === presetId) || false;
  }, [preferences]);

  // Remove from favorites
  const removeFromFavorites = useCallback((presetId) => {
    if (!preferences) return;

    const updated = {
      ...preferences,
      favorites: preferences.favorites.filter(f => f.id !== presetId)
    };

    saveUserPreferences(updated);
    setPreferences(updated);
  }, [preferences]);

  // Update preference setting
  const updatePreference = useCallback((key, value) => {
    if (!preferences) return;

    const updated = {
      ...preferences,
      preferences: {
        ...preferences.preferences,
        [key]: value
      }
    };

    saveUserPreferences(updated);
    setPreferences(updated);
  }, [preferences]);

  // Generate AI context for chat
  const generateAIContext = useCallback(() => {
    if (!preferences || !bpmSync) return '';

    const favoritesList = preferences.favorites
      .map(f => {
        const preset = DEFAULT_INSTRUMENT_PRESETS[f.id] || preferences.customPresets?.[f.id];
        return preset ? `- ${preset.name} (used ${f.useCount || 1} times)` : null;
      })
      .filter(Boolean)
      .join('\n');

    const recentBPMs = preferences.recentBPMs
      .slice(0, 5)
      .map(r => r.bpm)
      .join(', ');

    return `
USER PREFERENCES:
- Default BPM: ${preferences.defaultBPM}
- Recent BPMs used: ${recentBPMs || 'None yet'}
- Preferred reverb: ${preferences.preferences?.defaultReverb || 'plate'}
- Preferred delay: ${preferences.preferences?.defaultDelay || 'dottedEighth'}
- Preferred key: ${preferences.preferences?.preferredKey || 'C'}

FAVORITE INSTRUMENTS:
${favoritesList || 'None yet - suggest some based on genre!'}

CURRENT BPM: ${currentBPM}

BPM-SYNCED TIMING VALUES:
- Quarter note: ${formatMs(bpmSync.quarter)}
- Eighth note: ${formatMs(bpmSync.eighth)}
- Sixteenth note: ${formatMs(bpmSync.sixteenth)}
- Dotted eighth: ${formatMs(bpmSync.dottedEighth)}
- Triplet eighth: ${formatMs(bpmSync.tripletEighth)}

DELAY PRESETS:
- Slap: ${formatMs(bpmSync.delays.slap)}
- Short: ${formatMs(bpmSync.delays.short)}
- Groove: ${formatMs(bpmSync.delays.groove)}
- Musical: ${formatMs(bpmSync.delays.musical)}
- Dotted 1/8: ${formatMs(bpmSync.delays.dottedEighth)}

REVERB PRE-DELAY:
- Tight: ${formatMs(bpmSync.preDelay.tight)}
- Natural: ${formatMs(bpmSync.preDelay.natural)}
- Spacious: ${formatMs(bpmSync.preDelay.spacious)}

REVERB DECAY:
- Short: ${formatMs(bpmSync.reverbDecay.short)}
- Medium: ${formatMs(bpmSync.reverbDecay.medium)}
- Long: ${formatMs(bpmSync.reverbDecay.long)}

Use these exact values when giving recommendations!
`;
  }, [preferences, bpmSync, currentBPM]);

  // Parse AI response for learnings
  const parseAIResponseForLearnings = useCallback((userMessage, aiResponse) => {
    const lowerMessage = userMessage.toLowerCase();

    // Detect favorite mentions
    const favoritePatterns = [
      /i (?:love|like|prefer|always use|enjoy) (?:the )?(.+?)(?:\.|,|!|$)/gi,
      /my favorite (?:is|sound|instrument) (?:the )?(.+?)(?:\.|,|!|$)/gi,
      /i'm a fan of (?:the )?(.+?)(?:\.|,|!|$)/gi
    ];

    for (const pattern of favoritePatterns) {
      const match = pattern.exec(lowerMessage);
      if (match) {
        addLearning('user_preference_mentioned', {
          type: 'favorite',
          value: match[1].trim(),
          context: userMessage
        });
      }
    }

    // Detect genre preferences
    const genrePatterns = /(?:i make|i produce|my genre is|i'm into) (.+?)(?:\.|,|!|$)/gi;
    const genreMatch = genrePatterns.exec(lowerMessage);
    if (genreMatch) {
      addLearning('user_preference_mentioned', {
        type: 'genre',
        value: genreMatch[1].trim(),
        context: userMessage
      });
    }

    // Detect BPM preferences
    const bpmPattern = /(\d{2,3})\s*bpm/gi;
    const bpmMatch = bpmPattern.exec(lowerMessage);
    if (bpmMatch) {
      trackBPMUsage(parseInt(bpmMatch[1]));
    }

  }, []);

  // Build system prompt with user context
  const buildSystemPrompt = useCallback(() => {
    const context = generateAIContext();
    return `${SOUND_DESIGN_SYSTEM_PROMPT}\n\n${context}`;
  }, [generateAIContext]);

  // Quick dial-in for common tasks
  const getQuickDialIn = useCallback((task) => {
    if (!bpmSync) return null;

    const quickConfigs = {
      'delay': {
        title: 'Delay Settings',
        values: {
          'Slap (1/32)': `${Math.round(bpmSync.delays.slap)}ms`,
          'Short (1/16)': `${Math.round(bpmSync.delays.short)}ms`,
          'Groove (1/8)': `${Math.round(bpmSync.delays.groove)}ms`,
          'Musical (1/4)': `${Math.round(bpmSync.delays.musical)}ms`,
          'U2 Style (dotted 1/8)': `${Math.round(bpmSync.delays.dottedEighth)}ms`,
        }
      },
      'reverb': {
        title: 'Reverb Settings',
        values: {
          'Pre-delay (tight)': `${Math.round(bpmSync.preDelay.tight)}ms`,
          'Pre-delay (natural)': `${Math.round(bpmSync.preDelay.natural)}ms`,
          'Pre-delay (spacious)': `${Math.round(bpmSync.preDelay.spacious)}ms`,
          'Decay (1 beat)': `${Math.round(bpmSync.reverbDecay.short)}ms`,
          'Decay (2 beats)': `${Math.round(bpmSync.reverbDecay.medium)}ms`,
          'Decay (1 bar)': `${Math.round(bpmSync.reverbDecay.long)}ms`,
        }
      },
      'compressor': {
        title: 'Compressor Release',
        values: {
          'Fast (1/32)': `${Math.round(bpmSync.compressor.release.fast)}ms`,
          'Musical (1/16)': `${Math.round(bpmSync.compressor.release.musical)}ms`,
          'Slow (1/8)': `${Math.round(bpmSync.compressor.release.slow)}ms`,
        }
      },
      'lfo': {
        title: 'LFO Rates',
        values: {
          'Slow (1/8 tempo)': `${(bpmSync.lfo.slow).toFixed(2)} Hz`,
          'Quarter (1/4 tempo)': `${(bpmSync.lfo.quarter).toFixed(2)} Hz`,
          'Half (1/2 tempo)': `${(bpmSync.lfo.half).toFixed(2)} Hz`,
          'Sync (1x tempo)': `${(bpmSync.lfo.sync).toFixed(2)} Hz`,
          'Double (2x tempo)': `${(bpmSync.lfo.double).toFixed(2)} Hz`,
        }
      }
    };

    return quickConfigs[task] || null;
  }, [bpmSync]);

  return {
    // State
    isLoaded,
    preferences,
    bpmSync,
    currentBPM,

    // Presets
    getAllPresets,
    getDialInConfig,
    getFavoriteConfigs,

    // Favorites
    addToFavorites,
    removeFromFavorites,
    isFavorite,

    // Custom presets
    createPresetFromAI,

    // Preferences
    updatePreference,
    reloadPreferences,

    // AI Integration
    buildSystemPrompt,
    generateAIContext,
    parseAIResponseForLearnings,

    // Quick access
    getQuickDialIn,
    formatMs,
    calculateBPMSync,
  };
}

export default usePersonalKnowledge;
