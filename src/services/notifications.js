/**
 * Cuaderno Glass Pro 5.0 — Notification Engine Centralizado (Web Push, Discord, Telegram & In-App)
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { toast } from '../ui/toast.js';
import { audio } from '../audio/audio-engine.js';
import { discordAdapter } from '../integrations/discord.js';

export const NOTIFICATION_EVENTS = {
  PRICE_TARGET_REACHED: 'PRICE_TARGET_REACHED',
  PRICE_DROP: 'PRICE_DROP',
  TASK_DUE: 'TASK_DUE',
  TASK_COMPLETED: 'TASK_COMPLETED',
  SYNC_RESTORED: 'SYNC_RESTORED',
  DOCUMENT_EXPORTED: 'DOCUMENT_EXPORTED',
  SYSTEM_ERROR: 'SYSTEM_ERROR'
};

export class NotificationEngine {
  constructor() {
    this.channels = {
      inApp: true,
      webPush: true,
      discord: true,
      telegram: true
    };
  }

  async dispatch(event, payload = {}) {
    logger.info('NotificationEngine', `Despachando evento: ${event}`, payload);

    const title = payload.title || this._getDefaultTitle(event);
    const message = payload.message || payload.body || '';

    // 1. In-App Toasts & Sound
    if (this.channels.inApp) {
      if (event === NOTIFICATION_EVENTS.PRICE_TARGET_REACHED || event === NOTIFICATION_EVENTS.PRICE_DROP) {
        audio.soundAlert();
        toast.success(`🎯 ${title}: ${message}`);
      } else if (event === NOTIFICATION_EVENTS.SYSTEM_ERROR) {
        audio.soundError();
        toast.error(`⚠️ ${title}: ${message}`);
      } else {
        audio.soundNotification();
        toast.info(`🔔 ${title}: ${message}`);
      }
    }

    // 2. Web Push / Browser Notification API
    if (this.channels.webPush && store.get('settings.notificationsEnabled', false)) {
      this._sendBrowserNotification(title, message);
    }

    // 3. Discord Webhook (Aislado para no romper otros canales)
    if (this.channels.discord && store.get('settings.discordWebhookUrl')) {
      try {
        await discordAdapter.sendPriceAlert({
          productName: payload.productName || title,
          store: payload.store || 'Web',
          currentPrice: payload.currentPrice || 0,
          targetPrice: payload.targetPrice || 0,
          url: payload.url || ''
        });
      } catch (err) {
        logger.warn('NotificationEngine', 'Fallo al enviar a Discord (canal aislado):', err.message);
      }
    }

    // 4. Telegram Bot (Aislado)
    if (this.channels.telegram && store.get('settings.telegramBotToken') && store.get('settings.telegramChatId')) {
      try {
        await this._sendTelegramMessage(title, message);
      } catch (err) {
        logger.warn('NotificationEngine', 'Fallo al enviar a Telegram (canal aislado):', err.message);
      }
    }
  }

  _sendBrowserNotification(title, body) {
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, {
          body,
          icon: 'https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/favicon.png'
        });
      }
    } catch (e) {
      logger.debug('NotificationEngine', 'Browser Notification notice:', e.message);
    }
  }

  async _sendTelegramMessage(title, body) {
    const token = store.get('settings.telegramBotToken');
    const chatId = store.get('settings.telegramChatId');
    if (!token || !chatId) return;

    const text = `🔔 *${title}*\n${body}`;
    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    });
  }

  _getDefaultTitle(event) {
    switch (event) {
      case NOTIFICATION_EVENTS.PRICE_TARGET_REACHED: return '¡Precio Objetivo Alcanzado!';
      case NOTIFICATION_EVENTS.PRICE_DROP: return '¡Bajada de Precio Detectada!';
      case NOTIFICATION_EVENTS.TASK_COMPLETED: return 'Tarea Completada';
      case NOTIFICATION_EVENTS.DOCUMENT_EXPORTED: return 'Documento Exportado a Drive';
      case NOTIFICATION_EVENTS.SYNC_RESTORED: return 'Sincronización Cloud Restablecida';
      default: return 'Notificación Cuaderno Glass';
    }
  }
}

export const notificationEngine = new NotificationEngine();
