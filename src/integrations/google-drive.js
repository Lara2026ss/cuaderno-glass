/**
 * Cuaderno Glass Pro 4.0 — Google Drive Hub Adapter (OAuth2 GIS & Drive API v3)
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';

export class GoogleDriveAdapter {
  constructor() {
    this.id = 'googleDrive';
    this.tokenClient = null;
    this.accessToken = null;
    this.isInitialized = false;
  }

  init(clientId = null) {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      logger.warn('GoogleDrive', 'Google Identity Services (GSI) no cargado');
      return false;
    }

    const cId = clientId || store.get('settings.googleClientId', '');
    if (!cId) {
      logger.info('GoogleDrive', 'Google Client ID no configurado; Drive permanece desconectado');
      return false;
    }

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: (resp) => {
          if (resp.error) {
            logger.error('GoogleDrive', 'Error en OAuth de Google Drive', { error: resp.error });
            registry.setStatus('googleDrive', 'error', resp.error);
            return;
          }
          this.accessToken = resp.access_token;
          store.set('connections.googleDrive.status', 'connected');
          store.set('connections.googleDrive.lastSync', new Date().toISOString());
          registry.setStatus('googleDrive', 'connected');
          logger.info('GoogleDrive', 'Token de acceso a Google Drive obtenido con éxito');
        }
      });

      this.isInitialized = true;
      return true;
    } catch (err) {
      logger.error('GoogleDrive', 'Fallo al inicializar Google Drive Token Client', { error: err.message });
      registry.setStatus('googleDrive', 'error', err.message);
      return false;
    }
  }

  connect() {
    if (!this.tokenClient) {
      const initialized = this.init();
      if (!initialized) {
        throw new Error('Configura tu Google Client ID en el menú de Configuración para conectar Google Drive.');
      }
    }
    this.tokenClient.requestAccessToken({ prompt: 'consent' });
  }

  disconnect() {
    this.accessToken = null;
    store.set('connections.googleDrive.status', 'disconnected');
    registry.setStatus('googleDrive', 'disconnected');
    logger.info('GoogleDrive', 'Google Drive desconectado');
  }

  async listFiles() {
    if (!this.accessToken) {
      throw new Error('No hay sesión activa en Google Drive.');
    }

    const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink)', {
      headers: { 'Authorization': `Bearer ${this.accessToken}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.disconnect();
        throw new Error('La sesión de Google Drive ha expirado. Reconecta tu cuenta.');
      }
      throw new Error(`Google Drive API error: ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  }

  async uploadFile(name, content, mimeType = 'text/markdown') {
    if (!this.accessToken) {
      throw new Error('Conecta tu Google Drive antes de exportar.');
    }

    const metadata = {
      name,
      mimeType
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([content], { type: mimeType }));

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.accessToken}` },
      body: form
    });

    if (!res.ok) {
      throw new Error(`Error al subir archivo a Drive: ${res.statusText}`);
    }

    const result = await res.json();
    logger.info('GoogleDrive', `Archivo subido a Drive: ${name} (ID: ${result.id})`);
    return result;
  }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
