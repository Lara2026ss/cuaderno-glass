/**
 * Cuaderno Glass Pro 4.0 — Backend Server & API Proxies
 */

const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 1. Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cuaderno-glass-pro',
    version: '4.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// 2. Gemini AI Chat Proxy
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, apiKey: userKey } = req.body;
    const apiKey = userKey || process.env.GEMINI_API_KEY;

    if (!prompt) {
      return res.status(400).json({ error: 'El prompt es requerido' });
    }

    if (!apiKey) {
      return res.status(400).json({
        error: 'Configura tu clave de API de Gemini en la configuración de la suite o mediante la variable de entorno GEMINI_API_KEY.'
      });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const apiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    if (!apiRes.ok) {
      const errJson = await apiRes.json().catch(() => ({}));
      return res.status(apiRes.status).json({
        error: errJson.error?.message || `Gemini API respondió con error ${apiRes.status}`
      });
    }

    const data = await apiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sin respuesta';
    res.json({ reply });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Discord Webhook Proxy
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

// 4. Render Services Proxy
app.get('/api/render/services', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const apiKey = authHeader ? authHeader.replace('Bearer ', '').trim() : process.env.RENDER_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Ingresa tu Render API Key en Ajustes o configura RENDER_API_KEY en variables de entorno'
      });
    }

    const renderRes = await fetch('https://api.render.com/v1/services?limit=20', {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (!renderRes.ok) {
      const text = await renderRes.text();
      return res.status(renderRes.status).json({ error: `Render API error ${renderRes.status}: ${text}` });
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

// 5. GitHub Repo Info Proxy
app.get('/api/github/repo', async (req, res) => {
  try {
    const repo = req.query.repo || 'Lara2026ss/cuaderno-glass';
    const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'Cuaderno-Glass-App' };
    if (process.env.GITHUB_PAT) {
      headers['Authorization'] = `token ${process.env.GITHUB_PAT}`;
    }

    const ghRes = await fetch(`https://api.github.com/repos/${repo}`, { headers });
    if (!ghRes.ok) {
      return res.status(ghRes.status).json({ error: `GitHub API error ${ghRes.status}` });
    }

    const data = await ghRes.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Price Scraper / Check Proxy
app.get('/api/price-tracker/check', async (req, res) => {
  try {
    const { url, store } = req.query;
    if (!url) {
      return res.status(400).json({ error: 'Parámetro URL requerido' });
    }

    // Proxy seguro para consultar headers y disponibilidad
    const fetchRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!fetchRes.ok) {
      return res.json({ available: false, status: fetchRes.status });
    }

    const html = await fetchRes.text();
    let detectedPrice = null;

    // Extractor básico de microdatos / JSON-LD / meta tags
    const priceMatch = html.match(/"price"\s*:\s*"*([0-9]+(?:\.[0-9]{2})?)"*/i) ||
                       html.match(/itemprop=["']price["']\s+content=["']([0-9]+(?:\.[0-9]{2})?)["']/i) ||
                       html.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>\$?([0-9]+(?:\.[0-9]{2})?)<\/span>/i);

    if (priceMatch && priceMatch[1]) {
      detectedPrice = parseFloat(priceMatch[1]);
    }

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

// Fallback a index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Cuaderno Glass Pro 4.0 activo en http://localhost:${PORT}`);
});
