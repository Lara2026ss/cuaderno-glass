/**
 * Tests: Integration Registry & Health Checks
 */

import assert from 'assert';
import { setupTestEnvironment } from './test-helper.js';

export async function runIntegrationsTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Integration Registry...');
  setupTestEnvironment();

  const { IntegrationRegistry } = await import('../src/integrations/registry.js');
  const registry = new IntegrationRegistry();

  // Test 1: Register integration
  let healthCalled = false;
  registry.register({
    id: 'test-service',
    name: 'Servicio de Prueba',
    icon: '⚡',
    capabilities: ['test'],
    healthCheck: async () => {
      healthCalled = true;
      return { ok: true };
    }
  });

  const registered = registry.get('test-service');
  assert.ok(registered, 'Integración debe estar registrada');
  assert.strictEqual(registered.name, 'Servicio de Prueba');
  console.log('  ✓ Registro de integraciones validado');

  // Test 2: Status transition and healthcheck
  assert.strictEqual(registered.status, 'disconnected');
  const checkResult = await registry.testConnection('test-service');
  assert.strictEqual(checkResult.ok, true, 'Health check debe responder ok');
  assert.strictEqual(registered.status, 'connected', 'Estado debe ser connected tras check exitoso');
  assert.strictEqual(healthCalled, true, 'Función healthCheck debe haber sido invocada');
  console.log('  ✓ Flujo de verificación de conexión y estados validado');

  // Test 3: Failure handling
  registry.register({
    id: 'failing-service',
    name: 'Servicio con Error',
    icon: '❌',
    capabilities: ['fail'],
    healthCheck: async () => {
      throw new Error('API Key inválida o vencida');
    }
  });

  const failResult = await registry.testConnection('failing-service');
  assert.strictEqual(failResult.ok, false, 'Check con error debe retornar ok: false');
  const failing = registry.get('failing-service');
  assert.strictEqual(failing.status, 'error', 'Estado debe ser error');
  assert.ok(failing.error.includes('API Key'), 'Mensaje de error debe persistirse');
  console.log('  ✓ Manejo de degradación y estado de error validado');

  console.log('✅ Todas las pruebas de Integration Registry pasaron con éxito.\n');
}

if (process.argv[1] && process.argv[1].endsWith('unit-integrations.test.js')) {
  runIntegrationsTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
