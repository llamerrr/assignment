class ModalService {
  // Modern confirm dialog
  showConfirm(message, title = 'Confirm Action') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal modal-small';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">
            <p>${this.escapeHtml(message)}</p>
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-no">Cancel</button>
            <button class="btn btn-primary" id="modal-yes">Confirm</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const yesBtn = modal.querySelector('#modal-yes');
      const noBtn = modal.querySelector('#modal-no');

      const cleanup = () => {
        document.body.removeChild(modal);
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
        modal.removeEventListener('click', handleClickOutside);
      };

      const handleYes = () => {
        cleanup();
        resolve(true);
      };

      const handleNo = () => {
        cleanup();
        resolve(false);
      };

      const handleClickOutside = (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      };

      yesBtn.addEventListener('click', handleYes);
      noBtn.addEventListener('click', handleNo);
      modal.addEventListener('click', handleClickOutside);
    });
  }

  // Modern input dialog
  showInput(message, title = 'Input Required', placeholder = '', defaultValue = '') {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'modal modal-small';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${this.escapeHtml(title)}</h3>
          </div>
          <div class="modal-body">
            <p>${this.escapeHtml(message)}</p>
            <input type="text" class="form-input" id="modal-input" placeholder="${this.escapeHtml(placeholder)}" value="${this.escapeHtml(defaultValue)}">
          </div>
          <div class="modal-actions">
            <button class="btn btn-secondary" id="modal-cancel">Cancel</button>
            <button class="btn btn-primary" id="modal-ok">OK</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const input = modal.querySelector('#modal-input');
      const okBtn = modal.querySelector('#modal-ok');
      const cancelBtn = modal.querySelector('#modal-cancel');

      // Focus input and select text
      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);

      const cleanup = () => {
        document.body.removeChild(modal);
        okBtn.removeEventListener('click', handleOk);
        cancelBtn.removeEventListener('click', handleCancel);
        input.removeEventListener('keydown', handleKeydown);
        modal.removeEventListener('click', handleClickOutside);
      };

      const handleOk = () => {
        const value = input.value.trim();
        cleanup();
        resolve(value);
      };

      const handleCancel = () => {
        cleanup();
        resolve(null);
      };

      const handleKeydown = (e) => {
        if (e.key === 'Enter') {
          handleOk();
        } else if (e.key === 'Escape') {
          handleCancel();
        }
      };

      const handleClickOutside = (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(null);
        }
      };

      okBtn.addEventListener('click', handleOk);
      cancelBtn.addEventListener('click', handleCancel);
      input.addEventListener('keydown', handleKeydown);
      modal.addEventListener('click', handleClickOutside);
    });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Export singleton instance
window.modalService = new ModalService();
