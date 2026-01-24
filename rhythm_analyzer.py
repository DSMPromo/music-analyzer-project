#!/usr/bin/env python3
"""
Rhythm Analyzer Service
Port: 56403

3-stage pipeline for accurate rhythm detection:
1. Beat/Downbeat detection using madmom CNN
2. Onset detection using madmom RNN
3. Drum hit classification using ML model (with rule-based fallback)

Usage:
    ./venv/bin/python rhythm_analyzer.py
"""

import os
import sys
import tempfile
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass
import uuid
import time

import numpy as np
import librosa
import soundfile as sf
from scipy import signal
import gc  # For explicit memory cleanup after large array operations
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import io
import base64
import json
import re
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import Google Generative AI
GEMINI_AVAILABLE = False
genai = None
try:
    import google.generativeai as genai
    GEMINI_AVAILABLE = True
    logger.info('Google Generative AI loaded')
except ImportError:
    logger.warning('google-generativeai not available, Gemini detection disabled')

# Service configuration
PORT = 56403
HOST = '0.0.0.0'
TEMP_DIR = Path(tempfile.gettempdir()) / 'music-analyzer-rhythm'
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Try to import madmom (optional, will use librosa fallback if not available)
MADMOM_AVAILABLE = False
try:
    import madmom
    from madmom.features.beats import RNNBeatProcessor, DBNBeatTrackingProcessor
    from madmom.features.downbeats import RNNDownBeatProcessor, DBNDownBeatTrackingProcessor
    from madmom.features.onsets import RNNOnsetProcessor
    MADMOM_AVAILABLE = True
    logger.info('madmom loaded successfully - using CNN-based detection')
except ImportError as e:
    logger.warning(f'madmom not available ({e}), using librosa fallback')

# Try to import sklearn for ML classification
SKLEARN_AVAILABLE = False
classifier = None
try:
    from sklearn.ensemble import RandomForestClassifier
    import joblib
    SKLEARN_AVAILABLE = True

    # Try to load pre-trained classifier
    CLASSIFIER_PATH = Path(__file__).parent / 'drum_classifier.pkl'
    if CLASSIFIER_PATH.exists():
        classifier = joblib.load(CLASSIFIER_PATH)
        logger.info('Loaded pre-trained drum classifier')
    else:
        logger.info('No pre-trained classifier found, will use rule-based classification')
except ImportError as e:
    logger.warning(f'sklearn not available ({e}), using rule-based classification')


# =============================================================================
# Pydantic Models
# =============================================================================

class BeatResult(BaseModel):
    """Result of beat/downbeat detection"""
    bpm: float
    bpm_confidence: float
    beats: List[float]  # Beat times in seconds
    downbeats: List[Dict[str, Any]]  # {time: float, beat_position: int}
    time_signature: int  # Beats per bar (3 or 4)


class DrumHit(BaseModel):
    """Single detected drum hit"""
    time: float  # Time in seconds
    type: str  # kick, snare, hihat, clap, tom, perc
    confidence: float  # 0-1
    features: Optional[Dict[str, float]] = None


class RhythmAnalysisResult(BaseModel):
    """Complete rhythm analysis result"""
    bpm: float
    bpm_confidence: float
    beats: List[float]
    downbeats: List[Dict[str, Any]]
    time_signature: int
    hits: List[DrumHit]
    swing: float  # 0-100, where 50 is straight
    analysis_method: str  # 'madmom' or 'librosa'
    duration: float
    analysis_source: str = 'full_mix'  # 'drums_stem' or 'full_mix'
    detected_genre: Optional[str] = None  # Detected genre from BPM/pattern
    genre_confidence: float = 0.0  # Confidence of genre detection
    # Pattern filter stats
    pattern_filter_applied: bool = False
    hits_before_filter: int = 0  # Count before filtering
    hits_after_filter: int = 0  # Count after filtering


class QuantizeRequest(BaseModel):
    """Request to quantize hits to grid"""
    hits: List[Dict[str, Any]]
    bpm: float
    downbeat_offset: float  # Time of first downbeat
    swing: float  # 0-100
    quantize_strength: float  # 0-1


class QuantizeInstrumentRequest(BaseModel):
    """Request to quantize a single instrument's hits"""
    drum_type: str
    hits: List[Dict[str, Any]]
    bpm: float
    downbeat_offset: float
    swing: float  # 0-100
    quantize_strength: float  # 0-1
    subdivision: int = 4  # 4 = 16th notes per beat


class QuantizeResult(BaseModel):
    """Result of quantization"""
    hits: List[DrumHit]
    grid_positions: List[Dict[str, Any]]  # {bar, beat, subbeat}


# =============================================================================
# Audio Feature Extraction
# =============================================================================

def load_audio(file_path: str) -> Tuple[np.ndarray, int]:
    """Load audio file and return mono waveform + sample rate"""
    try:
        y, sr = librosa.load(file_path, sr=44100, mono=True)
        return y, sr
    except Exception as e:
        logger.error(f'Failed to load audio: {e}')
        raise HTTPException(status_code=400, detail=f'Failed to load audio: {e}')


def extract_hit_features(y: np.ndarray, sr: int, onset_time: float,
                         window_ms: float = 80) -> Dict[str, float]:
    """
    Extract audio features around an onset for drum classification.

    Frequency bands aligned with Knowledge Lab (signalChains.js FREQUENCY_ALLOCATION):
    - sub_bass: 20-60Hz (kick sub, bass sub - MONO ONLY)
    - bass: 60-200Hz (kick body, bass body)
    - low_mids: 200-500Hz (MUD ZONE - should be minimal for clean drums)
    - mids: 500-2kHz (snare body, vocal presence)
    - high_mids: 2-6kHz (click/attack, brightness, presence)
    - highs: 6-20kHz (cymbals, hi-hats, air)

    Kick Processing from Knowledge Lab:
    - HPF: 30Hz (remove subsonic)
    - Sub thump: 50-60Hz
    - Mud cut: ~300Hz
    - Click/attack: 3-5kHz
    """
    # Window around onset - larger window for better low freq resolution
    window_samples = int(window_ms * sr / 1000)
    onset_sample = int(onset_time * sr)

    start = max(0, onset_sample - window_samples // 4)  # Small pre-onset window
    end = min(len(y), onset_sample + window_samples)

    if end - start < 256:
        return get_default_features()

    segment = y[start:end]

    # Compute spectrum with larger FFT for better low freq resolution
    n_fft = min(4096, max(2048, len(segment)))
    spectrum = np.abs(np.fft.rfft(segment * np.hanning(len(segment)), n=n_fft))
    freqs = np.fft.rfftfreq(n_fft, 1/sr)

    total_energy = np.sum(spectrum ** 2) + 1e-10

    # Frequency band energies - ALIGNED WITH KNOWLEDGE LAB
    # From signalChains.js FREQUENCY_ALLOCATION
    sub_bass_mask = (freqs >= 20) & (freqs < 60)    # Kick sub (Knowledge Lab: 20-60Hz)
    bass_mask = (freqs >= 60) & (freqs < 200)       # Kick body (Knowledge Lab: 60-200Hz)
    low_mask = (freqs >= 20) & (freqs < 200)        # Combined sub+bass for kick detection
    low_mid_mask = (freqs >= 200) & (freqs < 500)   # MUD ZONE (Knowledge Lab: 200-500Hz)
    mid_mask = (freqs >= 500) & (freqs < 2000)      # Snare body (Knowledge Lab: 500-2kHz)
    high_mid_mask = (freqs >= 2000) & (freqs < 6000) # Click/attack (Knowledge Lab: 2-6kHz)
    high_mask = (freqs >= 6000) & (freqs < 20000)   # Cymbals/hihat (Knowledge Lab: 6-20kHz)
    hihat_mask = (freqs >= 6000) & (freqs < 16000)  # Specific hi-hat range (tighter)

    # Combined ranges for broader detection
    all_high_mask = (freqs >= 2000) & (freqs < 20000)  # Everything above 2kHz

    sub_bass_energy = np.sum(spectrum[sub_bass_mask] ** 2) / total_energy
    bass_energy = np.sum(spectrum[bass_mask] ** 2) / total_energy
    low_energy = np.sum(spectrum[low_mask] ** 2) / total_energy
    low_mid_energy = np.sum(spectrum[low_mid_mask] ** 2) / total_energy
    mid_energy = np.sum(spectrum[mid_mask] ** 2) / total_energy
    high_mid_energy = np.sum(spectrum[high_mid_mask] ** 2) / total_energy
    high_energy = np.sum(spectrum[high_mask] ** 2) / total_energy
    hihat_energy = np.sum(spectrum[hihat_mask] ** 2) / total_energy
    all_high_energy = np.sum(spectrum[all_high_mask] ** 2) / total_energy

    # Spectral centroid (normalized to 0-1 range)
    if np.sum(spectrum) > 0:
        centroid = np.sum(freqs * spectrum) / np.sum(spectrum)
        centroid_normalized = min(centroid / 10000, 1.0)
    else:
        centroid_normalized = 0.5

    # Spectral flatness (geometric mean / arithmetic mean)
    spectrum_positive = spectrum[spectrum > 0]
    if len(spectrum_positive) > 0:
        geometric_mean = np.exp(np.mean(np.log(spectrum_positive + 1e-10)))
        arithmetic_mean = np.mean(spectrum_positive)
        flatness = geometric_mean / (arithmetic_mean + 1e-10)
    else:
        flatness = 0.0

    # Zero crossing rate
    zcr = np.sum(np.abs(np.diff(np.signbit(segment)))) / len(segment)

    # Transient characteristics
    envelope = np.abs(segment)
    peak_idx = np.argmax(envelope)
    peak_val = envelope[peak_idx]

    # Attack time (time from 10% to 90% of peak)
    if peak_val > 0:
        threshold_10 = 0.1 * peak_val
        threshold_90 = 0.9 * peak_val

        attack_start = 0
        for i in range(peak_idx):
            if envelope[i] >= threshold_10:
                attack_start = i
                break

        attack_end = peak_idx
        for i in range(attack_start, peak_idx):
            if envelope[i] >= threshold_90:
                attack_end = i
                break

        transient_width = (attack_end - attack_start) * 1000 / sr  # in ms
    else:
        transient_width = 5.0

    # Decay time (time from peak to 10% of peak)
    if peak_val > 0 and peak_idx < len(envelope) - 1:
        decay_threshold = 0.1 * peak_val
        decay_end = len(envelope) - 1
        for i in range(peak_idx, len(envelope)):
            if envelope[i] <= decay_threshold:
                decay_end = i
                break
        decay_time = (decay_end - peak_idx) * 1000 / sr  # in ms
    else:
        decay_time = 30.0

    return {
        # Knowledge Lab frequency bands
        'low_energy_ratio': float(low_energy),       # 20-200Hz (kick detection)
        'sub_bass_ratio': float(sub_bass_energy),    # 20-60Hz (sub kick/808)
        'bass_ratio': float(bass_energy),            # 60-200Hz (kick body)
        'low_mid_ratio': float(low_mid_energy),      # 200-500Hz (mud zone)
        'mid_energy_ratio': float(mid_energy),       # 500-2kHz (snare body)
        'high_mid_ratio': float(high_mid_energy),    # 2-6kHz (click/attack)
        'high_energy_ratio': float(high_energy),     # 6-20kHz (cymbals)
        'hihat_band_ratio': float(hihat_energy),     # 6-16kHz (hi-hat specific)
        'all_high_ratio': float(all_high_energy),    # 2-20kHz (all highs combined)
        # Transient characteristics
        'transient_width': float(transient_width),
        'decay_time': float(decay_time),
        # Spectral characteristics
        'spectral_centroid': float(centroid_normalized),
        'spectral_flatness': float(flatness),
        'zero_crossing_rate': float(zcr)
    }


def get_default_features() -> Dict[str, float]:
    """Return default features when extraction fails"""
    return {
        # Knowledge Lab frequency bands
        'low_energy_ratio': 0.25,        # 20-200Hz
        'sub_bass_ratio': 0.08,          # 20-60Hz
        'bass_ratio': 0.17,              # 60-200Hz
        'low_mid_ratio': 0.15,           # 200-500Hz (mud zone)
        'mid_energy_ratio': 0.25,        # 500-2kHz
        'high_mid_ratio': 0.15,          # 2-6kHz
        'high_energy_ratio': 0.20,       # 6-20kHz
        'hihat_band_ratio': 0.10,        # 6-16kHz
        'all_high_ratio': 0.35,          # 2-20kHz
        # Transient characteristics
        'transient_width': 5.0,
        'decay_time': 30.0,
        # Spectral characteristics
        'spectral_centroid': 0.5,
        'spectral_flatness': 0.5,
        'zero_crossing_rate': 0.1
    }


# =============================================================================
# Beat and Downbeat Detection
# =============================================================================

def detect_beats_madmom(audio_path: str) -> BeatResult:
    """Use madmom CNN for accurate beat/downbeat detection"""
    if not MADMOM_AVAILABLE:
        raise RuntimeError('madmom not available')

    logger.info('Running madmom beat detection...')

    # Beat tracking
    beat_proc = RNNBeatProcessor()
    beat_act = beat_proc(audio_path)
    beat_tracker = DBNBeatTrackingProcessor(fps=100, min_bpm=50, max_bpm=220)
    beats = beat_tracker(beat_act)

    if len(beats) < 2:
        raise ValueError('Not enough beats detected')

    # Calculate BPM from beat intervals
    beat_intervals = np.diff(beats)
    median_interval = np.median(beat_intervals)
    bpm = 60.0 / median_interval

    # BPM confidence from interval consistency
    interval_std = np.std(beat_intervals)
    bpm_confidence = max(0, 1 - (interval_std / median_interval))

    # Downbeat tracking
    try:
        downbeat_proc = RNNDownBeatProcessor()
        downbeat_act = downbeat_proc(audio_path)
        downbeat_tracker = DBNDownBeatTrackingProcessor(
            beats_per_bar=[4, 3],
            fps=100
        )
        downbeat_results = downbeat_tracker(downbeat_act)

        # downbeat_results is array of (time, beat_position)
        downbeats = [
            {'time': float(row[0]), 'beat_position': int(row[1])}
            for row in downbeat_results
        ]

        # Determine time signature from beat positions
        beat_positions = [d['beat_position'] for d in downbeats]
        max_beat = max(beat_positions) if beat_positions else 4
        time_signature = max_beat

    except Exception as e:
        logger.warning(f'Downbeat detection failed: {e}, using beat-based estimation')
        # Fall back to assuming 4/4
        downbeats = [
            {'time': float(beats[i]), 'beat_position': (i % 4) + 1}
            for i in range(len(beats))
        ]
        time_signature = 4

    return BeatResult(
        bpm=float(bpm),
        bpm_confidence=float(bpm_confidence),
        beats=[float(b) for b in beats],
        downbeats=downbeats,
        time_signature=time_signature
    )


def detect_beats_librosa(y: np.ndarray, sr: int) -> BeatResult:
    """Fallback beat detection using librosa"""
    logger.info('Running librosa beat detection (fallback)...')

    # Get tempo and beat frames
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beats = librosa.frames_to_time(beat_frames, sr=sr)

    # Handle tempo as array or scalar
    if isinstance(tempo, np.ndarray):
        bpm = float(tempo[0]) if len(tempo) > 0 else 120.0
    else:
        bpm = float(tempo)

    if len(beats) < 2:
        # Generate synthetic beats if detection fails
        duration = len(y) / sr
        beat_interval = 60.0 / bpm
        beats = np.arange(0, duration, beat_interval)

    # Estimate confidence from onset strength consistency
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    beat_strengths = onset_env[beat_frames] if len(beat_frames) > 0 else np.array([1.0])
    bpm_confidence = float(np.mean(beat_strengths) / (np.max(onset_env) + 1e-10))

    # Assume 4/4 for librosa fallback
    downbeats = [
        {'time': float(beats[i]), 'beat_position': (i % 4) + 1}
        for i in range(len(beats))
    ]

    return BeatResult(
        bpm=bpm,
        bpm_confidence=min(bpm_confidence, 1.0),
        beats=[float(b) for b in beats],
        downbeats=downbeats,
        time_signature=4
    )


def detect_beats(audio_path: str, y: np.ndarray, sr: int) -> Tuple[BeatResult, str]:
    """Detect beats using best available method"""
    method = 'librosa'

    if MADMOM_AVAILABLE:
        try:
            result = detect_beats_madmom(audio_path)
            method = 'madmom'
            return result, method
        except Exception as e:
            logger.warning(f'madmom beat detection failed: {e}, falling back to librosa')

    result = detect_beats_librosa(y, sr)

    # Apply spectral-based half-time correction
    result = correct_half_time_spectral(y, sr, result)

    return result, method


def correct_half_time_spectral(y: np.ndarray, sr: int, beat_result: BeatResult) -> BeatResult:
    """
    Use spectral analysis to detect and correct half-time BPM.

    Analyzes hi-hat frequency band transient density - if there are
    significantly more transients than expected for the detected BPM,
    the tempo is likely half-time and should be doubled.

    Also triggers on: low BPM (<95) + low confidence (<50%) - common half-time pattern.
    """
    detected_bpm = beat_result.bpm
    confidence = beat_result.bpm_confidence

    # Skip if already fast enough or very confident
    if detected_bpm >= 100 or confidence > 0.7:
        logger.info(f'Spectral half-time check: BPM {detected_bpm:.1f} @ {confidence:.0%} confidence - no correction needed')
        return beat_result

    # HEURISTIC 1: Low BPM + Low confidence = likely half-time
    # This is very common for synth-pop, EDM, and modern pop
    if detected_bpm < 95 and confidence < 0.5:
        corrected_bpm = detected_bpm * 2
        logger.info(f'HALF-TIME DETECTED via low-confidence heuristic: {detected_bpm:.1f} BPM @ {confidence:.0%} -> {corrected_bpm:.1f} BPM')

        # Interpolate beats
        old_beats = beat_result.beats
        new_beats = []
        for i in range(len(old_beats) - 1):
            new_beats.append(old_beats[i])
            new_beats.append((old_beats[i] + old_beats[i + 1]) / 2)
        if old_beats:
            new_beats.append(old_beats[-1])

        new_downbeats = [
            {'time': float(new_beats[i]), 'beat_position': (i % 4) + 1}
            for i in range(len(new_beats))
        ]

        return BeatResult(
            bpm=corrected_bpm,
            bpm_confidence=min(confidence * 1.3, 0.7),
            beats=new_beats,
            downbeats=new_downbeats,
            time_signature=beat_result.time_signature
        )

    try:
        from scipy.signal import butter, sosfilt

        # Bandpass filter for hi-hat frequencies (5-15kHz)
        nyq = sr / 2
        low = min(5000 / nyq, 0.9)
        high = min(15000 / nyq, 0.99)

        if low >= high:
            return beat_result

        sos = butter(4, [low, high], btype='band', output='sos')
        y_hihat = sosfilt(sos, y)

        # Detect onsets in hi-hat band
        hihat_onsets = librosa.onset.onset_detect(
            y=y_hihat, sr=sr,
            backtrack=False,
            delta=0.1  # Lower threshold to catch more transients
        )
        hihat_times = librosa.frames_to_time(hihat_onsets, sr=sr)

        # Calculate expected vs actual transient density
        duration = len(y) / sr
        bar_duration = 60 / detected_bpm * 4  # 4 beats per bar
        num_bars = duration / bar_duration

        # Typical hi-hat plays 8 times per bar (8th notes)
        expected_transients_per_bar = 8
        expected_total = num_bars * expected_transients_per_bar
        actual_total = len(hihat_times)

        density_ratio = actual_total / (expected_total + 1)

        logger.info(f'Spectral half-time check: detected {actual_total} hi-hat transients, expected {expected_total:.0f} (ratio: {density_ratio:.2f})')

        # If we detect 1.5x or more transients than expected, it's likely half-time
        if density_ratio > 1.5:
            corrected_bpm = detected_bpm * 2
            logger.info(f'HALF-TIME DETECTED via spectral analysis: {detected_bpm:.1f} -> {corrected_bpm:.1f} BPM')

            # Interpolate beats
            old_beats = beat_result.beats
            new_beats = []
            for i in range(len(old_beats) - 1):
                new_beats.append(old_beats[i])
                new_beats.append((old_beats[i] + old_beats[i + 1]) / 2)  # midpoint
            if old_beats:
                new_beats.append(old_beats[-1])

            # Update downbeats
            new_downbeats = [
                {'time': float(new_beats[i]), 'beat_position': (i % 4) + 1}
                for i in range(len(new_beats))
            ]

            return BeatResult(
                bpm=corrected_bpm,
                bpm_confidence=min(confidence * 1.2, 0.85),  # Boost confidence slightly
                beats=new_beats,
                downbeats=new_downbeats,
                time_signature=beat_result.time_signature
            )

        return beat_result

    except Exception as e:
        logger.warning(f'Spectral half-time correction failed: {e}')
        return beat_result


# =============================================================================
# Onset Detection
# =============================================================================

def detect_onsets_madmom(audio_path: str) -> np.ndarray:
    """Use madmom RNN for onset detection"""
    if not MADMOM_AVAILABLE:
        raise RuntimeError('madmom not available')

    logger.info('Running madmom onset detection...')

    onset_proc = RNNOnsetProcessor()
    onset_act = onset_proc(audio_path)

    # Peak picking on activation function
    from madmom.features.onsets import peak_picking
    onsets = peak_picking(onset_act, threshold=0.3, fps=100)

    # Convert frame indices to time
    onset_times = onsets / 100.0  # fps=100

    return onset_times


def detect_onsets_librosa(y: np.ndarray, sr: int) -> np.ndarray:
    """Fallback onset detection using librosa with gentle filtering"""
    logger.info('Running librosa onset detection (fallback)...')

    # Get onset strength envelope
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)

    # Detect onsets with lower threshold for better sensitivity
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr,
        onset_envelope=onset_env,
        backtrack=True,
        units='frames',
        delta=0.05,  # Lower delta for more sensitivity
        wait=2       # Minimum frames between onsets (about 46ms at 22050 sr)
    )

    # Very gentle filtering - only remove the weakest 10%
    if len(onset_frames) > 10:
        onset_strengths = onset_env[onset_frames]
        # Keep onsets above 10% of max strength (very permissive)
        threshold = 0.1 * np.max(onset_strengths)
        strong_mask = onset_strengths >= threshold
        onset_frames = onset_frames[strong_mask]

    onset_times = librosa.frames_to_time(onset_frames, sr=sr)

    logger.info(f'Detected {len(onset_times)} onsets (from {len(y)/sr:.1f}s audio)')
    return onset_times


def apply_hpss_preprocessing(y: np.ndarray, sr: int) -> np.ndarray:
    """
    Apply Harmonic/Percussive Source Separation to isolate drums.

    This dramatically improves drum detection by removing:
    - Bass lines (harmonic)
    - Synth pads (harmonic)
    - Vocals (harmonic)
    - Melodic elements (harmonic)

    Leaving only:
    - Drums (percussive)
    - Transients (percussive)
    """
    logger.info('Applying HPSS preprocessing to isolate percussive content...')

    D = None
    H = None
    P = None

    try:
        # Compute STFT
        D = librosa.stft(y)

        # Separate harmonic and percussive components
        # margin parameter controls separation strength (higher = stricter)
        H, P = librosa.decompose.hpss(D, margin=3.0)

        # Convert percussive component back to audio
        y_percussive = librosa.istft(P, length=len(y))

        # Normalize
        max_val = np.max(np.abs(y_percussive))
        if max_val > 0:
            y_percussive = y_percussive / max_val

        logger.info(f'HPSS complete: percussive RMS = {np.sqrt(np.mean(y_percussive**2)):.4f}')
        return y_percussive

    except Exception as e:
        logger.warning(f'HPSS failed ({e}), using original audio')
        return y

    finally:
        # Explicit cleanup of large STFT matrices to prevent memory leaks
        # These can be 1-3GB for long audio files
        del D, H, P
        gc.collect()


