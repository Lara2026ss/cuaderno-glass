/**
 * Cuaderno Glass Pro 4.0 — Render Services Monitor Adapter
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';

export class RenderAdapter {
  constructor() {
    this.id = 'render';
  }

  async listServices() {
    try {
      const apiKey = store.get('settings.renderApiKey', '');
      const headers = { 'Content-Type': 'application/json' };
      if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

      const res = await fetch('/api/render/services', { headers });
      if (!res.ok) {
        throw new Error(`Servidor backend devolvió estado ${res.status}`);
      }

      const data = await res.json();
      const services = data.services || [];
      store.set('connections.render.services', services);
      store.set('connections.render.lastCheck', new Date().toISOString());
      
      const status = services.length > 0 ? 'connected' : 'disconnected';
      registry.setStatus('render', status);
      logger.info('RenderAdapter', `Monitoreo Render actualizado: ${services.length} servicios detectados`);
      return { ok: true, services };
    } catch (err) {
      logger.warn('RenderAdapter', 'No se pudieron obtener servicios de Render', { error: err.message });
      registry.setStatus('render', 'disconnected', err.message);
      return { ok: false, error: err.message, services: [] };
    }
  }
}

export const renderAdapter = new RenderAdapter();
