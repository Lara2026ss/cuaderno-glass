/**
 * Cuaderno Glass Pro 6.0 — Gestor de Tareas Reactivo y Categorías
 */

import { store } from '../app/state.js';
import { events } from '../app/events.js';
import { toast } from '../ui/toast.js';
import { audio } from '../audio/audio-engine.js';
import { firestoreRepo } from '../firebase/firestore.js';
import { escapeHtml } from '../ui/components.js';

export class TasksFeature {
  constructor() {
    this.container = null;
    this.dashboardContainer = null;
    this.activeCategory = store.get('tasksCategoryFilter', 'all');
  }

  init() {
    this.container = document.getElementById('tasks-container') || document.getElementById('full-tasks-container');
    this.dashboardContainer = document.getElementById('dashboard-tasks-container');

    const form = document.getElementById('form-add-task');
    if (form) {
      form.addEventListener('submit', (e) => this.handleAddTask(e));
    }

    // Soporte para chips de filtro de categoría (en vista de tareas o dashboard)
    document.querySelectorAll('.task-category-chip, #task-filter-chips .chip, .task-filter-chips .chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        const targetChip = e.target.closest('.chip, .task-category-chip') || chip;
        const cat = targetChip.dataset.cat || 'all';
        this.setCategory(cat);
      });
    });

    // Escuchadores reactivos de sincronización y estado
    events.on('firestore:tasks:synced', () => this.render());
    events.on('state:tasks', () => this.render());
    events.on('tasks:updated', () => this.render());

    this.render();
  }

  setCategory(cat) {
    this.activeCategory = cat;
    store.set('tasksCategoryFilter', cat, { skipSave: true });

    if (typeof document !== 'undefined') {
      document.querySelectorAll('.task-category-chip, #task-filter-chips .chip, .task-filter-chips .chip').forEach(c => {
        const cCat = c.dataset.cat || 'all';
        c.classList.toggle('active', cCat.toLowerCase() === cat.toLowerCase());
      });
      
      const catSelect = document.getElementById('task-category-select');
      if (catSelect && cat !== 'all') {
        catSelect.value = cat;
      }
    }

    audio.soundClick();
    this.render();
  }

  handleAddTask(e) {
    e.preventDefault();
    const input = document.getElementById('task-input-text') || document.getElementById('input-task-text');
    const catSelect = document.getElementById('task-category-select') || document.getElementById('input-task-cat');
    const prioSelect = document.getElementById('task-priority-select') || document.getElementById('input-task-prio');

    const text = input?.value.trim();
    if (!text) {
      toast.warning('Ingresa el texto de la tarea');
      return;
    }

    const priority = prioSelect?.value || 'media';
    const category = catSelect?.value || (this.activeCategory !== 'all' ? this.activeCategory : 'Trabajo');

    const task = {
      id: Date.now() + Math.random().toString(36).substring(2, 6),
      text,
      category,
      priority,
      done: false,
      completed: false,
      date: new Date().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const tasks = store.get('tasks', []);
    tasks.unshift(task);
    store.set('tasks', tasks);
    firestoreRepo.saveItem('tasks', task).catch(() => {});

    if (input) input.value = '';

    audio.soundSuccess();
    toast.success('Tarea añadida');
    this.render();
  }

  toggleTask(taskId) {
    const tasks = store.get('tasks', []);
    const idx = tasks.findIndex(t => t.id === taskId);
    if (idx === -1) return;

    const nextState = !tasks[idx].done;
    tasks[idx].done = nextState;
    tasks[idx].completed = nextState;
    tasks[idx].updatedAt = Date.now();

    store.set('tasks', tasks);
    firestoreRepo.saveItem('tasks', tasks[idx]).catch(() => {});

    if (nextState) {
      audio.soundDone();
      if (typeof confetti === 'function') confetti({ particleCount: 35, spread: 60 });
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
    if (typeof document === 'undefined') return;
    this.container = document.getElementById('tasks-container') || document.getElementById('full-tasks-container');
    this.dashboardContainer = document.getElementById('dashboard-tasks-container');

    let list = store.get('tasks', []);
    if (this.activeCategory && this.activeCategory !== 'all') {
      list = list.filter(t => (t.category || '').trim().toLowerCase() === this.activeCategory.trim().toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t => t.text.toLowerCase().includes(q) || (t.category && t.category.toLowerCase().includes(q)));
    }

    const prioStyles = {
      alta: 'background:rgba(244,63,94,0.18); color:var(--accent-coral);',
      media: 'background:rgba(245,158,11,0.18); color:var(--accent-amber);',
      baja: 'background:rgba(16,185,129,0.18); color:var(--accent-emerald);'
    };

    const buildTaskRow = (t) => {
      const isDone = Boolean(t.done || t.completed);
      const row = document.createElement('div');
      row.className = `task-row ${isDone ? 'done' : ''}`;
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.gap = '10px';
      row.style.padding = '10px 14px';
      row.style.background = 'rgba(255, 255, 255, 0.03)';
      row.style.border = '1px solid var(--glass-border)';
      row.style.borderRadius = 'var(--radius-sm)';
      row.style.marginBottom = '8px';
      row.style.transition = 'all var(--transition-fast)';

      row.innerHTML = `
        <input type="checkbox" class="task-check" ${isDone ? 'checked' : ''} aria-label="Completar tarea" style="width:18px; height:18px; cursor:pointer;">
        <div class="task-details" style="flex:1; min-width:0;">
          <div class="task-text" style="font-size:0.9rem; font-weight:500; text-decoration:${isDone ? 'line-through' : 'none'}; color:${isDone ? 'var(--text-soft)' : 'var(--text-main)'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(t.text)}</div>
          <div class="task-sub" style="display:flex; gap:8px; align-items:center; margin-top:4px; font-size:0.72rem; color:var(--text-soft);">
            <span class="badge-tag" style="${prioStyles[t.priority] || ''}">● ${String(t.priority || 'media').toUpperCase()}</span>
            <span>🏷️ ${escapeHtml(t.category || 'Trabajo')}</span>
            <span>📅 ${escapeHtml(t.date || 'Hoy')}</span>
          </div>
        </div>
        <button class="btn btn-danger btn-sm btn-delete-task" style="padding: 4px 8px; font-size:0.75rem;" title="Eliminar">✕</button>
      `;

      row.querySelector('.task-check').addEventListener('change', () => this.toggleTask(t.id));
      row.querySelector('.btn-delete-task').addEventListener('click', () => this.deleteTask(t.id));
      return row;
    };

    if (this.container) {
      this.container.innerHTML = '';
      if (list.length === 0) {
        this.container.innerHTML = `
          <div style="text-align:center; padding:28px 10px; color:var(--text-soft); font-size:0.86rem;">
            ✨ No hay tareas en la categoría "<strong>${escapeHtml(this.activeCategory)}</strong>".
          </div>
        `;
      } else {
        list.forEach(t => this.container.appendChild(buildTaskRow(t)));
      }
    }

    if (this.dashboardContainer) {
      this.dashboardContainer.innerHTML = '';
      
      // FIX FASE 2: Desacoplar dashboard del filtro global de categorías
      const fullList = store.get('tasks', []);
      const pendingSlice = fullList.filter(t => !t.done && !t.completed).slice(0, 5);
      
      if (pendingSlice.length === 0) {
        this.dashboardContainer.innerHTML = `
          <div style="text-align:center; padding:32px 20px; color:var(--text-muted); background: rgba(255,255,255,0.02); border: 1px dashed var(--glass-border); border-radius: var(--radius-md); margin-top: 10px;">
            <div style="font-size: 2rem; margin-bottom: 12px; opacity: 0.8;">🎉</div>
            <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 4px; color: var(--text-main);">¡Todo al día!</div>
            <div style="font-size:0.84rem; color:var(--text-soft);">No tienes tareas pendientes en tu radar.</div>
          </div>
        `;
      } else {
        pendingSlice.forEach(t => this.dashboardContainer.appendChild(buildTaskRow(t)));
      }
    }

    this.updateMetrics();
  }

  updateMetrics() {
    if (typeof document === 'undefined') return;
    const all = store.get('tasks', []);
    const pending = all.filter(t => !t.done && !t.completed).length;
    const completed = all.filter(t => t.done || t.completed).length;

    const elPending = document.getElementById('stat-pending-tasks');
    const elCompleted = document.getElementById('stat-completed-tasks');
    const badgeTasks = document.getElementById('badge-tasks');

    if (elPending) elPending.textContent = pending;
    if (elCompleted) elCompleted.textContent = completed;
    if (badgeTasks) badgeTasks.textContent = pending;

    // Actualizar contadores por categoría si existen badges en chips
    ['Trabajo', 'Personal', 'Estudio', 'Ideas'].forEach(cat => {
      const count = all.filter(t => t.category === cat && !t.done && !t.completed).length;
      const countEl = document.getElementById(`count-cat-${cat.toLowerCase()}`);
      if (countEl) countEl.textContent = count;
    });
  }
}

export const tasksFeature = new TasksFeature();
