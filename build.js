/**
 * Cuaderno Glass Pro 4.0 — Build Script & Bundler
 */

const fs = require('fs');
const path = require('path');

function build() {
  console.log('📦 Iniciando compilación de Cuaderno Glass Pro 4.0...');

  const rootDir = __dirname;
  const distDir = path.join(rootDir, 'dist');
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Leer estilos
  const glassCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'glass.css'), 'utf-8');
  const compCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'components.css'), 'utf-8');
  const respCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'responsive.css'), 'utf-8');
  const combinedCss = `${glassCss}\n\n${compCss}\n\n${respCss}`;

  // 2. Leer index.html base
  let indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

  // Reemplazar enlaces a CSS externos por <style> inline
  const styleTag = `<style>\n${combinedCss}\n</style>`;
  indexHtml = indexHtml.replace(
    /<link rel="stylesheet" href="src\/styles\/glass\.css">[\s\S]*?<link rel="stylesheet" href="src\/styles\/responsive\.css">/,
    styleTag
  );

  // 3. Escribir distribución en dist/cuaderno.html
  const distFile = path.join(distDir, 'cuaderno.html');
  fs.writeFileSync(distFile, indexHtml, 'utf-8');
  console.log(`✅ Build generado en: ${distFile}`);

  // 4. Copiar a Downloads para uso local inmediato si existe ruta
  const downloadsPath = path.join('c:', 'Users', 'mauri', 'Downloads', 'cuaderno.html');
  try {
    fs.writeFileSync(downloadsPath, indexHtml, 'utf-8');
    console.log(`✅ Sincronizado en Descargas: ${downloadsPath}`);
  } catch (err) {
    console.warn(`⚠️ No se pudo copiar a Descargas: ${err.message}`);
  }

  console.log('🎉 Compilación finalizada exitosamente.');
}

if (require.main === module) {
  build();
}

module.exports = { build };
