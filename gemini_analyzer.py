"""
Gemini Mix Analyzer - FastAPI Backend
AI-powered mix analysis using Google's Gemini API or OpenRouter with spectrogram visualization.

Port: 56401 (within reserved range 56400-56411)

Usage:
    pip install -r requirements-gemini.txt
    export GOOGLE_API_KEY="your_key_here"  # For Google Gemini
    # OR
    export OPENROUTER_API_KEY="your_key_here"  # For OpenRouter
    python gemini_analyzer.py
"""

import os
import io
import base64
import tempfile
import json
import uuid
from typing import Optional
from datetime import datetime, timedelta

import numpy as np
import librosa
import soundfile as sf
import pyloudnorm as pyln
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from scipy import signal

from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import google.generativeai as genai
from openai import OpenAI
from PIL import Image
import threading
import gc

# Configuration
PORT = 56401
DEFAULT_MODEL = 'gemini-2.5-pro'
MAX_FILE_SIZE = 200 * 1024 * 1024  # 200MB
SETTINGS_FILE = os.path.join(os.path.dirname(__file__), '.gemini_settings.json')

# Session storage for multi-turn chat (in-memory, expires after 30 minutes)
chat_sessions = {}
SESSION_EXPIRY_MINUTES = 30

def load_settings():
    """Load settings from file, falling back to environment variables."""
    defaults = {
        'provider': 'google',
        'google_api_key': os.getenv('GOOGLE_API_KEY', ''),
        'openrouter_api_key': os.getenv('OPENROUTER_API_KEY', ''),
        'default_model': os.getenv('DEFAULT_MODEL', 'gemini-2.5-pro')
    }
    try:
        if os.path.exists(SETTINGS_FILE):
            with open(SETTINGS_FILE, 'r') as f:
                saved = json.load(f)
                # Merge saved settings with defaults (env vars take precedence if set)
                for key in defaults:
                    if key in saved and saved[key]:
                        # Don't override env vars if they're set
                        if key.endswith('_api_key') and defaults[key]:
                            continue
                        defaults[key] = saved[key]
    except Exception as e:
        print(f'Error loading settings: {e}')
    return defaults

def save_settings(settings):
    """Save settings to file for persistence."""
    try:
        with open(SETTINGS_FILE, 'w') as f:
            json.dump(settings, f)
    except Exception as e:
        print(f'Error saving settings: {e}')

# API Settings storage (persisted to file)
api_settings = load_settings()

# OpenRouter models list
OPENROUTER_MODELS = [
    {'id': 'google/gemini-3-pro-preview', 'name': 'Gemini 3 Pro (Recommended)', 'provider': 'google'},
    {'id': 'openai/gpt-5.2', 'name': 'GPT-5.2', 'provider': 'openai'},
    {'id': 'openai/gpt-5.2-chat', 'name': 'GPT-5.2 Chat (Fast)', 'provider': 'openai'},
    {'id': 'google/gemini-2.5-pro-preview-05-06', 'name': 'Gemini 2.5 Pro', 'provider': 'google'},
    {'id': 'google/gemini-2.0-flash-exp:free', 'name': 'Gemini 2.0 Flash (Free)', 'provider': 'google'},
    {'id': 'anthropic/claude-3.5-sonnet', 'name': 'Claude 3.5 Sonnet', 'provider': 'anthropic'},
    {'id': 'anthropic/claude-3-opus', 'name': 'Claude 3 Opus', 'provider': 'anthropic'},
    {'id': 'meta-llama/llama-3.2-90b-vision-instruct', 'name': 'Llama 3.2 90B Vision', 'provider': 'meta'},
]

# Google Gemini models list
GOOGLE_MODELS = [
    {'id': 'gemini-2.5-pro', 'name': 'Gemini 2.5 Pro', 'provider': 'google'},
    {'id': 'gemini-2.0-flash', 'name': 'Gemini 2.0 Flash', 'provider': 'google'},
    {'id': 'gemini-1.5-pro', 'name': 'Gemini 1.5 Pro', 'provider': 'google'},
    {'id': 'gemini-1.5-flash', 'name': 'Gemini 1.5 Flash', 'provider': 'google'},
]

app = FastAPI(
    title='Gemini Mix Analyzer',
    description='AI-powered mix analysis using Google Gemini',
    version='1.0.0'
)

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:56400', 'http://127.0.0.1:56400'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


