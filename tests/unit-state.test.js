/**
 * Tests: AppStore & State Engine
 */

const assert = require('assert');

// Mock localStorage & navigator for Node test runner
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};
global.navigator = { onLine: true };

async function runStateTests() {
  console.log('🧪 Ejecutando pruebas unitarias: AppState & Store...');

  const { AppStore, DATA_VERSION } = await import('../src/app/state.js');
  const store = new AppStore();

  // Test 1: Initial state structure
  assert.strictEqual(store.get('version'), DATA_VERSION, 'DATA_VERSION debe ser 4');
  assert.deepStrictEqual(store.get('tasks'), [], 'Tasks debe iniciar como array vacío');
  assert.strictEqual(store.get('settings.theme'), 'dark', 'Tema por defecto debe ser dark');
  console.log('  ✓ Initial state validado');

  // Test 2: Set & Get
  store.set('settings.audioVolume', 0.8);
  assert.strictEqual(store.get('settings.audioVolume'), 0.8, 'audioVolume debe actualizarse');
  console.log('  ✓ Get & Set reactivo validado');

  // Test 3: Offline Queue
  const mutation = store.enqueueMutation({ type: 'save', collection: 'tasks', item: { id: 't1', text: 'Demo' } });
  assert.strictEqual(store.offlineQueue.length, 1, 'Cola offline debe tener 1 elemento');
  assert.strictEqual(store.get('sync.pendingMutations'), 1, 'pendingMutations debe ser 1');
  
  store.dequeueMutation(mutation.id);
  assert.strictEqual(store.offlineQueue.length, 0, 'Cola offline debe vaciarse al desencolar');
  console.log('  ✓ Cola de mutaciones offline validada');

  // Test 4: Migrations
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

  console.log('✅ Todas las pruebas de AppState pasaron con éxito.\n');
}

if (require.main === module) {
  runStateTests().catch(err => {
    console.error('❌ Error en pruebas de AppState:', err);
    process.exit(1);
  });
}

module.exports = { runStateTests };
