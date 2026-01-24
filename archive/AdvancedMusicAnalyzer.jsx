import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ==================== CONSTANTS & TYPES ====================

// Absorption coefficients for common materials at different frequencies
const ABSORPTION_COEFFICIENTS = {
  // Material: [125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz]
  concrete: [0.01, 0.01, 0.02, 0.02, 0.02, 0.03],
  brick: [0.03, 0.03, 0.03, 0.04, 0.05, 0.07],
  plasterboard: [0.29, 0.10, 0.06, 0.05, 0.04, 0.04],
  glass: [0.35, 0.25, 0.18, 0.12, 0.07, 0.04],
  wood_floor: [0.15, 0.11, 0.10, 0.07, 0.06, 0.07],
  carpet_thick: [0.02, 0.06, 0.14, 0.37, 0.60, 0.65],
  carpet_thin: [0.02, 0.04, 0.08, 0.20, 0.35, 0.40],
  curtains_heavy: [0.07, 0.31, 0.49, 0.75, 0.70, 0.60],
  curtains_light: [0.03, 0.04, 0.11, 0.17, 0.24, 0.35],
  acoustic_foam: [0.08, 0.25, 0.60, 0.90, 0.95, 0.90],
  acoustic_panels: [0.10, 0.40, 0.80, 0.95, 0.90, 0.85],
  bass_traps: [0.35, 0.50, 0.65, 0.70, 0.65, 0.60],
  fiberglass: [0.12, 0.28, 0.55, 0.75, 0.80, 0.85],
  rockwool: [0.15, 0.35, 0.65, 0.85, 0.90, 0.85],
  ceiling_tiles: [0.05, 0.22, 0.52, 0.56, 0.45, 0.32],
  people_seated: [0.25, 0.35, 0.42, 0.46, 0.50, 0.50],
  upholstered_seats: [0.19, 0.37, 0.56, 0.67, 0.61, 0.59],
};

// Genre-specific production characteristics
const GENRE_PRESETS = {
  house: {
    name: 'House',
    bpm: { min: 120, max: 130, typical: 125 },
    kickFreq: { fundamental: 50, click: 2500, body: 100 },
    bassFreq: { low: 40, mid: 100, high: 200 },
    reverb: { time: 1.2, predelay: 20, wetMix: 0.15 },
    compression: { threshold: -12, ratio: 4, attack: 10, release: 100 },
    syncopation: [
      { name: 'Four-on-floor', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      { name: 'Offbeat hats', pattern: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
      { name: 'Syncopated bass', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0] },
    ],
    characteristics: [
      '4/4 time signature with kick on every beat',
      'Clap/snare on beats 2 and 4',
      'Open hi-hats on off-beats (8th notes)',
      'Closed hi-hats on 16th notes',
      'Syncopated basslines emphasizing off-beats',
      'Chord stabs on upbeats',
      'Pre-shifted claps (~20ms before beat)',
    ],
    targetRT60: 0.4,
    eqCurve: { low: +3, lowMid: 0, mid: -2, highMid: +1, high: +2 },
  },
  deepHouse: {
    name: 'Deep House',
    bpm: { min: 118, max: 126, typical: 122 },
    kickFreq: { fundamental: 55, click: 2000, body: 90 },
    bassFreq: { low: 45, mid: 90, high: 180 },
    reverb: { time: 1.8, predelay: 30, wetMix: 0.25 },
    compression: { threshold: -10, ratio: 3, attack: 15, release: 150 },
    syncopation: [
      { name: 'Laid-back groove', pattern: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0] },
      { name: 'Swung 16ths', pattern: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1] },
    ],
    characteristics: [
      'Warmer, more organic sound',
      'TR-909 style drums',
      'Longer reverb tails',
      'Jazz/soul chord progressions',
      'Sub-bass below kick',
      'Rimshot embellishments',
    ],
    targetRT60: 0.5,
    eqCurve: { low: +2, lowMid: +1, mid: -1, highMid: 0, high: +1 },
  },
  techno: {
    name: 'Techno',
    bpm: { min: 130, max: 150, typical: 138 },
    kickFreq: { fundamental: 45, click: 3000, body: 80 },
    bassFreq: { low: 35, mid: 80, high: 160 },
    reverb: { time: 2.5, predelay: 40, wetMix: 0.20 },
    compression: { threshold: -8, ratio: 6, attack: 5, release: 80 },
    syncopation: [
      { name: 'Driving 4/4', pattern: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
      { name: 'Rolling hats', pattern: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1] },
      { name: 'Industrial groove', pattern: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 1] },
    ],
    characteristics: [
      'Harder, more aggressive kick',
      'Minimal melodic elements',
      'Heavy use of FX and risers',
      'Industrial textures',
      'Darker atmospheres',
      '32nd note hi-hat rolls',
    ],
    targetRT60: 0.6,
    eqCurve: { low: +4, lowMid: -2, mid: -3, highMid: +2, high: +3 },
  },
  drumAndBass: {
    name: 'Drum & Bass',
    bpm: { min: 160, max: 180, typical: 174 },
    kickFreq: { fundamental: 60, click: 4000, body: 120 },
    bassFreq: { low: 50, mid: 120, high: 300 },
    reverb: { time: 0.8, predelay: 10, wetMix: 0.10 },
    compression: { threshold: -6, ratio: 8, attack: 2, release: 50 },
    syncopation: [
      { name: 'Two-step', pattern: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0] },
      { name: 'Amen break', pattern: [1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0] },
      { name: 'Reese pattern', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] },
    ],
    characteristics: [
      'Fast breakbeats (160-180 BPM)',
      'Heavy sub-bass (Reese bass)',
      'Snare on 2 and 4 (half-time feel)',
      'Complex drum patterns',
      'Chopped break samples',
      'Rolling basslines',
    ],
    targetRT60: 0.3,
    eqCurve: { low: +5, lowMid: -1, mid: -2, highMid: +3, high: +4 },
  },
  hiphop: {
    name: 'Hip-Hop',
    bpm: { min: 80, max: 115, typical: 95 },
    kickFreq: { fundamental: 55, click: 2000, body: 100 },
    bassFreq: { low: 40, mid: 80, high: 150 },
    reverb: { time: 1.0, predelay: 15, wetMix: 0.12 },
    compression: { threshold: -10, ratio: 4, attack: 8, release: 120 },
    syncopation: [
      { name: 'Boom bap', pattern: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] },
      { name: 'Trap', pattern: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0] },
      { name: 'Lo-fi swing', pattern: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0] },
    ],
    characteristics: [
      'Heavy 808 kick/bass',
      'Snare/clap on 2 and 4',
      'Hi-hat rolls and triplets',
      'Swing/groove emphasis',
      'Sample-based production',
      'Layered percussion',
    ],
    targetRT60: 0.35,
    eqCurve: { low: +4, lowMid: +1, mid: 0, highMid: +2, high: +1 },
  },
};

