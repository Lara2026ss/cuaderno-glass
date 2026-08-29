/**
 * Cuaderno Glass Pro 6.0 — Router y Navegación SPA
 */

import { events } from './events.js';
import { logger } from './logger.js';

export class AppRouter {
  constructor(defaultTab = 'dashboard') {
    this.currentTab = defaultTab;
    this.tabs = ['dashboard', 'tasks', 'notes', 'deals', 'documents', 'gemini', 'groq', 'connectors', 'pomodoro', 'settings', 'logs'];
  }

  init() {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const targetBtn = e.target.closest('.nav-btn') || btn;
          const tab = targetBtn.dataset.tab;
          if (tab) {
            this.navigate(tab);
          }
        });
      });
    }

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (this.tabs.includes(hash) || hash === 'ai') {
        this.navigate(hash, false);
      }
    });

    const initial = window.location.hash.replace('#', '');
    if (this.tabs.includes(initial) || initial === 'ai') {
      this.navigate(initial, false);
    } else {
      this.navigate(this.currentTab, false);
    }
  }

  navigate(tabName, updateHash = true) {
    // Normalizar alias
    if (tabName === 'ai' || tabName === 'groq') {
      tabName = 'gemini';
    }

    if (!this.tabs.includes(tabName)) {
      tabName = 'dashboard';
    }

    this.currentTab = tabName;
    if (updateHash) {
      window.location.hash = tabName;
    }

    // Actualizar botones de navegación activos
    document.querySelectorAll('.nav-btn').forEach(btn => {
      const target = btn.dataset.tab;
      const isMatch = target === tabName || (target === 'gemini' && (tabName === 'ai' || tabName === 'groq'));
      btn.classList.toggle('active', Boolean(isMatch));
    });

    // Actualizar paneles visibles
    document.querySelectorAll('.tab-view').forEach(view => {
      const id = view.id.replace('tab-', '');
      const isMatch = id === tabName || (id === 'gemini' && (tabName === 'ai' || tabName === 'groq'));
      view.classList.toggle('active', Boolean(isMatch));
    });

    // Cerrar sidebar en móvil si está abierto
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');

    events.emit('router:navigated', tabName);
    logger.debug('Router', `Navegado a la sección: ${tabName}`);
  }
}

export const router = new AppRouter();
