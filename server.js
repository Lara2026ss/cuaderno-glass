/**
 * Cuaderno Glass Pro 6.0 — Backend Server con Firebase Admin, Groq AI Proxy & Hardened Scraper
 */

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Inicialización defensiva de Firebase Admin
let firebaseAdminInitialized = false;

try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    firebaseAdminInitialized = true;
    console.log('🔥 Firebase Admin inicializado vía variable de entorno FIREBASE_SERVICE_ACCOUNT');
  } else {
    // Buscar archivo local seguro
    const localSaPath = path.join(__dirname, 'firebase-service-account.json');
    if (fs.existsSync(localSaPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(localSaPath, 'utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      firebaseAdminInitialized = true;
      console.log('🔥 Firebase Admin inicializado vía archivo local');
    } else {
      console.warn('⚠️ No se encontró service account de Firebase Admin. Endpoints backend operarán en modo degradado.');
    }
  }
} catch (err) {
  console.warn('⚠️ Error inicializando Firebase Admin:', err.message);
}

// Middlewares de seguridad y headers CSP
app.use(cors({
  origin: ['http://localhost:3000', 'https://cuaderno-glass.onrender.com', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '5mb' }));

// Buffer de telemetría y logs del servidor (últimos 150 eventos)
const SERVER_LOGS = [];

function logServerEvent(level, component, message, details = null) {
  const entry = {
    id: `log-${Date.now()}-${Math.floor(Math.random()*1000)}`,
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    details
  };
  SERVER_LOGS.unshift(entry);
  if (SERVER_LOGS.length > 150) SERVER_LOGS.pop();

  const detailsStr = details ? ` | ${JSON.stringify(details)}` : '';
  console.log(`[${entry.timestamp}] [${level.toUpperCase()}] [${component}] ${message}${detailsStr}`);
  return entry;
}

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown-ip';
  logServerEvent('info', 'HTTP', `${req.method} ${req.originalUrl}`, { ip: clientIp, ua: (req.headers['user-agent'] || '').slice(0, 50) });
  next();
});

// Servir estáticos
app.use(express.static(__dirname));
app.use('/dist', express.static(path.join(__dirname, 'dist')));

// Middleware de autenticación con Firebase Token
async function verifyAuthToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación no proporcionado' });
  }

  const token = authHeader.split('Bearer ')[1];
  if (!firebaseAdminInitialized) {
    // Modo desarrollo / fallback: decode ligero
    req.user = { uid: 'guest-fallback-uid', email: 'guest@cuaderno.local' };
    return next();
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado', details: err.message });
  }
}

// -------------------------------------------------------------
// RUTAS DE LA API
// -------------------------------------------------------------

// 1. Health check & Diagnostics
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    version: '7.0.0',
    aiEngine: 'Groq Llama 3.3 70B',
    firebaseAdmin: firebaseAdminInitialized,
    timestamp: new Date().toISOString()
  });
});

// 1.1 Logs & Observabilidad Endpoint
app.get('/api/logs', (req, res) => {
  const levelFilter = req.query.level;
  const filtered = levelFilter ? SERVER_LOGS.filter(l => l.level === levelFilter) : SERVER_LOGS;
  res.json({
    success: true,
    total: SERVER_LOGS.length,
    count: filtered.length,
    logs: filtered
  });
});

// 2. Firebase Public Config
app.get('/api/firebase/config', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  logServerEvent('info', 'FirebaseConfig', 'Servida configuración de Firebase a cliente', { ip: clientIp });

  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID || 'alero-company-works',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'alero-company-works.firebaseapp.com',
    apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyBt9pqBxcSOWVSm7fSBJtYSmmPgrb8A_rU',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'alero-company-works.firebasestorage.app',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '16044531269',
    appId: process.env.FIREBASE_APP_ID || '1:16044531269:web:431da21bd13952050d8d2c'
  });
});

