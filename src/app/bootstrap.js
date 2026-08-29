/**
 * Cuaderno Glass Pro 6.0 — Bootstrap Principal y Orquestador Modular
 */

import { store } from './state.js';
import { events } from './events.js';
import { logger } from './logger.js';
import { toast } from '../ui/toast.js';
import { audio } from '../audio/audio-engine.js';
import { modals } from '../ui/modals.js';
import { AppRouter } from './router.js';

import { initializeFirebaseApp } from '../firebase/config.js';
import { authService } from '../firebase/auth.js';
import { firestoreRepo } from '../firebase/firestore.js';
import { dataSyncManager } from '../firebase/sync.js';

import { tasksFeature } from '../features/tasks.js';
import { notesFeature } from '../features/notes.js';
import { dealsFeature } from '../features/deals.js';
import { documentsFeature } from '../features/documents.js';
import { geminiFeature } from '../features/gemini.js';
import { pomodoroFeature } from '../features/pomodoro.js';
import { connectorsFeature } from '../features/connectors.js';

class AppBootstrap {
  constructor() {
    this.router = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.initialized = true;

    logger.info('Bootstrap', 'Iniciando Cuaderno Glass Pro 6.0...');

    this._setupGlobalErrorHandling();
    this._setupTheme();
    this._setupAudio();
    this._setupRouter();
    this._setupFirebase();
    this._setupFeatures();
    this._setupGlobalUI();
    this._setupAuthUI();
    this._setupModals();

    audio.soundStart();
    logger.info('Bootstrap', 'Cuaderno Glass Pro 6.0 iniciado con éxito.');
  }

  _setupGlobalErrorHandling() {
    window.addEventListener('error', (event) => {
      logger.error('GlobalError', event.message, { filename: event.filename, lineno: event.lineno });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('UnhandledPromise', event.reason?.message || event.reason);
    });
  }

