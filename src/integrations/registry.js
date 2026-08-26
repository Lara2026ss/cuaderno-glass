/**
 * Cuaderno Glass Pro 4.0 — Integration Registry & Multi-App Architecture
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { events } from '../app/events.js';

export class IntegrationRegistry {
  constructor() {
    this.integrations = new Map();
  }

  register(definition) {
    const { id, name, icon, description, capabilities = [], connect, disconnect, healthCheck, configure } = definition;

    if (!id || !name) {
      throw new Error('La integración requiere "id" y "name" obligatorios');
    }

    this.integrations.set(id, {
      id,
      name,
      icon: icon || '🔌',
      description: description || '',
      capabilities,
      status: store.get(`connections.${id}.status`, 'disconnected'), // connected, disconnected, connecting, error, disabled
      lastCheck: store.get(`connections.${id}.lastSync`, null),
      error: store.get(`connections.${id}.error`, null),
      connect: connect || (async () => {}),
      disconnect: disconnect || (async () => {}),
      healthCheck: healthCheck || (async () => ({ ok: true })),
      configure: configure || (() => {})
    });

    logger.debug('IntegrationRegistry', `Integración registrada: ${name} (${id})`);
    events.emit('integration:registered', id);
  }

  get(id) {
    return this.integrations.get(id) || null;
  }

  getAll() {
    return Array.from(this.integrations.values());
  }

  async setStatus(id, status, error = null) {
    const item = this.integrations.get(id);
    if (!item) return;

    item.status = status;
    item.error = error;
    item.lastCheck = new Date().toISOString();

    store.set(`connections.${id}.status`, status);
    store.set(`connections.${id}.error`, error);
    store.set(`connections.${id}.lastSync`, item.lastCheck);

    events.emit(`integration:${id}:status`, { status, error });
    events.emit('integration:status-changed', { id, status, error });
    logger.info('IntegrationRegistry', `Estado de ${item.name} cambiado a: ${status}`, { error });
  }

  async testConnection(id) {
    const item = this.integrations.get(id);
    if (!item) throw new Error(`Integración "${id}" no encontrada`);

    await this.setStatus(id, 'connecting');
    try {
      const res = await item.healthCheck();
      if (res && res.ok) {
        await this.setStatus(id, 'connected');
        return { ok: true, message: res.message || 'Conexión exitosa' };
      } else {
        const errMsg = res?.error || 'Falló la verificación de estado';
        await this.setStatus(id, 'error', errMsg);
        return { ok: false, error: errMsg };
      }
    } catch (err) {
      await this.setStatus(id, 'error', err.message);
      return { ok: false, error: err.message };
    }
  }
}

export const registry = new IntegrationRegistry();
