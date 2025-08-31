import fs from 'fs';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import mime from 'mime-types';
import { config } from '../config/config.js';

class VideoService {
  constructor(databaseService) {
    this.db = databaseService;
    this.ensureDirectories();
  }

  ensureDirectories() {
    for (const dir of [config.UPLOAD_DIR, config.VIDEO_DIR, config.THUMBNAIL_DIR, config.TMP_DIR]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async uploadVideo(file, title, isPublic, owner) {
    // Validate file
    if (!file) {
      throw new Error('No file provided');
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime'];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new Error('Invalid file type. Only MP4, WebM, AVI, and MOV files are allowed.');
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB limit
      throw new Error('File too large. Maximum size is 500MB.');
    }

    // Generate unique ID and paths
    const videoId = uuidv4();
    const ext = path.extname(file.name);
    const filename = `${videoId}${ext}`;
    const videoPath = path.join(config.VIDEO_DIR, filename);

    // Move file to video directory
    await file.mv(videoPath);

    // Get video duration
    const duration = await this.getVideoDuration(videoPath);

    // Generate thumbnail
    await this.generateThumbnail(videoId, videoPath);

    // Save to database
    const video = {
      id: videoId,
      owner,
      title: title || file.name,
      original_filename: file.name,
      stored_path: videoPath,
      mime: file.mimetype,
      size: file.size,
      duration,
      is_public: isPublic ? 1 : 0
    };

    await this.db.createVideo(video);

    return {
      id: videoId,
      title: video.title,
      duration,
      size: file.size
    };
  }

  async getVideoDuration(videoPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (err, metadata) => {
        if (err) {
          console.error('Error getting video duration:', err);
          resolve(0);
        } else {
          resolve(Math.round(metadata.format.duration || 0));
        }
      });
    });
  }

  async generateThumbnail(videoId, inputPath) {
    console.log(`Generating thumbnail for video ${videoId}: ${inputPath}`);
    
    try {
      const thumbnailPath = path.join(config.THUMBNAIL_DIR, `${videoId}.jpg`);
      
      return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .on('end', () => {
            console.log(`Thumbnail generated: ${thumbnailPath}`);
            resolve(thumbnailPath);
          })
          .on('error', (err) => {
            console.error('Thumbnail generation failed:', err);
            resolve(null);
          })
          .screenshots({
            timestamps: ['10%'],
            filename: `${videoId}.jpg`,
            folder: config.THUMBNAIL_DIR,
            size: '320x240'
          });
      });
    } catch (err) {
      console.error('Error in generateThumbnail:', err);
      return null;
    }
  }

  async startTranscode(videoId, format, resolution, username, isAdmin) {
    // Validate access
    const video = await this.db.getVideoById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    if (!isAdmin && video.owner !== username) {
      throw new Error('Access denied');
    }

    // Validate format and resolution
    if (!config.VIDEO.validFormats.includes(format)) {
      throw new Error(`Invalid format. Valid formats: ${config.VIDEO.validFormats.join(', ')}`);
    }

    if (resolution && !config.VIDEO.validResolutions.includes(resolution)) {
      throw new Error(`Invalid resolution. Valid resolutions: ${config.VIDEO.validResolutions.join(', ')}`);
    }

    // Check if transcode already exists
    const existingTranscodes = await this.db.getTranscodesByVideoId(videoId);
    const existing = existingTranscodes.find(t => 
      t.format === format && t.resolution === resolution && t.status !== 'error'
    );

    if (existing) {
      return { jobId: existing.id, status: existing.status };
    }

    // Create new transcode job
    const jobId = uuidv4();
    const ext = format === 'webm' ? '.webm' : format === 'avi' ? '.avi' : '.mp4';
    const outputFilename = resolution 
      ? `${videoId}_${resolution}${ext}`
      : `${videoId}_${format}${ext}`;
    const outputPath = path.join(config.VIDEO_DIR, outputFilename);

    const transcode = {
      id: jobId,
      video_id: videoId,
      format,
      resolution,
      stored_path: outputPath,
      status: 'pending'
    };

    await this.db.createTranscode(transcode);

    // Start processing (async)
    this.runTranscode(jobId, video.stored_path, outputPath, format, resolution);

    return { jobId, status: 'pending' };
  }

  async runTranscode(jobId, inputPath, outPath, format, resolution) {
    console.log(`Starting transcode job ${jobId}: ${inputPath} -> ${outPath} (${format}${resolution ? `, ${resolution}` : ''})`);
    
    try {
      await this.db.updateTranscodeStatus(jobId, 'processing', 0);

      return new Promise((resolve, reject) => {
        let command = ffmpeg(inputPath);

        // Set video codec and format
        if (format === 'mp4') {
          command = command.videoCodec('libx264').format('mp4');
        } else if (format === 'webm') {
          command = command.videoCodec('libvpx-vp9').format('webm');
        } else if (format === 'avi') {
          command = command.videoCodec('libx264').format('avi');
        }

        // Set resolution if specified
        if (resolution) {
          const resMap = {
            '480p': '854x480',
            '720p': '1280x720', 
            '1080p': '1920x1080',
            '1440p': '2560x1440',
            '4k': '3840x2160'
          };
          command = command.size(resMap[resolution]);
        }

        command
          .on('progress', async (progress) => {
            const percent = Math.round(progress.percent || 0);
            await this.db.updateTranscodeStatus(jobId, 'processing', percent);
            console.log(`Transcode ${jobId} progress: ${percent}%`);
          })
          .on('end', async () => {
            await this.db.updateTranscodeStatus(jobId, 'done', 100);
            console.log(`Transcode completed: ${jobId}`);
            resolve();
          })
          .on('error', async (err) => {
            console.error(`Transcode failed: ${jobId}`, err);
            await this.db.updateTranscodeStatus(jobId, 'error', null, err.message);
            reject(err);
          })
          .save(outPath);
      });
    } catch (err) {
      console.error(`Transcode error: ${jobId}`, err);
      await this.db.updateTranscodeStatus(jobId, 'error', null, err.message);
      throw err;
    }
  }

  async getVideoVersions(videoId, username, isAdmin) {
    const video = await this.db.getVideoById(videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    if (!isAdmin && video.owner !== username && !video.is_public) {
      throw new Error('Access denied');
    }

    const transcodes = await this.db.getTranscodesByVideoId(videoId);

    // Shape expected by frontend download modal: { original, transcoded: [] }
    const result = {
      original: {
        id: 'original',
        format: path.extname(video.stored_path).slice(1),
        resolution: 'original',
        size: video.size,
        status: 'done'
      },
      transcoded: []
    };

    // Transcoded versions
    for (const t of transcodes) {
      if (t.status === 'done' && fs.existsSync(t.stored_path)) {
        const stats = fs.statSync(t.stored_path);
        result.transcoded.push({
          id: t.id,
          format: t.format,
          resolution: t.resolution || 'original',
          size: stats.size,
          status: t.status
        });
      }
    }

    return result;
  }

  getThumbnailPath(videoId) {
    return path.join(config.THUMBNAIL_DIR, `${videoId}.jpg`);
  }

  async deleteVideoFiles(videoId) {
    const video = await this.db.getVideoById(videoId);
    if (!video) return;

    // Delete original file
    if (fs.existsSync(video.stored_path)) {
      fs.unlinkSync(video.stored_path);
    }

    // Delete thumbnail
    const thumbnailPath = this.getThumbnailPath(videoId);
    if (fs.existsSync(thumbnailPath)) {
      fs.unlinkSync(thumbnailPath);
    }

    // Delete transcoded files
    const transcodes = await this.db.getTranscodesByVideoId(videoId);
    for (const transcode of transcodes) {
      if (fs.existsSync(transcode.stored_path)) {
        fs.unlinkSync(transcode.stored_path);
      }
    }
  }
}

export default VideoService;
