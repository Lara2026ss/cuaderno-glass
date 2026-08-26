/**
 * Test Runner Maestro — Cuaderno Glass Pro 4.0
 */

const { runStateTests } = require('./unit-state.test.js');
const { runPriceTrackerTests } = require('./unit-price-tracker.test.js');
const { runIntegrationsTests } = require('./unit-integrations.test.js');
const { runHtmlAudit } = require('./html-audit.test.js');
const { runSecurityScan } = require('./security-scan.test.js');

async function main() {
  console.log('======================================================');
  console.log('🚀 INICIANDO BATERÍA COMPLETA DE PRUEBAS DE CUADERNO GLASS PRO 4.0');
  console.log('======================================================\n');

  try {
    await runStateTests();
    await runPriceTrackerTests();
    await runIntegrationsTests();
    runHtmlAudit();
    runSecurityScan();

    console.log('======================================================');
    console.log('🎉 TODAS LAS SUITES DE PRUEBAS PASARON EXITOSAMENTE (5/5)');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ BATERÍA DE PRUEBAS FALLIDA:', err);
    process.exit(1);
  }
}

main();
