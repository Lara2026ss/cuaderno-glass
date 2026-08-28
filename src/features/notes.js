/**
 * Cuaderno Glass Pro 4.0 — Módulo de Notas Rápidas & Scratchpad
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { escapeHtml, formatTime } from '../ui/components.js';
import { firestoreRepo } from '../firebase/firestore.js';

export class NotesFeature {
  constructor() {
    this.listContainer = null;
    this.textarea = null;
  }

  init() {
    this.listContainer = document.getElementById('quick-notes-list');
    this.textarea = document.getElementById('scratchpad-area');

    // Restaurar borrador del bloc de notas si existe
    if (this.textarea) {
      const draft = store.get('scratchpadDraft', '');
      if (draft) this.textarea.value = draft;
      this.textarea.addEventListener('input', (e) => {
        store.set('scratchpadDraft', e.target.value, { emitEvent: false });
      });
    }

    const btnSave = document.getElementById('btn-save-note');
    if (btnSave) {
      btnSave.addEventListener('click', () => this.saveNote());
    }

    const btnClean = document.getElementById('btn-clean-notes');
    if (btnClean) {
      btnClean.addEventListener('click', () => this.structureWithAI());
    }

    // Escuchadores reactivos de sincronización Firestore
    events.on('firestore:notes:synced', () => this.render());
    events.on('state:notes', () => this.render());

    this.render();
  }

  saveNote() {
    const text = this.textarea?.value.trim();
    if (!text) {
      toast.warning('Escribe una nota antes de guardar');
      return;
    }

    const note = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      text,
      timestamp: Date.now()
    };

    const notes = store.get('notes', []);
    notes.unshift(note);
    store.set('notes', notes);
    firestoreRepo.saveItem('notes', note).catch(() => {});

    if (this.textarea) this.textarea.value = '';
    store.set('scratchpadDraft', '', { emitEvent: false });
    audio.soundClick();
    toast.success('Nota rápida guardada');
    this.render();
  }

  structureWithAI() {
    const text = this.textarea?.value.trim();
    if (!text) {
      toast.warning('Escribe texto en el bloc para estructurarlo');
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const structured = `### 📋 Ideas & Puntos Clave\n- ` + lines.join('\n- ') + `\n\n_Acción: Sincronizado en la suite._`;

    if (this.textarea) this.textarea.value = structured;
    audio.soundNotification();
    toast.info('✨ Nota formateada');
  }

  deleteNote(noteId) {
    let notes = store.get('notes', []);
    notes = notes.filter(n => n.id !== noteId);
    store.set('notes', notes);
    firestoreRepo.deleteItem('notes', noteId).catch(() => {});

    audio.soundClick();
    toast.info('Nota eliminada');
    this.render();
  }

  render() {
    if (!this.listContainer) return;
    this.listContainer.innerHTML = '';

    const notes = store.get('notes', []);
    if (notes.length === 0) {
      this.listContainer.innerHTML = `
        <div style="text-align:center; padding:12px; color:var(--text-soft); font-size:0.78rem;">
          Sin notas guardadas recientemente.
        </div>
      `;
      return;
    }

    notes.slice(0, 4).forEach(n => {
      const item = document.createElement('div');
      item.style.padding = '8px 12px';
      item.style.background = 'rgba(255, 255, 255, 0.02)';
      item.style.border = '1px solid var(--glass-border)';
      item.style.borderRadius = 'var(--radius-sm)';
      item.style.marginBottom = '6px';
      item.style.fontSize = '0.82rem';
      item.style.display = 'flex';
      item.style.justifyContent = 'space-between';
      item.style.alignItems = 'center';
      item.style.gap = '8px';

      item.innerHTML = `
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(n.text)}</span>
        <span style="font-size:0.7rem; color:var(--text-soft); font-family:var(--font-mono);">${formatTime(n.timestamp)}</span>
        <button class="btn btn-danger btn-sm btn-del-note" style="padding:2px 6px; font-size:0.65rem;">✕</button>
      `;

      item.querySelector('.btn-del-note').addEventListener('click', () => this.deleteNote(n.id));
      this.listContainer.appendChild(item);
    });
  }
}

export const notesFeature = new NotesFeature();
