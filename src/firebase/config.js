/**
 * Cuaderno Glass Pro 4.0 — Firebase Configuration Loader
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';

let cachedConfig = null;

export async function fetchServerFirebaseConfig() {
  if (cachedConfig) return cachedConfig;

  // 1. Primero intentar obtener configuración personalizada guardada por el usuario
  const customConfig = store.get('settings.firebaseConfig', null);
  if (customConfig && isValidFirebaseConfig(customConfig)) {
    cachedConfig = customConfig;
    return cachedConfig;
  }

  // 2. Intentar consultar endpoint público del backend
  try {
    const res = await fetch('/api/firebase/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.projectId) {
        cachedConfig = {
          projectId: data.projectId,
          authDomain: data.authDomain,
          storageBucket: data.storageBucket,
          messagingSenderId: data.messagingSenderId,
          apiKey: data.apiKey || '',
          appId: data.appId || ''
        };
        logger.info('FirebaseConfig', 'Configuración de Firebase Web App obtenida de backend:', { projectId: data.projectId });
        return cachedConfig;
      }
    }
  } catch (err) {
    logger.debug('FirebaseConfig', 'Backend /api/firebase/config no disponible, usando fallback público');
  }

  // 3. Fallback predeterminado público (alero-company-works)
  cachedConfig = {
    projectId: 'alero-company-works',
    authDomain: 'alero-company-works.firebaseapp.com',
    storageBucket: 'alero-company-works.appspot.com',
    messagingSenderId: '117099384718',
    apiKey: '',
    appId: ''
  };

  return cachedConfig;
}

export function isValidFirebaseConfig(config) {
  if (!config || typeof config !== 'object') return false;
  return typeof config.projectId === 'string' && config.projectId.trim().length > 0;
}

export function initializeFirebaseApp(customConfig = null) {
  if (typeof firebase === 'undefined') {
    logger.warn('FirebaseConfig', 'Firebase SDK no cargado en el entorno global');
    return null;
  }

  const config = customConfig || cachedConfig || {
    projectId: 'alero-company-works',
    authDomain: 'alero-company-works.firebaseapp.com',
    storageBucket: 'alero-company-works.appspot.com'
  };

  try {
    if (firebase.apps && firebase.apps.length > 0) {
      return firebase.app();
    }
    const app = firebase.initializeApp(config);
    logger.info('FirebaseConfig', `Firebase inicializado exitosamente (${config.projectId})`);
    return app;
  } catch (err) {
    logger.error('FirebaseConfig', 'Error al inicializar Firebase SDK', { error: err.message });
    return null;
  }
}