class AnalysisIssue(BaseModel):
    description: str
    frequency_range: Optional[str] = None
    fix: str
    timestamp: Optional[str] = None


class AnalysisResult(BaseModel):
    summary: str
    top_issues: list[AnalysisIssue]
    genre_assumptions: str
    confidence_0_100: int
    is_commercial_ready: bool


class AudioMetrics(BaseModel):
    lufs_integrated: float
    true_peak_db: float
    crest_factor_db: float
    stereo_correlation: float
    spectral_centroid_hz: float
    duration_sec: float


class AnalysisResponse(BaseModel):
    model: str
    metrics: AudioMetrics
    analysis: AnalysisResult
    spectrogram_base64: Optional[str] = None


def configure_gemini():
    """Configure the Gemini API with the API key from settings or environment."""
    api_key = api_settings.get('google_api_key') or os.getenv('GOOGLE_API_KEY')
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail='Google API key not configured. Set it in Settings or via GOOGLE_API_KEY environment variable.'
        )
    genai.configure(api_key=api_key)


def calculate_audio_metrics(y: np.ndarray, sr: int) -> AudioMetrics:
    """Calculate objective audio metrics from audio data."""
    # Ensure stereo for stereo correlation, or handle mono
    if y.ndim == 1:
        y_stereo = np.vstack([y, y])
        is_mono = True
    else:
        y_stereo = y
        is_mono = False

    # Integrated loudness (LUFS)
    meter = pyln.Meter(sr)
    # pyloudnorm expects shape (samples, channels)
    y_for_lufs = y_stereo.T if y_stereo.ndim > 1 else y_stereo.reshape(-1, 1)
    try:
        lufs = meter.integrated_loudness(y_for_lufs)
    except Exception:
        lufs = -24.0  # Fallback

    # True peak (dBTP)
    # Oversample for accurate peak detection
    y_mono = np.mean(y_stereo, axis=0) if y_stereo.ndim > 1 else y_stereo
    try:
        y_oversampled = signal.resample(y_mono, len(y_mono) * 4)
        true_peak = 20 * np.log10(np.max(np.abs(y_oversampled)) + 1e-10)
    except Exception:
        true_peak = 20 * np.log10(np.max(np.abs(y_mono)) + 1e-10)

    # Crest factor (dynamic range indicator)
    rms = np.sqrt(np.mean(y_mono ** 2))
    peak = np.max(np.abs(y_mono))
    crest_factor_db = 20 * np.log10(peak / (rms + 1e-10))

    # Stereo correlation
    if is_mono:
        stereo_correlation = 1.0
    else:
        left = y_stereo[0]
        right = y_stereo[1]
        correlation = np.corrcoef(left, right)[0, 1]
        stereo_correlation = float(correlation) if not np.isnan(correlation) else 1.0

    # Spectral centroid (brightness indicator)
    centroid = librosa.feature.spectral_centroid(y=y_mono, sr=sr)
    spectral_centroid_hz = float(np.mean(centroid))

    # Duration
    duration_sec = len(y_mono) / sr

    return AudioMetrics(
        lufs_integrated=round(lufs, 1),
        true_peak_db=round(true_peak, 1),
        crest_factor_db=round(crest_factor_db, 1),
        stereo_correlation=round(stereo_correlation, 2),
        spectral_centroid_hz=round(spectral_centroid_hz, 0),
        duration_sec=round(duration_sec, 1)
    )


