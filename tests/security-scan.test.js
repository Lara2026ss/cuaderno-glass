/**
 * Tests: Security Audit & Secret Leak Scanner
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runSecurityScan() {
  console.log('🧪 Ejecutando auditoría de seguridad y escaneo de secretos...');

  const rootDir = path.join(__dirname, '..');
  const forbiddenSubstrings = [
    'BEGIN PRIVATE KEY',
    'private_key_id',
    'alero-company-works-firebase-adminsdk'
  ];

  const forbiddenPatterns = [
    /AIzaSy[0-9a-zA-Z_-]{33}/,
    /ghp_[0-9a-zA-Z]{36}/,
    /rnd_[0-9a-zA-Z]{32}/
  ];

  const filesToScan = [];
  function collectFiles(dir) {
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (entry === 'node_modules' || entry === '.git' || entry === 'tests') continue;
      const fullPath = path.join(dir, entry);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        collectFiles(fullPath);
      } else if (stat.isFile()) {
        filesToScan.push(fullPath);
      }
    }
  }

  collectFiles(rootDir);

  let leaksFound = 0;
  for (const file of filesToScan) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const sub of forbiddenSubstrings) {
      if (content.includes(sub)) {
        console.error(`❌ SECRETO ENCONTRADO en ${file}: Contiene "${sub}"`);
        leaksFound++;
      }
    }
    for (const pattern of forbiddenPatterns) {
      if (pattern.test(content)) {
        console.error(`❌ PATRÓN DE TOKEN ENCONTRADO en ${file}: ${pattern}`);
        leaksFound++;
      }
    }
  }

  assert.strictEqual(leaksFound, 0, `Se encontraron ${leaksFound} secretos o credenciales expuestas en el código fuente`);
  console.log(`  ✓ ${filesToScan.length} archivos analizados: CERO secretos expuestos.`);
  console.log('✅ Auditoría de seguridad aprobada con éxito.\n');
}

if (require.main === module) {
  try {
    runSecurityScan();
  } catch (err) {
    console.error('❌ Auditoría de seguridad fallida:', err.message);
    process.exit(1);
  }
}

module.exports = { runSecurityScan };
