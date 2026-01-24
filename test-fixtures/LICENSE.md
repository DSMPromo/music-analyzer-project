# Test Fixtures - Audio Files

## License Information

All audio files in this directory are either:
1. Generated programmatically using FFmpeg (synthetic audio)
2. Public domain / royalty-free samples

## File Descriptions

| File | Duration | Description | Source |
|------|----------|-------------|--------|
| `test-tone.mp3` | 5 sec | 440Hz sine wave (A4) | FFmpeg generated |
| `short-track.mp3` | 10 sec | Multi-frequency test tones | FFmpeg generated |
| `drum-loop.mp3` | 8 sec | Synthetic kick/snare pattern | FFmpeg generated |
| `piano-chords.mp3` | 10 sec | C-Am-F-G chord progression | FFmpeg generated |
| `silence.mp3` | 3 sec | Silent audio for edge case testing | FFmpeg generated |

## Generation Commands

These files are generated automatically by `scripts/generate-test-fixtures.sh`.

### Basic Test Tone (440Hz A4)
```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=5" -ar 44100 test-tone.mp3
```

### Multi-frequency Short Track
```bash
ffmpeg -f lavfi -i "sine=frequency=440:duration=2,sine=frequency=880:duration=2,sine=frequency=1320:duration=2" ...
```

### Drum Loop (Synthetic)
Uses low frequency bursts for kick (60Hz) and mid-frequency noise for snare simulation.

### Piano Chords (Synthetic)
Uses additive synthesis to create chord tones:
- C major: C4(261.63), E4(329.63), G4(392.00)
- A minor: A3(220.00), C4(261.63), E4(329.63)
- F major: F4(349.23), A4(440.00), C5(523.25)
- G major: G4(392.00), B4(493.88), D5(587.33)

## Usage

These files are used for automated E2E testing via Playwright MCP.
Do not commit large audio files - generate them locally using the script.

## Regenerating Fixtures

```bash
cd music-analyzer-project
./scripts/generate-test-fixtures.sh
```
