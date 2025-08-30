import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { config } from '../config/config.js';

export default function videoRoutes(videoService, databaseService, authMiddleware) {
  const router = Router();

  // Upload video (REST compliant: POST /api/videos)
  router.post('/videos', authMiddleware.authRequired, async (req, res) => {
    try {
      const { title, is_public } = req.body;
      const file = req.files?.video;

      if (!file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const result = await videoService.uploadVideo(file, title, is_public === 'true', req.user.username);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message || 'Upload failed' });
    }
  });

  // Legacy upload endpoint (for backward compatibility)
  router.post('/upload', authMiddleware.authRequired, async (req, res) => {
    try {
      const { title, is_public } = req.body;
      const file = req.files?.video;

      if (!file) {
        return res.status(400).json({ error: 'No video file provided' });
      }

      const result = await videoService.uploadVideo(file, title, is_public === 'true', req.user.username);
      res.status(201).json(result);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message || 'Upload failed' });
    }
  });

  // List videos
  router.get('/videos', authMiddleware.authOptional, async (req, res) => {
    try {
      const { username, is_admin } = req.user || {};
      const videos = await databaseService.getVideos(username, is_admin);
      res.json(videos);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  });

  // Get single video details
  router.get('/videos/:id', authMiddleware.authOptional, async (req, res) => {
    const { id } = req.params;
    const { username, is_admin } = req.user || {};
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      // Check access permissions
      if (!is_admin && video.owner !== username && !video.is_public) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(video);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  });

  // Serve thumbnail images
  router.get('/thumbnails/:id', (req, res) => {
    const { id } = req.params;
    const thumbnailPath = videoService.getThumbnailPath(id);
    
    if (!fs.existsSync(thumbnailPath)) {
      return res.status(404).json({ error: 'Thumbnail not found' });
    }
    
    res.sendFile(thumbnailPath);
  });

  // Stream video for playback
  router.get('/videos/:id/stream', async (req, res) => {
    const { id } = req.params;
    const token = req.query.token || authMiddleware.authService.extractTokenFromHeader(req.headers['authorization']);
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      let user = null;
      if (token) {
        try {
          user = authMiddleware.authService.verifyToken(token);
        } catch (e) {
          // Invalid token, continue as guest
        }
      }

      // Check access permissions
      if (!user?.is_admin && video.owner !== user?.username && !video.is_public) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Increment view count
      await databaseService.incrementViews(id);

      // Stream the file
      if (!fs.existsSync(video.stored_path)) {
        return res.status(404).json({ error: 'Video file not found' });
      }

      const stat = fs.statSync(video.stored_path);
      const fileSize = stat.size;
      const range = req.headers.range;

      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(video.stored_path, { start, end });
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
        fs.createReadStream(video.stored_path).pipe(res);
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Streaming failed' });
    }
  });

  // Download video
  router.get('/videos/:id/download', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { username, is_admin } = req.user;
    const format = (req.query.format || '').toString();
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!is_admin && video.owner !== username) {
        return res.status(403).json({ error: 'Access denied' });
      }

      let filePath = video.stored_path;
      let filename = video.original_filename;

      // Check for specific format
      if (format) {
        const transcodes = await databaseService.getTranscodesByVideoId(id);
        const transcode = transcodes.find(t => t.format === format && t.status === 'done');
        if (transcode && fs.existsSync(transcode.stored_path)) {
          filePath = transcode.stored_path;
          filename = `${path.parse(video.original_filename).name}_${format}.${format}`;
        }
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
      }

      res.download(filePath, filename);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // Get available video versions
  router.get('/videos/:id/versions', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { username, is_admin } = req.user;
    
    try {
      const versions = await videoService.getVideoVersions(id, username, is_admin);
      res.json(versions);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Failed to fetch versions' });
    }
  });

  // Create transcode job (REST compliant: POST /api/transcodes)
  router.post('/transcodes', authMiddleware.authRequired, async (req, res) => {
    const { video_id, format, resolution } = req.body || {};
    const { username, is_admin } = req.user;
    
    if (!video_id || !format) {
      return res.status(400).json({ error: 'video_id and format are required' });
    }
    
    try {
      const result = await videoService.startTranscode(video_id, format, resolution, username, is_admin);
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Transcode failed' });
    }
  });

  // Legacy transcode endpoint (for backward compatibility)
  router.post('/videos/:id/transcode', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { format, resolution } = req.body || {};
    const { username, is_admin } = req.user;
    
    if (!format) {
      return res.status(400).json({ error: 'Format is required' });
    }
    
    try {
      const result = await videoService.startTranscode(id, format, resolution, username, is_admin);
      res.status(201).json(result);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Transcode failed' });
    }
  });

  // Get all transcodes for a video (REST compliant)
  router.get('/videos/:id/transcodes', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { username, is_admin } = req.user;
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!is_admin && video.owner !== username) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const transcodes = await databaseService.getTranscodesByVideoId(id);
      res.json(transcodes);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch transcodes' });
    }
  });

  // Get specific transcode by ID (REST compliant)
  router.get('/transcodes/:id', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    
    try {
      const transcode = await databaseService.getTranscodeById(id);
      if (!transcode) {
        return res.status(404).json({ error: 'Transcode not found' });
      }
      
      res.json(transcode);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch transcode' });
    }
  });

  // Get transcode status (legacy compatibility)
  router.get('/transcodes/:jobId/status', authMiddleware.authRequired, async (req, res) => {
    const { jobId } = req.params;
    
    try {
      const transcode = await databaseService.getTranscodeById(jobId);
      if (!transcode) {
        return res.status(404).json({ error: 'Transcode job not found' });
      }
      
      res.json({
        id: transcode.id,
        status: transcode.status,
        progress: transcode.progress,
        error: transcode.error
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to fetch transcode status' });
    }
  });

  // Update video title
  router.put('/videos/:id', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { title } = req.body;
    const { username, is_admin } = req.user;
    
    if (!title || title.trim().length < 1) {
      return res.status(400).json({ error: 'Title is required' });
    }
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!is_admin && video.owner !== username) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await databaseService.updateVideoTitle(id, title.trim());
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update video' });
    }
  });

  // Delete video
  router.delete('/videos/:id', authMiddleware.authRequired, async (req, res) => {
    const { id } = req.params;
    const { username, is_admin } = req.user;
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (!is_admin && video.owner !== username) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete files
      await videoService.deleteVideoFiles(id);
      
      // Delete from database
      await databaseService.deleteVideo(id);
      
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  });

  return router;
}
