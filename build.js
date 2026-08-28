/**
 * Cuaderno Glass Pro — Compilador y Bundler de Producción
 * Empaqueta todos los estilos, scripts y módulos en dist/cuaderno.html
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📦 Iniciando compilación de Cuaderno Glass Pro 6.0...');

const distDir = path.join(__dirname, 'dist');
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

const indexPath = path.join(__dirname, 'index.html');
let htmlContent = fs.readFileSync(indexPath, 'utf-8');

// 1. Inyectar estilos CSS internos
const stylesDir = path.join(__dirname, 'src', 'styles');
if (fs.existsSync(stylesDir)) {
  const cssFiles = ['glass.css', 'components.css', 'responsive.css'];
  let combinedCss = '';
  
  for (const cssFile of cssFiles) {
    const fullPath = path.join(stylesDir, cssFile);
    if (fs.existsSync(fullPath)) {
      combinedCss += `\n/* === ${cssFile} === */\n` + fs.readFileSync(fullPath, 'utf-8');
    }
  }

  // Reemplazar enlaces locales de estilos por bloque <style> embebido
  htmlContent = htmlContent.replace(
    /<link\s+rel="stylesheet"\s+href="src\/styles\/[^"]*">/gi,
    ''
  );

  htmlContent = htmlContent.replace('</head>', `<style>\n${combinedCss}\n</style>\n</head>`);
}

// 2. Escribir archivo de distribución en dist/cuaderno.html
const outputDistPath = path.join(distDir, 'cuaderno.html');
fs.writeFileSync(outputDistPath, htmlContent, 'utf-8');

console.log(`✅ Build generado exclusivamente en: ${outputDistPath}`);
console.log('🎉 Compilación finalizada exitosamente.\n');
