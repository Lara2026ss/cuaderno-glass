/**
 * Cuaderno Glass Pro 7.0 — Gestor de Modales y Configuración Expandida
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
      if (audio.soundClick) audio.soundClick();

      if (modalId === 'modal-settings') {
        this.populateSettingsForm();
        this._setupSettingsTabs();
        this._setupAccentPicker();
        this._setupImportBackup();
        this._setupNotifPermission();
      }
    }
  }

  close() {
    if (this.activeModal) {
      this.activeModal.classList.remove('open');
      this.activeModal = null;
    }
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
  }

  openSettings() {
    this.open('modal-settings');
  }

  _setupSettingsTabs() {
    const tabBtns = document.querySelectorAll('.settings-tab-btn');
    const panels = document.querySelectorAll('.settings-panel');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        tabBtns.forEach(b => b.classList.remove('active'));
        panels.forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById(`settings-panel-${target}`);
        if (panel) panel.classList.add('active');
      });
    });
  }

  _setupAccentPicker() {
    const swatches = document.querySelectorAll('.accent-swatch');
    const savedAccent = store.get('settings.accentColor', '#6366f1');

    swatches.forEach(sw => {
      if (sw.dataset.color === savedAccent) sw.classList.add('active');
      else sw.classList.remove('active');

      sw.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        store.set('settings.accentColor', sw.dataset.color);
        document.documentElement.style.setProperty('--primary', sw.dataset.color);
      });
    });
  }

  _setupImportBackup() {
    const fileInput = document.getElementById('setting-import-backup');
    const statusEl = document.getElementById('import-backup-status');
    if (!fileInput) return;

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const backup = JSON.parse(ev.target.result);
          if (!backup.version && !backup.tasks && !backup.documents) {
            throw new Error('Formato de backup no reconocido');
          }
          if (backup.tasks) store.set('tasks', backup.tasks);
          if (backup.notes) store.set('notes', backup.notes);
          if (backup.documents) store.set('documents', backup.documents);
          if (backup.priceTrackers) store.set('priceTrackers', backup.priceTrackers);
          if (backup.settings) {
            const s = backup.settings;
            if (s.audioEnabled !== undefined) store.set('settings.audioEnabled', s.audioEnabled);
            if (s.audioVolume !== undefined) store.set('settings.audioVolume', s.audioVolume);
          }
          if (statusEl) statusEl.textContent = 'Backup importado correctamente.';
          toast.success('Backup importado. Recarga para ver los cambios.');
        } catch (err) {
          if (statusEl) statusEl.textContent = `Error: ${err.message}`;
          toast.error('Archivo de backup no válido');
        }
      };
      reader.readAsText(file);
    });
  }

  _setupNotifPermission() {
    const statusEl = document.getElementById('notif-permission-status');
    const btn = document.getElementById('btn-request-notifications');
    if (!statusEl) return;

    const current = typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
    const labels = { granted: 'Permitidas', denied: 'Denegadas', default: 'No solicitadas', unsupported: 'No soportado' };
    statusEl.textContent = `Estado actual: ${labels[current] || current}`;

    if (btn) {
      btn.addEventListener('click', async () => {
        if (typeof Notification === 'undefined') {
          toast.error('Notificaciones no soportadas en este navegador');
          return;
        }
        const perm = await Notification.requestPermission();
        statusEl.textContent = `Estado actual: ${labels[perm] || perm}`;
        if (perm === 'granted') toast.success('Notificaciones activadas');
        else toast.warning('Permiso de notificaciones no concedido');
      });
    }
  }

  populateSettingsForm() {
    const settings = store.get('settings', {});

    const volEl = document.getElementById('setting-audio-volume');
    if (volEl) volEl.value = Math.round((settings.audioVolume ?? 0.5) * 100);

    const audioToggle = document.getElementById('setting-audio-toggle');
    if (audioToggle) audioToggle.checked = settings.audioEnabled ?? true;

    const themeEl = document.getElementById('setting-theme');
    if (themeEl) themeEl.value = settings.theme || 'dark';

    const blurEl = document.getElementById('setting-blur');
    if (blurEl) blurEl.value = settings.blurIntensity ?? 20;

    const animEl = document.getElementById('setting-animations');
    if (animEl) animEl.value = settings.animations || 'full';

    const groqKeyEl = document.getElementById('setting-groq-key');
    if (groqKeyEl) groqKeyEl.value = settings.groqApiKey || '';

    const groqModelEl = document.getElementById('setting-groq-model');
    if (groqModelEl) groqModelEl.value = settings.groqModel || 'llama-3.3-70b-versatile';

    const gcidEl = document.getElementById('setting-google-clientid');
    if (gcidEl) gcidEl.value = settings.googleClientId || '';

    const notifSound = document.getElementById('setting-notif-sound');
    if (notifSound) notifSound.checked = settings.notifSound ?? true;

    // Aplicar acento guardado
    const savedAccent = settings.accentColor;
    if (savedAccent) {
      document.documentElement.style.setProperty('--primary', savedAccent);
    }
  }

  saveSettingsFromForm() {
    const vol = parseInt(document.getElementById('setting-audio-volume')?.value || '50', 10) / 100;
    audio.setVolume(vol);

    const audioEnabled = document.getElementById('setting-audio-toggle')?.checked ?? true;
    audio.setMute(!audioEnabled);

    store.set('settings.audioVolume', vol);
    store.set('settings.audioEnabled', audioEnabled);

    const themeEl = document.getElementById('setting-theme');
    if (themeEl) {
      const theme = themeEl.value;
      document.documentElement.setAttribute('data-theme', theme);
      store.set('settings.theme', theme);
    }

    const blurEl = document.getElementById('setting-blur');
    if (blurEl) {
      const blur = parseInt(blurEl.value, 10);
      store.set('settings.blurIntensity', blur);
      document.documentElement.style.setProperty('--glass-blur', `${blur}px`);
    }

    const animEl = document.getElementById('setting-animations');
    if (animEl) {
      const anim = animEl.value;
      store.set('settings.animations', anim);
      if (anim === 'none') {
        document.documentElement.style.setProperty('--transition-fast', '0s');
        document.documentElement.style.setProperty('--transition-normal', '0s');
      } else if (anim === 'reduced') {
        document.documentElement.style.setProperty('--transition-fast', '0.05s');
        document.documentElement.style.setProperty('--transition-normal', '0.1s');
      } else {
        document.documentElement.style.setProperty('--transition-fast', '0.15s ease-out');
        document.documentElement.style.setProperty('--transition-normal', '0.25s cubic-bezier(0.4, 0, 0.2, 1)');
      }
    }

    const groqKeyEl = document.getElementById('setting-groq-key');
    if (groqKeyEl && groqKeyEl.value.trim()) {
      store.set('settings.groqApiKey', groqKeyEl.value.trim());
    }

    const groqModelEl = document.getElementById('setting-groq-model');
    if (groqModelEl) store.set('settings.groqModel', groqModelEl.value);

    const gcidEl = document.getElementById('setting-google-clientid');
    if (gcidEl && gcidEl.value.trim()) {
      store.set('settings.googleClientId', gcidEl.value.trim());
    }

    const notifSound = document.getElementById('setting-notif-sound');
    if (notifSound) store.set('settings.notifSound', notifSound.checked);

    this.close();
    toast.success('Ajustes guardados correctamente');
  }

  // Compatibilidad con tests
  applyRecommendedPresets() {}
  applyLocalModePreset() {}

  openMigrationModal(counts) {
    const body = document.getElementById('migration-modal-body');
    if (body) {
      body.innerHTML = `
        <p style="margin-bottom:12px;color:var(--text-muted);">
          Detectamos datos locales en tu dispositivo. Puedes migrarlos a tu cuenta de <strong>Cloud Firestore</strong>:
        </p>
        <ul style="list-style:none;display:flex;flex-direction:column;gap:6px;margin-bottom:16px;">
          <li>✔ <strong>${counts.tasksCount}</strong> Tareas</li>
          <li>✔ <strong>${counts.notesCount}</strong> Notas Rápidas</li>
          <li>✔ <strong>${counts.documentsCount}</strong> Documentos</li>
          <li>✔ <strong>${counts.trackersCount}</strong> Alertas de Ofertas</li>
        </ul>
        <p style="font-size:0.8rem;color:var(--text-soft);">
          Si no migras ahora, tus datos seguirán disponibles de forma local.
        </p>
      `;
    }
    this.open('modal-migration');
  }

  openPriceHistory(tracker) {
    const titleEl = document.getElementById('price-history-title');
    const contentEl = document.getElementById('price-history-content');
    if (titleEl) titleEl.textContent = `Historial de Precios - ${tracker.productName}`;
    if (contentEl) {
      const history = tracker.priceHistory || [];
      if (history.length === 0) {
        contentEl.innerHTML = '<p style="color:var(--text-soft);text-align:center;">Sin registros históricos.</p>';
      } else {
        contentEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:8px;max-height:280px;overflow-y:auto;">
            ${history.map(h => `
              <div style="display:flex;justify-content:space-between;padding:8px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:var(--radius-sm);">
                <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--text-soft);">${new Date(h.date).toLocaleString()}</span>
                <span style="font-weight:700;color:${h.price <= tracker.targetPrice ? 'var(--accent-emerald)' : 'var(--text-main)'};">$${h.price.toFixed(2)}</span>
              </div>
            `).reverse().join('')}
          </div>
        `;
      }
    }
    this.open('modal-price-history');
  }

  openDrivePicker(onPickedCallback) {}
}

export const modals = new ModalManager();
