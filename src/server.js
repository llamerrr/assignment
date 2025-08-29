import fs from 'fs';
import path from 'path';
import url from 'url';
import express from 'express';
import fileUpload from 'express-fileupload';
import jwt from 'jsonwebtoken';
import { createPool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import morgan from 'morgan';
import mime from 'mime-types';
import dotenv from 'dotenv';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Config
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'data', 'uploads');
const VIDEO_DIR = process.env.VIDEO_DIR || path.join(__dirname, '..', 'data', 'videos');
const THUMBNAIL_DIR = process.env.THUMBNAIL_DIR || path.join(__dirname, '..', 'data', 'thumbnails');
const TMP_DIR = process.env.TMP_DIR || path.join(__dirname, '..', 'data', 'tmp');

// Admin credentials
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// Ensure directories
for (const d of [UPLOAD_DIR, VIDEO_DIR, THUMBNAIL_DIR, TMP_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

// DB pool
const pool = createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'app',
  password: process.env.DB_PASSWORD || 'apppass',
  database: process.env.DB_NAME || 'videos',
  connectionLimit: 10
});

// Initialize DB schema
async function initDb() {
  // Wait for DB readiness (retry loop)
  const start = Date.now();
  while (true) {
    try {
      await pool.query('SELECT 1');
      break;
    } catch (e) {
      if (Date.now() - start > 30000) throw new Error('DB not ready');
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  await pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_admin TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS videos (
    id VARCHAR(64) PRIMARY KEY,
    owner VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    stored_path VARCHAR(512) NOT NULL,
    mime VARCHAR(100) NOT NULL,
    size BIGINT NOT NULL,
    duration INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    views INT DEFAULT 0
  );`);

  await pool.query(`
  CREATE TABLE IF NOT EXISTS transcodes (
    id VARCHAR(64) PRIMARY KEY,
    video_id VARCHAR(64) NOT NULL,
    format VARCHAR(20) NOT NULL,
    resolution VARCHAR(10) DEFAULT NULL,
    stored_path VARCHAR(512) NOT NULL,
    status ENUM('pending','processing','done','error') NOT NULL DEFAULT 'pending',
    progress INT DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
  );`);

  // Seed admin user
  const [adminRows] = await pool.query('SELECT id FROM users WHERE username = ?', [ADMIN_USERNAME]);
  if (!adminRows.length) {
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await pool.query('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', [ADMIN_USERNAME, hash]);
    console.log(`Admin user created: ${ADMIN_USERNAME}`);
  }
}

// Auth middleware
function authRequired(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { username, is_admin }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Optional auth middleware (doesn't fail if no token)
function authOptional(req, res, next) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload; // { username, is_admin }
    } catch (e) {
      // Invalid token, but continue without user
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

// Admin check
function adminRequired(req, res, next) {
  if (req.user?.is_admin) return next();
  return res.status(403).json({ error: 'Admin only' });
}

const app = express();
app.use(morgan('dev'));
app.use(express.json());
app.use(fileUpload({ createParentPath: true, useTempFiles: true, tempFileDir: TMP_DIR }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.get('/api/health', (req, res) => res.json({ ok: true }));

// Register new user
app.post('/api/register', async (req, res) => {
  try{
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    const uname = String(username).trim();
    if (!/^[A-Za-z0-9_\-]{3,20}$/.test(uname)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, _, -)' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const [rows] = await pool.query('SELECT id FROM users WHERE username = ?', [uname]);
    if (rows.length) return res.status(409).json({ error: 'Username already taken' });
    
    const hash = await bcrypt.hash(password, 12);
    await pool.query('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)', [uname, hash]);
    res.json({ success: true, message: 'Account created successfully' });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try{
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
    
    const [rows] = await pool.query('SELECT username, password_hash, is_admin FROM users WHERE username = ?', [username]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    
    const user = rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ error: 'Invalid credentials' });
    
    const token = jwt.sign({ 
      username: user.username, 
      is_admin: !!user.is_admin 
    }, JWT_SECRET, { expiresIn: '24h' });
    
    res.json({ token, user: { username: user.username, is_admin: !!user.is_admin } });
  }catch(e){
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Who am I
app.get('/api/me', authRequired, (req, res) => {
  res.json({ username: req.user.username, is_admin: !!req.user.is_admin });
});

// Upload video
app.post('/api/upload', authRequired, async (req, res) => {
  try {
    if (!req.files || !req.files.video) return res.status(400).json({ error: 'No video file uploaded' });
    
    const file = req.files.video;
    const { title, is_public } = req.body;
    
    if (!title || title.trim().length < 1) {
      return res.status(400).json({ error: 'Video title required' });
    }
    
    // Convert is_public string to boolean (defaults to false/private)
    const isPublic = is_public === 'true' ? 1 : 0;
    
    // Validate video file
    if (!file.mimetype.startsWith('video/')) {
      return res.status(400).json({ error: 'File must be a video' });
    }
    
    const id = uuidv4();
    const ext = path.extname(file.name) || '.mp4';
    const destPath = path.join(UPLOAD_DIR, `${id}${ext}`);
    await file.mv(destPath);

    await pool.query(
      'INSERT INTO videos (id, owner, title, original_filename, stored_path, mime, size, is_public) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.user.username, title.trim(), file.name, destPath, file.mimetype, file.size, isPublic]
    );

    // Generate thumbnail asynchronously (don't wait for it)
    process.nextTick(() => generateThumbnail(id, destPath).catch(err => console.error('Thumbnail generation failed:', err)));

    res.json({ 
      success: true, 
      video: { id, title: title.trim(), filename: file.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// List videos (public for browse, all for admin, own for users)
app.get('/api/videos', authOptional, async (req, res) => {
  try {
    const { username, is_admin } = req.user || {};
    let query, params = [];
    
    if (is_admin) {
      query = 'SELECT v.*, u.username as owner_name FROM videos v LEFT JOIN users u ON v.owner = u.username ORDER BY v.created_at DESC';
    } else if (username) {
      query = 'SELECT v.*, u.username as owner_name FROM videos v LEFT JOIN users u ON v.owner = u.username WHERE v.owner = ? OR v.is_public = 1 ORDER BY v.created_at DESC';
      params = [username];
    } else {
      query = 'SELECT v.*, u.username as owner_name FROM videos v LEFT JOIN users u ON v.owner = u.username WHERE v.is_public = 1 ORDER BY v.created_at DESC';
    }
    
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to list videos' });
  }
});

// Serve thumbnail images
app.get('/api/thumbnails/:id', (req, res) => {
  const { id } = req.params;
  const thumbnailPath = path.join(THUMBNAIL_DIR, `${id}.jpg`);
  
  if (!fs.existsSync(thumbnailPath)) {
    return res.status(404).json({ error: 'Thumbnail not found' });
  }
  
  res.sendFile(thumbnailPath);
});

// Get single video details
app.get('/api/videos/:id', authOptional, async (req, res) => {
  const { id } = req.params;
  const { username, is_admin } = req.user || {};
  
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Video not found' });
    
    const video = rows[0];
    
    // Check permissions
    if (!video.is_public && video.owner !== username && !is_admin) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Increment view count
    await pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [id]);
    video.views += 1;
    
    res.json(video);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get video' });
  }
});

// Download original or transcoded file
app.get('/api/videos/:id/download', authRequired, async (req, res) => {
  const { id } = req.params;
  const { username, is_admin } = req.user;
  const format = (req.query.format || '').toString();
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const video = rows[0];
    if (!is_admin && video.owner !== username) return res.status(403).json({ error: 'Forbidden' });

    let filePath = video.stored_path;
    let downloadName = path.basename(video.original_filename);
    if (format) {
      const [trows] = await pool.query('SELECT * FROM transcodes WHERE video_id = ? AND format = ? AND status = "done"', [id, format]);
      if (!trows.length) return res.status(404).json({ error: 'Transcoded file not ready' });
      filePath = trows[0].stored_path;
      const base = path.parse(downloadName).name;
      downloadName = `${base}.${format}`;
    }
    return res.download(filePath, downloadName);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Download failed' });
  }
});

// Stream video for playback (supports token in query or public videos)
app.get('/api/videos/:id/stream', async (req, res) => {
  const { id } = req.params;
  const token = req.query.token || (req.headers['authorization'] && req.headers['authorization'].startsWith('Bearer ') ? req.headers['authorization'].slice(7) : null);
  
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const video = rows[0];
    
    // Check if video is public or user has access
    let hasAccess = video.is_public;
    if (!hasAccess && token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        hasAccess = payload.is_admin || video.owner === payload.username;
      } catch (e) {
        // Invalid token, but continue if video is public
      }
    }
    
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Serve the video file with proper headers for streaming
    const filePath = video.stored_path;
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Support range requests for video seeking
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': video.mime,
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': video.mime,
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// Get available video versions (original + transcoded)
app.get('/api/videos/:id/versions', authRequired, async (req, res) => {
  const { id } = req.params;
  const { username, is_admin } = req.user;
  
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const video = rows[0];
    
    // Check access
    if (!is_admin && video.owner !== username && !video.is_public) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const response = {
      original: {
        format: path.extname(video.original_filename).slice(1).toLowerCase(),
        size: video.size,
        filename: video.original_filename
      },
      transcoded: []
    };
    
    // Check for transcoded files
    const videoBasename = path.basename(video.stored_path, path.extname(video.stored_path));
    const formats = ['mp4', 'webm', 'avi'];
    const resolutions = ['480p', '720p', '1080p', '1440p', '4k'];
    
    for (const format of formats) {
      // Check original resolution transcoded file
      const originalTranscodedPath = path.join(VIDEO_DIR, `${videoBasename}.${format}`);
      if (fs.existsSync(originalTranscodedPath) && originalTranscodedPath !== video.stored_path) {
        const stat = fs.statSync(originalTranscodedPath);
        response.transcoded.push({
          format,
          size: stat.size,
          resolution: null,
          codec: format === 'mp4' ? 'H.264' : format === 'webm' ? 'VP9' : 'H.264',
          filename: `${path.parse(video.original_filename).name}.${format}`
        });
      }
      
      // Check resolution-specific transcoded files
      for (const resolution of resolutions) {
        const transcodedPath = path.join(VIDEO_DIR, `${videoBasename}_${resolution}.${format}`);
        if (fs.existsSync(transcodedPath)) {
          const stat = fs.statSync(transcodedPath);
          response.transcoded.push({
            format,
            size: stat.size,
            resolution,
            codec: format === 'mp4' ? 'H.264' : format === 'webm' ? 'VP9' : 'H.264',
            filename: `${path.parse(video.original_filename).name}_${resolution}.${format}`
          });
        }
      }
    }
    
    res.json(response);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get video versions' });
  }
});

// Request a transcode with different resolutions and formats
app.post('/api/videos/:id/transcode', authRequired, async (req, res) => {
  const { id } = req.params;
  const { format, resolution } = req.body || {};
  const { username, is_admin } = req.user;
  
  if (!format) return res.status(400).json({ error: 'Format required (mp4, webm, avi)' });
  
  const validFormats = ['mp4', 'webm', 'avi'];
  const validResolutions = ['480p', '720p', '1080p', '1440p', '4k'];
  
  if (!validFormats.includes(format)) {
    return res.status(400).json({ error: 'Invalid format. Use: mp4, webm, avi' });
  }
  
  if (resolution && !validResolutions.includes(resolution)) {
    return res.status(400).json({ error: 'Invalid resolution. Use: 480p, 720p, 1080p, 1440p, 4k' });
  }
  
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Video not found' });
    
    const video = rows[0];
    if (!is_admin && video.owner !== username) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const jobId = uuidv4();
    const filename = resolution ? `${id}_${resolution}.${format}` : `${id}.${format}`;
    const outPath = path.join(VIDEO_DIR, filename);
    
    await pool.query(
      'INSERT INTO transcodes (id, video_id, format, resolution, stored_path, status) VALUES (?,?,?,?,?,?)', 
      [jobId, id, format, resolution || null, outPath, 'pending']
    );

    // Start async transcode job
    process.nextTick(() => runTranscode(jobId, video.stored_path, outPath, format, resolution).catch(err => console.error('Transcode failed:', err)));

    res.json({ 
      success: true, 
      jobId, 
      status: 'queued',
      format,
      resolution: resolution || 'original'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to queue transcode' });
  }
});

// Get transcode job status (for load testing)
app.get('/api/transcodes/:jobId/status', authRequired, async (req, res) => {
  const { jobId } = req.params;
  try {
    const [rows] = await pool.query('SELECT * FROM transcodes WHERE id = ?', [jobId]);
    if (!rows.length) return res.status(404).json({ error: 'Job not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to get job status' });
  }
});

// Bulk transcode endpoint for load testing
app.post('/api/bulk-transcode', authRequired, async (req, res) => {
  const { videoIds, format, resolution, count } = req.body || {};
  const { username, is_admin } = req.user;
  
  if (!videoIds || !Array.isArray(videoIds) || !format) {
    return res.status(400).json({ error: 'videoIds array and format required' });
  }
  
  const jobs = [];
  const processCount = count || videoIds.length;
  
  try {
    for (let i = 0; i < processCount; i++) {
      const videoId = videoIds[i % videoIds.length]; // Cycle through videos
      
      const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [videoId]);
      if (!rows.length) continue;
      
      const video = rows[0];
      if (!is_admin && video.owner !== username) continue;

      const jobId = uuidv4();
      const filename = resolution ? `${videoId}_${i}_${resolution}.${format}` : `${videoId}_${i}.${format}`;
      const outPath = path.join(VIDEO_DIR, filename);
      
      await pool.query(
        'INSERT INTO transcodes (id, video_id, format, resolution, stored_path, status) VALUES (?,?,?,?,?,?)', 
        [jobId, videoId, format, resolution || null, outPath, 'pending']
      );

      jobs.push(jobId);
      
      // Start async transcode job
      process.nextTick(() => runTranscode(jobId, video.stored_path, outPath, format, resolution).catch(err => console.error('Transcode failed:', err)));
    }

    res.json({ 
      success: true, 
      message: `${jobs.length} transcode jobs queued`,
      jobIds: jobs
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to queue bulk transcodes' });
  }
});
app.post('/api/videos/:id/toggle-public', authRequired, adminRequired, async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('UPDATE videos SET is_public = 1 - is_public WHERE id = ?', [id]);
    const [rows] = await pool.query('SELECT id, is_public FROM videos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to toggle' });
  }
});

// Update video title
app.put('/api/videos/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const { username, is_admin } = req.user;
  
  if (!title || title.trim().length < 1) {
    return res.status(400).json({ error: 'Title required' });
  }
  
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Video not found' });
    
    const video = rows[0];
    if (!is_admin && video.owner !== username) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await pool.query('UPDATE videos SET title = ? WHERE id = ?', [title.trim(), id]);
    res.json({ success: true, message: 'Video title updated' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

app.delete('/api/videos/:id', authRequired, async (req, res) => {
  const { id } = req.params;
  const { username, is_admin } = req.user;
  try {
    const [rows] = await pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const video = rows[0];
    if (!is_admin && video.owner !== username) return res.status(403).json({ error: 'Forbidden' });

    // Delete files
    try { fs.unlinkSync(video.stored_path); } catch {}
    const [trows] = await pool.query('SELECT * FROM transcodes WHERE video_id = ?', [id]);
    for (const t of trows) { try { fs.unlinkSync(t.stored_path); } catch {} }

    await pool.query('DELETE FROM videos WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Delete failed' });
  }
});

// Simple homepage UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

async function runTranscode(jobId, inputPath, outPath, format, resolution) {
  console.log(`Starting transcode job ${jobId}: ${inputPath} -> ${outPath} (${format}${resolution ? `, ${resolution}` : ''})`);
  
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    
    await pool.query('UPDATE transcodes SET status = ?, progress = ? WHERE id = ?', ['processing', 0, jobId]);
    console.log(`Transcode job ${jobId} status updated to processing`);
    
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath);
      
      // Set output format and codecs based on target format
      if (format === 'mp4') {
        cmd = cmd
          .toFormat('mp4')
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset medium',    // Good balance of speed/quality
            '-crf 23',          // Constant rate factor for quality
            '-movflags +faststart' // Enable fast start for web
          ]);
      } else if (format === 'webm') {
        cmd = cmd
          .toFormat('webm')
          .videoCodec('libvpx-vp9')
          .audioCodec('libopus')
          .outputOptions([
            '-cpu-used 2',      // VP9 encoding speed
            '-crf 30',          // Quality setting for VP9
            '-b:v 0'           // Variable bitrate
          ]);
      } else if (format === 'avi') {
        cmd = cmd
          .toFormat('avi')
          .videoCodec('libx264')
          .audioCodec('mp3')
          .outputOptions([
            '-preset fast',
            '-crf 23'
          ]);
      }
      
      // Apply resolution scaling if specified
      if (resolution) {
        const resMap = {
          '480p': '854x480',
          '720p': '1280x720', 
          '1080p': '1920x1080',
          '1440p': '2560x1440',
          '4k': '3840x2160'
        };
        const size = resMap[resolution];
        if (size) {
          cmd = cmd.size(size);
          console.log(`Transcode job ${jobId} scaling to ${resolution} (${size})`);
          
          // Adjust encoding settings for higher resolutions
          if (resolution === '4k' || resolution === '1440p') {
            cmd = cmd.outputOptions(['-preset slow', '-crf 20']); // Better quality for 4K
          }
        }
      }
      
      cmd
        .on('start', (commandLine) => {
          console.log(`Transcode job ${jobId} started with command: ${commandLine}`);
        })
        .on('error', (err) => {
          console.error(`Transcode job ${jobId} error:`, err);
          reject(err);
        })
        .on('progress', async (progress) => {
          const percent = Math.round(progress.percent || 0);
          console.log(`Transcode job ${jobId} progress: ${percent}%`);
          try {
            await pool.query('UPDATE transcodes SET progress = ? WHERE id = ?', [percent, jobId]);
          } catch (e) {
            console.error(`Failed to update progress for job ${jobId}:`, e);
          }
        })
        .on('end', () => {
          console.log(`Transcode job ${jobId} completed successfully`);
          resolve();
        })
        .save(outPath);
    });
    
    await pool.query('UPDATE transcodes SET status = ?, progress = ? WHERE id = ?', ['done', 100, jobId]);
    console.log(`Transcode job ${jobId} marked as done`);
  } catch (err) {
    console.error(`Transcode job ${jobId} failed:`, err);
    await pool.query('UPDATE transcodes SET status = ?, error = ? WHERE id = ?', ['error', String(err), jobId]);
    throw err;
  }
}

// Generate thumbnail for a video
async function generateThumbnail(videoId, inputPath) {
  console.log(`Generating thumbnail for video ${videoId}: ${inputPath}`);
  
  try {
    // Check if input file exists
    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input file not found: ${inputPath}`);
    }
    
    const thumbnailPath = path.join(THUMBNAIL_DIR, `${videoId}.jpg`);
    
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .on('start', (commandLine) => {
          console.log(`Thumbnail generation started: ${commandLine}`);
        })
        .on('error', (err) => {
          console.error(`Thumbnail generation failed for ${videoId}:`, err);
          reject(err);
        })
        .on('end', () => {
          console.log(`Thumbnail generated successfully for ${videoId}`);
          resolve();
        })
        .screenshots({
          timestamps: ['10%'], // Take screenshot at 10% of video duration
          filename: `${videoId}.jpg`,
          folder: THUMBNAIL_DIR,
          size: '320x180' // 16:9 aspect ratio thumbnail
        });
    });
    
    return thumbnailPath;
  } catch (err) {
    console.error(`Thumbnail generation failed for ${videoId}:`, err);
    throw err;
  }
}

initDb()
  .then(() => {
    app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
  })
  .catch((e) => {
    console.error('Failed to init DB', e);
    process.exit(1);
  });
