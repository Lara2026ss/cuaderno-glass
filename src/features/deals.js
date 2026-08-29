/**
 * Cuaderno Glass Pro 6.0 — Rastreador de Ofertas Multitienda
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { toast } from '../ui/toast.js';
import { audio } from '../audio/audio-engine.js';
import { modals } from '../ui/modals.js';
import { detectStoreFromUrl, calculateDiscountPercent, calculateSavings } from '../integrations/price-tracker.js';
import { firestoreRepo } from '../firebase/firestore.js';

export class DealsFeature {
  constructor() {
    this.container = null;
    this.previewContainer = null;
  }

  init() {
    this.container = document.getElementById('deals-full-list');
    this.previewContainer = document.getElementById('deals-preview');

    const form = document.getElementById('form-add-tracker');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTracker(e));
    }

    const urlInput = document.getElementById('input-tracker-url') || document.getElementById('tracker-url');
    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        const storeDetected = detectStoreFromUrl(e.target.value);
        const storeSelect = document.getElementById('input-tracker-store') || document.getElementById('tracker-store');
        if (storeSelect && storeDetected) {
          storeSelect.value = storeDetected.name;
        }
      });
    }

    const btnRefreshAll = document.getElementById('btn-refresh-deals');
    if (btnRefreshAll) {
      btnRefreshAll.addEventListener('click', () => this.refreshAllPrices());
    }

    // Escuchadores reactivos de sincronización y estado
    events.on('firestore:priceTrackers:synced', () => this.render());
    events.on('state:priceTrackers', () => this.render());
    events.on('tracker:created', () => this.render());
    events.on('tracker:updated', () => this.render());
    events.on('tracker:deleted', () => this.render());
    events.on('tracker:alert', () => this.render());

    this.render();
  }

  handleAddTracker(e) {
    e.preventDefault();
    const storeSelect = document.getElementById('input-tracker-store') || document.getElementById('tracker-store');
    const nameInput = document.getElementById('input-tracker-name') || document.getElementById('tracker-name');
    const urlInput = document.getElementById('input-tracker-url') || document.getElementById('tracker-url');
    const normalInput = document.getElementById('input-tracker-normal') || document.getElementById('tracker-normal-price');
    const currentInput = document.getElementById('input-tracker-current') || document.getElementById('tracker-current-price');
    const targetInput = document.getElementById('input-tracker-target') || document.getElementById('tracker-target-price');

    const productName = nameInput?.value.trim();
    const url = urlInput?.value.trim();
    const normalPrice = parseFloat(normalInput?.value) || 0;
    const currentPrice = parseFloat(currentInput?.value) || 0;
    const targetPrice = parseFloat(targetInput?.value) || 0;
    const storeName = storeSelect?.value || detectStoreFromUrl(url)?.name || 'Tienda Online';

    if (!productName || !url) {
      toast.warning('Ingresa el nombre del producto y la URL');
      return;
    }

    const tracker = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      productName,
      url,
      storeName,
      normalPrice: normalPrice > 0 ? normalPrice : currentPrice,
      currentPrice: currentPrice > 0 ? currentPrice : targetPrice,
      targetPrice,
      currency: '$',
      priceHistory: [{ price: currentPrice > 0 ? currentPrice : targetPrice, date: Date.now() }],
      lastChecked: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const trackers = store.get('priceTrackers', []);
    trackers.unshift(tracker);
    store.set('priceTrackers', trackers);
    firestoreRepo.saveItem('priceTrackers', tracker).catch(() => {});

    if (nameInput) nameInput.value = '';
    if (urlInput) urlInput.value = '';
    if (normalInput) normalInput.value = '';
    if (currentInput) currentInput.value = '';
    if (targetInput) targetInput.value = '';

    audio.soundSuccess();
    toast.success(`Producto "${productName}" añadido al rastreador`);
    this.render();
  }

  async refreshAllPrices() {
    toast.info('Actualizando precios y comprobando rebajas...');
    const trackers = store.get('priceTrackers', []);

    for (const item of trackers) {
      item.lastChecked = Date.now();
      if (item.currentPrice <= item.targetPrice) {
        events.emit('tracker:alert', item);
      }
    }

    store.set('priceTrackers', trackers);
    audio.soundNotification();
    toast.success('Precios verificados con éxito');
    this.render();
  }

  deleteTracker(trackerId) {
    let trackers = store.get('priceTrackers', []);
    trackers = trackers.filter(t => t.id !== trackerId);
    store.set('priceTrackers', trackers);
    firestoreRepo.deleteItem('priceTrackers', trackerId).catch(() => {});

    audio.soundClick();
    toast.info('Producto eliminado del rastreador');
    this.render();
  }

  render() {
    if (typeof document === 'undefined') return;
    this.container = document.getElementById('deals-full-list');
    this.previewContainer = document.getElementById('deals-preview');

    const trackers = store.get('priceTrackers', []);

    const buildCard = (t) => {
      const discount = calculateDiscountPercent(t.normalPrice, t.currentPrice);
      const isTargetReached = t.currentPrice > 0 && t.currentPrice <= t.targetPrice;
      const savings = calculateSavings(t.normalPrice, t.currentPrice);

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.position = 'relative';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <span class="badge-tag" style="background:rgba(99,102,241,0.2); color:var(--primary-light);">🏬 ${t.storeName}</span>
          ${discount > 0 ? `<span class="badge-tag" style="background:rgba(244,63,94,0.2); color:var(--accent-coral); font-weight:700;">-${discount}%</span>` : ''}
        </div>
        <h3 style="font-size:1.05rem; font-weight:700; margin-bottom:10px; line-height:1.3;">${t.productName}</h3>
        <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:12px;">
          <div>
            <div style="font-size:1.4rem; font-weight:800; color:${isTargetReached ? 'var(--accent-emerald)' : 'var(--text-main)'};">
              ${t.currency || '$'}${t.currentPrice.toFixed(2)}
            </div>
            ${t.normalPrice > t.currentPrice ? `<div style="font-size:0.8rem; color:var(--text-soft); text-decoration:line-through;">Normal: $${t.normalPrice.toFixed(2)}</div>` : ''}
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:var(--text-soft);">Meta: $${t.targetPrice.toFixed(2)}</div>
            ${savings > 0 ? `<div style="font-size:0.75rem; color:var(--accent-emerald); font-weight:600;">Ahorras: $${savings.toFixed(2)}</div>` : ''}
          </div>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px; gap:8px;">
          <a href="${t.url}" target="_blank" rel="noopener noreferrer" class="btn btn-glass btn-sm" style="flex:1;">Ir a la tienda ↗</a>
          <button class="btn btn-glass btn-sm btn-hist-tracker" title="Ver Historial">📈</button>
          <button class="btn btn-danger btn-sm btn-del-tracker" title="Eliminar">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-hist-tracker').addEventListener('click', () => {
        modals.openPriceHistory(t);
      });

      card.querySelector('.btn-del-tracker').addEventListener('click', () => {
        this.deleteTracker(t.id);
      });

      return card;
    };

    if (this.container) {
      this.container.innerHTML = '';
      if (trackers.length === 0) {
        this.container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:40px 10px; color:var(--text-soft);">
            🎁 No tienes productos en seguimiento. Añade una URL para rastrear ofertas.
          </div>
        `;
      } else {
        trackers.forEach(t => this.container.appendChild(buildCard(t)));
      }
    }

    if (this.previewContainer) {
      this.previewContainer.innerHTML = '';
      const top3 = trackers.slice(0, 3);
      if (top3.length === 0) {
        this.previewContainer.innerHTML = `
          <div style="grid-column: 1 / -1; text-align:center; padding:32px 20px; color:var(--text-muted); background: rgba(255,255,255,0.02); border: 1px dashed var(--glass-border); border-radius: var(--radius-md);">
            <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.8;">🛍️</div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-main);">Sin alertas activas</div>
            <div style="font-size:0.84rem; color:var(--text-soft);">Añade productos desde la pestaña Ofertas para rastrear su precio.</div>
          </div>
        `;
      } else {
        top3.forEach(t => this.previewContainer.appendChild(buildCard(t)));
      }
    }

    this.updateMetrics();
  }

  updateMetrics() {
    if (typeof document === 'undefined') return;
    const trackers = store.get('priceTrackers', []);
    const statAlerts = document.getElementById('stat-active-alerts');
    const badgeDeals = document.getElementById('badge-deals');

    if (statAlerts) statAlerts.textContent = trackers.length;
    if (badgeDeals) badgeDeals.textContent = trackers.length;
  }
}

export const dealsFeature = new DealsFeature();
