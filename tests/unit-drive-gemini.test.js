/**
 * Tests: Google Drive Hub, Gemini Copilot Function Calling & Notification Engine
 */

import assert from 'assert';
import { setupTestEnvironment } from './test-helper.js';

export async function runDriveGeminiTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Google Drive, Gemini Function Calling & Notifications...');
  setupTestEnvironment();

  const { googleDriveAdapter } = await import('../src/integrations/google-drive.js');
  const { geminiProvider, GEMINI_TOOLS } = await import('../src/integrations/gemini.js');
  const { notificationEngine, NOTIFICATION_EVENTS } = await import('../src/services/notifications.js');
  const { store } = await import('../src/app/state.js');

  // Test 1: Google Drive Adapter Configuration
  assert.strictEqual(googleDriveAdapter.id, 'googleDrive');
  assert.strictEqual(googleDriveAdapter.accessToken, null);
  googleDriveAdapter.disconnect();
  assert.strictEqual(store.get('connections.googleDrive.status'), 'disconnected');
  console.log('  ✓ Google Drive adapter: ciclo de conexión y estado validado');

  // Test 2: Gemini / Groq Tool Schemas Whitelist
  assert.ok(Array.isArray(GEMINI_TOOLS), 'GEMINI_TOOLS debe ser un array');
  const toolNames = GEMINI_TOOLS.map(t => t.name || t.function?.name);
  assert.ok(toolNames.includes('createTask'));
  assert.ok(toolNames.includes('listTasks'));
  assert.ok(toolNames.includes('createDocument'));
  assert.ok(toolNames.includes('addTrackerItem'));
  assert.ok(toolNames.includes('getTodaySummary'));
  assert.ok(toolNames.includes('searchDocuments'));
  assert.ok(toolNames.includes('updateDocument'));
  assert.ok(toolNames.includes('deleteDocument'));
  assert.ok(toolNames.includes('searchDrive'));
  assert.ok(toolNames.includes('getActiveDeals'));
  console.log('  ✓ Groq / Gemini Copilot: Whitelist de 10 schemas de herramientas validada');

  // Test 3: Gemini Tool Execution: createTask
  const initialTaskCount = store.get('tasks', []).length;
  const taskResult = await geminiProvider.executeTool('createTask', {
    text: 'Estudiar para el examen de Álgebra',
    category: 'Estudio',
    priority: 'alta'
  });
  assert.strictEqual(taskResult.success, true);
  assert.strictEqual(store.get('tasks', []).length, initialTaskCount + 1);
  assert.strictEqual(store.get('tasks', [])[0].text, 'Estudiar para el examen de Álgebra');
  assert.strictEqual(store.get('tasks', [])[0].priority, 'alta');
  console.log('  ✓ Gemini Tool Execution: createTask validado');

  // Test 4: Gemini Tool Execution: createDocument
  const docResult = await geminiProvider.executeTool('createDocument', {
    title: 'Apuntes de Arquitectura de Software',
    category: 'Estudio',
    tags: ['software', 'cloud'],
    body: '# Microservicios y Cloud\n\nNotas sobre escalabilidad.'
  });
  assert.strictEqual(docResult.success, true);
  const createdDocId = docResult.doc.id;
  assert.strictEqual(store.get('documents', [])[0].title, 'Apuntes de Arquitectura de Software');
  console.log('  ✓ Gemini Tool Execution: createDocument validado');

  // Test 5: Gemini Tool Execution: searchDocuments & updateDocument
  const searchResult = await geminiProvider.executeTool('searchDocuments', { query: 'escalabilidad' });
  assert.strictEqual(searchResult.success, true);
  assert.ok(searchResult.count >= 1);

  const updateResult = await geminiProvider.executeTool('updateDocument', {
    docId: createdDocId,
    title: 'Apuntes de Arquitectura v6'
  });
  assert.strictEqual(updateResult.success, true);
  assert.strictEqual(store.get('documents', []).find(d => d.id === createdDocId).title, 'Apuntes de Arquitectura v6');
  console.log('  ✓ Gemini Tool Execution: searchDocuments & updateDocument validados');

  // Test 6: AI Security - Delete without confirmation blocked
  const unconfirmedDelete = await geminiProvider.executeTool('deleteDocument', { docId: createdDocId, confirmed: false });
  assert.strictEqual(unconfirmedDelete.success, false);
  assert.strictEqual(unconfirmedDelete.requiresConfirmation, true);
  assert.ok(store.get('documents', []).some(d => d.id === createdDocId), 'Documento no debe ser eliminado sin confirmación');
  console.log('  ✓ AI Security: Operaciones destructivas bloqueadas sin confirmación explícita');

  // Test 7: Gemini Tool Execution: getTodaySummary
  const summary = await geminiProvider.executeTool('getTodaySummary');
  assert.ok(typeof summary.pendingTasksCount === 'number');
  assert.ok(typeof summary.documentsCount === 'number');
  assert.ok(summary.pendingTasksCount >= 1);
  console.log('  ✓ Gemini Tool Execution: getTodaySummary métricas calculadas con éxito');

  // Test 8: NotificationEngine Isolated Dispatch
  let dispatched = false;
  try {
    await notificationEngine.dispatch(NOTIFICATION_EVENTS.PRICE_TARGET_REACHED, {
      title: 'Descuento en Steam',
      message: 'Cyberpunk 2077 está a $29.99',
      currentPrice: 29.99,
      targetPrice: 30.00
    });
    dispatched = true;
  } catch (e) {
    dispatched = false;
  }
  assert.strictEqual(dispatched, true, 'NotificationEngine debe despachar sin lanzar excepciones no controladas');
  console.log('  ✓ NotificationEngine: Despacho multicanal aislado validado');

  // Test 9: Gemini Local Assistant Natural Language Command
  const localReply = await geminiProvider.generateResponse('crear tarea Comprar café para la oficina');
  assert.ok(localReply.includes('Comprar café para la oficina'), 'Debe crear tarea desde lenguaje natural');
  const summaryReply = await geminiProvider.generateResponse('resumen');
  assert.ok(summaryReply.includes('Tareas pendientes'), 'Debe generar resumen con conteos numéricos');
  assert.ok(!summaryReply.includes('undefined'), 'No debe tener valores undefined en el resumen');
  console.log('  ✓ Gemini Copilot: Asistente local y comandos en lenguaje natural validados');

  // Test 10: Modals Module Structure & Presets Validation
  const { modals } = await import('../src/ui/modals.js');
  assert.ok(typeof modals.open === 'function');
  assert.ok(typeof modals.close === 'function');
  assert.ok(typeof modals.openPriceHistory === 'function');
  assert.ok(typeof modals.openDrivePicker === 'function');
  assert.ok(typeof modals.applyRecommendedPresets === 'function');
  assert.ok(typeof modals.applyLocalModePreset === 'function');
  
  modals.applyLocalModePreset();
  assert.strictEqual(store.get('settings.firebaseConfig'), null);
  console.log('  ✓ ModalManager: Integridad estructural y presets 1-clic validados');

  // Test 11: Tasks Category Filtering & Persistence Validation
  const { tasksFeature } = await import('../src/features/tasks.js');
  tasksFeature.setCategory('Estudio');
  assert.strictEqual(tasksFeature.activeCategory, 'Estudio');
  assert.strictEqual(store.get('tasksCategoryFilter'), 'Estudio');
  tasksFeature.setCategory('all');
  assert.strictEqual(tasksFeature.activeCategory, 'all');
  console.log('  ✓ TasksFeature: Filtrado por categorías y reactividad validado');

  // Test 12: Pomodoro Feature Modes & Formatting Validation
  const { pomodoroFeature } = await import('../src/features/pomodoro.js');
  assert.strictEqual(pomodoroFeature.formatTime(1500), '25:00');
  assert.strictEqual(pomodoroFeature.formatTime(300), '05:00');
  pomodoroFeature.setMode('shortBreak');
  assert.strictEqual(store.get('pomodoro.mode'), 'shortBreak');
  pomodoroFeature.setMode('work');
  assert.strictEqual(store.get('pomodoro.mode'), 'work');
  console.log('  ✓ PomodoroFeature: Modos de temporizador y formateo validados');

  console.log('✅ Todas las pruebas de Google Drive, Gemini, Notifications, Categorías & Modals pasaron con éxito (12/12).\n');
}

if (process.argv[1] && process.argv[1].endsWith('unit-drive-gemini.test.js')) {
  runDriveGeminiTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
