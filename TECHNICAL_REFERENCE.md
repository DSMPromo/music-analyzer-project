# 🎛️ Advanced Audio Analysis - Technical Reference

## Complete Guide to Reverb Mathematics, Room Acoustics & Genre Production

---

## 📐 Part 1: Reverb Mathematics

### 1.1 Sabine's Formula (RT60)

The fundamental equation for calculating reverberation time:

```
RT60 = 0.161 × V / A
```

Where:
- **RT60** = Reverberation time in seconds (time for sound to decay 60dB)
- **V** = Room volume in cubic meters (m³)
- **A** = Total absorption in Sabins (m² Sabin)
- **0.161** = Constant derived from speed of sound (for metric units)

#### Total Absorption Calculation:
```
A = Σ(Si × αi)

Where:
- Si = Surface area of material i (m²)
- αi = Absorption coefficient of material i (0-1)
```

### 1.2 Eyring's Formula (For Dead Rooms)

More accurate for rooms with high absorption (studios):

```
RT60 = 0.161 × V / (-S × ln(1 - ᾱ))
```

Where:
- **S** = Total surface area (m²)
- **ᾱ** = Average absorption coefficient
- **ln** = Natural logarithm

### 1.3 Absorption Coefficients Table

| Material | 125Hz | 250Hz | 500Hz | 1kHz | 2kHz | 4kHz |
|----------|-------|-------|-------|------|------|------|
| Concrete | 0.01 | 0.01 | 0.02 | 0.02 | 0.02 | 0.03 |
| Brick | 0.03 | 0.03 | 0.03 | 0.04 | 0.05 | 0.07 |
| Glass | 0.35 | 0.25 | 0.18 | 0.12 | 0.07 | 0.04 |
| Plasterboard | 0.29 | 0.10 | 0.06 | 0.05 | 0.04 | 0.04 |
| Wood Floor | 0.15 | 0.11 | 0.10 | 0.07 | 0.06 | 0.07 |
| Thick Carpet | 0.02 | 0.06 | 0.14 | 0.37 | 0.60 | 0.65 |
| Heavy Curtains | 0.07 | 0.31 | 0.49 | 0.75 | 0.70 | 0.60 |
| Acoustic Foam | 0.08 | 0.25 | 0.60 | 0.90 | 0.95 | 0.90 |
| Acoustic Panels | 0.10 | 0.40 | 0.80 | 0.95 | 0.90 | 0.85 |
| Bass Traps | 0.35 | 0.50 | 0.65 | 0.70 | 0.65 | 0.60 |
| Fiberglass | 0.12 | 0.28 | 0.55 | 0.75 | 0.80 | 0.85 |
| Rockwool | 0.15 | 0.35 | 0.65 | 0.85 | 0.90 | 0.85 |
| Seated Person | 0.25 | 0.35 | 0.42 | 0.46 | 0.50 | 0.50 |

### 1.4 Delay Time Calculations

#### First Reflection Delay:
```
Delay (ms) = (2 × Distance) / Speed of Sound × 1000

Speed of Sound ≈ 343 m/s at 20°C
```

#### Predelay Recommendation:
```
Predelay (ms) ≈ (L + W + H) / 3 × 2

Where L, W, H are room dimensions in meters
```

#### Haas Effect Zone:
- 0-10ms: Fuses with direct sound
- 10-30ms: Adds fullness without echo
- 30-50ms: Creates distinct echo

---

## 🏠 Part 2: Room Acoustics Analysis

### 2.1 Room Modes (Standing Waves)

Room modes occur at frequencies where sound waves perfectly reflect between parallel surfaces:

```
f(nx,ny,nz) = (c/2) × √[(nx/L)² + (ny/W)² + (nz/H)²]
```

Where:
- **c** = Speed of sound (343 m/s)
- **nx, ny, nz** = Mode numbers (0, 1, 2, 3...)
- **L, W, H** = Room dimensions

#### Mode Types:
| Type | Definition | Energy Level |
|------|------------|--------------|
| **Axial** | One dimension (e.g., 1,0,0) | Highest (most problematic) |
| **Tangential** | Two dimensions (e.g., 1,1,0) | Medium |
| **Oblique** | Three dimensions (e.g., 1,1,1) | Lowest |

### 2.2 Schroeder Frequency

The transition frequency between modal and statistical acoustic behavior:

```
fs = 2000 × √(RT60 / V)
```

- **Below fs**: Room modes dominate (requires bass trapping)
- **Above fs**: Statistical acoustics apply (absorption/diffusion)

### 2.3 Critical Distance

