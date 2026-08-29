/**
 * Cuaderno Glass Pro 7.0 — Módulo UI de Groq AI Copilot
 * FIX: groqProvider.chat() no existe -> usar groqProvider.generateResponse()
 */

import { groqProvider } from '../integrations/groq.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { store } from '../app/state.js';
import { escapeHtml } from '../ui/components.js';

const QUICK_SUGGESTIONS = [
  '¿Qué tareas tengo pendientes?',
  'Dame un resumen de mi día',
  'Crea una tarea: Revisar correos',
  '¿Cuántos documentos tengo?'
];

export class GeminiFeature {
  constructor() {
    this.chatFlow = null;
    this.userInput = null;
    this.sendBtn = null;
    this.isProcessing = false;
  }

  init() {
    this.chatFlow = document.getElementById('gemini-chat-flow');
    this.userInput = document.getElementById('gemini-user-input');
    this.sendBtn = document.getElementById('btn-send-gemini');

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    if (this.userInput) {
      this.userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }

    const suggestionsEl = document.getElementById('groq-suggestions');
    if (suggestionsEl) {
      suggestionsEl.innerHTML = '';
      QUICK_SUGGESTIONS.forEach(s => {
        const btn = document.createElement('button');
        btn.className = 'groq-suggestion-chip';
        btn.textContent = s;
        btn.addEventListener('click', () => {
          if (this.userInput) {
            this.userInput.value = s;
            this.userInput.focus();
          }
        });
        suggestionsEl.appendChild(btn);
      });
    }
  }

  async handleSendMessage() {
    if (this.isProcessing) return;
    if (!this.userInput) return;

    const prompt = this.userInput.value.trim();
    if (!prompt) {
      toast.warning('Escribe un mensaje para el asistente');
      return;
    }

    this.isProcessing = true;
    this._setInputState(true);

    this.appendMessage('user', prompt);
    this.userInput.value = '';
    audio.soundClick();

    const suggestions = document.getElementById('groq-suggestions');
    if (suggestions) suggestions.style.display = 'none';

    const typingId = this.appendTyping();

    try {
      const reply = await groqProvider.generateResponse(prompt, (state) => {
        this._updateTypingState(typingId, state);
      });
      this.removeMessage(typingId);
      this.appendMessage('bot', reply);
      audio.soundNotification();
    } catch (err) {
      this.removeMessage(typingId);
      this.appendMessage('bot-error', `No pude procesar tu consulta: ${err.message}`);
      toast.error('Error en comunicación con Groq AI');
    } finally {
      this.isProcessing = false;
      this._setInputState(false);
    }
  }

  _setInputState(disabled) {
    if (this.userInput) {
      this.userInput.disabled = disabled;
      this.userInput.placeholder = disabled
        ? 'Groq AI está procesando...'
        : 'Pregunta a Groq AI o pídele generar contenido...';
    }
    if (this.sendBtn) {
      this.sendBtn.disabled = disabled;
      this.sendBtn.innerHTML = disabled
        ? '<span class="groq-btn-spinner"></span>'
        : 'Enviar ⚡';
    }
  }

  _updateTypingState(id, state) {
    const textEl = document.querySelector(`#${id} .groq-typing-text`);
    if (!textEl) return;
    const stateMap = {
      thinking: '🧠 <em>Groq AI está pensando...</em>',
      calling_tool: '⚡ <em>Ejecutando herramienta...</em>',
      success: '✅ <em>Respuesta lista</em>',
      error: '❌ <em>Error en la conexión</em>'
    };
    textEl.innerHTML = stateMap[state] || '⚡ <em>Procesando...</em>';
  }

  appendMessage(role, text) {
    if (!this.chatFlow) return;
    const msgId = 'msg-' + Date.now() + Math.random().toString(36).substring(2, 5);
    const bubble = document.createElement('div');
    bubble.id = msgId;

    if (role === 'user') {
      bubble.className = 'groq-bubble groq-bubble-user';
      bubble.innerHTML = `
        <div class="groq-bubble-meta">Tú</div>
        <div class="groq-bubble-text">${escapeHtml(text)}</div>
      `;
    } else if (role === 'bot-error') {
      bubble.className = 'groq-bubble groq-bubble-error';
      bubble.innerHTML = `
        <div class="groq-bubble-meta groq-meta-bot">
          <span class="groq-avatar">⚡</span> Groq AI
        </div>
        <div class="groq-bubble-text">❌ ${escapeHtml(text)}</div>
      `;
    } else {
      const formatted = this._formatMarkdown(text);
      bubble.className = 'groq-bubble groq-bubble-bot';
      bubble.innerHTML = `
        <div class="groq-bubble-meta groq-meta-bot">
          <span class="groq-avatar">⚡</span> Groq AI Copilot
        </div>
        <div class="groq-bubble-text">${formatted}</div>
      `;
    }

    this.chatFlow.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return msgId;
  }

  _formatMarkdown(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:rgba(99,102,241,0.2);padding:1px 5px;border-radius:4px;font-family:var(--font-mono);font-size:0.85em;">$1</code>')
      .replace(/\n- /g, '\n• ')
      .replace(/\n/g, '<br>');
  }

  appendTyping() {
    if (!this.chatFlow) return;
    const msgId = 'typing-' + Date.now();
    const bubble = document.createElement('div');
    bubble.id = msgId;
    bubble.className = 'groq-bubble groq-bubble-bot groq-bubble-typing';
    bubble.innerHTML = `
      <div class="groq-bubble-meta groq-meta-bot">
        <span class="groq-avatar">⚡</span> Groq AI Copilot
      </div>
      <div class="groq-bubble-text">
        <span class="groq-typing-text">🧠 <em>Groq AI está pensando...</em></span>
        <span class="groq-dots"><span></span><span></span><span></span></span>
      </div>
    `;
    this.chatFlow.appendChild(bubble);
    bubble.scrollIntoView({ behavior: 'smooth', block: 'end' });
    return msgId;
  }

  removeMessage(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  render() {}
}
