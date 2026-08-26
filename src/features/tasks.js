/**
 * Cuaderno Glass Pro 4.0 — Módulo de Tareas
 */

import { store } from '../app/state.js';
import { audio } from '../audio/audio-engine.js';
import { toast } from '../ui/toast.js';
import { escapeHtml } from '../ui/components.js';
import { firestoreRepo } from '../firebase/firestore.js';
import { discordAdapter } from '../integrations/discord.js';

export class TasksFeature {
  constructor() {
    this.container = null;
    this.activeCategory = 'all';
  }

  init() {
    this.container = document.getElementById('tasks-container');
    const form = document.getElementById('form-add-task');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTask(e));
    }

    document.querySelectorAll('#task-filter-chips .chip').forEach(chip => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('#task-filter-chips .chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.cat;
        this.render();
      });
    });

    this.render();
  }

  handleAddTask(e) {
    e.preventDefault();
    const input = document.getElementById('input-task-text');
    const catSelect = document.getElementById('input-task-cat');
    const prioSelect = document.getElementById('input-task-prio');

    const text = input?.value.trim();
    if (!text) return;

    const task = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      text,
      category: catSelect?.value || 'Trabajo',
      priority: prioSelect?.value || 'media',
      done: false,
      date: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
      createdAt: Date.now()
    };

    const tasks = store.get('tasks', []);
    tasks.unshift(task);
    store.set('tasks', tasks);

    firestoreRepo.saveItem('tasks', task).catch(() => {});

    if (input) input.value = '';
    audio.soundClick();
    toast.success('Tarea añadida');
    this.render();
  }

  toggleTask(taskId) {
    const tasks = store.get('tasks', []);
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.done = !task.done;
    store.set('tasks', tasks);
    firestoreRepo.saveItem('tasks', task).catch(() => {});

    if (task.done) {
      audio.soundSuccess();
      if (typeof confetti === 'function') confetti({ particleCount: 35, spread: 60, origin: { y: 0.8 } });
      discordAdapter.sendTaskCompleted(task).catch(() => {});
    } else {
      audio.soundClick();
    }

    this.render();
  }

  deleteTask(taskId) {
    let tasks = store.get('tasks', []);
    tasks = tasks.filter(t => t.id !== taskId);
    store.set('tasks', tasks);
    firestoreRepo.deleteItem('tasks', taskId).catch(() => {});

    audio.soundClick();
    toast.info('Tarea eliminada');
    this.render();
  }

  render(searchQuery = '') {
    if (!this.container) return;
    this.container.innerHTML = '';

    let list = store.get('tasks', []);
    if (this.activeCategory !== 'all') {
      list = list.filter(t => t.category === this.activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
    }

    if (list.length === 0) {
      this.container.innerHTML = `
        <div style="text-align:center; padding:28px 10px; color:var(--text-soft); font-size:0.86rem;">
          ✨ No hay tareas pendientes en esta sección.
        </div>
      `;
      this.updateMetrics();
      return;
    }

    const prioStyles = {
      alta: 'background:rgba(244,63,94,0.15); color:var(--accent-coral);',
      media: 'background:rgba(245,158,11,0.15); color:var(--accent-amber);',
      baja: 'background:rgba(16,185,129,0.15); color:var(--accent-emerald);'
    };

    list.forEach(t => {
      const row = document.createElement('div');
      row.className = `task-row ${t.done ? 'done' : ''}`;
      row.innerHTML = `
        <input type="checkbox" class="task-check" ${t.done ? 'checked' : ''} aria-label="Completar tarea">
        <div class="task-details">
          <div class="task-text">${escapeHtml(t.text)}</div>
          <div class="task-sub">
            <span class="badge-tag" style="${prioStyles[t.priority] || ''}">● ${t.priority.toUpperCase()}</span>
            <span>🏷️ ${escapeHtml(t.category)}</span>
            <span>📅 ${escapeHtml(t.date || 'Hoy')}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-delete-task" style="padding: 4px 8px;" title="Eliminar">✕</button>
      `;

      row.querySelector('.task-check').addEventListener('change', () => this.toggleTask(t.id));
      row.querySelector('.btn-delete-task').addEventListener('click', () => this.deleteTask(t.id));

      this.container.appendChild(row);
    });

    this.updateMetrics();
  }

  updateMetrics() {
    const all = store.get('tasks', []);
    const pending = all.filter(t => !t.done).length;
    const completed = all.filter(t => t.done).length;

    const elPending = document.getElementById('stat-pending-tasks');
    const elCompleted = document.getElementById('stat-completed-tasks');
    const badgeTasks = document.getElementById('badge-tasks');

    if (elPending) elPending.textContent = pending;
    if (elCompleted) elCompleted.textContent = completed;
    if (badgeTasks) badgeTasks.textContent = pending;
  }
}

export const tasksFeature = new TasksFeature();