def detect_drums_beat_aligned(y: np.ndarray, sr: int, beats: np.ndarray, time_signature: int = 4) -> Dict[str, List[float]]:
    """
    Beat-aligned drum detection - checks for drum energy AT beat positions.

    This is more reliable than free transcription because:
    1. We know WHERE to look (on the beat grid)
    2. We just check IF there's appropriate energy there
    3. HPSS preprocessing isolates drums from harmonic content

    Approach:
    - HPSS: First separate percussive from harmonic content
    - Kick: Check for low frequency energy on beats 1 & 3 (or all beats for EDM)
    - Snare: Check for mid+high frequency energy on beats 2 & 4
    - Hi-hat: Check for high frequency energy on all 8th notes
    """
    logger.info('Running beat-aligned drum detection...')

    # Apply HPSS to isolate percussive content
    y_perc = apply_hpss_preprocessing(y, sr)

    from scipy.signal import butter, sosfilt

    def bandpass_filter(data, lowcut, highcut, fs, order=4):
        nyq = 0.5 * fs
        low = max(lowcut / nyq, 0.01)
        high = min(highcut / nyq, 0.99)
        if low >= high:
            return data
        try:
            sos = butter(order, [low, high], btype='band', output='sos')
            return sosfilt(sos, data)
        except:
            return data

    def get_energy_at_time(audio, sample_rate, time_sec, window_ms=30):
        """Get RMS energy in a window around the given time"""
        center = int(time_sec * sample_rate)
        half_window = int(window_ms * sample_rate / 1000 / 2)
        start = max(0, center - half_window)
        end = min(len(audio), center + half_window)
        if end <= start:
            return 0.0
        segment = audio[start:end]
        return float(np.sqrt(np.mean(segment ** 2)))

    # Pre-filter PERCUSSIVE audio for each frequency band
    # Using y_perc (HPSS output) gives much cleaner drum detection
    y_low = bandpass_filter(y_perc, 20, 300, sr)      # Kick band (sub-bass to punch)
    y_mid = bandpass_filter(y_perc, 150, 2000, sr)    # Snare body
    y_high = bandpass_filter(y_perc, 5000, min(16000, sr/2-100), sr)  # Hi-hat/cymbal

    # Calculate energy thresholds from the full track
    # Use median as baseline, detect hits above threshold
    low_energies = [get_energy_at_time(y_low, sr, t) for t in beats]
    mid_energies = [get_energy_at_time(y_mid, sr, t) for t in beats]
    high_energies = [get_energy_at_time(y_high, sr, t) for t in beats]

    # Lower thresholds to catch more elements (was 1.5, 1.5, 1.2)
    low_threshold = np.median(low_energies) * 1.0 if low_energies else 0.01
    mid_threshold = np.median(mid_energies) * 1.0 if mid_energies else 0.01
    high_threshold = np.median(high_energies) * 0.8 if high_energies else 0.01

    logger.info(f'Energy thresholds - low: {low_threshold:.4f}, mid: {mid_threshold:.4f}, high: {high_threshold:.4f}')

    results = {'kick': [], 'snare': [], 'hihat': [], 'clap': [], 'tom': [], 'perc': []}

    # Calculate 8th note positions (between beats)
    eighth_notes = []
    for i in range(len(beats) - 1):
        eighth_notes.append(beats[i])
        eighth_notes.append((beats[i] + beats[i+1]) / 2)  # Halfway between beats
    if len(beats) > 0:
        eighth_notes.append(beats[-1])

    # Calculate 16th note positions (for trap 808s and rolling hats)
    sixteenth_notes = []
    for i in range(len(beats) - 1):
        beat_duration = beats[i+1] - beats[i]
        sixteenth_notes.append(beats[i])                           # 1
        sixteenth_notes.append(beats[i] + beat_duration * 0.25)    # 1e
        sixteenth_notes.append(beats[i] + beat_duration * 0.5)     # 1&
        sixteenth_notes.append(beats[i] + beat_duration * 0.75)    # 1a
    if len(beats) > 0:
        sixteenth_notes.append(beats[-1])

    # Collect all energies for adaptive thresholds (snare/clap detection)
    backbeat_indices = [i for i in range(len(beats)) if i % time_signature in [1, 3]]
    all_mid_energies = [get_energy_at_time(y_mid, sr, beats[i]) for i in backbeat_indices]
    all_high_at_backbeat = [get_energy_at_time(y_high, sr, beats[i]) for i in backbeat_indices]

    snare_threshold_adaptive = np.percentile(all_mid_energies, 40) if all_mid_energies else mid_threshold
    clap_threshold_adaptive = np.percentile(all_high_at_backbeat, 35) if all_high_at_backbeat else high_threshold

    # Process each beat for snares/claps (only on-beat)
    for i, beat_time in enumerate(beats):
        beat_in_bar = i % time_signature  # 0, 1, 2, 3 for 4/4

        mid_energy = get_energy_at_time(y_mid, sr, beat_time)
        high_energy = get_energy_at_time(y_high, sr, beat_time)
        low_energy = get_energy_at_time(y_low, sr, beat_time)

        # SNARE: Use adaptive threshold based on mid energy distribution
        # For trap/hip-hop with heavy 808s, we can't rely on mid > low comparison
        # because 808s dominate. Instead use percentile-based detection.
        if beat_in_bar in [1, 3]:
            # Primary condition: mid energy above adaptive threshold
            # This catches snares even when 808 is louder
            if mid_energy > snare_threshold_adaptive:
                results['snare'].append(beat_time)
            # Fallback: if mid energy is significant on its own (legacy condition)
            elif mid_energy > mid_threshold * 1.2 and mid_energy > low_energy * 0.3:
                results['snare'].append(beat_time)

        # CLAP: Use adaptive threshold - often layered WITH snare
        # In modern productions, clap and snare play together on beats 2 & 4
        if beat_in_bar in [1, 3]:
            # Clap needs significant high frequency content (adaptive threshold)
            if high_energy > clap_threshold_adaptive:
                results['clap'].append(beat_time)

    # KICK/808: Check on-beat positions with adaptive thresholds
    # Use percentile-based detection instead of fixed multipliers
    all_low_energies = [get_energy_at_time(y_low, sr, t) for t in sixteenth_notes]
    kick_threshold_adaptive = np.percentile(all_low_energies, 60) if all_low_energies else low_threshold

    for idx, sixteenth_time in enumerate(sixteenth_notes):
        low_energy = get_energy_at_time(y_low, sr, sixteenth_time)

        beat_idx = idx // 4
        sub_idx = idx % 4
        beat_in_bar = beat_idx % time_signature
        position_in_bar = beat_in_bar * 4 + sub_idx

        # Only check main beat positions (skip random 16th notes)
        # Beats 1 and 3 (positions 0, 8) - primary kick positions
        if position_in_bar in [0, 8]:
            if low_energy > kick_threshold_adaptive:
                results['kick'].append(sixteenth_time)
        # Beats 2 and 4 (positions 4, 12) - secondary
        elif position_in_bar in [4, 12]:
            if low_energy > kick_threshold_adaptive * 1.2:
                results['kick'].append(sixteenth_time)
        # Syncopated 8th notes (positions 2, 6, 10, 14)
        elif position_in_bar in [2, 6, 10, 14]:
            if low_energy > kick_threshold_adaptive * 1.1:
                results['kick'].append(sixteenth_time)

    # HI-HAT: Check 8th note positions with adaptive threshold
    all_high_energies = [get_energy_at_time(y_high, sr, t) for t in eighth_notes]
    hihat_threshold_adaptive = np.percentile(all_high_energies, 50) if all_high_energies else high_threshold

    for eighth_time in eighth_notes:
        high_energy = get_energy_at_time(y_high, sr, eighth_time)
        low_energy = get_energy_at_time(y_low, sr, eighth_time)

        # Hihat: high frequency must be present and dominate over low
        if high_energy > hihat_threshold_adaptive and high_energy > low_energy * 0.8:
            results['hihat'].append(eighth_time)

    # Remove duplicates and sort
    for drum_type in results:
        results[drum_type] = sorted(set(results[drum_type]))

    logger.info(f'Beat-aligned detection: kick={len(results["kick"])}, snare={len(results["snare"])}, '
                f'hihat={len(results["hihat"])}, clap={len(results["clap"])}')

    return results


def detect_onsets_per_drum(y: np.ndarray, sr: int) -> Dict[str, np.ndarray]:
    """
    Detect onsets SEPARATELY for each drum type in its frequency band.
    Returns dict of {drum_type: onset_times}.

    This is more accurate than detecting all onsets then classifying,
    because each drum's onsets are found in isolation.
    """
    logger.info('Running per-drum onset detection...')

    from scipy.signal import butter, sosfilt

    def bandpass_filter(data, lowcut, highcut, fs, order=4):
        """Safe bandpass filter"""
        nyq = 0.5 * fs
        low = max(lowcut / nyq, 0.01)
        high = min(highcut / nyq, 0.99)
        if low >= high:
            return data
        try:
            sos = butter(order, [low, high], btype='band', output='sos')
            filtered = sosfilt(sos, data)
            if not np.isfinite(filtered).all():
                return data
            return filtered
        except:
            return data

    results = {}

    # === KICK: 30-150Hz (tight range for kick body) ===
    y_kick = bandpass_filter(y, 30, 150, sr)
    kick_env = librosa.onset.onset_strength(y=y_kick, sr=sr, aggregate=np.median)
    kick_frames = librosa.onset.onset_detect(
        onset_envelope=kick_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.15,  # Higher threshold = fewer, stronger hits
        wait=8       # Min ~180ms between kicks
    )
    results['kick'] = librosa.frames_to_time(kick_frames, sr=sr)
    logger.info(f'  Kick: {len(results["kick"])} hits')

    # === SNARE: 150-1200Hz (snare body, tighter range) ===
    y_snare = bandpass_filter(y, 150, 1200, sr)
    snare_env = librosa.onset.onset_strength(y=y_snare, sr=sr, aggregate=np.median)
    snare_frames = librosa.onset.onset_detect(
        onset_envelope=snare_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.12,
        wait=6       # Min ~135ms between snares
    )
    results['snare'] = librosa.frames_to_time(snare_frames, sr=sr)
    logger.info(f'  Snare: {len(results["snare"])} hits')

    # === CLAP: 1200-4000Hz (clap body, noisy mid-highs) ===
    # Claps have energy in upper-mids, are very noisy/diffuse
    y_clap = bandpass_filter(y, 1200, 4000, sr)
    clap_env = librosa.onset.onset_strength(y=y_clap, sr=sr)
    clap_frames = librosa.onset.onset_detect(
        onset_envelope=clap_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.10,   # Sensitive - claps can be subtle in background
        wait=4        # Min ~90ms between claps
    )
    results['clap'] = librosa.frames_to_time(clap_frames, sr=sr)
    logger.info(f'  Clap: {len(results["clap"])} hits')

    # === HI-HAT: 6000-16000Hz (cymbals only) ===
    y_hihat = bandpass_filter(y, 6000, min(16000, sr/2 - 100), sr)
    hihat_env = librosa.onset.onset_strength(y=y_hihat, sr=sr)
    hihat_frames = librosa.onset.onset_detect(
        onset_envelope=hihat_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.08,
        wait=2       # Hi-hats can be fast
    )
    results['hihat'] = librosa.frames_to_time(hihat_frames, sr=sr)
    logger.info(f'  Hi-hat: {len(results["hihat"])} hits')

    # === TOM: 80-400Hz (tom body, lower than snare) ===
    # Toms have low-mid frequency content, between kick and snare
    y_tom = bandpass_filter(y, 80, 400, sr)
    tom_env = librosa.onset.onset_strength(y=y_tom, sr=sr, aggregate=np.median)
    tom_frames = librosa.onset.onset_detect(
        onset_envelope=tom_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.18,  # Higher threshold - toms are less common
        wait=6
    )
    # Remove tom hits that overlap with kick (within 50ms)
    tom_times = librosa.frames_to_time(tom_frames, sr=sr)
    kick_times = results.get('kick', np.array([]))
    if len(kick_times) > 0 and len(tom_times) > 0:
        filtered_toms = []
        for t in tom_times:
            if not np.any(np.abs(kick_times - t) < 0.05):
                filtered_toms.append(t)
        results['tom'] = np.array(filtered_toms)
    else:
        results['tom'] = tom_times
    logger.info(f'  Tom: {len(results["tom"])} hits')

    # === PERC: 4000-8000Hz (shakers, percussion) ===
    # Percussion instruments in upper-mid frequencies
    y_perc = bandpass_filter(y, 4000, 8000, sr)
    perc_env = librosa.onset.onset_strength(y=y_perc, sr=sr)
    perc_frames = librosa.onset.onset_detect(
        onset_envelope=perc_env, sr=sr,
        backtrack=False, units='frames',
        delta=0.12,
        wait=3
    )
    # Remove perc hits that overlap with hihat or clap (within 30ms)
    perc_times = librosa.frames_to_time(perc_frames, sr=sr)
    hihat_times = results.get('hihat', np.array([]))
    clap_times = results.get('clap', np.array([]))
    if len(perc_times) > 0:
        filtered_percs = []
        for t in perc_times:
            overlaps_hihat = len(hihat_times) > 0 and np.any(np.abs(hihat_times - t) < 0.03)
            overlaps_clap = len(clap_times) > 0 and np.any(np.abs(clap_times - t) < 0.03)
            if not overlaps_hihat and not overlaps_clap:
                filtered_percs.append(t)
        results['perc'] = np.array(filtered_percs)
    else:
        results['perc'] = perc_times
    logger.info(f'  Perc: {len(results["perc"])} hits')

    return results


def detect_onsets_drums(y: np.ndarray, sr: int) -> np.ndarray:
    """Legacy function - returns combined onsets"""
    per_drum = detect_onsets_per_drum(y, sr)
    all_onsets = np.concatenate([per_drum.get('kick', []),
                                  per_drum.get('snare', []),
                                  per_drum.get('clap', []),
                                  per_drum.get('hihat', [])])
    return np.unique(np.sort(all_onsets))


def detect_onsets(audio_path: str, y: np.ndarray, sr: int) -> np.ndarray:
    """Detect onsets using best available method"""
    if MADMOM_AVAILABLE:
        try:
            return detect_onsets_madmom(audio_path)
        except Exception as e:
            logger.warning(f'madmom onset detection failed: {e}, falling back to librosa')

    # Try drum-focused detection first, then standard librosa
    drum_onsets = detect_onsets_drums(y, sr)
    standard_onsets = detect_onsets_librosa(y, sr)

    # Merge and deduplicate (prefer drum-focused)
    all_onsets = np.concatenate([drum_onsets, standard_onsets])
    all_onsets = np.sort(all_onsets)

    # Remove duplicates within 30ms
    if len(all_onsets) > 1:
        diffs = np.diff(all_onsets)
        keep_mask = np.concatenate([[True], diffs > 0.03])
        all_onsets = all_onsets[keep_mask]

    logger.info(f'Combined onset detection: {len(all_onsets)} unique onsets')
    return all_onsets


# =============================================================================
# Drum Classification
# =============================================================================

def classify_hit_rules_drums_stem(features: Dict[str, float], beat_position: Optional[float] = None) -> Tuple[str, float]:
    """
    Rule-based drum classification OPTIMIZED FOR ISOLATED DRUMS STEMS.

    When analyzing a separated drums stem, there's no bass guitar/synths/vocals,
    so we can use more direct spectral analysis:
    - Low frequencies = KICK (it's the only thing down there)
    - Mid frequencies + noise = SNARE
    - High frequencies = HI-HAT
    """
    low = features['low_energy_ratio']           # 20-200Hz
    sub_bass = features.get('sub_bass_ratio', low * 0.3)   # 20-60Hz
    mid = features['mid_energy_ratio']           # 500-2kHz
    high = features['high_energy_ratio']         # 6-20kHz
    high_mid = features.get('high_mid_ratio', 0.15)        # 2-6kHz

    transient = features['transient_width']
    decay = features['decay_time']
    flatness = features['spectral_flatness']
    zcr = features['zero_crossing_rate']
    centroid = features.get('spectral_centroid', 0.5)

    scores = {
        'kick': 0.0,
        'snare': 0.0,
        'hihat': 0.0,
        'clap': 0.0,
        'tom': 0.0,
        'perc': 0.0
    }

    # For isolated drums: direct frequency mapping
    total = low + mid + high + 0.001

    # === KICK: Low frequency dominant ===
    # In drums stem, kick is the ONLY thing with significant low end
    if low > 0.35:  # Strong low content
        scores['kick'] += 0.7
    elif low > 0.25:
        scores['kick'] += 0.5
    elif low > 0.15:
        scores['kick'] += 0.25

    # Kick has low centroid
    if centroid < 0.20:
        scores['kick'] += 0.3
    elif centroid < 0.30:
        scores['kick'] += 0.15

    # Kick penalty if too bright
    if centroid > 0.40:
        scores['kick'] -= 0.4
    if high > low:
        scores['kick'] -= 0.3

    # === HI-HAT: High frequency dominant ===
    # In drums stem, hi-hat is clearly the brightest element
    if high > 0.25:
        scores['hihat'] += 0.6
    elif high > 0.15:
        scores['hihat'] += 0.4
    elif high > 0.10:
        scores['hihat'] += 0.2

    # Hi-hat has high centroid
    if centroid > 0.50:
        scores['hihat'] += 0.4
    elif centroid > 0.40:
        scores['hihat'] += 0.25
    elif centroid > 0.35:
        scores['hihat'] += 0.1

    # Short decay for closed hi-hat
    if decay < 15:
        scores['hihat'] += 0.2

    # Hi-hat penalty if too much low
    if low > 0.25:
        scores['hihat'] -= 0.4

    # === SNARE: Mid frequencies + noise ===
    # Snare has characteristic noise (high flatness, ZCR)
    if flatness > 0.30:
        scores['snare'] += 0.4
    elif flatness > 0.22:
        scores['snare'] += 0.25

    if zcr > 0.08:
        scores['snare'] += 0.25
    elif zcr > 0.05:
        scores['snare'] += 0.15

    # Mid-range centroid
    if 0.25 < centroid < 0.50:
        scores['snare'] += 0.25

    # Mid frequency content
    if mid > 0.20:
        scores['snare'] += 0.2

    # High-mid presence (snare snap)
    if high_mid > 0.12:
        scores['snare'] += 0.15

    # === CLAP: Very noisy, similar to snare but noisier ===
    if flatness > 0.45:
        scores['clap'] += 0.5
    if zcr > 0.12:
        scores['clap'] += 0.3
    if 0.30 < centroid < 0.50:
        scores['clap'] += 0.15

    # === TOM: Tonal, low-mid, longer decay ===
    if flatness < 0.20 and decay > 35:
        scores['tom'] += 0.4
    if 0.18 < centroid < 0.35:
        scores['tom'] += 0.2
    if 0.10 < low < 0.30 and mid > 0.15:
        scores['tom'] += 0.2

    # === PERC: catch-all ===
    scores['perc'] += 0.05

    # Beat position boost
    if beat_position is not None:
        on_beat = beat_position < 0.12 or beat_position > 0.88
        if on_beat:
            scores['kick'] *= 1.2

    # Find best match
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    total_score = sum(scores.values())
    confidence = best_score / total_score if total_score > 0 else 0.5

    # Boost confidence if clearly dominant
    sorted_scores = sorted(scores.values(), reverse=True)
    if len(sorted_scores) > 1 and sorted_scores[0] > sorted_scores[1] * 1.8:
        confidence = min(confidence * 1.3, 0.95)

    return best_type, confidence


def classify_hit_rules(features: Dict[str, float], beat_position: Optional[float] = None) -> Tuple[str, float]:
    """
    Rule-based drum classification using Knowledge Lab frequency bands.
    OPTIMIZED FOR FULL MIXES where bass adds low-end to everything.

    Key insight: In full mixes, we must use RELATIVE comparisons, not absolute thresholds.
    A kick is when low >> high. A hi-hat is when high >> low.
    """
    # Knowledge Lab frequency bands
    low = features['low_energy_ratio']           # 20-200Hz combined
    sub_bass = features.get('sub_bass_ratio', low * 0.3)   # 20-60Hz (kick sub)
    bass = features.get('bass_ratio', low * 0.7)           # 60-200Hz (kick body)
    low_mid = features.get('low_mid_ratio', 0.15)          # 200-500Hz (mud zone)
    mid = features['mid_energy_ratio']           # 500-2kHz (snare body)
    high_mid = features.get('high_mid_ratio', 0.15)        # 2-6kHz (click/attack)
    high = features['high_energy_ratio']         # 6-20kHz (cymbals)
    hihat_band = features.get('hihat_band_ratio', high * 0.8)  # 6-16kHz
    all_high = features.get('all_high_ratio', high + high_mid)  # 2-20kHz

    # Transient/spectral features
    transient = features['transient_width']
    decay = features['decay_time']
    flatness = features['spectral_flatness']
    zcr = features['zero_crossing_rate']
    centroid = features.get('spectral_centroid', 0.5)

    scores = {
        'kick': 0.0,
        'snare': 0.0,
        'hihat': 0.0,
        'clap': 0.0,
        'tom': 0.0,
        'perc': 0.0
    }

    # Calculate key ratios for full-mix classification
    total_energy = low + mid + all_high + 0.001
    low_dominance = low / total_energy          # How much of total is low?
    mid_dominance = mid / total_energy          # How much of total is mid?
    high_dominance = all_high / total_energy    # How much of total is high?

    # === PRIMARY CLASSIFICATION BY SPECTRAL CENTROID ===
    # Centroid is the most reliable indicator in full mixes:
    # - Kick: centroid < 0.20 (very low)
    # - Snare: 0.20 < centroid < 0.45 (mid-range)
    # - Hi-hat: centroid > 0.45 (bright)

    # === KICK DETECTION (STRICT) ===
    # Only kick if VERY low centroid AND low-dominant
    if centroid < 0.15:
        scores['kick'] += 0.6
    elif centroid < 0.22:
        scores['kick'] += 0.3
    # Must have significant low dominance
    if low_dominance > 0.50:
        scores['kick'] += 0.3
    elif low_dominance > 0.42:
        scores['kick'] += 0.15
    # Low >> high is key
    if low > all_high * 2.5:
        scores['kick'] += 0.2
    # PENALTY: if centroid is not low, less likely kick
    if centroid > 0.30:
        scores['kick'] -= 0.3
    if centroid > 0.40:
        scores['kick'] -= 0.3

    # === HI-HAT DETECTION (AGGRESSIVE) ===
    # Hi-hat = bright (high centroid) + short decay
    if centroid > 0.50:
        scores['hihat'] += 0.5
    elif centroid > 0.40:
        scores['hihat'] += 0.35
    elif centroid > 0.32:
        scores['hihat'] += 0.15
    # Short decay is key for closed hi-hat
    if decay < 12:
        scores['hihat'] += 0.25
    elif decay < 20:
        scores['hihat'] += 0.15
    # High frequency content
    if high_dominance > 0.35:
        scores['hihat'] += 0.2
    elif high_dominance > 0.25:
        scores['hihat'] += 0.1
    # Hi-hat band presence
    if hihat_band > 0.10:
        scores['hihat'] += 0.15
    # PENALTY: if lots of low, not hi-hat
    if low_dominance > 0.40:
        scores['hihat'] -= 0.3

    # === SNARE DETECTION ===
    # Snare = mid centroid + NOISY (high flatness + zcr)
    if 0.22 < centroid < 0.48:
        scores['snare'] += 0.3
    # NOISE is the key differentiator for snare
    if flatness > 0.28:
        scores['snare'] += 0.35
    elif flatness > 0.20:
        scores['snare'] += 0.2
    # Zero crossing (noise)
    if zcr > 0.07:
        scores['snare'] += 0.2
    elif zcr > 0.05:
        scores['snare'] += 0.1
    # Mid-range frequencies
    if mid_dominance > 0.22:
        scores['snare'] += 0.15
    # High-mid snap (2-6kHz)
    if high_mid > 0.10:
        scores['snare'] += 0.1
    # Medium decay
    if 10 < decay < 50:
        scores['snare'] += 0.1

    # === CLAP DETECTION ===
    # Clap = VERY noisy (highest flatness)
    if flatness > 0.42:
        scores['clap'] += 0.4
    if flatness > 0.50:
        scores['clap'] += 0.2
    if zcr > 0.10:
        scores['clap'] += 0.2
    if 0.25 < centroid < 0.45:
        scores['clap'] += 0.1

    # === TOM DETECTION ===
    # Tom = tonal (low flatness), longer decay, low-mid
    if flatness < 0.22 and decay > 30:
        scores['tom'] += 0.35
    if low_mid > 0.12:
        scores['tom'] += 0.15
    if 0.15 < centroid < 0.35:
        scores['tom'] += 0.15

    # === PERC (catch-all) ===
    scores['perc'] += 0.08

    # === PATTERN-AWARE BOOSTING ===
    # If we know the beat position, boost confidence for expected placements
    if beat_position is not None:
        # beat_position is 0-1 within a beat (0=downbeat, 0.5=off-beat)
        on_beat = beat_position < 0.1 or beat_position > 0.9  # Near beat
        on_offbeat = 0.4 < beat_position < 0.6  # Between beats

        # Kicks typically on downbeats
        if on_beat:
            scores['kick'] *= 1.3

        # Hi-hats common on off-beats
        if on_offbeat:
            scores['hihat'] *= 1.2

        # Snares/claps on backbeats (beats 2, 4) would be at position 0 within those beats
        # This is handled at a higher level with beat number

    # Find best match
    best_type = max(scores, key=scores.get)
    best_score = scores[best_type]

    # Normalize confidence
    total_score = sum(scores.values())
    confidence = best_score / total_score if total_score > 0 else 0.5

    # Boost confidence if score is significantly higher than others
    sorted_scores = sorted(scores.values(), reverse=True)
    if len(sorted_scores) > 1 and sorted_scores[0] > sorted_scores[1] * 1.5:
        confidence = min(confidence * 1.2, 0.95)

    return best_type, confidence


def classify_hit_ml(features: Dict[str, float]) -> Tuple[str, float]:
    """ML-based drum classification"""
    if classifier is None:
        return classify_hit_rules(features)

    feature_vector = [
        features['low_energy_ratio'],
        features['mid_energy_ratio'],
        features['high_energy_ratio'],
        features['transient_width'],
        features['decay_time'],
        features['spectral_centroid'],
        features['spectral_flatness'],
        features['zero_crossing_rate']
    ]

    drum_type = classifier.predict([feature_vector])[0]
    confidence = max(classifier.predict_proba([feature_vector])[0])

    return drum_type, confidence


def classify_hits(y: np.ndarray, sr: int, onset_times: np.ndarray,
                  beats: Optional[np.ndarray] = None,
                  time_signature: int = 4,
                  is_drums_stem: bool = False) -> List[DrumHit]:
    """
    Classify each detected onset as a drum type with beat-aware boosting.

    Args:
        y: Audio waveform
        sr: Sample rate
        onset_times: Array of onset times in seconds
        beats: Array of beat times for pattern-aware classification
        time_signature: Beats per bar (3 or 4)
        is_drums_stem: If True, use classifier optimized for isolated drums
    """
    classifier_name = 'drums_stem' if is_drums_stem else 'full_mix'
    logger.info(f'Classifying {len(onset_times)} hits using {classifier_name} classifier...')

    # Pre-compute beat positions if beats are provided
    beat_positions = None
    beat_numbers = None
    if beats is not None and len(beats) > 1:
        beat_duration = np.median(np.diff(beats))
        beat_positions = {}
        beat_numbers = {}
        for onset_time in onset_times:
            # Find nearest beat
            beat_idx = np.argmin(np.abs(beats - onset_time))
            beat_time = beats[beat_idx]

            # Position within beat (0.0 = on beat, 0.5 = half way to next beat)
            if onset_time >= beat_time:
                if beat_idx < len(beats) - 1:
                    next_beat = beats[beat_idx + 1]
                    pos = (onset_time - beat_time) / (next_beat - beat_time)
                else:
                    pos = (onset_time - beat_time) / beat_duration
            else:
                if beat_idx > 0:
                    prev_beat = beats[beat_idx - 1]
                    pos = 1.0 - (beat_time - onset_time) / (beat_time - prev_beat)
                else:
                    pos = 0.0

            beat_positions[onset_time] = min(max(pos, 0.0), 1.0)
            # Which beat in the bar (1, 2, 3, 4)
            beat_numbers[onset_time] = (beat_idx % time_signature) + 1

    hits = []
    for onset_time in onset_times:
        features = extract_hit_features(y, sr, onset_time)

        # Get beat position for pattern-aware classification
        beat_pos = beat_positions.get(onset_time) if beat_positions else None
        beat_num = beat_numbers.get(onset_time) if beat_numbers else None

        if SKLEARN_AVAILABLE and classifier is not None:
            drum_type, confidence = classify_hit_ml(features)
        elif is_drums_stem:
            # Use classifier optimized for isolated drums (cleaner signal)
            drum_type, confidence = classify_hit_rules_drums_stem(features, beat_pos)
        else:
            # Use classifier optimized for full mixes (accounts for bass/synth bleed)
            drum_type, confidence = classify_hit_rules(features, beat_pos)

        # Additional pattern-based boosting for snare/clap on beats 2 and 4
        if beat_num in [2, 4] and beat_pos is not None and beat_pos < 0.15:
            if drum_type in ['snare', 'clap']:
                confidence = min(confidence * 1.2, 0.95)
            elif features['mid_energy_ratio'] > 0.12:
                # If something is on 2 or 4 with mid frequencies, might be snare
                # Re-evaluate with snare bias
                features_copy = features.copy()
                scores_snare = 0.3  # Base boost for being on backbeat
                if features_copy['mid_energy_ratio'] > 0.15:
                    scores_snare += 0.2
                if features_copy['spectral_flatness'] > 0.2:
                    scores_snare += 0.15
                if scores_snare > 0.5:
                    drum_type = 'snare'
                    confidence = min(0.6, confidence)

        # Boost kick confidence on beats 1 and 3
        if beat_num in [1, 3] and beat_pos is not None and beat_pos < 0.15:
            if drum_type == 'kick':
                confidence = min(confidence * 1.2, 0.95)
            elif features['low_energy_ratio'] > 0.15:
                # Something with low end on beat 1 or 3 might be kick
                if features['low_energy_ratio'] > features['high_energy_ratio']:
                    drum_type = 'kick'
                    confidence = min(0.6, confidence)

        hits.append(DrumHit(
            time=float(onset_time),
            type=drum_type,
            confidence=float(confidence),
            features=features
        ))

    return hits