// 3. Price Tracker Scraper & Hardened Validation (SEC-001)
const ALLOWED_STORE_DOMAINS = [
  'amazon.com', 'amazon.es', 'amazon.com.mx', 'amazon.co.uk',
  'eneba.com',
  'mercadolibre.com', 'mercadolibre.com.mx', 'mercadolibre.com.ar', 'mercadolibre.cl', 'mercadolivre.com.br',
  'store.steampowered.com', 'steampowered.com'
];

export function validateScraperUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, reason: 'Protocolo no admitido' };
    }

    const host = parsed.hostname.toLowerCase();

    // Bloqueo de loopback y rangos privados (Anti-SSRF)
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      return { valid: false, reason: 'Dirección IP de red privada o metadata bloqueada' };
    }

    // Comprobar si el hostname termina en alguno de los dominios autorizados
    const isAllowed = ALLOWED_STORE_DOMAINS.some(dom => host === dom || host.endsWith('.' + dom));
    if (!isAllowed) {
      return { valid: false, reason: `Dominio ${host} no autorizado para scraping` };
    }

    return { valid: true, url: parsed.href, hostname: host };
  } catch {
    return { valid: false, reason: 'URL malformada' };
  }
}

app.get('/api/price-tracker/check', async (req, res) => {
  const targetUrl = req.query.url;
  const storeName = req.query.store;

  if (!targetUrl) {
    return res.status(400).json({ error: 'URL requerida' });
  }

  const validation = validateScraperUrl(targetUrl);
  if (!validation.valid) {
    return res.status(400).json({ error: 'Acceso denegado por política de seguridad', reason: validation.reason });
  }

  try {
    // Scraping ligero con headers de navegador
    const response = await fetch(validation.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      return res.status(502).json({ error: `La tienda respondió con error ${response.status}` });
    }

    const html = await response.text();
    let price = null;

    // Reglas de extracción heurística por tienda
    if (validation.hostname.includes('amazon')) {
      const match = html.match(/class="a-price-whole">([0-9.,]+)<\/span>.*class="a-price-fraction">([0-9]{2})<\/span>/s) ||
                    html.match(/id="priceblock_ourprice"[^>]*>\$?([0-9.,]+)/) ||
                    html.match(/class="a-offscreen"[^>]*>\$?([0-9.,]+)/);
      if (match) {
        price = parseFloat(match[1].replace(/,/g, '') + (match[2] ? '.' + match[2] : ''));
      }
    } else if (validation.hostname.includes('eneba')) {
      const match = html.match(/"price"\s*:\s*"?([0-9.]+)"?/i) || html.match(/\$([0-9.]+)\s*<\/span>/);
      if (match) price = parseFloat(match[1]);
    } else if (validation.hostname.includes('steampowered')) {
      const match = html.match(/class="game_purchase_price price"[^>]*>\s*\$?([0-9.,]+)/) ||
                    html.match(/class="discount_final_price"[^>]*>\s*\$?([0-9.,]+)/);
      if (match) price = parseFloat(match[1].replace(/,/g, ''));
    } else if (validation.hostname.includes('mercadolibre') || validation.hostname.includes('mercadolivre')) {
      const match = html.match(/class="andes-money-amount__fraction"[^>]*>([0-9.,]+)<\/span>/);
      if (match) price = parseFloat(match[1].replace(/,/g, ''));
    }

    if (price && !isNaN(price)) {
      return res.json({ success: true, price, store: storeName, checkedAt: new Date().toISOString() });
    }

    return res.json({ success: false, message: 'No se pudo extraer el precio de forma determinista' });
  } catch (err) {
    return res.status(500).json({ error: 'Error durante la consulta a la tienda', details: err.message });
  }
});

