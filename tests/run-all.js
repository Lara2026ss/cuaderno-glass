/**
 * Test Runner Maestro — Cuaderno Glass Pro 6.0 (7 Suites Completas)
 */

import { runStateTests } from './unit-state.test.js';
import { runPriceTrackerTests } from './unit-price-tracker.test.js';
import { runIntegrationsTests } from './unit-integrations.test.js';
import { runAuthTests } from './unit-auth.test.js';
import { runDriveGeminiTests } from './unit-drive-gemini.test.js';
import { runHtmlAudit } from './html-audit.test.js';
import { runSecurityScan } from './security-scan.test.js';

async function main() {
  console.log('======================================================');
  console.log('🚀 INICIANDO BATERÍA COMPLETA DE PRUEBAS DE CUADERNO GLASS PRO 6.0');
  console.log('======================================================\n');

  try {
    await runStateTests();
    await runPriceTrackerTests();
    await runIntegrationsTests();
    await runAuthTests();
    await runDriveGeminiTests();
    runHtmlAudit();
    runSecurityScan();

    console.log('======================================================');
    console.log('🎉 TODAS LAS SUITES DE PRUEBAS PASARON EXITOSAMENTE (7/7)');
    console.log('======================================================');
  } catch (err) {
    console.error('\n❌ BATERÍA DE PRUEBAS FALLIDA:', err);
    process.exit(1);
  }
}

main();