# =============================================================================
# Swing Detection and Quantization
# =============================================================================

def detect_swing(hits: List[DrumHit], beats: List[float],
                 time_signature: int = 4) -> float:
    """
    Detect swing amount from hit timing.

    Swing is measured as the ratio of the first half of each beat to the second.
    - 50% = straight (equal 8th notes)
    - 67% = triplet swing
    - Higher values = more swing

    Returns swing as percentage (0-100).
    """
    if len(hits) < 4 or len(beats) < 2:
        return 50.0  # Default to straight

    hit_times = np.array([h.time for h in hits])
    beats = np.array(beats)

    # Calculate beat duration
    beat_duration = np.median(np.diff(beats))
    eighth_duration = beat_duration / 2

    # Find hits that fall on offbeats (between beats)
    offbeat_ratios = []

    for i in range(len(beats) - 1):
        beat_start = beats[i]
        beat_end = beats[i + 1]
        beat_mid = beat_start + beat_duration / 2

        # Find hits in this beat
        beat_hits = hit_times[(hit_times >= beat_start) & (hit_times < beat_end)]

        # Find hits near the offbeat position
        for hit_time in beat_hits:
            # How far into the beat is this hit?
            position = (hit_time - beat_start) / beat_duration

            # If it's around the offbeat position (0.4-0.7 of the beat)
            if 0.35 < position < 0.75:
                # Calculate swing ratio
                ratio = position * 100
                offbeat_ratios.append(ratio)

    if len(offbeat_ratios) < 2:
        return 50.0

    # Median of offbeat ratios gives swing percentage
    swing = float(np.median(offbeat_ratios))

    # Clamp to reasonable range
    swing = max(40, min(75, swing))

    return swing


def quantize_to_grid(hits: List[DrumHit], bpm: float, downbeat_offset: float,
                     swing: float = 50.0, quantize_strength: float = 1.0,
                     subdivision: int = 4) -> Tuple[List[DrumHit], List[Dict]]:
    """
    Quantize hits to a rhythmic grid with swing awareness.

    Args:
        hits: List of drum hits
        bpm: Tempo in BPM
        downbeat_offset: Time of first downbeat
        swing: Swing percentage (50 = straight, 67 = triplet)
        quantize_strength: How much to quantize (0 = none, 1 = full)
        subdivision: Grid resolution (4 = 16th notes per beat)

    Returns:
        Quantized hits and their grid positions
    """
    beat_duration = 60.0 / bpm
    grid_duration = beat_duration / subdivision

    # Swing offset for odd subdivisions
    swing_ratio = swing / 100.0
    swing_offset = (swing_ratio - 0.5) * grid_duration

    quantized_hits = []
    grid_positions = []

    for hit in hits:
        # Calculate position relative to downbeat
        rel_time = hit.time - downbeat_offset

        # Find nearest grid position
        grid_index = round(rel_time / grid_duration)

        # Apply swing to odd grid positions
        if grid_index % 2 == 1:
            grid_time = grid_index * grid_duration + swing_offset
        else:
            grid_time = grid_index * grid_duration

        grid_time += downbeat_offset

        # Interpolate between original and quantized time
        quantized_time = hit.time + (grid_time - hit.time) * quantize_strength

        # Calculate bar, beat, subbeat
        total_beats = rel_time / beat_duration
        bar = int(total_beats // 4) + 1  # Assuming 4/4
        beat_in_bar = int(total_beats % 4) + 1
        subbeat = int((total_beats % 1) * subdivision) + 1

        quantized_hits.append(DrumHit(
            time=quantized_time,
            type=hit.type,
            confidence=hit.confidence,
            features=hit.features
        ))

        grid_positions.append({
            'bar': bar,
            'beat': beat_in_bar,
            'subbeat': subbeat,
            'original_time': hit.time,
            'quantized_time': quantized_time
        })

    return quantized_hits, grid_positions


# =============================================================================
# FastAPI Application
# =============================================================================

app = FastAPI(
    title='Rhythm Analyzer',
    description='AI-powered rhythm detection and drum classification',
    version='1.0.0'
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
async def health_check():
    """Health check endpoint"""
    return {
        'status': 'healthy',
        'madmom_available': MADMOM_AVAILABLE,
        'sklearn_available': SKLEARN_AVAILABLE,
        'classifier_loaded': classifier is not None,
        'gemini_available': GEMINI_AVAILABLE,
        'port': PORT
    }


# =============================================================================
# Gemini-Powered Drum Detection
# =============================================================================

def create_drum_spectrogram(y: np.ndarray, sr: int, duration: float) -> str:
    """Create a spectrogram image optimized for drum detection and return as base64."""
    fig, axes = plt.subplots(3, 1, figsize=(16, 8), facecolor='#1a1a2e')

    # Full spectrogram
    ax1 = axes[0]
    D = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=512)), ref=np.max)
    img1 = librosa.display.specshow(D, sr=sr, x_axis='time', y_axis='log', ax=ax1, cmap='magma')
    ax1.set_title('Full Spectrogram (log scale)', color='white', fontsize=10)
    ax1.set_facecolor('#1a1a2e')
    ax1.tick_params(colors='white')
    for spine in ax1.spines.values():
        spine.set_color('white')

    # Low frequency (kicks) - 20-200Hz
    ax2 = axes[1]
    y_low = librosa.effects.preemphasis(y)
    D_low = librosa.amplitude_to_db(np.abs(librosa.stft(y_low, n_fft=4096, hop_length=512)), ref=np.max)
    # Only show low frequencies
    freq_bins = librosa.fft_frequencies(sr=sr, n_fft=4096)
    low_mask = freq_bins <= 300
    D_low_filtered = D_low[low_mask, :]
    img2 = ax2.imshow(D_low_filtered, aspect='auto', origin='lower', cmap='Reds',
                      extent=[0, duration, 0, 300])
    ax2.set_title('Low Frequencies (Kicks: 20-300Hz)', color='white', fontsize=10)
    ax2.set_ylabel('Hz', color='white')
    ax2.set_facecolor('#1a1a2e')
    ax2.tick_params(colors='white')
    for spine in ax2.spines.values():
        spine.set_color('white')

    # High frequency (hi-hats) - 5kHz-20kHz
    ax3 = axes[2]
    D_high = librosa.amplitude_to_db(np.abs(librosa.stft(y, n_fft=2048, hop_length=256)), ref=np.max)
    freq_bins_high = librosa.fft_frequencies(sr=sr, n_fft=2048)
    high_mask = freq_bins_high >= 5000
    D_high_filtered = D_high[high_mask, :]
    times = librosa.times_like(D_high[0, :], sr=sr, hop_length=256)
    img3 = ax3.imshow(D_high_filtered, aspect='auto', origin='lower', cmap='YlOrRd',
                      extent=[0, duration, 5000, 20000])
    ax3.set_title('High Frequencies (Hi-hats: 5kHz-20kHz)', color='white', fontsize=10)
    ax3.set_xlabel('Time (s)', color='white')
    ax3.set_ylabel('Hz', color='white')
    ax3.set_facecolor('#1a1a2e')
    ax3.tick_params(colors='white')
    for spine in ax3.spines.values():
        spine.set_color('white')

    plt.tight_layout()

    # Save to base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', facecolor='#1a1a2e', dpi=100)
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close(fig)

    return img_base64


async def analyze_with_gemini(audio_path: str, spectrogram_base64: str, bpm: float, duration: float) -> List[Dict]:
    """Use Gemini to analyze drums from audio and spectrogram."""
    if not GEMINI_AVAILABLE or genai is None:
        raise HTTPException(status_code=503, detail='Gemini API not available')

    # Configure Gemini
    api_key = os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise HTTPException(status_code=503, detail='GOOGLE_API_KEY not set')

    genai.configure(api_key=api_key)

    # Load audio for Gemini
    audio_file = genai.upload_file(audio_path)

    prompt = f"""You are an expert drum transcription AI. Analyze this audio file and identify ALL drum hits.

AUDIO INFO:
- Duration: {duration:.2f} seconds
- Detected BPM: {bpm:.1f}
- Time signature: 4/4

TASK: Listen carefully to the audio and identify EVERY drum hit. For each hit, provide:
1. The exact timestamp in seconds (to 3 decimal places)
2. The drum type: kick, snare, hihat, clap, tom, or perc

DRUM IDENTIFICATION GUIDE:
- KICK: Low thump/boom sound (808, acoustic kick), usually on beats 1 and 3 (sometimes every beat in EDM)
- SNARE: Sharp crack sound with body, usually on beats 2 and 4
- HIHAT: High-pitched metallic "tss", "chick", or "sizzle" sound, often on 8th or 16th notes
- CLAP: Layered hand-clap sound with diffuse attack, often on beats 2 and 4
- TOM: Mid-pitched drum with tonal sustain, used in fills (floor tom, rack tom)
- PERC: ALL other percussion including: wood blocks, rim shots, clave, cowbell, tambourine, shaker, bongo, conga, guiro, triangle, agogo, maracas, cabasa, timbales, djembe, or any percussive hit that doesn't fit the above categories

OUTPUT FORMAT - Return ONLY a JSON array, no other text:
[
  {{"time": 0.125, "type": "kick"}},
  {{"time": 0.250, "type": "hihat"}},
  {{"time": 0.500, "type": "snare"}},
  ...
]

IMPORTANT:
- Listen to the ACTUAL audio, not just the spectrogram
- Be precise with timestamps - drums have sharp transients
- Include ALL hits you can hear, even quiet ones
- LISTEN CAREFULLY FOR QUIET PERCUSSION - wood blocks, claves, and similar instruments are often mixed LOW in volume but still important to the groove
- Scan the ENTIRE track from start to finish - percussion elements often enter LATER in the song (verse 2, chorus, etc.)
- DON'T MISS any wood block, clave, rim shot, or pitched percussion sounds - classify these as "perc"
- Typical EDM/Pop has kick on 1,3 and snare/clap on 2,4
- Hi-hats are usually on every 8th note (0.25 seconds apart at 120 BPM)
- If you hear a distinctive rhythmic element that's NOT kick/snare/hihat, it's probably "perc"
- CRITICAL: Don't stop listening after the first section - keep detecting hits throughout the ENTIRE song duration

Return ONLY the JSON array, no explanation."""

    try:
        # Use Gemini 2.5 Pro for better audio analysis accuracy
        model = genai.GenerativeModel('gemini-2.5-pro-preview-05-06')
        response = model.generate_content([audio_file, prompt])

        # Parse JSON from response
        response_text = response.text.strip()

        # Try to extract JSON array from response
        # Handle cases where response might have markdown code blocks
        if '```json' in response_text:
            response_text = response_text.split('```json')[1].split('```')[0].strip()
        elif '```' in response_text:
            response_text = response_text.split('```')[1].split('```')[0].strip()

        # Parse the JSON
        hits = json.loads(response_text)

        # Validate and clean hits
        valid_types = {'kick', 'snare', 'hihat', 'clap', 'tom', 'perc'}
        cleaned_hits = []
        for hit in hits:
            if isinstance(hit, dict) and 'time' in hit and 'type' in hit:
                hit_type = hit['type'].lower()
                if hit_type in valid_types:
                    cleaned_hits.append({
                        'time': float(hit['time']),
                        'type': hit_type,
                        'confidence': 0.9  # Gemini confidence
                    })

        logger.info(f'Gemini detected {len(cleaned_hits)} drum hits')
        return cleaned_hits

    except json.JSONDecodeError as e:
        logger.error(f'Failed to parse Gemini response: {e}')
        logger.error(f'Response was: {response_text[:500]}')
        raise HTTPException(status_code=500, detail=f'Failed to parse Gemini response: {e}')
    except Exception as e:
        logger.error(f'Gemini analysis failed: {e}')
        raise HTTPException(status_code=500, detail=f'Gemini analysis failed: {e}')


def correct_half_time_beats(bpm: float, beats: List[float], downbeats: List[Dict]) -> tuple:
    """
    If BPM < 90, it's likely half-time detection.
    Double the BPM and interpolate beats.
    """
    if bpm >= 90:
        return bpm, beats, downbeats

    # Double the BPM
    corrected_bpm = bpm * 2
    logger.info(f'Half-time correction: {bpm:.1f} -> {corrected_bpm:.1f} BPM')

    # Interpolate beats - add a beat between each existing beat
    corrected_beats = []
    for i in range(len(beats) - 1):
        corrected_beats.append(beats[i])
        # Add interpolated beat halfway between
        mid_beat = (beats[i] + beats[i + 1]) / 2
        corrected_beats.append(mid_beat)
    if beats:
        corrected_beats.append(beats[-1])

    # Update downbeats (every 4th beat in corrected grid = every 2nd original)
    corrected_downbeats = []
    for i, t in enumerate(corrected_beats):
        if i % 4 == 0:  # Every 4 beats (1 bar in 4/4)
            corrected_downbeats.append({'time': t, 'beat_position': 1})

    logger.info(f'Interpolated {len(beats)} -> {len(corrected_beats)} beats')
    return corrected_bpm, corrected_beats, corrected_downbeats


@app.post('/analyze-rhythm-ai')
async def analyze_rhythm_with_ai(
    audio: UploadFile = File(...),
    apply_pattern_filter: bool = Form(False),  # Not needed - beat-aligned is already on grid
    pattern_tolerance_ms: float = Form(100),
):
    """
    AI-enhanced rhythm analysis using beat-aligned detection.
    More reliable than Gemini audio classification.
    """
    start_time = time.time()
    file_id = str(uuid.uuid4())[:8]
    temp_path = TEMP_DIR / f'{file_id}_{audio.filename}'

    try:
        # Save uploaded file
        content = await audio.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        # Load audio
        y, sr = load_audio(str(temp_path))
        duration = len(y) / sr

        logger.info(f'AI analysis: {duration:.1f}s of audio...')

        # Step 1: Detect BPM and beats
        beat_result, method = detect_beats(str(temp_path), y, sr)
        logger.info(f'Detected {beat_result.bpm:.1f} BPM, {len(beat_result.beats)} beats')

        # Step 1b: Correct half-time detection (BPM < 90 -> double it)
        corrected_bpm, corrected_beats, corrected_downbeats = correct_half_time_beats(
            beat_result.bpm, beat_result.beats, beat_result.downbeats
        )

        # Step 2: Beat-aligned drum detection with CORRECTED beats
        beats_array = np.array(corrected_beats)
        beat_aligned_hits = detect_drums_beat_aligned(
            y, sr, beats_array, beat_result.time_signature
        )

        # Convert to DrumHit objects
        hits = []
        for drum_type, times in beat_aligned_hits.items():
            for t in times:
                hits.append(DrumHit(
                    time=float(t),
                    type=drum_type,
                    confidence=0.85,
                    features=None
                ))

        hits.sort(key=lambda h: h.time)

        # Detect swing and genre
        swing = detect_swing(hits, beat_result.beats, beat_result.time_signature)
        detected_genre, genre_confidence = detect_genre(beat_result.bpm, hits, swing)

        # Count hits by type
        hit_counts = {}
        for h in hits:
            hit_counts[h.type] = hit_counts.get(h.type, 0) + 1
        logger.info(f'Detected: {hit_counts}')

        hits_before_filter = len(hits)
        pattern_filter_applied = False

        hits_after_filter = len(hits)

        elapsed = time.time() - start_time
        analysis_method = 'gemini-ai'
        if pattern_filter_applied:
            analysis_method += '+pattern_filter'

        logger.info(f'Gemini analysis complete in {elapsed:.2f}s')
        logger.info(f'Final hits: {len([h for h in hits if h.type=="kick"])} kicks, '
                   f'{len([h for h in hits if h.type=="snare"])} snares, '
                   f'{len([h for h in hits if h.type=="clap"])} claps, '
                   f'{len([h for h in hits if h.type=="hihat"])} hihats')

        return RhythmAnalysisResult(
            bpm=corrected_bpm,  # Use corrected BPM (doubled if half-time)
            bpm_confidence=beat_result.bpm_confidence,
            beats=corrected_beats,  # Use interpolated beats
            downbeats=corrected_downbeats,  # Use corrected downbeats
            time_signature=beat_result.time_signature,
            hits=[h.model_dump() for h in hits],
            swing=swing,
            analysis_method=analysis_method,
            duration=duration,
            analysis_source='gemini_ai',
            detected_genre=detected_genre,
            genre_confidence=genre_confidence,
            pattern_filter_applied=pattern_filter_applied,
            hits_before_filter=hits_before_filter,
            hits_after_filter=hits_after_filter,
        )

    finally:
        if temp_path.exists():
            temp_path.unlink()


# =============================================================================
# Step-by-Step Verification Endpoint
# =============================================================================

class StepResult(BaseModel):
    """Result for a single detection step"""
    step_name: str
    drum_type: Optional[str] = None
    hits: List[Dict] = []
    hit_count: int = 0
    threshold_used: float = 0.0
    energy_stats: Dict = {}
    status: str = 'pending'  # pending, complete, skipped


class StepByStepResult(BaseModel):
    """Full step-by-step analysis result"""
    bpm: float
    bpm_confidence: float
    beats: List[float]
    downbeats: List[Dict]
    time_signature: int
    duration: float
    steps: List[StepResult]
    detected_genre: Optional[str] = None
    genre_confidence: float = 0.0


def detect_drums_with_sensitivity(
    y: np.ndarray,
    sr: int,
    beats: np.ndarray,
    time_signature: int,
    sensitivities: Dict[str, float]
) -> Dict[str, Dict]:
    """
    Drum detection with adjustable per-instrument sensitivity.
    Returns hits AND energy stats for verification UI.

    sensitivities: {'kick': 0.5, 'snare': 0.5, 'hihat': 0.5, ...}
    where 0.0 = very sensitive (detect everything), 1.0 = strict (detect only strong hits)
    """
    # Apply HPSS to isolate percussive content
    y_perc = apply_hpss_preprocessing(y, sr)

    from scipy.signal import butter, sosfilt

    def bandpass_filter(data, lowcut, highcut, fs, order=4):
        nyq = 0.5 * fs
        low = max(lowcut / nyq, 0.01)
        high = min(highcut / nyq, 0.99)
        if low >= high:
            return data
        try:
            sos = butter(order, [low, high], btype='band', output='sos')
            return sosfilt(sos, data)
        except:
            return data

    def get_energy_at_time(audio, sample_rate, time_sec, window_ms=30):
        center = int(time_sec * sample_rate)
        half_window = int(window_ms * sample_rate / 1000 / 2)
        start = max(0, center - half_window)
        end = min(len(audio), center + half_window)
        if end <= start:
            return 0.0
        segment = audio[start:end]
        return float(np.sqrt(np.mean(segment ** 2)))

    # Pre-filter PERCUSSIVE audio (HPSS output)
    y_low = bandpass_filter(y_perc, 20, 300, sr)      # Kick band (sub-bass to punch)
    y_mid = bandpass_filter(y_perc, 150, 2000, sr)    # Snare body
    y_high = bandpass_filter(y_perc, 5000, min(16000, sr/2-100), sr)  # Hi-hat/cymbal

    # Calculate base thresholds
    low_energies = [get_energy_at_time(y_low, sr, t) for t in beats]
    mid_energies = [get_energy_at_time(y_mid, sr, t) for t in beats]
    high_energies = [get_energy_at_time(y_high, sr, t) for t in beats]

    base_low = np.median(low_energies) if low_energies else 0.01
    base_mid = np.median(mid_energies) if mid_energies else 0.01
    base_high = np.median(high_energies) if high_energies else 0.01

    results = {}

    # 16th note grid
    sixteenth_notes = []
    for i in range(len(beats) - 1):
        beat_duration = beats[i+1] - beats[i]
        for j in range(4):
            sixteenth_notes.append(beats[i] + beat_duration * j * 0.25)
    if len(beats) > 0:
        sixteenth_notes.append(beats[-1])

    # === KICK ===
    kick_sens = sensitivities.get('kick', 0.5)

    # Collect all energies first for percentile-based threshold
    all_kick_energies = [get_energy_at_time(y_low, sr, t) for t in sixteenth_notes]
    # Sensitivity adjusts the percentile: 0 = 40th percentile (sensitive), 1 = 80th (strict)
    percentile = 40 + kick_sens * 40
    kick_threshold = np.percentile(all_kick_energies, percentile) if all_kick_energies else base_low
    kick_hits = []
    kick_energies = []

    for idx, t in enumerate(sixteenth_notes):
        energy = get_energy_at_time(y_low, sr, t)
        kick_energies.append({'time': t, 'energy': energy})

        beat_idx = idx // 4
        sub_idx = idx % 4
        beat_in_bar = beat_idx % time_signature
        position_in_bar = beat_in_bar * 4 + sub_idx

        # Only check main beat and 8th note positions
        if position_in_bar in [0, 8]:  # Beats 1 and 3
            thresh = kick_threshold
        elif position_in_bar in [4, 12]:  # Beats 2 and 4
            thresh = kick_threshold * 1.15
        elif position_in_bar in [2, 6, 10, 14]:  # 8th notes
            thresh = kick_threshold * 1.1
        else:
            continue  # Skip 16th note positions

        if energy > thresh:
            kick_hits.append({'time': float(t), 'type': 'kick', 'confidence': min(energy / thresh, 1.0), 'energy': energy})

    results['kick'] = {
        'hits': kick_hits,
        'threshold': kick_threshold,
        'energy_stats': {
            'median': float(base_low),
            'max': float(max(e['energy'] for e in kick_energies)) if kick_energies else 0,
            'min': float(min(e['energy'] for e in kick_energies)) if kick_energies else 0,
        }
    }

    # === SNARE ===
    snare_sens = sensitivities.get('snare', 0.5)
    snare_hits = []
    snare_energies = []

    # Collect all snare position energies first for adaptive threshold
    snare_positions = []
    for i, beat_time in enumerate(beats):
        beat_in_bar = i % time_signature
        if beat_in_bar in [1, 3]:  # Beats 2 and 4
            mid_energy = get_energy_at_time(y_mid, sr, beat_time)
            high_energy = get_energy_at_time(y_high, sr, beat_time)
            snare_positions.append({'time': beat_time, 'mid': mid_energy, 'high': high_energy})
            snare_energies.append({'time': beat_time, 'energy': mid_energy})

    # Use adaptive percentile-based threshold (like kicks)
    all_snare_mids = [p['mid'] for p in snare_positions]
    snare_percentile = 30 + snare_sens * 30  # 30-60th percentile based on sensitivity
    snare_threshold = np.percentile(all_snare_mids, snare_percentile) if all_snare_mids else base_mid

    # Detect snares with adaptive threshold
    for pos in snare_positions:
        mid_energy = pos['mid']
        high_energy = pos['high']
        # Snare = mid energy above threshold, OR combined mid+high energy
        combined_energy = mid_energy + high_energy * 0.3
        if combined_energy > snare_threshold:
            snare_hits.append({'time': float(pos['time']), 'type': 'snare', 'confidence': min(combined_energy / snare_threshold, 1.0), 'energy': mid_energy})

    results['snare'] = {
        'hits': snare_hits,
        'threshold': snare_threshold,
        'energy_stats': {
            'median': float(base_mid),
            'max': float(max(e['energy'] for e in snare_energies)) if snare_energies else 0,
            'min': float(min(e['energy'] for e in snare_energies)) if snare_energies else 0,
        }
    }

    # === CLAP ===
    # Claps are detected at beats 2 & 4, distinguished from snares by higher frequencies
    # In many modern productions, clap and snare are layered - detect both
    clap_sens = sensitivities.get('clap', 0.5)
    clap_hits = []

    # Use adaptive threshold based on high-frequency content at snare positions
    clap_highs = [get_energy_at_time(y_high, sr, p['time']) for p in snare_positions]
    clap_threshold_high = np.percentile(clap_highs, 30 + clap_sens * 30) if clap_highs else base_high

    # Also calculate typical high/mid ratio across all snare positions
    high_mid_ratios = []
    for pos in snare_positions:
        high_energy = get_energy_at_time(y_high, sr, pos['time'])
        mid_energy = pos['mid']
        ratio = high_energy / (mid_energy + 1e-10)
        high_mid_ratios.append(ratio)

    # Adaptive ratio threshold based on the track's character
    median_ratio = np.median(high_mid_ratios) if high_mid_ratios else 0.3
    ratio_threshold = max(0.15, median_ratio * 0.5)  # Lower threshold, based on track

    for pos in snare_positions:
        high_energy = get_energy_at_time(y_high, sr, pos['time'])
        mid_energy = pos['mid']

        # Clap has significant high-frequency content
        high_mid_ratio = high_energy / (mid_energy + 1e-10)

        # Detect clap if: high energy above threshold AND ratio above adaptive threshold
        # OR if high energy is very strong (likely layered clap)
        if high_energy > clap_threshold_high and (high_mid_ratio > ratio_threshold or high_energy > clap_threshold_high * 1.3):
            clap_hits.append({'time': float(pos['time']), 'type': 'clap', 'confidence': min(high_energy / clap_threshold_high, 1.0), 'energy': high_energy})

    results['clap'] = {
        'hits': clap_hits,
        'threshold': float(clap_threshold_high),
        'energy_stats': {'median': float(base_high)}
    }

    # === HIHAT ===
    hihat_sens = sensitivities.get('hihat', 0.5)

    # Calculate 8th note positions
    eighth_notes_times = []
    for i in range(len(beats) - 1):
        eighth_notes_times.append(beats[i])
        eighth_notes_times.append((beats[i] + beats[i+1]) / 2)
    if len(beats) > 0:
        eighth_notes_times.append(beats[-1])

    # Collect all high energies for percentile-based threshold
    all_hihat_energies = [get_energy_at_time(y_high, sr, t) for t in eighth_notes_times]
    percentile = 40 + hihat_sens * 40
    hihat_threshold = np.percentile(all_hihat_energies, percentile) if all_hihat_energies else base_high
    hihat_hits = []
    hihat_energies = []

    for t in eighth_notes_times:
        high_energy = get_energy_at_time(y_high, sr, t)
        low_energy = get_energy_at_time(y_low, sr, t)
        hihat_energies.append({'time': t, 'energy': high_energy})

        # Hihat: high frequency present and somewhat dominant over low
        if high_energy > hihat_threshold and high_energy > low_energy * 0.7:
            hihat_hits.append({'time': float(t), 'type': 'hihat', 'confidence': min(high_energy / hihat_threshold, 1.0), 'energy': high_energy})

    results['hihat'] = {
        'hits': hihat_hits,
        'threshold': hihat_threshold,
        'energy_stats': {
            'median': float(base_high),
            'max': float(max(e['energy'] for e in hihat_energies)) if hihat_energies else 0,
            'min': float(min(e['energy'] for e in hihat_energies)) if hihat_energies else 0,
        }
    }

    return results


