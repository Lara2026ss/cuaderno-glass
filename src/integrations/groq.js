/**
 * Cuaderno Glass Pro 6.0 — Groq AI Copilot (Llama 3.3 70B & Function Calling)
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';
import { events } from '../app/events.js';
import { priceTracker } from './price-tracker.js';

export const GROQ_DEFAULT_API_KEY = '';
export const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export const GROQ_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'createTask',
      description: 'Crea una nueva tarea en el panel de productividad',
      parameters: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Descripción clara de la tarea' },
          category: { type: 'string', enum: ['Trabajo', 'Personal', 'Estudio', 'Ideas'], description: 'Categoría de la tarea' },
          priority: { type: 'string', enum: ['alta', 'media', 'baja'], description: 'Nivel de prioridad' }
        },
        required: ['text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'listTasks',
      description: 'Obtiene las tareas actuales con filtros opcionales por categoría',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Categoría opcional para filtrar' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'createDocument',
      description: 'Crea y guarda un nuevo documento o apunte en formato Markdown',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Título del documento' },
          category: { type: 'string', description: 'Categoría temática' },
          body: { type: 'string', description: 'Cuerpo del documento en formato Markdown' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Etiquetas clave' }
        },
        required: ['title', 'body']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'addTrackerItem',
      description: 'Añade un producto al rastreador de precios multitienda (Amazon, Eneba, Mercado Libre, Steam)',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Nombre o título del producto' },
          url: { type: 'string', description: 'URL de la tienda' },
          targetPrice: { type: 'number', description: 'Precio objetivo para recibir alerta' },
          currentPrice: { type: 'number', description: 'Precio actual del producto' },
          normalPrice: { type: 'number', description: 'Precio habitual sin descuento' }
        },
        required: ['name', 'url']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTodaySummary',
      description: 'Obtiene un resumen estructurado del día: tareas pendientes, documentos recientes y alertas de ofertas',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchDocuments',
      description: 'Busca documentos y notas por palabra clave o etiqueta',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Término de búsqueda o etiqueta' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'updateDocument',
      description: 'Actualiza el contenido o título de un documento existente',
      parameters: {
        type: 'object',
        properties: {
          docId: { type: 'string', description: 'ID del documento' },
          title: { type: 'string', description: 'Nuevo título opcional' },
          body: { type: 'string', description: 'Nuevo contenido Markdown opcional' }
        },
        required: ['docId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'deleteDocument',
      description: 'Elimina un documento de la suite (requiere confirmación explícita)',
      parameters: {
        type: 'object',
        properties: {
          docId: { type: 'string', description: 'ID del documento a eliminar' },
          confirmed: { type: 'boolean', description: 'Debe ser true para ejecutar la eliminación' }
        },
        required: ['docId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchDrive',
      description: 'Busca archivos en Google Drive del usuario conectado',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Nombre del archivo o término de búsqueda en Drive' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getActiveDeals',
      description: 'Obtiene la lista de productos con mejores ofertas o descuentos activos en el Price Tracker',
      parameters: { type: 'object', properties: {} }
    }
  }
];

export class GroqAIProvider {
  constructor() {
    this.id = 'groq';
    this.providerName = 'Groq Llama 3.3 70B';
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
    logger.info('GroqAI', `Ejecutando herramienta: ${toolName}`, args);

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
          success: true,
          message: `Resumen generado: ${pending.length} tareas pendientes, ${completed.length} completadas, ${docs.length} documentos y ${trackers.length} ofertas`,
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
    const systemInstruction = `Eres Groq AI Copilot (potenciado por Llama 3.3 70B), el asistente inteligente de la suite personal Cuaderno Glass Pro 6.0. 
Tienes acceso a herramientas para crear tareas, documentos y rastreadores de precios. Si el usuario te pide crear, buscar o gestionar algo, usa las herramientas correspondientes.`;

    const apiKey = store.get('settings.groqApiKey') || GROQ_DEFAULT_API_KEY;
    const model = store.get('settings.groqModel') || GROQ_DEFAULT_MODEL;

    try {
      // 1. Intentar llamar al backend proxy /api/ai/chat
      let backendSuccess = false;
      let reply = '';

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userPrompt.trim(),
            systemInstruction: `${systemInstruction}\n\n${context}`,
            model,
            tools: GROQ_TOOLS
          })
        });

        if (res.ok) {
          const data = await res.json();
          backendSuccess = true;

          // Si Groq solicitó function calling
          if (data.functionCall) {
            if (onStateChange) onStateChange('calling_tool');
            const toolResult = await this.executeTool(data.functionCall.name, data.functionCall.args);
            if (data.functionCall.name === 'getTodaySummary') {
              reply = `📊 **Resumen de tu Suite:**\n- Tareas pendientes: **${toolResult.pendingTasksCount}**\n- Tareas completadas: **${toolResult.completedTasksCount}**\n- Documentos: **${toolResult.documentsCount}**\n- Ofertas en seguimiento: **${toolResult.activeTrackersCount}**\n\n${data.reply || ''}`.trim();
            } else {
              reply = `⚡ **Acción ejecutada:** ${toolResult.message || 'Operación completada'}\n\n${data.reply || ''}`.trim();
            }
          } else {
            reply = data.reply || data.text || 'Respuesta completada.';
          }
        }
      } catch (backendErr) {
        logger.debug('GroqAI', 'Backend AI endpoint no disponible, conectando vía API directa', { error: backendErr.message });
      }

      // 2. Si backend no respondió y hay apiKey en frontend
      if (!backendSuccess && apiKey) {
        const groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
        const res = await fetch(groqUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: `${systemInstruction}\n\n${context}` },
              { role: 'user', content: userPrompt.trim() }
            ],
            tools: GROQ_TOOLS,
            tool_choice: 'auto',
            temperature: 0.5
          })
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Groq API error (${res.status})`);
        }

        const data = await res.json();
        const choice = data.choices?.[0];
        const message = choice?.message;

        if (message?.tool_calls && message.tool_calls.length > 0) {
          const toolCall = message.tool_calls[0];
          const fnName = toolCall.function.name;
          let fnArgs = {};
          try {
            fnArgs = JSON.parse(toolCall.function.arguments);
          } catch {}

          if (onStateChange) onStateChange('calling_tool');
          const toolResult = await this.executeTool(fnName, fnArgs);
          if (fnName === 'getTodaySummary') {
            reply = `📊 **Resumen de tu Suite:**\n- Tareas pendientes: **${toolResult.pendingTasksCount}**\n- Tareas completadas: **${toolResult.completedTasksCount}**\n- Documentos: **${toolResult.documentsCount}**\n- Ofertas en seguimiento: **${toolResult.activeTrackersCount}**\n\n${message.content || ''}`.trim();
          } else {
            reply = `⚡ **Acción ejecutada:** ${toolResult.message || 'Operación completada'}\n\n${message.content || ''}`.trim();
          }
        } else {
          reply = message?.content || 'Respuesta generada por Groq Copilot.';
        }
      } else if (!backendSuccess) {
        // Fallback local sin conexión
        reply = await this._generateLocalAssistantReply(userPrompt);
      }

      if (onStateChange) onStateChange('success');
      store.set('connections.groq.lastPrompt', new Date().toISOString());
      registry.setStatus('groq', 'connected');
      registry.setStatus('gemini', 'connected');
      return reply;
    } catch (err) {
      if (onStateChange) onStateChange('error');
      logger.error('GroqAI', 'Error en Groq Copilot', { error: err.message });
      registry.setStatus('groq', 'error', err.message);
      
      // Si falla llamada de red, devolver respuesta inteligente local
      return await this._generateLocalAssistantReply(userPrompt);
    }
  }

  async _generateLocalAssistantReply(prompt) {
    const lower = prompt.toLowerCase();
    
    if (lower.startsWith('crear tarea') || lower.startsWith('añadir tarea') || lower.startsWith('agregar tarea')) {
      const text = prompt.replace(/^(crear|añadir|agregar)\s+tarea\s*:?/i, '').trim();
      if (text) {
        await this.executeTool('createTask', { text, category: 'Trabajo', priority: 'media' });
        return `✅ He creado la tarea: **"${text}"** en tu panel de control.`;
      }
    }

    if (lower.includes('resumen') || lower.includes('qué tengo') || lower.includes('que tengo')) {
      const summary = await this.executeTool('getTodaySummary');
      return `📊 **Resumen de tu Suite:**\n- Tareas pendientes: **${summary.pendingTasksCount}**\n- Tareas completadas: **${summary.completedTasksCount}**\n- Documentos: **${summary.documentsCount}**\n- Ofertas en seguimiento: **${summary.activeTrackersCount}**`;
    }

    return `⚡ **Groq Copilot:** He recibido tu mensaje: *"${prompt}"*.\n\nEstoy listo para ayudarte a crear tareas, redactar notas y organizar tus documentos en Cuaderno Glass Pro 6.0.`;
  }
}

export const groqProvider = new GroqAIProvider();
export const geminiProvider = groqProvider;
export const GEMINI_TOOLS = GROQ_TOOLS;
