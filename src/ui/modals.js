/**
 * Cuaderno Glass Pro 4.0 — Modal Manager
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from './toast.js';
import { escapeHtml, formatDate } from './components.js';
import { synchronizer } from '../firebase/sync.js';
import { initializeFirebaseApp } from '../firebase/config.js';
import { authService } from '../firebase/auth.js';

export class ModalManager {
  constructor() {
    this.activeModal = null;
  }

  open(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
      el.classList.add('open');
      this.activeModal = el;
      audio.soundClick();
    }
  }

  close() {
    if (this.activeModal) {
      this.activeModal.classList.remove('open');
      this.activeModal = null;
      audio.soundClick();
    }
  }

  openSettings() {
    this._populateSettingsForm();
    this.open('modal-settings');
  }

  _populateSettingsForm() {
    const settings = store.get('settings', {});
    const fbConfig = settings.firebaseConfig || {};

    const fields = {
      'setting-fb-apikey': fbConfig.apiKey || '',
      'setting-fb-authdomain': fbConfig.authDomain || '',
      'setting-fb-projectid': fbConfig.projectId || '',
      'setting-fb-storagebucket': fbConfig.storageBucket || '',
      'setting-fb-appid': fbConfig.appId || '',
      'setting-google-clientid': settings.googleClientId || '',
      'setting-discord-webhook': settings.discordWebhookUrl || '',
      'setting-github-repo': settings.githubRepo || 'Lara2026ss/cuaderno-glass',
      'setting-render-apikey': settings.renderApiKey || '',
      'setting-gemini-apikey': settings.geminiApiKey || '',
      'setting-audio-volume': Math.round((settings.audioVolume ?? 0.5) * 100)
    };

    Object.entries(fields).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    const audioToggle = document.getElementById('setting-audio-toggle');
    if (audioToggle) audioToggle.checked = settings.audioEnabled ?? true;
  }

  saveSettingsFromForm() {
    const getVal = (id) => document.getElementById(id)?.value.trim() || '';

    const apiKey = getVal('setting-fb-apikey');
    const authDomain = getVal('setting-fb-authdomain');
    const projectId = getVal('setting-fb-projectid');
    const storageBucket = getVal('setting-fb-storagebucket');
    const appId = getVal('setting-fb-appid');

    let firebaseConfig = null;
    if (apiKey && authDomain && projectId) {
      firebaseConfig = { apiKey, authDomain, projectId, storageBucket, appId };
    }

    store.set('settings.firebaseConfig', firebaseConfig);
    store.set('settings.googleClientId', getVal('setting-google-clientid'));
    store.set('settings.discordWebhookUrl', getVal('setting-discord-webhook'));
    store.set('settings.githubRepo', getVal('setting-github-repo') || 'Lara2026ss/cuaderno-glass');
    store.set('settings.renderApiKey', getVal('setting-render-apikey'));
    store.set('settings.geminiApiKey', getVal('setting-gemini-apikey'));

    const vol = parseInt(document.getElementById('setting-audio-volume')?.value || '50', 10) / 100;
    audio.setVolume(vol);

    const audioEnabled = document.getElementById('setting-audio-toggle')?.checked ?? true;
    audio.setMute(!audioEnabled);

    // Re-inicializar Firebase si se suministró configuración
    if (firebaseConfig) {
      initializeFirebaseApp(firebaseConfig);
      authService.init();
    }

    this.close();
    toast.success('Configuración guardada correctamente');
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
          <li>📑 <strong>${counts.docsCount}</strong> Documentos</li>
          <li>🎁 <strong>${counts.trackersCount}</strong> Productos Monitoreados</li>
        </ul>
      `;
    }
    this.open('modal-migration');
  }

  async executeMigration() {
    try {
      await synchronizer.migrateLocalToCloud();
      this.close();
      toast.success('¡Datos migrados exitosamente a Firebase Firestore!');
    } catch (e) {
      toast.error('Error durante la migración: ' + e.message);
    }
  }

  openPriceHistory(tracker) {
    const modal = document.getElementById('modal-price-history');
    const title = document.getElementById('price-history-title');
    const content = document.getElementById('price-history-content');

    if (title) title.textContent = `Historial: ${tracker.productName}`;
    if (content) {
      const history = tracker.priceHistory || [];
      if (history.length === 0) {
        content.innerHTML = `<p style="text-align:center; padding:20px; color:var(--text-soft);">Sin datos históricos suficientes.</p>`;
      } else {
        const prices = history.map(h => h.price);
        const min = Math.min(...prices);
        const max = Math.max(...prices);

        content.innerHTML = `
          <div style="display:flex; justify-content:space-around; background:rgba(255,255,255,0.03); padding:12px; border-radius:var(--radius-md); margin-bottom:14px;">
            <div style="text-align:center;"><span style="font-size:0.75rem; color:var(--text-soft);">Mínimo</span><br><strong>$${min}</strong></div>
            <div style="text-align:center;"><span style="font-size:0.75rem; color:var(--text-soft);">Actual</span><br><strong style="color:var(--accent-emerald);">$${tracker.currentPrice}</strong></div>
            <div style="text-align:center;"><span style="font-size:0.75rem; color:var(--text-soft);">Máximo</span><br><strong>$${max}</strong></div>
          </div>
          <div style="max-height: 220px; overflow-y: auto;">
            ${history.map(h => `
              <div style="display:flex; justify-content:space-between; padding:8px 12px; border-bottom:1px solid var(--glass-border); font-size:0.85rem;">
                <span style="color:var(--text-muted);">${formatDate(h.timestamp)}</span>
                <span style="font-family:var(--font-mono); font-weight:600;">$${h.price}</span>
              </div>
            `).reverse().join('')}
          </div>
        `;
      }
    }
    this.open('modal-price-history');
  }

  openDrivePicker(files = [], onFilePicked = null) {
    let modal = document.getElementById('modal-drive-picker');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'modal-backdrop';
      modal.id = 'modal-drive-picker';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="modal-card">
        <div class="card-head">
          <div class="card-title">☁️ Explorar Google Drive</div>
          <button class="btn btn-glass btn-sm btn-close-modal">✕</button>
        </div>
        <div style="max-height: 320px; overflow-y: auto; margin: 12px 0;">
          ${files.length === 0 ? '<p style="text-align:center; padding:20px; color:var(--text-soft);">No se encontraron archivos compatibles en Google Drive.</p>' :
            files.map(f => `
              <div class="task-row drive-file-item" style="cursor:pointer;" data-id="${f.id}" data-name="${escapeHtml(f.name)}" data-mime="${f.mimeType}">
                <span style="font-size:1.2rem;">${f.mimeType.includes('document') ? '📄' : '📑'}</span>
                <div class="task-details">
                  <div class="task-text">${escapeHtml(f.name)}</div>
                  <div class="task-sub">ID: ${f.id}</div>
                </div>
                <button class="btn btn-primary btn-sm">Importar</button>
              </div>
            `).join('')
          }
        </div>
        <div style="display:flex; justify-content:flex-end;">
          <button class="btn btn-glass btn-sm btn-close-modal">Cerrar</button>
        </div>
      </div>
    `;

    modal.querySelectorAll('.btn-close-modal').forEach(b => b.addEventListener('click', () => this.close()));
    modal.querySelectorAll('.drive-file-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        const name = item.dataset.name;
        const mimeType = item.dataset.mime;
        this.close();
        if (onFilePicked) onFilePicked({ id, name, mimeType });
      });
    });

    this.open('modal-drive-picker');
  }
}

export const modals = new ModalManager();
