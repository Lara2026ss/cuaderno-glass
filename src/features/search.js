/**
 * Cuaderno Glass Pro 4.0 — Búsqueda Global Unificada
 */

import { tasksFeature } from './tasks.js';
import { documentsFeature } from './documents.js';
import { dealsFeature } from './deals.js';

export class GlobalSearchFeature {
  constructor() {
    this.searchInput = null;
  }

  init() {
    this.searchInput = document.getElementById('global-search');
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        const query = e.target.value;
        this.dispatchSearch(query);
      });
    }
  }

  dispatchSearch(query) {
    tasksFeature.render(query);
    documentsFeature.render(query);
    dealsFeature.render(query);
  }
}

export const searchFeature = new GlobalSearchFeature();