// Room type presets with typical characteristics
const ROOM_PRESETS = {
  bedroom: {
    name: 'Bedroom Studio',
    dimensions: { length: 4, width: 3.5, height: 2.4 },
    surfaces: {
      floor: 'carpet_thin',
      ceiling: 'plasterboard',
      walls: 'plasterboard',
    },
    idealRT60: { min: 0.2, max: 0.4, target: 0.3 },
    issues: ['Flutter echo', 'Bass buildup in corners', 'Comb filtering'],
    solutions: ['Add bass traps in corners', 'Absorption at first reflection points', 'Diffusion on rear wall'],
  },
  liveRoom: {
    name: 'Live Recording Room',
    dimensions: { length: 8, width: 6, height: 3 },
    surfaces: {
      floor: 'wood_floor',
      ceiling: 'ceiling_tiles',
      walls: 'acoustic_panels',
    },
    idealRT60: { min: 0.4, max: 0.8, target: 0.6 },
    issues: ['Standing waves', 'Early reflections'],
    solutions: ['Variable acoustics (curtains)', 'Gobos for isolation', 'Diffusion for liveness'],
  },
  vocalBooth: {
    name: 'Vocal Booth',
    dimensions: { length: 2, width: 1.8, height: 2.2 },
    surfaces: {
      floor: 'carpet_thick',
      ceiling: 'acoustic_foam',
      walls: 'acoustic_foam',
    },
    idealRT60: { min: 0.1, max: 0.25, target: 0.15 },
    issues: ['Box coloration', 'Low frequency buildup'],
    solutions: ['Thick absorption', 'Corner treatment', 'Angled surfaces'],
  },
  controlRoom: {
    name: 'Control Room',
    dimensions: { length: 6, width: 5, height: 2.8 },
    surfaces: {
      floor: 'carpet_thick',
      ceiling: 'acoustic_panels',
      walls: 'acoustic_panels',
    },
    idealRT60: { min: 0.25, max: 0.4, target: 0.3 },
    issues: ['SBIR (speaker-boundary interference)', 'Modal resonances'],
    solutions: ['Symmetric treatment', 'Bass traps', 'First reflection absorption'],
  },
};