  _setupTheme() {
    const savedTheme = store.get('settings.theme', 'dark');
    document.documentElement.setAttribute('data-theme', savedTheme);

    const btnTheme = document.getElementById('btn-theme-toggle');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        store.set('settings.theme', next);
        audio.soundClick();
        toast.info(`Tema cambiado a ${next === 'dark' ? 'Oscuro' : 'Claro'}`);
      });
    }
  }

  _setupAudio() {
    const enabled = store.get('settings.audioEnabled', true);
    const volume = store.get('settings.audioVolume', 0.5);
    audio.setMute(!enabled);
    audio.setVolume(volume);
  }

  _setupRouter() {
    this.router = new AppRouter('dashboard');
    this.router.init();
  }

  async _setupFirebase() {
    const config = store.get('settings.firebaseConfig');
    if (config && config.apiKey) {
      try {
        initializeFirebaseApp(config);
        await authService.init();
      } catch (err) {
        logger.warn('Bootstrap', 'Firebase no pudo inicializarse con la configuración guardada', err);
      }
    } else {
      logger.info('Bootstrap', 'Operando en Modo Local / Demo (sin Firebase)');
    }
  }

  _setupFeatures() {
    tasksFeature.init();
    notesFeature.init();
    dealsFeature.init();
    documentsFeature.init();
    geminiFeature.init();
    pomodoroFeature.init();
    connectorsFeature.init();
  }

  _setupGlobalUI() {
    const searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const q = e.target.value;
        tasksFeature.render(q);
        documentsFeature.render(q);
      });
    }

    const btnQuickNew = document.getElementById('btn-quick-new');
    if (btnQuickNew) {
      btnQuickNew.addEventListener('click', () => {
        this.router.navigate('tasks');
        const input = document.getElementById('task-input-text') || document.getElementById('input-task-text');
        if (input) input.focus();
      });
    }

    const mobileBtn = document.getElementById('mobile-btn');
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('mobile-overlay');

    if (mobileBtn && sidebar && overlay) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      });

      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }
  }

  _setupAuthUI() {
    const authBtn = document.getElementById('btn-google-auth');
    const authText = document.getElementById('auth-btn-text');
    const avatarImg = document.getElementById('user-avatar-img');
    const userName = document.getElementById('user-display-name');
    const userEmail = document.getElementById('user-display-email');

    const updateProfileUI = () => {
      const user = store.get('user');
      if (user) {
        if (userName) userName.textContent = user.displayName || 'Usuario Google';
        if (userEmail) userEmail.textContent = user.email || 'Conectado a la nube';
        if (avatarImg) {
          avatarImg.innerHTML = user.photoURL 
            ? `<img src="${user.photoURL}" alt="Avatar" style="width:100%; height:100%; border-radius:50%;">`
            : '👤';
        }
        if (authText) authText.textContent = 'Cerrar Sesión';
      } else {
        if (userName) userName.textContent = 'Modo Local / Demo';
        if (userEmail) userEmail.textContent = 'Sin conexión cloud';
        if (avatarImg) avatarImg.innerHTML = '👤';
        if (authText) authText.textContent = 'Iniciar Sesión con Google';
      }
    };

    updateProfileUI();

    events.on('auth:changed', () => {
      updateProfileUI();
      this._renderConnectorsView();
    });

    events.on('auth:login', (u) => {
      updateProfileUI();
      this._renderConnectorsView();
      toast.success(`Bienvenido, ${u.displayName || u.email}`);
    });

    events.on('auth:logout', () => {
      updateProfileUI();
      this._renderConnectorsView();
      toast.info('Sesión cerrada');
    });

    if (authBtn) {
      authBtn.addEventListener('click', async () => {
        audio.soundClick();
        const user = store.get('user');

        if (user) {
          try {
            await authService.signOut();
          } catch (e) {
            toast.error('Error al cerrar sesión');
          }
        } else {
          try {
            authBtn.disabled = true;
            if (authText) authText.textContent = 'Abriendo Google...';
            toast.info('Abriendo inicio de sesión con Google...');

            await authService.signInWithGoogle();
          } catch (mappedError) {
            logger.warn('AuthUI', 'Aviso de autenticación:', mappedError);
            
            if (mappedError.isConfigError) {
              toast.info(mappedError.friendlyMessage || 'Modo Local activo. Para sincronizar con la nube, configura Firebase en Ajustes.');
            } else {
              toast.error(mappedError.friendlyMessage || mappedError.message || 'No se pudo completar el inicio de sesión');
            }
          } finally {
            authBtn.disabled = false;
            updateProfileUI();
            this._renderConnectorsView();
          }
        }
      });
    }

    events.on('sync:migration-available', (counts) => {
      modals.openMigrationModal(counts);
    });
  }

  _setupModals() {
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => modals.close());
    });

    const btnSettings = document.getElementById('btn-open-settings');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => modals.openSettings());
    }

    const formSettings = document.getElementById('form-settings');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        modals.saveSettingsFromForm();
      });
    }

    const btnConfirmMigrate = document.getElementById('btn-confirm-migration');
    if (btnConfirmMigrate) {
      btnConfirmMigrate.addEventListener('click', async () => {
        btnConfirmMigrate.disabled = true;
        btnConfirmMigrate.textContent = 'Migrando datos...';
        await dataSyncManager.confirmPendingMigration();
        btnConfirmMigrate.disabled = false;
        btnConfirmMigrate.textContent = 'Migrar a Mi Cuenta Cloud';
        modals.close();
      });
    }

    const btnBackup = document.getElementById('btn-export-full-backup');
    if (btnBackup) {
      btnBackup.addEventListener('click', () => {
        const fullBackup = {
          version: '6.0.0',
          exportedAt: new Date().toISOString(),
          tasks: store.get('tasks', []),
          notes: store.get('notes', []),
          documents: store.get('documents', []),
          priceTrackers: store.get('priceTrackers', []),
          settings: store.get('settings', {})
        };
        const blob = new Blob([JSON.stringify(fullBackup, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cuaderno-glass-backup-${Date.now()}.json`;
        a.click();
        toast.success('Backup exportado exitosamente');
      });
    }
  }

  _renderConnectorsView() {
    connectorsFeature.render();
  }
}

export const bootstrap = new AppBootstrap();