def generate_spectrogram(y: np.ndarray, sr: int) -> tuple[str, bytes]:
    """Generate mel spectrogram PNG and return as base64 and bytes."""
    # Use mono for spectrogram
    y_mono = np.mean(y, axis=0) if y.ndim > 1 else y

    # Compute mel spectrogram
    S = librosa.feature.melspectrogram(
        y=y_mono,
        sr=sr,
        n_mels=128,
        fmax=16000,
        n_fft=2048,
        hop_length=512
    )
    S_db = librosa.power_to_db(S, ref=np.max)

    # Create figure with iZotope RX-style colors
    fig, ax = plt.subplots(figsize=(12, 4), dpi=160)

    # Custom colormap (blue -> purple -> red -> orange -> yellow)
    colors = [
        '#001428', '#0a2850', '#2e4a7a', '#6a4c93',
        '#c94c4c', '#e88a3c', '#f5c842', '#ffffc0'
    ]
    cmap = matplotlib.colors.LinearSegmentedColormap.from_list('izotope', colors)

    img = librosa.display.specshow(
        S_db,
        sr=sr,
        hop_length=512,
        x_axis='time',
        y_axis='mel',
        ax=ax,
        cmap=cmap
    )

    ax.set_xlabel('Time (s)', fontsize=10)
    ax.set_ylabel('Frequency (Hz)', fontsize=10)
    ax.set_title('Mel Spectrogram', fontsize=12)

    # Add colorbar
    cbar = fig.colorbar(img, ax=ax, format='%+2.0f dB')
    cbar.ax.tick_params(labelsize=8)

    plt.tight_layout()

    # Save to bytes
    buf = io.BytesIO()
    plt.savefig(buf, format='png', facecolor='#0a0a14', edgecolor='none')
    plt.close(fig)
    buf.seek(0)

    img_bytes = buf.read()
    img_b64 = base64.b64encode(img_bytes).decode('utf-8')

    return img_b64, img_bytes


def build_system_prompt(metrics: AudioMetrics, user_prompt: str, mode: str = 'engineer') -> str:
    """Build the system prompt with metrics injected based on mode."""

    metrics_block = f"""## Measured Audio Metrics:
- Integrated Loudness: {metrics.lufs_integrated} LUFS
- True Peak: {metrics.true_peak_db} dBTP
- Crest Factor: {metrics.crest_factor_db} dB
- Stereo Correlation: {metrics.stereo_correlation}
- Spectral Centroid: {metrics.spectral_centroid_hz} Hz
- Duration: {metrics.duration_sec}s"""

    json_format = """{{
  "summary": "2-3 sentence description of tone, balance, width, punch, clarity",
  "top_issues": [
    {{
      "description": "what you observe",
      "frequency_range": "e.g., 200-400Hz",
      "fix": "practical fix (EQ, compression, etc.)",
      "timestamp": "e.g., 0:45-1:12 or null if throughout"
    }}
  ],
  "genre_assumptions": "assumed genre/style based on audio",
  "confidence_0_100": 85,
  "is_commercial_ready": true
}}"""

    if mode == 'producer':
        return f"""Role: You are a world-class Music Producer and Arranger with credits on multiple platinum records.

{metrics_block}

## Your Focus:
Analyze the provided audio for CREATIVE potential and arrangement opportunities. Think like a producer who wants to elevate this track to the next level.

Consider:
- Arrangement structure and energy flow throughout the track
- Opportunities for additional layers, instruments, or production elements
- Melodic hooks and their effectiveness
- Build-ups, drops, and transitions
- Overall vibe, emotion, and how it connects with listeners
- Production techniques that could enhance the track

## Task:
Analyze this audio spectrogram and return ONLY valid JSON in this exact format:
{json_format}

## Rules for Producer Mode:
1) Focus on CREATIVE suggestions, not just technical fixes
2) When suggesting notes/chords, be specific (e.g., "add a C major arpeggio starting at 0:45")
3) Consider the emotional journey of the listener
4) Suggest arrangement changes, layers, or production techniques
5) Think about what would make this track more memorable and impactful
6) Return ONLY the JSON object, no markdown, no explanation.

User request: {user_prompt}"""

    else:  # engineer mode (default)
        return f"""Role: You are a world-class Audio Engineer specializing in Mixing & Mastering with experience across all genres.

{metrics_block}

## Your Focus:
Analyze the provided audio spectrogram for TECHNICAL issues that affect:
- Frequency balance and spectral clarity
- Dynamics, compression, and transient response
- Stereo image, width, and mono compatibility
- Headroom and loudness optimization
- Phase issues and frequency masking

## Task:
Analyze this audio spectrogram and return ONLY valid JSON in this exact format:
{json_format}

## Rules for Engineer Mode:
1) List max 5 issues that matter for translation across earbuds, car, club.
2) Provide specific, actionable fixes with EQ frequencies, compression settings, etc.
3) Only suggest improvements if they genuinely improve translation or solve a real issue.
4) If the track already meets commercial standard for the style, set is_commercial_ready to true and top_issues can be empty or minimal.
5) Return ONLY the JSON object, no markdown, no explanation.

User request: {user_prompt}"""


