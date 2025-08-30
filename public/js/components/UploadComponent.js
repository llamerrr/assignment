class UploadComponent {
  constructor() {
    this.currentUploadStep = 1;
    this.selectedFile = null;
  }

  renderUploadPage() {
    return `
      <div class="upload-container">
        <div class="upload-header">
          <h1 class="upload-title">
            <span class="upload-title-icon">📤</span>
            Upload Video
          </h1>
          <p class="upload-subtitle">Share your videos with the world</p>
        </div>

        <!-- Upload Steps -->
        <div class="upload-steps">
          <div class="upload-step ${this.currentUploadStep >= 1 ? 'active' : ''} ${this.currentUploadStep > 1 ? 'completed' : ''}">
            <div class="step-number">1</div>
            <div class="step-text">Select File</div>
          </div>
          <div class="upload-step ${this.currentUploadStep >= 2 ? 'active' : ''} ${this.currentUploadStep > 2 ? 'completed' : ''}">
            <div class="step-number">2</div>
            <div class="step-text">Details</div>
          </div>
          <div class="upload-step ${this.currentUploadStep >= 3 ? 'active' : ''}">
            <div class="step-number">3</div>
            <div class="step-text">Upload</div>
          </div>
        </div>

        <!-- Main Upload Card -->
        <div class="upload-main-card">
          <div id="upload-step-content">
            ${this.renderCurrentStep()}
          </div>
        </div>
      </div>
    `;
  }

  renderCurrentStep() {
    switch (this.currentUploadStep) {
      case 1:
        return this.renderFileSelection();
      case 2:
        return this.renderUploadDetails();
      case 3:
        return this.renderUploadProgress();
      default:
        return this.renderFileSelection();
    }
  }

  renderFileSelection() {
    if (this.selectedFile) {
      return this.renderFilePreview();
    }

    return `
      <div class="upload-zone" id="upload-zone">
        <input type="file" id="file-input" accept="video/*" style="display: none;">
        <div class="upload-zone-content">
          <div class="upload-zone-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7,10 12,15 17,10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </div>
          <div class="upload-zone-text">
            <h3>Drop your video here</h3>
            <p>or <button type="button" class="upload-browse-btn" id="browse-btn">browse files</button></p>
          </div>
        </div>
        
        <div class="upload-zone-formats">
          <p class="format-text">Supported formats:</p>
          <div class="format-icons">
            <span class="format-icon mp4">MP4</span>
            <span class="format-icon webm">WEBM</span>
            <span class="format-icon avi">AVI</span>
            <span class="format-icon mov">MOV</span>
          </div>
        </div>
      </div>
    `;
  }

  renderFilePreview() {
    const file = this.selectedFile;
    return `
      <div class="file-preview">
        <div class="file-preview-content">
          <div class="file-preview-video">
            <video class="preview-video" controls>
              <source src="${URL.createObjectURL(file)}" type="${file.type}">
            </video>
            <div class="file-preview-overlay">
              <button type="button" class="btn-change-file" id="change-file">Change File</button>
            </div>
          </div>
          <div class="file-preview-info">
            <h3 class="file-name">${this.escapeHtml(file.name)}</h3>
            <div class="file-details">
              <span>Size: ${this.formatFileSize(file.size)}</span>
              <span>Type: ${file.type}</span>
            </div>
          </div>
        </div>
        
        <div class="upload-actions">
          <button type="button" class="btn btn-secondary" id="prev-step">← Back</button>
          <button type="button" class="btn btn-primary" id="next-step">Next →</button>
        </div>
      </div>
    `;
  }

  renderUploadDetails() {
    return `
      <div class="upload-details">
        <h3 class="form-section-title">Video Details</h3>
        
        <div class="form-group">
          <label class="form-label">
            Title <span class="required">*</span>
          </label>
          <input 
            type="text" 
            class="form-input" 
            id="video-title" 
            placeholder="Enter video title"
            value="${this.selectedFile ? this.selectedFile.name.replace(/\.[^/.]+$/, '') : ''}"
            required
          >
          <div class="form-hint">Give your video a descriptive title</div>
        </div>

        <div class="form-group">
          <h4 class="form-section-title">Privacy Settings</h4>
          <div class="privacy-options">
            <label class="privacy-option">
              <input type="radio" name="privacy" value="public" checked>
              <div class="privacy-option-content">
                <div class="privacy-icon">🌍</div>
                <div class="privacy-text">
                  <strong>Public</strong>
                  <small>Anyone can view this video</small>
                </div>
              </div>
            </label>
            
            <label class="privacy-option">
              <input type="radio" name="privacy" value="private">
              <div class="privacy-option-content">
                <div class="privacy-icon">🔒</div>
                <div class="privacy-text">
                  <strong>Private</strong>
                  <small>Only you can view this video</small>
                </div>
              </div>
            </label>
          </div>
        </div>
        
        <div class="upload-actions">
          <button type="button" class="btn btn-secondary" id="prev-step">← Back</button>
          <button type="button" class="btn btn-upload" id="start-upload">
            🚀 Upload Video
          </button>
        </div>
      </div>
    `;
  }

  renderUploadProgress() {
    return `
      <div class="upload-progress-section">
        <div class="upload-progress-header">
          <h4>Uploading your video...</h4>
          <span class="upload-progress-percent" id="upload-percent">0%</span>
        </div>
        
        <div class="upload-progress-bar-container">
          <div class="upload-progress-bar" id="upload-progress-bar" style="width: 0%"></div>
        </div>
        
        <div class="upload-progress-details" id="upload-details">
          <span>Preparing upload...</span>
        </div>
      </div>
    `;
  }

  setupUploadEventListeners() {
    // File input and drag & drop
    document.addEventListener('change', (e) => {
      if (e.target.id === 'file-input') {
        this.handleFileSelect(e.target.files[0]);
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target.id === 'browse-btn') {
        document.getElementById('file-input')?.click();
      }
      
      if (e.target.id === 'change-file') {
        this.selectedFile = null;
        this.currentUploadStep = 1;
        this.refreshUploadStep();
      }
      
      if (e.target.id === 'next-step') {
        this.nextUploadStep();
      }
      
      if (e.target.id === 'prev-step') {
        this.prevUploadStep();
      }
      
      if (e.target.id === 'start-upload') {
        this.uploadVideo();
      }
    });

    // Drag and drop
    document.addEventListener('dragover', (e) => {
      const uploadZone = document.getElementById('upload-zone');
      if (uploadZone && uploadZone.contains(e.target)) {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
      }
    });

    document.addEventListener('dragleave', (e) => {
      const uploadZone = document.getElementById('upload-zone');
      if (uploadZone && !uploadZone.contains(e.relatedTarget)) {
        uploadZone.classList.remove('drag-over');
      }
    });

    document.addEventListener('drop', (e) => {
      const uploadZone = document.getElementById('upload-zone');
      if (uploadZone && uploadZone.contains(e.target)) {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleFileSelect(files[0]);
        }
      }
    });
  }

  handleFileSelect(file) {
    if (!this.validateFile(file)) return;
    
    this.selectedFile = file;
    this.refreshUploadStep();
  }

  validateFile(file) {
    if (!file) {
      notificationService.showError('No file selected');
      return false;
    }

    const allowedTypes = ['video/mp4', 'video/webm', 'video/avi', 'video/quicktime'];
    if (!allowedTypes.includes(file.type)) {
      notificationService.showError('Invalid file type. Only MP4, WebM, AVI, and MOV files are allowed.');
      return false;
    }

    if (file.size > 500 * 1024 * 1024) { // 500MB
      notificationService.showError('File too large. Maximum size is 500MB.');
      return false;
    }

    return true;
  }

  nextUploadStep() {
    if (this.currentUploadStep < 3) {
      this.currentUploadStep++;
      this.refreshUploadStep();
    }
  }

  prevUploadStep() {
    if (this.currentUploadStep > 1) {
      this.currentUploadStep--;
      this.refreshUploadStep();
    }
  }

  refreshUploadStep() {
    const content = document.getElementById('upload-step-content');
    if (content) {
      content.innerHTML = this.renderCurrentStep();
    }
    
    // Update step indicators
    const steps = document.querySelectorAll('.upload-step');
    steps.forEach((step, index) => {
      step.classList.remove('active', 'completed');
      if (index + 1 === this.currentUploadStep) {
        step.classList.add('active');
      } else if (index + 1 < this.currentUploadStep) {
        step.classList.add('completed');
      }
    });
  }

  async uploadVideo() {
    if (!this.selectedFile) {
      notificationService.showError('No file selected');
      return;
    }

    const title = document.getElementById('video-title')?.value?.trim();
    if (!title) {
      notificationService.showError('Please enter a video title');
      return;
    }

    const isPublic = document.querySelector('input[name="privacy"]:checked')?.value === 'public';

    this.currentUploadStep = 3;
    this.refreshUploadStep();

    try {
      const result = await apiService.uploadVideo(this.selectedFile, title, isPublic);
      
      notificationService.showSuccess('Video uploaded successfully!');
      
      // Reset form
      this.selectedFile = null;
      this.currentUploadStep = 1;
      
      // Refresh videos and go to home
      if (window.app?.loadVideos) {
        await window.app.loadVideos();
      }
      window.app?.showPage('home');
      
    } catch (e) {
      notificationService.showError(e.error || 'Upload failed');
      this.currentUploadStep = 2;
      this.refreshUploadStep();
    }
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

  resetUploadForm() {
    this.selectedFile = null;
    this.currentUploadStep = 1;
    this.refreshUploadStep();
  }
}

// Export singleton instance
window.uploadComponent = new UploadComponent();
