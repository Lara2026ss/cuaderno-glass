/**
 * Cuaderno Glass Pro 6.0 — Router y Navegación SPA
 */

import { events } from './events.js';
import { logger } from './logger.js';

export class AppRouter {
  constructor(defaultTab = 'dashboard') {
    this.currentTab = defaultTab;
    this.tabs = ['dashboard', 'deals', 'documents', 'gemini', 'groq', 'connectors', 'pomodoro', 'settings', 'logs'];
  }

  init() {
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
      const isTarget = btn.dataset.tab === tabName || 
                      (tabName === 'gemini' && (btn.dataset.tab === 'groq' || btn.dataset.tab === 'gemini'));
      btn.classList.toggle('active', isTarget);
    });

    // Ocultar todas las vistas y activar exclusivamente la vista seleccionada
    document.querySelectorAll('.tab-view, .view-content').forEach(view => {
      const isTargetView = view.id === `tab-${tabName}` || 
                          (tabName === 'gemini' && (view.id === 'tab-gemini' || view.id === 'tab-groq'));
      view.classList.toggle('active', isTargetView);
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
