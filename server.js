/**
 * Cuaderno Glass Pro 4.0 — Backend Server & Secure API Architecture
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

let admin = null;
let firestoreDb = null;

// 1. Inicialización Segura de Firebase Admin SDK (Exclusivo de Backend)
try {
  admin = require('firebase-admin');
  
  const storageDir = path.resolve(__dirname, '..', 'windows-doc', 'storage');
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH)) {
    serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf-8'));
  } else if (fs.existsSync(storageDir)) {
    // Buscar dinámicamente cualquier archivo de credencial en storage sin hardcodear nombres
    const files = fs.readdirSync(storageDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const parsed = JSON.parse(fs.readFileSync(path.join(storageDir, file), 'utf-8'));
        if (parsed && parsed.type === 'service_account' && parsed.private_key) {
          serviceAccount = parsed;
          break;
        }
      } catch (e) {}
    }
  }

  if (serviceAccount) {
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firestoreDb = admin.firestore();
    console.log('🔥 Firebase Admin SDK inicializado exitosamente en el backend');
  } else {
    console.warn('⚠️ No se encontró service account de Firebase Admin. Endpoints backend operarán en modo degradado.');
  }
} catch (err) {
  console.warn('⚠️ Firebase Admin no disponible:', err.message);
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Middleware de Autenticación con Token de Firebase
async function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autorización ausente o inválido' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  if (!admin || !admin.auth) {
    return res.status(503).json({ error: 'Servicio de autenticación backend no inicializado' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      name: decodedToken.name || '',
      picture: decodedToken.picture || ''
    };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token de sesión expirado o no válido: ' + err.message });
  }
}

// -------------------------------------------------------------
// ENDPOINTS PÚBLICOS
// -------------------------------------------------------------

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cuaderno-glass-pro',
    version: '4.0.0',
    firebaseAdmin: !!firestoreDb,
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Firebase Public Web Config (FASE 3 — Cero Secretos)
app.get('/api/firebase/config', (req, res) => {
  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID || 'alero-company-works',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'alero-company-works.firebaseapp.com',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'alero-company-works.appspot.com',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '117099384718',
    apiKey: process.env.FIREBASE_API_KEY || '',
    appId: process.env.FIREBASE_APP_ID || ''
  });
});

// -------------------------------------------------------------
// ENDPOINTS PROTEGIDOS POR USUARIO (FASE 7 — FIRESTORE SCOPED)
// -------------------------------------------------------------

function createScopedCollectionEndpoints(collectionName) {
  // GET all items
  app.get(`/api/user/${collectionName}`, authenticateUser, async (req, res) => {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore no configurado en backend' });
    try {
      const snapshot = await firestoreDb.collection('users').doc(req.user.uid).collection(collectionName).get();
      const items = [];
      snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      res.json({ items });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST create / update item
  app.post(`/api/user/${collectionName}`, authenticateUser, async (req, res) => {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore no configurado en backend' });
    try {
      const item = req.body;
      if (!item || !item.id) {
        return res.status(400).json({ error: 'El item debe tener un campo "id"' });
      }

      const docRef = firestoreDb.collection('users').doc(req.user.uid).collection(collectionName).doc(String(item.id));
      const payload = {
        ...item,
        ownerId: req.user.uid,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await docRef.set(payload, { merge: true });
      res.json({ success: true, item: payload });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // PATCH partial update
  app.patch(`/api/user/${collectionName}/:id`, authenticateUser, async (req, res) => {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore no configurado en backend' });
    try {
      const { id } = req.params;
      const updates = req.body;

      const docRef = firestoreDb.collection('users').doc(req.user.uid).collection(collectionName).doc(id);
      await docRef.update({
        ...updates,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // DELETE item
  app.delete(`/api/user/${collectionName}/:id`, authenticateUser, async (req, res) => {
    if (!firestoreDb) return res.status(503).json({ error: 'Firestore no configurado en backend' });
    try {
      const { id } = req.params;
      await firestoreDb.collection('users').doc(req.user.uid).collection(collectionName).doc(id).delete();
      res.json({ success: true, id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}

createScopedCollectionEndpoints('tasks');
createScopedCollectionEndpoints('notes');
createScopedCollectionEndpoints('documents');
createScopedCollectionEndpoints('price-trackers');

// -------------------------------------------------------------
// PROXIES DE INTEGRACIONES & AI
// -------------------------------------------------------------

// AI Chat Proxy
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, apiKey: userKey } = req.body;
    const apiKey = userKey || process.env.GEMINI_API_KEY;

    if (!prompt) return res.status(400).json({ error: 'El prompt es requerido' });
    if (!apiKey) return res.status(400).json({ error: 'Configura GEMINI_API_KEY en variables de entorno o Ajustes.' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      return res.status(apiRes.status).json({ error: errJson.error?.message || `Error ${apiRes.status}` });
    }

    const data = await apiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Discord Webhook Proxy
app.post('/api/discord/webhook', async (req, res) => {
  try {
    const { webhookUrl, payload } = req.body;
    const targetUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL;

    if (!targetUrl || !targetUrl.startsWith('https://discord.com/api/webhooks/')) {
      return res.status(400).json({ error: 'URL de Webhook de Discord inválida o ausente' });
    }

    const discordRes = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (discordRes.ok || discordRes.status === 204) {
      res.json({ success: true });
    } else {
      const text = await discordRes.text();
      res.status(discordRes.status).json({ error: `Discord API error: ${text}` });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Render Services Proxy
app.get('/api/render/services', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader ? authHeader.replace('Bearer ', '').trim() : process.env.RENDER_API_KEY;

    if (!apiKey) return res.status(400).json({ error: 'RENDER_API_KEY no configurada' });

    const renderRes = await fetch('https://api.render.com/v1/services?limit=20', {
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    });

    if (!renderRes.ok) {
      const text = await renderRes.text();
      return res.status(renderRes.status).json({ error: `Render API error: ${text}` });
    }

    const data = await renderRes.json();
    const formatted = data.map(item => ({
      id: item.service?.id || item.id,
      name: item.service?.name || item.name,
      type: item.service?.type || item.type,
      status: item.service?.status || item.status,
      updatedAt: item.service?.updatedAt || item.updatedAt
    }));

    res.json({ services: formatted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GitHub Proxy
app.get('/api/github/repo', async (req, res) => {
  try {
    const repo = req.query.repo || 'Lara2026ss/cuaderno-glass';
    const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Cuaderno-Glass-App' };
    if (process.env.GITHUB_PAT) headers['Authorization'] = `token ${process.env.GITHUB_PAT}`;

    const ghRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!ghRes.ok) return res.status(ghRes.status).json({ error: `GitHub API error ${ghRes.status}` });

    const data = await ghRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Price Scraper Proxy
app.get('/api/price-tracker/check', async (req, res) => {
  try {
    const { url, store } = req.query;
    if (!url) return res.status(400).json({ error: 'Parámetro URL requerido' });

    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!fetchRes.ok) return res.json({ available: false, status: fetchRes.status });

    const html = await fetchRes.text();
    let detectedPrice = null;

    const priceMatch = html.match(/"price"\s*:\s*"*([0-9]+(?:\.[0-9]{2})?)"*/i) ||
                       html.match(/itemprop=["']price["']\s+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ||
                       html.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>\$?([0-9]+(?:\.[0-9]{2})?)<\/span>/i);

    if (priceMatch && priceMatch[1]) detectedPrice = parseFloat(priceMatch[1]);

    res.json({
      available: true,
      price: detectedPrice,
      url,
      store,
      checkedAt: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback estático a index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Cuaderno Glass Pro 4.0 activo en http://localhost:${PORT}`);
});
