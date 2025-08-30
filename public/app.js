class VideoApp {
  constructor() {
    this.currentUser = null;
    this.videos = [];
    this.currentUploadStep = 1;
    this.notificationId = 0;
    this.init();
  }

  async init() {
    await this.loadUser();
    this.renderApp();
    this.setupEventListeners();
    if (this.currentUser) {
      await this.loadVideos();
    }
  }

  // Notification System
  showNotification(message, type = 'info', duration = 5000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const id = ++this.notificationId;
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.setAttribute('data-id', id);
    
    const icon = this.getNotificationIcon(type);
    
    notification.innerHTML = `
      <div class="notification-content">
        <span class="notification-icon">${icon}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="app.closeNotification(${id})">&times;</button>
      </div>
      <div class="notification-progress"></div>
    `;

    container.appendChild(notification);

    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);

    // Auto remove after duration
    if (duration > 0) {
      const progressBar = notification.querySelector('.notification-progress');
      progressBar.style.animationDuration = `${duration}ms`;
      progressBar.classList.add('animate');
      
      setTimeout(() => {
        this.closeNotification(id);
      }, duration);
    }

    return id;
  }

  closeNotification(id) {
    const notification = document.querySelector(`[data-id="${id}"]`);
    if (notification) {
      notification.classList.add('hide');
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      loading: '⏳'
    };
    return icons[type] || icons.info;
  }

  // Modern confirm dialog
  showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
      const modal = document.getElementById('confirm-modal');
      const titleEl = document.getElementById('confirm-title');
      const messageEl = document.getElementById('confirm-message');
      const yesBtn = document.getElementById('confirm-yes');
      const noBtn = document.getElementById('confirm-no');

      titleEl.textContent = title;
      messageEl.textContent = message;

      const handleYes = () => {
        cleanup();
        resolve(true);
      };

      const handleNo = () => {
        cleanup();
        resolve(false);
      };

      const cleanup = () => {
        modal.classList.add('hidden');
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
        document.removeEventListener('keydown', handleKeydown);
      };

      const handleKeydown = (e) => {
        if (e.key === 'Escape') handleNo();
        if (e.key === 'Enter') handleYes();
      };

      yesBtn.addEventListener('click', handleYes);
      noBtn.addEventListener('click', handleNo);
      document.addEventListener('keydown', handleKeydown);

      modal.classList.remove('hidden');
      yesBtn.focus();
    });
  }

  // Modern input dialog
  showInput(message, title = 'Input Required', placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.getElementById('input-modal');
      const titleEl = document.getElementById('input-title');
      const messageEl = document.getElementById('input-message');
      const inputEl = document.getElementById('input-field');
      const submitBtn = document.getElementById('input-submit');
      const cancelBtn = document.getElementById('input-cancel');

      titleEl.textContent = title;
      messageEl.textContent = message;
      inputEl.placeholder = placeholder;
      inputEl.value = defaultValue;

      const handleSubmit = () => {
        const value = inputEl.value.trim();
        cleanup();
        resolve(value || null);
      };

      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      const cleanup = () => {
        modal.classList.add('hidden');
        submitBtn.removeEventListener('click', handleSubmit);
        cancelBtn.removeEventListener('click', handleCancel);
        inputEl.removeEventListener('keydown', handleKeydown);
        document.removeEventListener('keydown', handleEscapeKeydown);
      };

      const handleKeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSubmit();
        }
      };

      const handleEscapeKeydown = (e) => {
        if (e.key === 'Escape') handleCancel();
      };

      submitBtn.addEventListener('click', handleSubmit);
      cancelBtn.addEventListener('click', handleCancel);
      inputEl.addEventListener('keydown', handleKeydown);
      document.addEventListener('keydown', handleEscapeKeydown);

      modal.classList.remove('hidden');
      inputEl.focus();
      inputEl.select();
    });
  }

  // Convenience methods
  showSuccess(message, duration = 4000) {
    return this.showNotification(message, 'success', duration);
  }

  showError(message, duration = 6000) {
    return this.showNotification(message, 'error', duration);
  }

  showWarning(message, duration = 5000) {
    return this.showNotification(message, 'warning', duration);
  }

  showInfo(message, duration = 4000) {
    return this.showNotification(message, 'info', duration);
  }

  showLoading(message) {
    return this.showNotification(message, 'loading', 0); // 0 = don't auto-close
  }

  // Download Modal Methods
  async showDownloadModal(videoId) {
    try {
      // Get available versions from server
      const versions = await this.request(`/api/videos/${videoId}/versions`);
      
      const modal = document.getElementById('download-modal');
      const optionsContainer = document.getElementById('download-options');
      
      // Build download options
      let optionsHtml = '';
      
      // Original version
      optionsHtml += `
        <div class="download-option">
          <div class="download-option-info">
            <h4>Original</h4>
            <p>Download the original uploaded file</p>
            <div class="download-meta">
              <span class="download-format">${versions.original.format.toUpperCase()}</span>
              <span class="download-size">${this.formatFileSize(versions.original.size)}</span>
            </div>
          </div>
          <button class="btn btn-primary download-option-btn" data-video-id="${videoId}" data-format="">
            Download
          </button>
        </div>
      `;
      
      // Transcoded versions
      if (versions.transcoded && versions.transcoded.length > 0) {
        versions.transcoded.forEach(version => {
          optionsHtml += `
            <div class="download-option">
              <div class="download-option-info">
                <h4>Transcoded - ${version.format.toUpperCase()}</h4>
                <p>${version.resolution ? `${version.resolution} resolution` : 'Original resolution'}</p>
                <div class="download-meta">
                  <span class="download-format">${version.format.toUpperCase()}</span>
                  <span class="download-size">${this.formatFileSize(version.size)}</span>
                  <span class="download-codec">${version.codec || 'Standard codec'}</span>
                </div>
              </div>
              <button class="btn btn-secondary download-option-btn" data-video-id="${videoId}" data-format="${version.format}">
                Download
              </button>
            </div>
          `;
        });
      } else {
        optionsHtml += `
          <div class="download-option-empty">
            <p>No transcoded versions available yet.</p>
            <p><small>Use the "Encode" button to create different formats.</small></p>
          </div>
        `;
      }
      
      optionsContainer.innerHTML = optionsHtml;
      modal.classList.remove('hidden');
      
    } catch (e) {
      console.error('Failed to load download options:', e);
      this.showError('Failed to load download options. Using fallback...');
      // Fallback to direct download
      this.downloadVideo(videoId);
    }
  }

  closeDownloadModal() {
    const modal = document.getElementById('download-modal');
    modal.classList.add('hidden');
  }

  async request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(path, { ...options, headers });
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw data;
      return data;
    }
    
    if (!response.ok) throw new Error(response.statusText);
    return response;
  }

  async loadUser() {
    try {
      const user = await this.request('/api/me');
      this.currentUser = user;
    } catch (e) {
      this.currentUser = null;
      localStorage.removeItem('token');
    }
  }

  async loadVideos() {
    try {
      this.videos = await this.request('/api/videos');
      this.renderVideos();
    } catch (e) {
      console.error('Failed to load videos:', e);
    }
  }

  renderApp() {
    const app = document.getElementById('app');
    
    if (!this.currentUser) {
      app.innerHTML = this.renderAuthPage();
    } else {
      app.innerHTML = this.renderMainPage();
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

  renderMainPage() {
    return `
      <header class="header">
        <div class="container">
          <div class="header-content">
            <a href="#" class="logo">AwesomeShare</a>
            <nav class="nav-menu">
              <a href="#" class="nav-link" data-page="home">Home</a>
              <a href="#" class="nav-link" data-page="upload">Upload</a>
              ${this.currentUser.is_admin ? '<a href="#" class="nav-link" data-page="admin">Admin</a>' : ''}
            </nav>
            <div class="user-menu">
              <span class="user-info">
                ${this.currentUser.username}
                ${this.currentUser.is_admin ? '<span class="admin-badge">ADMIN</span>' : ''}
              </span>
              <button class="btn btn-secondary btn-sm" id="logout">Logout</button>
            </div>
          </div>
        </div>
      </header>
      
      <main class="main">
        <div class="container">
          <div id="page-content">
            ${this.renderHomePage()}
          </div>
        </div>
      </main>
      
            </div>
      
      <!-- Notification Container -->
      <div id="notification-container"></div>
      
      <!-- Confirmation Modal -->
      <div id="confirm-modal" class="modal hidden">
        <div class="modal-content modal-small">
          <div class="modal-header">
            <h3 class="modal-title" id="confirm-title">Confirm Action</h3>
          </div>
          <div class="modal-body">
            <p id="confirm-message">Are you sure you want to proceed?</p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-danger" id="confirm-yes">Yes</button>
            <button class="btn btn-secondary" id="confirm-no">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Input Modal -->
      <div id="input-modal" class="modal hidden">
        <div class="modal-content modal-small">
          <div class="modal-header">
            <h3 class="modal-title" id="input-title">Input Required</h3>
          </div>
          <div class="modal-body">
            <p id="input-message">Please enter a value:</p>
            <div class="form-group">
              <input type="text" class="form-input" id="input-field" placeholder="">
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" id="input-submit">Submit</button>
            <button class="btn btn-secondary" id="input-cancel">Cancel</button>
          </div>
        </div>
      </div>
      
      <!-- Download Modal -->
      <div id="download-modal" class="modal hidden">
        <div class="modal-content modal-small">
          <div class="modal-header">
            <h3 class="modal-title">Download Video</h3>
            <button class="modal-close" id="download-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <p>Choose which version to download:</p>
            <div class="download-options" id="download-options">
              <!-- Options will be populated dynamically -->
            </div>
          </div>
        </div>
      </div>
      
      <div id="video-modal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title" id="modal-title">Video Player</h3>
            <button class="modal-close" id="modal-close">&times;</button>
          </div>
          <div class="modal-body" id="modal-body">
          </div>
        </div>
      </div>
      
      <div id="transcode-modal" class="modal hidden">
        <div class="modal-content">
          <div class="modal-header">
            <h3 class="modal-title">Transcode Video</h3>
            <button class="modal-close" id="transcode-modal-close">&times;</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Output Format</label>
              <select class="form-input" id="transcode-format">
                <option value="mp4">MP4 (H.264)</option>
                <option value="webm">WebM (VP9)</option>
                <option value="avi">AVI (H.264)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Resolution</label>
              <select class="form-input" id="transcode-resolution">
                <option value="">Keep Original</option>
                <option value="480p">480p (854x480)</option>
                <option value="720p">720p (1280x720)</option>
                <option value="1080p">1080p (1920x1080)</option>
                <option value="1440p">1440p (2560x1440)</option>
                <option value="4k">4K (3840x2160)</option>
              </select>
            </div>
            <div class="form-group">
              <div class="transcode-info">
                <p><strong>Note:</strong> Transcoding is a CPU-intensive process. Higher resolutions (1440p, 4K) will take significantly longer.</p>
                <p>You can monitor progress in the browser console and download the transcoded version once complete.</p>
              </div>
            </div>
            <div class="modal-actions">
              <button class="btn btn-primary" id="start-transcode-btn">Start Transcoding</button>
              <button class="btn btn-secondary" id="cancel-transcode-btn">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderHomePage() {
    return `
      <div class="section">
        <h2 class="section-title">Latest Videos</h2>
        <div class="video-grid" id="video-grid">
          ${this.videos.length === 0 ? '<p class="text-center">No videos uploaded yet.</p>' : ''}
        </div>
      </div>
    `;
  }

  renderUploadPage() {
    return `
      <div class="section">
        <div class="upload-container">
          <div class="upload-header">
            <h2 class="upload-title">
              <span class="upload-title-icon">🎬</span>
              Upload Your Video
            </h2>
            <p class="upload-subtitle">Share your content with the world. Drag and drop or click to select your video file.</p>
          </div>
          
          <div class="upload-steps">
            <div class="upload-step active" id="step-1">
              <span class="step-number">1</span>
              <span class="step-text">Select File</span>
            </div>
            <div class="upload-step" id="step-2">
              <span class="step-number">2</span>
              <span class="step-text">Add Details</span>
            </div>
            <div class="upload-step" id="step-3">
              <span class="step-number">3</span>
              <span class="step-text">Upload</span>
            </div>
          </div>

          <div class="upload-main-card">
            <!-- File Selection Area -->
            <div class="upload-zone" id="upload-area">
              <input type="file" class="file-input" id="video-file" accept="video/*">
              
              <div class="upload-zone-content" id="upload-zone-content">
                <div class="upload-zone-icon">
                  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7,10 12,15 17,10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </div>
                <div class="upload-zone-text">
                  <h3>Drop your video here</h3>
                  <p>or <button type="button" class="upload-browse-btn" id="browse-btn">browse files</button></p>
                </div>
                <div class="upload-zone-formats">
                  <div class="format-icons">
                    <span class="format-icon mp4" title="MP4">MP4</span>
                    <span class="format-icon avi" title="AVI">AVI</span>
                    <span class="format-icon mov" title="MOV">MOV</span>
                    <span class="format-icon webm" title="WebM">WebM</span>
                  </div>
                  <p class="format-text">Supported formats • Max size: 500MB</p>
                </div>
              </div>

              <!-- File Preview Area (Hidden initially) -->
              <div class="file-preview hidden" id="file-preview">
                <div class="file-preview-content">
                  <div class="file-preview-video">
                    <video class="preview-video" id="preview-video" muted></video>
                    <div class="file-preview-overlay">
                      <button type="button" class="btn-change-file" id="change-file-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                        Change File
                      </button>
                    </div>
                  </div>
                  <div class="file-preview-info">
                    <h4 class="file-name" id="file-name"></h4>
                    <div class="file-details">
                      <span class="file-size" id="file-size"></span>
                      <span class="file-type" id="file-type"></span>
                      <span class="file-duration" id="file-duration"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Video Details Form -->
            <div class="upload-details hidden" id="upload-details">
              <div class="form-section">
                <h3 class="form-section-title">Video Details</h3>
                <div class="form-group">
                  <label class="form-label" for="video-title">
                    <span>Title</span>
                    <span class="required">*</span>
                  </label>
                  <input type="text" class="form-input" id="video-title" placeholder="Enter a catchy title for your video" required>
                  <div class="form-hint">Choose a title that describes your video content</div>
                </div>
                
                <div class="form-group">
                  <label class="form-label" for="video-description">
                    <span>Description</span>
                    <span class="optional">(optional)</span>
                  </label>
                  <textarea class="form-input" id="video-description" rows="3" placeholder="Tell viewers about your video..."></textarea>
                  <div class="form-hint">Add a description to help viewers understand your content</div>
                </div>
                
                <div class="form-group">
                  <label class="form-label">
                    <span>Privacy</span>
                  </label>
                  <div class="privacy-options">
                    <label class="privacy-option">
                      <input type="radio" name="privacy" value="private" checked>
                      <span class="privacy-option-content">
                        <span class="privacy-icon">🔒</span>
                        <span class="privacy-text">
                          <strong>Private</strong>
                          <small>Only you can see this video</small>
                        </span>
                      </span>
                    </label>
                    <label class="privacy-option">
                      <input type="radio" name="privacy" value="public">
                      <span class="privacy-option-content">
                        <span class="privacy-icon">🌍</span>
                        <span class="privacy-text">
                          <strong>Public</strong>
                          <small>Anyone can view this video</small>
                        </span>
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Upload Actions -->
            <div class="upload-actions" id="upload-actions">
              <button type="button" class="btn btn-secondary" id="back-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="15,18 9,12 15,6"/>
                </svg>
                Back
              </button>
              <button type="button" class="btn btn-primary" id="next-btn" disabled>
                Next
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </button>
              <button type="button" class="btn btn-primary btn-upload hidden" id="upload-btn" disabled>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="17,8 12,3 7,8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Upload Video
              </button>
            </div>

            <!-- Upload Progress -->
            <div class="upload-progress-section hidden" id="upload-progress-section">
              <div class="upload-progress-header">
                <h4>Uploading your video...</h4>
                <span class="upload-progress-percent" id="upload-progress-percent">0%</span>
              </div>
              <div class="upload-progress-bar-container">
                <div class="upload-progress-bar" id="upload-progress-bar"></div>
              </div>
              <div class="upload-progress-details">
                <span class="upload-speed" id="upload-speed">Calculating...</span>
                <span class="upload-eta" id="upload-eta">Calculating time remaining...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderAdminPage() {
    return `
      <div class="section">
        <h2 class="section-title">Admin Panel</h2>
        <div class="video-grid" id="admin-video-grid">
        </div>
      </div>
    `;
  }

  renderVideos() {
    const grid = document.getElementById('video-grid') || document.getElementById('admin-video-grid');
    if (!grid) return;

    grid.innerHTML = this.videos.map(video => `
      <div class="video-card">
        <div class="video-thumbnail" data-video-id="${video.id}" onclick="app.playVideo('${video.id}')">
          <img 
            src="/api/thumbnails/${video.id}" 
            alt="Video thumbnail" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
            class="thumbnail-image"
          />
          <div class="thumbnail-fallback" style="display: none;">
            📹
          </div>
          <div class="video-duration">${this.formatDuration(video.duration)}</div>
        </div>
        <div class="video-content">
          <h3 class="video-title">${this.escapeHtml(video.title || video.original_filename)}</h3>
          <div class="video-meta">
            <div>By ${video.owner}</div>
            <div>${video.views || 0} views • ${this.formatDate(video.created_at)}</div>
            ${video.is_public ? '<span class="status status-success">Public</span>' : '<span class="status status-warning">Private</span>'}
          </div>
          <div class="video-actions">
            <button class="btn btn-sm btn-primary" onclick="app.playVideo('${video.id}')">Play</button>
            <button class="btn btn-sm btn-secondary" onclick="app.downloadVideo('${video.id}')">Download</button>
            ${this.canManageVideo(video) ? `
              <button class="btn btn-sm btn-secondary" onclick="app.editVideoTitle('${video.id}', '${this.escapeHtml(video.title || video.original_filename)}')">Edit</button>
              <button class="btn btn-sm btn-secondary" onclick="app.showTranscodeOptions('${video.id}')">Encode</button>
              ${this.currentUser.is_admin ? `<button class="btn btn-sm btn-secondary" onclick="app.togglePublic('${video.id}')">${video.is_public ? 'Make Private' : 'Make Public'}</button>` : ''}
              <button class="btn btn-sm btn-danger" onclick="app.deleteVideo('${video.id}')">Delete</button>
            ` : ''}
          </div>
        </div>
      </div>
    `).join('');
  }

  canManageVideo(video) {
    return this.currentUser && (this.currentUser.is_admin || video.owner === this.currentUser.username);
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (e.target.id === 'auth-switch-link') {
        e.preventDefault();
        this.toggleAuthMode();
      }
      
      if (e.target.id === 'logout') {
        this.logout();
      }
      
      if (e.target.dataset.page) {
        e.preventDefault();
        this.showPage(e.target.dataset.page);
      }
      
      if (e.target.id === 'modal-close' || (e.target.id === 'video-modal' && e.target === e.currentTarget)) {
        this.closeModal();
      }
      
      if (e.target.id === 'confirm-modal' && e.target === e.currentTarget) {
        // Click outside modal to cancel
        const noBtn = document.getElementById('confirm-no');
        if (noBtn) noBtn.click();
      }
      
      if (e.target.id === 'input-modal' && e.target === e.currentTarget) {
        // Click outside modal to cancel
        const cancelBtn = document.getElementById('input-cancel');
        if (cancelBtn) cancelBtn.click();
      }
      
      if (e.target.id === 'download-modal-close' || (e.target.id === 'download-modal' && e.target === e.currentTarget)) {
        this.closeDownloadModal();
      }
      
      if (e.target.classList.contains('download-option-btn')) {
        const format = e.target.dataset.format;
        const videoId = e.target.dataset.videoId;
        this.closeDownloadModal();
        this.downloadVideo(videoId, format);
      }
      
      if (e.target.id === 'transcode-modal-close' || e.target.id === 'cancel-transcode-btn' || (e.target.id === 'transcode-modal' && e.target === e.currentTarget)) {
        this.closeTranscodeModal();
      }
      
      if (e.target.id === 'start-transcode-btn') {
        this.startTranscode();
      }
      
      if (e.target.classList.contains('video-thumbnail')) {
        this.playVideo(e.target.dataset.videoId);
      }
      
      // Upload page interactions
      if (e.target.id === 'upload-area' || e.target.id === 'browse-btn' || e.target.closest('#upload-area')) {
        const fileInput = document.getElementById('video-file');
        if (fileInput && !e.target.closest('.file-preview')) {
          fileInput.click();
        }
      }
      
      if (e.target.id === 'change-file-btn') {
        document.getElementById('video-file')?.click();
      }
      
      if (e.target.id === 'next-btn') {
        this.nextUploadStep();
      }
      
      if (e.target.id === 'back-btn') {
        this.prevUploadStep();
      }
      
      if (e.target.id === 'upload-btn') {
        console.log('Upload button clicked');
        this.uploadVideo();
      }
    });

    document.addEventListener('submit', (e) => {
      if (e.target.id === 'auth-form') {
        e.preventDefault();
        this.handleAuth();
      }
    });

    document.addEventListener('change', (e) => {
      if (e.target.id === 'video-file') {
        this.handleFileSelect(e.target.files[0]);
      }
      
      if (e.target.id === 'video-title') {
        this.updateUploadButton();
      }
    });

    // Drag and drop functionality
    document.addEventListener('dragover', (e) => {
      if (e.target.id === 'upload-area' || e.target.closest('#upload-area')) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) uploadArea.classList.add('drag-over');
      }
    });

    document.addEventListener('dragenter', (e) => {
      if (e.target.id === 'upload-area' || e.target.closest('#upload-area')) {
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.addEventListener('dragleave', (e) => {
      if (e.target.id === 'upload-area') {
        e.preventDefault();
        e.stopPropagation();
        e.target.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      if (e.target.id === 'upload-area' || e.target.closest('#upload-area')) {
        e.preventDefault();
        e.stopPropagation();
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) uploadArea.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('video/')) {
          const fileInput = document.getElementById('video-file');
          if (fileInput) {
            fileInput.files = files;
            this.handleFileSelect(files[0]);
          }
        }
      }
    });
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
        this.showError('Username must be 3-20 characters long and contain only letters, numbers, underscores, and hyphens.');
        return;
      }

      if (!passwordValid) {
        this.showError('Password must be at least 6 characters long.');
        return;
      }
    }

    try {
      if (isLogin) {
        const response = await this.request('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        localStorage.setItem('token', response.token);
        this.currentUser = response.user;
      } else {
        await this.request('/api/register', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        // Auto-login after registration
        const response = await this.request('/api/login', {
          method: 'POST',
          body: JSON.stringify({ username, password })
        });
        localStorage.setItem('token', response.token);
        this.currentUser = response.user;
      }
      
      this.renderApp();
      await this.loadVideos();
    } catch (e) {
      this.showError(e.error || 'Authentication failed');
    }
  }

  logout() {
    localStorage.removeItem('token');
    this.currentUser = null;
    this.videos = [];
    this.renderApp();
  }

  showPage(page) {
    const content = document.getElementById('page-content');
    
    switch (page) {
      case 'home':
        content.innerHTML = this.renderHomePage();
        this.renderVideos();
        break;
      case 'upload':
        content.innerHTML = this.renderUploadPage();
        break;
      case 'admin':
        if (this.currentUser?.is_admin) {
          content.innerHTML = this.renderAdminPage();
          this.renderVideos();
        }
        break;
    }
  }

  handleFileSelect(file) {
    if (file) {
      console.log('File selected:', file.name);
      
      // Validate file
      if (!this.validateFile(file)) {
        return;
      }
      
      // Show file preview
      this.showFilePreview(file);
      
      // Update UI state
      this.updateUploadStep(1);
      this.updateUploadButton();
    }
  }

  validateFile(file) {
    const maxSize = 500 * 1024 * 1024; // 500MB
    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime', 'video/webm'];
    
    if (!allowedTypes.includes(file.type)) {
      this.showError('Please select a valid video file (MP4, AVI, MOV, WebM)');
      return false;
    }
    
    if (file.size > maxSize) {
      this.showError('File size must be less than 500MB');
      return false;
    }
    
    return true;
  }

  showFilePreview(file) {
    const uploadZoneContent = document.getElementById('upload-zone-content');
    const filePreview = document.getElementById('file-preview');
    const previewVideo = document.getElementById('preview-video');
    
    if (!uploadZoneContent || !filePreview || !previewVideo) return;
    
    // Hide upload zone, show preview
    uploadZoneContent.classList.add('hidden');
    filePreview.classList.remove('hidden');
    
    // Set video source
    const url = URL.createObjectURL(file);
    previewVideo.src = url;
    
    // Update file info
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = this.formatFileSize(file.size);
    document.getElementById('file-type').textContent = file.type.split('/')[1].toUpperCase();
    
    // Get video duration when loaded
    previewVideo.addEventListener('loadedmetadata', () => {
      const duration = this.formatDuration(previewVideo.duration);
      document.getElementById('file-duration').textContent = duration;
    });
    
    // Auto-fill title from filename
    const titleInput = document.getElementById('video-title');
    if (titleInput && !titleInput.value.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      titleInput.value = nameWithoutExt;
    }
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }

  updateUploadStep(step) {
    // Update step indicators
    for (let i = 1; i <= 3; i++) {
      const stepEl = document.getElementById(`step-${i}`);
      if (stepEl) {
        stepEl.classList.toggle('active', i <= step);
        stepEl.classList.toggle('completed', i < step);
      }
    }
    
    // Show/hide relevant sections
    const uploadDetails = document.getElementById('upload-details');
    const nextBtn = document.getElementById('next-btn');
    const backBtn = document.getElementById('back-btn');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (step >= 2) {
      uploadDetails?.classList.remove('hidden');
    } else {
      uploadDetails?.classList.add('hidden');
    }
    
    if (step === 3) {
      nextBtn?.classList.add('hidden');
      uploadBtn?.classList.remove('hidden');
    } else {
      nextBtn?.classList.remove('hidden');
      uploadBtn?.classList.add('hidden');
    }
    
    if (backBtn) {
      backBtn.disabled = step === 1;
    }
    
    this.currentUploadStep = step;
    this.updateUploadButton();
  }

  nextUploadStep() {
    if (this.currentUploadStep === 1) {
      // Go to step 2 (details)
      this.updateUploadStep(2);
    } else if (this.currentUploadStep === 2) {
      // Validate details and go to step 3 (final)
      const title = document.getElementById('video-title')?.value.trim();
      if (!title) {
        this.showWarning('Please enter a video title');
        return;
      }
      this.updateUploadStep(3);
    }
  }

  prevUploadStep() {
    if (this.currentUploadStep > 1) {
      this.updateUploadStep(this.currentUploadStep - 1);
    }
  }

  updateUploadButton() {
    const file = document.getElementById('video-file')?.files[0];
    const title = document.getElementById('video-title')?.value.trim();
    const nextBtn = document.getElementById('next-btn');
    const uploadBtn = document.getElementById('upload-btn');
    
    if (nextBtn) {
      if (this.currentUploadStep === 1) {
        nextBtn.disabled = !file;
      } else if (this.currentUploadStep === 2) {
        nextBtn.disabled = !title;
      }
    }
    
    if (uploadBtn) {
      uploadBtn.disabled = !file || !title;
    }
  }

  async uploadVideo() {
    console.log('Upload video function called');
    const file = document.getElementById('video-file').files[0];
    const title = document.getElementById('video-title').value.trim();
    const description = document.getElementById('video-description')?.value.trim();
    const privacy = document.querySelector('input[name="privacy"]:checked')?.value || 'private';
    
    console.log('File:', file);
    console.log('Title:', title);
    console.log('Privacy:', privacy);
    
    if (!file || !title) {
      console.log('Missing file or title');
      return;
    }

    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    if (description) formData.append('description', description);
    formData.append('is_public', privacy === 'public' ? 'true' : 'false');

    try {
      console.log('Starting upload...');
      
      // Show progress section
      const progressSection = document.getElementById('upload-progress-section');
      const uploadActions = document.getElementById('upload-actions');
      
      progressSection?.classList.remove('hidden');
      uploadActions?.classList.add('hidden');
      
      // Track upload progress
      const startTime = Date.now();
      let lastLoaded = 0;
      
      const xhr = new XMLHttpRequest();
      
      // Progress tracking
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          const progressBar = document.getElementById('upload-progress-bar');
          const progressPercent = document.getElementById('upload-progress-percent');
          
          if (progressBar) {
            progressBar.style.width = `${percentComplete}%`;
          }
          if (progressPercent) {
            progressPercent.textContent = `${Math.round(percentComplete)}%`;
          }
          
          // Calculate speed and ETA
          const currentTime = Date.now();
          const elapsedTime = (currentTime - startTime) / 1000;
          const uploadedBytes = e.loaded - lastLoaded;
          const speed = uploadedBytes / elapsedTime;
          const remainingBytes = e.total - e.loaded;
          const eta = remainingBytes / speed;
          
          const speedElement = document.getElementById('upload-speed');
          const etaElement = document.getElementById('upload-eta');
          
          if (speedElement) {
            speedElement.textContent = `${this.formatSpeed(speed)}`;
          }
          if (etaElement && eta > 0 && eta < Infinity) {
            etaElement.textContent = `${Math.round(eta)}s remaining`;
          }
          
          lastLoaded = e.loaded;
        }
      });
      
      // Handle completion
      xhr.addEventListener('load', () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText);
            console.log('Upload result:', result);
            
            // Check if we got a video object back (successful upload)
            if (result.id && result.title) {
              // Show success animation
              setTimeout(() => {
                this.showSuccess('Video uploaded successfully!');
                this.showPage('home');
                this.loadVideos();
              }, 500);
            } else {
              throw new Error('Invalid response format');
            }
          } else {
            // Handle HTTP error responses
            const errorResult = JSON.parse(xhr.responseText);
            throw errorResult;
          }
        } catch (e) {
          console.error('Upload error:', e);
          this.showError(e.error || e.message || 'Upload failed');
          this.resetUploadForm();
        }
      });
      
      xhr.addEventListener('error', () => {
        console.error('Upload failed');
        this.showError('Upload failed. Please try again.');
        this.resetUploadForm();
      });
      
      // Start upload
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${localStorage.getItem('token')}`);
      xhr.send(formData);
      
    } catch (e) {
      console.error('Upload error:', e);
      this.showError(e.error || 'Upload failed');
      this.resetUploadForm();
    }
  }

  formatSpeed(bytesPerSecond) {
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let size = bytesPerSecond;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  resetUploadForm() {
    const progressSection = document.getElementById('upload-progress-section');
    const uploadActions = document.getElementById('upload-actions');
    
    progressSection?.classList.add('hidden');
    uploadActions?.classList.remove('hidden');
    
    this.updateUploadStep(1);
    
    // Reset form
    document.getElementById('video-file').value = '';
    document.getElementById('video-title').value = '';
    const descField = document.getElementById('video-description');
    if (descField) descField.value = '';
    
    // Reset preview
    const uploadZoneContent = document.getElementById('upload-zone-content');
    const filePreview = document.getElementById('file-preview');
    
    uploadZoneContent?.classList.remove('hidden');
    filePreview?.classList.add('hidden');
    
    this.currentUploadStep = 1;
    this.updateUploadButton();
  }

  async playVideo(videoId) {
    try {
      const video = await this.request(`/api/videos/${videoId}`);
      this.showVideoModal(video);
    } catch (e) {
      this.showError('Failed to load video');
    }
  }

  showVideoModal(video) {
    const modal = document.getElementById('video-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = video.title || video.original_filename;
    
    // Use streaming endpoint with token for authenticated access
    const token = localStorage.getItem('token');
    const streamUrl = `/api/videos/${video.id}/stream${token ? `?token=${token}` : ''}`;
    
    body.innerHTML = `
      <video class="video-player" controls>
        <source src="${streamUrl}" type="${video.mime}">
        Your browser does not support the video tag.
      </video>
      <div class="mt-2">
        <p><strong>Views:</strong> ${video.views}</p>
        <p><strong>Uploaded:</strong> ${this.formatDate(video.created_at)}</p>
        <p><strong>Size:</strong> ${this.formatFileSize(video.size)}</p>
      </div>
    `;
    
    modal.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('video-modal').classList.add('hidden');
  }

  async editVideoTitle(videoId, currentTitle) {
    const newTitle = await this.showInput(
      'Enter a new title for your video:',
      'Edit Video Title',
      'Video title',
      currentTitle
    );
    
    if (newTitle && newTitle.trim() !== currentTitle) {
      try {
        await this.request(`/api/videos/${videoId}`, {
          method: 'PUT',
          body: JSON.stringify({ title: newTitle.trim() })
        });
        await this.loadVideos();
        this.showSuccess('Video title updated successfully!');
      } catch (e) {
        this.showError(e.error || 'Failed to update video title');
      }
    }
  }

  async downloadVideo(videoId, format = null) {
    // If no format specified, show the download modal
    if (format === null) {
      this.showDownloadModal(videoId);
      return;
    }
    
    try {
      const url = format 
        ? `/api/videos/${videoId}/download?format=${format}`
        : `/api/videos/${videoId}/download`;
      
      console.log('Downloading from:', url);
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = ''; // Let browser decide filename from headers
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(downloadUrl);
        document.body.removeChild(a);
        
        this.showSuccess('Download started successfully!');
      } else {
        const error = await response.json();
        throw new Error(error.error || 'Download failed');
      }
    } catch (e) {
      console.error('Download error:', e);
      this.showError(e.message || 'Download failed');
    }
  }

  async showTranscodeOptions(videoId) {
    this.currentTranscodeVideoId = videoId;
    const modal = document.getElementById('transcode-modal');
    modal.classList.remove('hidden');
  }

  closeTranscodeModal() {
    const modal = document.getElementById('transcode-modal');
    modal.classList.add('hidden');
    this.currentTranscodeVideoId = null;
  }

  async startTranscode() {
    const videoId = this.currentTranscodeVideoId;
    if (!videoId) return;
    
    const format = document.getElementById('transcode-format').value;
    const resolution = document.getElementById('transcode-resolution').value;
    
    try {
      console.log(`Starting transcode for video ${videoId} to ${format}${resolution ? ` at ${resolution}` : ''}`);
      
      const result = await this.request(`/api/videos/${videoId}/transcode`, {
        method: 'POST',
        body: JSON.stringify({ 
          format: format,
          resolution: resolution || undefined 
        })
      });
      
      if (result.success) {
        this.closeTranscodeModal();
        this.showSuccess(
          `Transcode job started! Job ID: ${result.jobId}\n\nFormat: ${format.toUpperCase()}${resolution ? `\nResolution: ${resolution}` : ''}\n\nThe transcoding process will run in the background. When complete, you can download the transcoded version.`,
          8000
        );
        
        // Poll for job status
        this.pollTranscodeStatus(result.jobId);
      }
    } catch (e) {
      console.error('Transcode error:', e);
      this.showError(e.error || 'Failed to start transcode');
    }
  }

  async pollTranscodeStatus(jobId) {
    try {
      const status = await this.request(`/api/transcodes/${jobId}/status`);
      console.log(`Transcode job ${jobId} status:`, status);
      
      if (status.status === 'processing') {
        console.log(`Transcode progress: ${status.progress}%`);
        // Poll again in 5 seconds
        setTimeout(() => this.pollTranscodeStatus(jobId), 5000);
      } else if (status.status === 'done') {
        console.log(`Transcode job ${jobId} completed!`);
        this.showSuccess(`Transcoding completed! You can now download the ${status.format} version.`);
      } else if (status.status === 'error') {
        console.error(`Transcode job ${jobId} failed:`, status.error);
        this.showError(`Transcoding failed: ${status.error}`);
      }
    } catch (e) {
      console.error('Failed to check transcode status:', e);
    }
  }

  async togglePublic(videoId) {
    try {
      await this.request(`/api/videos/${videoId}/toggle-public`, { method: 'POST' });
      await this.loadVideos();
    } catch (e) {
      this.showError('Failed to toggle video visibility');
    }
  }

  async deleteVideo(videoId) {
    const confirmed = await this.showConfirm(
      'Are you sure you want to delete this video? This action cannot be undone.',
      'Delete Video'
    );
    
    if (confirmed) {
      try {
        await this.request(`/api/videos/${videoId}`, { method: 'DELETE' });
        await this.loadVideos();
        this.showSuccess('Video deleted successfully');
      } catch (e) {
        this.showError('Failed to delete video');
      }
    }
  }

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }

  formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  formatFileSize(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize app
const app = new VideoApp();
