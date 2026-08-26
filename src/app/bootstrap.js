/**
 * Cuaderno Glass Pro 4.0 — Inicializador Maestro & Error Boundary 4.5
 */

import { store } from './state.js';
import { logger } from './logger.js';
import { events } from './events.js';
import { router } from './router.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { modals } from '../ui/modals.js';
import { authService } from '../firebase/auth.js';
import { synchronizer } from '../firebase/sync.js';
import { registry } from '../integrations/registry.js';
import { discordAdapter } from '../integrations/discord.js';
import { githubAdapter } from '../integrations/github.js';
import { renderAdapter } from '../integrations/render.js';
import { googleDriveAdapter } from '../integrations/google-drive.js';
import { geminiProvider } from '../integrations/gemini.js';
import { tasksFeature } from '../features/tasks.js';
import { notesFeature } from '../features/notes.js';
import { documentsFeature } from '../features/documents.js';
import { dealsFeature } from '../features/deals.js';
import { pomodoroFeature } from '../features/pomodoro.js';
import { searchFeature } from '../features/search.js';

export class AppBootstrap {
  async init() {
    this._setupGlobalErrorBoundaries();
    this._setupTheme();
    this._setupNavigation();
    this._setupIntegrations();
    this._setupAuthUI();
    this._setupModals();
    this._setupCopilot();

    // Inicializar Audio
    audio.init();

    // Inicializar Features
    tasksFeature.init();
    notesFeature.init();
    documentsFeature.init();
    dealsFeature.init();
    pomodoroFeature.init();
    searchFeature.init();

    // Inicializar Sincronizador & Auth
    synchronizer.init();
    await authService.init();

    // Inicializar Router
    router.init();

    logger.info('Bootstrap', 'Cuaderno Glass Pro 4.0 inicializado exitosamente');
  }

