/**
 * Cuaderno Glass Pro 4.0 — GitHub Integration Adapter
 */

import { store } from '../app/state.js';
import { logger } from '../app/logger.js';
import { registry } from './registry.js';

export class GitHubAdapter {
  constructor() {
    this.id = 'github';
  }

  getRepo() {
    return store.get('settings.githubRepo', 'Lara2026ss/cuaderno-glass');
  }

  async getRepoInfo() {
    const repo = this.getRepo();
    try {
      let data;
      try {
        const res = await fetch(`/api/github/repo?repo=${encodeURIComponent(repo)}`);
        if (res.ok) {
          data = await res.json();
        } else {
          throw new Error(`Backend devolvió ${res.status}`);
        }
      } catch (beErr) {
        // Fallback a GitHub Public API
        const res = await fetch(`https://api.github.com/repos/${repo}`);
        if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${res.statusText}`);
        data = await res.json();
      }

      // Obtener último commit
      const commitsRes = await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`);
      let latestCommit = null;
      if (commitsRes.ok) {
        const commits = await commitsRes.json();
        if (commits.length > 0) {
          latestCommit = {
            sha: commits[0].sha.substring(0, 7),
            message: commits[0].commit.message,
            author: commits[0].commit.author.name,
            date: commits[0].commit.author.date
          };
        }
      }

      const result = {
        name: data.full_name,
        description: data.description,
        defaultBranch: data.default_branch,
        stars: data.stargazers_count,
        openIssues: data.open_issues_count,
        updatedAt: data.updated_at,
        htmlUrl: data.html_url,
        latestCommit
      };

      store.set('connections.github.lastSync', new Date().toISOString());
      registry.setStatus('github', 'connected');
      logger.info('GitHubAdapter', `Información de ${repo} obtenida exitosamente`);
      return { ok: true, data: result };
    } catch (err) {
      logger.error('GitHubAdapter', 'Error consultando GitHub API', { repo, error: err.message });
      registry.setStatus('github', 'error', err.message);
      return { ok: false, error: err.message };
    }
  }
}

export const githubAdapter = new GitHubAdapter();