// ==================== ACOUSTIC CALCULATIONS ====================

/**
 * Calculate RT60 using Sabine's formula
 * RT60 = 0.161 * V / A
 * Where V = volume in m³, A = total absorption in sabins
 */
function calculateRT60Sabine(volume, totalAbsorption) {
  if (totalAbsorption <= 0) return Infinity;
  return (0.161 * volume) / totalAbsorption;
}

/**
 * Calculate RT60 using Eyring's formula (more accurate for dead rooms)
 * RT60 = 0.161 * V / (-S * ln(1 - α))
 */
function calculateRT60Eyring(volume, totalArea, avgAbsorption) {
  if (avgAbsorption >= 1) return 0;
  if (avgAbsorption <= 0) return Infinity;
  return (0.161 * volume) / (-totalArea * Math.log(1 - avgAbsorption));
}

/**
 * Calculate room modes (eigenfrequencies)
 * f = (c/2) * sqrt((nx/Lx)² + (ny/Ly)² + (nz/Lz)²)
 */
function calculateRoomModes(length, width, height, speedOfSound = 343) {
  const modes = [];
  
  for (let nx = 0; nx <= 4; nx++) {
    for (let ny = 0; ny <= 4; ny++) {
      for (let nz = 0; nz <= 4; nz++) {
        if (nx === 0 && ny === 0 && nz === 0) continue;
        
        const freq = (speedOfSound / 2) * Math.sqrt(
          Math.pow(nx / length, 2) +
          Math.pow(ny / width, 2) +
          Math.pow(nz / height, 2)
        );
        
        if (freq <= 300) { // Focus on problematic low frequencies
          let type = '';
          if ((nx > 0 && ny === 0 && nz === 0) ||
              (nx === 0 && ny > 0 && nz === 0) ||
              (nx === 0 && ny === 0 && nz > 0)) {
            type = 'Axial';
          } else if ((nx > 0 && ny > 0 && nz === 0) ||
                     (nx > 0 && ny === 0 && nz > 0) ||
                     (nx === 0 && ny > 0 && nz > 0)) {
            type = 'Tangential';
          } else {
            type = 'Oblique';
          }
          
          modes.push({
            freq: Math.round(freq * 10) / 10,
            nx, ny, nz,
            type,
            severity: type === 'Axial' ? 'High' : type === 'Tangential' ? 'Medium' : 'Low',
          });
        }
      }
    }
  }
  
  return modes.sort((a, b) => a.freq - b.freq);
}

/**
 * Calculate total absorption for a room
 */
function calculateTotalAbsorption(room, frequencyIndex = 3) { // Default 1kHz
  const { dimensions, surfaces } = room;
  const { length, width, height } = dimensions;
  
  const floorArea = length * width;
  const ceilingArea = length * width;
  const wallArea = 2 * (length * height + width * height);
  
  const floorCoeff = ABSORPTION_COEFFICIENTS[surfaces.floor]?.[frequencyIndex] || 0.1;
  const ceilingCoeff = ABSORPTION_COEFFICIENTS[surfaces.ceiling]?.[frequencyIndex] || 0.1;
  const wallCoeff = ABSORPTION_COEFFICIENTS[surfaces.walls]?.[frequencyIndex] || 0.1;
  
  return (floorArea * floorCoeff) + (ceilingArea * ceilingCoeff) + (wallArea * wallCoeff);
}

/**
 * Calculate reverb parameters from spectrogram decay
 */
function analyzeReverbFromSpectrogram(spectrogramData, sampleRate) {
  // Schroeder integration (reverse cumulative energy)
  const energyCurve = [];
  let cumulativeEnergy = 0;
  
  for (let i = spectrogramData.length - 1; i >= 0; i--) {
    cumulativeEnergy += spectrogramData[i] * spectrogramData[i];
    energyCurve.unshift(cumulativeEnergy);
  }
  
  // Convert to dB
  const maxEnergy = Math.max(...energyCurve);
  const dbCurve = energyCurve.map(e => 10 * Math.log10(e / maxEnergy));
  
  // Find T60 (time to decay 60dB)
  const startIndex = dbCurve.findIndex(db => db <= -5);
  const endIndex = dbCurve.findIndex(db => db <= -35);
  
  if (startIndex >= 0 && endIndex > startIndex) {
    const t30 = (endIndex - startIndex) / sampleRate;
    return {
      rt60: t30 * 2, // Extrapolate to 60dB
      edt: startIndex / sampleRate * 6, // Early decay time
      t30,
    };
  }
  
  return null;
}

