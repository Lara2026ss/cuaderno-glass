/**
 * Cuaderno Glass Pro 4.0 — Motor de Rastreo de Precios & Descuentos Multitienda
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { audio } from '../audio/audio-engine.js';
import { discordAdapter } from './discord.js';
import { events } from '../app/events.js';

const genericStore = { id: 'Web Store', name: 'Tienda Online', icon: '🌐', color: '#818cf8' };

export const STORES = {
  AMAZON: { id: 'Amazon', name: 'Amazon', icon: '🛒', color: '#ff9900' },
  ENEBA: { id: 'Eneba', name: 'Eneba', icon: '🎮', color: '#00e5a3' },
  MERCADOLIBRE: { id: 'Mercado Libre', name: 'Mercado Libre', icon: '📦', color: '#ffe600' },
  STEAM: { id: 'Steam', name: 'Steam', icon: '🕹️', color: '#66c0f4' },
  GENERIC: genericStore,
  OTHER: genericStore
};

export function detectStoreFromUrl(url) {
  if (!url) return STORES.GENERIC;
  const lower = url.toLowerCase();
  if (lower.includes('amazon.')) return STORES.AMAZON;
  if (lower.includes('eneba.')) return STORES.ENEBA;
  if (lower.includes('mercadolibre.') || lower.includes('mercadolivre.')) return STORES.MERCADOLIBRE;
  if (lower.includes('steampowered.') || lower.includes('steamcommunity.')) return STORES.STEAM;
  return STORES.GENERIC;
}

export function calculateDiscountMetrics(normalPrice, currentPrice) {
  const normal = parseFloat(normalPrice) || 0;
  const current = parseFloat(currentPrice) || 0;

  if (normal <= 0 || current <= 0 || current >= normal) {
    return {
      discountPercent: 0,
      savings: 0,
      savingsAmount: 0,
      hasDiscount: false
    };
  }

  const savings = normal - current;
  const discountPercent = Math.round((savings / normal) * 100);

  return {
    discountPercent,
    savings: Math.round(savings * 100) / 100,
    savingsAmount: Math.round(savings * 100) / 100,
    hasDiscount: true
  };
}

export class PriceTrackerService {
  constructor() {
    this.alertCooldownMs = 1000 * 60 * 30; // 30 minutos de cooldown
  }

  createTracker({ storeName, productName, url, currency = 'USD', normalPrice, currentPrice, targetPrice }) {
    const normal = Math.max(0, parseFloat(normalPrice) || 0);
    const current = Math.max(0, parseFloat(currentPrice) || 0);
    const target = Math.max(0, parseFloat(targetPrice) || 0);

    const { discountPercent, savings, hasDiscount } = calculateDiscountMetrics(normal, current);
    
    let status = 'NORMAL';
    if (target > 0 && current > 0 && current <= target) {
      status = 'TARGET_REACHED';
    } else if (hasDiscount) {
      status = 'DISCOUNT';
    }

    const now = Date.now();
    const item = {
      id: now + Math.random().toString(36).substring(2, 6),
      store: storeName || detectStoreFromUrl(url).name,
      productName: productName.trim(),
      url: url.trim(),
      currency,
      normalPrice: normal,
      currentPrice: current,
      targetPrice: target,
      discountPercent,
      savings,
      status,
      enabled: true,
      lastChecked: new Date().toISOString(),
      lastChanged: new Date().toISOString(),
      lastAlertAt: null,
      priceHistory: [
        { timestamp: now, price: current, source: 'initial' }
      ]
    };

    item.history = item.priceHistory;

    const trackers = store.get('priceTrackers', []);
    trackers.unshift(item);
    store.set('priceTrackers', trackers);
    events.emit('tracker:created', item);
    logger.info('PriceTracker', `Producto añadido al rastreador: ${item.productName} ($${item.currentPrice})`);

    // Verificar si ya califica para alerta inmediata
    if (status === 'TARGET_REACHED') {
      this.triggerAlert(item);
    }

    return item;
  }

  createTrackerItem(params) {
    const item = this.createTracker({
      storeName: params.storeName || (params.url ? detectStoreFromUrl(params.url).name : 'Tienda Online'),
      productName: params.name || params.productName || 'Producto',
      url: params.url || '',
      currency: params.currency || 'USD',
      normalPrice: params.normalPrice,
      currentPrice: params.currentPrice,
      targetPrice: params.targetPrice
    });
    item.name = item.productName;
    item.history = item.priceHistory;
    return item;
  }

  checkTargetAlert(tracker, newPrice) {
    const price = typeof newPrice === 'number' ? newPrice : tracker.currentPrice;
    return tracker.targetPrice > 0 && price > 0 && price <= tracker.targetPrice;
  }

  async checkPrice(trackerId) {
    const trackers = store.get('priceTrackers', []);
    const tracker = trackers.find(t => t.id === trackerId);
    if (!tracker || !tracker.enabled) return null;

    logger.info('PriceTracker', `Verificando precio para: ${tracker.productName}`);

    let newPrice = tracker.currentPrice;
    let fetched = false;

    // Intentar consultar endpoint backend de scraping si existe
    try {
      const res = await fetch(`/api/price-tracker/check?url=${encodeURIComponent(tracker.url)}&store=${encodeURIComponent(tracker.store)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.price && typeof data.price === 'number') {
          newPrice = data.price;
          fetched = true;
        }
      }
    } catch (e) {
      logger.debug('PriceTracker', 'Backend scraper no disponible, manteniendo precio manual', { error: e.message });
    }

    const prevPrice = tracker.currentPrice;
    tracker.currentPrice = newPrice;
    tracker.lastChecked = new Date().toISOString();

    const { discountPercent, savings } = calculateDiscountMetrics(tracker.normalPrice, newPrice);
    tracker.discountPercent = discountPercent;
    tracker.savings = savings;

    if (newPrice !== prevPrice) {
      tracker.lastChanged = new Date().toISOString();
      tracker.priceHistory.push({
        timestamp: Date.now(),
        price: newPrice,
        source: fetched ? 'scraper' : 'manual'
      });
      if (tracker.priceHistory.length > 50) tracker.priceHistory.shift();

      if (tracker.targetPrice > 0 && newPrice <= tracker.targetPrice) {
        tracker.status = 'TARGET_REACHED';
        this.triggerAlert(tracker);
      } else if (newPrice < prevPrice) {
        tracker.status = 'PRICE_DROP';
      } else {
        tracker.status = discountPercent > 0 ? 'DISCOUNT' : 'NORMAL';
      }
    }

    store.set('priceTrackers', trackers);
    events.emit('tracker:updated', tracker);
    return tracker;
  }

  triggerAlert(tracker) {
    const now = Date.now();
    if (tracker.lastAlertAt && (now - new Date(tracker.lastAlertAt).getTime()) < this.alertCooldownMs) {
      logger.debug('PriceTracker', `Alerta en cooldown para: ${tracker.productName}`);
      return;
    }

    tracker.lastAlertAt = new Date().toISOString();
    store.save();

    // 1. Sonido de alerta
    audio.soundAlert();

    // 2. Notificación en navegador
    if (store.get('settings.notificationsEnabled', false) && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(`¡Precio Deseado Alcanzado!`, {
        body: `${tracker.productName} está ahora a $${tracker.currentPrice} en ${tracker.store}`,
        icon: 'https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/favicon.png'
      });
    }

    // 3. Notificación a Discord
    discordAdapter.sendPriceAlert(tracker);

    // 4. Emitir evento UI
    events.emit('tracker:alert', tracker);
    logger.info('PriceTracker', `¡Alerta de precio activada para ${tracker.productName}!`);
  }

  deleteTracker(trackerId) {
    let trackers = store.get('priceTrackers', []);
    trackers = trackers.filter(t => t.id !== trackerId);
    store.set('priceTrackers', trackers);
    events.emit('tracker:deleted', trackerId);
    logger.info('PriceTracker', `Producto eliminado del rastreador: ${trackerId}`);
  }
}

export const priceTracker = new PriceTrackerService();
