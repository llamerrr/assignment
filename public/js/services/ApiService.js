class ApiService {
  constructor() {
    this.baseUrl = '';
  }

  async request(path, options = {}) {
    const token = localStorage.getItem('token');
    const headers = { ...options.headers };
    
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(this.baseUrl + path, { ...options, headers });
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) throw data;
      return data;
    }
    
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  }

  // Auth methods
  async register(username, password) {
    return this.request('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async login(username, password) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  }

  async me() {
    return this.request('/api/me');
  }

  // Video methods
  async uploadVideo(file, title, isPublic) {
    const formData = new FormData();
    formData.append('video', file);
    formData.append('title', title);
    formData.append('is_public', isPublic);

    return this.request('/api/upload', {
      method: 'POST',
      body: formData
    });
  }

  async getVideos() {
    return this.request('/api/videos');
  }

  async getVideo(id) {
    return this.request(`/api/videos/${id}`);
  }

  async updateVideoTitle(id, title) {
    return this.request(`/api/videos/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title })
    });
  }

  async deleteVideo(id) {
    return this.request(`/api/videos/${id}`, {
      method: 'DELETE'
    });
  }

  async getVideoVersions(id) {
    return this.request(`/api/videos/${id}/versions`);
  }

  async startTranscode(id, format, resolution) {
    return this.request(`/api/videos/${id}/transcode`, {
      method: 'POST',
      body: JSON.stringify({ format, resolution })
    });
  }

  async getTranscodeStatus(jobId) {
    return this.request(`/api/transcodes/${jobId}/status`);
  }

  async toggleVideoPublic(id) {
    return this.request(`/api/videos/${id}/toggle-public`, {
      method: 'POST'
    });
  }

  // Helper methods
  getThumbnailUrl(id) {
    return `/api/thumbnails/${id}`;
  }

  getStreamUrl(id, token = null) {
    const url = `/api/videos/${id}/stream`;
    return token ? `${url}?token=${token}` : url;
  }

  getDownloadUrl(id, format = null) {
    const url = `/api/videos/${id}/download`;
    return format ? `${url}?format=${format}` : url;
  }
}

// Export singleton instance
window.apiService = new ApiService();
