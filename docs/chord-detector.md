# Chord Detector

Real-time chord detection with interactive piano visualization and voicing analysis.

**Note:** ChordDetector and RhythmGrid are now **separate components** rendered independently in App.js. ChordDetector handles harmonic analysis (chords, keys, voicings), while RhythmGrid handles rhythmic analysis (drums, tempo, patterns).

## Features
- Interactive piano keyboard with multiple instrument sounds
- Click piano keys to play notes (Web Audio API)
- Time signature support: 4/4, 3/4, 6/8
- Bar grid visualization showing chord progression
- Color-coded chords by root note
- Chord legend showing unique chords detected
- Recent changes display
- Real-time chromagram analysis during playback
- **Circle of Fifths** visualization with related chord highlighting
- **PDF Export** with full color progression

---

## Piano Voicing System

### Voicing Types
- Root Position
- 1st Inversion
- 2nd Inversion
- 3rd Inversion
- Shell Voicing
- Open Voicing

### Color-Coded Chord Tones
- Bass (green)
- Root (red)
- 3rd (orange)
- 5th (blue)
- 7th (purple)

Correct octave placement for all voicing types with visual voicing legend showing chord tone positions.

---

## Multiple Instrument Sounds

### Piano
6-harmonic synthesis with ADSR envelope and detuning

### Synth Bass
Sawtooth wave with lowpass filter + sub-octave

### Synth Pad
Detuned oscillators with slow attack for ambient sound

Selectable instruments for bass and chord voices.

---

## Auto-Play & Detection

- **Auto-play chords**: Automatically plays voicing when chord is detected
- **Voicing detection from audio**: Analyzes octave-aware chromagram to detect actual inversion
- Real-time detection of which octave each chord tone is sounding in
- Confidence display showing detection accuracy
- Automatic voicing type switching based on detected bass note

---

## Circle of Fifths

SVG visualization of all 12 major keys (outer ring) and minor keys (inner ring):
- Active chord highlighted in red (major) or purple (minor)
- Related chords (IV, V, vi) shown with blue border
- Current chord symbol displayed in center

---

## Dual Circle Visualization

Two Circle of Fifths displayed side by side for simultaneous harmonic and rhythmic analysis:

### Left Circle - HARMONIC (red border)
- Shows detected chords on the Circle of Fifths
- Major keys on outer ring, minor keys on inner ring
- Active chord highlighted with glow effect
- Related chords (IV, V, vi) shown with blue border
- Center displays current chord symbol

### Right Circle - RHYTHMIC (green border)
- Shows drum activity mapped to notes:
  - Kick = C (red)
  - Snare = G (blue)
  - Hi-Hat = D (green)
  - Clap = A (orange)
  - Tom = E (purple)
  - Perc = B (yellow)
- Active drums light up with glow effects
- Drum name appears below active note
- Center shows active drum names
- Notes without drum mapping are dimmed

Both circles work simultaneously - perfect for analyzing full mixes with both melodic and percussive content.

---

## PDF Export Features

- Color-coded bar grid with chord symbols
- Nashville Number System notation (1, 2, 3, 4, 5, 6, 7)
- Musical notation symbols (Triangle7, dim, aug, m)
- Key, tempo, and time signature metadata
- Chord legend with colors and Nashville numbers
- Nashville Number System reference guide
- Landscape A4 format for easy printing
