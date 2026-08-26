/**
 * Cuaderno Glass Pro 4.0 — Inicializador Maestro, Diagnóstico Visual & Error Boundary 4.5
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

    // Inicializar Sincronizador & Auth de forma segura
    try {
      synchronizer.init();
      await authService.init();
    } catch (authInitErr) {
      logger.warn('Bootstrap', 'Firebase Auth no inicializado en bootstrap, arrancando en Modo Local seguro', { error: authInitErr.message });
    }

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
    // Registrar todas las integraciones en el registry
    registry.register({
      id: 'firebase',
      name: 'Firebase Firestore & Auth',
      icon: '🔥',
      description: 'Base de datos en la nube y autenticación de usuarios',
      capabilities: ['auth', 'database'],
      healthCheck: async () => {
        const isAuth = store.get('session.isAuthenticated', false);
        const hasSdk = store.get('connections.firebase.sdkInitialized', false);
        return { ok: isAuth || hasSdk, status: isAuth ? 'connected' : (hasSdk ? 'connecting' : 'disconnected') };
      }
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

      let statusBadge = '<span class="badge-tag" style="background:rgba(255,255,255,0.06); color:var(--text-soft);">Desconectado</span>';
      if (item.id === 'firebase') {
        const isAuth = store.get('session.isAuthenticated');
        const lastErr = store.get('connections.firebase.lastAuthError');
        if (isAuth) {
          statusBadge = '<span class="badge-tag" style="background:rgba(16,185,129,0.22); color:var(--accent-emerald);">● Autenticado</span>';
        } else if (lastErr) {
          statusBadge = '<span class="badge-tag" style="background:rgba(244,63,94,0.22); color:var(--accent-coral);">✕ Requiere Configuración</span>';
        } else {
          statusBadge = '<span class="badge-tag" style="background:rgba(99,102,241,0.22); color:var(--primary-light);">● Modo Local / Demo</span>';
        }
      } else {
        const statusMap = {
          connected: { text: 'Conectado', color: 'var(--accent-emerald)', bg: 'rgba(16,185,129,0.18)' },
          disconnected: { text: 'Desconectado', color: 'var(--text-soft)', bg: 'rgba(255,255,255,0.06)' },
          connecting: { text: 'Conectando...', color: 'var(--primary-light)', bg: 'rgba(99,102,241,0.18)' },
          error: { text: 'Error', color: 'var(--accent-coral)', bg: 'rgba(244,63,94,0.18)' }
        };
        const st = statusMap[item.status] || statusMap.disconnected;
        statusBadge = `<span class="badge-tag" style="background:${st.bg}; color:${st.color};">${st.text}</span>`;
      }

      let extraDiagnosticHtml = '';
      if (item.id === 'firebase') {
        const projectId = store.get('settings.firebaseConfig.projectId', 'alero-company-works');
        const lastErr = store.get('connections.firebase.lastAuthError');
        extraDiagnosticHtml = `
          <div style="background:rgba(0,0,0,0.25); border-radius:var(--radius-sm); padding:8px 10px; margin:8px 0; font-family:var(--font-mono); font-size:0.72rem; color:var(--text-muted); display:flex; flex-direction:column; gap:3px;">
            <div><strong>Project ID:</strong> ${projectId}</div>
            <div><strong>Auth Domain:</strong> ${projectId}.firebaseapp.com</div>
            <div><strong>App ID:</strong> 1:16044531269:web:431da21bd13952050d8d2c</div>
            <div><strong>API Key:</strong> AIzaSyBt9••••••••••••••••</div>
            ${lastErr ? `<div style="color:var(--accent-coral); margin-top:2px;"><strong>Último error:</strong> [${lastErr.code}] ${lastErr.message}</div>` : ''}
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-head">
          <div class="card-title">
            <span style="font-size: 1.25rem;">${item.icon}</span>
            <span>${item.name}</span>
          </div>
          ${statusBadge}
        </div>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:8px;">${item.description}</p>
        ${extraDiagnosticHtml}
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px; flex-wrap:wrap; gap:6px;">
          <span style="font-size:0.7rem; color:var(--text-soft);">ID: ${item.id}</span>
          <div style="display:flex; gap:6px;">
            ${item.id === 'firebase' ? `<a href="https://console.firebase.google.com/project/alero-company-works/authentication" target="_blank" rel="noopener noreferrer" class="btn btn-glass btn-sm">Consola ↗</a>` : ''}
            <button class="btn btn-glass btn-sm btn-test-conn">Probar</button>
            <button class="btn btn-primary btn-sm btn-config-conn">Configurar</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-test-conn').addEventListener('click', async () => {
        toast.info(`Probando conexión con ${item.name}...`);
        const res = await registry.testConnection(item.id);
        if (res.ok) toast.success(`Conexión con ${item.name} exitosa`);
        else toast.error(`Error en ${item.name}: ${res.error || 'Verifica la configuración'}`);
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
      const isChecking = store.get('session.isChecking', false);
      const user = store.get('user');

      if (isChecking) {
        if (userNameEl) userNameEl.textContent = 'Comprobando sesión...';
        if (userEmailEl) userEmailEl.textContent = 'Firebase';
        if (authText) authText.textContent = 'Verificando...';
        return;
      }

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
        if (userNameEl) userNameEl.textContent = 'Modo Local / Demo';
        if (userEmailEl) userEmailEl.textContent = 'Sin conexión cloud';
        if (userAvatarEl) userAvatarEl.textContent = '👤';
        if (authText) authText.textContent = 'Iniciar Sesión con Google';
      }
    };

    updateProfileUI();
    events.on('auth:user-signed-in', () => {
      updateProfileUI();
      this._renderConnectorsView();
      toast.success('¡Bienvenido! Sesión iniciada con Google');
    });

    events.on('auth:user-signed-out', () => {
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
          // UX de Login: Estados visuales reactivos (FASE 19)
          try {
            authBtn.disabled = true;
            if (authText) authText.textContent = 'Abriendo Google...';
            toast.info('Abriendo inicio de sesión con Google...');

            await authService.signInWithGoogle();
          } catch (mappedError) {
            logger.warn('AuthUI', 'Error capturado en login UI', mappedError);
            toast.error(mappedError.friendlyMessage || mappedError.message || 'Error al iniciar sesión');
            
            if (mappedError.isConfigError && mappedError.actionUrl) {
              setTimeout(() => {
                toast.warning(`👉 Configura Google en Firebase Console: ${mappedError.actionText}`);
              }, 1200);
            }
          } finally {
            // Asegurar que el botón siempre vuelva a estar disponible
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

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) modals.close();
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        modals.close();
      }
    });

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
