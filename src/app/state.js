/**
 * Cuaderno Glass Pro 4.0 — Estado Central y Persistencia
 */

import { events } from './events.js';
import { logger } from './logger.js';

export const DATA_VERSION = 4;

const STORAGE_KEY = 'cuaderno_glass_v4_state';
const OFFLINE_QUEUE_KEY = 'cuaderno_glass_offline_queue';

export class AppStore {
  constructor() {
    this.state = this._getInitialState();
    this.offlineQueue = [];
    this._load();
  }

  _getInitialState() {
    return {
      version: DATA_VERSION,
      session: {
        isAuthenticated: false,
        lastActive: Date.now()
      },
      user: null, // { uid, displayName, email, photoURL, isAnonymous }
      tasks: [],
      notes: [],
      documents: [],
      priceTrackers: [],
      deals: [],
      connections: {
        firebase: { status: 'disconnected', lastSync: null, error: null },
        googleDrive: { status: 'disconnected', lastSync: null, email: null, error: null },
        github: { status: 'disconnected', repo: 'Lara2026ss/cuaderno-glass', lastSync: null, error: null },
        discord: { status: 'disconnected', webhookConfigured: false, lastDispatch: null, error: null },
        render: { status: 'disconnected', services: [], lastCheck: null, error: null },
        gemini: { status: 'ready', model: 'gemini-1.5-flash', lastPrompt: null, error: null }
      },
      settings: {
        theme: 'dark',
        audioEnabled: true,
        audioVolume: 0.5,
        notificationsEnabled: false,
        priceCheckIntervalMins: 30,
        googleClientId: '',
        discordWebhookUrl: '',
        firebaseConfig: null,
        githubRepo: 'Lara2026ss/cuaderno-glass',
        renderApiKey: '',
        geminiApiKey: ''
      },
      pomodoro: {
        mode: 'work', // 'work', 'shortBreak', 'longBreak'
        remainingSeconds: 25 * 60,
        isRunning: false,
        sessionsCompleted: 0
      },
      sync: {
        isOnline: navigator ? navigator.onLine : true,
        isSyncing: false,
        pendingMutations: 0,
        lastCloudSync: null
      }
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.state = this._migrate(parsed);
      } else {
        // Intentar rescatar datos de versiones anteriores
        this._migrateLegacyStorage();
      }

      const rawQueue = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (rawQueue) {
        try {
          this.offlineQueue = JSON.parse(rawQueue);
        } catch {
          this.offlineQueue = [];
        }
        this.state.sync.pendingMutations = this.offlineQueue.length;
      }
    } catch (err) {
      logger.error('AppStore', 'Error cargando estado local, reiniciando por seguridad', { error: err.message });
      this.state = this._getInitialState();
    }
  }

  _migrateLegacyStorage() {
    const safeParse = (raw, fallback) => {
      if (!raw || typeof raw !== 'string') return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        // Si no es JSON válido (ej: texto plano 'dark' o 'light'), retornar string crudo si fallback es string
        return typeof fallback === 'string' ? raw : fallback;
      }
    };

    try {
      const oldTasks = localStorage.getItem('cuaderno_pro_tasks');
      const oldNotes = localStorage.getItem('cuaderno_pro_notes');
      const oldDocs = localStorage.getItem('cuaderno_pro_docs');
      const oldTheme = localStorage.getItem('cuaderno_pro_theme');

      if (oldTasks) {
        const parsed = safeParse(oldTasks, []);
        if (Array.isArray(parsed)) this.state.tasks = parsed;
      }
      if (oldNotes) {
        const parsed = safeParse(oldNotes, []);
        if (Array.isArray(parsed)) this.state.notes = parsed;
      }
      if (oldDocs) {
        const parsed = safeParse(oldDocs, []);
        if (Array.isArray(parsed)) this.state.documents = parsed;
      }
      if (oldTheme) {
        const parsedTheme = safeParse(oldTheme, 'dark');
        this.state.settings.theme = (typeof parsedTheme === 'string' && parsedTheme) ? parsedTheme : 'dark';
      }

      logger.info('AppStore', 'Datos de versiones anteriores migrados exitosamente a v4');
      this.save();
    } catch (e) {
      logger.warn('AppStore', 'No se pudieron migrar datos legacy', { error: e.message });
    }
  }

  _migrate(data) {
    if (!data || typeof data !== 'object') return this._getInitialState();
    
    let current = { ...data };
    const version = current.version || 1;

    if (version < 2) {
      current.priceTrackers = current.priceTrackers || [];
      current.deals = current.deals || [];
    }
    if (version < 3) {
      current.connections = current.connections || this._getInitialState().connections;
    }
    if (version < 4) {
      current.sync = this._getInitialState().sync;
      current.version = 4;
    }

    // Merge con initial para asegurar que nuevas llaves existan
    const initial = this._getInitialState();
    return {
      ...initial,
      ...current,
      connections: { ...initial.connections, ...(current.connections || {}) },
      settings: { ...initial.settings, ...(current.settings || {}) },
      sync: { ...initial.sync, ...(current.sync || {}) }
    };
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      logger.error('AppStore', 'Error al persistir en localStorage', { error: err.message });
    }
  }

  get(path, fallback = undefined) {
    const keys = path.split('.');
    let curr = this.state;
    for (const key of keys) {
      if (curr === null || curr === undefined) return fallback;
      curr = curr[key];
    }
    return curr !== undefined ? curr : fallback;
  }

  set(path, value, { skipSave = false, emitEvent = true } = {}) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let curr = this.state;
    
    for (const key of keys) {
      if (!curr[key] || typeof curr[key] !== 'object') {
        curr[key] = {};
      }
      curr = curr[key];
    }

    curr[lastKey] = value;

    if (!skipSave) this.save();
    if (emitEvent) {
      events.emit('state:change', { path, value });
      events.emit(`state:${path}`, value);
    }
  }

  // Cola de cambios offline
  enqueueMutation(mutation) {
    const item = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp: Date.now(),
      ...mutation
    };
    this.offlineQueue.push(item);
    this.state.sync.pendingMutations = this.offlineQueue.length;
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    events.emit('sync:queue-updated', this.offlineQueue);
    this.save();
    return item;
  }

  dequeueMutation(id) {
    this.offlineQueue = this.offlineQueue.filter(m => m.id !== id);
    this.state.sync.pendingMutations = this.offlineQueue.length;
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    events.emit('sync:queue-updated', this.offlineQueue);
    this.save();
  }

  clearOfflineQueue() {
    this.offlineQueue = [];
    this.state.sync.pendingMutations = 0;
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    events.emit('sync:queue-updated', []);
    this.save();
  }
}

export const store = new AppStore();