def parse_gemini_response(content: str) -> AnalysisResult:
    """Parse JSON response from Gemini."""
    # Try to extract JSON from response
    content = content.strip()

    # Remove markdown code blocks if present
    if content.startswith('```json'):
        content = content[7:]
    elif content.startswith('```'):
        content = content[3:]
    if content.endswith('```'):
        content = content[:-3]
    content = content.strip()

    try:
        data = json.loads(content)
    except json.JSONDecodeError as e:
        # Try to find JSON object in the response
        start = content.find('{')
        end = content.rfind('}') + 1
        if start >= 0 and end > start:
            try:
                data = json.loads(content[start:end])
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=500,
                    detail=f'Failed to parse AI response as JSON: {str(e)}'
                )
        else:
            raise HTTPException(
                status_code=500,
                detail=f'Failed to parse AI response as JSON: {str(e)}'
            )

    # Convert to AnalysisResult
    issues = []
    for issue in data.get('top_issues', []):
        issues.append(AnalysisIssue(
            description=issue.get('description', ''),
            frequency_range=issue.get('frequency_range'),
            fix=issue.get('fix', ''),
            timestamp=issue.get('timestamp')
        ))

    return AnalysisResult(
        summary=data.get('summary', 'Analysis complete.'),
        top_issues=issues,
        genre_assumptions=data.get('genre_assumptions', 'Unknown'),
        confidence_0_100=data.get('confidence_0_100', 50),
        is_commercial_ready=data.get('is_commercial_ready', False)
    )


@app.get('/health')
async def health_check():
    """Health check endpoint."""
    provider = api_settings.get('provider', 'google')
    if provider == 'openrouter':
        api_key = api_settings.get('openrouter_api_key') or os.getenv('OPENROUTER_API_KEY')
    else:
        api_key = api_settings.get('google_api_key') or os.getenv('GOOGLE_API_KEY')
    return {
        'status': 'ok',  # Service is running, API key status is separate
        'service': 'gemini-analyzer',
        'api_key_configured': bool(api_key),
        'provider': provider
    }


class ChatMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str


class ChatSession(BaseModel):
    session_id: str
    messages: list[ChatMessage]
    audio_context: Optional[dict] = None  # Stores metrics and spectrogram info
    created_at: datetime
    last_activity: datetime


class ChatResponse(BaseModel):
    session_id: str
    response: str
    analysis: Optional[AnalysisResult] = None


def cleanup_expired_sessions():
    """Remove sessions older than SESSION_EXPIRY_MINUTES."""
    now = datetime.now()
    expired = [
        sid for sid, session in chat_sessions.items()
        if now - session['last_activity'] > timedelta(minutes=SESSION_EXPIRY_MINUTES)
    ]
    for sid in expired:
        del chat_sessions[sid]

    # Run garbage collection after cleanup
    if expired:
        gc.collect()


# Session cleanup timer - runs every 5 minutes regardless of requests
_cleanup_timer_started = False

def start_session_cleanup_timer():
    """Start a background timer that cleans up expired sessions every 5 minutes."""
    global _cleanup_timer_started
    if _cleanup_timer_started:
        return

    def cleanup_loop():
        cleanup_expired_sessions()
        # Reschedule
        timer = threading.Timer(300, cleanup_loop)  # 300 seconds = 5 minutes
        timer.daemon = True  # Don't block process exit
        timer.start()

    # Start initial timer
    timer = threading.Timer(300, cleanup_loop)
    timer.daemon = True
    timer.start()
    _cleanup_timer_started = True