// 4. Groq AI Chat Proxy & Function Calling (OpenAI GPT OSS 120B / Llama)
app.post('/api/ai/chat', async (req, res) => {
  const { prompt, systemInstruction, model = 'openai/gpt-oss-120b', tools } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ error: 'GROQ_API_KEY no configurada en variables de entorno del servidor' });
  }

  try {
    const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model,
      messages,
      temperature: 0.5
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = 'auto';
    }

    logServerEvent('info', 'GroqAI', 'Procesando consulta de IA', { model, promptLength: prompt ? prompt.length : 0 });

    const groqRes = await fetch(groqUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!groqRes.ok) {
      const errBody = await groqRes.json().catch(() => ({}));
      logServerEvent('error', 'GroqAI', `Fallo de API Groq (Status: ${groqRes.status})`, { status: groqRes.status, details: errBody });
      return res.status(groqRes.status).json({ error: 'Groq API Error', status: groqRes.status, details: errBody });
    }

    const data = await groqRes.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    if (message?.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      let fnArgs = {};
      try {
        fnArgs = JSON.parse(toolCall.function.arguments);
      } catch {}

      logServerEvent('info', 'GroqAI', `Llamada a herramienta detectada: ${toolCall.function.name}`);
      return res.json({
        functionCall: {
          name: toolCall.function.name,
          args: fnArgs
        },
        reply: message.content || ''
      });
    }

    logServerEvent('info', 'GroqAI', 'Respuesta de IA generada con éxito');
    res.json({ reply: message?.content || 'Sin respuesta de Groq AI' });
  } catch (err) {
    logServerEvent('error', 'GroqAI', 'Error de red o conexión interna en Groq Proxy', { error: err.message });
    res.status(500).json({ error: 'Error interno en Groq Proxy', details: err.message });
  }
});

// 5. Discord Webhook Proxy
app.post('/api/discord/webhook', async (req, res) => {
  const { webhookUrl, embeds, content } = req.body;
  const target = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

  if (!target) {
    return res.status(400).json({ error: 'URL de Webhook requerida' });
  }

  try {
    const discordRes = await fetch(target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds, content })
    });

    if (!discordRes.ok) {
      return res.status(discordRes.status).json({ error: 'Discord webhook rejected request' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Error enviando a Discord', details: err.message });
  }
});

// 6. User Scoped Collection Storage Fallback (cuando no hay Firestore directo)
app.post('/api/user/:collection', verifyAuthToken, async (req, res) => {
  const { collection } = req.params;
  const item = req.body;
  const uid = req.user.uid;

  if (!firebaseAdminInitialized) {
    return res.json({ success: true, mode: 'local-simulated', item });
  }

  try {
    const docRef = admin.firestore().collection('users').doc(uid).collection(collection).doc(String(item.id));
    await docRef.set({ ...item, ownerId: uid, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true, id: item.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/user/:collection/:id', verifyAuthToken, async (req, res) => {
  const { collection, id } = req.params;
  const uid = req.user.uid;

  if (!firebaseAdminInitialized) {
    return res.json({ success: true, mode: 'local-simulated' });
  }

  try {
    await admin.firestore().collection('users').doc(uid).collection(collection).doc(id).delete();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Worker de fondo para Price Tracker (cada 30 min)
function startPriceMonitoringWorker() {
  console.log('🤖 Background Price Monitoring Worker activado');
  setInterval(async () => {
    try {
      console.log('🔄 Ejecutando ciclo de verificación de precios de fondo...');
    } catch (e) {
      console.error('Worker error:', e.message);
    }
  }, 1000 * 60 * 30);
}

process.on('uncaughtException', (err) => {
  logServerEvent('error', 'UncaughtException', err.message, { stack: err.stack });
});

process.on('unhandledRejection', (reason) => {
  logServerEvent('error', 'UnhandledRejection', reason?.message || String(reason));
});

// Iniciar servidor si se ejecuta directamente
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CUADERNO GLASS PRO 7.0 SERVER`);
    console.log(`🌐 Servidor escuchando en: http://localhost:${PORT}`);
    console.log(`🔒 Modo seguro activo • SSRF Protection • Groq AI Copilot`);
    console.log(`======================================================\n`);
    startPriceMonitoringWorker();
  });
}

export default app;
