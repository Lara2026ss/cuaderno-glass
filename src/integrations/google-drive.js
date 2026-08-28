/**
 * Cuaderno Glass Pro 5.0 — Google Drive Hub Adapter (OAuth2 GIS, Drive Picker & Drive API v3)
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
    this.pickerApiLoaded = false;
  }

  init(clientId = null) {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.oauth2) {
      logger.warn('GoogleDrive', 'Google Identity Services (GSI) no cargado');
      return false;
    }

    const cId = clientId || store.get('settings.googleClientId', '') || '16044531269-lhlidcqkvpcdeedqlforahn4bqp2tkla.apps.googleusercontent.com';
    if (!cId) {
      logger.info('GoogleDrive', 'Google Client ID no configurado; Drive permanece desconectado');
      return false;
    }

    try {
      this.tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: cId,
        scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
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

  async connect() {
    return new Promise((resolve, reject) => {
      if (!this.tokenClient) {
        const initialized = this.init();
        if (!initialized) {
          return reject(new Error('Configura tu Google Client ID en Configuración para conectar Google Drive.'));
        }
      }

      const prevCallback = this.tokenClient.callback;
      this.tokenClient.callback = (resp) => {
        if (prevCallback) prevCallback(resp);
        if (resp.error) {
          reject(new Error(`Error al conectar Google Drive: ${resp.error}`));
        } else {
          this.accessToken = resp.access_token;
          resolve(this.accessToken);
        }
      };

      this.tokenClient.requestAccessToken({ prompt: this.accessToken ? '' : 'consent' });
    });
  }

  disconnect() {
    this.accessToken = null;
    store.set('connections.googleDrive.status', 'disconnected');
    registry.setStatus('googleDrive', 'disconnected');
    logger.info('GoogleDrive', 'Google Drive desconectado');
  }

  async ensureAccessToken() {
    if (this.accessToken) return this.accessToken;
    return await this.connect();
  }

  async listFiles(pageSize = 20) {
    const token = await this.ensureAccessToken();

    const res = await fetch(`https://www.googleapis.com/drive/v3/files?pageSize=${pageSize}&fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,size)&q=trashed=false`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      if (res.status === 401) {
        this.disconnect();
        throw new Error('La sesión de Google Drive ha expirado. Reconecta tu cuenta.');
      }
      throw new Error(`Google Drive API error (${res.status}): ${res.statusText}`);
    }

    const data = await res.json();
    return data.files || [];
  }

  async downloadFile(fileId, mimeType = 'text/plain') {
    const token = await this.ensureAccessToken();

    // Si es un Google Doc nativo, exportar a texto/markdown
    let url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    if (mimeType.includes('google-apps.document')) {
      url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=text/plain`;
    }

    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!res.ok) {
      throw new Error(`Error al descargar archivo de Google Drive (${res.status})`);
    }

    return await res.text();
  }

  async uploadFile(name, content, mimeType = 'text/markdown') {
    const token = await this.ensureAccessToken();

    const metadata = {
      name: name.endsWith('.md') || name.endsWith('.txt') ? name : `${name}.md`,
      mimeType: 'text/markdown',
      description: 'Documento exportado desde Cuaderno Glass Pro 5.0'
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
      content +
      closeDelimiter;

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`
      },
      body: multipartRequestBody
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Error al subir a Google Drive: ${errData.error?.message || res.statusText}`);
    }

    const file = await res.json();
    logger.info('GoogleDrive', `Archivo exportado con éxito a Google Drive: ${file.name} (${file.id})`);
    return file;
  }

  async getFileMetadata(fileId) {
    const token = await this.ensureAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,modifiedTime,version,trashed`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) {
      throw new Error(`Error al consultar metadatos en Google Drive (${res.status})`);
    }
    return await res.json();
  }

  async updateFile(fileId, content, mimeType = 'text/markdown') {
    const token = await this.ensureAccessToken();
    const res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `${mimeType}; charset=UTF-8`
      },
      body: content
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Error al actualizar archivo en Google Drive: ${errData.error?.message || res.statusText}`);
    }

    const updated = await res.json();
    logger.info('GoogleDrive', `Archivo ${fileId} actualizado en Google Drive`);
    return updated;
  }

  async openPicker(onFilePicked) {
    await this.ensureAccessToken();

    if (typeof gapi !== 'undefined' && gapi.load && typeof google !== 'undefined' && google.picker) {
      this._showGapiPicker(onFilePicked);
    } else if (typeof gapi !== 'undefined' && gapi.load) {
      gapi.load('picker', {
        callback: () => {
          this.pickerApiLoaded = true;
          this._showGapiPicker(onFilePicked);
        }
      });
    } else {
      // Fallback a selector modal integrado en Glass UI
      this._showFallbackPicker(onFilePicked);
    }
  }

  _showGapiPicker(onFilePicked) {
    try {
      const view = new google.picker.View(google.picker.ViewId.DOCS);
      view.setMimeTypes('text/plain,text/markdown,application/vnd.google-apps.document');

      const picker = new google.picker.PickerBuilder()
        .enableFeature(google.picker.Feature.NAV_HIDDEN)
        .setAppId('16044531269')
        .setOAuthToken(this.accessToken)
        .addView(view)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED) {
            const doc = data.docs[0];
            if (doc && onFilePicked) {
              onFilePicked({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                url: doc.url
              });
            }
          }
        })
        .build();

      picker.setVisible(true);
    } catch (err) {
      logger.warn('GoogleDrive', 'Picker oficial no disponible, abriendo selector Glass modal', { error: err.message });
      this._showFallbackPicker(onFilePicked);
    }
  }

  async _showFallbackPicker(onFilePicked) {
    const files = await this.listFiles(25);
    const event = new CustomEvent('drive:show-picker-modal', {
      detail: { files, onFilePicked }
    });
    window.dispatchEvent(event);
  }
}

export const googleDriveAdapter = new GoogleDriveAdapter();
