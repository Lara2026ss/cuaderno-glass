const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Health check endpoint para Render
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'cuaderno-glass',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Fallback a index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✨ Cuaderno Glass activo en http://localhost:${PORT}`);
});
