/**
 * Cuaderno Glass Pro 5.0 — Gemini AI Copilot con Function Calling Seguro & Context Router
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';
import { events } from '../app/events.js';
import { priceTracker } from './price-tracker.js';

export const GEMINI_TOOLS = [
  {
    name: 'createTask',
    description: 'Crea una nueva tarea en el panel de productividad',
    parameters: {
      type: 'OBJECT',
      properties: {
        text: { type: 'STRING', description: 'Descripción clara de la tarea' },
        category: { type: 'STRING', enum: ['Trabajo', 'Personal', 'Estudio', 'Ideas'], description: 'Categoría de la tarea' },
        priority: { type: 'STRING', enum: ['alta', 'media', 'baja'], description: 'Nivel de prioridad' }
      },
      required: ['text']
    }
  },
  {
    name: 'listTasks',
    description: 'Obtiene las tareas actuales con filtros opcionales',
    parameters: {
      type: 'OBJECT',
      properties: {
        category: { type: 'STRING', description: 'Categoría opcional para filtrar' }
      }
    }
  },
  {
    name: 'createDocument',
    description: 'Crea y guarda un nuevo documento o apunte en formato Markdown',
    parameters: {
      type: 'OBJECT',
      properties: {
        title: { type: 'STRING', description: 'Título del documento' },
        category: { type: 'STRING', description: 'Categoría temática' },
        body: { type: 'STRING', description: 'Cuerpo del documento en formato Markdown' },
        tags: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Etiquetas clave' }
      },
      required: ['title', 'body']
    }
  },
  {
    name: 'addTrackerItem',
    description: 'Añade un producto al rastreador de precios multitienda (Amazon, Eneba, Mercado Libre, Steam)',
    parameters: {
      type: 'OBJECT',
      properties: {
        name: { type: 'STRING', description: 'Nombre o título del producto' },
        url: { type: 'STRING', description: 'URL de la tienda' },
        targetPrice: { type: 'NUMBER', description: 'Precio objetivo para recibir alerta' },
        currentPrice: { type: 'NUMBER', description: 'Precio actual del producto' },
        normalPrice: { type: 'NUMBER', description: 'Precio habitual sin descuento' }
      },
      required: ['name', 'url']
    }
  },
  {
    name: 'getTodaySummary',
    description: 'Obtiene un resumen estructurado del día: tareas pendientes, documentos recientes y alertas de ofertas',
    parameters: { type: 'OBJECT', properties: {} }
  },
  {
    name: 'searchDocuments',
    description: 'Busca documentos y notas por palabra clave o etiqueta',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Término de búsqueda o etiqueta' }
      },
      required: ['query']
    }
  },
  {
    name: 'updateDocument',
    description: 'Actualiza el contenido o título de un documento existente',
    parameters: {
      type: 'OBJECT',
      properties: {
        docId: { type: 'STRING', description: 'ID del documento' },
        title: { type: 'STRING', description: 'Nuevo título opcional' },
        body: { type: 'STRING', description: 'Nuevo contenido Markdown opcional' }
      },
      required: ['docId']
    }
  },
  {
    name: 'deleteDocument',
    description: 'Elimina un documento de la suite (requiere confirmación explícita)',
    parameters: {
      type: 'OBJECT',
      properties: {
        docId: { type: 'STRING', description: 'ID del documento a eliminar' },
        confirmed: { type: 'BOOLEAN', description: 'Debe ser true para ejecutar la eliminación' }
      },
      required: ['docId']
    }
  },
  {
    name: 'searchDrive',
    description: 'Busca archivos en Google Drive del usuario conectado',
    parameters: {
      type: 'OBJECT',
      properties: {
        query: { type: 'STRING', description: 'Nombre del archivo o término de búsqueda en Drive' }
      }
    }
  },
  {
    name: 'getActiveDeals',
    description: 'Obtiene la lista de productos con mejores ofertas o descuentos activos en el Price Tracker',
    parameters: { type: 'OBJECT', properties: {} }
  }
];

export class GeminiAIProvider {
  constructor() {
    this.id = 'gemini';
    this.providerName = 'Google Gemini 1.5 Flash';
  }

  buildCompactContext() {
    const tasks = store.get('tasks', []);
    const pendingTasks = tasks.filter(t => !t.done && !t.completed).map(t => `- [${t.priority || 'media'}] ${t.text} (${t.category || 'General'})`).slice(0, 8);
    const docs = store.get('documents', []).map(d => `- "${d.title}" [${d.category || 'General'}]`).slice(0, 5);
    const trackers = store.get('priceTrackers', []).map(tr => `- ${tr.productName} (${tr.store}): $${tr.currentPrice} (Meta: $${tr.targetPrice})`).slice(0, 5);

    return `
[ESTADO ACTUAL DE LA SUITE DEL USUARIO]
- Tareas Pendientes (${pendingTasks.length}):\n${pendingTasks.join('\n') || 'Ninguna'}
- Documentos Guardados (${docs.length}):\n${docs.join('\n') || 'Ninguno'}
- Productos en Monitoreo (${trackers.length}):\n${trackers.join('\n') || 'Ninguno'}
`;
  }

  async executeTool(toolName, args = {}) {
    logger.info('GeminiAI', `Ejecutando herramienta: ${toolName}`, args);

    switch (toolName) {
      case 'createTask': {
        const tasks = store.get('tasks', []);
        const newTask = {
          id: Date.now() + Math.random().toString(36).substring(2, 6),
          text: args.text,
          category: args.category || 'Trabajo',
          priority: args.priority || 'media',
          done: false,
          completed: false,
          date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
          createdAt: Date.now()
        };
        tasks.unshift(newTask);
        store.set('tasks', tasks);
        events.emit('tasks:updated', tasks);
        return { success: true, message: `Tarea "${newTask.text}" creada exitosamente con prioridad ${newTask.priority}`, task: newTask };
      }

      case 'listTasks': {
        let tasks = store.get('tasks', []);
        if (args.category && args.category !== 'all') {
          tasks = tasks.filter(t => t.category.toLowerCase() === args.category.toLowerCase());
        }
        return { success: true, count: tasks.length, tasks };
      }

      case 'createDocument': {
        const docs = store.get('documents', []);
        const now = Date.now();
        const newDoc = {
          id: now + Math.random().toString(36).substring(2, 6),
          title: args.title,
          category: args.category || 'General',
          tags: Array.isArray(args.tags) ? args.tags : [],
          body: args.body,
          syncStatus: 'LOCAL_ONLY',
          createdAt: now,
          updatedAt: now,
          localModifiedTime: now
        };
        docs.unshift(newDoc);
        store.set('documents', docs);
        events.emit('documents:updated', docs);
        return { success: true, message: `Documento "${newDoc.title}" guardado en la suite`, doc: newDoc };
      }

      case 'addTrackerItem': {
        const item = priceTracker.createTrackerItem({
          name: args.name,
          url: args.url,
          targetPrice: args.targetPrice,
          currentPrice: args.currentPrice || args.normalPrice || 0,
          normalPrice: args.normalPrice || args.currentPrice || 0
        });
        return { success: true, message: `Producto "${item.productName}" añadido al rastreador de ofertas`, item };
      }

      case 'getTodaySummary': {
        const tasks = store.get('tasks', []);
        const pending = tasks.filter(t => !t.done && !t.completed);
        const completed = tasks.filter(t => t.done || t.completed);
        const trackers = store.get('priceTrackers', []);
        const docs = store.get('documents', []);

        return {
          pendingTasksCount: pending.length,
          completedTasksCount: completed.length,
          activeTrackersCount: trackers.length,
          documentsCount: docs.length,
          topPriorities: pending.slice(0, 3)
        };
      }

      case 'searchDocuments': {
        const query = (args.query || '').toLowerCase();
        const docs = store.get('documents', []);
        const matches = docs.filter(d => 
          (d.title && d.title.toLowerCase().includes(query)) ||
          (d.body && d.body.toLowerCase().includes(query)) ||
          (Array.isArray(d.tags) && d.tags.some(t => t.toLowerCase().includes(query)))
        );
        return { success: true, count: matches.length, matches: matches.slice(0, 5) };
      }

      case 'updateDocument': {
        const docs = store.get('documents', []);
        const idx = docs.findIndex(d => d.id === args.docId);
        if (idx === -1) return { success: false, message: `Documento con ID ${args.docId} no encontrado` };
        if (args.title) docs[idx].title = args.title;
        if (args.body) docs[idx].body = args.body;
        docs[idx].updatedAt = Date.now();
        store.set('documents', docs);
        events.emit('documents:updated', docs);
        return { success: true, message: `Documento "${docs[idx].title}" actualizado con éxito`, doc: docs[idx] };
      }

      case 'deleteDocument': {
        if (!args.confirmed) {
          return {
            success: false,
            requiresConfirmation: true,
            message: `⚠️ ¿Confirmas la eliminación definitiva del documento ID ${args.docId}?`
          };
        }
        let docs = store.get('documents', []);
        const target = docs.find(d => d.id === args.docId);
        docs = docs.filter(d => d.id !== args.docId);
        store.set('documents', docs);
        events.emit('documents:updated', docs);
        return { success: true, message: `Documento "${target?.title || args.docId}" eliminado con éxito` };
      }

      case 'searchDrive': {
        try {
          const { googleDriveAdapter } = await import('./google-drive.js');
          const files = await googleDriveAdapter.listFiles(10);
          const q = (args.query || '').toLowerCase();
          const filtered = q ? files.filter(f => f.name.toLowerCase().includes(q)) : files;
          return { success: true, count: filtered.length, files: filtered };
        } catch (driveErr) {
          return { success: false, message: `No se pudo consultar Google Drive: ${driveErr.message}` };
        }
      }

      case 'getActiveDeals': {
        const trackers = store.get('priceTrackers', []);
        const deals = trackers.filter(t => t.discountPercent > 0 || t.status === 'TARGET_REACHED');
        return { success: true, count: deals.length, deals };
      }

      default:
        throw new Error(`Herramienta desconocida: ${toolName}`);
    }
  }

  async generateResponse(userPrompt, onStateChange = null) {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('El mensaje no puede estar vacío');
    }

    if (onStateChange) onStateChange('thinking');

    const context = this.buildCompactContext();
    const systemInstruction = `Eres Gemini Copilot, el asistente inteligente de la suite personal Cuaderno Glass Pro 5.0. 
Tienes acceso a herramientas para crear tareas, documentos y rastreadores de precios. Si el usuario te pide crear, buscar o gestionar algo, usa las herramientas correspondientes.`;

    const fullPrompt = `${systemInstruction}\n\n${context}\n\n[CONSULTA DEL USUARIO]\n${userPrompt.trim()}`;
    const apiKey = store.get('settings.geminiApiKey', '');

    try {
      // 1. Intentar llamar al backend proxy /api/ai/chat
      let backendSuccess = false;
      let reply = '';

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: fullPrompt, tools: GEMINI_TOOLS })
        });

        if (res.ok) {
          const data = await res.json();
          backendSuccess = true;

          // Si Gemini solicitó function calling
          if (data.functionCall) {
            if (onStateChange) onStateChange('calling_tool');
            const toolResult = await this.executeTool(data.functionCall.name, data.functionCall.args);
            reply = `✨ **Acción ejecutada:** ${toolResult.message || 'Operación completada'}\n\n${data.reply || ''}`;
          } else {
            reply = data.reply || data.text || 'Sin respuesta';
          }
        }
      } catch (backendErr) {
        logger.debug('GeminiAI', 'Backend AI endpoint no disponible, procesando localmente', { error: backendErr.message });
      }

      // 2. Si backend no respondió y hay apiKey en frontend
      if (!backendSuccess && apiKey) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: fullPrompt }] }]
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Gemini API error (${res.status})`);
        }

        const data = await res.json();
        reply = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Respuesta recibida';
      } else if (!backendSuccess) {
        // Modo inteligente offline / fallback si no hay API key
        reply = await this._generateLocalAssistantReply(userPrompt);
      }

      if (onStateChange) onStateChange('success');
      store.set('connections.gemini.lastPrompt', new Date().toISOString());
      registry.setStatus('gemini', 'connected');
      return reply;
    } catch (err) {
      if (onStateChange) onStateChange('error');
      logger.error('GeminiAI', 'Error en Gemini Copilot', { error: err.message });
      registry.setStatus('gemini', 'error', err.message);
      throw err;
    }
  }

  async _generateLocalAssistantReply(prompt) {
    const lower = prompt.toLowerCase();
    
    // Detección de comandos de acción en lenguaje natural
    if (lower.startsWith('crear tarea') || lower.startsWith('añadir tarea') || lower.startsWith('agregar tarea')) {
      const text = prompt.replace(/^(crear|añadir|agregar)\s+tarea\s*:?/i, '').trim();
      if (text) {
        await this.executeTool('createTask', { text, category: 'Trabajo', priority: 'media' });
        return `✅ He creado la tarea: **"${text}"** en tu panel.`;
      }
    }

    if (lower.includes('resumen') || lower.includes('qué tengo') || lower.includes('que tengo')) {
      const summary = await this.executeTool('getTodaySummary');
      return `📊 **Resumen de tu Suite:**\n- Tareas pendientes: **${summary.pendingTasksCount}**\n- Tareas completadas: **${summary.completedTasksCount}**\n- Documentos: **${summary.documentsCount}**\n- Ofertas en seguimiento: **${summary.activeTrackersCount}**`;
    }

    return `✨ Recibí tu consulta: *"${prompt}"*.\n\nPara activar el modelo Gemini 1.5 Flash completo en tiempo real, puedes configurar tu **Gemini API Key** en la ventana de **⚙️ Configuración**. Mientras tanto, puedo ayudarte a crear tareas, redactar apuntes y consultar métricas de tu suite.`;
  }
}

export const geminiProvider = new GeminiAIProvider();
