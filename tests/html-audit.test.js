/**
 * Tests: Auditoría de HTML y Estructura Semántica de Cuaderno Glass Pro 6.0
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function runHtmlAudit() {
  console.log('🧪 Ejecutando auditoría de HTML y Estructura Semántica...');
  const indexPath = path.join(__dirname, '..', 'index.html');
  assert.ok(fs.existsSync(indexPath), 'index.html debe existir en la raíz');

  const content = fs.readFileSync(indexPath, 'utf-8');

  // 1. Validar presencia de IDs estructurales clave
  const requiredIds = [
    'sidebar-nav',
    'btn-google-auth',
    'auth-btn-text',
    'user-display-name',
    'user-display-email',
    'user-avatar-img',
    'global-search',
    'btn-theme-toggle',
    'btn-quick-new',
    'tab-dashboard',
    'tab-tasks',
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
    'doc-sync-status',
    'btn-preset-recommended',
    'btn-preset-local'
  ];

  requiredIds.forEach(id => {
    assert.ok(content.includes(`id="${id}"`), `El HTML debe contener el elemento id="${id}"`);
  });
  console.log(`  ✓ ${requiredIds.length} elementos estructurales e IDs verificados (incluyendo setting-google-clientid)`);

  // 2. Validar que no haya API Keys expuestas hardcodeadas en HTML
  assert.ok(!content.includes('AIzaSy'), 'No deben existir API Keys de Firebase hardcodeadas');
  assert.ok(!content.includes('gsk_'), 'No deben existir API Keys de Groq hardcodeadas');
  assert.ok(!content.includes('rnd_'), 'No deben existir API Keys de Render hardcodeadas');
  console.log('  ✓ Seguridad: Cero secretos o tokens hardcodeados en el cliente');

  console.log('✅ Auditoría de HTML completada exitosamente.\n');
}

if (process.argv[1] && process.argv[1].endsWith('html-audit.test.js')) {
  runHtmlAudit();
}
