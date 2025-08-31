import express from 'express';
import fileUpload from 'express-fileupload';
import morgan from 'morgan';
import path from 'path';
import url from 'url';
import cors from 'cors';

import { config } from '../config/config.js';
import DatabaseService from '../services/DatabaseService.js';
import AuthService from '../services/AuthService.js';
import VideoService from '../services/VideoService.js';
import AuthMiddleware from '../middleware/AuthMiddleware.js';

// Import routes
import authRoutes from '../routes/authRoutes.js';
import videoRoutes from '../routes/videoRoutes.js';
import adminRoutes from '../routes/adminRoutes.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AppController {
  constructor() {
    this.app = express();
    this.initializeServices();
    this.initializeMiddleware();
    this.initializeRoutes();
  }

  initializeServices() {
    // Initialize services
    this.databaseService = new DatabaseService();
    this.authService = new AuthService(this.databaseService);
    this.videoService = new VideoService(this.databaseService);
    this.authMiddleware = new AuthMiddleware(this.authService);
  }

  initializeMiddleware() {
    this.app.use(morgan('dev'));
    this.app.use(express.json());
    this.app.use(cors({ origin: '*', methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','Range'] }));
    this.app.use(fileUpload({ 
      createParentPath: true, 
      useTempFiles: true, 
      tempFileDir: config.TMP_DIR 
    }));
    this.app.use(express.static(path.join(__dirname, '..', '..', 'public')));
  }

  initializeRoutes() {
    // Health check
    this.app.get('/api/health', (req, res) => res.json({ ok: true }));

    // Routes
    this.app.use('/api', authRoutes(this.authService, this.authMiddleware));
    this.app.use('/api', videoRoutes(this.videoService, this.databaseService, this.authMiddleware));
    this.app.use('/api', adminRoutes(this.databaseService, this.videoService, this.authMiddleware));

    // Serve main page
    this.app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
    });

    // Handle 404
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Not found' });
    });
  }

  async start() {
    try {
      // Initialize database
      await this.databaseService.initDb();
      
      // Start server
      this.app.listen(config.PORT, () => {
        console.log(`Server listening on port ${config.PORT}`);
      });
    } catch (error) {
      console.error('Failed to start application:', error);
      process.exit(1);
    }
  }

  async stop() {
    await this.databaseService.close();
  }
}

export default AppController;
