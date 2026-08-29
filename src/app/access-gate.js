/**
 * Cuaderno Glass Pro 7.0 — Portón de Acceso (Access Gate)
 * Pantalla de bienvenida/login separada del UI normal.
 * Si hay sesión de Google activa, entra automáticamente.
 * Si no hay sesión, muestra el portón de acceso con opción de Entrar con Google
 * o Continuar en Modo Visitante.
 */

import { authService } from '../firebase/auth.js';
import { events } from './events.js';
import { logger } from './logger.js';
import { bootstrap } from './bootstrap.js';

class AccessGate {
  constructor() {
    this.gateEl = null;
    this.shellEl = null;
    this.statusEl = null;
    this.statusTextEl = null;
    this.btnEl = null;
    this.btnGuestEl = null;
    this.errorEl = null;
    this.unlocked = false;
    this.wasAuthenticated = false;
  }

  init() {
    this.gateEl = document.getElementById('access-gate');
    this.shellEl = document.getElementById('app-shell');
    this.statusEl = document.getElementById('access-gate-status');
    this.statusTextEl = document.getElementById('access-gate-status-text');
    this.btnEl = document.getElementById('btn-gate-google-auth');
    this.btnGuestEl = document.getElementById('btn-gate-guest');
    this.errorEl = document.getElementById('access-gate-error');

    if (this.btnEl) {
      this.btnEl.addEventListener('click', (e) => {
        e.preventDefault();
        this._handleLoginClick();
      });
    }

    if (this.btnGuestEl) {
      this.btnGuestEl.addEventListener('click', (e) => {
        e.preventDefault();
        this._unlock();
      });
    }

    // Solo relockear si existía una sesión autenticada real que se cerró
    events.on('auth:user-signed-out', () => {
      if (this.wasAuthenticated) {
        this.wasAuthenticated = false;
        this._relock();
      }
    });

    events.on('auth:user-signed-in', (user) => {
      if (user) this.wasAuthenticated = true;
      this._unlock();
    });

    this._checkSession();
  }

  async _checkSession() {
    try {
      await Promise.race([
        authService.init(),
        new Promise((resolve) => setTimeout(resolve, 800))
      ]);
    } catch (err) {
      logger.warn('AccessGate', 'Excepción comprobando sesión:', { error: err.message });
    } finally {
      if (authService.currentUser) {
        this.wasAuthenticated = true;
        logger.info('AccessGate', `Sesión existente detectada: ${authService.currentUser.email}. Entrando automáticamente.`);
        this._unlock();
      } else {
        this._showLoginButton();
      }
    }
  }

  async _handleLoginClick() {
    this._hideError();
    if (this.btnEl) this.btnEl.disabled = true;
    this._setStatus('Abriendo ventana de Google...', true);
    this._showStatus();

    try {
      const user = await authService.signInWithGoogle();
      if (user) {
        this.wasAuthenticated = true;
        this._unlock();
      } else {
        this._setStatus('Redirigiendo a Google...', true);
      }
    } catch (err) {
      logger.error('AccessGate', 'Fallo el login de Google en el portón', { code: err.code, message: err.friendlyMessage || err.message });
      this._showError(this._describeError(err));
      this._showLoginButton();
    } finally {
      if (this.btnEl) this.btnEl.disabled = false;
    }
  }

  _describeError(err) {
    if (err && err.code === 'auth/unauthorized-domain') {
      return `Este dominio (${window.location.hostname}) no está autorizado en Firebase. Ve a Firebase Console → Authentication → Settings → Authorized domains y agrégalo.`;
    }
    return (err && err.friendlyMessage) || (err && err.message) || 'No se pudo iniciar sesión con Google. Intenta de nuevo.';
  }

  _showLoginButton() {
    this._hideStatus();
    if (this.btnEl) {
      this.btnEl.style.display = 'flex';
      this.btnEl.disabled = false;
    }
    if (this.btnGuestEl) {
      this.btnGuestEl.style.display = 'flex';
      this.btnGuestEl.disabled = false;
    }
  }

  _setStatus(text) {
    if (this.statusTextEl) this.statusTextEl.textContent = text;
  }

  _showStatus() {
    if (this.statusEl) this.statusEl.style.display = 'flex';
  }

  _hideStatus() {
    if (this.statusEl) this.statusEl.style.display = 'none';
  }

  _showError(message) {
    if (this.errorEl) {
      this.errorEl.textContent = message;
      this.errorEl.style.display = 'block';
    }
  }

  _hideError() {
    if (this.errorEl) this.errorEl.style.display = 'none';
  }

  _unlock() {
    if (this.unlocked) return;
    this.unlocked = true;

    if (this.gateEl) {
      this.gateEl.style.opacity = '0';
      this.gateEl.style.pointerEvents = 'none';
    }
    if (this.shellEl) this.shellEl.style.display = '';

    setTimeout(() => {
      if (this.gateEl) this.gateEl.style.display = 'none';
    }, 250);

    bootstrap.init();
  }

  _relock() {
    this.unlocked = false;
    bootstrap.initialized = false;
    if (this.shellEl) this.shellEl.style.display = 'none';
    if (this.gateEl) {
      this.gateEl.style.display = 'flex';
      this.gateEl.style.opacity = '1';
      this.gateEl.style.pointerEvents = 'auto';
    }
    this._showLoginButton();
  }
}

export const accessGate = new AccessGate();
