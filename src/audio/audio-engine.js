/**
 * Cuaderno Glass Pro 4.0 — Motor Acústico Procedural (Web Audio API)
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.volume = 0.5;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;

    this.isMuted = !store.get('settings.audioEnabled', true);
    this.volume = store.get('settings.audioVolume', 0.5);

    // Escuchar interacción del usuario para desbloquear AudioContext
    const unlock = () => {
      this._ensureContext();
      window.removeEventListener('click', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('click', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    window.addEventListener('touchstart', unlock, { once: true });

    this.initialized = true;
    logger.info('AudioEngine', 'Motor de audio procedural configurado');
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) {
        logger.warn('AudioEngine', 'Web Audio API no soportada en este navegador');
        return null;
      }
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(e => logger.warn('AudioEngine', 'No se pudo reanudar AudioContext', { error: e.message }));
    }

    return this.ctx;
  }

  setMute(mute) {
    this.isMuted = mute;
    store.set('settings.audioEnabled', !mute);
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(mute ? 0 : this.volume, this.ctx.currentTime);
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    store.set('settings.audioVolume', this.volume);
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  // Sonido 1: Click sutil de cristal
  soundClick() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const now = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundClick', { error: e.message });
    }
  }

  // Sonido 2: Campanada de éxito / tarea completada
  soundSuccess() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.50]; // Acorde C Mayor (C5, E5, G5, C6)
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.35, startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.45);
      });
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundSuccess', { error: e.message });
    }
  }

  // Sonido 3: Alerta de bajada de precio / notificación importante
  soundAlert() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [880, 1174.66].forEach((freq, idx) => { // Tono dual A5 -> D6
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const startTime = now + idx * 0.12;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.4, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(startTime);
        osc.stop(startTime + 0.32);
      });
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundAlert', { error: e.message });
    }
  }

  // Sonido 4: Fanfarria de finalización de Pomodoro
  soundPomodoro() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const melody = [
        { f: 440, d: 0.15 },
        { f: 554.37, d: 0.15 },
        { f: 659.25, d: 0.15 },
        { f: 880, d: 0.45 }
      ];
      let t = ctx.currentTime;

      melody.forEach(m => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(m.f, t);

        gain.gain.setValueAtTime(0.4, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + m.d);

        osc.connect(gain);
        gain.connect(this.masterGain);

        osc.start(t);
        osc.stop(t + m.d + 0.05);

        t += m.d;
      });
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundPomodoro', { error: e.message });
    }
  }

  // Sonido 5: Error suave
  soundError() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.2);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundError', { error: e.message });
    }
  }

  // Sonido 6: Notificación sutil
  soundNotification() {
    if (this.isMuted) return;
    const ctx = this._ensureContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.14);
    } catch (e) {
      logger.debug('AudioEngine', 'Error reproduciendo soundNotification', { error: e.message });
    }
  }
}

export const audio = new AudioEngine();
