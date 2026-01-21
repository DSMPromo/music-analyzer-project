// ==================== BACKEND SERVER ====================
// server/index.js

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { YtDlp } = require('ytdlp-nodejs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'temp');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-m4a', 'audio/webm'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Initialize yt-dlp
const ytdlp = new YtDlp();

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Upload audio file
app.post('/api/upload', upload.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  res.json({
    success: true,
    filename: req.file.filename,
    path: req.file.path,
    size: req.file.size,
    mimetype: req.file.mimetype
  });
});

// Extract audio from YouTube
app.post('/api/youtube/extract', async (req, res) => {
  const { url } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: 'No URL provided' });
  }
  
  // Validate YouTube URL
  const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
  if (!youtubeRegex.test(url)) {
    return res.status(400).json({ error: 'Invalid YouTube URL' });
  }
  
  try {
    // Get video info
    const info = await ytdlp.getInfoAsync(url);
    const safeTitle = info.title.replace(/[^\w\s-]/g, '').slice(0, 50);
    const outputPath = path.join(__dirname, 'temp', `${safeTitle}-${Date.now()}.wav`);
    
    // Download audio only as WAV
    await ytdlp.downloadAsync(url, {
      format: 'bestaudio',
      output: outputPath.replace('.wav', '.%(ext)s'),
      extractAudio: true,
      audioFormat: 'wav',
      audioQuality: 0
    });
    
    res.json({
      success: true,
      title: info.title,
      duration: info.duration,
      path: outputPath,
      thumbnail: info.thumbnail
    });
    
  } catch (error) {
    console.error('YouTube extraction error:', error);
    res.status(500).json({ 
      error: 'Failed to extract audio from YouTube',
      details: error.message 
    });
  }
});

// Generate MIDI using Basic Pitch
app.post('/api/midi/generate', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }
  
  const inputPath = req.file.path;
  const outputPath = inputPath.replace(/\.[^/.]+$/, '.mid');
  
  // Options from request body
  const options = {
    onset_threshold: parseFloat(req.body.onsetThreshold) || 0.5,
    frame_threshold: parseFloat(req.body.frameThreshold) || 0.3,
    min_note_len: parseInt(req.body.minNoteLength) || 58,
    min_freq: req.body.minFreq ? parseFloat(req.body.minFreq) : null,
    max_freq: req.body.maxFreq ? parseFloat(req.body.maxFreq) : null
  };
  
  try {
    // Call Python script for Basic Pitch
    const result = await runBasicPitch(inputPath, outputPath, options);
    
    // Read the generated MIDI file
    const midiBuffer = fs.readFileSync(outputPath);
    
    res.json({
      success: true,
      midiPath: outputPath,
      notes: result.notes,
      events: result.events
    });
    
  } catch (error) {
    console.error('MIDI generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate MIDI',
      details: error.message 
    });
  }
});

// Download generated MIDI file
app.get('/api/midi/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'temp', req.params.filename);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.download(filePath);
});

// Claude AI analysis endpoint
app.post('/api/claude/analyze', async (req, res) => {
  const { chordProgression, key, tempo, structure } = req.body;
  
  // This would call Claude API in production
  // For now, return mock suggestions
  const suggestions = [
    {
      type: 'harmony',
      description: 'Chord Substitution',
      suggestion: `Consider using a tritone substitution in measure 4: replace the V chord with bII7 for a jazzier sound.`
    },
    {
      type: 'rhythm',
      description: 'Rhythmic Variation',
      suggestion: 'Add syncopation to the bass line by anticipating beat 3 with an eighth note.'
    },
    {
      type: 'structure',
      description: 'Song Structure',
      suggestion: 'Consider adding a pre-chorus section between verse and chorus to build tension.'
    },
    {
      type: 'production',
      description: 'Production Tip',
      suggestion: 'For this key and tempo, try doubling the melody an octave higher with a synth pad.'
    }
  ];
  
  res.json({ suggestions });
});

// ==================== HELPER FUNCTIONS ====================

function runBasicPitch(inputPath, outputPath, options) {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'midi_generator.py');
    const pythonPath = path.join(__dirname, 'venv', 'bin', 'python');

    const process = spawn(pythonPath, [
      pythonScript,
      inputPath,
      outputPath,
      JSON.stringify(options)
    ]);
    
    let stdout = '';
    let stderr = '';
    
    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    process.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve(result);
        } catch (e) {
          resolve({ notes: 0, events: [] });
        }
      } else {
        reject(new Error(stderr || 'Basic Pitch process failed'));
      }
    });
    
    process.on('error', (err) => {
      reject(err);
    });
  });
}

// Clean up old files (run every hour)
function cleanupOldFiles() {
  const tempDir = path.join(__dirname, 'temp');
  const maxAge = 60 * 60 * 1000; // 1 hour
  
  if (!fs.existsSync(tempDir)) return;
  
  const files = fs.readdirSync(tempDir);
  const now = Date.now();
  
  files.forEach(file => {
    const filePath = path.join(tempDir, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtimeMs > maxAge) {
      fs.unlinkSync(filePath);
      console.log(`Cleaned up: ${file}`);
    }
  });
}

setInterval(cleanupOldFiles, 60 * 60 * 1000);

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log(`🎵 Music Analyzer Server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  
  // Ensure temp directory exists
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
});

module.exports = app;
