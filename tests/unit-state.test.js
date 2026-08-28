/**
 * Tests: AppStore & State Engine
 */

import assert from 'assert';
import { setupTestEnvironment } from './test-helper.js';

export async function runStateTests() {
  console.log('🧪 Ejecutando pruebas unitarias: AppState & Store...');
  const env = setupTestEnvironment();

  const { AppStore, DATA_VERSION } = await import('../src/app/state.js');
  const store = new AppStore();

  // Test 1: Initial state structure
  assert.strictEqual(store.get('version'), DATA_VERSION, 'DATA_VERSION debe ser 4');
  assert.deepStrictEqual(store.get('tasks'), [], 'Tasks debe iniciar como array vacío');
  assert.strictEqual(store.get('settings.theme'), 'dark', 'Tema por defecto debe ser dark');
  assert.strictEqual(store.get('settings.googleClientId'), '', 'googleClientId debe existir en settings inicial');
  console.log('  ✓ Initial state validado (incluyendo googleClientId)');

  // Test 2: Set & Get
  store.set('settings.audioVolume', 0.8);
  assert.strictEqual(store.get('settings.audioVolume'), 0.8, 'audioVolume debe actualizarse');
  store.set('settings.googleClientId', '12345-abc.apps.googleusercontent.com');
  assert.strictEqual(store.get('settings.googleClientId'), '12345-abc.apps.googleusercontent.com', 'googleClientId reactivo validado');
  console.log('  ✓ Get & Set reactivo validado');

  // Test 3: Offline Queue
  const mutation = store.enqueueMutation({ type: 'save', collection: 'tasks', item: { id: 't1', text: 'Demo' } });
  assert.strictEqual(store.offlineQueue.length, 1, 'Cola offline debe tener 1 elemento');
  assert.strictEqual(store.get('sync.pendingMutations'), 1, 'pendingMutations debe ser 1');
  
  store.dequeueMutation(mutation.id);
  assert.strictEqual(store.offlineQueue.length, 0, 'Cola offline debe vaciarse al desencolar');
  console.log('  ✓ Cola de mutaciones offline validada');

  // Test 4: Migrations (object payload)
  const legacyData = {
    version: 1,
    tasks: [{ id: 1, text: 'Legacy task' }],
    settings: { theme: 'light' }
  };
  const migrated = store._migrate(legacyData);
  assert.strictEqual(migrated.version, 4, 'Versión migrada debe ser 4');
  assert.strictEqual(migrated.tasks.length, 1, 'Debe conservar las tareas existentes');
  assert.ok(migrated.connections, 'Debe añadir el nodo connections');
  console.log('  ✓ Migración de versiones legacy v1->v4 validada');

  // Test 5: Legacy non-JSON string resilience (BUG-005)
  env.storage.clear();
  env.storage.setItem('cuaderno_pro_theme', 'light');
  env.storage.setItem('cuaderno_pro_tasks', 'invalid-json-data');
  const freshStore = new AppStore();
  assert.strictEqual(freshStore.get('settings.theme'), 'light', 'Debe procesar strings legacy no-JSON sin lanzar SyntaxError');
  assert.deepStrictEqual(freshStore.get('tasks'), [], 'Fallback seguro para JSON inválido en tasks');
  console.log('  ✓ Resiliencia de migración legacy ante strings planos no-JSON validada (BUG-005)');

  console.log('✅ Todas las pruebas de AppState pasaron con éxito.\n');
}

if (process.argv[1] && process.argv[1].endsWith('unit-state.test.js')) {
  runStateTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
