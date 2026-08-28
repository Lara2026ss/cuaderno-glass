/**
 * Cuaderno Glass Pro 4.0 — Módulo de Documentos & Google Drive Hub
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
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
    this.currentEditingId = null;
  }

  init() {
    this.container = document.getElementById('documents-container');
    this.editorBox = document.getElementById('doc-editor-box');

    const btnNewToggle = document.getElementById('btn-new-doc-toggle');
    if (btnNewToggle) {
      btnNewToggle.addEventListener('click', () => {
        this.currentEditingId = null;
        const titleInput = document.getElementById('doc-title-input');
        const tagsInput = document.getElementById('doc-tags-input');
        const bodyInput = document.getElementById('doc-body-input');
        if (titleInput) titleInput.value = '';
        if (tagsInput) tagsInput.value = '';
        if (bodyInput) bodyInput.value = '';
        this.toggleEditor(true);
      });
    }

    const btnImportDrive = document.getElementById('btn-import-drive');
    if (btnImportDrive) {
      btnImportDrive.addEventListener('click', async () => {
        try {
          toast.info('Abriendo explorador de Google Drive...');
          await googleDriveAdapter.openPicker(async (pickedFile) => {
            toast.info(`Importando "${pickedFile.name}"...`);
            const content = await googleDriveAdapter.downloadFile(pickedFile.id, pickedFile.mimeType);
            const doc = {
              id: Date.now() + Math.random().toString(36).substring(2, 6),
              title: pickedFile.name.replace(/\.[^/.]+$/, ''),
              category: 'Estudio',
              tags: ['drive', 'importado'],
              body: content || '',
              driveFileId: pickedFile.id,
              driveWebViewLink: pickedFile.url,
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            const docs = store.get('documents', []);
            docs.unshift(doc);
            store.set('documents', docs);
            firestoreRepo.saveItem('documents', doc).catch(() => {});
            audio.soundSuccess();
            toast.success(`"${doc.title}" importado con éxito desde Drive`);
            this.render();
          });
        } catch (e) {
          toast.error('Error con Google Drive: ' + e.message);
        }
      });
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

    const btnExportPdf = document.getElementById('btn-export-pdf');
    if (btnExportPdf) {
      btnExportPdf.addEventListener('click', () => this.exportCurrentAsPDF());
    }

    document.querySelectorAll('#doc-category-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#doc-category-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.cat;
        this.render();
      });
    });

    // Escuchadores reactivos de sincronización y estado
    events.on('firestore:documents:synced', () => this.render());
    events.on('state:documents', () => this.render());
    events.on('documents:updated', () => this.render());

    this.render();
  }

  toggleEditor(show = true) {
    if (this.editorBox) {
      this.editorBox.style.display = show ? 'block' : 'none';
      if (show) {
        document.getElementById('doc-title-input')?.focus();
        this.editorBox.scrollIntoView({ behavior: 'smooth' });
      } else {
        this.currentEditingId = null;
        const titleInput = document.getElementById('doc-title-input');
        const tagsInput = document.getElementById('doc-tags-input');
        const bodyInput = document.getElementById('doc-body-input');
        if (titleInput) titleInput.value = '';
        if (tagsInput) tagsInput.value = '';
        if (bodyInput) bodyInput.value = '';
      }
      audio.soundClick();
    }
  }

  editDoc(docId) {
    const docs = store.get('documents', []);
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;

    this.currentEditingId = docId;
    const titleInput = document.getElementById('doc-title-input');
    const catSelect = document.getElementById('doc-category-input');
    const tagsInput = document.getElementById('doc-tags-input');
    const bodyInput = document.getElementById('doc-body-input');

    if (titleInput) titleInput.value = doc.title;
    if (catSelect) catSelect.value = doc.category || 'Trabajo';
    if (tagsInput) tagsInput.value = (doc.tags || []).join(', ');
    if (bodyInput) bodyInput.value = doc.body || '';

    this.toggleEditor(true);
    this._attachAutoSaveListeners();
  }

  _attachAutoSaveListeners() {
    const bodyInput = document.getElementById('doc-body-input');
    const titleInput = document.getElementById('doc-title-input');

    const onInput = () => {
      if (!this.currentEditingId) return;
      if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);

      const statusEl = document.getElementById('doc-sync-status');
      if (statusEl) statusEl.textContent = '⟳ Guardando...';

      this.autoSaveTimer = setTimeout(async () => {
        await this._performAutoSave();
      }, 1500);
    };

    if (bodyInput && !bodyInput._hasAutoSave) {
      bodyInput.addEventListener('input', onInput);
      bodyInput._hasAutoSave = true;
    }
    if (titleInput && !titleInput._hasAutoSave) {
      titleInput.addEventListener('input', onInput);
      titleInput._hasAutoSave = true;
    }
  }

  async _performAutoSave() {
    if (!this.currentEditingId) return;
    const docs = store.get('documents', []);
    const idx = docs.findIndex(d => d.id === this.currentEditingId);
    if (idx === -1) return;

    const title = document.getElementById('doc-title-input')?.value.trim() || docs[idx].title;
    const body = document.getElementById('doc-body-input')?.value || '';
    const now = Date.now();

    docs[idx].title = title;
    docs[idx].body = body;
    docs[idx].updatedAt = now;
    docs[idx].localModifiedTime = now;
    docs[idx].syncStatus = 'SYNCING';

    store.set('documents', docs);
    firestoreRepo.saveItem('documents', docs[idx]).catch(() => {});

    const statusEl = document.getElementById('doc-sync-status');

    if (docs[idx].driveFileId && store.get('connections.googleDrive.status') === 'connected') {
      try {
        // Comprobar conflicto antes de sobreescribir
        const driveMeta = await googleDriveAdapter.getFileMetadata(docs[idx].driveFileId).catch(() => null);
        if (driveMeta && driveMeta.modifiedTime) {
          const driveTime = new Date(driveMeta.modifiedTime).getTime();
          if (docs[idx].lastSyncedAt && driveTime > docs[idx].lastSyncedAt + 2000) {
            docs[idx].syncStatus = 'CONFLICT';
            if (statusEl) statusEl.textContent = '⚠️ Conflicto con Drive';
            toast.warning(`Conflicto: "${docs[idx].title}" fue modificado en Google Drive.`);
            store.set('documents', docs);
            return;
          }
        }

        const mdContent = `# ${docs[idx].title}\n\n${docs[idx].body}`;
        await googleDriveAdapter.updateFile(docs[idx].driveFileId, mdContent);
        docs[idx].syncStatus = 'SYNCED';
        docs[idx].lastSyncedAt = Date.now();
        if (statusEl) statusEl.textContent = '☁️ Sincronizado con Drive';
      } catch (err) {
        docs[idx].syncStatus = 'ERROR';
        docs[idx].syncError = err.message;
        if (statusEl) statusEl.textContent = '❌ Error de sincronización';
      }
    } else {
      docs[idx].syncStatus = 'LOCAL_ONLY';
      if (statusEl) statusEl.textContent = '💾 Guardado localmente';
    }

    store.set('documents', docs);
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

    const now = Date.now();
    const docs = store.get('documents', []);

    if (this.currentEditingId) {
      const idx = docs.findIndex(d => d.id === this.currentEditingId);
      if (idx !== -1) {
        docs[idx].title = title;
        docs[idx].category = category;
        docs[idx].tags = tags.length ? tags : ['general'];
        docs[idx].body = body;
        docs[idx].updatedAt = now;
        docs[idx].localModifiedTime = now;
        store.set('documents', docs);
        firestoreRepo.saveItem('documents', docs[idx]).catch(() => {});
        this.currentEditingId = null;
        this.toggleEditor(false);
        audio.soundSuccess();
        toast.success('Documento actualizado');
        this.render();
        return;
      }
    }

    const doc = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      title,
      category,
      tags: tags.length ? tags : ['general'],
      body,
      syncStatus: 'LOCAL_ONLY',
      createdAt: now,
      updatedAt: now,
      localModifiedTime: now
    };

    docs.unshift(doc);
    store.set('documents', docs);
    firestoreRepo.saveItem('documents', doc).catch(() => {});

    if (titleInput) titleInput.value = '';
    if (tagsInput) tagsInput.value = '';
    if (bodyInput) bodyInput.value = '';
    this.currentEditingId = null;
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

  exportCurrentAsPDF() {
    const title = document.getElementById('doc-title-input')?.value.trim() || 'Documento';
    const body = document.getElementById('doc-body-input')?.value.trim() || '';

    if (!body) {
      toast.warning('No hay contenido para exportar a PDF');
      return;
    }

    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) {
      toast.error('La ventana emergente fue bloqueada por el navegador');
      return;
    }

    const safeTitle = escapeHtml(title);
    const safeBody = escapeHtml(body).replace(/\n/g, '<br>');

    printWin.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="utf-8">
        <title>${safeTitle} — Cuaderno Glass Pro 6.0</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');
          body {
            font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
            background: #ffffff;
            color: #0f172a;
            padding: 40px;
            line-height: 1.7;
          }
          .doc-header {
            border-bottom: 2px solid #6366f1;
            padding-bottom: 18px;
            margin-bottom: 24px;
          }
          h1 {
            color: #1e1b4b;
            font-size: 28px;
            margin: 0 0 8px 0;
          }
          .meta {
            color: #64748b;
            font-size: 13px;
          }
          .content {
            font-size: 15px;
            white-space: pre-wrap;
            color: #334155;
          }
          .footer {
            margin-top: 40px;
            padding-top: 14px;
            border-top: 1px solid #e2e8f0;
            font-size: 11px;
            color: #94a3b8;
            display: flex;
            justify-content: space-between;
          }
          @media print {
            body { padding: 0; }
            @page { margin: 2cm; }
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <h1>${safeTitle}</h1>
          <div class="meta">Exportado desde Cuaderno Glass Pro 6.0 • ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}</div>
        </div>
        <div class="content">${safeBody}</div>
        <div class="footer">
          <span>Cuaderno Glass Pro — Suite de Productividad Personal</span>
          <span>Página 1 de 1</span>
        </div>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 750);
          };
        </script>
      </body>
      </html>
    `);
    printWin.document.close();
    toast.success('Generando documento imprimible / PDF...');
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
          <div style="display:flex; gap:6px; align-items:center;">
            <span class="badge-tag" style="background:rgba(99,102,241,0.18); color:var(--primary-light);">🏷️ ${escapeHtml(d.category)}</span>
            ${d.driveFileId ? `<span class="badge-tag" style="background:rgba(16,185,129,0.15); color:var(--accent-emerald);">☁️ Drive Synced</span>` : ''}
            ${d.syncStatus === 'CONFLICT' ? `<span class="badge-tag" style="background:rgba(239,68,68,0.18); color:var(--accent-coral);">⚠️ Conflicto</span>` : ''}
          </div>
          <span style="font-size:0.75rem; color:var(--text-soft); font-family:var(--font-mono);">${formatDate(d.createdAt || d.updatedAt)}</span>
        </div>
        <h3 style="font-family:var(--font-display); font-size:1.32rem; margin-bottom:8px; font-weight:700;">${escapeHtml(d.title)}</h3>
        <p style="color:var(--text-muted); font-size:0.92rem; line-height:1.6; white-space:pre-line; margin-bottom:14px;">${escapeHtml(d.body)}</p>
        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:12px; flex-wrap:wrap; gap:10px;">
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${(d.tags || []).map(t => `<span class="chip" style="padding:2px 8px; font-size:0.7rem;">#${escapeHtml(t)}</span>`).join('')}
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn btn-glass btn-sm btn-edit-doc" title="Editar documento">✏️ Editar</button>
            <button class="btn btn-glass btn-sm btn-copy-doc" title="Copiar texto">📋 Copiar</button>
            <button class="btn btn-glass btn-sm btn-drive-doc" title="Subir a Google Drive">☁️ Drive</button>
            <button class="btn btn-danger btn-sm btn-del-doc" title="Eliminar">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-doc').addEventListener('click', () => this.editDoc(d.id));
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
