/**
 * Tests: Price Tracker & Store Adapters
 */

const assert = require('assert');

// Mock browser globals
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};
global.navigator = { onLine: true };
global.window = {
  location: { href: 'http://localhost:3000' },
  addEventListener: () => {},
  removeEventListener: () => {}
};

async function runPriceTrackerTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Price Tracker & Descuentos...');

  const { calculateDiscountMetrics, detectStoreFromUrl, STORES, PriceTrackerService } = await import('../src/integrations/price-tracker.js');

  // Test 1: Store detection
  assert.strictEqual(detectStoreFromUrl('https://www.amazon.com/dp/B08N5WRWNW').name, 'Amazon');
  assert.strictEqual(detectStoreFromUrl('https://www.eneba.com/latam/steam-cyberpunk-2077').name, 'Eneba');
  assert.strictEqual(detectStoreFromUrl('https://articulo.mercadolibre.com.mx/MLM-123456').name, 'Mercado Libre');
  assert.strictEqual(detectStoreFromUrl('https://store.steampowered.com/app/1091500').name, 'Steam');
  assert.strictEqual(detectStoreFromUrl('https://tienda-random.com/producto').name, 'Tienda Online');
  console.log('  ✓ Detección de tiendas (Amazon, Eneba, Mercado Libre, Steam) validada');

  // Test 2: Discount & Savings calculations
  const d1 = calculateDiscountMetrics(60, 30);
  assert.strictEqual(d1.discountPercent, 50, 'Descuento de $60 a $30 debe ser 50%');
  assert.strictEqual(d1.savings, 30, 'Ahorro debe ser $30');
  assert.strictEqual(d1.hasDiscount, true);

  const d2 = calculateDiscountMetrics(100, 100);
  assert.strictEqual(d2.discountPercent, 0, 'Sin descuento debe retornar 0%');
  assert.strictEqual(d2.hasDiscount, false);

  const d3 = calculateDiscountMetrics(59.99, 14.99);
  assert.strictEqual(d3.discountPercent, 75, 'Descuento de $59.99 a $14.99 debe ser 75%');
  assert.strictEqual(d3.savings, 45, 'Ahorro debe ser $45');
  console.log('  ✓ Cálculo de porcentajes de descuento y ahorro validado');

  // Test 3: Tracker creation & threshold statuses
  const trackerService = new PriceTrackerService();
  const item = trackerService.createTracker({
    storeName: 'Eneba',
    productName: 'Elden Ring Key',
    url: 'https://www.eneba.com/elden-ring',
    normalPrice: 60,
    currentPrice: 35,
    targetPrice: 40
  });

  assert.strictEqual(item.status, 'TARGET_REACHED', 'Debe marcar TARGET_REACHED si currentPrice <= targetPrice');
  assert.strictEqual(item.discountPercent, 42);
  assert.strictEqual(item.priceHistory.length, 1);
  console.log('  ✓ Creación de tracker e historial de precios validado');

  console.log('✅ Todas las pruebas de Price Tracker pasaron con éxito.\n');
}

if (require.main === module) {
  runPriceTrackerTests().catch(err => {
    console.error('❌ Error en pruebas de Price Tracker:', err);
    process.exit(1);
  });
}

module.exports = { runPriceTrackerTests };
