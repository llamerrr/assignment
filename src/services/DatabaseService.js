import { createPool } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { config } from '../config/config.js';

class DatabaseService {
  constructor() {
    this.pool = createPool(config.DB);
  }

  async initDb() {
    // Wait for DB readiness (retry loop)
    const start = Date.now();
    while (true) {
      try {
        await this.pool.query('SELECT 1');
        break;
      } catch (e) {
        if (Date.now() - start > 30000) throw new Error('Database connection timeout');
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    // Create tables
    await this.createTables();
    await this.seedAdminUser();
  }

  async createTables() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        is_admin TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await this.pool.query(`
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
      );
    `);

    await this.pool.query(`
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
      );
    `);
  }

  async seedAdminUser() {
    const [adminRows] = await this.pool.query('SELECT id FROM users WHERE username = ?', [config.ADMIN.username]);
    if (!adminRows.length) {
      const hash = await bcrypt.hash(config.ADMIN.password, 12);
      await this.pool.query('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 1)', [config.ADMIN.username, hash]);
      console.log(`Admin user created: ${config.ADMIN.username}`);
    }
  }

  // User queries
  async createUser(username, password) {
    const hash = await bcrypt.hash(password, 12);
    await this.pool.query('INSERT INTO users (username, password_hash, is_admin) VALUES (?, ?, 0)', [username, hash]);
  }

  async getUserByUsername(username) {
    const [rows] = await this.pool.query('SELECT username, password_hash, is_admin FROM users WHERE username = ?', [username]);
    return rows[0] || null;
  }

  async userExists(username) {
    const [rows] = await this.pool.query('SELECT id FROM users WHERE username = ?', [username]);
    return rows.length > 0;
  }

  // Video queries
  async createVideo(video) {
    await this.pool.query(
      'INSERT INTO videos (id, owner, title, original_filename, stored_path, mime, size, duration, is_public) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [video.id, video.owner, video.title, video.original_filename, video.stored_path, video.mime, video.size, video.duration, video.is_public]
    );
  }

  async getVideos(username = null, isAdmin = false) {
    let query, params;
    
    if (isAdmin) {
      query = 'SELECT * FROM videos ORDER BY created_at DESC';
      params = [];
    } else if (username) {
      query = 'SELECT * FROM videos WHERE owner = ? OR is_public = 1 ORDER BY created_at DESC';
      params = [username];
    } else {
      query = 'SELECT * FROM videos WHERE is_public = 1 ORDER BY created_at DESC';
      params = [];
    }
    
    const [rows] = await this.pool.query(query, params);
    return rows;
  }

  async getVideoById(id) {
    const [rows] = await this.pool.query('SELECT * FROM videos WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async updateVideoTitle(id, title) {
    await this.pool.query('UPDATE videos SET title = ? WHERE id = ?', [title, id]);
  }

  async toggleVideoPublic(id) {
    await this.pool.query('UPDATE videos SET is_public = NOT is_public WHERE id = ?', [id]);
  }

  async updateVideoPublic(id, isPublic) {
    await this.pool.query('UPDATE videos SET is_public = ? WHERE id = ?', [isPublic ? 1 : 0, id]);
  }

  async deleteVideo(id) {
    await this.pool.query('DELETE FROM videos WHERE id = ?', [id]);
  }

  async incrementViews(id) {
    await this.pool.query('UPDATE videos SET views = views + 1 WHERE id = ?', [id]);
  }

  // Transcode queries
  async createTranscode(transcode) {
    await this.pool.query(
      'INSERT INTO transcodes (id, video_id, format, resolution, stored_path, status) VALUES (?, ?, ?, ?, ?, ?)',
      [transcode.id, transcode.video_id, transcode.format, transcode.resolution, transcode.stored_path, transcode.status]
    );
  }

  async getTranscodesByVideoId(videoId) {
    const [rows] = await this.pool.query('SELECT * FROM transcodes WHERE video_id = ?', [videoId]);
    return rows;
  }

  async getTranscodeById(id) {
    const [rows] = await this.pool.query('SELECT * FROM transcodes WHERE id = ?', [id]);
    return rows[0] || null;
  }

  async updateTranscodeStatus(id, status, progress = null, error = null) {
    let query = 'UPDATE transcodes SET status = ?';
    const params = [status, id];
    
    if (progress !== null) {
      query += ', progress = ?';
      params.splice(1, 0, progress);
    }
    
    if (error !== null) {
      query += ', error = ?';
      params.splice(-1, 0, error);
    }
    
    query += ' WHERE id = ?';
    await this.pool.query(query, params);
  }

  async close() {
    await this.pool.end();
  }
}

export default DatabaseService;
