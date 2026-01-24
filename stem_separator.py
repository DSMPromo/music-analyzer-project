"""
Stem Separator - FastAPI Backend
Audio stem separation using Demucs with MIDI generation per stem.
Includes artifact reduction using spectral denoising.

Port: 56402 (within reserved range 56400-56411)

Usage:
    export GOOGLE_API_KEY="your_key" (for MIDI)
    python stem_separator.py
"""

import os
import io
import base64
import tempfile
import shutil
import subprocess
from pathlib import Path
from typing import Optional
import uuid
import numpy as np
import time
import threading
import gc

from fastapi import FastAPI, File, UploadFile, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

# Try to import audio processing libraries
try:
    import soundfile as sf
    import noisereduce as nr
    ARTIFACT_REDUCTION_AVAILABLE = True
except ImportError:
    ARTIFACT_REDUCTION_AVAILABLE = False
    print("Warning: soundfile or noisereduce not installed. Artifact reduction disabled.")
    print("Install with: pip install soundfile noisereduce")

# Configuration
PORT = 56402
STEMS_DIR = Path(tempfile.gettempdir()) / 'music-analyzer-stems'
STEMS_DIR.mkdir(exist_ok=True)

app = FastAPI(
    title='Stem Separator',
    description='Audio stem separation using Demucs with MIDI generation',
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

# Track separation jobs
separation_jobs = {}

# Memory management: job expiry settings
JOB_EXPIRY_HOURS = 2  # Jobs older than 2 hours are cleaned up


def cleanup_old_jobs():
    """Remove jobs older than JOB_EXPIRY_HOURS to free memory."""
    now = time.time()
    expired = [
        job_id for job_id, job in separation_jobs.items()
        if now - job.get('created_at', 0) > JOB_EXPIRY_HOURS * 3600
    ]

    for job_id in expired:
        # Clean up files
        job_dir = STEMS_DIR / job_id
        if job_dir.exists():
            try:
                shutil.rmtree(job_dir)
            except Exception:
                pass
        # Remove from tracking
        del separation_jobs[job_id]

    # Run garbage collection after cleanup
    if expired:
        gc.collect()
        print(f'Cleaned up {len(expired)} expired jobs')


# Job cleanup timer - runs every 30 minutes
_job_cleanup_timer_started = False


def start_job_cleanup_timer():
    """Start a background timer that cleans up old jobs every 30 minutes."""
    global _job_cleanup_timer_started
    if _job_cleanup_timer_started:
        return

    def cleanup_loop():
        cleanup_old_jobs()
        # Reschedule
        timer = threading.Timer(1800, cleanup_loop)  # 1800 seconds = 30 minutes
        timer.daemon = True
        timer.start()

    # Start initial timer
    timer = threading.Timer(1800, cleanup_loop)
    timer.daemon = True
    timer.start()
    _job_cleanup_timer_started = True


class StemInfo(BaseModel):
    name: str
    filename: str
    size_bytes: int
    download_url: str


class SeparationResult(BaseModel):
    job_id: str
    status: str
    model: str
    stems: list[StemInfo]
    original_filename: str


class JobStatus(BaseModel):
    job_id: str
    status: str  # pending, processing, completed, failed
    progress: Optional[str] = None
    error: Optional[str] = None
    result: Optional[SeparationResult] = None


def run_demucs(input_path: str, output_dir: str, model: str = 'htdemucs') -> list[str]:
    """Run Demucs stem separation."""
    # Get the venv python path
    venv_python = Path(__file__).parent / 'venv' / 'bin' / 'python3.13'

    cmd = [
        str(venv_python), '-m', 'demucs',
        '--out', output_dir,
        '-n', model,
        '--mp3',  # Output as MP3 for smaller file sizes
        input_path
    ]

    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=600  # 10 minute timeout
    )

    if result.returncode != 0:
        raise RuntimeError(f'Demucs failed: {result.stderr}')

    # Find output stems
    input_name = Path(input_path).stem
    stems_path = Path(output_dir) / model / input_name

    if not stems_path.exists():
        raise RuntimeError(f'Stems directory not found: {stems_path}')

    stem_files = list(stems_path.glob('*.mp3')) + list(stems_path.glob('*.wav'))
    return [str(f) for f in stem_files]