/**
 * Calculate delay times based on room dimensions
 */
function calculateDelayTimes(length, width, height, speedOfSound = 343) {
  // First reflections
  const delays = {
    frontWall: (2 * length) / speedOfSound * 1000, // ms
    backWall: (2 * length) / speedOfSound * 1000,
    leftWall: (2 * width) / speedOfSound * 1000,
    rightWall: (2 * width) / speedOfSound * 1000,
    ceiling: (2 * height) / speedOfSound * 1000,
    floor: (2 * height) / speedOfSound * 1000,
  };
  
  // Predelay recommendation (based on room size)
  const avgDimension = (length + width + height) / 3;
  const predelay = Math.round(avgDimension * 2);
  
  return { delays, predelay };
}

// ==================== SYNCOPATION ANALYSIS ====================

/**
 * Detect syncopation in audio rhythm
 */
function analyzeSyncopation(onsetTimes, bpm) {
  const beatDuration = 60 / bpm; // seconds per beat
  const sixteenthDuration = beatDuration / 4;
  
  const syncopationScore = {
    offbeatHits: 0,
    totalHits: onsetTimes.length,
    swingRatio: 0,
    syncopationDensity: 0,
  };
  
  onsetTimes.forEach(onset => {
    const beatPosition = (onset % beatDuration) / beatDuration;
    const sixteenthPosition = Math.round(beatPosition * 16) % 16;
    
    // Check if hit is on an offbeat (odd 16th notes)
    if (sixteenthPosition % 2 === 1) {
      syncopationScore.offbeatHits++;
    }
  });
  
  syncopationScore.syncopationDensity = 
    syncopationScore.offbeatHits / syncopationScore.totalHits;
  
  return syncopationScore;
}

/**
 * Generate syncopation pattern visualization
 */
function generatePatternGrid(pattern) {
  return pattern.map((hit, i) => ({
    position: i,
    isHit: hit === 1,
    isBeat: i % 4 === 0,
    isOffbeat: i % 2 === 1,
  }));
}

// ==================== MAIN COMPONENT ====================

