/**
 * Cuaderno Glass Pro 4.0 — Módulo de Descuentos & Rastreador de Precios Multitienda 4.5
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { escapeHtml, sanitizeUrl, formatDate } from '../ui/components.js';
import { priceTracker, STORES, detectStoreFromUrl } from '../integrations/price-tracker.js';
import { modals } from '../ui/modals.js';
import { firestoreRepo } from '../firebase/firestore.js';

export class DealsFeature {
  constructor() {
    this.previewContainer = null;
    this.fullListContainer = null;
  }

  init() {
    this.previewContainer = document.getElementById('deals-preview');
    this.fullListContainer = document.getElementById('deals-full-list');

    const form = document.getElementById('form-add-tracker');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTracker(e));
    }

    const urlInput = document.getElementById('input-tracker-url');
    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        const storeDetected = detectStoreFromUrl(e.target.value);
        const storeSelect = document.getElementById('input-tracker-store');
        if (storeSelect && storeDetected) {
          storeSelect.value = storeDetected.name;
        }
      });
    }

    const btnRefreshAll = document.getElementById('btn-refresh-deals');
    if (btnRefreshAll) {
      btnRefreshAll.addEventListener('click', () => this.refreshAllPrices());
    }

    this.render();
  }

  handleAddTracker(e) {
    e.preventDefault();
    const storeSelect = document.getElementById('input-tracker-store');
    const nameInput = document.getElementById('input-tracker-name');
    const urlInput = document.getElementById('input-tracker-url');
    const normalInput = document.getElementById('input-tracker-normal');
    const currentInput = document.getElementById('input-tracker-current');
    const targetInput = document.getElementById('input-tracker-target');

    const productName = nameInput?.value.trim();
    const url = urlInput?.value.trim();
    const normalPrice = parseFloat(normalInput?.value) || 0;
    const currentPrice = parseFloat(currentInput?.value) || 0;
    const targetPrice = parseFloat(targetInput?.value) || 0;
    const storeName = storeSelect?.value || 'Tienda Online';

    if (!productName || !url) {
      toast.warning('Ingresa el nombre del producto y la URL');
      return;
    }

    const tracker = priceTracker.createTracker({
      storeName,
      productName,
      url,
      normalPrice,
      currentPrice,
      targetPrice
    });

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
    const trackers = store.get('priceTrackers', []);
    if (trackers.length === 0) {
      toast.info('No hay productos en seguimiento para actualizar');
      return;
    }

    toast.info('Verificando precios...');
    audio.soundClick();

    for (const t of trackers) {
      await priceTracker.checkPrice(t.id);
    }

    toast.success('Precios verificados');
    this.render();
  }

  deleteTracker(trackerId) {
    priceTracker.deleteTracker(trackerId);
    firestoreRepo.deleteItem('priceTrackers', trackerId).catch(() => {});
    audio.soundClick();
    toast.info('Producto eliminado del rastreador');
    this.render();
  }

  render(searchQuery = '') {
    if (this.previewContainer) this.previewContainer.innerHTML = '';
    if (this.fullListContainer) this.fullListContainer.innerHTML = '';

    let list = store.get('priceTrackers', []);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.productName.toLowerCase().includes(q) || t.store.toLowerCase().includes(q));
    }

    if (list.length === 0) {
      const emptyHtml = `
        <div style="text-align:center; padding:24px 10px; color:var(--text-soft); font-size:0.84rem;">
          🎁 No hay productos en seguimiento todavía. Añade uno de Amazon, Eneba, Mercado Libre o Steam.
        </div>
      `;
      if (this.previewContainer) this.previewContainer.innerHTML = emptyHtml;
      if (this.fullListContainer) this.fullListContainer.innerHTML = emptyHtml;
      this.updateMetrics();
      return;
    }

    list.forEach(item => {
      const storeObj = Object.values(STORES).find(s => s.name === item.store) || STORES.GENERIC;
      const safeUrl = sanitizeUrl(item.url);

      const statusBadges = {
        TARGET_REACHED: '<span class="badge-tag" style="background:rgba(16,185,129,0.22); color:var(--accent-emerald);">🔥 ¡Meta Alcanzada!</span>',
        PRICE_DROP: '<span class="badge-tag" style="background:rgba(6,182,212,0.22); color:var(--accent-cyan);">⚡ Bajó de Precio</span>',
        DISCOUNT: '<span class="badge-tag" style="background:rgba(99,102,241,0.2); color:var(--primary-light);">🏷️ En Oferta</span>',
        NORMAL: '<span class="badge-tag" style="background:rgba(255,255,255,0.06); color:var(--text-soft);">⏳ Normal</span>'
      };

      const card = document.createElement('div');
      card.className = 'tracker-item';
      card.innerHTML = `
        <div class="tracker-head">
          <div style="display:flex; align-items:center; gap:8px; min-width:0;">
            <span style="font-size:1.15rem; flex-shrink:0;">${storeObj.icon}</span>
            <div style="min-width:0;">
              <div class="tracker-title">${escapeHtml(item.productName)}</div>
              <div style="font-size:0.7rem; color:var(--text-soft);">${escapeHtml(item.store)} · Verificado ${formatDate(item.lastChecked)}</div>
            </div>
          </div>
          <div>${statusBadges[item.status] || ''}</div>
        </div>

        <div class="tracker-prices">
          <span class="tracker-current-price">$${item.currentPrice}</span>
          ${item.normalPrice > item.currentPrice ? `<span class="tracker-normal-price">$${item.normalPrice}</span>` : ''}
          ${item.discountPercent > 0 ? `<span class="discount-badge">-${item.discountPercent}% Ahorro ($${item.savings})</span>` : ''}
          ${item.targetPrice > 0 ? `<span class="tracker-target-price">🎯 Meta: $${item.targetPrice}</span>` : ''}
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:8px; margin-top:2px; flex-wrap:wrap; gap:6px;">
          <div style="display:flex; gap:6px;">
            <button class="btn btn-glass btn-sm btn-history" title="Ver historial de precios">📈 Historial</button>
            <button class="btn btn-glass btn-sm btn-check-now" title="Verificar precio ahora">🔄 Chequear</button>
          </div>
          <div style="display:flex; gap:6px;">
            <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Ir a Tienda ↗</a>
            <button class="btn btn-danger btn-sm btn-delete-tracker" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-history').addEventListener('click', () => modals.openPriceHistory(item));
      card.querySelector('.btn-check-now').addEventListener('click', async () => {
        toast.info('Verificando precio...');
        await priceTracker.checkPrice(item.id);
        toast.success('Precio actualizado');
        this.render();
      });
      card.querySelector('.btn-delete-tracker').addEventListener('click', () => this.deleteTracker(item.id));

      if (this.fullListContainer) this.fullListContainer.appendChild(card.cloneNode(true));
      if (this.previewContainer && this.previewContainer.children.length < 3) {
        this.previewContainer.appendChild(card);
      }
    });

    this.updateMetrics();
  }

  updateMetrics() {
    const list = store.get('priceTrackers', []);
    const activeAlerts = list.filter(t => t.status === 'TARGET_REACHED' || t.status === 'DISCOUNT').length;
    const el = document.getElementById('stat-active-alerts');
    if (el) el.textContent = activeAlerts;
  }
}

export const dealsFeature = new DealsFeature();
