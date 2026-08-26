/**
 * Cuaderno Glass Pro 4.0 — Pomodoro Focus Engine
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';

export class PomodoroFeature {
  constructor() {
    this.timerInt = null;
    this.durations = {
      work: 25 * 60,
      shortBreak: 5 * 60,
      longBreak: 15 * 60
    };
  }

  init() {
    const btnToggle = document.getElementById('btn-timer-toggle');
    const btnDashToggle = document.getElementById('btn-dash-timer');
    const btnReset = document.getElementById('btn-timer-reset');
    const btnDashReset = document.getElementById('btn-dash-reset');

    if (btnToggle) btnToggle.addEventListener('click', () => this.toggle());
    if (btnDashToggle) btnDashToggle.addEventListener('click', () => this.toggle());
    if (btnReset) btnReset.addEventListener('click', () => this.reset());
    if (btnDashReset) btnDashReset.addEventListener('click', () => this.reset());

    const chipWork = document.getElementById('pomo-w');
    const chipShort = document.getElementById('pomo-s');
    const chipLong = document.getElementById('pomo-l');

    if (chipWork) chipWork.addEventListener('click', () => this.setMode('work'));
    if (chipShort) chipShort.addEventListener('click', () => this.setMode('shortBreak'));
    if (chipLong) chipLong.addEventListener('click', () => this.setMode('longBreak'));

    this.updateDisplay();
  }

  setMode(mode) {
    this.pause();
    store.set('pomodoro.mode', mode);
    store.set('pomodoro.remainingSeconds', this.durations[mode]);

    document.querySelectorAll('#tab-pomodoro .chip').forEach(c => c.classList.remove('active'));
    const map = { work: 'pomo-w', shortBreak: 'pomo-s', longBreak: 'pomo-l' };
    const activeChip = document.getElementById(map[mode]);
    if (activeChip) activeChip.classList.add('active');

    audio.soundClick();
    this.updateDisplay();
  }

  toggle() {
    const isRunning = store.get('pomodoro.isRunning', false);
    if (isRunning) {
      this.pause();
    } else {
      this.start();
    }
  }

  start() {
    store.set('pomodoro.isRunning', true);
    audio.soundClick();
    this.updateButtonLabels(true);

    this.timerInt = setInterval(() => {
      let rem = store.get('pomodoro.remainingSeconds', 25 * 60);
      if (rem > 0) {
        rem--;
        store.set('pomodoro.remainingSeconds', rem, { skipSave: true });
        this.updateDisplay();
      } else {
        this.complete();
      }
    }, 1000);
  }

  pause() {
    clearInterval(this.timerInt);
    store.set('pomodoro.isRunning', false);
    this.updateButtonLabels(false);
    this.updateDisplay();
  }

  reset() {
    this.pause();
    const mode = store.get('pomodoro.mode', 'work');
    store.set('pomodoro.remainingSeconds', this.durations[mode]);
    audio.soundClick();
    this.updateDisplay();
  }

  complete() {
    this.pause();
    const mode = store.get('pomodoro.mode', 'work');

    if (mode === 'work') {
      const sessions = store.get('pomodoro.sessionsCompleted', 0) + 1;
      store.set('pomodoro.sessionsCompleted', sessions);
      audio.soundPomodoro();
      if (typeof confetti === 'function') confetti({ particleCount: 70, spread: 80 });
      toast.success('🎉 ¡Bloque de concentración completado!');
      this.setMode('shortBreak');
    } else {
      audio.soundSuccess();
      toast.info('☕ ¡Descanso completado! ¿Listo para otro bloque?');
      this.setMode('work');
    }
  }

  formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  updateDisplay() {
    const rem = store.get('pomodoro.remainingSeconds', 25 * 60);
    const formatted = this.formatTime(rem);

    const fullEl = document.getElementById('full-timer-val');
    const dashEl = document.getElementById('dash-timer-val');

    if (fullEl) fullEl.textContent = formatted;
    if (dashEl) dashEl.textContent = formatted;
  }

  updateButtonLabels(isRunning) {
    const fullBtn = document.getElementById('btn-timer-toggle');
    const dashBtn = document.getElementById('btn-dash-timer');

    const label = isRunning ? '⏸ Pausar' : '▶ Iniciar';
    const dashLabel = isRunning ? 'Pausar' : 'Iniciar';

    if (fullBtn) fullBtn.textContent = label;
    if (dashBtn) dashBtn.textContent = dashLabel;
  }
}

export const pomodoroFeature = new PomodoroFeature();
