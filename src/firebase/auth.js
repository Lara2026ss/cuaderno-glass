/**
 * Cuaderno Glass Pro 4.0 — Autenticación Real con Firebase & Google
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { logger } from '../app/logger.js';
import { fetchServerFirebaseConfig, initializeFirebaseApp } from './config.js';

export class FirebaseAuthService {
  constructor() {
    this.auth = null;
    this.currentUser = null;
    this.initialized = false;
  }

  async init() {
    if (typeof firebase === 'undefined') {
      logger.warn('FirebaseAuth', 'Firebase SDK no disponible');
      return;
    }

    await fetchServerFirebaseConfig();
    const app = initializeFirebaseApp();
    if (!app) {
      this._setGuestMode();
      return;
    }

    try {
      this.auth = firebase.auth();
      this.auth.onAuthStateChanged(async (user) => {
        if (user) {
          const idToken = await user.getIdToken().catch(() => null);
          this.currentUser = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario Google',
            email: user.email || '',
            photoURL: user.photoURL || null,
            isAnonymous: user.isAnonymous
          };

          store.set('user', this.currentUser);
          store.set('session.isAuthenticated', true);
          store.set('session.idToken', idToken);
          store.set('connections.firebase.status', 'connected');
          store.set('connections.firebase.error', null);
          
          logger.info('FirebaseAuth', `Sesión activa: ${this.currentUser.email} (${this.currentUser.uid})`);
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
    store.set('session.idToken', null);
    store.set('connections.firebase.status', 'disconnected');
    events.emit('auth:user-signed-out');
  }

  async signInWithGoogle() {
    if (!this.auth) {
      await fetchServerFirebaseConfig();
      const app = initializeFirebaseApp();
      if (!app) {
        throw new Error('No se pudo inicializar Firebase Auth. Verifica tu conexión a internet.');
      }
      this.auth = firebase.auth();
    }

    try {
      logger.info('FirebaseAuth', 'Iniciando popup de Google Sign-In...');
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.addScope('profile');
      provider.addScope('email');
      provider.setCustomParameters({ prompt: 'select_account' });
      
      const result = await this.auth.signInWithPopup(provider);
      const idToken = await result.user.getIdToken();
      
      this.currentUser = {
        uid: result.user.uid,
        displayName: result.user.displayName || 'Usuario Google',
        email: result.user.email || '',
        photoURL: result.user.photoURL || null,
        isAnonymous: result.user.isAnonymous
      };

      store.set('user', this.currentUser);
      store.set('session.isAuthenticated', true);
      store.set('session.idToken', idToken);
      store.set('connections.firebase.status', 'connected');
      store.set('connections.firebase.error', null);

      logger.info('FirebaseAuth', 'Login exitoso con Google', { email: result.user.email });
      events.emit('auth:user-signed-in', this.currentUser);
      return result.user;
    } catch (err) {
      logger.error('FirebaseAuth', 'Error en Google Sign-In', { code: err.code, message: err.message });
      
      let friendlyMessage = err.message;
      if (err.code === 'auth/popup-closed-by-user') {
        friendlyMessage = 'Ventana de inicio de sesión cerrada por el usuario.';
      } else if (err.code === 'auth/popup-blocked') {
        friendlyMessage = 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio.';
      } else if (err.code === 'auth/unauthorized-domain') {
        friendlyMessage = 'Dominio no autorizado en Firebase Console. Añade localhost a Dominios Autorizados en Firebase Authentication.';
      }

      store.set('connections.firebase.error', friendlyMessage);
      throw new Error(friendlyMessage);
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
