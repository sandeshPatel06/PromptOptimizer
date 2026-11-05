/**
 * PromptOptimizer - Storage Abstraction Layer
 * Works seamlessly with chrome.storage.local, browser.storage.local, and localStorage
 */

import { STARTER_PROMPTS } from './prompts.js';

const STORAGE_KEY = 'prompt_optimizer_state_v1';

const DEFAULT_STATE = {
  gatewayUrl: 'https://prompt-optimizer-api.patelbr5118s.workers.dev',
  systemInstructions: 'Prioritize clarity, specificity, and actionable output constraints. Avoid vague fluff, corporate buzzwords, and unnecessary preamble.',
  activePreset: 'reasoning',
  savedPrompts: STARTER_PROMPTS,
  history: [],
  dailyUsage: {
    date: new Date().toISOString().slice(0, 10),
    count: 0
  }
};

function getExtensionStorage() {
  try {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return chrome.storage.local;
    }
    const anyGlobal = globalThis;
    if (anyGlobal.browser && anyGlobal.browser.storage && anyGlobal.browser.storage.local) {
      return anyGlobal.browser.storage.local;
    }
  } catch (err) {
    console.warn('[PromptOptimizer] Storage detection warning:', err);
  }
  return null;
}

export const Storage = {
  async getState() {
    const ext = getExtensionStorage();

    if (ext) {
      return new Promise((resolve) => {
        ext.get(null, (result) => {
          if (!result || Object.keys(result).length === 0) {
            ext.set(DEFAULT_STATE, () => {
              resolve(DEFAULT_STATE);
            });
          } else {
            resolve({
              ...DEFAULT_STATE,
              ...result,
              savedPrompts: (result.savedPrompts && result.savedPrompts.length > 0)
                ? result.savedPrompts
                : DEFAULT_STATE.savedPrompts,
              history: result.history || []
            });
          }
        });
      });
    }

    // LocalStorage fallback for web preview
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_STATE));
        return DEFAULT_STATE;
      }
      return { ...DEFAULT_STATE, ...JSON.parse(raw) };
    } catch {
      return DEFAULT_STATE;
    }
  },

  async get(key) {
    const state = await this.getState();
    return state[key];
  },

  async set(partial) {
    const ext = getExtensionStorage();

    if (ext) {
      return new Promise((resolve) => {
        ext.set(partial, () => {
          resolve();
        });
      });
    }

    try {
      const state = await this.getState();
      const updated = { ...state, ...partial };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('[PromptOptimizer] Failed to persist state:', e);
    }
  },

  async savePrompt(prompt) {
    const state = await this.getState();
    const existingIndex = state.savedPrompts.findIndex((p) => p.id === prompt.id);
    let updatedPrompts;

    if (existingIndex >= 0) {
      updatedPrompts = [...state.savedPrompts];
      updatedPrompts[existingIndex] = { ...prompt, updatedAt: Date.now() };
    } else {
      updatedPrompts = [prompt, ...state.savedPrompts];
    }

    await this.set({ savedPrompts: updatedPrompts });
    return updatedPrompts;
  },

  async deletePrompt(id) {
    const state = await this.getState();
    const updated = state.savedPrompts.filter((p) => p.id !== id);
    await this.set({ savedPrompts: updated });
    return updated;
  },

  async toggleFavorite(id) {
    const state = await this.getState();
    const prompt = state.savedPrompts.find((p) => p.id === id);
    if (!prompt) return false;

    const newFav = !prompt.isFavorite;
    const updated = state.savedPrompts.map((p) =>
      p.id === id ? { ...p, isFavorite: newFav, updatedAt: Date.now() } : p
    );
    await this.set({ savedPrompts: updated });
    return newFav;
  },

  async addHistory(item) {
    const state = await this.getState();
    const newItem = {
      ...item,
      id: 'hist_' + Math.random().toString(36).substring(2, 9),
      timestamp: Date.now()
    };
    const updated = [newItem, ...(state.history || [])].slice(0, 40);
    await this.set({ history: updated });
    return updated;
  },

  async clearHistory() {
    await this.set({ history: [] });
  },

  async exportData() {
    const state = await this.getState();
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        savedPrompts: state.savedPrompts,
        systemInstructions: state.systemInstructions,
        model: state.model
      },
      null,
      2
    );
  },

  async importData(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      const incoming = Array.isArray(parsed) ? parsed : (parsed.savedPrompts || []);

      if (!Array.isArray(incoming) || incoming.length === 0) {
        return { count: 0, error: 'No valid prompt list found in file' };
      }

      const state = await this.getState();
      const existingIds = new Set(state.savedPrompts.map((p) => p.id));
      const merged = [...state.savedPrompts];

      let count = 0;
      for (const p of incoming) {
        if (p.title && (p.rawPrompt || p.optimizedPrompt)) {
          const id = existingIds.has(p.id)
            ? 'import_' + Math.random().toString(36).substring(2, 9)
            : (p.id || 'import_' + Math.random().toString(36).substring(2, 9));

          merged.unshift({
            id,
            title: p.title || 'Imported Prompt',
            description: p.description || '',
            category: p.category || 'custom',
            tags: Array.isArray(p.tags) ? p.tags : ['imported'],
            rawPrompt: p.rawPrompt || '',
            optimizedPrompt: p.optimizedPrompt || '',
            variables: Array.isArray(p.variables) ? p.variables : [],
            isFavorite: !!p.isFavorite,
            createdAt: p.createdAt || Date.now(),
            updatedAt: Date.now()
          });
          count++;
        }
      }

      await this.set({ savedPrompts: merged });
      return { count };
    } catch (err) {
      return { count: 0, error: err instanceof Error ? err.message : 'Invalid JSON file' };
    }
  },

  async recordUsage() {
    const state = await this.getState();
    const today = new Date().toISOString().slice(0, 10);
    let usage = state.dailyUsage || { date: today, count: 0 };
    if (usage.date !== today) {
      usage = { date: today, count: 0 };
    }
    usage.count = (usage.count || 0) + 1;
    await this.set({ dailyUsage: usage });
    return usage.count;
  },

  async getDailyRemaining(limit = 100) {
    const state = await this.getState();
    const today = new Date().toISOString().slice(0, 10);
    const usage = state.dailyUsage || { date: today, count: 0 };
    if (usage.date !== today) {
      return limit;
    }
    return Math.max(0, limit - (usage.count || 0));
  }
};
