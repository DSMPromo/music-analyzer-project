/**
 * useStructureBuilder Hook
 * Manages drag-drop state and section management for song structure builder
 */

import { useState, useCallback, useMemo } from 'react';
import { SONG_STRUCTURES, SECTION_TYPES, calculateDuration } from '../data/songStructures';

// Generate unique ID
const generateId = () => `section-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function useStructureBuilder(initialBpm = 120) {
  const [sections, setSections] = useState([]);
  const [bpm, setBpm] = useState(initialBpm);
  const [selectedGenre, setSelectedGenre] = useState('pop');
  const [draggedSection, setDraggedSection] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  // Calculate totals
  const totalBars = useMemo(() => {
    return sections.reduce((sum, s) => sum + s.bars, 0);
  }, [sections]);

  const totalDuration = useMemo(() => {
    return calculateDuration(totalBars, bpm);
  }, [totalBars, bpm]);

  // Format duration as mm:ss
  const formattedDuration = useMemo(() => {
    const mins = Math.floor(totalDuration / 60);
    const secs = Math.floor(totalDuration % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, [totalDuration]);

  // Get section type info
  const getSectionType = useCallback((typeId) => {
    return SECTION_TYPES.find(t => t.id === typeId) || SECTION_TYPES[0];
  }, []);

  // Drag handlers
  const handleDragStart = useCallback((e, sectionType, sourceIndex = null) => {
    setDraggedSection({ type: sectionType, sourceIndex });
    e.dataTransfer.effectAllowed = sourceIndex !== null ? 'move' : 'copy';
    e.dataTransfer.setData('text/plain', sectionType.id);
  }, []);

  const handleDragOver = useCallback((e, targetIndex) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedSection?.sourceIndex !== null ? 'move' : 'copy';
    setDragOverIndex(targetIndex);
  }, [draggedSection]);

  const handleDragEnd = useCallback(() => {
    setDraggedSection(null);
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback((e, targetIndex) => {
    e.preventDefault();

    if (!draggedSection) return;

    const { type, sourceIndex } = draggedSection;

    setSections(prev => {
      const newSections = [...prev];

      if (sourceIndex !== null) {
        // Moving existing section
        const [removed] = newSections.splice(sourceIndex, 1);
        const insertIndex = targetIndex > sourceIndex ? targetIndex - 1 : targetIndex;
        newSections.splice(insertIndex, 0, removed);
      } else {
        // Adding new section from palette
        const newSection = {
          id: generateId(),
          typeId: type.id,
          bars: type.defaultBars,
          energy: 5,
          notes: ''
        };
        newSections.splice(targetIndex, 0, newSection);
      }

      return newSections;
    });

    setDraggedSection(null);
    setDragOverIndex(null);
  }, [draggedSection]);

  // Section management
  const addSection = useCallback((typeId, index = null) => {
    const sectionType = getSectionType(typeId);
    const newSection = {
      id: generateId(),
      typeId,
      bars: sectionType.defaultBars,
      energy: 5,
      notes: ''
    };

    setSections(prev => {
      if (index !== null) {
        const newSections = [...prev];
        newSections.splice(index, 0, newSection);
        return newSections;
      }
      return [...prev, newSection];
    });
  }, [getSectionType]);

  const removeSection = useCallback((sectionId) => {
    setSections(prev => prev.filter(s => s.id !== sectionId));
  }, []);

  const updateSection = useCallback((sectionId, updates) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, ...updates } : s
    ));
  }, []);

  const resizeSection = useCallback((sectionId, newBars) => {
    const minBars = 4;
    const maxBars = 128;
    const bars = Math.max(minBars, Math.min(maxBars, newBars));
    updateSection(sectionId, { bars });
  }, [updateSection]);

  const reorderSections = useCallback((fromIndex, toIndex) => {
    setSections(prev => {
      const newSections = [...prev];
      const [removed] = newSections.splice(fromIndex, 1);
      newSections.splice(toIndex, 0, removed);
      return newSections;
    });
  }, []);

  // Clear all sections
  const clearSections = useCallback(() => {
    setSections([]);
  }, []);

  // Apply genre template
  const applyTemplate = useCallback((genreId) => {
    const template = SONG_STRUCTURES[genreId];
    if (!template) return;

    const newSections = template.sections.map(s => ({
      id: generateId(),
      typeId: s.id.replace(/[0-9]/g, ''), // Remove numbers from id (verse1 -> verse)
      bars: s.bars,
      energy: s.energy,
      notes: s.purpose
    }));

    setSections(newSections);
    setSelectedGenre(genreId);

    // Set BPM to middle of range
    const [minBpm, maxBpm] = template.bpmRange;
    setBpm(Math.round((minBpm + maxBpm) / 2));
  }, []);

  // Calculate bar positions for timeline
  const sectionPositions = useMemo(() => {
    let currentBar = 1;
    return sections.map(s => {
      const position = {
        ...s,
        startBar: currentBar,
        endBar: currentBar + s.bars - 1,
        sectionType: getSectionType(s.typeId)
      };
      currentBar += s.bars;
      return position;
    });
  }, [sections, getSectionType]);

  // Calculate energy curve
  const energyCurve = useMemo(() => {
    return sectionPositions.map(s => ({
      startBar: s.startBar,
      endBar: s.endBar,
      energy: s.energy
    }));
  }, [sectionPositions]);

  // Check if structure matches a genre template
  const genreMatchScore = useMemo(() => {
    const template = SONG_STRUCTURES[selectedGenre];
    if (!template || sections.length === 0) return 0;

    let matches = 0;
    const templateSections = template.sections;

    // Simple matching: check if section types appear in similar order
    sections.forEach((s, i) => {
      if (templateSections[i]) {
        const templateTypeId = templateSections[i].id.replace(/[0-9]/g, '');
        if (s.typeId === templateTypeId) {
          matches++;
        }
      }
    });

    return Math.round((matches / Math.max(sections.length, templateSections.length)) * 100);
  }, [sections, selectedGenre]);

  // Export structure as markers
  const exportAsMarkers = useCallback(() => {
    return sectionPositions.map(s => ({
      name: s.sectionType.name,
      bar: s.startBar,
      time: calculateDuration(s.startBar - 1, bpm),
      color: s.sectionType.color
    }));
  }, [sectionPositions, bpm]);

  return {
    // State
    sections,
    sectionPositions,
    bpm,
    selectedGenre,
    totalBars,
    totalDuration,
    formattedDuration,
    energyCurve,
    genreMatchScore,

    // Drag state
    draggedSection,
    dragOverIndex,

    // Actions
    setBpm,
    setSelectedGenre,
    addSection,
    removeSection,
    updateSection,
    resizeSection,
    reorderSections,
    clearSections,
    applyTemplate,

    // Drag handlers
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDrop,

    // Utilities
    getSectionType,
    exportAsMarkers,
    SECTION_TYPES
  };
}

export default useStructureBuilder;