@app.post('/analyze')
async def analyze_mix(
    audio: UploadFile = File(...),
    user_prompt: str = Form(default='Analyze this mix'),
    start_sec: Optional[float] = Form(default=None),
    end_sec: Optional[float] = Form(default=None),
    include_spectrogram: bool = Form(default=True),
    model: Optional[str] = Form(default=None),
    mode: str = Form(default='engineer'),
    session_id: Optional[str] = Form(default=None)
):
    """
    Analyze an audio file using Google Gemini AI.

    - Accepts audio file (WAV, MP3, FLAC, etc.)
    - Calculates objective metrics (LUFS, true peak, etc.)
    - Generates mel spectrogram
    - Sends to Gemini for analysis
    - Returns structured mixing feedback
    - Supports engineer or producer mode
    - Can create/continue chat sessions
    """
    # Configure Gemini
    configure_gemini()

    # Cleanup expired sessions periodically
    cleanup_expired_sessions()

    # Validate file size
    contents = await audio.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f'File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB'
        )

    # Save to temp file and load with librosa
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # Load audio
        y, sr = librosa.load(tmp_path, sr=44100, mono=False)

        # Trim to segment if specified
        if start_sec is not None or end_sec is not None:
            start_sample = int((start_sec or 0) * sr)
            end_sample = int((end_sec or len(y) / sr) * sr) if end_sec else None

            if y.ndim > 1:
                y = y[:, start_sample:end_sample]
            else:
                y = y[start_sample:end_sample]

        # Calculate metrics
        metrics = calculate_audio_metrics(y, sr)

        # Generate spectrogram
        spectrogram_b64, spectrogram_bytes = generate_spectrogram(y, sr)

        # Get the model and provider
        provider = api_settings.get('provider', 'google')
        model_name = model or api_settings.get('default_model', DEFAULT_MODEL)

        # Build prompt with metrics and mode
        prompt = build_system_prompt(metrics, user_prompt, mode)

        # Call AI based on provider
        if provider == 'openrouter':
            # Use OpenRouter API
            ai_content = call_openrouter(prompt, spectrogram_b64, model_name)
        else:
            # Use Google Gemini API
            configure_gemini()
            gemini_model = genai.GenerativeModel(model_name)
            spectrogram_image = Image.open(io.BytesIO(spectrogram_bytes))

            response = gemini_model.generate_content(
                [prompt, spectrogram_image],
                generation_config=genai.GenerationConfig(
                    temperature=0.4,
                    max_output_tokens=2000,
                )
            )
            ai_content = response.text

        # Parse response
        analysis = parse_gemini_response(ai_content)

        # Create or update session for multi-turn chat
        new_session_id = session_id or str(uuid.uuid4())
        now = datetime.now()

        chat_sessions[new_session_id] = {
            'session_id': new_session_id,
            'messages': [
                {'role': 'user', 'content': user_prompt},
                {'role': 'assistant', 'content': ai_content}
            ],
            'audio_context': {
                'metrics': metrics.model_dump(),
                'spectrogram_b64': spectrogram_b64,
                'mode': mode
            },
            'created_at': now,
            'last_activity': now
        }

        return {
            'model': model_name,
            'metrics': metrics,
            'analysis': analysis,
            'spectrogram_base64': spectrogram_b64 if include_spectrogram else None,
            'session_id': new_session_id
        }

    finally:
        # Cleanup temp file
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


@app.post('/chat')
async def chat_followup(
    session_id: str = Form(...),
    message: str = Form(...),
    model: Optional[str] = Form(default=None)
):
    """
    Send a follow-up message in an existing chat session.
    Maintains conversation context from the initial analysis.
    """
    # Cleanup expired sessions
    cleanup_expired_sessions()

    # Get session
    session = chat_sessions.get(session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail='Session not found or expired. Please start a new analysis.'
        )

    # Update last activity
    session['last_activity'] = datetime.now()

    # Get provider and model
    provider = api_settings.get('provider', 'google')
    model_name = model or api_settings.get('default_model', DEFAULT_MODEL)

    # Build conversation history for context
    audio_ctx = session.get('audio_context', {})
    metrics_ctx = audio_ctx.get('metrics', {})
    mode = audio_ctx.get('mode', 'engineer')

    context_prompt = f"""You are continuing a conversation about an audio mix analysis.

## Audio Context (from initial analysis):
- Integrated Loudness: {metrics_ctx.get('lufs_integrated', 'N/A')} LUFS
- True Peak: {metrics_ctx.get('true_peak_db', 'N/A')} dBTP
- Crest Factor: {metrics_ctx.get('crest_factor_db', 'N/A')} dB
- Duration: {metrics_ctx.get('duration_sec', 'N/A')}s

## Mode: {mode.capitalize()}

## Previous conversation:
"""

    for msg in session['messages']:
        role = 'User' if msg['role'] == 'user' else 'AI'
        # Truncate long messages in history
        content = msg['content'][:500] + '...' if len(msg['content']) > 500 else msg['content']
        context_prompt += f"\n{role}: {content}\n"

    context_prompt += f"\nUser's new question: {message}\n\nProvide a helpful, specific response based on the audio analysis context above."

    # Call AI based on provider
    if provider == 'openrouter':
        ai_response = call_openrouter_text(context_prompt, model_name)
    else:
        # Use Google Gemini API
        configure_gemini()
        gemini_model = genai.GenerativeModel(model_name)
        response = gemini_model.generate_content(
            context_prompt,
            generation_config=genai.GenerationConfig(
                temperature=0.6,
                max_output_tokens=1500,
            )
        )
        ai_response = response.text

    # Add to session history
    session['messages'].append({'role': 'user', 'content': message})
    session['messages'].append({'role': 'assistant', 'content': ai_response})

    # Keep history manageable (last 10 exchanges)
    if len(session['messages']) > 20:
        session['messages'] = session['messages'][-20:]

    return {
        'session_id': session_id,
        'response': ai_response,
        'message_count': len(session['messages'])
    }


