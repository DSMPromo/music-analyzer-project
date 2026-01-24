/**
 * useContextualTips Hook
 * Matches tips to current analysis context
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { SONG_STRUCTURES } from '../data/songStructures';
import { TROUBLESHOOTING } from '../data/referenceData';
import { GENRE_TARGETS, LOUDNESS_STANDARDS } from '../data/mixingTargets';
import { SWING_VALUES } from '../data/rhythmPatterns';

// Tip rules based on analysis context
const TIP_RULES = [
  // Genre + Section tips
  {
    id: 'edm-intro-mix',
    condition: (ctx) => ctx.genre === 'edm' && ctx.section?.includes('intro'),
    tips: [
      { text: 'Keep intro melodically simple for DJ mixing', priority: 'high' },
      { text: 'Filter bass in first 16 bars', priority: 'medium' }
    ],
    category: 'dj-integration',
    relatedKnowledge: 'structure-edm'
  },
  {
    id: 'edm-outro-mix',
    condition: (ctx) => ctx.genre === 'edm' && ctx.section?.includes('outro'),
    tips: [
      { text: 'Mirror your intro structure', priority: 'high' },
      { text: 'No reverb tails past final bar', priority: 'high' }
    ],
    category: 'dj-integration',
    relatedKnowledge: 'structure-edm'
  },
  {
    id: 'afro-groove',
    condition: (ctx) => ctx.genre === 'afroHouse',
    tips: [
      { text: 'Use different swing per layer (55-65%)', priority: 'high' },
      { text: 'Gradual element introduction - one per 8 bars', priority: 'medium' }
    ],
    category: 'rhythm',
    relatedKnowledge: 'rhythm-afro-foundation'
  },
  {
    id: 'kpop-hooks',
    condition: (ctx) => ctx.genre === 'kpop',
    tips: [
      { text: 'K-Pop needs 5-7 hooks per song', priority: 'medium' },
      { text: 'BUILD AND STOP before chorus is signature', priority: 'high' }
    ],
    category: 'structure',
    relatedKnowledge: 'structure-kpop'
  },

  // Loudness tips
  {
    id: 'loudness-high',
    condition: (ctx) => ctx.lufs && ctx.lufs > -10,
    tips: [
      { text: 'Track is quite loud - may be limited on streaming', priority: 'high' },
      { text: 'Consider -14 LUFS for Spotify/Apple Music', priority: 'medium' }
    ],
    category: 'mastering',
    relatedKnowledge: 'mixing-loudness'
  },
  {
    id: 'loudness-low',
    condition: (ctx) => ctx.lufs && ctx.lufs < -18,
    tips: [
      { text: 'Track may be too quiet for streaming platforms', priority: 'medium' },
      { text: 'Target -14 to -16 LUFS for consistent playback', priority: 'medium' }
    ],
    category: 'mastering',
    relatedKnowledge: 'mixing-loudness'
  },
  {
    id: 'loudness-club',
    condition: (ctx) => ctx.genre === 'edm' || ctx.genre === 'afroHouse',
    tips: [
      { text: 'For club play, target -8 to -10 LUFS', priority: 'info' },
      { text: 'Beatport/DJ pools expect hotter masters', priority: 'info' }
    ],
    category: 'mastering',
    relatedKnowledge: 'mixing-loudness'
  },

  // Frequency problem tips
  {
    id: 'muddy-mix',
    condition: (ctx) => ctx.problems?.includes('muddy') || ctx.lowMidEnergy > 0.4,
    tips: [
      { text: 'Cut 200-400Hz on competing elements', priority: 'high' },
      { text: 'HPF everything except kick/bass at 100Hz', priority: 'high' }
    ],
    category: 'mixing',
    relatedKnowledge: 'reference-problem-muddy'
  },
  {
    id: 'harsh-mix',
    condition: (ctx) => ctx.problems?.includes('harsh') || ctx.presenceEnergy > 0.5,
    tips: [
      { text: 'Check 2-4kHz range - may be harsh', priority: 'high' },
      { text: 'Use de-esser on vocals', priority: 'medium' }
    ],
    category: 'mixing',
    relatedKnowledge: 'reference-problem-harsh'
  },

  // BPM-based tips
  {
    id: 'afro-bpm',
    condition: (ctx) => ctx.bpm >= 118 && ctx.bpm <= 124,
    tips: [
      { text: 'BPM suggests Afro House - consider 55-65% swing', priority: 'medium' },
      { text: 'Layer percussion with different swing values', priority: 'medium' }
    ],
    category: 'rhythm',
    relatedKnowledge: 'rhythm-afro-foundation'
  },
  {
    id: 'edm-bpm',
    condition: (ctx) => ctx.bpm >= 124 && ctx.bpm <= 150,
    tips: [
      { text: 'BPM range is typical for EDM/House', priority: 'info' },
      { text: 'Keep rhythms straight (0-50% swing) for clarity', priority: 'medium' }
    ],
    category: 'rhythm',
    relatedKnowledge: 'rhythm-edm-fourOnFloor'
  },

  // Key-based tips
  {
    id: 'minor-key',
    condition: (ctx) => ctx.key?.includes('minor'),
    tips: [
      { text: 'Minor key detected - great for emotional content', priority: 'info' },
      { text: 'Consider Dorian mode for soulful, hopeful minor', priority: 'medium' }
    ],
    category: 'theory',
    relatedKnowledge: 'theory-mode-dorian'
  },

  // Dynamic range tips
  {
    id: 'low-dynamics',
    condition: (ctx) => ctx.dynamicRange && ctx.dynamicRange < 6,
    tips: [
      { text: 'Dynamic range is quite limited', priority: 'medium' },
      { text: 'Consider less limiting for more punch', priority: 'medium' }
    ],
    category: 'mastering',
    relatedKnowledge: 'signal-master'
  },

  // Stereo tips
  {
    id: 'mono-bass',
    condition: (ctx) => ctx.bassPhase && ctx.bassPhase < 0.8,
    tips: [
      { text: 'Bass should be mono below 150Hz', priority: 'high' },
      { text: 'Wide bass can cause phase issues on club systems', priority: 'high' }
    ],
    category: 'mixing',
    relatedKnowledge: 'signal-kick-bass'
  },

  // Vocal tips
  {
    id: 'vocals-detected',
    condition: (ctx) => ctx.hasVocals,
    tips: [
      { text: 'Vocal is KING - everything supports, nothing competes', priority: 'high' },
      { text: 'Cut competing elements at 2-5kHz for vocal clarity', priority: 'medium' }
    ],
    category: 'mixing',
    relatedKnowledge: 'signal-vocal-pop'
  }
];

export function useContextualTips(analysisContext = {}) {
  const [dismissedTips, setDismissedTips] = useState(new Set());
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Get matching tips based on context
  const matchingTips = useMemo(() => {
    if (!analysisContext || Object.keys(analysisContext).length === 0) {
      return [];
    }

    const tips = [];

    TIP_RULES.forEach(rule => {
      try {
        if (rule.condition(analysisContext)) {
          rule.tips.forEach(tip => {
            if (!dismissedTips.has(`${rule.id}-${tip.text}`)) {
              tips.push({
                id: `${rule.id}-${tip.text}`,
                ruleId: rule.id,
                text: tip.text,
                priority: tip.priority,
                category: rule.category,
                relatedKnowledge: rule.relatedKnowledge
              });
            }
          });
        }
      } catch (e) {
        // Ignore rules that fail due to missing context
      }
    });

    // Sort by priority
    const priorityOrder = { high: 0, medium: 1, info: 2 };
    tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return tips;
  }, [analysisContext, dismissedTips]);

  // High priority tips count
  const highPriorityCount = useMemo(() => {
    return matchingTips.filter(t => t.priority === 'high').length;
  }, [matchingTips]);

  // Dismiss a tip
  const dismissTip = useCallback((tipId) => {
    setDismissedTips(prev => new Set([...prev, tipId]));
  }, []);

  // Clear all dismissed tips
  const clearDismissed = useCallback(() => {
    setDismissedTips(new Set());
  }, []);

  // Auto-open drawer when high priority tips appear
  useEffect(() => {
    if (highPriorityCount > 0 && !isDrawerOpen) {
      // Only auto-open on first detection
      const timer = setTimeout(() => {
        setIsDrawerOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [highPriorityCount]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    tips: matchingTips,
    highPriorityCount,
    isDrawerOpen,
    setIsDrawerOpen,
    dismissTip,
    clearDismissed,
    hasTips: matchingTips.length > 0
  };
}

export default useContextualTips;
