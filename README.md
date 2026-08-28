# Cuaderno Glass Pro 6.0 — Personal Productivity Suite & Cloud Hub

![Cuaderno Glass Header](https://raw.githubusercontent.com/Lara2026ss/cuaderno-glass/main/preview.png)

Suite personal de productividad, centro de automatización e inteligencia artificial con interfaz Ultra-Glassmorphism, integración nativa con Google Identity / Cloud Firestore, Gemini AI Copilot con Function Calling seguro, Google Drive Hub, Price Tracker multitienda con daemon de fondo y sistema unificado de notificaciones.

---

## 🌟 Características Principales

1. **Ultra-Glassmorphism UI**: Interfaz visual translúcida de alto rendimiento optimizada para pantallas desde 320px hasta 4K.
2. **Google Identity & Firestore Cloud Sync**: Autenticación real con Google Sign-In, reglas de seguridad de Firestore por usuario (`/users/{uid}/*`) y persistencia offline con cola de mutaciones idempotente.
3. **Gemini AI Copilot**: Asistente con whitelist de 10 herramientas de Function Calling seguras para creación de tareas, redacción de apuntes, búsqueda de documentos y resúmenes diarios.
4. **Google Drive Hub & Exportación**: Integración con Google Drive v3, selector modal de archivos, importación de documentos y exportación a Markdown (.md) y PDF imprimible.
5. **Price Tracker Multitienda**: Rastreador de ofertas en tiempo real para Amazon, Eneba, Mercado Libre y Steam, con alertas por precio objetivo y protección estricta contra SSRF.
6. **Notification Engine Centralizado**: Despacho multicanal aislado para alertas Web Push (PWA), Discord Webhooks, bots de Telegram y avisos in-app.
7. **Motor de Audio Procedural**: Efectos de sonido sintetizados en tiempo real mediante la Web Audio API (cero dependencias de archivos de audio externos).
8. **Seguridad y Cero Secretos**: Arquitectura blindada con escaneo automatizado en CI/CD y cero credenciales expuestas en el bundle del cliente.

---

## 🚀 Inicio Rápido

### 1. Clonar e Instalar Dependencias
```bash
git clone https://github.com/Lara2026ss/cuaderno-glass.git
cd cuaderno-glass
npm install
```

### 2. Ejecutar Servidor Local
```bash
npm start
```
Abre tu navegador en `http://localhost:3000`.

### 3. Ejecutar Pruebas Automatizadas
```bash
node tests/run-all.js
```

### 4. Compilar Bundle de Distribución
```bash
node build.js
```
El archivo independiente se generará en `dist/cuaderno.html`.

---

## 📚 Documentación Técnica

- [Especificación de Arquitectura](docs/ARCHITECTURE.md)
- [Modelo de Datos y Firestore](docs/DATA_MODEL.md)
- [Guía de Despliegue en Render](docs/DEPLOYMENT.md)
- [Auditoría Formal de Seguridad](SECURITY_AUDIT.md)
- [Estrategia de Pruebas](docs/TESTING.md)

---

## 📄 Licencia

MIT © 2026 Mauricio / Alero Company.