@app.delete('/chat/{session_id}')
async def clear_session(session_id: str):
    """Clear a chat session."""
    if session_id in chat_sessions:
        del chat_sessions[session_id]
        return {'status': 'cleared'}
    return {'status': 'not_found'}


@app.get('/models')
async def list_models():
    """List available models based on current provider."""
    provider = api_settings.get('provider', 'google')

    if provider == 'openrouter':
        return {
            'provider': 'openrouter',
            'models': OPENROUTER_MODELS,
            'current': api_settings.get('default_model', 'google/gemini-2.0-flash-exp:free')
        }
    else:
        return {
            'provider': 'google',
            'models': GOOGLE_MODELS,
            'current': api_settings.get('default_model', DEFAULT_MODEL)
        }


@app.get('/settings')
async def get_settings():
    """Get current API settings (without exposing full keys)."""
    return {
        'provider': api_settings.get('provider', 'google'),
        'google_api_key_set': bool(api_settings.get('google_api_key')),
        'openrouter_api_key_set': bool(api_settings.get('openrouter_api_key')),
        'default_model': api_settings.get('default_model', DEFAULT_MODEL),
        'google_api_key_preview': mask_api_key(api_settings.get('google_api_key', '')),
        'openrouter_api_key_preview': mask_api_key(api_settings.get('openrouter_api_key', '')),
    }


@app.post('/settings')
async def update_settings(
    provider: Optional[str] = Form(default=None),
    google_api_key: Optional[str] = Form(default=None),
    openrouter_api_key: Optional[str] = Form(default=None),
    default_model: Optional[str] = Form(default=None)
):
    """Update API settings."""
    if provider is not None:
        if provider not in ['google', 'openrouter']:
            raise HTTPException(status_code=400, detail='Invalid provider. Use "google" or "openrouter"')
        api_settings['provider'] = provider

    if google_api_key is not None:
        api_settings['google_api_key'] = google_api_key

    if openrouter_api_key is not None:
        api_settings['openrouter_api_key'] = openrouter_api_key

    if default_model is not None:
        api_settings['default_model'] = default_model

    # Persist settings to file
    save_settings(api_settings)

    return {
        'status': 'updated',
        'provider': api_settings['provider'],
        'google_api_key_set': bool(api_settings.get('google_api_key')),
        'openrouter_api_key_set': bool(api_settings.get('openrouter_api_key')),
        'default_model': api_settings.get('default_model')
    }


def mask_api_key(key: str) -> str:
    """Mask API key for display, showing only first 4 and last 4 chars."""
    if not key or len(key) < 12:
        return '****' if key else ''
    return f'{key[:4]}...{key[-4:]}'


def call_openrouter(prompt: str, image_b64: str, model: str) -> str:
    """Call OpenRouter API with image support."""
    api_key = api_settings.get('openrouter_api_key')
    if not api_key:
        raise HTTPException(status_code=400, detail='OpenRouter API key not configured')

    client = OpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=api_key
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {
                            'type': 'image_url',
                            'image_url': {
                                'url': f'data:image/png;base64,{image_b64}'
                            }
                        }
                    ]
                }
            ],
            max_tokens=2000,
            temperature=0.4
        )
        return response.choices[0].message.content
    except Exception as e:
        error_msg = str(e)
        print(f'OpenRouter API error: {error_msg}')
        raise HTTPException(status_code=500, detail=f'OpenRouter API error: {error_msg}')


