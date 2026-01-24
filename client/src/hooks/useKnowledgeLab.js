/**
 * useKnowledgeLab Hook
 * Manages knowledge base state, search, and filtering
 */

import { useState, useCallback, useMemo } from 'react';
import { SONG_STRUCTURES, SECTION_TYPES } from '../data/songStructures';
import { PATTERN_CATEGORIES, getAllPatterns } from '../data/rhythmPatterns';
import { MODES, CHORD_PROGRESSIONS, MELODY_CONSTRUCTION, TENSION_RELEASE } from '../data/musicTheory';
import { VOCAL_CHAINS, SYNTH_CHAINS, KICK_BASS_CHAINS, MASTER_BUS_CHAIN, FREQUENCY_ALLOCATION } from '../data/signalChains';
import { GENRE_TARGETS, LOUDNESS_STANDARDS, EQUAL_LOUDNESS_PROFILES } from '../data/mixingTargets';
import { REFERENCE_ARTISTS, TROUBLESHOOTING, PRACTICE_EXERCISES, QUICK_REFERENCE, DAW_CONFIGS } from '../data/referenceData';

// Define knowledge categories
const CATEGORIES = [
  {
    id: 'structure',
    name: 'Song Structure',
    icon: '📐',
    description: 'Bar grids, section purposes, energy curves by genre',
    color: '#3b82f6'
  },
  {
    id: 'theory',
    name: 'Music Theory',
    icon: '🎵',
    description: 'Keys, scales, modes, chord progressions, melody',
    color: '#8b5cf6'
  },
  {
    id: 'rhythm',
    name: 'Rhythm Patterns',
    icon: '🥁',
    description: 'Grid notation, genre patterns, swing, humanization',
    color: '#ef4444'
  },
  {
    id: 'signalChains',
    name: 'Signal Chains',
    icon: '🔗',
    description: 'Vocal, synth, kick/bass, master bus processing',
    color: '#f59e0b'
  },
  {
    id: 'mixing',
    name: 'Mixing & Mastering',
    icon: '🎚️',
    description: 'Frequency targets, loudness, psychoacoustics',
    color: '#10b981'
  },
  {
    id: 'reference',
    name: 'Reference & Practice',
    icon: '📚',
    description: 'Artists, troubleshooting, exercises, DAW configs',
    color: '#ec4899'
  }
];

// Build searchable content index
function buildSearchIndex() {
  const index = [];

  // Song structures
  Object.entries(SONG_STRUCTURES).forEach(([genreId, structure]) => {
    index.push({
      id: `structure-${genreId}`,
      category: 'structure',
      title: structure.name,
      content: `${structure.description} ${structure.philosophy}`,
      data: structure,
      type: 'structure'
    });

    structure.sections.forEach(section => {
      index.push({
        id: `structure-${genreId}-${section.id}`,
        category: 'structure',
        title: `${structure.name}: ${section.name}`,
        content: `${section.purpose} ${section.tips?.join(' ')}`,
        data: section,
        type: 'section',
        parent: genreId
      });
    });
  });

  // Modes
  Object.entries(MODES).forEach(([modeId, mode]) => {
    index.push({
      id: `theory-mode-${modeId}`,
      category: 'theory',
      title: mode.name,
      content: `${mode.character} ${mode.emotion} ${mode.genreUse}`,
      data: mode,
      type: 'mode'
    });
  });

  // Chord progressions
  Object.entries(CHORD_PROGRESSIONS).forEach(([genre, progressions]) => {
    Object.entries(progressions).forEach(([progId, prog]) => {
      index.push({
        id: `theory-progression-${genre}-${progId}`,
        category: 'theory',
        title: `${prog.name} (${genre})`,
        content: `${prog.numerals} ${prog.example} ${prog.emotion}`,
        data: prog,
        type: 'progression',
        genre
      });
    });
  });

  // Rhythm patterns
  getAllPatterns().forEach(pattern => {
    index.push({
      id: `rhythm-${pattern.id}`,
      category: 'rhythm',
      title: pattern.name,
      content: `${pattern.description} ${pattern.tips?.join(' ')}`,
      data: pattern,
      type: 'pattern',
      genre: pattern.genre
    });
  });

  // Signal chains
  Object.entries(VOCAL_CHAINS).forEach(([chainId, chain]) => {
    index.push({
      id: `signal-vocal-${chainId}`,
      category: 'signalChains',
      title: chain.name,
      content: chain.description,
      data: chain,
      type: 'chain'
    });
  });

  Object.entries(SYNTH_CHAINS).forEach(([chainId, chain]) => {
    index.push({
      id: `signal-synth-${chainId}`,
      category: 'signalChains',
      title: chain.name,
      content: chain.description,
      data: chain,
      type: 'chain'
    });
  });

  index.push({
    id: 'signal-master',
    category: 'signalChains',
    title: MASTER_BUS_CHAIN.name,
    content: MASTER_BUS_CHAIN.description,
    data: MASTER_BUS_CHAIN,
    type: 'chain'
  });

  // Mixing targets
  Object.entries(GENRE_TARGETS).forEach(([targetId, target]) => {
    index.push({
      id: `mixing-target-${targetId}`,
      category: 'mixing',
      title: target.name,
      content: target.description,
      data: target,
      type: 'target'
    });
  });

  // Reference artists
  Object.entries(REFERENCE_ARTISTS).forEach(([genre, artists]) => {
    artists.forEach(artist => {
      index.push({
        id: `reference-artist-${genre}-${artist.name.replace(/\s+/g, '-')}`,
        category: 'reference',
        title: artist.name,
        content: `${artist.specialty} ${artist.techniques?.join(' ')} ${artist.signatureSound}`,
        data: artist,
        type: 'artist',
        genre
      });
    });
  });

  // Troubleshooting
  Object.entries(TROUBLESHOOTING).forEach(([problemId, problem]) => {
    index.push({
      id: `reference-problem-${problemId}`,
      category: 'reference',
      title: problem.problem,
      content: `${problem.symptoms?.join(' ')} ${problem.causes?.join(' ')}`,
      data: problem,
      type: 'troubleshooting'
    });
  });

  return index;
}

