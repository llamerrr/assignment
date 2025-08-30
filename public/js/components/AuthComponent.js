class AuthComponent {
  constructor() {
    this.currentUser = null;
  }

  async loadUser() {
    try {
      const user = await apiService.me();
      this.currentUser = user;
      return user;
    } catch (e) {
      localStorage.removeItem('token');
      this.currentUser = null;
      return null;
    }
  }

  renderAuthPage() {
    return `
      <div class="auth-container">
        <div class="auth-card">
          <h2 class="auth-title" id="auth-title">Sign In</h2>
          <form id="auth-form">
            <div class="form-group">
              <label class="form-label">Username</label>
              <input type="text" class="form-input" id="username" required>
              <div class="form-hint" id="username-hint" style="display: none;">
                Username must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens.
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Password</label>
              <input type="password" class="form-input" id="password" required>
              <div class="form-hint" id="password-hint" style="display: none;">
                Password must be at least 6 characters long.
              </div>
            </div>
            <button type="submit" class="btn btn-primary btn-full" id="auth-submit">Sign In</button>
          </form>
          <div class="auth-switch">
            <span id="auth-switch-text">Don't have an account?</span>
            <a href="#" id="auth-switch-link">Sign up</a>
          </div>
        </div>
      </div>
    `;
  }

  toggleAuthMode() {
    const isLogin = document.getElementById('auth-title').textContent === 'Sign In';
    
    if (isLogin) {
      document.getElementById('auth-title').textContent = 'Sign Up';
      document.getElementById('auth-submit').textContent = 'Sign Up';
      document.getElementById('auth-switch-text').textContent = 'Already have an account?';
      document.getElementById('auth-switch-link').textContent = 'Sign in';
      // Show validation hints for sign up
      document.getElementById('username-hint').style.display = 'block';
      document.getElementById('password-hint').style.display = 'block';
    } else {
      document.getElementById('auth-title').textContent = 'Sign In';
      document.getElementById('auth-submit').textContent = 'Sign In';
      document.getElementById('auth-switch-text').textContent = "Don't have an account?";
      document.getElementById('auth-switch-link').textContent = 'Sign up';
      // Hide validation hints for sign in
      document.getElementById('username-hint').style.display = 'none';
      document.getElementById('password-hint').style.display = 'none';
    }
  }

  async handleAuth() {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const isLogin = document.getElementById('auth-title').textContent === 'Sign In';

    // Client-side validation for sign up
    if (!isLogin) {
      const usernameValid = /^[A-Za-z0-9_\-]{3,20}$/.test(username.trim());
      const passwordValid = password.length >= 6;

      if (!usernameValid) {
        notificationService.showError('Username must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens.');
        return;
      }

      if (!passwordValid) {
        notificationService.showError('Password must be at least 6 characters long.');
        return;
      }
    }

    try {
      if (isLogin) {
        const response = await apiService.login(username, password);
        localStorage.setItem('token', response.token);
        this.currentUser = response.user;
      } else {
        await apiService.register(username, password);
        // Auto-login after registration
        const response = await apiService.login(username, password);
        localStorage.setItem('token', response.token);
        this.currentUser = response.user;
      }
      
      // Trigger app refresh
      window.app?.renderApp();
      if (window.app?.loadVideos) {
        await window.app.loadVideos();
      }
    } catch (e) {
      notificationService.showError(e.error || 'Authentication failed');
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.currentUser = null;
    // Trigger app refresh
    window.app?.renderApp();
  }

  setupAuthEventListeners() {
    // Auth form submission
    document.addEventListener('submit', (e) => {
      if (e.target.id === 'auth-form') {
        e.preventDefault();
        this.handleAuth();
      }
    });

    // Auth mode toggle
    document.addEventListener('click', (e) => {
      if (e.target.id === 'auth-switch-link') {
        e.preventDefault();
        this.toggleAuthMode();
      }
      
      if (e.target.id === 'logout') {
        this.logout();
      }
    });
  }
}

// Export singleton instance
window.authComponent = new AuthComponent();
