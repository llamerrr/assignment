class NotificationService {
  constructor() {
    this.notificationId = 0;
  }

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
        <button class="notification-close" onclick="notificationService.closeNotification(${id})">&times;</button>
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
}

// Export singleton instance
window.notificationService = new NotificationService();