@app.post('/analyze-rhythm-steps')
async def analyze_rhythm_step_by_step(
    audio: UploadFile = File(...),
    kick_sensitivity: float = Form(0.5),
    snare_sensitivity: float = Form(0.5),
    hihat_sensitivity: float = Form(0.5),
    clap_sensitivity: float = Form(0.5),
):
    """
    Step-by-step rhythm analysis with adjustable sensitivity per instrument.
    Returns intermediate results for verification UI.

    Sensitivity: 0.0 = detect everything (very sensitive)
                 1.0 = strict (only strong hits)
    """
    start_time = time.time()
    file_id = str(uuid.uuid4())[:8]
    temp_path = TEMP_DIR / f'{file_id}_{audio.filename}'

    try:
        content = await audio.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        y, sr = load_audio(str(temp_path))
        duration = len(y) / sr

        logger.info(f'Step-by-step analysis: {duration:.1f}s, sensitivities: kick={kick_sensitivity}, snare={snare_sensitivity}, hihat={hihat_sensitivity}')

        steps = []

        # Step 1: Beat Detection
        beat_result, method = detect_beats(str(temp_path), y, sr)

        # Step 1b: Correct half-time detection (BPM < 90 -> double it)
        corrected_bpm, corrected_beats, corrected_downbeats = correct_half_time_beats(
            beat_result.bpm, beat_result.beats, beat_result.downbeats
        )

        steps.append(StepResult(
            step_name='Beat Detection',
            hit_count=len(corrected_beats),
            status='complete',
            energy_stats={
                'bpm': corrected_bpm,
                'original_bpm': beat_result.bpm,
                'confidence': beat_result.bpm_confidence,
                'method': method,
                'half_time_corrected': corrected_bpm != beat_result.bpm
            }
        ))

        # Step 2-5: Per-instrument detection with sensitivity
        sensitivities = {
            'kick': kick_sensitivity,
            'snare': snare_sensitivity,
            'hihat': hihat_sensitivity,
            'clap': clap_sensitivity,
        }

        # Use CORRECTED beats for detection
        beats_array = np.array(corrected_beats)
        detection_results = detect_drums_with_sensitivity(
            y, sr, beats_array, beat_result.time_signature, sensitivities
        )

        # Add step for each drum type
        for drum_type in ['kick', 'snare', 'hihat', 'clap']:
            result = detection_results.get(drum_type, {'hits': [], 'threshold': 0, 'energy_stats': {}})
            steps.append(StepResult(
                step_name=f'{drum_type.title()} Detection',
                drum_type=drum_type,
                hits=result['hits'],
                hit_count=len(result['hits']),
                threshold_used=result['threshold'],
                energy_stats=result['energy_stats'],
                status='complete'
            ))

        # Detect genre
        all_hits = []
        for drum_type, data in detection_results.items():
            for hit in data['hits']:
                all_hits.append(DrumHit(time=hit['time'], type=drum_type, confidence=hit['confidence']))

        detected_genre, genre_confidence = detect_genre(corrected_bpm, all_hits, 50)

        elapsed = time.time() - start_time
        logger.info(f'Step-by-step analysis complete in {elapsed:.2f}s')

        return StepByStepResult(
            bpm=corrected_bpm,  # Use corrected BPM
            bpm_confidence=beat_result.bpm_confidence,
            beats=corrected_beats,  # Use interpolated beats
            downbeats=corrected_downbeats,  # Use corrected downbeats
            time_signature=beat_result.time_signature,
            duration=duration,
            steps=steps,
            detected_genre=detected_genre,
            genre_confidence=genre_confidence,
        )

    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.post('/apply-verified-hits')
async def apply_verified_hits(
    hits: str = Form(...),  # JSON string of verified hits
    bpm: float = Form(...),
    time_signature: int = Form(4),
):
    """
    Apply user-verified hits after step-by-step review.
    Converts verified hits to final format.
    """
    try:
        verified_hits = json.loads(hits)

        # Format hits for grid
        formatted_hits = []
        for hit in verified_hits:
            formatted_hits.append(DrumHit(
                time=hit['time'],
                type=hit['type'],
                confidence=hit.get('confidence', 1.0),
                features=None
            ))

        # Detect swing from verified hits
        beat_duration = 60.0 / bpm
        beats = [i * beat_duration for i in range(int(len(formatted_hits) / 4) + 1)]
        swing = detect_swing(formatted_hits, beats, time_signature)

        detected_genre, genre_confidence = detect_genre(bpm, formatted_hits, swing)

        return {
            'status': 'success',
            'hits': [h.model_dump() for h in formatted_hits],
            'hit_count': len(formatted_hits),
            'swing': swing,
            'detected_genre': detected_genre,
            'genre_confidence': genre_confidence,
        }

    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f'Invalid JSON: {e}')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error applying hits: {e}')


# =============================================================================
# Pattern-Based Filter - Keeps only hits at expected positions
# =============================================================================

# Expected beat positions per drum type (in beats, 0 = beat 1, 0.5 = 8th note, 0.25 = 16th note)
EXPECTED_POSITIONS = {
    'kick': {
        'edm': [0, 1, 2, 3],  # Every beat (4-on-floor)
        'pop': [0, 2],  # Beats 1 and 3
        'trap': [0, 2.5],  # Beat 1, syncopated
        'afro_house': [0, 2],  # Sparse kicks
        'default': [0, 2],  # Beats 1 and 3
    },
    'snare': {
        'edm': [1, 3],  # Beats 2 and 4
        'pop': [1, 3],  # Beats 2 and 4
        'trap': [2],  # Half-time, beat 3
        'afro_house': [1, 3],  # Beats 2 and 4
        'default': [1, 3],
    },
    'clap': {
        'edm': [1, 3],  # Beats 2 and 4
        'pop': [1, 3],
        'trap': [2],  # Half-time
        'afro_house': [1, 3],
        'default': [1, 3],
    },
    'hihat': {
        # Hi-hats can be on 8th notes (every 0.5 beats) or 16th notes (every 0.25 beats)
        'edm': [i * 0.5 for i in range(8)],  # 8th notes
        'pop': [i * 0.5 for i in range(8)],
        'trap': [i * 0.25 for i in range(16)],  # 16th notes (rolling hats)
        'afro_house': [i * 0.5 for i in range(8)],
        'default': [i * 0.5 for i in range(8)],
    },
    'tom': {
        # Toms are fills - less predictable, but usually on beats
        'default': [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],  # Any beat or off-beat
    },
    'perc': {
        # Percussion can be anywhere
        'default': [i * 0.25 for i in range(16)],  # Allow any 16th note
    },
}


def filter_hits_by_pattern(
    hits: List[DrumHit],
    bpm: float,
    downbeat_time: float,
    time_signature: int = 4,
    genre: Optional[str] = None,
    tolerance_ms: float = 80  # How close to expected position (in ms)
) -> List[DrumHit]:
    """
    Filter hits to keep only those near expected pattern positions.

    This removes false positives by checking if each hit falls near
    a musically expected position for its drum type.
    """
    if not hits:
        return []

    beat_duration = 60 / bpm  # seconds per beat
    bar_duration = beat_duration * time_signature
    tolerance_sec = tolerance_ms / 1000

    filtered = []
    stats = {drum: {'kept': 0, 'removed': 0} for drum in EXPECTED_POSITIONS.keys()}

    for hit in hits:
        drum_type = hit.type
        hit_time = hit.time

        # Get expected positions for this drum type and genre
        positions_dict = EXPECTED_POSITIONS.get(drum_type, {'default': [i * 0.5 for i in range(8)]})
        expected_positions = positions_dict.get(genre, positions_dict.get('default', []))

        # Calculate position within the bar
        time_from_downbeat = hit_time - downbeat_time
        if time_from_downbeat < 0:
            # Before downbeat - skip or adjust
            stats[drum_type]['removed'] = stats.get(drum_type, {}).get('removed', 0) + 1
            continue

        bar_position = (time_from_downbeat % bar_duration) / beat_duration  # Position in beats (0-4)

        # Check if this position is near any expected position
        is_expected = False
        for expected_pos in expected_positions:
            # Check distance to expected position (accounting for bar wrap-around)
            distance = abs(bar_position - expected_pos)
            distance_sec = distance * beat_duration

            if distance_sec <= tolerance_sec:
                is_expected = True
                break

        if is_expected:
            filtered.append(hit)
            if drum_type in stats:
                stats[drum_type]['kept'] += 1
        else:
            if drum_type in stats:
                stats[drum_type]['removed'] += 1

    # Log filter stats
    logger.info(f'Pattern filter stats (genre={genre}, tolerance={tolerance_ms}ms):')
    for drum, counts in stats.items():
        if counts['kept'] + counts['removed'] > 0:
            logger.info(f'  {drum}: kept {counts["kept"]}, removed {counts["removed"]}')

    return filtered


@app.post('/filter-hits-by-pattern')
async def filter_hits_endpoint(
    hits: List[Dict] = [],
    bpm: float = 120,
    downbeat_time: float = 0,
    time_signature: int = 4,
    genre: Optional[str] = None,
    tolerance_ms: float = 80,
):
    """
    Filter detected hits to keep only those at expected pattern positions.
    Use this after detection to clean up false positives.
    """
    # Convert dicts to DrumHit objects
    drum_hits = [DrumHit(
        time=h['time'],
        type=h['type'],
        confidence=h.get('confidence', 0.8),
        features=None
    ) for h in hits]

    filtered = filter_hits_by_pattern(
        drum_hits, bpm, downbeat_time, time_signature, genre, tolerance_ms
    )

    return {
        'original_count': len(hits),
        'filtered_count': len(filtered),
        'hits': [h.model_dump() for h in filtered]
    }


async def separate_drums_stem(audio_path: str, max_retries: int = 2) -> Tuple[Optional[str], str]:
    """
    Call the stem separator service to extract drums stem.
    Returns tuple of (path_to_drums_stem, status_message).
    path is None if separation failed.
    """
    import aiohttp
    import asyncio

    STEM_SEPARATOR_URL = 'http://localhost:56402'

    for attempt in range(max_retries + 1):
        try:
            if attempt > 0:
                logger.info(f'Retry attempt {attempt}/{max_retries} for stem separation...')
                await asyncio.sleep(2 ** attempt)  # Exponential backoff

            logger.info('Step 1: Checking stem separator service health...')

            # First check if service is available
            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=10)) as session:
                try:
                    async with session.get(f'{STEM_SEPARATOR_URL}/health') as health_resp:
                        if health_resp.status != 200:
                            logger.warning(f'Stem separator service unhealthy: {health_resp.status}')
                            continue  # Retry
                        logger.info('Stem separator service is healthy')
                except aiohttp.ClientError as e:
                    logger.warning(f'Cannot connect to stem separator: {e}')
                    if attempt == max_retries:
                        return None, f'Stem separator service unavailable: {e}'
                    continue

            logger.info('Step 2: Reading audio file for upload...')

            # Read file content BEFORE creating FormData to avoid file handle issues
            try:
                with open(audio_path, 'rb') as f:
                    file_content = f.read()
                file_name = Path(audio_path).name
                logger.info(f'Read {len(file_content)} bytes from {file_name}')
            except Exception as e:
                logger.error(f'Failed to read audio file: {e}')
                return None, f'Failed to read audio file: {e}'

            logger.info('Step 3: Uploading file to stem separator...')

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=300)) as session:
                # Create FormData with file content (not file handle)
                data = aiohttp.FormData()
                data.add_field('file', file_content, filename=file_name, content_type='audio/mpeg')
                data.add_field('model', 'htdemucs')

                async with session.post(f'{STEM_SEPARATOR_URL}/separate', data=data) as resp:
                    if resp.status != 200:
                        resp_text = await resp.text()
                        logger.warning(f'Stem separation upload failed: {resp.status} - {resp_text[:200]}')
                        if attempt == max_retries:
                            return None, f'Upload failed with status {resp.status}'
                        continue
                    result = await resp.json()
                    job_id = result.get('job_id')
                    logger.info(f'Stem separation job created: {job_id}')

                if not job_id:
                    logger.warning('No job_id returned from stem separator')
                    if attempt == max_retries:
                        return None, 'No job ID returned from stem separator'
                    continue

                logger.info('Step 4: Polling for separation completion...')

                # Poll for completion with progress logging
                poll_count = 0
                max_polls = 180  # Max 3 minutes (1 poll per second)
                while poll_count < max_polls:
                    await asyncio.sleep(1)
                    poll_count += 1

                    try:
                        async with session.get(f'{STEM_SEPARATOR_URL}/jobs/{job_id}') as resp:
                            if resp.status != 200:
                                logger.warning(f'Poll request failed: {resp.status}')
                                continue
                            status = await resp.json()
                            job_status = status.get('status')
                            progress = status.get('progress', 0)

                            # Log progress every 10 seconds
                            if poll_count % 10 == 0:
                                logger.info(f'Separation progress: {progress}% (poll {poll_count}/{max_polls})')

                            if job_status == 'completed':
                                stems = status.get('stems', {})
                                drums_file = stems.get('drums')
                                if not drums_file:
                                    logger.warning('Separation completed but no drums stem found')
                                    return None, 'No drums stem in separation result'

                                logger.info(f'Step 5: Downloading drums stem: {drums_file}')

                                # Download drums stem
                                async with session.get(f'{STEM_SEPARATOR_URL}/stems/{job_id}/{drums_file}') as stem_resp:
                                    if stem_resp.status == 200:
                                        drums_path = TEMP_DIR / f'drums_{job_id}.mp3'
                                        stem_content = await stem_resp.read()
                                        with open(drums_path, 'wb') as out:
                                            out.write(stem_content)
                                        logger.info(f'SUCCESS: Drums stem saved ({len(stem_content)} bytes): {drums_path}')
                                        return str(drums_path), 'Drums stem separated successfully'
                                    else:
                                        logger.warning(f'Failed to download drums stem: {stem_resp.status}')
                                        return None, f'Failed to download drums stem: {stem_resp.status}'

                            elif job_status == 'failed':
                                error_msg = status.get('error', 'Unknown error')
                                logger.warning(f'Stem separation job failed: {error_msg}')
                                if attempt == max_retries:
                                    return None, f'Separation failed: {error_msg}'
                                break  # Retry

                    except aiohttp.ClientError as e:
                        logger.warning(f'Poll request error: {e}')
                        # Continue polling, don't fail immediately
                        continue

                # Polling timeout
                if poll_count >= max_polls:
                    logger.warning(f'Stem separation timed out after {max_polls} seconds')
                    if attempt == max_retries:
                        return None, 'Stem separation timed out'

        except aiohttp.ClientError as e:
            logger.warning(f'Stem separation connection error: {e}')
            if attempt == max_retries:
                return None, f'Connection error: {e}'

        except Exception as e:
            logger.error(f'Stem separation unexpected error: {e}')
            if attempt == max_retries:
                return None, f'Unexpected error: {e}'

    return None, 'Max retries exceeded'


def detect_genre(bpm: float, hits: List[DrumHit], swing: float) -> Tuple[Optional[str], float]:
    """
    Detect genre based on BPM range and drum pattern characteristics.
    Returns (genre_name, confidence).
    """
    # Count hit types
    kick_count = len([h for h in hits if h.type == 'kick'])
    snare_count = len([h for h in hits if h.type == 'snare'])
    clap_count = len([h for h in hits if h.type == 'clap'])
    hihat_count = len([h for h in hits if h.type == 'hihat'])

    # Calculate ratios
    total_hits = max(len(hits), 1)
    kick_ratio = kick_count / total_hits
    snare_ratio = snare_count / total_hits
    clap_ratio = clap_count / total_hits
    hihat_ratio = hihat_count / total_hits

    # Genre detection rules based on BPM and pattern characteristics
    genre_scores = {}

    # EDM / House: 120-135 BPM, 4-on-floor kick, claps on 2/4
    if 118 <= bpm <= 138:
        score = 0.5
        if kick_ratio > 0.15:  # Lots of kicks (4-on-floor)
            score += 0.2
        if clap_ratio > 0.08 or snare_ratio > 0.08:  # Claps/snares present
            score += 0.15
        if abs(swing - 50) < 5:  # Straight timing
            score += 0.15
        genre_scores['edm'] = min(score, 1.0)

    # Afro House: 118-128 BPM, sparse kick, high swing
    if 115 <= bpm <= 130:
        score = 0.4
        if kick_ratio < 0.15:  # Sparse kicks
            score += 0.15
        if swing > 54:  # Swung timing
            score += 0.25
        if hihat_ratio > 0.2:  # Lots of hi-hats/shakers
            score += 0.15
        genre_scores['afro_house'] = min(score, 1.0)

    # Trap: 60-85 BPM (or 120-170 half-time feel), half-time snare
    if 60 <= bpm <= 90 or (130 <= bpm <= 180):
        score = 0.4
        if snare_ratio < 0.08:  # Sparse snares (half-time)
            score += 0.2
        if hihat_ratio > 0.3:  # Lots of hi-hats (rolling hats)
            score += 0.2
        if kick_ratio < 0.12:  # Sparse kicks
            score += 0.15
        genre_scores['trap'] = min(score, 1.0)

    # Pop: 90-130 BPM, backbeat snare
    if 85 <= bpm <= 135:
        score = 0.35
        if snare_ratio > 0.08:  # Regular snares
            score += 0.2
        if kick_ratio > 0.08 and kick_ratio < 0.25:  # Moderate kicks
            score += 0.15
        if 48 <= swing <= 55:  # Slight swing or straight
            score += 0.15
        genre_scores['pop'] = min(score, 1.0)

    # Hip Hop / Boom Bap: 85-115 BPM, swung
    if 80 <= bpm <= 120:
        score = 0.35
        if 52 <= swing <= 62:  # Swung timing
            score += 0.25
        if snare_ratio > 0.06:
            score += 0.15
        if kick_ratio > 0.06 and kick_ratio < 0.20:
            score += 0.15
        genre_scores['hip_hop'] = min(score, 1.0)

    # K-Pop: 100-140 BPM, high energy, varied patterns
    if 95 <= bpm <= 145:
        score = 0.3
        if kick_ratio > 0.12 and snare_ratio > 0.08:
            score += 0.2
        if clap_ratio > 0.05:
            score += 0.15
        genre_scores['kpop'] = min(score, 1.0)

    # Find best match
    if not genre_scores:
        return None, 0.0

    best_genre = max(genre_scores, key=genre_scores.get)
    best_confidence = genre_scores[best_genre]

    # Only return if confidence is above threshold
    if best_confidence < 0.5:
        return None, 0.0

    return best_genre, best_confidence


@app.post('/analyze-rhythm', response_model=RhythmAnalysisResult)
async def analyze_rhythm(
    audio: UploadFile = File(...),
    use_stem: bool = Form(True),  # Default to using stem separation for accuracy
    apply_pattern_filter: bool = Form(True),  # Filter hits to expected positions
    pattern_tolerance_ms: float = Form(100),  # Tolerance for pattern matching (ms)
):
    """
    Full rhythm analysis pipeline:
    1. (Optional) Separate drums stem for accurate analysis
    2. Beat/downbeat detection
    3. Onset detection per drum type
    4. Swing detection
    5. Genre detection
    6. Pattern-based filtering (removes false positives)
    """
    start_time = time.time()

    # Save uploaded file
    file_id = str(uuid.uuid4())[:8]
    temp_path = TEMP_DIR / f'{file_id}_{audio.filename}'
    drums_path = None
    stem_status = None

    try:
        # Write to temp file
        content = await audio.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        # Load original audio for beat detection (full mix is better for tempo)
        y_full, sr = load_audio(str(temp_path))
        duration = len(y_full) / sr

        logger.info(f'Analyzing {duration:.1f}s of audio...')

        # Stage 1: Beat detection from full mix (tempo detection works better on full mix)
        beat_result, method = detect_beats(str(temp_path), y_full, sr)

        # Stage 2: Optionally separate drums stem for accurate drum detection
        if use_stem:
            drums_path, stem_status = await separate_drums_stem(str(temp_path))
            logger.info(f'Stem separation result: {stem_status}')

        # Use drums stem if available, otherwise fall back to full mix
        if drums_path:
            y_drums, sr = load_audio(drums_path)
            logger.info('Using separated drums stem for detection')
            analysis_source = 'drums_stem'
        else:
            y_drums = y_full
            logger.info(f'Using full mix for detection ({stem_status or "stem separation disabled"})')
            analysis_source = 'full_mix'

        # Stage 3: Beat-aligned drum detection
        # This checks for drum energy AT beat positions (more reliable than free detection)
        logger.info('Stage 3: Beat-aligned drum detection...')
        beats_array = np.array(beat_result.beats)
        beat_aligned_hits = detect_drums_beat_aligned(
            y_drums, sr, beats_array, beat_result.time_signature
        )

        # Convert to DrumHit objects
        hits = []
        for drum_type, times in beat_aligned_hits.items():
            for t in times:
                confidence = 0.90 if drums_path else 0.70
                hits.append(DrumHit(
                    time=float(t),
                    type=drum_type,
                    confidence=confidence,
                    features=None
                ))

        # Sort by time
        hits.sort(key=lambda h: h.time)

        # Count by type for logging
        hit_counts = {}
        for h in hits:
            hit_counts[h.type] = hit_counts.get(h.type, 0) + 1

        logger.info(f'Detected {len(hits)} total hits: ' +
                   ', '.join(f'{k}={v}' for k, v in hit_counts.items()))

        # Stage 5: Swing detection
        swing = detect_swing(hits, beat_result.beats, beat_result.time_signature)

        # Stage 6: Genre detection
        detected_genre, genre_confidence = detect_genre(beat_result.bpm, hits, swing)

        # Stage 7: Pattern-based filtering (removes false positives)
        hits_before_filter = len(hits)
        pattern_filter_applied = False

        if apply_pattern_filter and beat_result.downbeats:
            logger.info(f'Stage 7: Applying pattern filter (genre={detected_genre}, tolerance={pattern_tolerance_ms}ms)...')
            downbeat_time = beat_result.downbeats[0]['time'] if beat_result.downbeats else 0
            hits = filter_hits_by_pattern(
                hits,
                bpm=beat_result.bpm,
                downbeat_time=downbeat_time,
                time_signature=beat_result.time_signature,
                genre=detected_genre,
                tolerance_ms=pattern_tolerance_ms
            )
            pattern_filter_applied = True
            logger.info(f'Pattern filter: {hits_before_filter} → {len(hits)} hits ({hits_before_filter - len(hits)} removed)')

        hits_after_filter = len(hits)

        elapsed = time.time() - start_time
        analysis_method = f'{method}+{analysis_source}'
        if pattern_filter_applied:
            analysis_method += '+pattern_filter'

        logger.info(f'Analysis complete in {elapsed:.2f}s using {analysis_method}')
        logger.info(f'Analysis source: {analysis_source}')
        if detected_genre:
            logger.info(f'Detected genre: {detected_genre} ({genre_confidence*100:.0f}% confidence)')
        logger.info(f'Final hits: {len([h for h in hits if h.type=="kick"])} kicks, '
                   f'{len([h for h in hits if h.type=="snare"])} snares, '
                   f'{len([h for h in hits if h.type=="clap"])} claps, '
                   f'{len([h for h in hits if h.type=="hihat"])} hihats')

        return RhythmAnalysisResult(
            bpm=beat_result.bpm,
            bpm_confidence=beat_result.bpm_confidence,
            beats=beat_result.beats,
            downbeats=beat_result.downbeats,
            time_signature=beat_result.time_signature,
            hits=[h.model_dump() for h in hits],
            swing=swing,
            analysis_method=analysis_method,
            duration=duration,
            analysis_source=analysis_source,
            detected_genre=detected_genre,
            genre_confidence=genre_confidence,
            pattern_filter_applied=pattern_filter_applied,
            hits_before_filter=hits_before_filter,
            hits_after_filter=hits_after_filter,
        )

    finally:
        # Cleanup
        if temp_path.exists():
            temp_path.unlink()
        if drums_path and Path(drums_path).exists():
            Path(drums_path).unlink()


@app.post('/detect-beats', response_model=BeatResult)
async def detect_beats_endpoint(audio: UploadFile = File(...)):
    """Detect BPM, beats, and downbeats only"""
    file_id = str(uuid.uuid4())[:8]
    temp_path = TEMP_DIR / f'{file_id}_{audio.filename}'

    try:
        content = await audio.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        y, sr = load_audio(str(temp_path))
        beat_result, method = detect_beats(str(temp_path), y, sr)

        return beat_result

    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.post('/classify-hits')
async def classify_hits_endpoint(
    audio: UploadFile = File(...),
    onset_times: str = Form(...)  # JSON array of onset times
):
    """Classify provided onset times as drum types"""
    import json

    file_id = str(uuid.uuid4())[:8]
    temp_path = TEMP_DIR / f'{file_id}_{audio.filename}'

    try:
        content = await audio.read()
        with open(temp_path, 'wb') as f:
            f.write(content)

        y, sr = load_audio(str(temp_path))

        # Parse onset times
        onsets = np.array(json.loads(onset_times))

        # Classify
        hits = classify_hits(y, sr, onsets)

        return {'hits': [h.model_dump() for h in hits]}

    finally:
        if temp_path.exists():
            temp_path.unlink()


@app.post('/quantize-grid', response_model=QuantizeResult)
async def quantize_grid_endpoint(request: QuantizeRequest):
    """Quantize hits to grid with swing awareness"""
    hits = [DrumHit(**h) for h in request.hits]

    quantized, positions = quantize_to_grid(
        hits=hits,
        bpm=request.bpm,
        downbeat_offset=request.downbeat_offset,
        swing=request.swing,
        quantize_strength=request.quantize_strength
    )

    return QuantizeResult(
        hits=quantized,
        grid_positions=positions
    )


@app.post('/quantize-instrument')
async def quantize_instrument_endpoint(request: QuantizeInstrumentRequest):
    """
    Quantize a single instrument's hits with specific settings.

    This allows per-instrument swing and quantization settings,
    enabling patterns like:
    - Straight kicks (50% swing, 100% quantize to 1/4)
    - Swung hi-hats (58% swing, 75% quantize to 1/16)
    """
    # Filter hits by drum type and convert to DrumHit objects
    instrument_hits = []
    for h in request.hits:
        if h.get('type') == request.drum_type:
            instrument_hits.append(DrumHit(
                time=h.get('time', 0),
                type=request.drum_type,
                confidence=h.get('confidence', 1.0),
                features=h.get('features')
            ))

    if not instrument_hits:
        return {
            'hits': [],
            'grid_positions': [],
            'drum_type': request.drum_type
        }

    quantized, positions = quantize_to_grid(
        hits=instrument_hits,
        bpm=request.bpm,
        downbeat_offset=request.downbeat_offset,
        swing=request.swing,
        quantize_strength=request.quantize_strength,
        subdivision=request.subdivision
    )

    return {
        'hits': [h.model_dump() for h in quantized],
        'grid_positions': positions,
        'drum_type': request.drum_type
    }


@app.post('/shift-downbeat')
async def shift_downbeat(
    beats: List[float],
    downbeats: List[Dict[str, Any]],
    shift_beats: int = 1
):
    """
    Shift downbeat position by N beats.
    Positive = shift forward, Negative = shift backward
    """
    if not downbeats:
        return {'downbeats': downbeats, 'shifted': 0}

    time_signature = max(d['beat_position'] for d in downbeats)

    new_downbeats = []
    for d in downbeats:
        new_position = ((d['beat_position'] - 1 + shift_beats) % time_signature) + 1
        new_downbeats.append({
            'time': d['time'],
            'beat_position': new_position
        })

    return {
        'downbeats': new_downbeats,
        'shifted': shift_beats,
        'time_signature': time_signature
    }


