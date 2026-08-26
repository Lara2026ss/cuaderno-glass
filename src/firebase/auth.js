/**
 * Cuaderno Glass Pro 4.0 — Autenticación Real con Firebase & Google
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { logger } from '../app/logger.js';
import { initializeFirebaseApp } from './config.js';

export class FirebaseAuthService {
  constructor() {
    this.auth = null;
    this.currentUser = null;
    this.initialized = false;
  }

  init() {
    if (typeof firebase === 'undefined') {
      logger.warn('FirebaseAuth', 'Firebase SDK no disponible');
      return;
    }

    const app = initializeFirebaseApp();
    if (!app) {
      this._setGuestMode();
      return;
    }

    try {
      this.auth = firebase.auth();
      this.auth.onAuthStateChanged(user => {
        if (user) {
          this.currentUser = {
            uid: user.uid,
            displayName: user.displayName || 'Usuario Google',
            email: user.email || '',
            photoURL: user.photoURL || null,
            isAnonymous: user.isAnonymous
          };
          store.set('user', this.currentUser);
          store.set('session.isAuthenticated', true);
          store.set('connections.firebase.status', 'connected');
          store.set('connections.firebase.error', null);
          logger.info('FirebaseAuth', `Sesión activa: ${user.email} (${user.uid})`);
          events.emit('auth:user-signed-in', this.currentUser);
        } else {
          this._setGuestMode();
        }
      });
      this.initialized = true;
    } catch (err) {
      logger.error('FirebaseAuth', 'Error inicializando Firebase Auth', { error: err.message });
      this._setGuestMode();
    }
  }

  _setGuestMode() {
    this.currentUser = null;
    store.set('user', null);
    store.set('session.isAuthenticated', false);
    store.set('connections.firebase.status', 'disconnected');
    events.emit('auth:user-signed-out');
  }

  async signInWithGoogle() {
    if (!this.auth) {
      const app = initializeFirebaseApp();
      if (!app) {
        throw new Error('Configura primero las credenciales de Firebase en el menú de Configuración.');
      }
      this.auth = firebase.auth();
    }

    try {
      logger.info('FirebaseAuth', 'Iniciando popup de Google Sign-In...');
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      
      const result = await this.auth.signInWithPopup(provider);
      logger.info('FirebaseAuth', 'Login exitoso con Google', { email: result.user.email });
      return result.user;
    } catch (err) {
      logger.error('FirebaseAuth', 'Error en Google Sign-In', { code: err.code, message: err.message });
      store.set('connections.firebase.error', err.message);
      throw err;
    }
  }

  async signOut() {
    if (this.auth) {
      try {
        await this.auth.signOut();
        this._setGuestMode();
        logger.info('FirebaseAuth', 'Sesión cerrada correctamente');
      } catch (err) {
        logger.error('FirebaseAuth', 'Error al cerrar sesión', { error: err.message });
        throw err;
      }
    } else {
      this._setGuestMode();
    }
  }
}

export const authService = new FirebaseAuthService();
