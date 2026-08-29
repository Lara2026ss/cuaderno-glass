/**
 * Cuaderno Glass Pro 7.0 — Módulo UI de Groq / Gemini AI Copilot
 */

import { groqProvider } from '../integrations/groq.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/components.js';

export class GeminiFeature {
  constructor() {
    this.chatFlow = null;
    this.userInput = null;
    this.sendBtn = null;
  }

  init() {
    this.chatFlow = document.getElementById('gemini-chat-flow');
    this.userInput = document.getElementById('gemini-user-input');
    this.sendBtn = document.getElementById('btn-send-gemini');

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.handleSendMessage());
    }

    if (this.userInput) {
      this.userInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSendMessage();
        }
      });
    }
  }

  async handleSendMessage() {
    if (!this.userInput) return;
    const prompt = this.userInput.value.trim();
    if (!prompt) {
      toast.warning('Escribe un mensaje para el asistente');
      return;
    }

    this.appendMessage('user', prompt);
    this.userInput.value = '';
    audio.soundClick();

    const typingId = this.appendTyping();

    try {
      const reply = await groqProvider.chat(prompt);
      this.removeMessage(typingId);
      this.appendMessage('bot', reply);
      audio.soundNotification();
    } catch (err) {
      this.removeMessage(typingId);
      this.appendMessage('bot', `?? Error al procesar consulta: ${err.message}`);
      toast.error('Error en comunicación con la IA');
    }
  }

  appendMessage(role, text) {
    if (!this.chatFlow) return;
    const msgId = 'msg-' + Date.now() + Math.random().toString(36).substring(2, 5);
    const bubble = document.createElement('div');
    bubble.id = msgId;
    bubble.className = `chat-bubble ${role}`;
    
    if (role === 'user') {
      bubble.innerHTML = `<strong>Tú:</strong> ${escapeHtml(text)}`;
    } else {
      bubble.innerHTML = `? <strong>Groq AI:</strong><br>${escapeHtml(text).replace(/\n/g, '<br>')}`;
    }

    this.chatFlow.appendChild(bubble);
    this.chatFlow.scrollTop = this.chatFlow.scrollHeight;
    return msgId;
  }

  appendTyping() {
    if (!this.chatFlow) return;
    const msgId = 'typing-' + Date.now();
    const bubble = document.createElement('div');
    bubble.id = msgId;
    bubble.className = 'chat-bubble bot';
    bubble.innerHTML = '? <em>Groq AI está pensando...</em>';
    this.chatFlow.appendChild(bubble);
    this.chatFlow.scrollTop = this.chatFlow.scrollHeight;
    return msgId;
  }

  removeMessage(id) {
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  render() {}
}

export const geminiFeature = new GeminiFeature();
