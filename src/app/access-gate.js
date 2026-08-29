/**
 * Cuaderno Glass Pro 7.0 — Portón de Acceso (Access Gate)
 * Pantalla de bienvenida/login separada del UI normal.
 * Inspirado en el flujo instantáneo de rules-web:
 * - Cero bloqueos en 'Comprobando sesión'.
 * - Botones siempre activos e interactivos desde el primer milisegundo.
 * - Desbloqueo instantáneo al dar clic en 'Continuar como Visitante'.
 * - Autenticación limpia con Google sin loops ni spinners infinitos.
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
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    this.gateEl = document.getElementById('access-gate');
    this.shellEl = document.getElementById('app-shell');
    this.statusEl = document.getElementById('access-gate-status');
    this.statusTextEl = document.getElementById('access-gate-status-text');
    this.btnEl = document.getElementById('btn-gate-google-auth');
    this.btnGuestEl = document.getElementById('btn-gate-guest');
    this.errorEl = document.getElementById('access-gate-error');

    // Garantizar que los botones están siempre visibles y habilitados por defecto
    this._showLoginButton();

    if (this.btnEl) {
      this.btnEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._handleLoginClick();
      });
    }

    if (this.btnGuestEl) {
      this.btnGuestEl.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this._unlock();
      });
    }

    // Escuchar cierres de sesión explícitos
    events.on('auth:user-signed-out', () => {
      if (this.wasAuthenticated) {
        this.wasAuthenticated = false;
        this._relock();
      }
    });

    // Escuchar ingresos con sesión activa
    events.on('auth:user-signed-in', (user) => {
      if (user) this.wasAuthenticated = true;
      this._unlock();
    });

    // Chequeo en segundo plano silencioso de sesión previa
    this._checkSession();
  }

  async _checkSession() {
    try {
      // Chequeo asíncrono silencioso sin bloquear los botones del usuario
      await Promise.race([
        authService.init(),
        new Promise((resolve) => setTimeout(resolve, 600))
      ]);
    } catch (err) {
      logger.debug('AccessGate', 'Chequeo de sesión silencioso expiró o fue omitido');
    } finally {
      if (authService.currentUser) {
        this.wasAuthenticated = true;
        logger.info('AccessGate', `Sesión activa detectada (${authService.currentUser.email}). Entrando a la suite.`);
        this._unlock();
      } else {
        this._showLoginButton();
      }
    }
  }

  async _handleLoginClick() {
    this._hideError();
    this._setStatus('Abriendo ventana de Google...');
    this._showStatus();

    try {
      const user = await authService.signInWithGoogle();
      if (user) {
        this.wasAuthenticated = true;
        this._unlock();
      } else {
        this._setStatus('Redirigiendo a autenticación...');
      }
    } catch (err) {
      logger.error('AccessGate', 'Error al iniciar sesión con Google', { message: err.message });
      this._showError(this._describeError(err));
      this._showLoginButton();
    } finally {
      if (this.btnEl) this.btnEl.disabled = false;
      if (this.btnGuestEl) this.btnGuestEl.disabled = false;
    }
  }

  _describeError(err) {
    if (err && err.code === 'auth/unauthorized-domain') {
      return `Este dominio (${window.location.hostname}) no está autorizado en Firebase Authentication. Ve a Firebase Console → Auth → Settings → Authorized domains y añádelo.`;
    }
    return (err && err.friendlyMessage) || (err && err.message) || 'No se pudo completar el acceso con Google. Inténtalo de nuevo o entra en Modo Visitante.';
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

    // 1. Mostrar app shell inmediatamente
    if (this.shellEl) {
      this.shellEl.style.display = 'flex';
      this.shellEl.style.opacity = '1';
    }

    // 2. Transición suave de salida del Portón (estilo rules-web)
    if (this.gateEl) {
      this.gateEl.style.transition = 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
      this.gateEl.style.opacity = '0';
      this.gateEl.style.pointerEvents = 'none';
    }

    setTimeout(() => {
      if (this.gateEl) this.gateEl.style.display = 'none';
    }, 300);

    // 3. Inicializar suite principal
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