Distance where direct sound equals reverberant sound:

```
dc = 0.1 × √(A / π)

Or: dc = 0.057 × √(V / RT60)
```

### 2.4 Ideal RT60 by Room Type

| Room Type | Target RT60 | Notes |
|-----------|-------------|-------|
| Vocal Booth | 0.1 - 0.25s | Very dry |
| Control Room | 0.25 - 0.4s | Accurate monitoring |
| Bedroom Studio | 0.2 - 0.4s | Balanced |
| Live Room | 0.4 - 0.8s | Some ambience |
| Concert Hall | 1.5 - 2.5s | Rich reverb |
| Cathedral | 3 - 8s | Long decay |

### 2.5 Room Analysis via Spectrogram

#### What to Look For:
1. **Horizontal lines**: Resonant frequencies (room modes)
2. **Vertical smearing**: Excessive reverb
3. **Gaps**: Null points from comb filtering
4. **Decay slope**: Should be smooth and consistent

#### RT60 from Spectrogram (Schroeder Method):
1. Record impulse response (clap, balloon pop, or sweep)
2. Reverse integrate the squared signal
3. Fit linear regression to -5dB to -35dB range
4. Extrapolate to -60dB

```javascript
// Schroeder Integration Algorithm
function calculateRT60(impulseResponse, sampleRate) {
  // Square the signal
  const squared = impulseResponse.map(x => x * x);
  
  // Reverse cumulative sum
  const schroeder = [];
  let sum = 0;
  for (let i = squared.length - 1; i >= 0; i--) {
    sum += squared[i];
    schroeder.unshift(sum);
  }
  
  // Convert to dB
  const maxEnergy = Math.max(...schroeder);
  const dB = schroeder.map(e => 10 * Math.log10(e / maxEnergy));
  
  // Find T30 (extrapolate to T60)
  const start = dB.findIndex(d => d <= -5);
  const end = dB.findIndex(d => d <= -35);
  
  const t30 = (end - start) / sampleRate;
  return t30 * 2; // T60 = 2 × T30
}
```

---

## 🎵 Part 3: Genre-Specific Production

### 3.1 House Music

| Parameter | Value | Notes |
|-----------|-------|-------|
| **BPM** | 120-130 | Typical: 125 |
| **Kick Fundamental** | 50-60 Hz | Sub-heavy |
| **Kick Click** | 2-3 kHz | Attack transient |
| **Bass Range** | 40-200 Hz | Syncopated |
| **Reverb Time** | 1.0-1.5s | Moderate |
| **Target RT60** | 0.4s | Room treatment |

#### Drum Pattern (Four-on-Floor):
```
Kick:  [X . . . X . . . X . . . X . . .]
Clap:  [. . . . X . . . . . . . X . . .]
HH-C:  [X . X . X . X . X . X . X . X .]
HH-O:  [. . X . . . X . . . X . . . X .]
```

#### Syncopation Characteristics:
- Kick: Every beat (1, 5, 9, 13)
- Clap/Snare: Beats 2 & 4 (position 5, 13)
- Open Hi-hat: 8th note offbeats
- Closed Hi-hat: 16th notes
- Pre-shifted claps: -15 to -25ms before beat

### 3.2 Deep House

| Parameter | Value | Notes |
|-----------|-------|-------|
| **BPM** | 118-126 | Typical: 122 |
| **Kick Fundamental** | 55-65 Hz | Warmer |
| **Bass Range** | 45-180 Hz | Sub-focused |
| **Reverb Time** | 1.5-2.0s | Longer tails |
| **Swing** | 54-58% | Laid-back feel |
| **Target RT60** | 0.5s | Slightly more live |

#### Characteristics:
- TR-909 style drums
- Jazz/soul chord progressions (7ths, 9ths)
- Rimshot embellishments
- More organic, less quantized feel
- Sub-bass sitting below kick

### 3.3 Techno

| Parameter | Value | Notes |
|-----------|-------|-------|
| **BPM** | 130-150 | Typical: 138 |
| **Kick Fundamental** | 45-55 Hz | Punchy |
| **Kick Click** | 3-4 kHz | Sharp attack |
| **Reverb Time** | 2-3s | Industrial spaces |
| **Compression** | Heavy | -6 to -8dB threshold |
| **Target RT60** | 0.6s | Room for FX |

#### Drum Pattern (Driving):
```
Kick:  [X . . . X . . . X . . . X . . .]
HH:    [X X X X X X X X X X X X X X X X]
Snare: [. . . . X . . . . . . . X . . .]
```

