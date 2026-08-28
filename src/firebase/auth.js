/**
 * Cuaderno Glass Pro 6.0 — Autenticación Robusta con Firebase & Google
 * Manejo explícito de errores, diagnóstico visual, UX reactiva y fallback seguro.
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { logger } from '../app/logger.js';
import { fetchServerFirebaseConfig, initializeFirebaseApp } from './config.js';

export const AUTH_ERRORS = {
  CONFIGURATION_NOT_FOUND: 'auth/configuration-not-found',
  POPUP_BLOCKED: 'auth/popup-blocked',
  POPUP_CLOSED: 'auth/popup-closed-by-user',
  CANCELLED_POPUP: 'auth/cancelled-popup-request',
  ACCOUNT_EXISTS: 'auth/account-exists-with-different-credential',
  NETWORK_FAILED: 'auth/network-request-failed',
  UNAUTHORIZED_DOMAIN: 'auth/unauthorized-domain',
  OPERATION_NOT_ALLOWED: 'auth/operation-not-allowed',
  INVALID_API_KEY: 'auth/invalid-api-key'
};

export class FirebaseAuthService {
  constructor() {
    this.auth = null;
    this.currentUser = null;
    this.initialized = false;
    this.checkingSession = true;
    this.lastError = null;
  }

  async init() {
    this.checkingSession = true;
    store.set('session.isChecking', true);

    if (typeof firebase === 'undefined') {
      logger.warn('FirebaseAuth', 'Firebase SDK no disponible en el entorno global');
      this._setGuestMode();
      return;
    }

    try {
      await fetchServerFirebaseConfig();
      const app = initializeFirebaseApp();
      if (!app) {
        this._setGuestMode();
        return;
      }

      this.auth = firebase.auth();
      
      // Persistencia local estándar
      try {
        await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      } catch (pErr) {
        logger.debug('FirebaseAuth', 'Persistence notice:', pErr.message);
      }

      this.auth.onAuthStateChanged(async (user) => {
        this.checkingSession = false;
        store.set('session.isChecking', false);

        if (user) {
          const idToken = await user.getIdToken().catch(() => null);
          this.currentUser = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Usuario Google',
            email: user.email || '',
            photoURL: user.photoURL || null,
            isAnonymous: user.isAnonymous
          };

          this.lastError = null;
          store.set('user', this.currentUser);
          store.set('session.isAuthenticated', true);
          store.set('session.idToken', idToken);
          store.set('connections.firebase.status', 'connected');
          store.set('connections.firebase.error', null);
          store.set('connections.firebase.authStatus', 'authenticated');
          
          logger.info('FirebaseAuth', `Sesión restaurada con éxito: ${this.currentUser.email} (${this.currentUser.uid})`);
          events.emit('auth:user-signed-in', this.currentUser);
        } else {
          this._setGuestMode();
        }
      });

      this.initialized = true;
      store.set('connections.firebase.sdkInitialized', true);
    } catch (err) {
      this.checkingSession = false;
      store.set('session.isChecking', false);
      this.lastError = { code: err.code || 'init-error', message: err.message, timestamp: new Date().toISOString() };
      store.set('connections.firebase.error', err.message);
      logger.error('FirebaseAuth', 'Error al inicializar Firebase Auth', { error: err.message });
      this._setGuestMode();
    }
  }

  _setGuestMode() {
    this.currentUser = null;
    this.checkingSession = false;
    store.set('session.isChecking', false);
    store.set('user', null);
    store.set('session.isAuthenticated', false);
    store.set('session.idToken', null);
    store.set('connections.firebase.status', 'disconnected');
    store.set('connections.firebase.authStatus', 'guest');
    events.emit('auth:user-signed-out');
  }

  createGoogleProvider() {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      throw new Error('Firebase Auth SDK no disponible');
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    provider.setCustomParameters({ prompt: 'select_account' });
    return provider;
  }

  mapAuthError(err) {
    const code = err.code || '';
    const projectId = store.get('settings.firebaseConfig.projectId', 'alero-company-works');

    const mapped = {
      code,
      rawMessage: err.message,
      friendlyMessage: '',
      actionUrl: '',
      actionText: '',
      isConfigError: false
    };

    switch (code) {
      case AUTH_ERRORS.CONFIGURATION_NOT_FOUND:
        mapped.friendlyMessage = `Google Sign-In aún no está activado en el proyecto "${projectId}". Activa el proveedor Google en Firebase Console.`;
        mapped.actionUrl = `https://console.firebase.google.com/project/${projectId}/authentication`;
        mapped.actionText = 'Abrir Firebase Console';
        mapped.isConfigError = true;
        break;

      case AUTH_ERRORS.OPERATION_NOT_ALLOWED:
        mapped.friendlyMessage = `El método de inicio de sesión con Google está deshabilitado en Firebase. Habilítalo en Sign-in method.`;
        mapped.actionUrl = `https://console.firebase.google.com/project/${projectId}/authentication`;
        mapped.actionText = 'Habilitar Google en Firebase';
        mapped.isConfigError = true;
        break;

      case AUTH_ERRORS.UNAUTHORIZED_DOMAIN:
        mapped.friendlyMessage = `El dominio actual (${window.location.hostname || 'localhost'}) no está en Dominios Autorizados de Firebase Authentication.`;
        mapped.actionUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;
        mapped.actionText = 'Añadir Dominio Autorizado';
        mapped.isConfigError = true;
        break;

      case AUTH_ERRORS.POPUP_BLOCKED:
        mapped.friendlyMessage = 'El navegador bloqueó la ventana emergente de Google. Permite ventanas emergentes para este sitio e inténtalo nuevamente.';
        break;

      case AUTH_ERRORS.POPUP_CLOSED:
        mapped.friendlyMessage = 'Ventana de inicio de sesión cerrada antes de completar la autenticación.';
        break;

      case AUTH_ERRORS.CANCELLED_POPUP:
        mapped.friendlyMessage = 'Solicitud de autenticación cancelada por otra petición simultánea.';
        break;

      case AUTH_ERRORS.ACCOUNT_EXISTS:
        mapped.friendlyMessage = 'Ya existe una cuenta con el mismo correo usando otro método de acceso.';
        break;

      case AUTH_ERRORS.NETWORK_FAILED:
        mapped.friendlyMessage = 'Fallo de conexión a la red. Verifica tu conexión a internet e inténtalo de nuevo.';
        break;

      case AUTH_ERRORS.INVALID_API_KEY:
        mapped.friendlyMessage = `La API Key de Firebase para "${projectId}" no es válida. Configúrala en Ajustes o continúa en Modo Local.`;
        mapped.isConfigError = true;
        mapped.actionText = 'Abrir Ajustes';
        break;

      default:
        if (code.includes('api-key') || (err.message && err.message.includes('api-key'))) {
          mapped.friendlyMessage = `La API Key de Firebase no es válida. Puedes configurarla en Ajustes o continuar usando Cuaderno Glass en Modo Local sin problemas.`;
          mapped.isConfigError = true;
          mapped.actionText = 'Abrir Ajustes';
        } else {
          mapped.friendlyMessage = `Error de autenticación: ${err.message || code}`;
        }
        break;
    }

    return mapped;
  }

  async signInWithGoogle() {
    if (!this.auth) {
      await fetchServerFirebaseConfig();
      const app = initializeFirebaseApp();
      if (!app) {
        const errorDetail = {
          code: 'init-failed',
          friendlyMessage: 'No se pudo inicializar Firebase SDK. Revisa tu conexión de red o configuración.',
          isConfigError: true
        };
        store.set('connections.firebase.error', errorDetail.friendlyMessage);
        throw errorDetail;
      }
      this.auth = firebase.auth();
    }

    try {
      logger.info('FirebaseAuth', 'Iniciando popup de Google Sign-In...');
      const provider = this.createGoogleProvider();
      
      const result = await this.auth.signInWithPopup(provider);
      const idToken = await result.user.getIdToken();
      
      this.currentUser = {
        uid: result.user.uid,
        displayName: result.user.displayName || 'Usuario Google',
        email: result.user.email || '',
        photoURL: result.user.photoURL || null,
        isAnonymous: result.user.isAnonymous
      };

      this.lastError = null;
      store.set('user', this.currentUser);
      store.set('session.isAuthenticated', true);
      store.set('session.idToken', idToken);
      store.set('connections.firebase.status', 'connected');
      store.set('connections.firebase.error', null);
      store.set('connections.firebase.authStatus', 'authenticated');

      logger.info('FirebaseAuth', 'Login exitoso con Google', { email: result.user.email });
      events.emit('auth:user-signed-in', this.currentUser);
      return result.user;
    } catch (err) {
      const mappedError = this.mapAuthError(err);
      this.lastError = {
        code: mappedError.code,
        message: mappedError.friendlyMessage,
        timestamp: new Date().toISOString()
      };

      store.set('connections.firebase.error', mappedError.friendlyMessage);
      store.set('connections.firebase.lastAuthError', this.lastError);
      logger.error('FirebaseAuth', `Error en Google Sign-In (${mappedError.code})`, { message: mappedError.friendlyMessage });
      
      throw mappedError;
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
        this._setGuestMode();
        throw err;
      }
    } else {
      this._setGuestMode();
    }
  }
}

export const authService = new FirebaseAuthService();
