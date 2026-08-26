/**
 * Cuaderno Glass Pro 4.0 — Logger & Observabilidad
 */

export class AppLogger {
  constructor(maxLogs = 200) {
    this.maxLogs = maxLogs;
    this.logs = [];
    this.listeners = [];
  }

  log(level, component, message, context = {}) {
    // Sanitizar contexto para evitar registrar contraseñas o tokens
    const safeContext = { ...context };
    ['apiKey', 'token', 'pat', 'secret', 'password'].forEach(k => {
      if (safeContext[k]) safeContext[k] = '[PROTECTED]';
    });

    const entry = {
      id: Date.now() + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      context: safeContext
    };

    this.logs.unshift(entry);
    if (this.logs.length > this.maxLogs) this.logs.pop();

    if (level === 'error') {
      console.error(`[${component}]`, message, safeContext);
    } else if (level === 'warn') {
      console.warn(`[${component}]`, message, safeContext);
    } else {
      console.log(`[${component}]`, message, safeContext);
    }

    this.listeners.forEach(fn => {
      try { fn(entry); } catch (e) {}
    });

    return entry;
  }

  debug(comp, msg, ctx) { return this.log('debug', comp, msg, ctx); }
  info(comp, msg, ctx) { return this.log('info', comp, msg, ctx); }
  warn(comp, msg, ctx) { return this.log('warn', comp, msg, ctx); }
  error(comp, msg, ctx) { return this.log('error', comp, msg, ctx); }

  getLogs(filterLevel = null) {
    if (!filterLevel) return [...this.logs];
    return this.logs.filter(l => l.level === filterLevel);
  }

  onLog(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new AppLogger();
