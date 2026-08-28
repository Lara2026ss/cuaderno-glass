# Cuaderno Glass Pro 6.0 — Guía de Despliegue en Producción (Render)

## 1. Configuración del Servicio en Render

- **Tipo de Servicio:** Web Service
- **Nombre:** `cuaderno-glass`
- **Entorno:** `Node` (Node.js 24)
- **Branch:** `main`
- **Build Command:** `npm ci && node build.js`
- **Start Command:** `npm start` (o `node server.js`)
- **Health Check Path:** `/health`

---

## 2. Variables de Entorno en Render Dashboard

Configura las siguientes variables en la pestaña **Environment** de tu servicio en Render:

| Variable | Descripción | Obligatoria |
| :--- | :--- | :---: |
| `NODE_ENV` | `production` | Sí |
| `PORT` | `10000` (o el asignado automáticamente por Render) | Sí |
| `GEMINI_API_KEY` | Clave API de Google AI Studio | Sí |
| `GOOGLE_CLIENT_ID` | Client ID de Google OAuth / Firebase | Sí |
| `FIREBASE_PROJECT_ID` | `alero-company-works` | Sí |
| `FIREBASE_AUTH_DOMAIN` | `alero-company-works.firebaseapp.com` | Sí |
| `FIREBASE_SERVICE_ACCOUNT` | JSON de Service Account de Firebase Admin | Recomendado |
| `DISCORD_WEBHOOK_URL` | Webhook para alertas de ofertas de Price Tracker | Opcional |
| `TELEGRAM_BOT_TOKEN` | Token de bot de Telegram para notificaciones | Opcional |
| `TELEGRAM_CHAT_ID` | Chat ID destino de Telegram | Opcional |
| `RENDER_API_KEY` | API Key de Render para monitor de servicios | Opcional |

---

## 3. Background Price Worker en Render

El daemon `startPriceMonitoringWorker` corre dentro de la misma instancia de Node.js Express. En planes de Render Web Service activos (Starter o superior), el worker se ejecuta continuamente cada 30 minutos sin interrupciones. En planes Free (con spin-down por inactividad), el worker reanuda su ciclo en cada petición entrante o ping de salud (`/health`).
