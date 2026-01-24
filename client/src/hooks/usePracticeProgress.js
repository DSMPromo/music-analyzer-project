/**
 * usePracticeProgress Hook
 * Tracks practice exercise progress with localStorage persistence
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PRACTICE_EXERCISES } from '../data/referenceData';

const STORAGE_KEY = 'music-analyzer-practice-progress';

// Initialize progress state
function initializeProgress() {
  const progress = {};

  Object.keys(PRACTICE_EXERCISES).forEach(weekKey => {
    const week = PRACTICE_EXERCISES[weekKey];
    progress[weekKey] = {
      exercises: {},
      startedAt: null,
      completedAt: null
    };

    week.exercises.forEach((exercise, index) => {
      progress[weekKey].exercises[index] = {
        completed: false,
        completedAt: null,
        notes: '',
        criteria: exercise.criteria.map(() => false)
      };
    });
  });

  return progress;
}

// Load from localStorage
function loadProgress() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Error loading practice progress:', e);
  }
  return initializeProgress();
}

// Save to localStorage
function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Error saving practice progress:', e);
  }
}

export function usePracticeProgress() {
  const [progress, setProgress] = useState(loadProgress);
  const [activeWeek, setActiveWeek] = useState('week1');
  const [activeExercise, setActiveExercise] = useState(0);

  // Save to localStorage when progress changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // Get current week data
  const currentWeek = useMemo(() => {
    return PRACTICE_EXERCISES[activeWeek] || PRACTICE_EXERCISES.week1;
  }, [activeWeek]);

  // Get current exercise data
  const currentExercise = useMemo(() => {
    return currentWeek.exercises[activeExercise] || currentWeek.exercises[0];
  }, [currentWeek, activeExercise]);

  // Get progress for current exercise
  const currentProgress = useMemo(() => {
    return progress[activeWeek]?.exercises[activeExercise] || {
      completed: false,
      completedAt: null,
      notes: '',
      criteria: []
    };
  }, [progress, activeWeek, activeExercise]);

  // Calculate overall progress
  const overallProgress = useMemo(() => {
    let totalExercises = 0;
    let completedExercises = 0;

    Object.keys(PRACTICE_EXERCISES).forEach(weekKey => {
      const week = PRACTICE_EXERCISES[weekKey];
      week.exercises.forEach((_, index) => {
        totalExercises++;
        if (progress[weekKey]?.exercises[index]?.completed) {
          completedExercises++;
        }
      });
    });

    return {
      total: totalExercises,
      completed: completedExercises,
      percentage: totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0
    };
  }, [progress]);

  // Calculate week progress
  const weekProgress = useMemo(() => {
    const result = {};

    Object.keys(PRACTICE_EXERCISES).forEach(weekKey => {
      const week = PRACTICE_EXERCISES[weekKey];
      let completed = 0;

      week.exercises.forEach((_, index) => {
        if (progress[weekKey]?.exercises[index]?.completed) {
          completed++;
        }
      });

      result[weekKey] = {
        total: week.exercises.length,
        completed,
        percentage: Math.round((completed / week.exercises.length) * 100)
      };
    });

    return result;
  }, [progress]);

  // Mark exercise as completed
  const markCompleted = useCallback((weekKey, exerciseIndex, completed = true) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      if (!newProgress[weekKey]) {
        newProgress[weekKey] = { exercises: {} };
      }
      if (!newProgress[weekKey].exercises[exerciseIndex]) {
        newProgress[weekKey].exercises[exerciseIndex] = { criteria: [] };
      }

      newProgress[weekKey].exercises[exerciseIndex] = {
        ...newProgress[weekKey].exercises[exerciseIndex],
        completed,
        completedAt: completed ? new Date().toISOString() : null
      };

      // Check if all exercises in week are completed
      const week = PRACTICE_EXERCISES[weekKey];
      const allCompleted = week.exercises.every((_, i) =>
        newProgress[weekKey].exercises[i]?.completed
      );

      if (allCompleted && !newProgress[weekKey].completedAt) {
        newProgress[weekKey].completedAt = new Date().toISOString();
      }

      return newProgress;
    });
  }, []);

  // Toggle criterion completion
  const toggleCriterion = useCallback((weekKey, exerciseIndex, criterionIndex) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      if (!newProgress[weekKey]) {
        newProgress[weekKey] = { exercises: {} };
      }
      if (!newProgress[weekKey].exercises[exerciseIndex]) {
        newProgress[weekKey].exercises[exerciseIndex] = { criteria: [], completed: false };
      }

      const criteria = [...(newProgress[weekKey].exercises[exerciseIndex].criteria || [])];
      criteria[criterionIndex] = !criteria[criterionIndex];

      newProgress[weekKey].exercises[exerciseIndex] = {
        ...newProgress[weekKey].exercises[exerciseIndex],
        criteria
      };

      // Auto-mark as completed if all criteria are met
      const exercise = PRACTICE_EXERCISES[weekKey].exercises[exerciseIndex];
      const allCriteriaMet = exercise.criteria.every((_, i) => criteria[i]);

      if (allCriteriaMet && !newProgress[weekKey].exercises[exerciseIndex].completed) {
        newProgress[weekKey].exercises[exerciseIndex].completed = true;
        newProgress[weekKey].exercises[exerciseIndex].completedAt = new Date().toISOString();
      }

      return newProgress;
    });
  }, []);

  // Update exercise notes
  const updateNotes = useCallback((weekKey, exerciseIndex, notes) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      if (!newProgress[weekKey]) {
        newProgress[weekKey] = { exercises: {} };
      }
      if (!newProgress[weekKey].exercises[exerciseIndex]) {
        newProgress[weekKey].exercises[exerciseIndex] = { criteria: [], completed: false };
      }

      newProgress[weekKey].exercises[exerciseIndex] = {
        ...newProgress[weekKey].exercises[exerciseIndex],
        notes
      };

      return newProgress;
    });
  }, []);

  // Start a week (mark start date)
  const startWeek = useCallback((weekKey) => {
    setProgress(prev => {
      const newProgress = { ...prev };
      if (!newProgress[weekKey]) {
        newProgress[weekKey] = { exercises: {} };
      }
      if (!newProgress[weekKey].startedAt) {
        newProgress[weekKey].startedAt = new Date().toISOString();
      }
      return newProgress;
    });
    setActiveWeek(weekKey);
    setActiveExercise(0);
  }, []);

  // Reset all progress
  const resetProgress = useCallback(() => {
    const fresh = initializeProgress();
    setProgress(fresh);
    setActiveWeek('week1');
    setActiveExercise(0);
  }, []);

  // Navigate to next exercise
  const nextExercise = useCallback(() => {
    if (activeExercise < currentWeek.exercises.length - 1) {
      setActiveExercise(prev => prev + 1);
    } else {
      // Move to next week
      const weekKeys = Object.keys(PRACTICE_EXERCISES);
      const currentIndex = weekKeys.indexOf(activeWeek);
      if (currentIndex < weekKeys.length - 1) {
        setActiveWeek(weekKeys[currentIndex + 1]);
        setActiveExercise(0);
      }
    }
  }, [activeExercise, activeWeek, currentWeek.exercises.length]);

  // Navigate to previous exercise
  const prevExercise = useCallback(() => {
    if (activeExercise > 0) {
      setActiveExercise(prev => prev - 1);
    } else {
      // Move to previous week
      const weekKeys = Object.keys(PRACTICE_EXERCISES);
      const currentIndex = weekKeys.indexOf(activeWeek);
      if (currentIndex > 0) {
        const prevWeekKey = weekKeys[currentIndex - 1];
        setActiveWeek(prevWeekKey);
        setActiveExercise(PRACTICE_EXERCISES[prevWeekKey].exercises.length - 1);
      }
    }
  }, [activeExercise, activeWeek]);

  return {
    // State
    progress,
    activeWeek,
    activeExercise,
    currentWeek,
    currentExercise,
    currentProgress,
    overallProgress,
    weekProgress,

    // Navigation
    setActiveWeek,
    setActiveExercise,
    nextExercise,
    prevExercise,

    // Actions
    markCompleted,
    toggleCriterion,
    updateNotes,
    startWeek,
    resetProgress,

    // Data
    weeks: PRACTICE_EXERCISES
  };
}

export default usePracticeProgress;