export default function AdvancedMusicAnalyzer() {
  // State
  const [selectedGenre, setSelectedGenre] = useState('house');
  const [selectedRoom, setSelectedRoom] = useState('bedroom');
  const [customRoom, setCustomRoom] = useState({
    length: 4,
    width: 3.5,
    height: 2.4,
    floor: 'carpet_thin',
    ceiling: 'plasterboard',
    walls: 'plasterboard',
  });
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState('reverb');
  
  // Refs
  const canvasRef = useRef(null);
  const spectrogramRef = useRef(null);
  
  // Computed values
  const genre = GENRE_PRESETS[selectedGenre];
  const roomPreset = ROOM_PRESETS[selectedRoom];
  
  // Calculate room acoustics
  const roomAnalysis = useMemo(() => {
    const room = {
      dimensions: customRoom,
      surfaces: {
        floor: customRoom.floor,
        ceiling: customRoom.ceiling,
        walls: customRoom.walls,
      },
    };
    
    const { length, width, height } = customRoom;
    const volume = length * width * height;
    const totalArea = 2 * (length * width + length * height + width * height);
    
    // Calculate RT60 at different frequencies
    const frequencies = [125, 250, 500, 1000, 2000, 4000];
    const rt60Values = frequencies.map((freq, i) => {
      const absorption = calculateTotalAbsorption(room, i);
      const avgAbsorption = absorption / totalArea;
      return {
        frequency: freq,
        sabine: calculateRT60Sabine(volume, absorption),
        eyring: calculateRT60Eyring(volume, totalArea, avgAbsorption),
      };
    });
    
    // Calculate room modes
    const modes = calculateRoomModes(length, width, height);
    
    // Calculate delay times
    const delayInfo = calculateDelayTimes(length, width, height);
    
    // Schroeder frequency (transition between modal and statistical behavior)
    const avgRT60 = rt60Values.reduce((sum, v) => sum + v.sabine, 0) / rt60Values.length;
    const schroederFreq = 2000 * Math.sqrt(avgRT60 / volume);
    
    return {
      volume,
      totalArea,
      rt60Values,
      avgRT60,
      modes,
      delayInfo,
      schroederFreq,
      recommendations: generateRecommendations(avgRT60, genre.targetRT60, modes),
    };
  }, [customRoom, genre]);
  
  // Generate recommendations
  function generateRecommendations(currentRT60, targetRT60, modes) {
    const recommendations = [];
    
    if (currentRT60 > targetRT60 * 1.3) {
      recommendations.push({
        type: 'absorption',
        priority: 'high',
        message: `Room is too reverberant (${currentRT60.toFixed(2)}s vs target ${targetRT60.toFixed(2)}s)`,
        solution: 'Add acoustic panels or heavy curtains to walls',
      });
    } else if (currentRT60 < targetRT60 * 0.7) {
      recommendations.push({
        type: 'diffusion',
        priority: 'medium',
        message: `Room is too dead (${currentRT60.toFixed(2)}s vs target ${targetRT60.toFixed(2)}s)`,
        solution: 'Remove some absorption or add diffusers for liveliness',
      });
    }
    
    // Check for problematic modes
    const problematicModes = modes.filter(m => m.type === 'Axial' && m.freq < 100);
    if (problematicModes.length > 0) {
      recommendations.push({
        type: 'bass',
        priority: 'high',
        message: `${problematicModes.length} problematic bass modes detected`,
        solution: 'Install bass traps in room corners',
        frequencies: problematicModes.map(m => m.freq),
      });
    }
    
    return recommendations;
  }
  
  // Draw spectrogram
  useEffect(() => {
    if (!spectrogramRef.current) return;
    
    const canvas = spectrogramRef.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);
    
    // Draw frequency grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    
    const freqLabels = ['125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
    freqLabels.forEach((label, i) => {
      const y = height - (i + 1) * (height / 9);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px monospace';
      ctx.fillText(label, 5, y - 2);
    });
    
    // Draw simulated reverb decay
    const decayTime = roomAnalysis.avgRT60;
    for (let x = 0; x < width; x++) {
      const time = (x / width) * 3; // 3 second display
      const decay = Math.exp(-6.91 * time / decayTime); // -60dB decay
      
      for (let y = 0; y < height; y++) {
        const freq = Math.pow(10, 1.7 + (1 - y / height) * 2.5); // Log scale 50Hz-16kHz
        const freqDecay = decay * (1 - Math.abs(freq - 1000) / 10000);
        
        if (freqDecay > 0.01) {
          const hue = 240 - freqDecay * 180;
          const lightness = 20 + freqDecay * 60;
          ctx.fillStyle = `hsl(${hue}, 80%, ${lightness}%)`;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    
    // Mark room modes
    roomAnalysis.modes.slice(0, 10).forEach(mode => {
      const y = height - Math.log10(mode.freq / 50) / Math.log10(300 / 50) * height;
      ctx.strokeStyle = mode.type === 'Axial' ? '#ff4444' : '#ffaa44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(20, y);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.fillText(`${mode.freq}Hz`, 25, y + 3);
    });
    
  }, [roomAnalysis]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-gray-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            🎛️ Advanced Music Analyzer Pro
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Reverb Mathematics • Room Acoustics • Genre Analysis • Syncopation Patterns
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap justify-center">
          {['reverb', 'room', 'genre', 'patterns'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {tab === 'reverb' && '🔊 Reverb Math'}
              {tab === 'room' && '🏠 Room Acoustics'}
              {tab === 'genre' && '🎵 Genre Presets'}
              {tab === 'patterns' && '🥁 Syncopation'}
            </button>
          ))}
        </div>

        {/* Reverb Mathematics Tab */}
        {activeTab === 'reverb' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sabine/Eyring Calculator */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📐 RT60 Calculation (Sabine & Eyring)
              </h3>
              
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-gray-400">Length (m)</label>
                    <input
                      type="number"
                      value={customRoom.length}
                      onChange={e => setCustomRoom({...customRoom, length: parseFloat(e.target.value) || 0})}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Width (m)</label>
                    <input
                      type="number"
                      value={customRoom.width}
                      onChange={e => setCustomRoom({...customRoom, width: parseFloat(e.target.value) || 0})}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      step="0.1"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400">Height (m)</label>
                    <input
                      type="number"
                      value={customRoom.height}
                      onChange={e => setCustomRoom({...customRoom, height: parseFloat(e.target.value) || 0})}
                      className="w-full bg-gray-700 rounded px-3 py-2 text-sm"
                      step="0.1"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {['floor', 'ceiling', 'walls'].map(surface => (
                    <div key={surface}>
                      <label className="text-xs text-gray-400 capitalize">{surface}</label>
                      <select
                        value={customRoom[surface]}
                        onChange={e => setCustomRoom({...customRoom, [surface]: e.target.value})}
                        className="w-full bg-gray-700 rounded px-2 py-2 text-xs"
                      >
                        {Object.keys(ABSORPTION_COEFFICIENTS).map(mat => (
                          <option key={mat} value={mat}>
                            {mat.replace(/_/g, ' ')}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="bg-gray-900 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <div className="text-3xl font-bold text-cyan-400">
                      {roomAnalysis.avgRT60.toFixed(2)}s
                    </div>
                    <div className="text-xs text-gray-400">Average RT60</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Volume:</span>
                      <span className="ml-2">{roomAnalysis.volume.toFixed(1)} m³</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Surface:</span>
                      <span className="ml-2">{roomAnalysis.totalArea.toFixed(1)} m²</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Schroeder f:</span>
                      <span className="ml-2">{roomAnalysis.schroederFreq.toFixed(0)} Hz</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Target ({genre.name}):</span>
                      <span className="ml-2">{genre.targetRT60}s</span>
                    </div>
                  </div>
                </div>

                {/* RT60 by frequency */}
                <div className="space-y-2">
                  <div className="text-xs text-gray-400 font-medium">RT60 by Frequency Band:</div>
                  <div className="grid grid-cols-6 gap-1">
                    {roomAnalysis.rt60Values.map(({frequency, sabine}) => (
                      <div key={frequency} className="text-center">
                        <div className="text-xs text-gray-500">{frequency >= 1000 ? `${frequency/1000}k` : frequency}</div>
                        <div 
                          className="h-16 rounded relative overflow-hidden"
                          style={{background: `linear-gradient(to top, #6366f1 ${sabine * 50}%, transparent ${sabine * 50}%)`}}
                        >
                          <div className="absolute bottom-1 w-full text-xs text-white">
                            {sabine.toFixed(1)}s
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Spectrogram Visualization */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                📊 Reverb Decay Spectrogram
              </h3>
              
              <canvas
                ref={spectrogramRef}
                width={500}
                height={300}
                className="w-full rounded-lg bg-gray-900"
              />
              
              <div className="mt-4 flex items-center justify-between text-xs text-gray-400">
                <span>0s</span>
                <span>Time →</span>
                <span>3s</span>
              </div>
              
              <div className="mt-4 flex gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Axial Mode</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-400 rounded"></div>
                  <span>Tangential Mode</span>
                </div>
              </div>
            </div>

            {/* Delay Calculator */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">⏱️ First Reflection Delays</h3>
              
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(roomAnalysis.delayInfo.delays).map(([surface, delay]) => (
                  <div key={surface} className="bg-gray-900 rounded-lg p-3">
                    <div className="text-xs text-gray-400 capitalize">{surface.replace(/([A-Z])/g, ' $1')}</div>
                    <div className="text-lg font-bold text-purple-400">{delay.toFixed(1)} ms</div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-indigo-900/30 rounded-lg">
                <div className="text-sm font-medium">Recommended Predelay</div>
                <div className="text-2xl font-bold text-cyan-400">
                  {roomAnalysis.delayInfo.predelay} ms
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Based on room dimensions for natural separation
                </div>
              </div>
            </div>

            {/* Room Modes */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">🔊 Room Modes (Standing Waves)</h3>
              
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {roomAnalysis.modes.slice(0, 15).map((mode, i) => (
                  <div 
                    key={i}
                    className={`flex items-center justify-between p-2 rounded ${
                      mode.type === 'Axial' ? 'bg-red-900/30' :
                      mode.type === 'Tangential' ? 'bg-orange-900/30' : 'bg-gray-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold">{mode.freq} Hz</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        mode.type === 'Axial' ? 'bg-red-600' :
                        mode.type === 'Tangential' ? 'bg-orange-600' : 'bg-gray-600'
                      }`}>
                        {mode.type}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">
                      ({mode.nx}, {mode.ny}, {mode.nz})
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-4 p-3 bg-yellow-900/30 rounded-lg text-sm">
                <strong>⚠️ Axial modes</strong> are the strongest and most problematic.
                Target these with bass traps first.
              </div>
            </div>
          </div>
        )}

        {/* Room Acoustics Tab */}
        {activeTab === 'room' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Room Presets */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">🏠 Room Type Presets</h3>
              
              <div className="space-y-3">
                {Object.entries(ROOM_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedRoom(key);
                      setCustomRoom({
                        ...preset.dimensions,
                        floor: preset.surfaces.floor,
                        ceiling: preset.surfaces.ceiling,
                        walls: preset.surfaces.walls,
                      });
                    }}
                    className={`w-full text-left p-4 rounded-lg transition-all ${
                      selectedRoom === key
                        ? 'bg-purple-600 border-purple-400'
                        : 'bg-gray-900 hover:bg-gray-800'
                    } border border-gray-700`}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {preset.dimensions.length}m × {preset.dimensions.width}m × {preset.dimensions.height}m
                    </div>
                    <div className="text-xs mt-2">
                      Target RT60: {preset.idealRT60.target}s
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Room Issues & Solutions */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">🔧 Analysis & Recommendations</h3>
              
              {/* Current Issues */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Common Issues for {roomPreset.name}:</h4>
                <div className="flex flex-wrap gap-2">
                  {roomPreset.issues.map((issue, i) => (
                    <span key={i} className="px-3 py-1 bg-red-900/30 text-red-300 rounded-full text-sm">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>

              {/* Solutions */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Recommended Solutions:</h4>
                <div className="space-y-2">
                  {roomPreset.solutions.map((solution, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-green-900/20 rounded-lg">
                      <span className="text-green-400">✓</span>
                      <span className="text-sm">{solution}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analysis Results */}
              <div>
                <h4 className="text-sm font-medium text-gray-400 mb-3">Calculated Recommendations:</h4>
                <div className="space-y-2">
                  {roomAnalysis.recommendations.map((rec, i) => (
                    <div 
                      key={i}
                      className={`p-3 rounded-lg ${
                        rec.priority === 'high' ? 'bg-red-900/30' :
                        rec.priority === 'medium' ? 'bg-yellow-900/30' : 'bg-blue-900/30'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          rec.priority === 'high' ? 'bg-red-600' :
                          rec.priority === 'medium' ? 'bg-yellow-600' : 'bg-blue-600'
                        }`}>
                          {rec.priority.toUpperCase()}
                        </span>
                        <span className="text-sm font-medium">{rec.message}</span>
                      </div>
                      <div className="text-xs text-gray-400">{rec.solution}</div>
                      {rec.frequencies && (
                        <div className="text-xs text-gray-500 mt-1">
                          Problem frequencies: {rec.frequencies.join('Hz, ')}Hz
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Genre Presets Tab */}
        {activeTab === 'genre' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Genre Selector */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">🎵 Genre Selection</h3>
              
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(GENRE_PRESETS).map(([key, preset]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedGenre(key)}
                    className={`p-4 rounded-lg text-left transition-all ${
                      selectedGenre === key
                        ? 'bg-gradient-to-r from-purple-600 to-pink-600'
                        : 'bg-gray-900 hover:bg-gray-800'
                    }`}
                  >
                    <div className="font-medium">{preset.name}</div>
                    <div className="text-xs text-gray-300 mt-1">
                      {preset.bpm.min}-{preset.bpm.max} BPM
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Genre Details */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">📋 {genre.name} Characteristics</h3>
              
              <div className="space-y-4">
                {/* BPM */}
                <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg">
                  <span className="text-gray-400">Typical BPM</span>
                  <span className="text-xl font-bold text-cyan-400">{genre.bpm.typical}</span>
                </div>

                {/* Frequency Ranges */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-xs text-gray-400">Kick Fundamental</div>
                    <div className="text-lg font-bold">{genre.kickFreq.fundamental} Hz</div>
                  </div>
                  <div className="p-3 bg-gray-900 rounded-lg">
                    <div className="text-xs text-gray-400">Bass Range</div>
                    <div className="text-lg font-bold">{genre.bassFreq.low}-{genre.bassFreq.high} Hz</div>
                  </div>
                </div>

                {/* Reverb Settings */}
                <div className="p-3 bg-purple-900/30 rounded-lg">
                  <div className="text-sm font-medium mb-2">Reverb Settings</div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-gray-400">Time:</span> {genre.reverb.time}s
                    </div>
                    <div>
                      <span className="text-gray-400">Predelay:</span> {genre.reverb.predelay}ms
                    </div>
                    <div>
                      <span className="text-gray-400">Wet:</span> {(genre.reverb.wetMix * 100).toFixed(0)}%
                    </div>
                  </div>
                </div>

                {/* Characteristics */}
                <div>
                  <div className="text-sm font-medium mb-2">Key Production Points:</div>
                  <ul className="space-y-1">
                    {genre.characteristics.map((char, i) => (
                      <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        {char}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* EQ Curve */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">📈 Typical EQ Curve for {genre.name}</h3>
              
              <div className="h-32 flex items-end justify-around bg-gray-900 rounded-lg p-4">
                {Object.entries(genre.eqCurve).map(([band, db]) => (
                  <div key={band} className="flex flex-col items-center">
                    <div 
                      className={`w-12 rounded-t transition-all ${
                        db >= 0 ? 'bg-green-500' : 'bg-red-500'
                      }`}
                      style={{
                        height: `${Math.abs(db) * 15}px`,
                        marginBottom: db < 0 ? 0 : undefined,
                        marginTop: db >= 0 ? 0 : undefined,
                        transform: db < 0 ? 'scaleY(-1)' : undefined,
                      }}
                    />
                    <div className="text-xs text-gray-400 mt-2">{band}</div>
                    <div className="text-xs font-bold">{db > 0 ? '+' : ''}{db}dB</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Syncopation Patterns Tab */}
        {activeTab === 'patterns' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pattern Visualizer */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 lg:col-span-2">
              <h3 className="text-lg font-semibold mb-4">🥁 {genre.name} Syncopation Patterns</h3>
              
              <div className="space-y-6">
                {genre.syncopation.map((pattern, idx) => {
                  const grid = generatePatternGrid(pattern.pattern);
                  return (
                    <div key={idx} className="bg-gray-900 rounded-lg p-4">
                      <div className="text-sm font-medium mb-3">{pattern.name}</div>
                      
                      {/* Beat markers */}
                      <div className="flex gap-1 mb-1">
                        {[1, 2, 3, 4].map(beat => (
                          <div key={beat} className="flex-1 text-center text-xs text-gray-500">
                            Beat {beat}
                          </div>
                        ))}
                      </div>
                      
                      {/* Pattern grid */}
                      <div className="flex gap-0.5">
                        {grid.map((step, i) => (
                          <div
                            key={i}
                            className={`flex-1 h-12 rounded transition-all ${
                              step.isHit
                                ? step.isBeat
                                  ? 'bg-cyan-500'
                                  : step.isOffbeat
                                    ? 'bg-purple-500'
                                    : 'bg-pink-500'
                                : 'bg-gray-800'
                            } ${step.isBeat ? 'border-l-2 border-white/30' : ''}`}
                          />
                        ))}
                      </div>
                      
                      {/* 16th note markers */}
                      <div className="flex gap-0.5 mt-1">
                        {grid.map((step, i) => (
                          <div key={i} className="flex-1 text-center text-xs text-gray-600">
                            {i + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex gap-6 mt-6 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-cyan-500 rounded"></div>
                  <span>On-beat hit</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-purple-500 rounded"></div>
                  <span>Syncopated (offbeat)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-pink-500 rounded"></div>
                  <span>16th subdivision</span>
                </div>
              </div>
            </div>

            {/* Pattern Analysis */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">📊 Syncopation Analysis</h3>
              
              {genre.syncopation.map((pattern, idx) => {
                const hits = pattern.pattern.filter(x => x === 1).length;
                const offbeats = pattern.pattern.filter((x, i) => x === 1 && i % 2 === 1).length;
                const density = (offbeats / hits * 100).toFixed(0);
                
                return (
                  <div key={idx} className="mb-4 p-3 bg-gray-900 rounded-lg">
                    <div className="font-medium text-sm">{pattern.name}</div>
                    <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                      <div>
                        <span className="text-gray-400">Total hits:</span> {hits}
                      </div>
                      <div>
                        <span className="text-gray-400">Offbeats:</span> {offbeats}
                      </div>
                      <div>
                        <span className="text-gray-400">Sync %:</span> {density}%
                      </div>
                    </div>
                    <div className="mt-2 h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500"
                        style={{ width: `${density}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Tips */}
            <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
              <h3 className="text-lg font-semibold mb-4">💡 Production Tips</h3>
              
              <div className="space-y-3 text-sm">
                <div className="p-3 bg-blue-900/30 rounded-lg">
                  <strong>Velocity Variation:</strong> Apply -10 to -20 velocity on offbeats for natural groove
                </div>
                <div className="p-3 bg-green-900/30 rounded-lg">
                  <strong>Swing Amount:</strong> Try 54-58% swing for {genre.name} feel
                </div>
                <div className="p-3 bg-purple-900/30 rounded-lg">
                  <strong>Ghost Notes:</strong> Add quiet hits at {genre.bpm.typical} BPM for extra groove
                </div>
                <div className="p-3 bg-orange-900/30 rounded-lg">
                  <strong>Pre-delay Claps:</strong> Shift claps 15-25ms before the beat
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 text-center text-gray-500 text-xs">
          Calculations based on Sabine/Eyring formulas • ISO 3382 standards • Professional production techniques
        </div>
      </div>
    </div>
  );
}
