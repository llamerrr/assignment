import { Router } from 'express';

export default function adminRoutes(databaseService, videoService, authMiddleware) {
  const router = Router();

  // Update video visibility (REST compliant: PATCH /api/videos/:id)
  router.patch('/videos/:id', authMiddleware.authRequired, authMiddleware.adminRequired, async (req, res) => {
    const { id } = req.params;
    const { is_public } = req.body;
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      if (is_public !== undefined) {
        // Update public status to specific value
        await databaseService.updateVideoPublic(id, is_public);
      } else {
        // Toggle public status
        await databaseService.toggleVideoPublic(id);
      }
      
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to update video' });
    }
  });

  // Legacy toggle endpoint (for backward compatibility)
  router.post('/videos/:id/toggle-public', authMiddleware.authRequired, authMiddleware.adminRequired, async (req, res) => {
    const { id } = req.params;
    
    try {
      const video = await databaseService.getVideoById(id);
      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      await databaseService.toggleVideoPublic(id);
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to toggle video status' });
    }
  });

  // Bulk transcode endpoint for load testing
  router.post('/bulk-transcode', authMiddleware.authRequired, async (req, res) => {
    const { videoIds, format, resolution, count } = req.body || {};
    const { username, is_admin } = req.user;
    
    if (!videoIds || !Array.isArray(videoIds) || !format) {
      return res.status(400).json({ error: 'videoIds array and format are required' });
    }
    
    const jobs = [];
    const processCount = count || videoIds.length;
    
    try {
      for (let i = 0; i < Math.min(processCount, videoIds.length); i++) {
        const videoId = videoIds[i];
        try {
          const result = await videoService.startTranscode(videoId, format, resolution, username, is_admin);
          jobs.push({
            videoId,
            jobId: result.jobId,
            status: result.status
          });
        } catch (e) {
          jobs.push({
            videoId,
            error: e.message
          });
        }
      }
      
      res.json({
        message: `Started ${jobs.filter(j => !j.error).length} transcode jobs`,
        jobs
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Bulk transcode failed' });
    }
  });

  return router;
}