### 3.4 Drum & Bass

| Parameter | Value | Notes |
|-----------|-------|-------|
| **BPM** | 160-180 | Typical: 174 |
| **Kick Fundamental** | 60-80 Hz | Tight |
| **Sub-Bass** | 30-60 Hz | Reese bass |
| **Reverb Time** | 0.5-1.0s | Short, tight |
| **Compression** | Very heavy | Fast attack |
| **Target RT60** | 0.3s | Dry room |

#### Two-Step Pattern:
```
Kick:  [X . . . . . X . . . X . . . . .]
Snare: [. . . . X . . . . . . . X . . .]
HH:    [X . X . X . X . X . X . X . X .]
```

### 3.5 Hip-Hop

| Parameter | Value | Notes |
|-----------|-------|-------|
| **BPM** | 80-115 | Typical: 95 |
| **808 Kick** | 40-60 Hz | Sustained |
| **Bass** | 40-150 Hz | 808 sub |
| **Reverb Time** | 0.8-1.2s | Moderate |
| **Swing** | Heavy | Boom-bap groove |
| **Target RT60** | 0.35s | Controlled |

#### Boom-Bap Pattern:
```
Kick:  [X . . . . . . . X . . X . . . .]
Snare: [. . . . X . . . . . . . X . . .]
HH:    [X . X . X . X . X . X . X . X .]
```

---

## 📊 Part 4: Analysis Techniques

### 4.1 Spectrogram Analysis for Voice Recording

#### Ideal Vocal Booth Spectrogram:
- Clean, defined fundamental frequency (100-300 Hz for male, 200-500 Hz for female)
- Clear harmonic series without room coloration
- No visible room modes (horizontal lines)
- Fast decay (minimal reverb tail)

#### Common Issues:
| Issue | Spectrogram Sign | Solution |
|-------|------------------|----------|
| Box coloration | Low-mid buildup | Add bass traps |
| Flutter echo | Repeating pattern | Add diffusion |
| Comb filtering | Regular notches | Move mic position |
| Room modes | Strong horizontal lines | EQ notches, bass traps |

### 4.2 Live Instrument Recording

#### Piano Recording Room Characteristics:
- RT60: 0.6-1.0s (some natural reverb)
- First reflection: >15ms delay
- Bass trap corners to control 80-150 Hz buildup

#### Acoustic Guitar:
- Closer mic placement reduces room influence
- Target RT60: 0.3-0.5s
- Watch for 100-200 Hz buildup

#### Drums:
- Live room RT60: 0.4-0.8s for rock
- Tighter RT60: 0.2-0.4s for funk/jazz
- Overhead placement affects room pickup

### 4.3 Calculating Delay from Vocals Using Spectrogram

```javascript
// Detect reverb characteristics from vocal recording
function analyzeVocalReverb(spectrogram, sampleRate) {
  const analysis = {
    estimatedRT60: 0,
    predelay: 0,
    earlyReflections: [],
    problematicFrequencies: []
  };
  
  // Find fundamental frequency band
  const fundamentalBand = findFundamental(spectrogram);
  
  // Analyze decay in fundamental band
  const decayCurve = extractDecay(spectrogram, fundamentalBand);
  analysis.estimatedRT60 = calculateRT60(decayCurve, sampleRate);
  
  // Detect early reflections (spikes after direct sound)
  analysis.earlyReflections = findReflectionPeaks(decayCurve);
  
  // Find modal buildup
  analysis.problematicFrequencies = findModes(spectrogram);
  
  return analysis;
}
```

---

## 🔧 Part 5: Practical Implementation

### 5.1 JavaScript Implementation: Room Analyzer