def reduce_artifacts(audio_path: str, output_path: str, reduction_level: int = 50, stem_type: str = 'other') -> bool:
    """
    Apply artifact reduction to a stem file using spectral denoising.

    Args:
        audio_path: Path to input audio file
        output_path: Path to save processed audio
        reduction_level: 0-100, higher = more aggressive reduction
        stem_type: Type of stem (vocals, drums, bass, other) for optimized settings

    Returns:
        True if successful, False otherwise
    """
    if not ARTIFACT_REDUCTION_AVAILABLE:
        # Just copy the file if libraries not available
        shutil.copy(audio_path, output_path)
        return False

    try:
        # Load audio
        audio, sample_rate = sf.read(audio_path)

        # Handle mono/stereo
        is_mono = len(audio.shape) == 1
        if is_mono:
            audio = audio.reshape(-1, 1)

        # Calculate parameters based on reduction level and stem type
        # reduction_level: 0 = no reduction, 100 = maximum reduction
        prop_decrease = min(0.95, reduction_level / 100 * 0.8 + 0.1)  # 0.1 to 0.9

        # Stem-specific settings
        if stem_type == 'vocals':
            # Vocals: preserve formants, focus on high-freq artifacts
            n_fft = 2048
            freq_mask_smooth_hz = 500
            time_mask_smooth_ms = 50
        elif stem_type == 'drums':
            # Drums: preserve transients, short time windows
            n_fft = 1024
            freq_mask_smooth_hz = 200
            time_mask_smooth_ms = 20
        elif stem_type == 'bass':
            # Bass: larger FFT for low frequencies
            n_fft = 4096
            freq_mask_smooth_hz = 100
            time_mask_smooth_ms = 100
        else:
            # Other/general: balanced settings
            n_fft = 2048
            freq_mask_smooth_hz = 300
            time_mask_smooth_ms = 50

        # Process each channel
        processed_channels = []
        for ch in range(audio.shape[1]):
            channel_audio = audio[:, ch]

            # Apply spectral gating / noise reduction
            reduced = nr.reduce_noise(
                y=channel_audio,
                sr=sample_rate,
                prop_decrease=prop_decrease,
                n_fft=n_fft,
                freq_mask_smooth_hz=freq_mask_smooth_hz,
                time_mask_smooth_ms=time_mask_smooth_ms,
                stationary=False,  # Non-stationary for music
                n_std_thresh_stationary=1.5,
                use_torch=False,  # Use scipy for compatibility
            )
            processed_channels.append(reduced)

        # Combine channels
        if is_mono:
            processed_audio = processed_channels[0]
        else:
            processed_audio = np.column_stack(processed_channels)

        # Normalize to prevent clipping
        max_val = np.max(np.abs(processed_audio))
        if max_val > 0.99:
            processed_audio = processed_audio * 0.99 / max_val

        # Save processed audio
        sf.write(output_path, processed_audio, sample_rate)
        return True

    except Exception as e:
        print(f"Artifact reduction failed for {audio_path}: {e}")
        # Fall back to copying original
        shutil.copy(audio_path, output_path)
        return False