  _setupGlobalErrorBoundaries() {
    window.addEventListener('error', (event) => {
      logger.error('ErrorBoundary', 'Error global capturado', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      logger.error('ErrorBoundary', 'Promesa no manejada', {
        reason: event.reason ? (event.reason.message || String(event.reason)) : 'Desconocida'
      });
    });
  }

  _setupTheme() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    const currentTheme = store.get('settings.theme', 'dark');
    document.documentElement.setAttribute('data-theme', currentTheme);

    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        store.set('settings.theme', nextTheme);
        audio.soundClick();
        toast.info(nextTheme === 'dark' ? '🌙 Modo Dark Glass' : '☀️ Modo Frost Light');
      });
    }
  }

  _setupNavigation() {
    document.querySelectorAll('#nav-btns .nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        audio.soundClick();
        router.navigate(btn.dataset.tab);
      });
    });

    const mobileBtn = document.getElementById('mobile-btn');
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('mobile-overlay');

    if (mobileBtn && sidebar) {
      mobileBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active', sidebar.classList.contains('open'));
        audio.soundClick();
      });
    }

    if (overlay && sidebar) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
      });
    }

    const btnQuickNew = document.getElementById('btn-quick-new');
    if (btnQuickNew) {
      btnQuickNew.addEventListener('click', () => {
        audio.soundClick();
        router.navigate('documents');
        documentsFeature.toggleEditor(true);
      });
    }

    const btnGotoDeals = document.getElementById('btn-goto-deals');
    if (btnGotoDeals) {
      btnGotoDeals.addEventListener('click', () => {
        audio.soundClick();
        router.navigate('deals');
      });
    }
  }

  _setupIntegrations() {
    // Registrar todas las integraciones en el registry (FASE 18)
    registry.register({
      id: 'firebase',
      name: 'Firebase Firestore & Auth',
      icon: '🔥',
      description: 'Base de datos en la nube y autenticación de usuarios',
      capabilities: ['auth', 'database'],
      healthCheck: async () => ({ ok: store.get('connections.firebase.status') === 'connected' })
    });

    registry.register({
      id: 'discord',
      name: 'Discord Webhooks',
      icon: '📢',
      description: 'Despacho de alertas y notificaciones a canales privados',
      capabilities: ['notifications'],
      healthCheck: async () => await discordAdapter.testWebhook()
    });

    registry.register({
      id: 'github',
      name: 'GitHub Repository',
      icon: '🐙',
      description: 'Sincronización con repositorio oficial',
      capabilities: ['source-code'],
      healthCheck: async () => await githubAdapter.getRepoInfo()
    });

    registry.register({
      id: 'render',
      name: 'Render Services Monitor',
      icon: '⚡',
      description: 'Monitoreo de estado de servidores y bots en Render',
      capabilities: ['monitoring'],
      healthCheck: async () => await renderAdapter.listServices()
    });

    registry.register({
      id: 'googleDrive',
      name: 'Google Drive Cloud',
      icon: '☁️',
      description: 'Almacenamiento y exportación de documentos',
      capabilities: ['storage'],
      healthCheck: async () => ({ ok: store.get('connections.googleDrive.status') === 'connected' })
    });

    registry.register({
      id: 'gemini',
      name: 'Gemini AI Copilot',
      icon: '✨',
      description: 'Asistente de inteligencia artificial contextual',
      capabilities: ['ai'],
      healthCheck: async () => ({ ok: true })
    });

    const btnRunAllHealth = document.getElementById('btn-run-all-health');
    if (btnRunAllHealth) {
      btnRunAllHealth.addEventListener('click', async () => {
        toast.info('Ejecutando diagnóstico en todas las integraciones...');
        const all = registry.getAll();
        for (const item of all) {
          await registry.testConnection(item.id);
        }
        toast.success('Diagnóstico global completado');
        this._renderConnectorsView();
      });
    }

    // Renderizar tarjetas de integraciones
    this._renderConnectorsView();
  }

  _renderConnectorsView() {
    const listEl = document.getElementById('connectors-cards-grid');
    if (!listEl) return;
    listEl.innerHTML = '';

    const all = registry.getAll();
    all.forEach(item => {
      const card = document.createElement('div');
      card.className = 'glass-card';

      const statusMap = {
        connected: { text: 'Conectado', color: 'var(--accent-emerald)', bg: 'rgba(16,185,129,0.18)' },
        disconnected: { text: 'Desconectado', color: 'var(--text-soft)', bg: 'rgba(255,255,255,0.06)' },
        connecting: { text: 'Conectando...', color: 'var(--primary-light)', bg: 'rgba(99,102,241,0.18)' },
        error: { text: 'Error', color: 'var(--accent-coral)', bg: 'rgba(244,63,94,0.18)' }
      };
      const st = statusMap[item.status] || statusMap.disconnected;

      card.innerHTML = `
        <div class="card-head">
          <div class="card-title">
            <span style="font-size: 1.25rem;">${item.icon}</span>
            <span>${item.name}</span>
          </div>
          <span class="badge-tag" style="background:${st.bg}; color:${st.color};">${st.text}</span>
        </div>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">${item.description}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px; flex-wrap:wrap; gap:6px;">
          <span style="font-size:0.7rem; color:var(--text-soft);">ID: ${item.id}</span>
          <div style="display:flex; gap:6px;">
            <button class="btn btn-glass btn-sm btn-test-conn">Probar</button>
            <button class="btn btn-primary btn-sm btn-config-conn">Configurar</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-test-conn').addEventListener('click', async () => {
        toast.info(`Probando conexión con ${item.name}...`);
        const res = await registry.testConnection(item.id);
        if (res.ok) toast.success(`Conexión con ${item.name} exitosa`);
        else toast.error(`Error en ${item.name}: ${res.error}`);
        this._renderConnectorsView();
      });

      card.querySelector('.btn-config-conn').addEventListener('click', () => {
        modals.openSettings();
      });

      listEl.appendChild(card);
    });
  }

  _setupAuthUI() {
    const authBtn = document.getElementById('btn-google-auth');
    const authText = document.getElementById('auth-btn-text');
    const userNameEl = document.getElementById('user-display-name');
    const userEmailEl = document.getElementById('user-display-email');
    const userAvatarEl = document.getElementById('user-avatar-img');

    const updateProfileUI = () => {
      const user = store.get('user');
      if (user) {
        if (userNameEl) userNameEl.textContent = user.displayName || 'Usuario Google';
        if (userEmailEl) userEmailEl.textContent = user.email || 'Conectado';
        if (userAvatarEl) {
          if (user.photoURL) {
            userAvatarEl.innerHTML = `<img src="${user.photoURL}" alt="Avatar" referrerpolicy="no-referrer">`;
          } else {
            userAvatarEl.textContent = (user.displayName || user.email || 'U')[0].toUpperCase();
          }
        }
        if (authText) authText.textContent = 'Cerrar Sesión';
      } else {
        if (userNameEl) userNameEl.textContent = 'Invitado';
        if (userEmailEl) userEmailEl.textContent = 'Modo Local';
        if (userAvatarEl) userAvatarEl.textContent = '👤';
        if (authText) authText.textContent = 'Iniciar Sesión con Google';
      }
    };

    updateProfileUI();
    events.on('auth:user-signed-in', () => {
      updateProfileUI();
      toast.success('¡Bienvenido! Sesión iniciada con Google');
    });

    events.on('auth:user-signed-out', () => {
      updateProfileUI();
      toast.info('Sesión cerrada');
    });

    if (authBtn) {
      authBtn.addEventListener('click', async () => {
        audio.soundClick();
        const user = store.get('user');
        if (user) {
          await authService.signOut();
        } else {
          try {
            toast.info('Abriendo inicio de sesión con Google...');
            await authService.signInWithGoogle();
          } catch (e) {
            toast.error(e.message || 'Error al iniciar sesión');
          }
        }
      });
    }

    events.on('sync:migration-available', (counts) => {
      modals.openMigrationModal(counts);
    });
  }

  _setupModals() {
    // Cerrar modales con botones de clase .btn-close-modal
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
      btn.addEventListener('click', () => modals.close());
    });

    // Cerrar al hacer clic en el fondo del modal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) modals.close();
      });
    });

    // Cerrar con tecla Escape (FASE 17)
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modals.close();
      }
    });

    // Botones de configuración
    const btnOpenSettings = document.getElementById('btn-open-settings');
    if (btnOpenSettings) {
      btnOpenSettings.addEventListener('click', () => modals.openSettings());
    }

    const formSettings = document.getElementById('form-settings');
    if (formSettings) {
      formSettings.addEventListener('submit', (e) => {
        e.preventDefault();
        modals.saveSettingsFromForm();
        this._renderConnectorsView();
      });
    }

    const btnConfirmMigration = document.getElementById('btn-confirm-migration');
    if (btnConfirmMigration) {
      btnConfirmMigration.addEventListener('click', () => modals.executeMigration());
    }

    const btnExportBackup = document.getElementById('btn-export-full-backup');
    if (btnExportBackup) {
      btnExportBackup.addEventListener('click', () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store.state, null, 2));
        const a = document.createElement('a');
        a.href = dataStr;
        a.download = `cuaderno-glass-backup-${Date.now()}.json`;
        a.click();
        audio.soundSuccess();
        toast.success('Copia de seguridad exportada');
      });
    }
  }

  _setupCopilot() {
    const chatFlow = document.getElementById('gemini-chat-flow');
    const input = document.getElementById('gemini-user-input');
    const sendBtn = document.getElementById('btn-send-gemini');

    const sendMessage = async () => {
      const q = input?.value.trim();
      if (!q) return;

      audio.soundClick();
      const userBubble = document.createElement('div');
      userBubble.className = 'chat-bubble user';
      userBubble.textContent = q;
      chatFlow.appendChild(userBubble);
      if (input) input.value = '';

      const botBubble = document.createElement('div');
      botBubble.className = 'chat-bubble bot';
      botBubble.innerHTML = `<em>Gemini AI está pensando...</em>`;
      chatFlow.appendChild(botBubble);
      chatFlow.scrollTop = chatFlow.scrollHeight;

      try {
        const reply = await geminiProvider.generateResponse(q);
        botBubble.innerHTML = `✨ <strong>Gemini AI:</strong>\n${reply.replace(/\n/g, '<br>')}`;
        audio.soundNotification();
      } catch (err) {
        botBubble.innerHTML = `⚠️ <strong style="color:var(--accent-coral);">Error:</strong> ${err.message}`;
        audio.soundError();
      }
      chatFlow.scrollTop = chatFlow.scrollHeight;
    };

    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (input) {
      input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
      });
    }
  }
}

export const bootstrap = new AppBootstrap();
