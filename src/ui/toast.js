/**
 * Cuaderno Glass Pro 4.0 — Toast Notification System
 */

import { audio } from '../audio/audio-engine.js';

export class ToastManager {
  constructor() {
    this.container = null;
  }

  _getContainer() {
    if (!this.container) {
      let el = document.getElementById('toast-container');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toast-container';
        el.className = 'toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
    return this.container;
  }

  show(message, type = 'info', duration = 3200) {
    const container = this._getContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
      success: '✨',
      error: '⚠️',
      warning: '⚡',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <span style="font-size: 1.1rem;">${icons[type] || '✨'}</span>
      <span>${message}</span>
    `;

    container.appendChild(toast);

    if (type === 'success') audio.soundSuccess();
    else if (type === 'error') audio.soundError();
    else audio.soundNotification();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  success(msg, dur) { this.show(msg, 'success', dur); }
  error(msg, dur) { this.show(msg, 'error', dur); }
  warning(msg, dur) { this.show(msg, 'warning', dur); }
  info(msg, dur) { this.show(msg, 'info', dur); }
}

export const toast = new ToastManager();
