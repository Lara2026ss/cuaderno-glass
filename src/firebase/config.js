/**
 * Cuaderno Glass Pro 4.0 — Firebase Public Configuration Loader
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';

// Configuración pública predeterminada para la app web alero-company-works
const DEFAULT_PUBLIC_WEB_CONFIG = {
  projectId: 'alero-company-works',
  appId: '1:16044531269:web:431da21bd13952050d8d2c',
  apiKey: 'AIzaSyBt9pqBxcSOWVSm7fSBJtYSmmPgrb8A_rU',
  authDomain: 'alero-company-works.firebaseapp.com',
  storageBucket: 'alero-company-works.firebasestorage.app',
  messagingSenderId: '16044531269'
};

let cachedConfig = null;

export async function fetchServerFirebaseConfig() {
  if (cachedConfig) return cachedConfig;

  // 1. Priorizar la configuración del servidor backend en Render (.env)
  try {
    const res = await fetch('/api/firebase/config');
    if (res.ok) {
      const data = await res.json();
      if (data && data.projectId && data.apiKey) {
        cachedConfig = {
          projectId: data.projectId,
          authDomain: data.authDomain,
          storageBucket: data.storageBucket,
          messagingSenderId: data.messagingSenderId,
          apiKey: data.apiKey,
          appId: data.appId
        };
        logger.info('FirebaseConfig', 'Configuración de Firebase obtenida de backend Render:', { projectId: data.projectId });
        return cachedConfig;
      }
    }
  } catch (err) {
    logger.debug('FirebaseConfig', 'Backend /api/firebase/config no disponible, usando fallbacks');
  }

  // 2. Verificar si hay credenciales personalizadas guardadas
  const customConfig = store.get('settings.firebaseConfig', null);
  if (customConfig && isValidFirebaseConfig(customConfig)) {
    cachedConfig = customConfig;
    return cachedConfig;
  }

  // 3. Fallback a la configuración pública oficial de la Web App
  cachedConfig = { ...DEFAULT_PUBLIC_WEB_CONFIG };
  return cachedConfig;
}

export function isValidFirebaseConfig(config) {
  if (!config || typeof config !== 'object') return false;
  if (config.apiKey === 'local-mode-no-key') return false;
  return typeof config.projectId === 'string' && config.projectId.trim().length > 0 && typeof config.apiKey === 'string' && config.apiKey.trim().length > 0;
}

export function initializeFirebaseApp(customConfig = null) {
  if (typeof firebase === 'undefined') {
    logger.warn('FirebaseConfig', 'Firebase SDK no cargado en el entorno global');
    return null;
  }

  const config = customConfig || cachedConfig || DEFAULT_PUBLIC_WEB_CONFIG;

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
