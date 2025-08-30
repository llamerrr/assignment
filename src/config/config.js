import path from 'path';
import url from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Server config
  PORT: Number(process.env.PORT || 3000),
  JWT_SECRET: process.env.JWT_SECRET || 'change_me',
  
  // Directories
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'data', 'uploads'),
  VIDEO_DIR: process.env.VIDEO_DIR || path.join(__dirname, '..', '..', 'data', 'videos'),
  THUMBNAIL_DIR: process.env.THUMBNAIL_DIR || path.join(__dirname, '..', '..', 'data', 'thumbnails'),
  TMP_DIR: process.env.TMP_DIR || path.join(__dirname, '..', '..', 'data', 'tmp'),
  
  // Database config
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'app',
    password: process.env.DB_PASSWORD || 'apppass',
    database: process.env.DB_NAME || 'videos',
    connectionLimit: 10
  },
  
  // Admin credentials
  ADMIN: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin'
  },
  
  // Video processing
  VIDEO: {
    validFormats: ['mp4', 'webm', 'avi'],
    validResolutions: ['480p', '720p', '1080p', '1440p', '4k']
  }
};