def call_openrouter_text(prompt: str, model: str) -> str:
    """Call OpenRouter API for text-only (chat follow-ups)."""
    api_key = api_settings.get('openrouter_api_key')
    if not api_key:
        raise HTTPException(status_code=400, detail='OpenRouter API key not configured')

    client = OpenAI(
        base_url='https://openrouter.ai/api/v1',
        api_key=api_key
    )

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{'role': 'user', 'content': prompt}],
            max_tokens=1500,
            temperature=0.6
        )
        return response.choices[0].message.content
    except Exception as e:
        error_msg = str(e)
        print(f'OpenRouter API error: {error_msg}')
        raise HTTPException(status_code=500, detail=f'OpenRouter API error: {error_msg}')


# =============================================================================
# Pre-Detection Analysis Mode - For Rhythm Detection Integration
# =============================================================================

class DetectionPatternResult(BaseModel):
    """AI analysis result for drum pattern detection configuration."""
    kick_pattern: str = '4-on-the-floor'
    kick_per_bar: int = 4
    snare_pattern: str = 'beats 2 and 4'
    snare_per_bar: int = 2
    hihat_pattern: str = '8th notes'
    hihat_per_bar: int = 8
    clap_layered: bool = False
    has_reverb: bool = False
    genre: str = 'electronic'
    confidence: float = 0.0
    notes: str = ''


def build_detection_prompt(metrics: AudioMetrics, bpm: float = None) -> str:
    """Build prompt specifically for rhythm detection analysis."""
    return f"""Analyze this spectrogram to configure drum detection parameters.

{f"BPM: {bpm:.1f}" if bpm else ""}
Duration: {metrics.duration_sec}s
Spectral Centroid: {metrics.spectral_centroid_hz}Hz

Return ONLY a JSON object with these fields:
{{
  "kick_pattern": "4-on-the-floor" | "half-time" | "trap" | "breakbeat",
  "kick_per_bar": 1-8,
  "snare_pattern": "beats 2 and 4" | "one-drop" | "trap rolls" | "breakbeat",
  "snare_per_bar": 1-8,
  "hihat_pattern": "8th notes" | "16th notes" | "open/closed" | "triplets",
  "hihat_per_bar": 8 | 16 | 24 | 32,
  "clap_layered": true if claps are layered with snare,
  "has_reverb": true if snare/clap have reverb tails,
  "genre": detected genre name,
  "confidence": 0.0-1.0,
  "notes": "brief pattern description"
}}

Focus on:
1. Count visible hi-hat transients per bar (8=8th notes, 16=16th notes)
2. Kick placement (every beat vs alternating)
3. Snare/clap positioning and layering
4. Reverb tails that may cause double-detection

Return ONLY valid JSON."""


def parse_detection_response(content: str) -> DetectionPatternResult:
    """Parse Gemini response for detection pattern."""
    result = DetectionPatternResult()

    try:
        # Clean response
        content = content.strip()
        if content.startswith('```json'):
            content = content[7:]
        elif content.startswith('```'):
            content = content[3:]
        if content.endswith('```'):
            content = content[:-3]

        # Find JSON
        start = content.find('{')
        end = content.rfind('}') + 1
        if start >= 0 and end > start:
            data = json.loads(content[start:end])

            if 'kick_pattern' in data:
                result.kick_pattern = data['kick_pattern']
            if 'kick_per_bar' in data:
                result.kick_per_bar = int(data['kick_per_bar'])
            if 'snare_pattern' in data:
                result.snare_pattern = data['snare_pattern']
            if 'snare_per_bar' in data:
                result.snare_per_bar = int(data['snare_per_bar'])
            if 'hihat_pattern' in data:
                result.hihat_pattern = data['hihat_pattern']
            if 'hihat_per_bar' in data:
                result.hihat_per_bar = int(data['hihat_per_bar'])
            if 'clap_layered' in data:
                result.clap_layered = bool(data['clap_layered'])
            if 'has_reverb' in data:
                result.has_reverb = bool(data['has_reverb'])
            if 'genre' in data:
                result.genre = data['genre']
            if 'confidence' in data:
                result.confidence = float(data['confidence'])
            if 'notes' in data:
                result.notes = str(data['notes'])
    except Exception as e:
        result.notes = f'Parse error: {e}'

    return result


