/**
 * Tests: HTML & Security Structure Audit
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runHtmlAudit() {
  console.log('🧪 Ejecutando auditoría de HTML y Estructura Semántica...');

  const htmlPath = path.join(__dirname, '..', 'index.html');
  const content = fs.readFileSync(htmlPath, 'utf-8');

  // 1. Verificar presencia de elementos clave de la arquitectura
  const requiredIds = [
    'sidebar-nav',
    'nav-btns',
    'btn-google-auth',
    'user-display-name',
    'user-display-email',
    'user-avatar-img',
    'global-search',
    'btn-theme-toggle',
    'btn-quick-new',
    'tab-dashboard',
    'tab-deals',
    'tab-documents',
    'tab-gemini',
    'tab-connectors',
    'tab-pomodoro',
    'stat-pending-tasks',
    'stat-completed-tasks',
    'stat-docs-count',
    'stat-active-alerts',
    'tasks-container',
    'form-add-task',
    'scratchpad-area',
    'quick-notes-list',
    'deals-preview',
    'deals-full-list',
    'form-add-tracker',
    'documents-container',
    'doc-editor-box',
    'gemini-chat-flow',
    'gemini-user-input',
    'connectors-cards-grid',
    'full-timer-val',
    'modal-settings',
    'modal-migration',
    'modal-price-history',
    'setting-google-clientid',
    'btn-import-drive',
    'btn-export-pdf',
    'doc-sync-status'
  ];

  requiredIds.forEach(id => {
    assert.ok(content.includes(`id="${id}"`), `El HTML debe contener el elemento id="${id}"`);
  });
  console.log(`  ✓ ${requiredIds.length} elementos estructurales e IDs verificados (incluyendo setting-google-clientid)`);

  // 2. Verificar que no haya credenciales hardcodeadas en el HTML
  const forbiddenPatterns = [
    /AIzaSy[0-9a-zA-Z_-]{33}/, // Google API key pattern
    /ghp_[0-9a-zA-Z]{36}/,     // GitHub PAT
    /rnd_[0-9a-zA-Z]{32}/      // Render API key
  ];

  forbiddenPatterns.forEach(pattern => {
    assert.strictEqual(pattern.test(content), false, 'No deben existir API keys hardcodeadas en index.html');
  });
  console.log('  ✓ Seguridad: Cero secretos o tokens hardcodeados en el cliente');

  console.log('✅ Auditoría de HTML completada exitosamente.\n');
}

if (process.argv[1] === __filename) {
  try {
    runHtmlAudit();
  } catch (err) {
    console.error('❌ Error en auditoría de HTML:', err);
    process.exit(1);
  }
}