@app.get('/available-methods')
async def get_available_methods():
    """Return available analysis methods and their status"""
    return {
        'beat_detection': {
            'madmom': MADMOM_AVAILABLE,
            'librosa': True  # Always available
        },
        'onset_detection': {
            'madmom': MADMOM_AVAILABLE,
            'librosa': True
        },
        'classification': {
            'ml': SKLEARN_AVAILABLE and classifier is not None,
            'rules': True  # Always available
        }
    }


# =============================================================================
# Knowledge Lab Pattern Database
# Comprehensive patterns from Music Production Master Template
# =============================================================================

def parse_notation(notation: str) -> List[int]:
    """Parse notation string like 'X - - - X - - -' to step indices"""
    steps = notation.split(' ')
    return [i for i, s in enumerate(steps) if s.upper() in ['X', 'O']]


# Known drum patterns from Knowledge Lab
KNOWN_PATTERNS = {
    # === POP PATTERNS ===
    'pop_standard': {
        'name': 'Standard Pop Beat',
        'genre': 'pop',
        'description': 'Basic backbeat - most common pop pattern',
        'kick': [0, 8],           # Beats 1, 3
        'snare': [4, 12],         # Beats 2, 4
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],  # 8th notes
        'swing': 50
    },
    'pop_four_on_floor': {
        'name': 'Four-on-Floor Pop',
        'genre': 'pop',
        'description': 'Dance-pop with kick on every beat',
        'kick': [0, 4, 8, 12],    # Every beat
        'snare': [4, 12],         # Beats 2, 4
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 50
    },
    'pop_halftime': {
        'name': 'Halftime Pop',
        'genre': 'pop',
        'description': 'Half-time feel with snare on beat 3',
        'kick': [0],              # Beat 1 only
        'snare': [8],             # Beat 3 only
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 50
    },
    'pop_syncopated': {
        'name': 'Syncopated Pop',
        'genre': 'pop',
        'description': 'Complex rhythm with off-beat kicks',
        'kick': [0, 6, 10],       # Beat 1, + of 2, + of 3
        'snare': [4, 12],         # Beats 2, 4
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 52
    },

    # === EDM PATTERNS ===
    'edm_four_on_floor': {
        'name': 'EDM Four-on-Floor',
        'genre': 'edm',
        'description': 'Foundation of house, techno, EDM',
        'kick': [0, 4, 8, 12],    # Every beat
        'clap': [4, 12],          # Beats 2, 4
        'snare': [4, 12],         # Alternative to clap
        'hihat': [2, 6, 10, 14],  # Off-beats
        'swing': 0
    },
    'edm_offbeat_house': {
        'name': 'Offbeat House',
        'genre': 'edm',
        'description': 'Classic house with off-beat hi-hats',
        'kick': [0, 4, 8, 12],
        'clap': [4, 12],
        'snare': [4, 12],
        'hihat': [1, 3, 5, 7, 9, 11, 13, 15],  # Every off-beat 16th
        'swing': 0
    },
    'edm_techno': {
        'name': 'Techno Pattern',
        'genre': 'edm',
        'description': 'Driving techno groove',
        'kick': [0, 4, 8, 12],
        'clap': [4, 12],
        'snare': [4, 12],
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 0
    },
    'edm_dubstep': {
        'name': 'Dubstep Half-Time',
        'genre': 'edm',
        'description': 'Heavy half-time dubstep',
        'kick': [0],
        'snare': [8],
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 0
    },

    # === AFRO HOUSE PATTERNS ===
    'afro_foundation': {
        'name': 'Afro Foundation',
        'genre': 'afro_house',
        'description': 'Basic Afro house groove',
        'kick': [0, 8],           # Beats 1, 3
        'perc': [0, 2, 4, 6, 8, 10, 12, 14],  # Shaker on 8ths
        'swing': 60
    },
    'afro_minimal': {
        'name': 'Minimal Afro',
        'genre': 'afro_house',
        'description': 'Stripped down Afro groove',
        'kick': [0, 8],
        'perc': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 58
    },

    # === TRAP / HIP-HOP PATTERNS ===
    'trap_basic': {
        'name': 'Trap Beat',
        'genre': 'trap',
        'description': 'Modern trap pattern',
        'kick': [0, 10],          # Beat 1, before beat 4
        'snare': [8],             # Beat 3 (half-time)
        'hihat': list(range(16)), # Every 16th
        'swing': 0
    },
    'trap_rolling': {
        'name': 'Trap Rolling Hi-Hats',
        'genre': 'trap',
        'description': 'Trap with triplet hi-hats',
        'kick': [0, 6, 10],
        'snare': [8],
        'hihat': list(range(16)),
        'swing': 0
    },
    'hiphop_boom_bap': {
        'name': 'Boom Bap',
        'genre': 'hip_hop',
        'description': 'Classic hip-hop boom bap',
        'kick': [0, 5, 8, 10],    # Syncopated
        'snare': [4, 12],
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 55
    },

    # === K-POP PATTERNS ===
    'kpop_chorus': {
        'name': 'K-Pop Explosive Chorus',
        'genre': 'kpop',
        'description': 'High-energy K-pop chorus',
        'kick': [0, 4, 8, 12],
        'snare': [4, 12],
        'clap': [4, 12],
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 50
    },
    'kpop_verse': {
        'name': 'K-Pop Trap Verse',
        'genre': 'kpop',
        'description': 'Trap-influenced K-pop verse',
        'kick': [0, 11],
        'snare': [8],
        'hihat': list(range(16)),
        'swing': 0
    },

    # === SIMPLE 2-LINE PATTERNS (for partial detection) ===
    'simple_kick_snare': {
        'name': 'Basic Kick-Snare',
        'genre': 'general',
        'description': 'Simple kick and snare backbeat',
        'kick': [0, 8],
        'snare': [4, 12],
        'swing': 50
    },
    'simple_kick_clap': {
        'name': 'Basic Kick-Clap',
        'genre': 'general',
        'description': 'Simple kick and clap',
        'kick': [0, 4, 8, 12],
        'clap': [4, 12],
        'swing': 0
    },
    'simple_kick_hihat': {
        'name': 'Kick with Hi-Hats',
        'genre': 'general',
        'description': 'Kick on beats with 8th note hi-hats',
        'kick': [0, 8],
        'hihat': [0, 2, 4, 6, 8, 10, 12, 14],
        'swing': 50
    }
}


class PatternMatchRequest(BaseModel):
    """Request to match detected hits against known patterns"""
    hits: List[Dict[str, Any]]
    bpm: float
    downbeat_offset: float
    time_signature: int = 4


@app.post('/match-pattern')
async def match_pattern(request: PatternMatchRequest):
    """
    Match detected drum hits against known patterns from Knowledge Lab.

    Optimized for partial patterns (2-line detection).
    Returns similarity scores, best match, and suggestions.
    """
    beat_duration = 60.0 / request.bpm
    bar_duration = beat_duration * request.time_signature
    grid_duration = beat_duration / 4  # 16th note duration

    # Convert hits to grid positions (0-15 per bar)
    detected_grids = {
        'kick': set(),
        'snare': set(),
        'hihat': set(),
        'clap': set(),
        'tom': set(),
        'perc': set()
    }

    for hit in request.hits:
        hit_time = hit.get('time', 0)
        hit_type = hit.get('type', 'perc')

        # Calculate position in bar
        rel_time = hit_time - request.downbeat_offset
        if rel_time < 0:
            rel_time = 0
        bar_position = rel_time % bar_duration
        grid_step = int(round(bar_position / grid_duration)) % 16

        if hit_type in detected_grids:
            detected_grids[hit_type].add(grid_step)

    # Find which drum types were detected
    detected_types = [k for k, v in detected_grids.items() if len(v) > 0]
    logger.info(f'Detected drum types: {detected_types}')
    logger.info(f'Detected grids: {detected_grids}')

    # Compare against known patterns
    results = []
    for pattern_id, pattern in KNOWN_PATTERNS.items():
        scores = []
        matches_detail = {}
        missing_drums = []

        # Get drum types in this pattern
        pattern_drums = [k for k in ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc']
                        if k in pattern and isinstance(pattern[k], list)]

        # Calculate score only for drum types that are in BOTH detected AND pattern
        common_types = set(detected_types) & set(pattern_drums)

        if len(common_types) == 0:
            # No common drum types, skip this pattern
            continue

        for drum_type in common_types:
            expected = set(pattern[drum_type])
            detected = detected_grids.get(drum_type, set())

            if len(expected) > 0 and len(detected) > 0:
                # Calculate similarity using F1-like score
                # This is more forgiving than Jaccard for partial matches
                true_positives = len(expected & detected)
                precision = true_positives / len(detected) if len(detected) > 0 else 0
                recall = true_positives / len(expected) if len(expected) > 0 else 0

                if precision + recall > 0:
                    f1_score = 2 * (precision * recall) / (precision + recall)
                else:
                    f1_score = 0

                # Weight by importance
                weight = {'kick': 3.0, 'snare': 2.5, 'hihat': 1.0, 'clap': 2.5, 'tom': 1.5, 'perc': 1.0}.get(drum_type, 1)
                scores.append(f1_score * weight)

                matches_detail[drum_type] = {
                    'expected': list(expected),
                    'detected': list(detected),
                    'matched': list(expected & detected),
                    'score': round(f1_score * 100, 1)
                }

        # Calculate overall score
        if len(scores) > 0:
            overall_score = sum(scores) / len(scores)
        else:
            overall_score = 0

        # Bonus for matching more drum types
        coverage_bonus = len(common_types) / max(len(detected_types), 1) * 0.2
        overall_score = min(1.0, overall_score + coverage_bonus)

        # Find missing drums from pattern
        for drum_type in pattern_drums:
            if drum_type not in detected_types and drum_type in pattern:
                missing_drums.append({
                    'type': drum_type,
                    'expected_positions': pattern[drum_type]
                })

        results.append({
            'pattern_id': pattern_id,
            'pattern_name': pattern['name'],
            'genre': pattern.get('genre', 'unknown'),
            'description': pattern.get('description', ''),
            'score': round(overall_score * 100, 1),
            'matches': matches_detail,
            'missing_drums': missing_drums,
            'suggested_swing': pattern.get('swing', 50)
        })

    # Sort by score
    results.sort(key=lambda x: x['score'], reverse=True)

    # Get top 5 matches
    top_matches = results[:5]

    # Generate suggestions based on best match
    suggestions = []
    if top_matches:
        best = top_matches[0]
        if best['score'] < 50:
            suggestions.append('Detection confidence is low. Try using the Fix Grid panel to adjust BPM and downbeat.')
        if best['missing_drums']:
            missing_names = [d['type'] for d in best['missing_drums'][:2]]
            suggestions.append(f"Pattern suggests adding: {', '.join(missing_names)}")
        if abs(best['suggested_swing'] - 50) > 5:
            suggestions.append(f"This pattern typically uses {best['suggested_swing']}% swing")

    return {
        'matches': top_matches,
        'best_match': top_matches[0] if top_matches else None,
        'detected_pattern': {k: sorted(list(v)) for k, v in detected_grids.items() if v},
        'detected_types': detected_types,
        'suggestions': suggestions
    }


# =============================================================================
# Instrument & Vocal Frequency Bands
# =============================================================================

INSTRUMENT_FILTERS = {
    # === DRUMS (existing) ===
    'kick': (20, 250),
    'snare': (150, 2000),
    'hihat': (5000, 15000),
    'clap': (1000, 4000),
    'tom': (80, 500),
    'perc': (2000, 8000),

    # === BASS ===
    'sub_bass': (20, 80),        # 808s, sub synths
    'bass': (60, 250),           # Bass guitar, synth bass
    'bass_harmonics': (200, 600), # Bass upper harmonics

    # === MELODIC INSTRUMENTS ===
    'piano_low': (80, 400),      # Piano left hand
    'piano_mid': (250, 2000),    # Piano middle
    'piano_high': (2000, 5000),  # Piano right hand, brightness
    'guitar': (80, 1200),        # Acoustic/electric guitar body
    'guitar_bright': (2000, 5000), # Guitar presence/pick attack
    'synth_lead': (500, 8000),   # Lead synths, arps
    'synth_pad': (200, 4000),    # Pads, atmospheres
    'strings': (200, 4000),      # Orchestral strings
    'brass': (100, 3000),        # Horns, trumpets
    'pluck': (2000, 12000),      # Plucks, bells, bright synths

    # === VOCALS ===
    'vocal_low': (80, 300),      # Male chest voice, low harmonics
    'vocal_body': (200, 2000),   # Core vocal tone, lyrics clarity
    'vocal_presence': (2000, 5000),  # Vocal clarity, cut-through
    'vocal_air': (5000, 12000),  # Breathiness, air
    'sibilance': (5000, 9000),   # S, T, F, SH sounds
    'adlib': (200, 5000),        # Ad-libs, background vocals
    'harmony': (300, 4000),      # Vocal harmonies

    # === SOUND FX / TRANSITIONS ===
    'uplifter': (2000, 15000),   # White noise risers, upward sweeps
    'downlifter': (100, 10000),  # Downward sweeps, reverse risers
    'impact': (20, 2000),        # Hits, booms, thuds
    'sub_drop': (20, 100),       # Sub bass drops, 808 slides
    'reverse_crash': (3000, 15000),  # Reverse cymbals, crashes
    'white_noise': (1000, 15000),    # White noise sweeps, fills
    'swoosh': (1000, 8000),      # Wooshes, transitions
    'tape_stop': (50, 2000),     # Tape stop effects, slowdowns
    'stutter': (200, 8000),      # Glitch, stutter edits
    'vocal_chop': (300, 5000),   # Chopped vocal FX, one-shots
}

# Recommended energy thresholds for each type
INSTRUMENT_THRESHOLDS = {
    # Drums
    'kick': 0.008, 'snare': 0.006, 'hihat': 0.004,
    'clap': 0.005, 'tom': 0.006, 'perc': 0.003,
    # Bass
    'sub_bass': 0.010, 'bass': 0.008, 'bass_harmonics': 0.005,
    # Melodic
    'piano_low': 0.006, 'piano_mid': 0.005, 'piano_high': 0.004,
    'guitar': 0.005, 'guitar_bright': 0.004,
    'synth_lead': 0.004, 'synth_pad': 0.003, 'strings': 0.004,
    'brass': 0.005, 'pluck': 0.003,
    # Vocals
    'vocal_low': 0.006, 'vocal_body': 0.005, 'vocal_presence': 0.004,
    'vocal_air': 0.003, 'sibilance': 0.004,
    'adlib': 0.002,     # Very sensitive for quiet ad-libs
    'harmony': 0.003,   # Sensitive for background harmonies
    # Sound FX / Transitions
    'uplifter': 0.003,      # Detect subtle risers building before drops
    'downlifter': 0.004,    # Downward sweeps
    'impact': 0.008,        # Strong transients, similar to kicks
    'sub_drop': 0.010,      # Very low freq needs higher threshold
    'reverse_crash': 0.003, # Bright, sustained so lower threshold
    'white_noise': 0.002,   # Noise is spread across spectrum
    'swoosh': 0.003,        # Quick transitions
    'tape_stop': 0.005,     # More sustained effect
    'stutter': 0.002,       # Quick repeated hits
    'vocal_chop': 0.003,    # Short vocal stabs
}

# =============================================================================
# Dynamic EQ Configuration for Instrument Isolation
# =============================================================================
# Defines frequency shaping to isolate each instrument before detection
# Format: { 'instrument': { 'boost': [(freq, gain_db), ...], 'cut': [(freq, gain_db, q), ...] } }

DYNAMIC_EQ_PROFILES = {
    # === DRUMS ===
    'kick': {
        'boost': [(60, 6), (100, 4)],           # Boost sub and punch
        'cut': [(300, -6, 1.5), (5000, -12, 0.7)],  # Cut mids and highs
        'transient_enhance': True
    },
    'snare': {
        'boost': [(200, 4), (3000, 6)],         # Boost body and crack
        'cut': [(60, -12, 1.0), (8000, -6, 0.7)],  # Cut sub and air
        'transient_enhance': True
    },
    'hihat': {
        'boost': [(8000, 6), (12000, 4)],       # Boost shimmer
        'cut': [(200, -18, 0.7), (500, -12, 1.0)], # Heavy low cut
        'transient_enhance': False
    },
    'clap': {
        'boost': [(2000, 4), (4000, 3)],        # Boost upper mids
        'cut': [(100, -12, 1.0), (8000, -3, 0.7)],
        'transient_enhance': True
    },
    'tom': {
        'boost': [(100, 4), (300, 3)],          # Boost low-mids
        'cut': [(5000, -9, 0.7)],               # Cut highs
        'transient_enhance': True
    },
    'perc': {
        'boost': [(3000, 4), (6000, 3)],        # Boost presence
        'cut': [(100, -12, 1.0)],               # Cut lows
        'transient_enhance': True
    },

    # === BASS ===
    'sub_bass': {
        'boost': [(40, 6), (60, 4)],            # Boost sub frequencies
        'cut': [(200, -18, 0.7), (1000, -24, 0.5)],  # Heavy mid/high cut
        'transient_enhance': False
    },
    'bass': {
        'boost': [(80, 4), (150, 3)],           # Boost bass body
        'cut': [(40, -6, 1.0), (2000, -12, 0.7)],  # Cut sub rumble and highs
        'transient_enhance': True
    },
    'bass_harmonics': {
        'boost': [(300, 4), (500, 3)],          # Boost upper harmonics
        'cut': [(80, -12, 1.0), (2000, -6, 0.7)],
        'transient_enhance': False
    },

    # === MELODIC ===
    'piano_low': {
        'boost': [(150, 3), (300, 2)],
        'cut': [(60, -6, 1.0), (2000, -9, 0.7)],
        'transient_enhance': True
    },
    'piano_mid': {
        'boost': [(500, 3), (1000, 2)],
        'cut': [(100, -9, 1.0), (5000, -6, 0.7)],
        'transient_enhance': True
    },
    'piano_high': {
        'boost': [(3000, 4), (4000, 3)],
        'cut': [(200, -12, 1.0)],
        'transient_enhance': True
    },
    'guitar': {
        'boost': [(400, 3), (800, 2)],
        'cut': [(60, -9, 1.0), (5000, -6, 0.7)],
        'transient_enhance': True
    },
    'guitar_bright': {
        'boost': [(3000, 4), (4000, 3)],
        'cut': [(200, -12, 1.0)],
        'transient_enhance': True
    },
    'synth_lead': {
        'boost': [(2000, 3), (4000, 2)],
        'cut': [(100, -12, 1.0)],
        'transient_enhance': False
    },
    'synth_pad': {
        'boost': [(500, 2), (2000, 2)],
        'cut': [(60, -9, 1.0), (8000, -6, 0.7)],
        'transient_enhance': False
    },
    'strings': {
        'boost': [(800, 3), (2000, 2)],
        'cut': [(100, -9, 1.0), (8000, -6, 0.7)],
        'transient_enhance': False
    },
    'brass': {
        'boost': [(500, 3), (2000, 4)],
        'cut': [(60, -12, 1.0), (8000, -6, 0.7)],
        'transient_enhance': True
    },
    'pluck': {
        'boost': [(4000, 4), (8000, 3)],
        'cut': [(200, -12, 1.0)],
        'transient_enhance': True
    },

    # === VOCALS ===
    'vocal_low': {
        'boost': [(150, 3), (250, 2)],
        'cut': [(60, -9, 1.0), (2000, -12, 0.7)],
        'transient_enhance': False
    },
    'vocal_body': {
        'boost': [(800, 3), (1500, 2)],
        'cut': [(100, -9, 1.0), (6000, -6, 0.7)],
        'transient_enhance': False
    },
    'vocal_presence': {
        'boost': [(3000, 4), (4000, 3)],
        'cut': [(200, -12, 1.0), (8000, -3, 0.7)],
        'transient_enhance': False
    },
    'vocal_air': {
        'boost': [(8000, 4), (10000, 3)],
        'cut': [(500, -18, 0.7)],
        'transient_enhance': False
    },
    'sibilance': {
        'boost': [(6000, 4), (8000, 3)],
        'cut': [(300, -18, 0.7)],
        'transient_enhance': False
    },
    'adlib': {
        'boost': [(1500, 3), (3000, 2)],
        'cut': [(100, -9, 1.0), (8000, -6, 0.7)],
        'transient_enhance': False
    },
    'harmony': {
        'boost': [(800, 2), (2000, 2)],
        'cut': [(100, -9, 1.0), (6000, -6, 0.7)],
        'transient_enhance': False
    },

    # === SOUND FX ===
    'uplifter': {
        'boost': [(4000, 4), (8000, 3)],
        'cut': [(200, -12, 1.0)],
        'transient_enhance': False
    },
    'downlifter': {
        'boost': [(500, 3), (2000, 2)],
        'cut': [(60, -6, 1.0)],
        'transient_enhance': False
    },
    'impact': {
        'boost': [(60, 6), (200, 4)],
        'cut': [(5000, -12, 0.7)],
        'transient_enhance': True
    },
    'sub_drop': {
        'boost': [(40, 6), (60, 4)],
        'cut': [(200, -24, 0.5)],
        'transient_enhance': False
    },
    'reverse_crash': {
        'boost': [(6000, 4), (10000, 3)],
        'cut': [(300, -18, 0.7)],
        'transient_enhance': False
    },
    'white_noise': {
        'boost': [(4000, 3), (8000, 2)],
        'cut': [(200, -9, 1.0)],
        'transient_enhance': False
    },
    'swoosh': {
        'boost': [(2000, 3), (5000, 2)],
        'cut': [(200, -9, 1.0)],
        'transient_enhance': False
    },
    'tape_stop': {
        'boost': [(200, 3), (800, 2)],
        'cut': [(5000, -12, 0.7)],
        'transient_enhance': False
    },
    'stutter': {
        'boost': [(1000, 3), (4000, 2)],
        'cut': [(100, -9, 1.0)],
        'transient_enhance': True
    },
    'vocal_chop': {
        'boost': [(1500, 3), (3000, 2)],
        'cut': [(100, -12, 1.0), (8000, -6, 0.7)],
        'transient_enhance': True
    },
}


def apply_compressor(audio: np.ndarray, sr: int,
                     threshold_db: float = -20.0,
                     ratio: float = 4.0,
                     attack_ms: float = 10.0,
                     release_ms: float = 100.0,
                     makeup_db: float = 0.0) -> np.ndarray:
    """
    Apply dynamic range compression to audio.

    Args:
        audio: Audio signal (mono)
        sr: Sample rate
        threshold_db: Threshold in dB (signals above this get compressed)
        ratio: Compression ratio (4:1 means 4dB above threshold -> 1dB output)
        attack_ms: Attack time in milliseconds
        release_ms: Release time in milliseconds
        makeup_db: Makeup gain in dB

    Returns:
        Compressed audio signal
    """
    if len(audio) == 0:
        return audio

    # Convert to linear
    threshold = 10 ** (threshold_db / 20)
    makeup = 10 ** (makeup_db / 20)

    # Calculate envelope
    envelope = np.abs(audio)

    # Smooth envelope with attack/release
    attack_samples = int(sr * attack_ms / 1000)
    release_samples = int(sr * release_ms / 1000)

    # Simple envelope follower
    smooth_envelope = np.zeros_like(envelope)
    smooth_envelope[0] = envelope[0]

    for i in range(1, len(envelope)):
        if envelope[i] > smooth_envelope[i-1]:
            # Attack
            coeff = 1.0 - np.exp(-1.0 / max(1, attack_samples))
        else:
            # Release
            coeff = 1.0 - np.exp(-1.0 / max(1, release_samples))
        smooth_envelope[i] = smooth_envelope[i-1] + coeff * (envelope[i] - smooth_envelope[i-1])

    # Calculate gain reduction
    gain = np.ones_like(smooth_envelope)
    above_threshold = smooth_envelope > threshold

    if np.any(above_threshold):
        # How many dB above threshold
        db_above = 20 * np.log10(smooth_envelope[above_threshold] / threshold + 1e-10)
        # Compressed dB
        compressed_db = db_above / ratio
        # Gain reduction in linear
        gain[above_threshold] = 10 ** ((compressed_db - db_above) / 20)

    # Apply gain and makeup
    result = audio * gain * makeup

    # Soft clip to prevent harsh clipping
    result = np.tanh(result)

    return result


# Compression presets per instrument type
COMPRESSION_PRESETS = {
    # Drums - fast attack, medium release
    'kick': {'threshold_db': -12, 'ratio': 4.0, 'attack_ms': 5, 'release_ms': 80, 'makeup_db': 3},
    'snare': {'threshold_db': -15, 'ratio': 4.0, 'attack_ms': 3, 'release_ms': 60, 'makeup_db': 4},
    'hihat': {'threshold_db': -18, 'ratio': 3.0, 'attack_ms': 1, 'release_ms': 40, 'makeup_db': 2},
    'clap': {'threshold_db': -15, 'ratio': 3.5, 'attack_ms': 5, 'release_ms': 80, 'makeup_db': 3},
    'tom': {'threshold_db': -12, 'ratio': 4.0, 'attack_ms': 8, 'release_ms': 100, 'makeup_db': 3},
    'perc': {'threshold_db': -18, 'ratio': 3.0, 'attack_ms': 2, 'release_ms': 50, 'makeup_db': 4},

    # Bass - slow attack to preserve transients
    'sub_bass': {'threshold_db': -10, 'ratio': 6.0, 'attack_ms': 20, 'release_ms': 150, 'makeup_db': 2},
    'bass': {'threshold_db': -12, 'ratio': 4.0, 'attack_ms': 15, 'release_ms': 120, 'makeup_db': 3},
    'bass_harmonics': {'threshold_db': -15, 'ratio': 3.0, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 2},

    # Melodic - gentle compression
    'piano_low': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 15, 'release_ms': 150, 'makeup_db': 2},
    'piano_mid': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 10, 'release_ms': 120, 'makeup_db': 2},
    'piano_high': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 8, 'release_ms': 100, 'makeup_db': 2},
    'guitar': {'threshold_db': -15, 'ratio': 3.0, 'attack_ms': 12, 'release_ms': 120, 'makeup_db': 3},
    'guitar_bright': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 8, 'release_ms': 100, 'makeup_db': 2},
    'synth_lead': {'threshold_db': -15, 'ratio': 3.0, 'attack_ms': 5, 'release_ms': 80, 'makeup_db': 3},
    'synth_pad': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 30, 'release_ms': 200, 'makeup_db': 2},
    'strings': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 25, 'release_ms': 180, 'makeup_db': 2},
    'brass': {'threshold_db': -12, 'ratio': 4.0, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 4},
    'pluck': {'threshold_db': -18, 'ratio': 3.0, 'attack_ms': 1, 'release_ms': 50, 'makeup_db': 3},

    # Vocals - transparent compression
    'vocal_low': {'threshold_db': -18, 'ratio': 3.0, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 3},
    'vocal_body': {'threshold_db': -15, 'ratio': 3.5, 'attack_ms': 8, 'release_ms': 80, 'makeup_db': 4},
    'vocal_presence': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 5, 'release_ms': 60, 'makeup_db': 3},
    'vocal_air': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 3, 'release_ms': 50, 'makeup_db': 2},
    'sibilance': {'threshold_db': -15, 'ratio': 6.0, 'attack_ms': 1, 'release_ms': 30, 'makeup_db': 0},  # De-esser style
    'adlib': {'threshold_db': -15, 'ratio': 3.0, 'attack_ms': 8, 'release_ms': 80, 'makeup_db': 4},
    'harmony': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 3},

    # Sound FX - varies by type
    'uplifter': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 20, 'release_ms': 200, 'makeup_db': 2},
    'downlifter': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 15, 'release_ms': 150, 'makeup_db': 2},
    'impact': {'threshold_db': -10, 'ratio': 6.0, 'attack_ms': 1, 'release_ms': 50, 'makeup_db': 6},
    'sub_drop': {'threshold_db': -10, 'ratio': 6.0, 'attack_ms': 20, 'release_ms': 150, 'makeup_db': 3},
    'reverse_crash': {'threshold_db': -20, 'ratio': 2.0, 'attack_ms': 30, 'release_ms': 200, 'makeup_db': 2},
    'white_noise': {'threshold_db': -18, 'ratio': 3.0, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 3},
    'swoosh': {'threshold_db': -18, 'ratio': 2.5, 'attack_ms': 8, 'release_ms': 80, 'makeup_db': 3},
    'tape_stop': {'threshold_db': -15, 'ratio': 3.0, 'attack_ms': 10, 'release_ms': 100, 'makeup_db': 3},
    'stutter': {'threshold_db': -12, 'ratio': 4.0, 'attack_ms': 1, 'release_ms': 30, 'makeup_db': 4},
    'vocal_chop': {'threshold_db': -15, 'ratio': 3.5, 'attack_ms': 2, 'release_ms': 50, 'makeup_db': 4},
}