```javascript
class RoomAnalyzer {
  constructor(length, width, height) {
    this.L = length;
    this.W = width;
    this.H = height;
    this.c = 343; // Speed of sound
  }
  
  // Calculate volume
  get volume() {
    return this.L * this.W * this.H;
  }
  
  // Calculate surface area
  get surfaceArea() {
    return 2 * (this.L * this.W + this.L * this.H + this.W * this.H);
  }
  
  // Sabine RT60
  calculateRT60Sabine(absorption) {
    return 0.161 * this.volume / absorption;
  }
  
  // Eyring RT60
  calculateRT60Eyring(avgAlpha) {
    if (avgAlpha >= 1) return 0;
    return 0.161 * this.volume / 
           (-this.surfaceArea * Math.log(1 - avgAlpha));
  }
  
  // Room modes
  calculateModes(maxFreq = 300) {
    const modes = [];
    
    for (let nx = 0; nx <= 4; nx++) {
      for (let ny = 0; ny <= 4; ny++) {
        for (let nz = 0; nz <= 4; nz++) {
          if (nx === 0 && ny === 0 && nz === 0) continue;
          
          const f = (this.c / 2) * Math.sqrt(
            Math.pow(nx / this.L, 2) +
            Math.pow(ny / this.W, 2) +
            Math.pow(nz / this.H, 2)
          );
          
          if (f <= maxFreq) {
            modes.push({
              frequency: Math.round(f * 10) / 10,
              type: this.getModeType(nx, ny, nz),
              indices: [nx, ny, nz]
            });
          }
        }
      }
    }
    
    return modes.sort((a, b) => a.frequency - b.frequency);
  }
  
  getModeType(nx, ny, nz) {
    const nonZero = [nx, ny, nz].filter(n => n > 0).length;
    return nonZero === 1 ? 'Axial' : 
           nonZero === 2 ? 'Tangential' : 'Oblique';
  }
  
  // Schroeder frequency
  schroederFrequency(rt60) {
    return 2000 * Math.sqrt(rt60 / this.volume);
  }
  
  // First reflection delays
  firstReflections() {
    return {
      frontBack: (2 * this.L / this.c) * 1000,
      leftRight: (2 * this.W / this.c) * 1000,
      floorCeiling: (2 * this.H / this.c) * 1000
    };
  }
}
```

### 5.2 Web Audio API: Real-time Analysis

```javascript
class SpectrumAnalyzer {
  constructor() {
    this.audioContext = new AudioContext();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 4096;
    this.analyser.smoothingTimeConstant = 0.8;
  }
  
  async connectMicrophone() {
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      } 
    });
    
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);
    
    return source;
  }
  
  getFrequencyData() {
    const data = new Float32Array(this.analyser.frequencyBinCount);
    this.analyser.getFloatFrequencyData(data);
    return data;
  }
  
  // Convert to chromagram for chord detection
  getChromagram() {
    const freqData = this.getFrequencyData();
    const chromagram = new Array(12).fill(0);
    const binFreq = this.audioContext.sampleRate / this.analyser.fftSize;
    
    for (let i = 0; i < freqData.length; i++) {
      const freq = i * binFreq;
      if (freq < 60 || freq > 5000) continue;
      
      const midi = 12 * Math.log2(freq / 440) + 69;
      const pitchClass = Math.round(midi) % 12;
      
      if (pitchClass >= 0 && pitchClass < 12) {
        chromagram[pitchClass] += Math.pow(10, freqData[i] / 20);
      }
    }
    
    // Normalize
    const max = Math.max(...chromagram);
    return chromagram.map(v => max > 0 ? v / max : 0);
  }
  
  // Analyze reverb from recorded impulse
  analyzeReverb(audioBuffer) {
    const data = audioBuffer.getChannelData(0);
    
    // Schroeder integration
    const energyCurve = [];
    let cumulative = 0;
    
    for (let i = data.length - 1; i >= 0; i--) {
      cumulative += data[i] * data[i];
      energyCurve.unshift(cumulative);
    }
    
    // Convert to dB
    const maxE = Math.max(...energyCurve);
    const dB = energyCurve.map(e => 10 * Math.log10(e / maxE));
    
    // Find T60
    const start5dB = dB.findIndex(d => d <= -5);
    const end35dB = dB.findIndex(d => d <= -35);
    
    if (start5dB >= 0 && end35dB > start5dB) {
      const t30 = (end35dB - start5dB) / audioBuffer.sampleRate;
      return {
        rt60: t30 * 2,
        edt: start5dB / audioBuffer.sampleRate * 6,
        t30: t30
      };
    }
    
    return null;
  }
}
```

---

## 📚 References

### Standards:
- ISO 3382-1:2009 - Measurement of room acoustic parameters (Performance spaces)
- ISO 3382-2:2008 - Reverberation time in ordinary rooms
- IEC 61260-1:2014 - Octave-band and fractional-octave-band filters

### Key Research Papers:
- Sabine, W.C. (1922). "Collected Papers on Acoustics"
- Schroeder, M.R. (1965). "New Method of Measuring Reverberation Time"
- Eyring, C.F. (1930). "Reverberation Time in Dead Rooms"

### Tools & Software:
- Room EQ Wizard (REW) - Free room acoustics measurement
- Pyroomacoustics - Python library for room simulation
- AudioMotion Analyzer - Real-time spectrum visualization

---

*This document is part of the Advanced Music Analyzer project by DSM.Promo*
