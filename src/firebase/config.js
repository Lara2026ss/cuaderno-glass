/**
 * Cuaderno Glass Pro 4.0 — Firebase Configuration & Loader
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';

export function getFirebaseConfig() {
  const customConfig = store.get('settings.firebaseConfig', null);
  if (customConfig && isValidFirebaseConfig(customConfig)) {
    return customConfig;
  }

  // Si no hay configuración del usuario en settings, retorna null
  return null;
}

export function isValidFirebaseConfig(config) {
  if (!config || typeof config !== 'object') return false;
  const required = ['apiKey', 'authDomain', 'projectId'];
  return required.every(key => typeof config[key] === 'string' && config[key].trim().length > 0);
}

export function initializeFirebaseApp(customConfig = null) {
  if (typeof firebase === 'undefined') {
    logger.warn('FirebaseConfig', 'Firebase SDK no cargado en el entorno global');
    return null;
  }

  const config = customConfig || getFirebaseConfig();
  if (!config) {
    logger.info('FirebaseConfig', 'Sin configuración de Firebase activa; operando en Modo Local');
    return null;
  }

  try {
    if (firebase.apps.length > 0) {
      return firebase.app();
    }
    const app = firebase.initializeApp(config);
    logger.info('FirebaseConfig', 'Firebase inicializado exitosamente con projectId: ' + config.projectId);
    return app;
  } catch (err) {
    logger.error('FirebaseConfig', 'Fallo al inicializar Firebase', { error: err.message });
    return null;
  }
}
