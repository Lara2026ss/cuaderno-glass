# Cuaderno Glass Pro 4.0 📓✨

> **Suite Web Modular & Cloud Hub** construida con arquitectura multi-app, estética *Dynamic Ultra-Glassmorphism*, autenticación real con **Google & Firebase**, base de datos **Cloud Firestore** con aislamiento por usuario, **Rastreador de Precios multitienda** (Amazon, Eneba, Mercado Libre, Steam), asistente **Gemini AI Copilot** contextual, síntesis acústica con **Web Audio API** y conectores de nube para **Render**, **Discord**, **GitHub** y **Google Drive**.

---

## 🏛️ Arquitectura del Proyecto

```text
cuaderno-glass/
├── index.html                  # Aplicación web raíz modular (ES6 Modules)
├── server.js                   # Backend Express con proxies de API y health checks
├── build.js                    # Generador del bundle autónomo
├── firestore.rules             # Reglas de seguridad de Firestore (aislamiento por UID)
├── render.yaml                 # Blueprint de despliegue en Render
├── package.json                # Dependencias, scripts y configuración de node
├── dist/
│   └── cuaderno.html           # Build distribuible autocontenido
├── src/
│   ├── app/
│   │   ├── state.js            # AppStore reactivo, DATA_VERSION=4, migraciones y cola offline
│   │   ├── router.js           # Enrutador por hash y gestor de navegación
│   │   ├── events.js           # Bus de eventos central tipado (Pub/Sub)
│   │   ├── logger.js           # Observabilidad, diagnósticos y registro sin fugas de secretos
│   │   └── bootstrap.js        # Error boundary global e inicializador maestro
│   ├── firebase/
│   │   ├── config.js           # Validador y cargador de credenciales Firebase
│   │   ├── auth.js             # Autenticación Google real vía popup con persistencia de sesión
│   │   ├── firestore.js        # Repositorio Firestore en users/{uid}/... con listeners realtime
│   │   └── sync.js             # Sincronizador de cola offline y asistente de migración Local -> Cloud
│   ├── audio/
│   │   └── audio-engine.js     # Sintetizador procedural con Web Audio API (100% offline)
│   ├── integrations/
│   │   ├── registry.js         # IntegrationRegistry con ciclo de vida (connect/disconnect/healthCheck)
│   │   ├── discord.js          # Despachador de alertas y notificaciones a Discord Webhook
│   │   ├── github.js           # Cliente API de GitHub para repositorios y commits
│   │   ├── render.js           # Monitoreo de servicios y estado de despliegues en Render
│   │   ├── google-drive.js     # Conexión OAuth2 GIS y Google Drive API v3
│   │   ├── gemini.js           # Proveedor de IA contextual con inyección de estado
│   │   └── price-tracker.js    # Adaptadores de tiendas (Amazon, Eneba, Mercado Libre, Steam), historial y alertas
│   ├── features/
│   │   ├── tasks.js            # Gestor de tareas con categorías, prioridades y confetti
│   │   ├── notes.js            # Bloc de notas rápidas con formateo estructurado por IA
│   │   ├── documents.js        # Editor de documentos con exportación .md y subida a Drive
│   │   ├── deals.js            # Vista del rastreador de ofertas, badges de ahorro e historial
│   │   ├── pomodoro.js         # Temporizador Pomodoro con fanfarrias acústicas y sesiones
│   │   └── search.js           # Búsqueda global unificada entre todas las entidades
│   ├── ui/
│   │   ├── toast.js            # Sistema de notificaciones toast con efectos sonoros
│   │   ├── modals.js           # Gestor de modales (Ajustes, Migración Cloud, Historial de Precios)
│   │   └── components.js       # Sanitización XSS, formateadores de fecha y helpers DOM
│   └── styles/
│       ├── glass.css           # Variables de diseño, orbes de luz reactivos y superficies glass
│       ├── components.css      # Estilos de botones, tarjetas, métricas y badges
│       └── responsive.css      # Adaptabilidad responsive para escritorio, tablet y móvil
└── tests/
    ├── unit-state.test.js      # Pruebas de AppStore, reactividad y migraciones
    ├── unit-price-tracker.test.js # Pruebas de detección de tiendas y cálculos de descuento
    ├── unit-integrations.test.js  # Pruebas de registro de integraciones y degradación graceful
    ├── html-audit.test.js      # Auditoría de elementos HTML, IDs y seguridad de cero secretos
    └── run-all.js              # Test runner maestro
```

---

## 🚀 Instalación y Uso Local

