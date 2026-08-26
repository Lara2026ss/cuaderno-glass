/**
 * Cuaderno Glass Pro 4.0 — Gemini AI Provider & Contextual Copilot
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';

export class GeminiAIProvider {
  constructor() {
    this.id = 'gemini';
    this.providerName = 'Google Gemini 1.5';
  }

  buildCompactContext() {
    const tasks = store.get('tasks', []);
    const pendingTasks = tasks.filter(t => !t.done).map(t => `- [${t.priority}] ${t.text} (${t.category})`).slice(0, 5);
    const docs = store.get('documents', []).map(d => `- "${d.title}" [${d.category}]`).slice(0, 4);
    const notes = store.get('notes', []).map(n => `- ${n.text}`).slice(0, 3);
    const trackers = store.get('priceTrackers', []).map(tr => `- ${tr.productName} (${tr.store}): Actual $${tr.currentPrice}, Meta $${tr.targetPrice}`).slice(0, 3);

    return `
[CONTEXTO DE LA SUITE DEL USUARIO]
- Tareas Pendientes (${pendingTasks.length}):\n${pendingTasks.join('\n') || 'Ninguna'}
- Documentos Recientes (${docs.length}):\n${docs.join('\n') || 'Ninguno'}
- Notas Rápidas (${notes.length}):\n${notes.join('\n') || 'Ninguna'}
- Productos Monitoreados (${trackers.length}):\n${trackers.join('\n') || 'Ninguno'}
`;
  }

  async generateResponse(userPrompt) {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    const context = this.buildCompactContext();
    const fullPrompt = `${context}\n\n[CONSULTA DEL USUARIO]\n${userPrompt.trim()}`;
    const apiKey = store.get('settings.geminiApiKey', '');

    try {
      let data;
      // 1. Intentar llamar al backend proxy seguro
      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt, apiKey })
        });

        if (res.ok) {
          data = await res.json();
          const reply = data.reply || data.text;
          store.set('connections.gemini.lastPrompt', new Date().toISOString());
          registry.setStatus('gemini', 'connected');
          return reply;
        } else {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `Servidor AI respondió con código ${res.status}`);
        }
      } catch (backendErr) {
        // 2. Si backend no está disponible y hay apiKey en frontend, intentar Google Generative Language API directamente
        if (apiKey) {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: fullPrompt }] }]
            })
          });

          if (!res.ok) {
            const errJson = await res.json().catch(() => ({}));
            throw new Error(errJson.error?.message || `Gemini API error ${res.status}`);
          }

          const geminiData = await res.json();
          const candidateText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (candidateText) return candidateText;
          throw new Error('Respuesta de Gemini vacía');
        } else {
          throw backendErr;
        }
      }
    } catch (err) {
      logger.error('GeminiAI', 'Fallo al generar respuesta de IA', { error: err.message });
      registry.setStatus('gemini', 'error', err.message);
      throw err;
    }
  }
}

export const geminiProvider = new GeminiAIProvider();
