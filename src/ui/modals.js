/**
 * Cuaderno Glass Pro 7.0 — Gestor de Modales y Ajustes
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from './toast.js';

export class ModalManager {
  constructor() {
    this.activeModal = null;
  }

  open(modalId) {
    this.close();
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      this.activeModal = modal;
      audio.soundModalOpen();
      
      if (modalId === 'modal-settings') {
        this.populateSettingsForm();
      }
    }
  }

  close() {
    if (this.activeModal) {
      this.activeModal.classList.remove('open');
      this.activeModal = null;
      audio.soundModalClose();
    }
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  openSettings() {
    this.open('modal-settings');
  }

  populateSettingsForm() {
    const settings = store.get('settings', {});
    const volEl = document.getElementById('setting-audio-volume');
    if (volEl) volEl.value = Math.round((settings.audioVolume ?? 0.5) * 100);

    const audioToggle = document.getElementById('setting-audio-toggle');
    if (audioToggle) audioToggle.checked = settings.audioEnabled ?? true;
  }

  saveSettingsFromForm() {
    const vol = parseInt(document.getElementById('setting-audio-volume')?.value || '50', 10) / 100;
    audio.setVolume(vol);

    const audioEnabled = document.getElementById('setting-audio-toggle')?.checked ?? true;
    audio.setMute(!audioEnabled);

    store.set('settings.audioVolume', vol);
    store.set('settings.audioEnabled', audioEnabled);

    this.close();
    toast.success('Ajustes guardados');
  }

  openMigrationModal(counts) {
    const body = document.getElementById('migration-modal-body');
    if (body) {
      body.innerHTML = `
        <p style="margin-bottom: 12px; color: var(--text-muted);">
          Hemos detectado datos guardados localmente en tu dispositivo. Puedes migrarlos a tu cuenta de <strong>Cloud Firestore</strong> para tenerlos disponibles en todos tus dispositivos:
        </p>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;">
          <li>?? <strong>${counts.tasksCount}</strong> Tareas</li>
          <li>?? <strong>${counts.notesCount}</strong> Notas Rápidas</li>
          <li>?? <strong>${counts.documentsCount}</strong> Documentos</li>
          <li>?? <strong>${counts.trackersCount}</strong> Alertas de Ofertas</li>
        </ul>
        <p style="font-size: 0.8rem; color: var(--text-soft);">
          Si decides no migrar ahora, tus datos seguirán disponibles de forma local en este navegador.
        </p>
      `;
    }
    this.open('modal-migration');
  }

  openPriceHistory(tracker) {
    const titleEl = document.getElementById('price-history-title');
    const contentEl = document.getElementById('price-history-content');

    if (titleEl) {
      titleEl.textContent = `?? Historial de Precios — ${tracker.productName}`;
    }

    if (contentEl) {
      const history = tracker.priceHistory || [];
      if (history.length === 0) {
        contentEl.innerHTML = '<p style="color:var(--text-soft); text-align:center;">No hay registros históricos para este producto.</p>';
      } else {
        contentEl.innerHTML = `
          <div style="display:flex; flex-direction:column; gap:8px; max-height:280px; overflow-y:auto;">
            ${history.map((h, i) => `
              <div style="display:flex; justify-content:space-between; padding:8px 12px; background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-sm);">
                <span style="font-family:var(--font-mono); font-size:0.8rem; color:var(--text-soft);">${new Date(h.date).toLocaleString()}</span>
                <span style="font-weight:700; color:${h.price <= tracker.targetPrice ? 'var(--accent-emerald)' : 'var(--text-main)'};">$${h.price.toFixed(2)}</span>
              </div>
            `).reverse().join('')}
          </div>
        `;
      }
    }

    this.open('modal-price-history');
  }
}

export const modals = new ModalManager();