def process_separation(job_id: str, input_path: str, model: str, original_filename: str, artifact_reduction: int = 0):
    """Background task to process stem separation."""
    try:
        separation_jobs[job_id]['status'] = 'processing'
        separation_jobs[job_id]['progress'] = 'Running Demucs separation...'

        # Create output directory for this job
        job_dir = STEMS_DIR / job_id
        job_dir.mkdir(exist_ok=True)

        # Run Demucs
        stem_files = run_demucs(input_path, str(job_dir), model)

        # Build stem info
        stems = []
        total_stems = len(stem_files)

        for idx, stem_path in enumerate(stem_files):
            stem_file = Path(stem_path)
            stem_name = stem_file.stem  # drums, bass, vocals, other

            # Determine output path
            dest_path = job_dir / f'{stem_name}.mp3'

            # Apply artifact reduction if requested
            if artifact_reduction > 0 and ARTIFACT_REDUCTION_AVAILABLE:
                separation_jobs[job_id]['progress'] = f'Reducing artifacts: {stem_name} ({idx + 1}/{total_stems})...'

                # Need to convert MP3 to WAV for processing, then back
                temp_wav = job_dir / f'{stem_name}_temp.wav'
                processed_wav = job_dir / f'{stem_name}_processed.wav'

                # Convert MP3 to WAV using ffmpeg
                subprocess.run([
                    'ffmpeg', '-y', '-i', stem_path,
                    '-acodec', 'pcm_s16le', '-ar', '44100',
                    str(temp_wav)
                ], capture_output=True, timeout=60)

                # Apply artifact reduction
                reduce_artifacts(
                    str(temp_wav),
                    str(processed_wav),
                    reduction_level=artifact_reduction,
                    stem_type=stem_name
                )

                # Convert back to MP3
                subprocess.run([
                    'ffmpeg', '-y', '-i', str(processed_wav),
                    '-codec:a', 'libmp3lame', '-qscale:a', '2',
                    str(dest_path)
                ], capture_output=True, timeout=60)

                # Clean up temp files
                temp_wav.unlink(missing_ok=True)
                processed_wav.unlink(missing_ok=True)
            else:
                # No artifact reduction - just copy
                if stem_path != str(dest_path):
                    shutil.copy(stem_path, dest_path)

            stems.append(StemInfo(
                name=stem_name,
                filename=f'{stem_name}.mp3',
                size_bytes=dest_path.stat().st_size,
                download_url=f'/stems/{job_id}/{stem_name}.mp3'
            ))

        # Update job status
        separation_jobs[job_id]['status'] = 'completed'
        separation_jobs[job_id]['progress'] = None
        separation_jobs[job_id]['result'] = SeparationResult(
            job_id=job_id,
            status='completed',
            model=model,
            stems=stems,
            original_filename=original_filename
        )

    except Exception as e:
        separation_jobs[job_id]['status'] = 'failed'
        separation_jobs[job_id]['error'] = str(e)
        separation_jobs[job_id]['progress'] = None

    finally:
        # Clean up input file
        try:
            os.unlink(input_path)
        except:
            pass


@app.get('/health')
async def health_check():
    """Health check endpoint."""
    return {'status': 'ok', 'service': 'stem-separator'}


@app.post('/separate')
async def separate_stems(
    background_tasks: BackgroundTasks,
    audio: UploadFile = File(...),
    model: str = Form(default='htdemucs'),
    artifact_reduction: int = Form(default=0)
):
    """
    Start stem separation job.

    Models available:
    - htdemucs (default): Best quality, 4 stems (drums, bass, vocals, other)
    - htdemucs_ft: Fine-tuned version, slightly better quality
    - htdemucs_6s: 6 stems (drums, bass, vocals, guitar, piano, other)

    Artifact reduction:
    - 0: No artifact reduction (default)
    - 1-30: Light reduction (subtle cleanup)
    - 31-60: Medium reduction (balanced)
    - 61-100: Heavy reduction (aggressive, may affect quality)
    """
    # Validate model
    valid_models = ['htdemucs', 'htdemucs_ft', 'htdemucs_6s', 'mdx_extra']
    if model not in valid_models:
        raise HTTPException(400, f'Invalid model. Choose from: {valid_models}')

    # Validate artifact reduction level
    artifact_reduction = max(0, min(100, artifact_reduction))

    # Generate job ID
    job_id = str(uuid.uuid4())[:8]

    # Save uploaded file
    contents = await audio.read()

    # Check file size (max 200MB for separation)
    if len(contents) > 200 * 1024 * 1024:
        raise HTTPException(400, 'File too large. Maximum size is 200MB')

    # Save to temp file
    suffix = Path(audio.filename).suffix or '.wav'
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(contents)
        input_path = tmp.name

    # Initialize job status with created_at for expiry tracking
    separation_jobs[job_id] = {
        'status': 'pending',
        'progress': 'Starting separation...',
        'error': None,
        'result': None,
        'artifact_reduction': artifact_reduction,
        'created_at': time.time()  # For job expiry tracking
    }

    # Start background processing
    background_tasks.add_task(
        process_separation,
        job_id,
        input_path,
        model,
        audio.filename,
        artifact_reduction
    )

    return {'job_id': job_id, 'status': 'pending', 'artifact_reduction': artifact_reduction}


