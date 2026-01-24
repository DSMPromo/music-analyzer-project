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
const PORT = process.env.PORT || 56404;

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
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'audio/mpeg', 'audio/wav', 'audio/flac', 'audio/x-m4a', 'audio/webm',
      'audio/aiff', 'audio/x-aiff', 'audio/aif', 'audio/ogg', 'audio/mp4'
    ];
    // Also check file extension for AIFF (browsers may not set correct mimetype)
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.mp3', '.wav', '.flac', '.m4a', '.webm', '.aif', '.aiff', '.ogg', '.aac'];
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Initialize yt-dlp
const ytdlp = new YtDlp();

// ==================== TICKET DATABASE ====================

const TICKETS_FILE = path.join(__dirname, 'data', 'tickets.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize tickets file if not exists
function loadTickets() {
  try {
    if (fs.existsSync(TICKETS_FILE)) {
      const data = fs.readFileSync(TICKETS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading tickets:', err);
  }
  return { tickets: [], nextId: 1 };
}

function saveTickets(data) {
  try {
    fs.writeFileSync(TICKETS_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error saving tickets:', err);
  }
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Load local file (for Developer Mode test songs)
app.get('/api/load-local-file', (req, res) => {
  const { path: filePath } = req.query;

  if (!filePath) {
    return res.status(400).json({ error: 'path parameter required' });
  }

  // Security: Only allow loading from specific directories
  const allowedPaths = ['/Users/iggy/Am/', '/tmp/'];
  const isAllowed = allowedPaths.some(allowed => filePath.startsWith(allowed));

  if (!isAllowed) {
    return res.status(403).json({ error: 'Access denied - path not in allowed directories' });
  }

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  // Get file extension for content type
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.aif': 'audio/aiff',
    '.aiff': 'audio/aiff',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.flac': 'audio/flac',
  };

  const contentType = contentTypes[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
});

// ==================== TICKET API ====================

// Get all tickets
app.get('/api/tickets', (req, res) => {
  const data = loadTickets();
  const { status, priority, component } = req.query;

  let filtered = data.tickets;
  if (status) filtered = filtered.filter(t => t.status === status);
  if (priority) filtered = filtered.filter(t => t.priority === priority);
  if (component) filtered = filtered.filter(t => t.component === component);

  // Sort by priority and date
  const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  filtered.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] || 99) - (priorityOrder[b.priority] || 99);
    if (pDiff !== 0) return pDiff;
    return new Date(b.created) - new Date(a.created);
  });

  res.json({ tickets: filtered, total: data.tickets.length });
});

// Get ticket stats (MUST be before :id route)
app.get('/api/tickets/stats/summary', (req, res) => {
  const data = loadTickets();
  const stats = {
    total: data.tickets.length,
    open: data.tickets.filter(t => t.status === 'OPEN').length,
    inProgress: data.tickets.filter(t => t.status === 'IN_PROGRESS').length,
    resolved: data.tickets.filter(t => t.status === 'RESOLVED').length,
    byPriority: {
      Critical: data.tickets.filter(t => t.priority === 'Critical' && t.status !== 'RESOLVED').length,
      High: data.tickets.filter(t => t.priority === 'High' && t.status !== 'RESOLVED').length,
      Medium: data.tickets.filter(t => t.priority === 'Medium' && t.status !== 'RESOLVED').length,
      Low: data.tickets.filter(t => t.priority === 'Low' && t.status !== 'RESOLVED').length
    },
    byComponent: {}
  };

  // Group by component
  data.tickets.forEach(t => {
    if (!stats.byComponent[t.component]) {
      stats.byComponent[t.component] = { total: 0, open: 0 };
    }
    stats.byComponent[t.component].total++;
    if (t.status !== 'RESOLVED') {
      stats.byComponent[t.component].open++;
    }
  });

  res.json(stats);
});

// Get single ticket
app.get('/api/tickets/:id', (req, res) => {
  const data = loadTickets();
  const ticket = data.tickets.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  res.json(ticket);
});

// Create ticket
app.post('/api/tickets', (req, res) => {
  const data = loadTickets();
  const { title, description, priority = 'Medium', component = 'General', steps, expected, actual } = req.body;

  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const ticket = {
    id: `TICKET-${String(data.nextId).padStart(3, '0')}`,
    title,
    description: description || '',
    priority,
    component,
    status: 'OPEN',
    created: new Date().toISOString().split('T')[0],
    updated: new Date().toISOString().split('T')[0],
    steps: steps || null,
    expected: expected || null,
    actual: actual || null,
    notes: [],
    relatedIncidents: []
  };

  data.tickets.push(ticket);
  data.nextId++;
  saveTickets(data);

  res.status(201).json(ticket);
});

// Update ticket
app.put('/api/tickets/:id', (req, res) => {
  const data = loadTickets();
  const index = data.tickets.findIndex(t => t.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const { status, priority, title, description, rootCause, resolution, notes, component } = req.body;
  const ticket = data.tickets[index];

  if (status) ticket.status = status;
  if (priority) ticket.priority = priority;
  if (title) ticket.title = title;
  if (description) ticket.description = description;
  if (component) ticket.component = component;
  if (rootCause) ticket.rootCause = rootCause;
  if (resolution) {
    ticket.resolution = resolution;
    ticket.resolved = new Date().toISOString().split('T')[0];
  }
  if (notes) ticket.notes = notes;

  ticket.updated = new Date().toISOString().split('T')[0];

  saveTickets(data);
  res.json(ticket);
});

// Add note to ticket
app.post('/api/tickets/:id/notes', (req, res) => {
  const data = loadTickets();
  const ticket = data.tickets.find(t => t.id === req.params.id);

  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  const { note } = req.body;
  if (!note) {
    return res.status(400).json({ error: 'Note is required' });
  }

  ticket.notes = ticket.notes || [];
  ticket.notes.push({
    text: note,
    timestamp: new Date().toISOString()
  });
  ticket.updated = new Date().toISOString().split('T')[0];

  saveTickets(data);
  res.json(ticket);
});

// Delete ticket
app.delete('/api/tickets/:id', (req, res) => {
  const data = loadTickets();
  const index = data.tickets.findIndex(t => t.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }

  data.tickets.splice(index, 1);
  saveTickets(data);
  res.json({ success: true });
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

// Convert audio file to browser-compatible format (for AIFF, etc.)
// Uses MP3 for smaller file size with high quality (320kbps)
app.post('/api/convert', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  // Use query param to choose format: wav (lossless) or mp3 (smaller)
  const format = req.query.format || 'mp3';
  const outputExt = format === 'wav' ? '.wav' : '.mp3';
  const outputPath = inputPath.replace(/\.[^/.]+$/, `_converted${outputExt}`);

  try {
    // Build FFmpeg args based on format
    let ffmpegArgs;
    if (format === 'wav') {
      // Lossless WAV
      ffmpegArgs = [
        '-y', '-i', inputPath,
        '-acodec', 'pcm_s16le',
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ];
    } else {
      // High-quality MP3 (320kbps) - much smaller file size
      ffmpegArgs = [
        '-y', '-i', inputPath,
        '-codec:a', 'libmp3lame',
        '-b:a', '320k',       // 320kbps for high quality
        '-ar', '44100',
        '-ac', '2',
        outputPath
      ];
    }

    // Convert using FFmpeg
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      let stderr = '';
      ffmpeg.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg failed: ${stderr}`));
        }
      });

      ffmpeg.on('error', (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      });
    });

    // Read converted file and send as response
    const outputBuffer = fs.readFileSync(outputPath);

    // Clean up temp files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    const contentType = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
    res.set({
      'Content-Type': contentType,
      'Content-Length': outputBuffer.length
    });
    res.send(outputBuffer);

  } catch (error) {
    console.error('Audio conversion error:', error);
    // Clean up input file on error
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    res.status(500).json({
      error: 'Failed to convert audio file',
      details: error.message
    });
  }
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
    const midiFilename = path.basename(outputPath);

    res.json({
      success: true,
      filename: midiFilename,
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
    // Use system python3.11 for basic-pitch (doesn't support Python 3.13)
    const pythonPath = '/opt/homebrew/bin/python3.11';

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