def remove_reverb_delay(audio: np.ndarray, sr: int,
                        reverb_reduction: float = 0.5,
                        delay_reduction: float = 0.5,
                        transient_preserve: float = 0.8) -> np.ndarray:
    """
    Remove reverb and delay from audio using spectral processing.

    Args:
        audio: Audio signal (mono)
        sr: Sample rate
        reverb_reduction: Amount of reverb to remove (0.0-1.0)
        delay_reduction: Amount of delay/echo to remove (0.0-1.0)
        transient_preserve: How much to preserve transients (0.0-1.0)

    Returns:
        Processed audio with reduced reverb/delay
    """
    if len(audio) == 0 or (reverb_reduction == 0 and delay_reduction == 0):
        return audio

    # FFT parameters
    n_fft = 2048
    hop_length = 512

    # Compute STFT
    stft = librosa.stft(audio, n_fft=n_fft, hop_length=hop_length)
    magnitude = np.abs(stft)
    phase = np.angle(stft)

    # === REVERB REDUCTION ===
    if reverb_reduction > 0:
        # Spectral gating: reduce energy in frames following transients
        # Calculate energy per frame
        frame_energy = np.sum(magnitude ** 2, axis=0)

        # Detect transients (sudden increases in energy)
        energy_diff = np.diff(frame_energy, prepend=frame_energy[0])
        transient_frames = energy_diff > (np.std(energy_diff) * 1.5)

        # Create decay mask - frames after transients get progressively reduced
        decay_mask = np.ones(magnitude.shape[1])
        decay_rate = 0.85 + (1 - reverb_reduction) * 0.14  # 0.85-0.99

        for i in range(1, len(decay_mask)):
            if transient_frames[i]:
                decay_mask[i] = 1.0  # Reset on transient
            else:
                decay_mask[i] = decay_mask[i-1] * decay_rate

        # Apply mask weighted by reduction amount
        reverb_mask = 1.0 - (1.0 - decay_mask) * reverb_reduction * (1 - transient_preserve)
        magnitude = magnitude * reverb_mask[np.newaxis, :]

    # === DELAY REDUCTION ===
    if delay_reduction > 0:
        # Use autocorrelation to find and reduce echoes
        # Look for periodic patterns in energy
        frame_energy = np.sum(magnitude ** 2, axis=0)

        if len(frame_energy) > 20:
            # Autocorrelation to find echo timing
            autocorr = np.correlate(frame_energy, frame_energy, mode='full')
            autocorr = autocorr[len(autocorr)//2:]  # Take positive lags

            # Find peaks (potential echo locations)
            # Skip first few frames (too close to be echo)
            min_delay_frames = 5
            if len(autocorr) > min_delay_frames * 2:
                autocorr[:min_delay_frames] = 0
                autocorr_norm = autocorr / (autocorr[0] + 1e-10)

                # Find significant peaks (echoes)
                from scipy.signal import find_peaks
                peaks, properties = find_peaks(autocorr_norm, height=0.1, distance=3)

                # Create echo suppression mask
                echo_mask = np.ones(magnitude.shape[1])

                for peak_idx in peaks[:3]:  # Process up to 3 echo peaks
                    if peak_idx < len(echo_mask):
                        # Reduce energy at echo positions
                        suppression = delay_reduction * 0.6
                        for i in range(peak_idx, len(echo_mask), peak_idx):
                            if i < len(echo_mask):
                                echo_mask[i] = max(0.2, echo_mask[i] - suppression)
                                # Also reduce surrounding frames slightly
                                if i > 0:
                                    echo_mask[i-1] = max(0.4, echo_mask[i-1] - suppression * 0.5)
                                if i < len(echo_mask) - 1:
                                    echo_mask[i+1] = max(0.4, echo_mask[i+1] - suppression * 0.5)

                magnitude = magnitude * echo_mask[np.newaxis, :]

    # === TRANSIENT ENHANCEMENT ===
    if transient_preserve > 0:
        # Boost transient frames that might have been affected
        frame_energy = np.sum(magnitude ** 2, axis=0)
        energy_diff = np.diff(frame_energy, prepend=frame_energy[0])
        transient_boost = np.clip(energy_diff / (np.std(energy_diff) + 1e-10), 0, 2)
        transient_mask = 1.0 + transient_boost * transient_preserve * 0.3
        magnitude = magnitude * transient_mask[np.newaxis, :]

    # Reconstruct audio
    stft_processed = magnitude * np.exp(1j * phase)
    result = librosa.istft(stft_processed, hop_length=hop_length, length=len(audio))

    # Normalize
    max_val = np.max(np.abs(result))
    if max_val > 1.0:
        result = result / max_val

    return result


# De-reverb/delay presets per instrument
DEREVERB_PRESETS = {
    # Drums - aggressive de-reverb, keep transients
    'kick': {'reverb_reduction': 0.7, 'delay_reduction': 0.5, 'transient_preserve': 0.9},
    'snare': {'reverb_reduction': 0.5, 'delay_reduction': 0.4, 'transient_preserve': 0.9},
    'hihat': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.8},
    'clap': {'reverb_reduction': 0.6, 'delay_reduction': 0.5, 'transient_preserve': 0.8},
    'tom': {'reverb_reduction': 0.5, 'delay_reduction': 0.4, 'transient_preserve': 0.9},
    'perc': {'reverb_reduction': 0.5, 'delay_reduction': 0.4, 'transient_preserve': 0.8},

    # Bass - less aggressive, preserve body
    'sub_bass': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.7},
    'bass': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.8},
    'bass_harmonics': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.7},

    # Melodic - moderate
    'piano_low': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.8},
    'piano_mid': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.8},
    'piano_high': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.7},
    'guitar': {'reverb_reduction': 0.4, 'delay_reduction': 0.4, 'transient_preserve': 0.8},
    'guitar_bright': {'reverb_reduction': 0.3, 'delay_reduction': 0.3, 'transient_preserve': 0.7},
    'synth_lead': {'reverb_reduction': 0.4, 'delay_reduction': 0.5, 'transient_preserve': 0.7},
    'synth_pad': {'reverb_reduction': 0.2, 'delay_reduction': 0.2, 'transient_preserve': 0.5},  # Pads often need reverb
    'strings': {'reverb_reduction': 0.2, 'delay_reduction': 0.2, 'transient_preserve': 0.5},
    'brass': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.8},
    'pluck': {'reverb_reduction': 0.5, 'delay_reduction': 0.4, 'transient_preserve': 0.8},

    # Vocals - careful processing
    'vocal_low': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.7},
    'vocal_body': {'reverb_reduction': 0.5, 'delay_reduction': 0.4, 'transient_preserve': 0.7},
    'vocal_presence': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.6},
    'vocal_air': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.5},
    'sibilance': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.6},
    'adlib': {'reverb_reduction': 0.5, 'delay_reduction': 0.5, 'transient_preserve': 0.7},  # Ad-libs often have heavy FX
    'harmony': {'reverb_reduction': 0.4, 'delay_reduction': 0.3, 'transient_preserve': 0.6},

    # Sound FX - varies
    'uplifter': {'reverb_reduction': 0.2, 'delay_reduction': 0.2, 'transient_preserve': 0.5},
    'downlifter': {'reverb_reduction': 0.2, 'delay_reduction': 0.2, 'transient_preserve': 0.5},
    'impact': {'reverb_reduction': 0.6, 'delay_reduction': 0.4, 'transient_preserve': 0.9},
    'sub_drop': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.7},
    'reverse_crash': {'reverb_reduction': 0.2, 'delay_reduction': 0.2, 'transient_preserve': 0.5},
    'white_noise': {'reverb_reduction': 0.3, 'delay_reduction': 0.3, 'transient_preserve': 0.5},
    'swoosh': {'reverb_reduction': 0.3, 'delay_reduction': 0.3, 'transient_preserve': 0.6},
    'tape_stop': {'reverb_reduction': 0.3, 'delay_reduction': 0.2, 'transient_preserve': 0.6},
    'stutter': {'reverb_reduction': 0.5, 'delay_reduction': 0.6, 'transient_preserve': 0.8},  # Stutter often has echo
    'vocal_chop': {'reverb_reduction': 0.5, 'delay_reduction': 0.5, 'transient_preserve': 0.8},
}


def apply_dynamic_eq(audio: np.ndarray, sr: int, instrument: str, strength: float = 1.0) -> np.ndarray:
    """
    Apply dynamic EQ shaping to isolate an instrument before detection.

    Args:
        audio: Audio signal (mono)
        sr: Sample rate
        instrument: Instrument type (must be in DYNAMIC_EQ_PROFILES)
        strength: EQ strength multiplier (0.0-2.0, default 1.0)

    Returns:
        Shaped audio signal
    """
    if instrument not in DYNAMIC_EQ_PROFILES:
        return audio

    profile = DYNAMIC_EQ_PROFILES[instrument]
    result = audio.copy()
    nyq = sr / 2

    # Apply boosts using peaking filters
    for freq, gain_db in profile.get('boost', []):
        if freq >= nyq:
            continue
        gain = gain_db * strength
        # Create peaking filter
        q = 1.5  # Moderate Q for boosts
        w0 = freq / nyq
        if w0 <= 0 or w0 >= 1:
            continue
        try:
            # Simple shelf-like boost using bandpass + mix
            sos = signal.butter(2, [max(0.01, w0 * 0.7), min(0.99, w0 * 1.3)], btype='band', output='sos')
            boosted = signal.sosfilt(sos, result)
            gain_linear = 10 ** (gain / 20) - 1
            result = result + boosted * gain_linear
        except:
            pass

    # Apply cuts using notch/shelf filters
    for cut_params in profile.get('cut', []):
        freq, gain_db, q = cut_params
        if freq >= nyq:
            continue
        gain = gain_db * strength
        w0 = freq / nyq
        if w0 <= 0 or w0 >= 1:
            continue
        try:
            if freq < 200:
                # High-pass for low frequency cuts
                sos = signal.butter(2, max(0.01, w0), btype='high', output='sos')
                cut_amount = 1.0 - 10 ** (gain / 20)
                filtered = signal.sosfilt(sos, result)
                result = result * (1 - cut_amount) + filtered * cut_amount
            else:
                # Notch-like cut using inverse bandpass
                sos = signal.butter(2, [max(0.01, w0 * 0.8), min(0.99, w0 * 1.2)], btype='band', output='sos')
                band_content = signal.sosfilt(sos, result)
                cut_linear = 1.0 - 10 ** (gain / 20)
                result = result - band_content * cut_linear
        except:
            pass

    # Apply transient enhancement if enabled
    if profile.get('transient_enhance', False):
        try:
            # Simple transient enhancement using envelope follower difference
            envelope = np.abs(signal.hilbert(result))
            # Smooth envelope
            smooth_env = signal.filtfilt(signal.butter(2, 50 / nyq, btype='low', output='sos'), envelope)
            # Fast envelope
            fast_env = signal.filtfilt(signal.butter(2, 500 / nyq, btype='low', output='sos'), envelope)
            # Transient = difference between fast and slow
            transient_boost = np.clip((fast_env - smooth_env) * 2 * strength, 0, 1)
            result = result * (1 + transient_boost * 0.5)
        except:
            pass

    # Normalize to prevent clipping
    max_val = np.max(np.abs(result))
    if max_val > 1.0:
        result = result / max_val

    return result


# =============================================================================
# Pattern-Based Quiet Hit Prediction
# =============================================================================