@app.get('/jobs/{job_id}', response_model=JobStatus)
async def get_job_status(job_id: str):
    """Get the status of a separation job."""
    if job_id not in separation_jobs:
        raise HTTPException(404, 'Job not found')

    job = separation_jobs[job_id]
    return JobStatus(
        job_id=job_id,
        status=job['status'],
        progress=job.get('progress'),
        error=job.get('error'),
        result=job.get('result')
    )


@app.get('/stems/{job_id}/{filename}')
async def download_stem(job_id: str, filename: str):
    """Download a separated stem file."""
    stem_path = STEMS_DIR / job_id / filename

    if not stem_path.exists():
        raise HTTPException(404, 'Stem file not found')

    return FileResponse(
        path=str(stem_path),
        media_type='audio/mpeg',
        filename=filename
    )


@app.get('/stems/{job_id}/{filename}/base64')
async def get_stem_base64(job_id: str, filename: str):
    """Get a separated stem as base64 for inline playback."""
    stem_path = STEMS_DIR / job_id / filename

    if not stem_path.exists():
        raise HTTPException(404, 'Stem file not found')

    with open(stem_path, 'rb') as f:
        data = f.read()

    return {
        'filename': filename,
        'data': base64.b64encode(data).decode('utf-8'),
        'mime_type': 'audio/mpeg'
    }


@app.delete('/jobs/{job_id}')
async def cleanup_job(job_id: str):
    """Clean up a job and its files."""
    # Remove from tracking
    if job_id in separation_jobs:
        del separation_jobs[job_id]

    # Remove files
    job_dir = STEMS_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir)

    return {'status': 'cleaned'}


@app.get('/models')
async def list_models():
    """List available Demucs models."""
    return {
        'models': [
            {
                'id': 'htdemucs',
                'name': 'HT Demucs',
                'description': 'Default model, 4 stems (drums, bass, vocals, other)',
                'stems': ['drums', 'bass', 'vocals', 'other']
            },
            {
                'id': 'htdemucs_ft',
                'name': 'HT Demucs Fine-tuned',
                'description': 'Fine-tuned for slightly better quality',
                'stems': ['drums', 'bass', 'vocals', 'other']
            },
            {
                'id': 'htdemucs_6s',
                'name': 'HT Demucs 6-stem',
                'description': '6 stems including guitar and piano',
                'stems': ['drums', 'bass', 'vocals', 'guitar', 'piano', 'other']
            }
        ],
        'default': 'htdemucs'
    }


if __name__ == '__main__':
    import uvicorn

    # Start job cleanup timer for memory management
    start_job_cleanup_timer()
    print('Job cleanup timer started (runs every 30 minutes)')

    print(f'Starting Stem Separator on port {PORT}')
    print(f'Stems directory: {STEMS_DIR}')
    uvicorn.run(app, host='0.0.0.0', port=PORT)