1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Ejecutar el servidor local**:
   ```bash
   npm start
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

3. **Ejecutar la suite de pruebas**:
   ```bash
   npm test
   ```

4. **Compilar el build standalone**:
   ```bash
   node build.js
   ```

---

## 🔥 Configuración de Firebase (Google Auth & Firestore)

1. Ingresa a [Firebase Console](https://console.firebase.google.com/) y crea un proyecto (ej. `cuaderno-glass`).
2. En **Authentication** $\rightarrow$ **Sign-in method**, habilita el proveedor **Google**.
3. En **Firestore Database**, crea la base de datos y copia las reglas de seguridad de [`firestore.rules`](firestore.rules).
4. En **Configuración del Proyecto** $\rightarrow$ **Tus apps**, registra una aplicación web y copia el objeto `firebaseConfig`.
5. En Cuaderno Glass, haz clic en **⚙️ Configuración** (en la barra lateral) e introduce tu `apiKey`, `authDomain`, `projectId`, `storageBucket` y `appId`.
6. ¡Listo! Haz clic en **Iniciar Sesión con Google** y tus datos se sincronizarán en tiempo real.

---

## 🛒 Rastreador de Precios Multitienda (Amazon, Eneba, Mercado Libre, Steam)

- **Soporte Multitienda**: Pega cualquier enlace de Amazon, Eneba, Mercado Libre, Steam o tienda web. El sistema detectará automáticamente la tienda y el icono correspondiente.
- **Cálculo Automático de Ahorro**: Calcula el porcentaje de descuento real (`% Ahorro`) y el dinero ahorrado respecto al precio normal.
- **Alertas Proactivas**: Cuando el precio actual sea menor o igual a tu precio objetivo (`targetPrice`), se disparará:
  1. 🔊 Alerta acústica en el sintetizador Web Audio API.
  2. 🔔 Notificación de escritorio del navegador.
  3. 📢 Mensaje con embed detallado a tu canal de Discord (si está configurado el webhook).
- **Historial de Precios**: Visualiza el precio mínimo histórico, máximo y la curva de cambios.

---

## 🔊 Motor Acústico Procedural (Web Audio API)

Cuaderno Glass 4.0 incluye un sintetizador acústico procedural que genera sonidos puros en tiempo real:
- `soundClick()`: Micro-toque de cristal en botones y navegación.
- `soundSuccess()`: Campanada armónica en acorde C Mayor para tareas completadas y login.
- `soundAlert()`: Tono dual A5 $\rightarrow$ D6 para caídas de precio y ofertas.
- `soundPomodoro()`: Fanfarria melódica al terminar bloques de concentración.
- `soundNotification()` / `soundError()`: Retroalimentación sutil.

> **Zero Dependencias**: 100% offline, sin archivos `.mp3` externos que puedan romperse. Incluye control de volumen y botón de silencio (*Mute*) en Configuración.

---

## ⚡ Variables de Entorno para Producción (Render)

| Variable | Descripción |
| :--- | :--- |
| `PORT` | Puerto HTTP para Express (por defecto `3000` o asignado por Render). |
| `GEMINI_API_KEY` | Clave de API de Google Gemini para el asistente Copilot. |
| `DISCORD_WEBHOOK_URL` | URL de Webhook de Discord para notificaciones y alertas de precio. |
| `RENDER_API_KEY` | API Key de Render para monitoreo de servicios y bots. |
| `GITHUB_PAT` | (Opcional) Personal Access Token para consultas de repositorios privados. |

---

## 🛡️ Seguridad y Buenas Prácticas

- **Cero Secretos en el Frontend**: Las API keys y webhooks pueden configurarse de forma segura en variables de entorno en el servidor o en el almacenamiento local del usuario.
- **Sanitización Estricta**: Todo el contenido generado por el usuario o proveniente de APIs externas pasa por `escapeHtml()` y `sanitizeUrl()` previniendo vulnerabilidades XSS.
- **Aislamiento en Firestore**: Las reglas de seguridad garantizan que `users/{userId}` solo pueda ser leído o modificado por el usuario autenticado con ese `request.auth.uid`.

---

## 🧪 Resultados de la Suite de Pruebas

```text
======================================================
🚀 SUITE DE PRUEBAS AUTOMATIZADAS CUADERNO GLASS PRO 4.0
======================================================
  ✓ AppState & Store: Migraciones v1->v4, Get/Set, Cola Offline (PASÓ)
  ✓ Price Tracker: Detección de tiendas, cálculo de descuentos y alertas (PASÓ)
  ✓ Integration Registry: Conexión, health checks y degradación graceful (PASÓ)
  ✓ HTML Audit: 35 elementos e IDs verificados, cero secretos expuestos (PASÓ)
======================================================
🎉 4/4 SUITES COMPLETADAS EXITOSAMENTE (100%)
======================================================
```
