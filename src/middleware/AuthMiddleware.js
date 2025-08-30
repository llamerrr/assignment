class AuthMiddleware {
  constructor(authService) {
    this.authService = authService;
  }

  // Require authentication
  authRequired = (req, res, next) => {
    const token = this.authService.extractTokenFromHeader(req.headers['authorization']);
    if (!token) {
      return res.status(401).json({ error: 'Missing token' });
    }

    try {
      const payload = this.authService.verifyToken(token);
      req.user = payload; // { username, is_admin }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // Optional authentication (doesn't fail if no token)
  authOptional = (req, res, next) => {
    const token = this.authService.extractTokenFromHeader(req.headers['authorization']);
    if (token) {
      try {
        const payload = this.authService.verifyToken(token);
        req.user = payload;
      } catch (e) {
        req.user = null;
      }
    } else {
      req.user = null;
    }
    next();
  };

  // Require admin privileges
  adminRequired = (req, res, next) => {
    if (req.user?.is_admin) {
      return next();
    }
    return res.status(403).json({ error: 'Admin only' });
  };
}

export default AuthMiddleware;
