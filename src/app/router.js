/**
 * Cuaderno Glass Pro 4.0 — Router y Navegación
 */

import { events } from './events.js';
import { logger } from './logger.js';

export class AppRouter {
  constructor(defaultTab = 'dashboard') {
    this.currentTab = defaultTab;
    this.tabs = ['dashboard', 'deals', 'documents', 'gemini', 'connectors', 'pomodoro', 'settings', 'logs'];
  }

  init() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      if (this.tabs.includes(hash)) {
        this.navigate(hash, false);
      }
    });

    const initial = window.location.hash.replace('#', '');
    if (this.tabs.includes(initial)) {
      this.navigate(initial, false);
    } else {
      this.navigate(this.currentTab, false);
    }
  }

  navigate(tabName, updateHash = true) {
    if (!this.tabs.includes(tabName)) {
      tabName = 'dashboard';
    }

    this.currentTab = tabName;
    if (updateHash) {
      window.location.hash = tabName;
    }

    // Actualizar UI
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.view-content').forEach(view => {
      view.classList.toggle('active', view.id === `tab-${tabName}`);
    });

    // Cerrar sidebar en móviles
    const sidebar = document.getElementById('sidebar-nav');
    const overlay = document.getElementById('mobile-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
    events.emit('router:navigate', tabName);
    logger.debug('AppRouter', `Navegación a pestaña: ${tabName}`);
  }
}

export const router = new AppRouter();