export function useKnowledgeLab() {
  const [activeView, setActiveView] = useState('browse'); // 'browse', 'structure', 'practice'
  const [activeCategory, setActiveCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [selectedGenre, setSelectedGenre] = useState('pop');

  // Build search index once
  const searchIndex = useMemo(() => buildSearchIndex(), []);

  // Search functionality
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase();
    const results = searchIndex.filter(item => {
      const searchText = `${item.title} ${item.content}`.toLowerCase();
      return searchText.includes(query);
    });

    // Sort by relevance (title matches first)
    results.sort((a, b) => {
      const aTitle = a.title.toLowerCase().includes(query);
      const bTitle = b.title.toLowerCase().includes(query);
      if (aTitle && !bTitle) return -1;
      if (!aTitle && bTitle) return 1;
      return 0;
    });

    return results.slice(0, 20); // Limit results
  }, [searchQuery, searchIndex]);

  // Get items by category
  const getItemsByCategory = useCallback((categoryId) => {
    return searchIndex.filter(item => item.category === categoryId);
  }, [searchIndex]);

  // Toggle expanded state
  const toggleExpanded = useCallback((itemId) => {
    setExpandedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchQuery('');
  }, []);

  // Get data for specific views
  const structureData = useMemo(() => ({
    structures: SONG_STRUCTURES,
    sectionTypes: SECTION_TYPES,
    selectedStructure: SONG_STRUCTURES[selectedGenre]
  }), [selectedGenre]);

  const theoryData = useMemo(() => ({
    modes: MODES,
    progressions: CHORD_PROGRESSIONS,
    melodyConstruction: MELODY_CONSTRUCTION,
    tensionRelease: TENSION_RELEASE
  }), []);

  const rhythmData = useMemo(() => ({
    categories: PATTERN_CATEGORIES,
    allPatterns: getAllPatterns()
  }), []);

  const signalChainData = useMemo(() => ({
    vocal: VOCAL_CHAINS,
    synth: SYNTH_CHAINS,
    kickBass: KICK_BASS_CHAINS,
    master: MASTER_BUS_CHAIN,
    frequencyAllocation: FREQUENCY_ALLOCATION
  }), []);

  const mixingData = useMemo(() => ({
    targets: GENRE_TARGETS,
    loudness: LOUDNESS_STANDARDS,
    psychoacoustic: EQUAL_LOUDNESS_PROFILES
  }), []);

  const referenceData = useMemo(() => ({
    artists: REFERENCE_ARTISTS,
    troubleshooting: TROUBLESHOOTING,
    exercises: PRACTICE_EXERCISES,
    quickReference: QUICK_REFERENCE,
    dawConfigs: DAW_CONFIGS
  }), []);

  return {
    // State
    activeView,
    activeCategory,
    searchQuery,
    expandedItems,
    selectedGenre,
    categories: CATEGORIES,

    // Actions
    setActiveView,
    setActiveCategory,
    setSearchQuery,
    toggleExpanded,
    clearSearch,
    setSelectedGenre,

    // Search
    searchResults,
    getItemsByCategory,

    // Data
    structureData,
    theoryData,
    rhythmData,
    signalChainData,
    mixingData,
    referenceData
  };
}

export default useKnowledgeLab;