@app.post('/predict-quiet-hits')
async def predict_quiet_hits(
    file: UploadFile = File(...),
    hits: str = Form(...),
    bpm: float = Form(...),
    downbeat_offset: float = Form(0.0),
    audio_duration: float = Form(...),
    time_signature: int = Form(4),
    start_bar: Optional[int] = Form(1),  # Factory default: start from bar 1
    energy_multiplier: float = Form(0.5)  # Factory default: balanced sensitivity (raised from 0.3 per TICKET-024)
):
    """
    Pattern-based prediction for finding quiet percussion hits.
    Uses HPSS preprocessing + FREQUENCY-FILTERED detection for each drum type:
    - Kick: Low-pass 20-250Hz
    - Snare: Band-pass 150-2000Hz
    - Hi-hat: High-pass 5000-15000Hz
    - Perc: Band-pass 2000-8000Hz (wood blocks, claves, etc.)
    """
    # Parse hits from JSON string
    import json
    from scipy.signal import butter, sosfilt

    hits_list = json.loads(hits)

    logger.info(f'=== Frequency-Filtered Quiet Hit Prediction ===')
    logger.info(f'BPM: {bpm}, Duration: {audio_duration}s')
    logger.info(f'Existing hits: {len(hits_list)}')
    logger.info(f'Start bar: {start_bar}, Energy multiplier: {energy_multiplier}')

    # Use proper temp file handling for automatic cleanup
    temp_file = None
    temp_path = None
    try:
        # Create temp file with proper suffix
        suffix = Path(file.filename).suffix if file.filename else '.wav'
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=str(TEMP_DIR))
        temp_path = temp_file.name
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        # Load audio
        y, sr = librosa.load(temp_path, sr=44100, mono=True)

        # Apply HPSS to isolate percussive content first
        logger.info('Applying HPSS preprocessing for quiet hit detection...')
        y_perc = apply_hpss_preprocessing(y, sr)

        # =====================================================
        # Create frequency-filtered versions for each drum type
        # Using HPSS percussive output for cleaner detection
        # =====================================================
        def bandpass_filter(data, lowcut, highcut, fs, order=4):
            """Safe bandpass filter"""
            nyq = 0.5 * fs
            low = max(lowcut / nyq, 0.01)
            high = min(highcut / nyq, 0.99)
            if low >= high:
                return data
            try:
                sos = butter(order, [low, high], btype='band', output='sos')
                filtered = sosfilt(sos, data)
                if not np.isfinite(filtered).all():
                    return data
                return filtered
            except:
                return data

        # Frequency bands for each drum type
        DRUM_FILTERS = {
            'kick': (20, 250),      # Low frequencies for kick
            'snare': (150, 2000),   # Mid frequencies for snare body
            'hihat': (5000, 15000), # High frequencies for cymbals
            'clap': (1000, 4000),   # Upper-mids for claps
            'tom': (80, 500),       # Low-mids for toms
            'perc': (2000, 8000),   # Mid-highs for wood blocks, claves, etc.
        }

        filtered_audio = {}
        for drum_type, (low, high) in DRUM_FILTERS.items():
            # Use HPSS percussive output for cleaner detection
            filtered_audio[drum_type] = bandpass_filter(y_perc, low, min(high, sr/2 - 100), sr)
            logger.info(f'  Created {drum_type} filter: {low}-{high}Hz (HPSS enhanced)')

        # Calculate timing
        beat_duration = 60.0 / bpm
        bar_duration = beat_duration * time_signature
        grid_duration = beat_duration / 4  # 16th note
        total_bars = int(audio_duration / bar_duration)

        # First, match existing hits to patterns
        match_request = PatternMatchRequest(
            hits=hits_list,
            bpm=bpm,
            downbeat_offset=downbeat_offset,
            time_signature=time_signature
        )
        pattern_result = await match_pattern(match_request)

        best_match = pattern_result.get('best_match')
        detected_grids = pattern_result.get('detected_pattern', {})

        # Get expected positions for ALL drum types from pattern
        if not best_match:
            logger.warning('No pattern match found, using generic patterns')
            expected_positions = {
                'kick': [0, 8],                      # Beats 1, 3
                'snare': [4, 12],                    # Beats 2, 4
                'hihat': [0, 2, 4, 6, 8, 10, 12, 14], # 8th notes
                'perc': [0, 2, 4, 6, 8, 10, 12, 14],  # 8th notes
            }
        else:
            logger.info(f'Best pattern match: {best_match["pattern_name"]} ({best_match["score"]}%)')
            pattern = KNOWN_PATTERNS.get(best_match['pattern_id'], {})
            expected_positions = {
                'kick': pattern.get('kick', [0, 8]),
                'snare': pattern.get('snare', [4, 12]),
                'hihat': pattern.get('hihat', [0, 2, 4, 6, 8, 10, 12, 14]),
                'clap': pattern.get('clap', []),
                'tom': pattern.get('tom', []),
                'perc': pattern.get('perc', [0, 2, 4, 6, 8, 10, 12, 14]),
            }

        # Build set of existing hit positions per drum type
        existing_by_type = {dtype: set() for dtype in DRUM_FILTERS.keys()}
        existing_times = set()
        for hit in hits_list:
            hit_time = round(hit.get('time', 0), 3)
            hit_type = hit.get('type', 'perc')
            existing_times.add(hit_time)
            if hit_type in existing_by_type:
                existing_by_type[hit_type].add(hit_time)

        # Calculate which bars to scan
        start_bar_idx = start_bar - 1 if start_bar else 0

        # =====================================================
        # FREQUENCY-FILTERED DETECTION FOR EACH DRUM TYPE
        # =====================================================
        found_quiet_hits = []
        window_samples = int(sr * 0.06)  # 60ms window

        def get_window_energy(audio, time_sec, sr, window_samples):
            """Get RMS energy in a window around the given time"""
            center_sample = int(time_sec * sr)
            start = max(0, center_sample - window_samples // 2)
            end = min(len(audio), center_sample + window_samples // 2)
            if end <= start:
                return 0.0
            window = audio[start:end]
            return float(np.sqrt(np.mean(window ** 2)))

        # Energy thresholds for each drum type (adjusted for filtered signal)
        # Raised thresholds to reduce false positives (TICKET-024)
        # Combined with energy_multiplier=0.5 default, this reduces hits by ~33%
        ENERGY_THRESHOLDS = {
            'kick': 0.015 * energy_multiplier,    # Raised from 0.012
            'snare': 0.012 * energy_multiplier,   # Raised from 0.009
            'hihat': 0.008 * energy_multiplier,   # Raised from 0.006
            'clap': 0.010 * energy_multiplier,    # Raised from 0.008
            'tom': 0.012 * energy_multiplier,     # Raised from 0.009
            'perc': 0.007 * energy_multiplier,    # Raised from 0.005
        }

        logger.info(f'Scanning bars {start_bar_idx + 1} to {total_bars} for quiet hits...')

        # Scan each drum type separately using its filtered audio
        for drum_type, positions in expected_positions.items():
            if not positions or drum_type not in filtered_audio:
                continue

            filtered_y = filtered_audio[drum_type]
            threshold = ENERGY_THRESHOLDS.get(drum_type, 0.005)
            existing_for_type = existing_by_type.get(drum_type, set())

            logger.info(f'  Scanning {drum_type}: {len(positions)} positions/bar, threshold={threshold:.4f}')
            hits_found = 0

            for bar_idx in range(start_bar_idx, total_bars):
                bar_start_time = downbeat_offset + (bar_idx * bar_duration)

                for grid_pos in positions:
                    hit_time = bar_start_time + (grid_pos * grid_duration)

                    if hit_time < 0 or hit_time >= audio_duration:
                        continue

                    # Check if we already have a hit of THIS TYPE near this time
                    has_nearby_hit = any(
                        abs(existing_time - hit_time) < grid_duration * 0.4
                        for existing_time in existing_for_type
                    )

                    if has_nearby_hit:
                        continue

                    # Check energy in the FILTERED audio
                    energy = get_window_energy(filtered_y, hit_time, sr, window_samples)

                    if energy > threshold:
                        # Also check the full mix to get better classification
                        features = extract_hit_features(y, sr, hit_time, window_ms=60)
                        _, confidence = classify_hit_rules(features)

                        # Boost confidence for hits found in filtered band
                        confidence = max(confidence, 0.5)

                        found_quiet_hits.append({
                            'time': round(hit_time, 4),
                            'type': drum_type,
                            'confidence': round(confidence, 3),
                            'bar': bar_idx + 1,
                            'grid_position': grid_pos,
                            'source': f'filtered_{drum_type}',
                            'energy': round(energy, 5),
                            'filter_band': f'{DRUM_FILTERS[drum_type][0]}-{DRUM_FILTERS[drum_type][1]}Hz'
                        })
                        hits_found += 1

                        # Add to existing to avoid duplicates
                        existing_for_type.add(round(hit_time, 3))

            if hits_found > 0:
                logger.info(f'    Found {hits_found} quiet {drum_type} hits')

        logger.info(f'Total found: {len(found_quiet_hits)} quiet hits from filtered detection')

        # =====================================================
        # Additional: Low-energy onset scan on PERC band only
        # =====================================================
        additional_onsets = []
        if start_bar and 'perc' in filtered_audio:
            scan_start = downbeat_offset + ((start_bar - 1) * bar_duration)
            scan_end = audio_duration

            # Use perc-filtered audio for onset detection
            perc_y = filtered_audio['perc']
            onset_env = librosa.onset.onset_strength(y=perc_y, sr=sr)
            onset_frames = librosa.onset.onset_detect(
                onset_envelope=onset_env, sr=sr,
                pre_max=3, post_max=3, pre_avg=5, post_avg=5,
                delta=0.08 * energy_multiplier,  # Raised from 0.05 to further reduce false positives (TICKET-024)
                wait=int(sr * 0.04 / 512)        # Increased wait time between onsets
            )
            onset_times = librosa.frames_to_time(onset_frames, sr=sr)

            logger.info(f'  Perc band onset scan found {len(onset_times)} candidates')

            # Filter to our time range and exclude existing hits
            for onset_time in onset_times:
                if onset_time < scan_start or onset_time >= scan_end:
                    continue

                # Check if already detected (in any type)
                is_duplicate = any(abs(t - onset_time) < 0.05 for t in existing_times)

                # Check if already in found_quiet_hits
                if not is_duplicate:
                    is_duplicate = any(abs(qh['time'] - onset_time) < 0.05 for qh in found_quiet_hits)

                if not is_duplicate:
                    energy = get_window_energy(perc_y, onset_time, sr, window_samples)
                    if energy < ENERGY_THRESHOLDS['perc']:
                        continue

                    bar_num = int((onset_time - downbeat_offset) / bar_duration) + 1
                    grid_pos = int(((onset_time - downbeat_offset) % bar_duration) / grid_duration) % 16

                    additional_onsets.append({
                        'time': round(onset_time, 4),
                        'type': 'perc',
                        'confidence': 0.5,  # Default confidence for onset-detected hits
                        'bar': bar_num,
                        'grid_position': grid_pos,
                        'source': 'perc_band_onset',
                        'energy': round(energy, 5),
                        'filter_band': f'{DRUM_FILTERS["perc"][0]}-{DRUM_FILTERS["perc"][1]}Hz'
                    })

            logger.info(f'Found {len(additional_onsets)} additional onsets from low-threshold scan')

        # Combine all new hits
        all_new_hits = found_quiet_hits + additional_onsets

        # Sort by time
        all_new_hits.sort(key=lambda x: x['time'])

        # Calculate total expected positions scanned
        total_positions_scanned = sum(
            len(positions) * (total_bars - start_bar_idx)
            for positions in expected_positions.values()
            if positions
        )

        return {
            'success': True,
            'pattern_match': best_match,
            'positions_scanned': total_positions_scanned,
            'found_quiet_hits': found_quiet_hits,
            'additional_onsets': additional_onsets,
            'all_new_hits': all_new_hits,
            'total_new_hits': len(all_new_hits),
            'filter_bands': DRUM_FILTERS,
            'scan_config': {
                'start_bar': start_bar,
                'energy_multiplier': energy_multiplier,
                'total_bars': total_bars,
                'bars_scanned': total_bars - start_bar_idx
            }
        }

    except Exception as e:
        logger.error(f'Error in quiet hit prediction: {e}')
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        # Explicit garbage collection after processing large audio
        gc.collect()


# =============================================================================
# Instrument & Vocal Detection (Extended)
# =============================================================================

@app.post('/detect-instruments')
async def detect_instruments(
    file: UploadFile = File(...),
    instrument_types: str = Form('vocals'),  # Comma-separated: vocals,bass,piano,guitar,synth
    start_time: float = Form(0.0),
    end_time: Optional[float] = Form(None),
    energy_multiplier: float = Form(0.5),  # Factory default: balanced sensitivity (raised from 0.3 per TICKET-024)
    detect_stereo: bool = Form(True),  # Detect panned elements (ad-libs)
    # === ADVANCED PROCESSING OPTIONS ===
    use_dynamic_eq: bool = Form(True),        # Apply EQ shaping per instrument
    eq_strength: float = Form(1.0),           # EQ strength (0.0-2.0)
    use_compression: bool = Form(False),      # Apply compression per instrument
    use_dereverb: bool = Form(False),         # Remove reverb/delay
    dereverb_strength: float = Form(0.5),     # De-reverb strength (0.0-1.0)
):
    """
    Frequency-filtered detection for instruments and vocals.

    Supports: vocals, adlibs, bass, piano, guitar, synth, strings, brass, sound_fx

    Special features for vocals:
    - Stereo detection for panned ad-libs/background vocals
    - Multiple frequency bands (body, presence, air)
    - Sibilance detection for timing alignment

    Advanced Processing (optional):
    - Dynamic EQ: Boost target frequencies, cut competing frequencies
    - Compression: Bring up quiet elements, control dynamics
    - De-reverb/De-delay: Remove room ambience for cleaner detection
    """
    import json
    from scipy.signal import butter, sosfilt

    logger.info(f'=== Instrument Detection ===')
    logger.info(f'Types: {instrument_types}, Stereo: {detect_stereo}')

    # Parse requested instrument types
    requested_types = [t.strip().lower() for t in instrument_types.split(',')]

    # Map simple names to filter bands
    TYPE_MAPPING = {
        'vocals': ['vocal_body', 'vocal_presence', 'vocal_air'],
        'vocal': ['vocal_body', 'vocal_presence', 'vocal_air'],
        'adlibs': ['adlib'],
        'adlib': ['adlib'],
        'background': ['adlib', 'harmony'],
        'bgv': ['adlib', 'harmony'],
        'harmony': ['harmony'],
        'harmonies': ['harmony'],
        'bass': ['bass', 'sub_bass', 'bass_harmonics'],
        'piano': ['piano_low', 'piano_mid', 'piano_high'],
        'keys': ['piano_low', 'piano_mid', 'piano_high'],
        'guitar': ['guitar', 'guitar_bright'],
        'synth': ['synth_lead', 'synth_pad', 'pluck'],
        'lead': ['synth_lead', 'vocal_presence'],
        'pad': ['synth_pad', 'strings'],
        'strings': ['strings'],
        'brass': ['brass'],
        # Sound FX
        'sound_fx': ['uplifter', 'downlifter', 'impact', 'sub_drop', 'reverse_crash',
                     'white_noise', 'swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
        'fx': ['uplifter', 'downlifter', 'impact', 'sub_drop', 'reverse_crash',
               'white_noise', 'swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
        'risers': ['uplifter', 'reverse_crash', 'white_noise'],
        'drops': ['downlifter', 'impact', 'sub_drop'],
        'transitions': ['uplifter', 'downlifter', 'swoosh', 'reverse_crash', 'white_noise'],
        'impacts': ['impact', 'sub_drop'],
        'glitch': ['stutter', 'tape_stop', 'vocal_chop'],
        'all': list(INSTRUMENT_FILTERS.keys()),
    }

    # Expand requested types to filter bands
    filter_bands = set()
    for req_type in requested_types:
        if req_type in TYPE_MAPPING:
            filter_bands.update(TYPE_MAPPING[req_type])
        elif req_type in INSTRUMENT_FILTERS:
            filter_bands.add(req_type)

    if not filter_bands:
        return {'success': False, 'error': f'Unknown instrument types: {instrument_types}'}

    logger.info(f'Filter bands to scan: {filter_bands}')

    # Use proper temp file handling for automatic cleanup
    temp_file = None
    temp_path = None
    try:
        # Create temp file with proper suffix
        suffix = Path(file.filename).suffix if file.filename else '.wav'
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=str(TEMP_DIR))
        temp_path = temp_file.name
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        # Load audio - STEREO for panning detection
        if detect_stereo:
            y_stereo, sr = librosa.load(temp_path, sr=44100, mono=False)
            if y_stereo.ndim == 1:
                # Mono file, duplicate for stereo processing
                y_left = y_stereo
                y_right = y_stereo
                y_mono = y_stereo
            else:
                y_left = y_stereo[0]
                y_right = y_stereo[1]
                y_mono = librosa.to_mono(y_stereo)
        else:
            y_mono, sr = librosa.load(temp_path, sr=44100, mono=True)
            y_left = y_mono
            y_right = y_mono

        duration = len(y_mono) / sr
        if end_time is None or end_time > duration:
            end_time = duration

        logger.info(f'Audio loaded: {duration:.2f}s, scanning {start_time:.2f}s to {end_time:.2f}s')

        # Apply HPSS preprocessing
        # Harmonic component for melodic instruments (vocals, piano, synth, strings, bass)
        # Percussive component for drums and transients
        logger.info('Applying HPSS preprocessing for cleaner instrument detection...')
        D_mono = librosa.stft(y_mono)
        H_mono, P_mono = librosa.decompose.hpss(D_mono, margin=2.0)
        y_harmonic = librosa.istft(H_mono, length=len(y_mono))
        y_percussive = librosa.istft(P_mono, length=len(y_mono))

        # Normalize
        if np.max(np.abs(y_harmonic)) > 0:
            y_harmonic = y_harmonic / np.max(np.abs(y_harmonic))
        if np.max(np.abs(y_percussive)) > 0:
            y_percussive = y_percussive / np.max(np.abs(y_percussive))

        logger.info(f'HPSS complete: harmonic RMS={np.sqrt(np.mean(y_harmonic**2)):.4f}, percussive RMS={np.sqrt(np.mean(y_percussive**2)):.4f}')

        # Define which instruments use harmonic vs percussive
        PERCUSSIVE_INSTRUMENTS = {'kick', 'snare', 'hihat', 'clap', 'tom', 'perc',
                                   'impact', 'stutter', 'reverse_crash'}

        # Bandpass filter function
        def bandpass_filter(data, lowcut, highcut, fs, order=4):
            nyq = 0.5 * fs
            low = max(lowcut / nyq, 0.01)
            high = min(highcut / nyq, 0.99)
            if low >= high:
                return data
            try:
                sos = butter(order, [low, high], btype='band', output='sos')
                filtered = sosfilt(sos, data)
                if not np.isfinite(filtered).all():
                    return data
                return filtered
            except:
                return data

        # Create filtered audio for each band with advanced processing
        filtered_mono = {}
        filtered_left = {}
        filtered_right = {}

        logger.info(f'Advanced processing: EQ={use_dynamic_eq}, Comp={use_compression}, DeReverb={use_dereverb}')

        for band_name in filter_bands:
            if band_name not in INSTRUMENT_FILTERS:
                continue
            low, high = INSTRUMENT_FILTERS[band_name]

            # Step 1: Select HPSS component based on instrument type
            # Percussive: drums, impacts, transients
            # Harmonic: vocals, bass, piano, synth, strings
            if band_name in PERCUSSIVE_INSTRUMENTS:
                y_source = y_percussive
                logger.debug(f'{band_name}: using percussive component')
            else:
                y_source = y_harmonic
                logger.debug(f'{band_name}: using harmonic component')

            # Step 2: Bandpass filter on HPSS component
            y_band = bandpass_filter(y_source, low, min(high, sr/2 - 100), sr)

            # Step 2: De-reverb/De-delay (before other processing for cleaner signal)
            if use_dereverb and band_name in DEREVERB_PRESETS:
                preset = DEREVERB_PRESETS[band_name]
                y_band = remove_reverb_delay(
                    y_band, sr,
                    reverb_reduction=preset['reverb_reduction'] * dereverb_strength,
                    delay_reduction=preset['delay_reduction'] * dereverb_strength,
                    transient_preserve=preset['transient_preserve']
                )

            # Step 3: Dynamic EQ (boost target, cut competing frequencies)
            if use_dynamic_eq and band_name in DYNAMIC_EQ_PROFILES:
                y_band = apply_dynamic_eq(y_band, sr, band_name, strength=eq_strength)

            # Step 4: Compression (bring up quiet elements)
            if use_compression and band_name in COMPRESSION_PRESETS:
                preset = COMPRESSION_PRESETS[band_name]
                y_band = apply_compressor(
                    y_band, sr,
                    threshold_db=preset['threshold_db'],
                    ratio=preset['ratio'],
                    attack_ms=preset['attack_ms'],
                    release_ms=preset['release_ms'],
                    makeup_db=preset['makeup_db']
                )

            filtered_mono[band_name] = y_band

            # Process stereo channels too
            if detect_stereo:
                y_band_left = bandpass_filter(y_left, low, min(high, sr/2 - 100), sr)
                y_band_right = bandpass_filter(y_right, low, min(high, sr/2 - 100), sr)

                if use_dereverb and band_name in DEREVERB_PRESETS:
                    preset = DEREVERB_PRESETS[band_name]
                    y_band_left = remove_reverb_delay(
                        y_band_left, sr,
                        reverb_reduction=preset['reverb_reduction'] * dereverb_strength,
                        delay_reduction=preset['delay_reduction'] * dereverb_strength,
                        transient_preserve=preset['transient_preserve']
                    )
                    y_band_right = remove_reverb_delay(
                        y_band_right, sr,
                        reverb_reduction=preset['reverb_reduction'] * dereverb_strength,
                        delay_reduction=preset['delay_reduction'] * dereverb_strength,
                        transient_preserve=preset['transient_preserve']
                    )

                if use_dynamic_eq and band_name in DYNAMIC_EQ_PROFILES:
                    y_band_left = apply_dynamic_eq(y_band_left, sr, band_name, strength=eq_strength)
                    y_band_right = apply_dynamic_eq(y_band_right, sr, band_name, strength=eq_strength)

                if use_compression and band_name in COMPRESSION_PRESETS:
                    preset = COMPRESSION_PRESETS[band_name]
                    y_band_left = apply_compressor(y_band_left, sr, **preset)
                    y_band_right = apply_compressor(y_band_right, sr, **preset)

                filtered_left[band_name] = y_band_left
                filtered_right[band_name] = y_band_right

        # Detect onsets in each band
        results = {}
        window_samples = int(sr * 0.05)  # 50ms window

        def get_rms(audio, start_sample, end_sample):
            segment = audio[max(0, start_sample):min(len(audio), end_sample)]
            if len(segment) == 0:
                return 0.0
            return float(np.sqrt(np.mean(segment ** 2)))

        def get_stereo_position(left_audio, right_audio, start_sample, end_sample):
            """Calculate stereo position: -1 (left) to +1 (right), 0 = center"""
            left_rms = get_rms(left_audio, start_sample, end_sample)
            right_rms = get_rms(right_audio, start_sample, end_sample)
            total = left_rms + right_rms
            if total < 0.0001:
                return 0.0
            return (right_rms - left_rms) / total

        for band_name in filter_bands:
            if band_name not in filtered_mono:
                continue

            y_filtered = filtered_mono[band_name]
            threshold = INSTRUMENT_THRESHOLDS.get(band_name, 0.005) * energy_multiplier

            # Detect onsets using librosa
            onset_env = librosa.onset.onset_strength(y=y_filtered, sr=sr)
            onset_frames = librosa.onset.onset_detect(
                onset_envelope=onset_env, sr=sr,
                pre_max=3, post_max=3, pre_avg=5, post_avg=5,
                delta=0.03 * energy_multiplier,
                wait=int(sr * 0.05 / 512)  # Min 50ms between onsets
            )
            onset_times = librosa.frames_to_time(onset_frames, sr=sr)

            # Filter to time range and collect details
            band_results = []
            for onset_time in onset_times:
                if onset_time < start_time or onset_time > end_time:
                    continue

                center_sample = int(onset_time * sr)
                start_sample = center_sample - window_samples // 2
                end_sample = center_sample + window_samples // 2

                energy = get_rms(y_filtered, start_sample, end_sample)

                if energy < threshold:
                    continue

                hit = {
                    'time': round(onset_time, 4),
                    'energy': round(energy, 5),
                    'band': band_name,
                    'filter_range': f'{INSTRUMENT_FILTERS[band_name][0]}-{INSTRUMENT_FILTERS[band_name][1]}Hz',
                }

                # Add stereo position for ad-libs/background vocals
                if detect_stereo and band_name in ['adlib', 'harmony', 'vocal_body', 'vocal_presence']:
                    stereo_pos = get_stereo_position(
                        filtered_left.get(band_name, y_left),
                        filtered_right.get(band_name, y_right),
                        start_sample, end_sample
                    )
                    hit['stereo_position'] = round(stereo_pos, 3)
                    hit['pan'] = 'left' if stereo_pos < -0.2 else ('right' if stereo_pos > 0.2 else 'center')

                    # Flag potential ad-libs (panned, lower energy than main vocal)
                    if band_name in ['adlib', 'harmony'] and abs(stereo_pos) > 0.15:
                        hit['likely_adlib'] = True

                band_results.append(hit)

            results[band_name] = band_results
            logger.info(f'  {band_name}: {len(band_results)} detections')

        # Combine vocal bands into unified vocal timeline
        vocal_bands = ['vocal_body', 'vocal_presence', 'vocal_air', 'sibilance']
        adlib_bands = ['adlib', 'harmony']

        all_vocals = []
        all_adlibs = []

        for band in vocal_bands:
            if band in results:
                for hit in results[band]:
                    hit['type'] = 'vocal'
                    all_vocals.append(hit)

        for band in adlib_bands:
            if band in results:
                for hit in results[band]:
                    hit['type'] = 'adlib' if hit.get('likely_adlib') else 'background_vocal'
                    all_adlibs.append(hit)

        # Sort by time
        all_vocals.sort(key=lambda x: x['time'])
        all_adlibs.sort(key=lambda x: x['time'])

        # Deduplicate nearby detections (within 50ms)
        def deduplicate(hits, window=0.05):
            if not hits:
                return []
            deduped = [hits[0]]
            for hit in hits[1:]:
                if hit['time'] - deduped[-1]['time'] > window:
                    deduped.append(hit)
                elif hit['energy'] > deduped[-1]['energy']:
                    deduped[-1] = hit
            return deduped

        all_vocals = deduplicate(all_vocals)
        all_adlibs = deduplicate(all_adlibs)

        return {
            'success': True,
            'duration': duration,
            'scan_range': {'start': start_time, 'end': end_time},
            'filter_bands_used': list(filter_bands),
            'results_by_band': results,
            'vocals': all_vocals,
            'adlibs': all_adlibs,
            'total_vocal_hits': len(all_vocals),
            'total_adlib_hits': len(all_adlibs),
            'settings': {
                'energy_multiplier': energy_multiplier,
                'stereo_detection': detect_stereo,
            }
        }

    except Exception as e:
        logger.error(f'Error in instrument detection: {e}')
        import traceback
        traceback.print_exc()
        return {'success': False, 'error': str(e)}
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        # Explicit garbage collection after processing large audio
        gc.collect()


@app.get('/instrument-filters')
async def get_instrument_filters():
    """Get all available instrument filter bands, thresholds, and processing presets"""
    return {
        'filters': INSTRUMENT_FILTERS,
        'thresholds': INSTRUMENT_THRESHOLDS,
        'categories': {
            'drums': ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'],
            'bass': ['sub_bass', 'bass', 'bass_harmonics'],
            'melodic': ['piano_low', 'piano_mid', 'piano_high', 'guitar', 'guitar_bright',
                       'synth_lead', 'synth_pad', 'strings', 'brass', 'pluck'],
            'vocals': ['vocal_low', 'vocal_body', 'vocal_presence', 'vocal_air', 'sibilance'],
            'background_vocals': ['adlib', 'harmony'],
            'sound_fx': ['uplifter', 'downlifter', 'impact', 'sub_drop', 'reverse_crash',
                        'white_noise', 'swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
        },
        # Advanced processing presets
        'processing': {
            'dynamic_eq': DYNAMIC_EQ_PROFILES,
            'compression': COMPRESSION_PRESETS,
            'dereverb': DEREVERB_PRESETS,
        },
        # Processing options documentation
        'processing_options': {
            'use_dynamic_eq': 'Boost target frequencies, cut competing frequencies (default: True)',
            'eq_strength': 'EQ strength multiplier 0.0-2.0 (default: 1.0)',
            'use_compression': 'Apply compression to bring up quiet elements (default: False)',
            'use_dereverb': 'Remove reverb/delay for cleaner detection (default: False)',
            'dereverb_strength': 'De-reverb strength 0.0-1.0 (default: 0.5)',
        }
    }


# =============================================================================
# Self-Validation Tests
# =============================================================================

@app.get('/self-test')
async def run_self_tests():
    """
    Run self-validation tests for all detection features.
    Generates synthetic test signals and validates detection accuracy.
    """
    results = {
        'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
        'tests': [],
        'summary': {'passed': 0, 'failed': 0, 'warnings': 0}
    }

    sr = 44100  # Sample rate
    duration = 2.0  # Test duration in seconds
    samples = int(sr * duration)

    def add_result(name, passed, message, warning=False):
        status = 'passed' if passed else ('warning' if warning else 'failed')
        results['tests'].append({
            'name': name,
            'status': status,
            'message': message
        })
        if passed:
            results['summary']['passed'] += 1
        elif warning:
            results['summary']['warnings'] += 1
        else:
            results['summary']['failed'] += 1

    # === TEST 1: Bandpass Filter ===
    try:
        from scipy.signal import butter, sosfilt
        test_signal = np.random.randn(samples) * 0.1
        nyq = sr / 2
        sos = butter(4, [100/nyq, 1000/nyq], btype='band', output='sos')
        filtered = sosfilt(sos, test_signal)
        if np.isfinite(filtered).all() and len(filtered) == samples:
            add_result('Bandpass Filter', True, 'Filter produces valid output')
        else:
            add_result('Bandpass Filter', False, 'Filter output invalid')
    except Exception as e:
        add_result('Bandpass Filter', False, f'Error: {str(e)}')

    # === TEST 2: Dynamic EQ ===
    try:
        test_signal = np.sin(2 * np.pi * 100 * np.arange(samples) / sr) * 0.5
        eq_result = apply_dynamic_eq(test_signal, sr, 'kick', strength=1.0)
        if np.isfinite(eq_result).all() and len(eq_result) == samples:
            add_result('Dynamic EQ', True, 'EQ processing successful')
        else:
            add_result('Dynamic EQ', False, 'EQ output invalid')
    except Exception as e:
        add_result('Dynamic EQ', False, f'Error: {str(e)}')

    # === TEST 3: Compressor ===
    try:
        test_signal = np.sin(2 * np.pi * 440 * np.arange(samples) / sr) * 0.8
        comp_result = apply_compressor(test_signal, sr, threshold_db=-12, ratio=4.0)
        if np.isfinite(comp_result).all() and np.max(np.abs(comp_result)) <= 1.0:
            add_result('Compressor', True, 'Compression successful')
        else:
            add_result('Compressor', False, 'Compressor output invalid')
    except Exception as e:
        add_result('Compressor', False, f'Error: {str(e)}')

    # === TEST 4: De-reverb ===
    try:
        test_signal = np.random.randn(samples) * 0.3
        dereverb_result = remove_reverb_delay(test_signal, sr, reverb_reduction=0.5)
        if np.isfinite(dereverb_result).all() and len(dereverb_result) == samples:
            add_result('De-reverb', True, 'De-reverb processing successful')
        else:
            add_result('De-reverb', False, 'De-reverb output invalid')
    except Exception as e:
        add_result('De-reverb', False, f'Error: {str(e)}')

    # === TEST 5: Onset Detection ===
    try:
        # Create test signal with clear onsets (clicks)
        test_signal = np.zeros(samples)
        onset_times = [0.2, 0.5, 0.8, 1.2, 1.5, 1.8]
        for t in onset_times:
            idx = int(t * sr)
            if idx < samples - 100:
                test_signal[idx:idx+100] = np.sin(np.linspace(0, np.pi, 100)) * 0.8

        onset_env = librosa.onset.onset_strength(y=test_signal, sr=sr)
        detected = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        detected_times = librosa.frames_to_time(detected, sr=sr)

        if len(detected_times) >= 3:
            add_result('Onset Detection', True, f'Detected {len(detected_times)} onsets')
        else:
            add_result('Onset Detection', False, f'Only detected {len(detected_times)} onsets (expected 6)', warning=True)
    except Exception as e:
        add_result('Onset Detection', False, f'Error: {str(e)}')

    # === TEST 6: Instrument Filters Configuration ===
    try:
        missing = []
        for instrument in INSTRUMENT_FILTERS.keys():
            if instrument not in INSTRUMENT_THRESHOLDS:
                missing.append(f'{instrument} (threshold)')
            if instrument not in DYNAMIC_EQ_PROFILES:
                missing.append(f'{instrument} (EQ)')
            if instrument not in COMPRESSION_PRESETS:
                missing.append(f'{instrument} (compression)')
            if instrument not in DEREVERB_PRESETS:
                missing.append(f'{instrument} (dereverb)')

        if not missing:
            add_result('Instrument Config', True, f'All {len(INSTRUMENT_FILTERS)} instruments configured')
        else:
            add_result('Instrument Config', False, f'Missing: {", ".join(missing[:5])}...', warning=True)
    except Exception as e:
        add_result('Instrument Config', False, f'Error: {str(e)}')

    # === TEST 7: Frequency Band Validation ===
    try:
        errors = []
        for name, (low, high) in INSTRUMENT_FILTERS.items():
            if low >= high:
                errors.append(f'{name}: low >= high')
            if low < 20:
                errors.append(f'{name}: low < 20Hz')
            if high > 20000:
                errors.append(f'{name}: high > 20kHz')

        if not errors:
            add_result('Frequency Bands', True, 'All frequency bands valid')
        else:
            add_result('Frequency Bands', False, f'Errors: {", ".join(errors[:3])}')
    except Exception as e:
        add_result('Frequency Bands', False, f'Error: {str(e)}')

    # === TEST 8: Category Mapping ===
    try:
        all_instruments = set(INSTRUMENT_FILTERS.keys())
        categories = ['drums', 'bass', 'melodic', 'vocals', 'background_vocals', 'sound_fx']
        categorized = set()

        cat_map = {
            'drums': ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'],
            'bass': ['sub_bass', 'bass', 'bass_harmonics'],
            'melodic': ['piano_low', 'piano_mid', 'piano_high', 'guitar', 'guitar_bright',
                       'synth_lead', 'synth_pad', 'strings', 'brass', 'pluck'],
            'vocals': ['vocal_low', 'vocal_body', 'vocal_presence', 'vocal_air', 'sibilance'],
            'background_vocals': ['adlib', 'harmony'],
            'sound_fx': ['uplifter', 'downlifter', 'impact', 'sub_drop', 'reverse_crash',
                        'white_noise', 'swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
        }
        for cat, instruments in cat_map.items():
            categorized.update(instruments)

        uncategorized = all_instruments - categorized
        if not uncategorized:
            add_result('Category Mapping', True, f'All instruments categorized ({len(all_instruments)} total)')
        else:
            add_result('Category Mapping', False, f'Uncategorized: {uncategorized}', warning=True)
    except Exception as e:
        add_result('Category Mapping', False, f'Error: {str(e)}')

    # === TEST 9: Librosa Availability ===
    try:
        test_audio = np.random.randn(sr) * 0.1
        tempo, beats = librosa.beat.beat_track(y=test_audio, sr=sr)
        add_result('Librosa Beat Track', True, 'Beat tracking functional')
    except Exception as e:
        add_result('Librosa Beat Track', False, f'Error: {str(e)}')

    # === TEST 10: Memory/Performance ===
    try:
        import sys
        test_large = np.random.randn(sr * 10)  # 10 seconds of audio
        size_mb = sys.getsizeof(test_large) / 1024 / 1024
        del test_large
        add_result('Memory Handling', True, f'Can handle 10s audio ({size_mb:.1f}MB)')
    except Exception as e:
        add_result('Memory Handling', False, f'Error: {str(e)}')

    # Calculate overall status
    total = results['summary']['passed'] + results['summary']['failed'] + results['summary']['warnings']
    results['summary']['total'] = total
    results['summary']['pass_rate'] = f"{(results['summary']['passed'] / total * 100):.1f}%" if total > 0 else '0%'
    results['summary']['status'] = 'PASS' if results['summary']['failed'] == 0 else 'FAIL'

    return results


@app.get('/validate-detection/{instrument}')
async def validate_single_instrument(instrument: str):
    """
    Validate detection for a specific instrument type using synthetic test signal.
    """
    if instrument not in INSTRUMENT_FILTERS:
        return {'success': False, 'error': f'Unknown instrument: {instrument}'}

    sr = 44100
    duration = 3.0
    samples = int(sr * duration)

    low, high = INSTRUMENT_FILTERS[instrument]
    center_freq = (low + high) / 2

    # Generate test signal at instrument's frequency range
    t = np.arange(samples) / sr

    # Create signal with harmonics
    signal = np.sin(2 * np.pi * center_freq * t) * 0.5
    if center_freq * 2 < sr / 2:
        signal += np.sin(2 * np.pi * center_freq * 2 * t) * 0.25
    if center_freq * 3 < sr / 2:
        signal += np.sin(2 * np.pi * center_freq * 3 * t) * 0.125

    # Add transients at known times
    onset_times = [0.5, 1.0, 1.5, 2.0, 2.5]
    for ot in onset_times:
        idx = int(ot * sr)
        if idx < samples - 1000:
            envelope = np.exp(-np.arange(1000) / 200)
            signal[idx:idx+1000] *= (1 + envelope * 2)

    # Apply full processing chain
    try:
        # Bandpass filter
        from scipy.signal import butter, sosfilt
        nyq = sr / 2
        sos = butter(4, [max(0.01, low/nyq), min(0.99, high/nyq)], btype='band', output='sos')
        filtered = sosfilt(sos, signal)

        # Dynamic EQ
        if instrument in DYNAMIC_EQ_PROFILES:
            filtered = apply_dynamic_eq(filtered, sr, instrument)

        # Compression
        if instrument in COMPRESSION_PRESETS:
            preset = COMPRESSION_PRESETS[instrument]
            filtered = apply_compressor(filtered, sr, **preset)

        # Detect onsets
        onset_env = librosa.onset.onset_strength(y=filtered, sr=sr)
        detected = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
        detected_times = librosa.frames_to_time(detected, sr=sr)

        # Validate detection accuracy
        tolerance = 0.1  # 100ms tolerance
        matched = 0
        for expected in onset_times:
            for detected_t in detected_times:
                if abs(expected - detected_t) < tolerance:
                    matched += 1
                    break

        accuracy = matched / len(onset_times) * 100 if onset_times else 0

        return {
            'success': True,
            'instrument': instrument,
            'frequency_range': f'{low}-{high}Hz',
            'test_onsets': len(onset_times),
            'detected_onsets': len(detected_times),
            'matched_onsets': matched,
            'accuracy': f'{accuracy:.1f}%',
            'status': 'PASS' if accuracy >= 60 else 'FAIL',
            'processing_applied': {
                'bandpass': True,
                'dynamic_eq': instrument in DYNAMIC_EQ_PROFILES,
                'compression': instrument in COMPRESSION_PRESETS,
            }
        }
    except Exception as e:
        return {
            'success': False,
            'instrument': instrument,
            'error': str(e)
        }


# =============================================================================
# Reverb/Delay Analysis
# =============================================================================

@app.post('/analyze-reverb-delay')
async def analyze_reverb_delay(
    file: UploadFile = File(...),
    start_time: float = Form(0.0),
    end_time: Optional[float] = Form(None),
    analyze_sections: bool = Form(True),  # Analyze multiple sections
    section_length: float = Form(4.0),    # Seconds per section
):
    """
    Analyze audio to estimate reverb and delay characteristics.

    Uses stereo analysis and timing patterns to estimate:
    - RT60 (reverb time) - time for reverb to decay by 60dB
    - Pre-delay - time before reverb starts
    - Stereo width - how wide the reverb field is
    - Delay time - discrete delay echo timing
    - Delay feedback - estimated feedback amount

    This helps match reverb/delay settings to reference tracks.
    """
    logger.info('=== Reverb/Delay Analysis ===')

    # Use proper temp file handling for automatic cleanup
    temp_file = None
    temp_path = None
    try:
        # Create temp file with proper suffix
        suffix = Path(file.filename).suffix if file.filename else '.wav'
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=str(TEMP_DIR))
        temp_path = temp_file.name
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        # Load stereo audio
        y_stereo, sr = librosa.load(temp_path, sr=44100, mono=False)

        if y_stereo.ndim == 1:
            # Mono file
            y_left = y_stereo
            y_right = y_stereo
            y_mono = y_stereo
            is_stereo = False
        else:
            y_left = y_stereo[0]
            y_right = y_stereo[1]
            y_mono = librosa.to_mono(y_stereo)
            is_stereo = True

        duration = len(y_mono) / sr
        if end_time is None or end_time > duration:
            end_time = duration

        # Trim to analysis range
        start_sample = int(start_time * sr)
        end_sample = int(end_time * sr)
        y_mono = y_mono[start_sample:end_sample]
        y_left = y_left[start_sample:end_sample]
        y_right = y_right[start_sample:end_sample]

        logger.info(f'Analyzing {end_time - start_time:.2f}s of audio (stereo: {is_stereo})')

        results = {
            'success': True,
            'duration': end_time - start_time,
            'is_stereo': is_stereo,
            'global': {},
            'sections': [],
        }

        # === 1. STEREO WIDTH ANALYSIS ===
        def analyze_stereo_width(left, right):
            """Calculate stereo correlation and width."""
            if len(left) == 0:
                return {'correlation': 1.0, 'width': 0.0, 'l_r_balance': 0.0}

            # Cross-correlation at zero lag
            l_norm = left - np.mean(left)
            r_norm = right - np.mean(right)
            l_std = np.std(l_norm)
            r_std = np.std(r_norm)

            if l_std > 0 and r_std > 0:
                correlation = np.mean(l_norm * r_norm) / (l_std * r_std)
            else:
                correlation = 1.0

            # Width: 0 = mono, 1 = full stereo
            # Correlation of 1 = mono, 0 = uncorrelated (wide)
            width = 1.0 - abs(correlation)

            # L/R balance (-1 = all left, +1 = all right)
            l_energy = np.sum(left ** 2)
            r_energy = np.sum(right ** 2)
            total = l_energy + r_energy
            if total > 0:
                balance = (r_energy - l_energy) / total
            else:
                balance = 0.0

            return {
                'correlation': float(correlation),
                'width': float(np.clip(width, 0, 1)),
                'l_r_balance': float(balance),
            }

        # === 2. RT60 ESTIMATION (Reverb Time) ===
        def estimate_rt60(audio, sr):
            """
            Estimate RT60 from energy decay curve.
            Uses Schroeder integration (backwards integration of squared signal).
            """
            # Square the signal
            energy = audio ** 2

            # Schroeder integration (cumulative sum from end)
            schroeder = np.cumsum(energy[::-1])[::-1]

            # Normalize
            if schroeder[0] > 0:
                schroeder_db = 10 * np.log10(schroeder / schroeder[0] + 1e-10)
            else:
                return None

            # Find time to decay by 60dB (or extrapolate from 20dB decay)
            # T20 extrapolation: find -20dB point, multiply time by 3
            decay_20db_idx = np.where(schroeder_db <= -20)[0]
            if len(decay_20db_idx) > 0:
                t20 = decay_20db_idx[0] / sr
                rt60 = t20 * 3  # Extrapolate to 60dB
                return float(np.clip(rt60, 0.1, 10.0))  # Clamp to reasonable range

            # If can't find -20dB, try -10dB and extrapolate
            decay_10db_idx = np.where(schroeder_db <= -10)[0]
            if len(decay_10db_idx) > 0:
                t10 = decay_10db_idx[0] / sr
                rt60 = t10 * 6  # Extrapolate to 60dB
                return float(np.clip(rt60, 0.1, 10.0))

            return None

        # === 3. DELAY ECHO DETECTION ===
        def detect_delay_echoes(audio, sr, max_delay_ms=500):
            """
            Detect discrete delay echoes using autocorrelation.
            Looks for peaks in the autocorrelation at musically relevant intervals.
            """
            # Compute autocorrelation
            max_lag = int(max_delay_ms * sr / 1000)

            # Use short segment for speed
            segment = audio[:min(len(audio), sr * 4)]  # First 4 seconds

            # Normalize
            if np.std(segment) > 0:
                segment_norm = (segment - np.mean(segment)) / np.std(segment)
            else:
                return None

            # Autocorrelation using FFT
            n = len(segment_norm)
            fft = np.fft.fft(segment_norm, n=2*n)
            autocorr = np.fft.ifft(fft * np.conj(fft))[:n].real
            autocorr = autocorr / autocorr[0]  # Normalize

            # Find peaks (excluding the main peak at lag 0)
            min_lag = int(50 * sr / 1000)  # At least 50ms delay
            search_region = autocorr[min_lag:max_lag]

            if len(search_region) == 0:
                return None

            # Find significant peaks
            from scipy.signal import find_peaks
            peaks, properties = find_peaks(search_region, height=0.1, distance=int(20 * sr / 1000))

            delay_echoes = []
            for peak_idx in peaks[:3]:  # Top 3 peaks
                delay_ms = (peak_idx + min_lag) * 1000 / sr
                strength = float(search_region[peak_idx])
                delay_echoes.append({
                    'delay_ms': float(delay_ms),
                    'strength': strength,
                })

            if delay_echoes:
                # Sort by strength
                delay_echoes.sort(key=lambda x: x['strength'], reverse=True)
                return {
                    'detected': True,
                    'primary_delay_ms': delay_echoes[0]['delay_ms'],
                    'primary_strength': delay_echoes[0]['strength'],
                    'echoes': delay_echoes,
                    'estimated_feedback': delay_echoes[0]['strength'] * 0.7,  # Rough estimate
                }

            return {'detected': False}

        # === 4. PRE-DELAY ESTIMATION ===
        def estimate_predelay(audio, sr):
            """
            Estimate pre-delay by analyzing onset characteristics.
            Looks at the gap between transient and sustained sound.
            """
            # Get onset envelope
            onset_env = librosa.onset.onset_strength(y=audio, sr=sr)

            # Find first significant onset
            threshold = np.max(onset_env) * 0.3
            onset_frames = np.where(onset_env > threshold)[0]

            if len(onset_frames) == 0:
                return None

            # Convert to samples
            hop_length = 512  # librosa default
            first_onset_sample = onset_frames[0] * hop_length

            # Look at the signal around the onset
            pre_onset = max(0, first_onset_sample - int(0.05 * sr))
            post_onset = min(len(audio), first_onset_sample + int(0.1 * sr))

            segment = audio[pre_onset:post_onset]

            # Find the actual peak
            peak_idx = np.argmax(np.abs(segment))

            # Energy before and after peak (to estimate reverb build-up)
            if peak_idx > 10:
                pre_energy = np.mean(segment[:peak_idx] ** 2)
                post_energy = np.mean(segment[peak_idx:] ** 2)

                # If pre-energy is significant compared to post, there's pre-delay
                if post_energy > 0:
                    ratio = pre_energy / post_energy
                    # Rough pre-delay estimate (more ratio = less pre-delay)
                    predelay_ms = (1.0 - min(ratio, 1.0)) * 50  # 0-50ms range
                    return float(predelay_ms)

            return 10.0  # Default estimate

        # === 5. ANALYZE FULL TRACK ===
        global_stereo = analyze_stereo_width(y_left, y_right)
        global_rt60 = estimate_rt60(y_mono, sr)
        global_delay = detect_delay_echoes(y_mono, sr)
        global_predelay = estimate_predelay(y_mono, sr)

        results['global'] = {
            'stereo': global_stereo,
            'rt60_seconds': global_rt60,
            'rt60_description': describe_rt60(global_rt60) if global_rt60 else 'Could not estimate',
            'delay': global_delay,
            'predelay_ms': global_predelay,
            'reverb_character': classify_reverb(global_rt60, global_stereo['width'], global_predelay),
        }

        # === 6. ANALYZE SECTIONS (if requested) ===
        if analyze_sections:
            section_samples = int(section_length * sr)
            num_sections = int(len(y_mono) / section_samples)

            for i in range(min(num_sections, 8)):  # Max 8 sections
                start = i * section_samples
                end = start + section_samples

                section_mono = y_mono[start:end]
                section_left = y_left[start:end]
                section_right = y_right[start:end]

                section_stereo = analyze_stereo_width(section_left, section_right)
                section_rt60 = estimate_rt60(section_mono, sr)
                section_delay = detect_delay_echoes(section_mono, sr)

                results['sections'].append({
                    'start_time': float(start_time + i * section_length),
                    'end_time': float(start_time + (i + 1) * section_length),
                    'stereo': section_stereo,
                    'rt60_seconds': section_rt60,
                    'delay': section_delay,
                })

        # === 7. GENERATE RECOMMENDATIONS ===
        results['recommendations'] = generate_reverb_recommendations(results['global'])

        logger.info(f'Analysis complete: RT60={global_rt60}s, Width={global_stereo["width"]:.2f}')
        return results

    except Exception as e:
        logger.error(f'Error in reverb/delay analysis: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}
    finally:
        # Clean up temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        # Explicit garbage collection after processing large audio
        gc.collect()


def describe_rt60(rt60: float) -> str:
    """Describe RT60 value in human terms."""
    if rt60 is None:
        return 'Unknown'
    elif rt60 < 0.3:
        return 'Very dry (small room/booth)'
    elif rt60 < 0.6:
        return 'Dry (treated room/plate)'
    elif rt60 < 1.0:
        return 'Medium (studio room)'
    elif rt60 < 1.5:
        return 'Ambient (live room)'
    elif rt60 < 2.5:
        return 'Long (hall/chamber)'
    else:
        return 'Very long (cathedral/cave)'


def classify_reverb(rt60: float, width: float, predelay: float) -> str:
    """Classify reverb character based on parameters."""
    if rt60 is None:
        return 'Unknown'

    # Classify type
    if rt60 < 0.4:
        if width < 0.3:
            return 'Tight mono room'
        else:
            return 'Wide plate/short'
    elif rt60 < 0.8:
        if width < 0.3:
            return 'Small room'
        elif width < 0.6:
            return 'Medium room/plate'
        else:
            return 'Wide ambient'
    elif rt60 < 1.5:
        if width < 0.4:
            return 'Live room'
        else:
            return 'Hall/chamber'
    else:
        if width > 0.5:
            return 'Large hall/cathedral'
        else:
            return 'Long decay/cave'


def generate_reverb_recommendations(analysis: dict) -> dict:
    """Generate reverb plugin settings based on analysis."""
    rt60 = analysis.get('rt60_seconds', 1.0) or 1.0
    stereo = analysis.get('stereo', {})
    width = stereo.get('width', 0.5)
    predelay = analysis.get('predelay_ms', 10) or 10
    delay_info = analysis.get('delay', {})

    recommendations = {
        'reverb': {
            'decay_time': f'{rt60:.2f}s',
            'predelay': f'{predelay:.0f}ms',
            'width': f'{width * 100:.0f}%',
            'diffusion': 'High' if rt60 > 1.0 else 'Medium',
            'early_reflections': 'Strong' if predelay < 15 else 'Normal',
            'suggested_plugins': [],
        },
        'delay': None,
    }

    # Suggest plugins based on character
    if rt60 < 0.5:
        recommendations['reverb']['suggested_plugins'] = [
            'Valhalla Room (Small preset)',
            'FabFilter Pro-R (Tight)',
            'Waves H-Reverb (Plate)',
        ]
    elif rt60 < 1.0:
        recommendations['reverb']['suggested_plugins'] = [
            'Valhalla Room (Medium preset)',
            'FabFilter Pro-R (Room)',
            'Soundtoys Little Plate',
        ]
    else:
        recommendations['reverb']['suggested_plugins'] = [
            'Valhalla Vintage Verb (Hall)',
            'FabFilter Pro-R (Large)',
            'Waves Abbey Road Chambers',
        ]

    # Add delay recommendations if echoes detected
    if delay_info and delay_info.get('detected'):
        primary_delay = delay_info.get('primary_delay_ms', 0)
        feedback = delay_info.get('estimated_feedback', 0.3)

        recommendations['delay'] = {
            'delay_time': f'{primary_delay:.0f}ms',
            'feedback': f'{feedback * 100:.0f}%',
            'mix': '20-30%',
            'suggested_plugins': [
                'Valhalla Delay',
                'Soundtoys EchoBoy',
                'FabFilter Timeless',
            ],
        }

    return recommendations


# =============================================================================
# Spectrogram Frequency Analysis (for AI tuning)
# =============================================================================

@app.post('/analyze-frequency-bands')
async def analyze_frequency_bands(
    file: UploadFile = File(...),
    start_time: float = Form(0.0),
    end_time: Optional[float] = Form(None),
    use_hpss: bool = Form(True),  # Separate harmonic/percussive
):
    """
    Analyze frequency band energy distribution for AI tuning.

    Returns energy levels across all instrument frequency bands,
    helping identify which frequencies to target for detection.

    Useful for:
    - Comparing spectrogram energy across bands
    - Finding optimal thresholds per instrument type
    - Identifying frequency masking issues
    - Tuning AI detection sensitivity
    """
    logger.info('=== Frequency Band Analysis ===')

    temp_path = f'/tmp/freq_analyze_{file.filename}'
    try:
        # Save file
        with open(temp_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        # Load audio
        y, sr = librosa.load(temp_path, sr=44100, mono=True)
        duration = len(y) / sr

        if end_time is None or end_time > duration:
            end_time = duration

        # Trim to range
        start_sample = int(start_time * sr)
        end_sample = int(end_time * sr)
        y = y[start_sample:end_sample]

        logger.info(f'Analyzing {end_time - start_time:.2f}s of audio')

        # Apply HPSS if requested
        if use_hpss:
            D = librosa.stft(y)
            H, P = librosa.decompose.hpss(D, margin=2.0)
            y_harmonic = librosa.istft(H, length=len(y))
            y_percussive = librosa.istft(P, length=len(y))
        else:
            y_harmonic = y
            y_percussive = y

        # Bandpass filter function
        from scipy.signal import butter, sosfilt

        def bandpass_filter(data, lowcut, highcut, fs, order=4):
            nyq = 0.5 * fs
            low = max(lowcut / nyq, 0.01)
            high = min(highcut / nyq, 0.99)
            if low >= high:
                return data
            try:
                sos = butter(order, [low, high], btype='band', output='sos')
                return sosfilt(sos, data)
            except:
                return data

        def get_rms(audio):
            return float(np.sqrt(np.mean(audio ** 2)))

        def get_peak(audio):
            return float(np.max(np.abs(audio)))

        # Categorize instruments
        CATEGORIES = {
            'drums': ['kick', 'snare', 'hihat', 'clap', 'tom', 'perc'],
            'bass': ['sub_bass', 'bass', 'bass_harmonics'],
            'melodic': ['piano_low', 'piano_mid', 'piano_high', 'guitar', 'guitar_bright',
                       'synth_lead', 'synth_pad', 'strings', 'brass', 'pluck'],
            'vocals': ['vocal_low', 'vocal_body', 'vocal_presence', 'vocal_air',
                      'sibilance', 'adlib', 'harmony'],
            'fx': ['uplifter', 'downlifter', 'impact', 'sub_drop', 'reverse_crash',
                  'white_noise', 'swoosh', 'tape_stop', 'stutter', 'vocal_chop'],
        }

        # Determine which source to use for each category
        USE_PERCUSSIVE = {'drums', 'fx'}

        results = {
            'success': True,
            'duration': end_time - start_time,
            'total_rms': get_rms(y),
            'total_peak': get_peak(y),
            'bands': {},
            'categories': {},
            'recommendations': [],
        }

        # Analyze each frequency band
        all_bands = []
        for category, instruments in CATEGORIES.items():
            source = y_percussive if category in USE_PERCUSSIVE else y_harmonic
            category_energy = 0

            for inst in instruments:
                if inst not in INSTRUMENT_FILTERS:
                    continue

                low, high = INSTRUMENT_FILTERS[inst]
                filtered = bandpass_filter(source, low, high, sr)

                rms = get_rms(filtered)
                peak = get_peak(filtered)
                threshold = INSTRUMENT_THRESHOLDS.get(inst, 0.005)

                # Calculate signal-to-threshold ratio
                str_ratio = rms / threshold if threshold > 0 else 0

                band_info = {
                    'frequency_range': f'{low}-{high}Hz',
                    'rms': round(rms, 6),
                    'peak': round(peak, 4),
                    'threshold': threshold,
                    'signal_to_threshold': round(str_ratio, 2),
                    'category': category,
                    'source': 'percussive' if category in USE_PERCUSSIVE else 'harmonic',
                }

                results['bands'][inst] = band_info
                all_bands.append((inst, rms, str_ratio))
                category_energy += rms

            results['categories'][category] = {
                'total_rms': round(category_energy, 6),
                'instruments': instruments,
            }

        # Sort by energy
        all_bands.sort(key=lambda x: x[1], reverse=True)

        # Top 10 bands by energy
        results['top_energy_bands'] = [
            {'band': b[0], 'rms': round(b[1], 6), 'str_ratio': round(b[2], 2)}
            for b in all_bands[:10]
        ]

        # Bands with high signal-to-threshold (likely to trigger detections)
        high_str = [(b[0], b[2]) for b in all_bands if b[2] > 2.0]
        high_str.sort(key=lambda x: x[1], reverse=True)
        results['high_detection_bands'] = [
            {'band': b[0], 'str_ratio': round(b[1], 2)}
            for b in high_str[:10]
        ]

        # Generate recommendations
        recs = []

        # Check for frequency masking
        kick_rms = results['bands'].get('kick', {}).get('rms', 0)
        bass_rms = results['bands'].get('bass', {}).get('rms', 0)
        if bass_rms > kick_rms * 1.5:
            recs.append({
                'type': 'masking',
                'issue': 'Bass may be masking kick detection',
                'suggestion': 'Increase kick threshold or use HPSS preprocessing',
            })

        snare_rms = results['bands'].get('snare', {}).get('rms', 0)
        vocal_body_rms = results['bands'].get('vocal_body', {}).get('rms', 0)
        if vocal_body_rms > snare_rms * 2:
            recs.append({
                'type': 'masking',
                'issue': 'Vocals may be masking snare detection',
                'suggestion': 'Use HPSS to isolate percussive content',
            })

        # Check for overly sensitive bands
        for band, rms, str_ratio in all_bands:
            if str_ratio > 5.0:
                current_thresh = INSTRUMENT_THRESHOLDS.get(band, 0.005)
                suggested = round(rms / 2.5, 6)  # Target STR of 2.5
                recs.append({
                    'type': 'threshold',
                    'band': band,
                    'issue': f'Very high signal ({str_ratio:.1f}x threshold)',
                    'current_threshold': current_thresh,
                    'suggested_threshold': suggested,
                })

        results['recommendations'] = recs[:10]  # Limit to 10 recommendations

        logger.info(f'Analyzed {len(results["bands"])} frequency bands')
        return results

    except Exception as e:
        logger.error(f'Error in frequency analysis: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


# =============================================================================
# Spectrogram-Guided Adaptive Detection (TICKET-026)
# =============================================================================

@app.post('/detect-adaptive')
async def detect_adaptive(
    file: UploadFile = File(...),
    bpm: float = Form(...),
    downbeat_offset: float = Form(0.0),
    time_signature: int = Form(4),
    existing_hits: str = Form('[]'),  # JSON array of existing hits
    target_bars: Optional[str] = Form(None),  # Comma-separated bar numbers, or "quiet" for auto-detect
    sensitivity_boost: float = Form(2.0),  # How much to lower thresholds for quiet sections
):
    """
    Spectrogram-guided adaptive detection for quiet sections.

    Analyzes energy per bar and applies lower thresholds to quiet sections
    where standard detection missed hits.

    Use cases:
    - target_bars="20,21,22" - Detect in specific bars
    - target_bars="quiet" - Auto-detect quiet bars and scan them
    - target_bars=None - Scan all bars with adaptive thresholds
    """
    logger.info('=== Spectrogram-Guided Adaptive Detection ===')
    logger.info(f'BPM: {bpm}, Target bars: {target_bars}, Sensitivity boost: {sensitivity_boost}x')

    import json
    from scipy.signal import butter, sosfilt

    temp_file = None
    temp_path = None

    try:
        # Create temp file
        suffix = Path(file.filename).suffix if file.filename else '.wav'
        temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False, dir=str(TEMP_DIR))
        temp_path = temp_file.name
        content = await file.read()
        temp_file.write(content)
        temp_file.close()

        # Load audio
        y, sr = librosa.load(temp_path, sr=44100, mono=True)
        duration = len(y) / sr

        # Parse existing hits
        try:
            existing = json.loads(existing_hits)
        except:
            existing = []

        existing_times = set(round(h.get('time', 0), 3) for h in existing)

        # Calculate timing
        beat_duration = 60.0 / bpm
        bar_duration = beat_duration * time_signature
        total_bars = int(duration / bar_duration) + 1

        logger.info(f'Audio: {duration:.2f}s, {total_bars} bars')

        # Apply HPSS to isolate percussive content
        y_perc = apply_hpss_preprocessing(y, sr)

        # === STEP 1: Analyze energy per bar ===
        bar_energies = []
        for bar_idx in range(total_bars):
            bar_start = downbeat_offset + (bar_idx * bar_duration)
            bar_end = bar_start + bar_duration

            start_sample = max(0, int(bar_start * sr))
            end_sample = min(len(y_perc), int(bar_end * sr))

            if end_sample > start_sample:
                bar_audio = y_perc[start_sample:end_sample]
                rms = float(np.sqrt(np.mean(bar_audio ** 2)))
                bar_energies.append({'bar': bar_idx + 1, 'rms': rms})
            else:
                bar_energies.append({'bar': bar_idx + 1, 'rms': 0})

        # Calculate median energy for reference
        all_rms = [b['rms'] for b in bar_energies if b['rms'] > 0]
        median_rms = np.median(all_rms) if all_rms else 0.01

        # Mark quiet bars (below 60% of median)
        for b in bar_energies:
            b['is_quiet'] = bool(b['rms'] < median_rms * 0.6)  # Convert numpy.bool to Python bool
            b['relative_energy'] = round(float(b['rms'] / median_rms), 3) if median_rms > 0 else 0

        quiet_bars = [b['bar'] for b in bar_energies if b['is_quiet']]
        logger.info(f'Quiet bars detected: {quiet_bars[:20]}...' if len(quiet_bars) > 20 else f'Quiet bars: {quiet_bars}')

        # === STEP 2: Determine which bars to scan ===
        if target_bars == 'quiet':
            # Auto-detect quiet bars
            bars_to_scan = quiet_bars
        elif target_bars:
            # Parse comma-separated bar numbers
            try:
                bars_to_scan = [int(b.strip()) for b in target_bars.split(',')]
            except:
                bars_to_scan = list(range(1, total_bars + 1))
        else:
            # Scan all bars
            bars_to_scan = list(range(1, total_bars + 1))

        logger.info(f'Scanning {len(bars_to_scan)} bars')

        # === STEP 3: Create frequency-filtered versions ===
        def bandpass_filter(data, lowcut, highcut, fs, order=4):
            nyq = 0.5 * fs
            low = max(lowcut / nyq, 0.01)
            high = min(highcut / nyq, 0.99)
            if low >= high:
                return data
            try:
                sos = butter(order, [low, high], btype='band', output='sos')
                filtered = sosfilt(sos, data)
                return filtered if np.isfinite(filtered).all() else data
            except:
                return data

        DRUM_FILTERS = {
            'kick': (20, 250),
            'snare': (150, 2000),
            'hihat': (5000, 15000),
            'clap': (1000, 4000),
            'tom': (80, 500),
            'perc': (2000, 8000),
        }

        filtered_audio = {}
        for drum_type, (low, high) in DRUM_FILTERS.items():
            filtered_audio[drum_type] = bandpass_filter(y_perc, low, min(high, sr/2 - 100), sr)

        # === STEP 4: Adaptive detection per bar ===
        grid_duration = beat_duration / 4  # 16th note
        window_samples = int(sr * 0.05)  # 50ms window

        def get_window_energy(audio, time_sec, sr, window_samples):
            center_sample = int(time_sec * sr)
            start = max(0, center_sample - window_samples // 2)
            end = min(len(audio), center_sample + window_samples // 2)
            if end <= start:
                return 0.0
            window = audio[start:end]
            return float(np.sqrt(np.mean(window ** 2)))

        # Base thresholds (will be lowered for quiet sections)
        BASE_THRESHOLDS = {
            'kick': 0.010,
            'snare': 0.008,
            'hihat': 0.005,
            'clap': 0.006,
            'tom': 0.008,
            'perc': 0.004,
        }

        # Expected pattern positions (16th note grid, 0-15)
        EXPECTED_POSITIONS = {
            'kick': [0, 8],           # Beats 1, 3
            'snare': [4, 12],         # Beats 2, 4
            'hihat': [0, 2, 4, 6, 8, 10, 12, 14],  # 8th notes
            'clap': [4, 12],          # Beats 2, 4
            'tom': [],                # Variable
            'perc': [0, 2, 4, 6, 8, 10, 12, 14],   # 8th notes
        }

        new_hits = []

        for bar_num in bars_to_scan:
            bar_idx = bar_num - 1
            bar_start = downbeat_offset + (bar_idx * bar_duration)

            # Get bar energy info
            bar_info = next((b for b in bar_energies if b['bar'] == bar_num), None)
            is_quiet = bar_info['is_quiet'] if bar_info else False

            # Apply sensitivity boost for quiet bars
            threshold_multiplier = 1.0 / sensitivity_boost if is_quiet else 1.0

            for drum_type, positions in EXPECTED_POSITIONS.items():
                if not positions:
                    continue

                filtered_y = filtered_audio[drum_type]
                threshold = BASE_THRESHOLDS[drum_type] * threshold_multiplier

                for grid_pos in positions:
                    hit_time = bar_start + (grid_pos * grid_duration)

                    if hit_time < 0 or hit_time >= duration:
                        continue

                    # Check if already have a hit here
                    if any(abs(t - hit_time) < 0.03 for t in existing_times):
                        continue

                    energy = get_window_energy(filtered_y, hit_time, sr, window_samples)

                    if energy > threshold:
                        new_hits.append({
                            'time': round(float(hit_time), 4),
                            'type': drum_type,
                            'confidence': round(float(min(energy / threshold, 1.0)), 3),
                            'bar': int(bar_num),
                            'grid_position': int(grid_pos),
                            'energy': round(float(energy), 5),
                            'threshold_used': round(float(threshold), 5),
                            'is_quiet_bar': bool(is_quiet),
                            'source': 'adaptive_detection',
                        })
                        existing_times.add(round(hit_time, 3))

        # Sort by time
        new_hits.sort(key=lambda x: x['time'])

        # Count by type
        hits_by_type = {}
        for h in new_hits:
            t = h['type']
            hits_by_type[t] = hits_by_type.get(t, 0) + 1

        logger.info(f'Found {len(new_hits)} new hits: {hits_by_type}')

        return {
            'success': True,
            'total_bars': int(total_bars),
            'bars_scanned': len(bars_to_scan),
            'quiet_bars': [int(b) for b in quiet_bars],
            'median_bar_energy': round(float(median_rms), 5),
            'bar_energies': bar_energies,
            'new_hits': new_hits,
            'total_new_hits': len(new_hits),
            'hits_by_type': hits_by_type,
            'settings': {
                'bpm': float(bpm),
                'sensitivity_boost': float(sensitivity_boost),
                'target_bars': target_bars,
            }
        }

    except Exception as e:
        logger.error(f'Error in adaptive detection: {e}', exc_info=True)
        return {'success': False, 'error': str(e)}
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass
        gc.collect()


# =============================================================================
# Main
# =============================================================================

if __name__ == '__main__':
    logger.info(f'Starting Rhythm Analyzer on port {PORT}')
    logger.info(f'madmom available: {MADMOM_AVAILABLE}')
    logger.info(f'sklearn available: {SKLEARN_AVAILABLE}')
    logger.info(f'Classifier loaded: {classifier is not None}')

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
        log_level='info'
    )
