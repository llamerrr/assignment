import { Router } from 'express';

export default function authRoutes(authService, authMiddleware) {
  const router = Router();

  // Register new user
  router.post('/register', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const result = await authService.register(username, password);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Registration failed' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const result = await authService.login(username, password);
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(401).json({ error: e.message || 'Login failed' });
    }
  });

  // Get current user info
  router.get('/me', authMiddleware.authRequired, (req, res) => {
    res.json({ 
      username: req.user.username, 
      is_admin: !!req.user.is_admin 
    });
  });

  return router;
}
