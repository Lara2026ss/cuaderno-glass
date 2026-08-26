/**
 * Cuaderno Glass Pro 4.0 — Discord Webhook Adapter & Dispatcher
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';

export class DiscordAdapter {
  constructor() {
    this.id = 'discord';
  }

  getWebhookUrl() {
    return store.get('settings.discordWebhookUrl', '');
  }

  async testWebhook(webhookUrl = null) {
    const url = webhookUrl || this.getWebhookUrl();
    if (!url || !url.startsWith('https://discord.com/api/webhooks/')) {
      throw new Error('URL de Discord Webhook inválida. Debe comenzar con https://discord.com/api/webhooks/...');
    }

    const payload = {
      username: "Cuaderno Glass Hub",
      avatar_url: "https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/favicon.png",
      embeds: [{
        title: "✨ Conexión Exitosa con Cuaderno Glass",
        description: "El notificador de Discord ha sido enlazado y verificado correctamente.",
        color: 0x6366f1,
        timestamp: new Date().toISOString(),
        footer: { text: "Cuaderno Glass Suite Pro 4.0" }
      }]
    };

    return await this._dispatch(url, payload);
  }

  async sendNotification({ title, description, color = 0x6366f1, fields = [] }) {
    const url = this.getWebhookUrl();
    if (!url) return { ok: false, error: 'Webhook no configurado' };

    const payload = {
      username: "Cuaderno Glass Hub",
      embeds: [{
        title,
        description,
        color,
        fields,
        timestamp: new Date().toISOString(),
        footer: { text: "Cuaderno Glass Notification" }
      }]
    };

    return await this._dispatch(url, payload);
  }

  async sendPriceAlert(tracker) {
    const discountStr = tracker.discountPercent > 0 ? `(-${tracker.discountPercent}%)` : '';
    return await this.sendNotification({
      title: `🔥 ¡Alerta de Precio Bajo! ${tracker.productName}`,
      description: `El producto ha alcanzado el precio deseado en **${tracker.store}**.\n[Abrir Producto en Tienda](${tracker.url})`,
      color: 0x10b981,
      fields: [
        { name: "Precio Actual", value: `$${tracker.currentPrice} ${discountStr}`, inline: true },
        { name: "Precio Normal", value: `$${tracker.normalPrice}`, inline: true },
        { name: "Precio Deseado", value: `$${tracker.targetPrice}`, inline: true }
      ]
    });
  }

  async sendTaskCompleted(task) {
    return await this.sendNotification({
      title: `✅ Tarea Completada: ${task.text}`,
      description: `Categoría: **${task.category}** · Prioridad: **${task.priority.toUpperCase()}**`,
      color: 0x6366f1
    });
  }

  async _dispatch(webhookUrl, payload) {
    try {
      // Intentar primero a través del backend seguro si está disponible
      let response;
      try {
        response = await fetch('/api/discord/webhook', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl, payload })
        });
      } catch (backendErr) {
        // Fallback a llamada directa si se corre standalone
        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (response.ok || response.status === 204) {
        store.set('connections.discord.lastDispatch', new Date().toISOString());
        registry.setStatus('discord', 'connected');
        logger.info('DiscordAdapter', 'Mensaje despachado a Discord exitosamente');
        return { ok: true };
      } else {
        const text = await response.text();
        throw new Error(`Discord API respondió con código ${response.status}: ${text}`);
      }
    } catch (err) {
      logger.error('DiscordAdapter', 'Fallo al enviar a Discord', { error: err.message });
      registry.setStatus('discord', 'error', err.message);
      return { ok: false, error: err.message };
    }
  }
}

export const discordAdapter = new DiscordAdapter();
