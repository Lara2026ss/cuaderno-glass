/**
 * Cuaderno Glass Pro 6.0 — Gestor de Modales y Ajustes
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from './toast.js';
import { initializeFirebaseApp } from '../firebase/config.js';
import { authService } from '../firebase/auth.js';

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
    this._populateSettingsForm();
    this._attachPresetListeners();
    this.open('modal-settings');
  }

  _attachPresetListeners() {
    const btnPresetRecommended = document.getElementById('btn-preset-recommended');
    if (btnPresetRecommended && !btnPresetRecommended._attached) {
      btnPresetRecommended.addEventListener('click', () => this.applyRecommendedPresets());
      btnPresetRecommended._attached = true;
    }

    const btnPresetLocal = document.getElementById('btn-preset-local');
    if (btnPresetLocal && !btnPresetLocal._attached) {
      btnPresetLocal.addEventListener('click', () => this.applyLocalModePreset());
      btnPresetLocal._attached = true;
    }
  }

  applyRecommendedPresets() {
    const origin = typeof window !== 'undefined' ? (window.location.origin || 'https://cuaderno-glass.onrender.com') : 'https://cuaderno-glass.onrender.com';
    
    const setVal = (id, val) => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(id);
        if (el) el.value = val;
      }
    };

    setVal('setting-groq-model', 'openai/gpt-oss-120b');
    setVal('setting-github-repo', 'Lara2026ss/cuaderno-glass');
    setVal('setting-google-clientid', '16044531269-bks9e108q788k9j41604a11g742b0365.apps.googleusercontent.com');
    setVal('setting-fb-projectid', 'alero-company-works');
    setVal('setting-fb-authdomain', 'alero-company-works.firebaseapp.com');
    setVal('setting-fb-appid', '1:16044531269:web:431da21bd13952050d8d2c');

    audio.soundNotification();
    toast.success('✨ Preset Recomendado cargado. Si tienes Groq API Key, agrégala y pulsa Guardar.');
  }

  applyLocalModePreset() {
    const setVal = (id, val) => {
      if (typeof document !== 'undefined') {
        const el = document.getElementById(id);
        if (el) el.value = val;
      }
    };

    setVal('setting-fb-apikey', '');
    setVal('setting-fb-authdomain', '');
    setVal('setting-fb-projectid', '');
    setVal('setting-fb-appid', '');

    store.set('settings.firebaseConfig', null);
    store.set('connections.firebase.error', null);
    store.set('connections.firebase.lastAuthError', null);

    audio.soundClick();
    toast.info('💾 Modo Local Óptimo seleccionado. Tus datos se guardarán exclusivamente en tu navegador.');
  }

  _populateSettingsForm() {
    const settings = store.get('settings', {});
    const fbConfig = settings.firebaseConfig || {};

    const fields = {
      'setting-groq-apikey': settings.groqApiKey || '',
      'setting-groq-model': settings.groqModel || 'openai/gpt-oss-120b',
      'setting-fb-apikey': fbConfig.apiKey || '',
      'setting-fb-authdomain': fbConfig.authDomain || '',
      'setting-fb-projectid': fbConfig.projectId || '',
      'setting-fb-storagebucket': fbConfig.storageBucket || '',
      'setting-fb-appid': fbConfig.appId || '',
      'setting-google-clientid': settings.googleClientId || '',
      'setting-discord-webhook': settings.discordWebhookUrl || '',
      'setting-github-repo': settings.githubRepo || 'Lara2026ss/cuaderno-glass',
      'setting-render-apikey': settings.renderApiKey || '',
      'setting-gemini-apikey': settings.groqApiKey || settings.geminiApiKey || '',
      'setting-audio-volume': Math.round((settings.audioVolume ?? 0.5) * 100)
    };

    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    const audioToggle = document.getElementById('setting-audio-toggle');
    if (audioToggle) audioToggle.checked = settings.audioEnabled ?? true;

    // Mostrar el origen de la aplicación para configurar Google Cloud Console
    const originEl = document.getElementById('current-origin-val');
    if (originEl && typeof window !== 'undefined') {
      originEl.textContent = window.location.origin || 'https://cuaderno-glass.onrender.com';
    }
  }



  saveSettingsFromForm() {
    const getVal = (id) => document.getElementById(id)?.value.trim() || '';

    const groqKey = getVal('setting-groq-apikey');
    const groqModel = getVal('setting-groq-model') || 'openai/gpt-oss-120b';

    const apiKey = getVal('setting-fb-apikey');
    const authDomain = getVal('setting-fb-authdomain');
    const projectId = getVal('setting-fb-projectid');
    const storageBucket = getVal('setting-fb-storagebucket');
    const appId = getVal('setting-fb-appid');

    let firebaseConfig = null;
    if (apiKey && authDomain && projectId) {
      firebaseConfig = { apiKey, authDomain, projectId, storageBucket, appId };
    }

    store.set('settings.groqApiKey', groqKey);
    store.set('settings.groqModel', groqModel);
    store.set('settings.geminiApiKey', groqKey);
    store.set('settings.firebaseConfig', firebaseConfig);
    store.set('settings.googleClientId', getVal('setting-google-clientid'));
    store.set('settings.discordWebhookUrl', getVal('setting-discord-webhook'));
    store.set('settings.githubRepo', getVal('setting-github-repo') || 'Lara2026ss/cuaderno-glass');
    store.set('settings.renderApiKey', getVal('setting-render-apikey'));

    const vol = parseInt(document.getElementById('setting-audio-volume')?.value || '50', 10) / 100;
    audio.setVolume(vol);

    const audioEnabled = document.getElementById('setting-audio-toggle')?.checked ?? true;
    audio.setMute(!audioEnabled);

    // Re-inicializar Firebase si se suministró configuración
    let requiresReload = false;
    
    if (firebaseConfig) {
      const currentConfig = store.get('settings.firebaseConfig');
      if (JSON.stringify(currentConfig) !== JSON.stringify(firebaseConfig)) {
        requiresReload = true;
      }
    }

    this.close();
    
    if (requiresReload) {
      toast.info('Recargando para aplicar ajustes de nube...');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      toast.success('Configuración guardada correctamente');
    }
  }

  openMigrationModal(counts) {
    const body = document.getElementById('migration-modal-body');
    if (body) {
      body.innerHTML = `
        <p style="margin-bottom: 12px; color: var(--text-muted);">
          Hemos detectado datos guardados localmente en tu dispositivo. Puedes migrarlos a tu cuenta de <strong>Cloud Firestore</strong> para tenerlos disponibles en todos tus dispositivos:
        </p>
        <ul style="list-style: none; display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px;">
          <li>📌 <strong>${counts.tasksCount}</strong> Tareas</li>
          <li>📝 <strong>${counts.notesCount}</strong> Notas Rápidas</li>
          <li>📑 <strong>${counts.documentsCount}</strong> Documentos</li>
          <li>🎁 <strong>${counts.trackersCount}</strong> Alertas de Ofertas</li>
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
      titleEl.textContent = `📈 Historial de Precios — ${tracker.productName}`;
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

  openDrivePicker(onPickedCallback) {
    // Implementado directamente por googleDriveAdapter.openPicker()
  }
}

export const modals = new ModalManager();
