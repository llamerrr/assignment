import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from '../config/config.js';

class AuthService {
  constructor(databaseService) {
    this.db = databaseService;
  }

  async register(username, password) {
    // Validate username
    const uname = String(username).trim();
    if (!/^[A-Za-z0-9_\-]{3,20}$/.test(uname)) {
      throw new Error('Username must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens');
    }

    // Validate password
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    // Check if user exists
    if (await this.db.userExists(uname)) {
      throw new Error('Username already exists');
    }

    // Create user
    await this.db.createUser(uname, password);
    return { success: true, message: 'Account created successfully' };
  }

  async login(username, password) {
    const user = await this.db.getUserByUsername(username);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new Error('Invalid credentials');
    }

    const token = jwt.sign(
      { username: user.username, is_admin: !!user.is_admin },
      config.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return {
      token,
      user: {
        username: user.username,
        is_admin: !!user.is_admin
      }
    };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, config.JWT_SECRET);
    } catch (e) {
      throw new Error('Invalid token');
    }
  }

  extractTokenFromHeader(authHeader) {
    if (!authHeader) return null;
    return authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  }
}

export default AuthService;
