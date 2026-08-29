/**
 * Cuaderno Glass Pro 7.0 — Módulo UI de Conectores Hub & Diagnóstico
 */

import { registry } from '../integrations/registry.js';
import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';

export class ConnectorsFeature {
  constructor() {
    this.grid = null;
  }

  init() {
    this.grid = document.getElementById('connectors-cards-grid');

    const btnRunAll = document.getElementById('btn-run-all-health');
    if (btnRunAll) {
      btnRunAll.addEventListener('click', () => this.runAllHealthChecks());
    }

    this.render();
  }

  async runAllHealthChecks() {
    toast.info('Ejecutando diagnóstico de conectores...');
    audio.soundClick();

    const items = registry.getAll();
    for (const item of items) {
      if (typeof item.healthCheck === 'function') {
        try {
          await item.healthCheck();
        } catch {}
      }
    }

    audio.soundNotification();
    toast.success('Diagnóstico completado');
    this.render();
  }

  render() {
    if (typeof document === 'undefined') return;
    this.grid = document.getElementById('connectors-cards-grid');
    if (!this.grid) return;

    this.grid.innerHTML = '';

    const list = [
      { id: 'firebase', name: 'Firebase Cloud & Auth', icon: '??', desc: 'Sincronización en tiempo real y Auth' },
      { id: 'drive', name: 'Google Drive Hub', icon: '??', desc: 'Importación y respaldo de archivos Markdown' },
      { id: 'groq', name: 'Groq AI Copilot (Llama 3.3)', icon: '?', desc: 'Asistente IA nativo con Function Calling' },
      { id: 'render', name: 'Render Cloud Deployment', icon: '??', desc: 'Servidor Express backend en producción' },
      { id: 'github', name: 'GitHub Integration', icon: '??', desc: 'Repositorio y control de versiones' },
      { id: 'discord', name: 'Discord Webhooks', icon: '??', desc: 'Alertas automáticas y notificaciones' }
    ];

    list.forEach(c => {
      const status = store.get(`connections.${c.id}.status`, 'connected');
      const isConnected = status === 'connected';

      const card = document.createElement('div');
      card.className = 'glass-card';
      card.style.display = 'flex';
      card.style.flexDirection = 'column';
      card.style.justifyContent = 'space-between';

      card.innerHTML = `
        <div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:1.6rem;">${c.icon}</div>
            <span class="badge-tag" style="background:${isConnected ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)'}; color:${isConnected ? 'var(--accent-emerald)' : 'var(--accent-coral)'}; font-weight:600;">
              ? ${isConnected ? 'Conectado' : 'Modo Degradado'}
            </span>
          </div>
          <h3 style="font-size:1rem; font-weight:700; margin-bottom:4px;">${c.name}</h3>
          <p style="font-size:0.8rem; color:var(--text-soft); margin-bottom:12px;">${c.desc}</p>
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px; font-size:0.75rem; color:var(--text-soft);">
          <span>Estado: <strong>${status}</strong></span>
          <span style="font-family:var(--font-mono);">OK</span>
        </div>
      `;

      this.grid.appendChild(card);
    });
  }
}

export const connectorsFeature = new ConnectorsFeature();