@app.post('/analyze-for-detection')
async def analyze_for_detection(
    audio: UploadFile = File(...),
    bpm: Optional[float] = Form(default=None),
    model: Optional[str] = Form(default=None),
):
    """
    Analyze audio for rhythm detection configuration.

    Returns pattern analysis to configure detection thresholds:
    - Hi-hat pattern (8th vs 16th notes)
    - Kick pattern (4-on-the-floor vs half-time)
    - Snare/clap layering detection
    - Reverb detection for avoiding double-triggers

    This is a specialized endpoint for the rhythm analyzer integration.
    """
    # Configure Gemini
    configure_gemini()

    # Validate file size
    contents = await audio.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f'File too large. Maximum size is {MAX_FILE_SIZE // (1024 * 1024)}MB'
        )

    # Save to temp file and load
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # Load audio (only first 30 seconds for detection analysis)
        y, sr = librosa.load(tmp_path, sr=44100, mono=False, duration=30)

        # Calculate metrics
        metrics = calculate_audio_metrics(y, sr)

        # Generate spectrogram
        spectrogram_b64, spectrogram_bytes = generate_spectrogram(y, sr)

        # Get model
        provider = api_settings.get('provider', 'google')
        model_name = model or api_settings.get('default_model', DEFAULT_MODEL)

        # Build detection-specific prompt
        prompt = build_detection_prompt(metrics, bpm)

        # Call AI
        if provider == 'openrouter':
            ai_content = call_openrouter(prompt, spectrogram_b64, model_name)
        else:
            gemini_model = genai.GenerativeModel(model_name)
            spectrogram_image = Image.open(io.BytesIO(spectrogram_bytes))

            response = gemini_model.generate_content(
                [prompt, spectrogram_image],
                generation_config=genai.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=1000,
                )
            )
            ai_content = response.text

        # Parse response
        detection_result = parse_detection_response(ai_content)

        return {
            'model': model_name,
            'pattern': detection_result.model_dump(),
            'metrics': {
                'duration': metrics.duration_sec,
                'spectral_centroid': metrics.spectral_centroid_hz,
            },
            'spectrogram_base64': spectrogram_b64,
        }

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# Model cost indicator
MODEL_COSTS = {
    'gemini-2.0-flash': {'tier': 'free', 'cost_per_1k': 0.0},
    'gemini-2.0-flash-exp:free': {'tier': 'free', 'cost_per_1k': 0.0},
    'gemini-2.5-pro': {'tier': 'standard', 'cost_per_1k': 0.00125},
    'gemini-3-pro-preview': {'tier': 'premium', 'cost_per_1k': 0.005},
    'google/gemini-2.0-flash-exp:free': {'tier': 'free', 'cost_per_1k': 0.0},
    'google/gemini-2.5-pro-preview-05-06': {'tier': 'standard', 'cost_per_1k': 0.00125},
    'google/gemini-3-pro-preview': {'tier': 'premium', 'cost_per_1k': 0.005},
}


@app.get('/model-costs')
async def get_model_costs():
    """Get cost information for available models."""
    return {
        'costs': MODEL_COSTS,
        'tiers': {
            'free': 'No cost - good for testing and basic analysis',
            'standard': 'Low cost - balanced accuracy and cost',
            'premium': 'Higher cost - best accuracy for final analysis',
        }
    }


if __name__ == '__main__':
    import uvicorn

    # Start session cleanup timer for memory management
    start_session_cleanup_timer()
    print('Session cleanup timer started (runs every 5 minutes)')

    print(f'Starting Gemini Mix Analyzer on port {PORT}')
    print(f'Default model: {api_settings.get("default_model", DEFAULT_MODEL)}')
    print(f'Provider: {api_settings.get("provider", "google")}')

    if api_settings.get('google_api_key'):
        print('Google API key: configured')
    if api_settings.get('openrouter_api_key'):
        print('OpenRouter API key: configured')
    else:
        print('WARNING: GOOGLE_API_KEY not set! Set it with:')
        print('  export GOOGLE_API_KEY="your_api_key_here"')

    uvicorn.run(app, host='0.0.0.0', port=PORT)
