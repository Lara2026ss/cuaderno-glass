/**
 * Tests: Price Tracker & Store Adapters & SSRF Protection
 */

import assert from 'assert';
import { setupTestEnvironment } from './test-helper.js';

export async function runPriceTrackerTests() {
  console.log('🧪 Ejecutando pruebas unitarias: Price Tracker, Descuentos & SSRF Hardening...');
  setupTestEnvironment();

  const { calculateDiscountMetrics, detectStoreFromUrl, STORES, PriceTrackerService } = await import('../src/integrations/price-tracker.js');
  const { validateScraperUrl } = await import('../server.js');

  // Test 1: Store detection
  assert.strictEqual(detectStoreFromUrl('https://www.amazon.com/dp/B08N5WRWNW'), STORES.AMAZON);
  assert.strictEqual(detectStoreFromUrl('https://www.eneba.com/latam/steam-elden-ring'), STORES.ENEBA);
  assert.strictEqual(detectStoreFromUrl('https://articulo.mercadolibre.com.mx/MLM-12345'), STORES.MERCADOLIBRE);
  assert.strictEqual(detectStoreFromUrl('https://store.steampowered.com/app/1091500/Cyberpunk_2077/'), STORES.STEAM);
  assert.strictEqual(detectStoreFromUrl('https://tienda-random.com/item'), STORES.OTHER);
  console.log('  ✓ Detección de tiendas (Amazon, Eneba, Mercado Libre, Steam) validada');

  // Test 2: Discount calculations
  const metrics1 = calculateDiscountMetrics(100, 75);
  assert.strictEqual(metrics1.discountPercent, 25);
  assert.strictEqual(metrics1.savingsAmount, 25);
  assert.strictEqual(metrics1.hasDiscount, true);

  const metrics2 = calculateDiscountMetrics(50, 50);
  assert.strictEqual(metrics2.discountPercent, 0);
  assert.strictEqual(metrics2.hasDiscount, false);
  console.log('  ✓ Cálculo de porcentajes de descuento y ahorro validado');

  // Test 3: Tracker creation & history
  const trackerService = new PriceTrackerService();
  const item = trackerService.createTrackerItem({
    name: 'Elden Ring Key',
    url: 'https://www.eneba.com/latam/elden-ring',
    normalPrice: 59.99,
    currentPrice: 35.00,
    targetPrice: 40.00
  });

  assert.strictEqual(item.name, 'Elden Ring Key');
  assert.strictEqual(item.store, STORES.ENEBA.name);
  assert.strictEqual(item.history.length, 1);
  assert.strictEqual(item.history[0].price, 35.00);

  // Test target price notification check
  const alertTriggered = trackerService.checkTargetAlert(item, 32.00);
  assert.strictEqual(alertTriggered, true, 'Debe disparar alerta si nuevo precio es <= targetPrice');
  console.log('  ✓ Creación de tracker e historial de precios validado');

  // Test 4: SSRF Hardening (SEC-001)
  const validAmazon = validateScraperUrl('https://www.amazon.com/dp/B08N5WRWNW');
  assert.strictEqual(validAmazon.valid, true, 'Amazon URL válida debe ser admitida');

  const validEneba = validateScraperUrl('https://www.eneba.com/item');
  assert.strictEqual(validEneba.valid, true, 'Eneba URL válida debe ser admitida');

  const blockedLocalhost = validateScraperUrl('http://localhost:8080/admin');
  assert.strictEqual(blockedLocalhost.valid, false, 'Localhost debe ser bloqueado por SSRF');

  const blockedPrivateIp = validateScraperUrl('http://192.168.1.1/secret');
  assert.strictEqual(blockedPrivateIp.valid, false, 'IP privada 192.168.x debe ser bloqueada por SSRF');

  const blockedMetadata = validateScraperUrl('http://169.254.169.254/latest/meta-data');
  assert.strictEqual(blockedMetadata.valid, false, 'Cloud metadata IP debe ser bloqueada por SSRF');

  const blockedUntrustedDomain = validateScraperUrl('https://malicious-site.com/exploit');
  assert.strictEqual(blockedUntrustedDomain.valid, false, 'Dominio no admitido debe ser bloqueado por whitelist');

  console.log('  ✓ Validación estricta y protección SSRF para scraper validada (SEC-001)');

  console.log('✅ Todas las pruebas de Price Tracker pasaron con éxito.\n');
}

if (process.argv[1] && process.argv[1].endsWith('unit-price-tracker.test.js')) {
  runPriceTrackerTests().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
