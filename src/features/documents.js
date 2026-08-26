/**
 * Cuaderno Glass Pro 4.0 — Módulo de Documentos & Google Drive Hub
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { escapeHtml, formatDate } from '../ui/components.js';
import { firestoreRepo } from '../firebase/firestore.js';
import { googleDriveAdapter } from '../integrations/google-drive.js';

export class DocumentsFeature {
  constructor() {
    this.container = null;
    this.editorBox = null;
    this.activeCategory = 'all';
  }

  init() {
    this.container = document.getElementById('documents-container');
    this.editorBox = document.getElementById('doc-editor-box');

    const btnNewToggle = document.getElementById('btn-new-doc-toggle');
    if (btnNewToggle) {
      btnNewToggle.addEventListener('click', () => this.toggleEditor(true));
    }

    const btnCloseEditor = document.getElementById('btn-close-doc-editor');
    if (btnCloseEditor) {
      btnCloseEditor.addEventListener('click', () => this.toggleEditor(false));
    }

    const btnSaveDoc = document.getElementById('btn-save-document');
    if (btnSaveDoc) {
      btnSaveDoc.addEventListener('click', () => this.saveDocument());
    }

    const btnExportMd = document.getElementById('btn-export-single-doc');
    if (btnExportMd) {
      btnExportMd.addEventListener('click', () => this.exportCurrentAsMarkdown());
    }

    document.querySelectorAll('#doc-category-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#doc-category-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.cat;
        this.render();
      });
    });

    this.render();
  }

  toggleEditor(show = true) {
    if (this.editorBox) {
      this.editorBox.style.display = show ? 'block' : 'none';
      if (show) {
        document.getElementById('doc-title-input')?.focus();
        this.editorBox.scrollIntoView({ behavior: 'smooth' });
      }
      audio.soundClick();
    }
  }

  saveDocument() {
    const titleInput = document.getElementById('doc-title-input');
    const catSelect = document.getElementById('doc-category-input');
    const tagsInput = document.getElementById('doc-tags-input');
    const bodyInput = document.getElementById('doc-body-input');

    const title = titleInput?.value.trim();
    const body = bodyInput?.value.trim();
    const category = catSelect?.value || 'Trabajo';
    const tags = (tagsInput?.value || '')
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    if (!title || !body) {
      toast.warning('Ingresa un título y contenido para el documento');
      return;
    }

    const doc = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      title,
      category,
      tags: tags.length ? tags : ['general'],
      body,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const docs = store.get('documents', []);
    docs.unshift(doc);
    store.set('documents', docs);
    firestoreRepo.saveItem('documents', doc).catch(() => {});

    if (titleInput) titleInput.value = '';
    if (tagsInput) tagsInput.value = '';
    if (bodyInput) bodyInput.value = '';
    this.toggleEditor(false);

    audio.soundSuccess();
    toast.success('Documento guardado con éxito');
    this.render();
  }

  exportCurrentAsMarkdown() {
    const title = document.getElementById('doc-title-input')?.value.trim() || 'documento';
    const body = document.getElementById('doc-body-input')?.value.trim() || '';

    if (!body) {
      toast.warning('No hay contenido para exportar');
      return;
    }

    const blob = new Blob([`# ${title}\n\n${body}`], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title.toLowerCase().replace(/\s+/g, '-')}.md`;
    a.click();
    toast.info('Archivo .md descargado');
  }

  async uploadToGoogleDrive(doc) {
    try {
      toast.info('Subiendo documento a Google Drive...');
      const content = `# ${doc.title}\n\nCategoría: ${doc.category}\nTags: ${doc.tags.join(', ')}\n\n${doc.body}`;
      await googleDriveAdapter.uploadFile(`${doc.title}.md`, content, 'text/markdown');
      audio.soundSuccess();
      toast.success(`"${doc.title}" subido a Google Drive`);
    } catch (e) {
      toast.error('Error al subir a Drive: ' + e.message);
    }
  }

  deleteDoc(docId) {
    let docs = store.get('documents', []);
    docs = docs.filter(d => d.id !== docId);
    store.set('documents', docs);
    firestoreRepo.deleteItem('documents', docId).catch(() => {});

    audio.soundClick();
    toast.info('Documento eliminado');
    this.render();
  }

  render(searchQuery = '') {
    if (!this.container) return;
    this.container.innerHTML = '';

    let list = store.get('documents', []);
    if (this.activeCategory !== 'all') {
      list = list.filter(d => d.category === this.activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.body.toLowerCase().includes(q));
    }

    if (list.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding:45px 15px; color:var(--text-soft);">
          📖 No hay documentos en esta sección.
        </div>
      `;
      this.updateMetrics();
      return;
    }

    list.forEach(d => {
      const card = document.createElement('div');
      card.className = 'glass-card';

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <span class="badge-tag" style="background:rgba(99,102,241,0.18); color:var(--primary-light);">🏷️ ${escapeHtml(d.category)}</span>
          <span style="font-size:0.75rem; color:var(--text-soft); font-family:var(--font-mono);">${formatDate(d.createdAt || d.updatedAt)}</span>
        </div>
        <h3 style="font-family:var(--font-display); font-size:1.32rem; margin-bottom:8px; font-weight:700;">${escapeHtml(d.title)}</h3>
        <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.6; white-space:pre-line; margin-bottom:14px;">${escapeHtml(d.body)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:12px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${(d.tags || []).map(t => `<span class="chip" style="padding:2px 8px; font-size:0.7rem;">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-glass btn-sm btn-copy-doc" title="Copiar texto">📋 Copiar</button>
            <button class="btn btn-glass btn-sm btn-drive-doc" title="Subir a Google Drive">☁️ Drive</button>
            <button class="btn btn-danger btn-sm btn-del-doc" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-copy-doc').addEventListener('click', () => {
        navigator.clipboard.writeText(`${d.title}\n\n${d.body}`);
        audio.soundClick();
        toast.success('Copiado al portapapeles');
      });

      card.querySelector('.btn-drive-doc').addEventListener('click', () => this.uploadToGoogleDrive(d));
      card.querySelector('.btn-del-doc').addEventListener('click', () => this.deleteDoc(d.id));

      this.container.appendChild(card);
    });

    this.updateMetrics();
  }

  updateMetrics() {
    const docs = store.get('documents', []);
    const statDocs = document.getElementById('stat-docs-count');
    const badgeDocs = document.getElementById('badge-docs');

    if (statDocs) statDocs.textContent = docs.length;
    if (badgeDocs) badgeDocs.textContent = docs.length;
  }
}

export const documentsFeature = new DocumentsFeature();
