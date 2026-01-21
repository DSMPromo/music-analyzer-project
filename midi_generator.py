#!/usr/bin/env python3
"""
MIDI Generator using Spotify's Basic Pitch
------------------------------------------
Converts audio files to MIDI with pitch bend detection.

Usage:
    python midi_generator.py <input_audio> <output_midi> [options_json]

Example:
    python midi_generator.py song.wav output.mid '{"onset_threshold": 0.5}'

Dependencies:
    pip install basic-pitch --break-system-packages
"""

import sys
import json
import os
from pathlib import Path

def generate_midi(audio_path: str, output_path: str, options: dict = None) -> dict:
    """
    Generate MIDI from audio using Spotify's Basic Pitch
    
    Args:
        audio_path: Path to input audio file
        output_path: Path for output MIDI file
        options: Dictionary of transcription options
            - onset_threshold: 0.5 (default) - Note onset detection threshold
            - frame_threshold: 0.3 (default) - Frame activation threshold  
            - min_note_len: 58 (default) - Minimum note length in ms
            - min_freq: None - Minimum frequency to detect (Hz)
            - max_freq: None - Maximum frequency to detect (Hz)
    
    Returns:
        Dictionary with note count and note events
    """
    
    # Lazy import for faster startup if checking args
    from basic_pitch.inference import predict
    from basic_pitch import ICASSP_2022_MODEL_PATH
    
    if options is None:
        options = {}
    
    # Validate input file
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")
    
    # Set default options
    onset_threshold = options.get('onset_threshold', 0.5)
    frame_threshold = options.get('frame_threshold', 0.3)
    min_note_len = options.get('min_note_len', 58)
    min_freq = options.get('min_freq')
    max_freq = options.get('max_freq')
    
    print(f"Processing: {audio_path}", file=sys.stderr)
    print(f"Options: onset={onset_threshold}, frame={frame_threshold}, min_len={min_note_len}ms", file=sys.stderr)
    
    # Run Basic Pitch prediction
    model_output, midi_data, note_events = predict(
        audio_path,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=min_note_len,
        minimum_frequency=min_freq,
        maximum_frequency=max_freq,
        melodia_trick=True
    )
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    # Save MIDI file
    midi_data.write(output_path)
    print(f"MIDI saved to: {output_path}", file=sys.stderr)
    
    # Format note events for JSON output
    events = []
    for event in note_events:
        note_dict = {
            'start': float(event[0]),
            'end': float(event[1]),
            'pitch': int(event[2]),
            'velocity': int(event[3] * 127),
        }
        # Include pitch bend if present
        if len(event) > 4 and event[4] is not None:
            note_dict['bend'] = [float(b) for b in event[4]]
        events.append(note_dict)
    
    return {
        'success': True,
        'notes': len(note_events),
        'duration': float(max(e[1] for e in note_events)) if note_events else 0,
        'output_path': output_path,
        'events': events[:100]  # Limit to first 100 events for response
    }


def analyze_midi_stats(events: list) -> dict:
    """
    Analyze MIDI events to extract musical statistics
    """
    if not events:
        return {}
    
    pitches = [e['pitch'] for e in events]
    durations = [e['end'] - e['start'] for e in events]
    velocities = [e['velocity'] for e in events]
    
    # Note names
    note_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    
    # Pitch class distribution
    pitch_classes = [0] * 12
    for p in pitches:
        pitch_classes[p % 12] += 1
    
    # Find most common pitch class (likely tonic)
    max_pc = max(range(12), key=lambda i: pitch_classes[i])
    
    return {
        'pitch_range': {
            'min': min(pitches),
            'max': max(pitches),
            'min_note': f"{note_names[min(pitches) % 12]}{min(pitches) // 12 - 1}",
            'max_note': f"{note_names[max(pitches) % 12]}{max(pitches) // 12 - 1}"
        },
        'duration_stats': {
            'min_ms': round(min(durations) * 1000, 2),
            'max_ms': round(max(durations) * 1000, 2),
            'avg_ms': round(sum(durations) / len(durations) * 1000, 2)
        },
        'velocity_stats': {
            'min': min(velocities),
            'max': max(velocities),
            'avg': round(sum(velocities) / len(velocities))
        },
        'pitch_class_distribution': {
            note_names[i]: pitch_classes[i] for i in range(12)
        },
        'likely_key': note_names[max_pc]
    }


def batch_process(input_dir: str, output_dir: str, options: dict = None) -> list:
    """
    Process multiple audio files in a directory
    """
    results = []
    supported_formats = ['.wav', '.mp3', '.flac', '.m4a', '.ogg']
    
    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    for audio_file in input_path.iterdir():
        if audio_file.suffix.lower() in supported_formats:
            try:
                midi_file = output_path / f"{audio_file.stem}.mid"
                result = generate_midi(str(audio_file), str(midi_file), options)
                results.append({
                    'input': str(audio_file),
                    'output': str(midi_file),
                    'success': True,
                    'notes': result['notes']
                })
            except Exception as e:
                results.append({
                    'input': str(audio_file),
                    'success': False,
                    'error': str(e)
                })
    
    return results


def main():
    """
    Command line interface
    """
    if len(sys.argv) < 3:
        print("Usage: python midi_generator.py <input_audio> <output_midi> [options_json]")
        print("\nExamples:")
        print('  python midi_generator.py song.wav output.mid')
        print('  python midi_generator.py song.mp3 output.mid \'{"onset_threshold": 0.6}\'')
        print("\nOptions (JSON format):")
        print("  onset_threshold: 0.0-1.0 (default: 0.5)")
        print("  frame_threshold: 0.0-1.0 (default: 0.3)")
        print("  min_note_len: milliseconds (default: 58)")
        print("  min_freq: Hz or null (default: null)")
        print("  max_freq: Hz or null (default: null)")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    
    # Parse options if provided
    options = {}
    if len(sys.argv) > 3:
        try:
            options = json.loads(sys.argv[3])
        except json.JSONDecodeError as e:
            print(f"Error parsing options JSON: {e}", file=sys.stderr)
            sys.exit(1)
    
    try:
        result = generate_midi(audio_path, output_path, options)
        
        # Add statistics
        if result['events']:
            result['stats'] = analyze_midi_stats(result['events'])
        
        # Output JSON result
        print(json.dumps(result, indent=2))
        
    except FileNotFoundError as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)


if __name__ == '__main__':
    main()
