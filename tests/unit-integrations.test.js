/**
 * Tests: Integration Registry & Health Checks
 */

const assert = require('assert');

// Mock browser globals
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.navigator = { onLine: true };

async function runIntegrationsTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Integration Registry...');

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
      return { ok: true, message: 'All systems green' };
    }
  });

  const item = registry.get('test-service');
  assert.ok(item, 'Debe registrar la integración');
  assert.strictEqual(item.name, 'Servicio de Prueba');
  console.log('  ✓ Registro de integraciones validado');

  // Test 2: Health check
  const testRes = await registry.testConnection('test-service');
  assert.strictEqual(healthCalled, true, 'Debe ejecutar la función de health check');
  assert.strictEqual(testRes.ok, true);
  assert.strictEqual(registry.get('test-service').status, 'connected');
  console.log('  ✓ Flujo de verificación de conexión y estados validado');

  // Test 3: Failure state
  registry.register({
    id: 'failing-service',
    name: 'Servicio con Error',
    healthCheck: async () => {
      throw new Error('API Key inválida o vencida');
    }
  });

  const failRes = await registry.testConnection('failing-service');
  assert.strictEqual(failRes.ok, false);
  assert.strictEqual(registry.get('failing-service').status, 'error');
  assert.strictEqual(registry.get('failing-service').error, 'API Key inválida o vencida');
  console.log('  ✓ Manejo de degradación y estado de error validado');

  console.log('✅ Todas las pruebas de Integration Registry pasaron con éxito.\n');
}

if (require.main === module) {
  runIntegrationsTests().catch(err => {
    console.error('❌ Error en pruebas de Integration Registry:', err);
    process.exit(1);
  });
}

module.exports = { runIntegrationsTests };
