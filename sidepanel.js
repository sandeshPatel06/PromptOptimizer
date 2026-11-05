/**
 * PromptOptimizer - Main UI Controller
 * Standard ES Module without framework bloat. Fast, reactive, tactile.
 */

import { Storage } from './lib/storage.js';
import { GeminiApi } from './lib/gemini.js';
import { OPTIMIZATION_PRESETS, detectVariables, fillVariables, countMetrics } from './lib/prompts.js';

// DOM References
const elements = {
  headerModelBadge: document.getElementById('headerModelBadge'),
  headerStatusDot: document.getElementById('headerStatusDot'),
  headerModelText: document.getElementById('headerModelText'),
  btnPopOut: document.getElementById('btnPopOut'),
  btnHeaderSettings: document.getElementById('btnHeaderSettings'),
  
  navTabs: document.querySelectorAll('.tab-btn'),
  tabContents: document.querySelectorAll('.tab-content'),
  
  // Onboarding
  onboardingCard: document.getElementById('onboardingCard'),
  onboardingKeyInput: document.getElementById('onboardingKeyInput'),
  btnSaveOnboardingKey: document.getElementById('btnSaveOnboardingKey'),
  
  // Optimizer
  presetsContainer: document.getElementById('presetsContainer'),
  currentPresetName: document.getElementById('currentPresetName'),
  rawPromptInput: document.getElementById('rawPromptInput'),
  inputCharCounter: document.getElementById('inputCharCounter'),
  btnPastePrompt: document.getElementById('btnPastePrompt'),
  btnClearPrompt: document.getElementById('btnClearPrompt'),
  btnOptimize: document.getElementById('btnOptimize'),
  optimizeBtnText: document.getElementById('optimizeBtnText'),
  optimizeBtnSpinner: document.getElementById('optimizeBtnSpinner'),
  
  // Results
  resultCard: document.getElementById('resultCard'),
  subtabButtons: document.querySelectorAll('.subtab-btn'),
  subtabOutput: document.getElementById('subtab-output'),
  subtabRationale: document.getElementById('subtab-rationale'),
  subtabVars: document.getElementById('subtab-vars'),
  rationaleList: document.getElementById('rationaleList'),
  variablesContainer: document.getElementById('variablesContainer'),
  varCountBadge: document.getElementById('varCountBadge'),
  btnCopyResult: document.getElementById('btnCopyResult'),
  btnSaveToLibrary: document.getElementById('btnSaveToLibrary'),
  btnToggleTestDrawer: document.getElementById('btnToggleTestDrawer'),
  
  // Runner Drawer
  runnerDrawer: document.getElementById('runnerDrawer'),
  btnCloseRunner: document.getElementById('btnCloseRunner'),
  runnerInputsGrid: document.getElementById('runnerInputsGrid'),
  btnExecuteTest: document.getElementById('btnExecuteTest'),
  testBtnText: document.getElementById('testBtnText'),
  testBtnSpinner: document.getElementById('testBtnSpinner'),
  runnerOutput: document.getElementById('runnerOutput'),
  
  // Library
  librarySearchInput: document.getElementById('librarySearchInput'),
  categoryFilterButtons: document.querySelectorAll('.cat-filter-btn'),
  promptCardsList: document.getElementById('promptCardsList'),
  btnNewPromptModal: document.getElementById('btnNewPromptModal'),
  
  // History
  historyList: document.getElementById('historyList'),
  btnClearHistory: document.getElementById('btnClearHistory'),
  
  // Settings
  settingsApiKey: document.getElementById('settingsApiKey'),
  btnTestKey: document.getElementById('btnTestKey'),
  btnSaveKey: document.getElementById('btnSaveKey'),
  keyStatusAlert: document.getElementById('keyStatusAlert'),
  modelRadioGroup: document.getElementById('modelRadioGroup'),
  settingsSystemInstructions: document.getElementById('settingsSystemInstructions'),
  btnSaveSystemInstructions: document.getElementById('btnSaveSystemInstructions'),
  btnExportData: document.getElementById('btnExportData'),
  btnImportDataTrigger: document.getElementById('btnImportDataTrigger'),
  importFileInput: document.getElementById('importFileInput'),
  btnResetAllData: document.getElementById('btnResetAllData'),
  
  // Modal
  savePromptModal: document.getElementById('savePromptModal'),
  saveModalTitle: document.getElementById('saveModalTitle'),
  saveModalPromptTitle: document.getElementById('saveModalPromptTitle'),
  saveModalCategory: document.getElementById('saveModalCategory'),
  saveModalTags: document.getElementById('saveModalTags'),
  saveModalDescription: document.getElementById('saveModalDescription'),
  btnCloseSaveModal: document.getElementById('btnCloseSaveModal'),
  btnCancelSaveModal: document.getElementById('btnCancelSaveModal'),
  btnConfirmSavePrompt: document.getElementById('btnConfirmSavePrompt'),
  
  // Toast
  toastMessage: document.getElementById('toastMessage')
};

// Application State
let appState = null;
let currentActivePresetId = 'reasoning';
let currentActiveCategoryFilter = 'all';
let currentOptimizationResult = null;
let editingPromptId = null;

/**
 * Initialize Application
 */
async function init() {
  appState = await Storage.getState();
  currentActivePresetId = appState.activePreset || 'reasoning';

  // Render presets
  renderPresets();

  // Update Header and Onboarding state
  updateApiStatusUI();
  updateModelBadge();

  // Populate settings inputs
  elements.settingsApiKey.value = appState.apiKey || '';
  elements.settingsSystemInstructions.value = appState.systemInstructions || '';
  selectModelRadio(appState.model);

  // Check for pending prompt from context menu
  if (appState.pendingPrompt) {
    elements.rawPromptInput.value = appState.pendingPrompt;
    updateCharCounter();
    await Storage.set({ pendingPrompt: '' });
  }

  // Setup Event Listeners
  setupEventListeners();

  // Render library and history
  renderLibrary();
  renderHistory();
}

/**
 * Renders optimization presets strip
 */
function renderPresets() {
  elements.presetsContainer.innerHTML = '';
  OPTIMIZATION_PRESETS.forEach((preset) => {
    const chip = document.createElement('div');
    chip.className = `preset-chip ${preset.id === currentActivePresetId ? 'active' : ''}`;
    chip.dataset.id = preset.id;
    chip.innerHTML = `<span>${preset.glyph}</span><span>${preset.name}</span>`;
    chip.title = `${preset.name}: ${preset.tagline}`;

    chip.addEventListener('click', async () => {
      document.querySelectorAll('.preset-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentActivePresetId = preset.id;
      elements.currentPresetName.textContent = preset.name;
      await Storage.set({ activePreset: preset.id });
    });

    elements.presetsContainer.appendChild(chip);
  });

  const activePreset = OPTIMIZATION_PRESETS.find((p) => p.id === currentActivePresetId);
  if (activePreset) {
    elements.currentPresetName.textContent = activePreset.name;
  }
}

/**
 * Updates UI based on API key validity
 */
function updateApiStatusUI() {
  const hasKey = Boolean(appState.apiKey && appState.apiKey.trim() !== '');
  if (hasKey) {
    elements.headerStatusDot.className = 'status-dot active';
    elements.headerStatusDot.title = 'Google Gemini Connected';
    elements.onboardingCard.style.display = 'none';
  } else {
    elements.headerStatusDot.className = 'status-dot missing';
    elements.headerStatusDot.title = 'Missing Gemini API Key';
    elements.onboardingCard.style.display = 'block';
  }
}

/**
 * Updates Header Model chip
 */
function updateModelBadge() {
  const model = appState.model || 'gemini-1.5-flash';
  elements.headerModelText.textContent = model;
}

/**
 * Selects radio option matching model
 */
function selectModelRadio(modelId) {
  const radios = elements.modelRadioGroup.querySelectorAll('input[type="radio"]');
  radios.forEach((r) => {
    r.checked = r.value === modelId;
  });
}

/**
 * Setup All Event Listeners
 */
function setupEventListeners() {
  // Navigation tabs
  elements.navTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      elements.navTabs.forEach((t) => t.classList.remove('active'));
      elements.tabContents.forEach((c) => c.classList.remove('active'));

      tab.classList.add('active');
      const targetPanel = document.getElementById(targetId);
      if (targetPanel) targetPanel.classList.add('active');

      if (targetId === 'tab-library') {
        renderLibrary();
      } else if (targetId === 'tab-history') {
        renderHistory();
      }
    });
  });

  // Header quick buttons
  elements.btnPopOut.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'sidepanel.html' });
    } else {
      window.open('sidepanel.html', '_blank');
    }
  });

  elements.btnHeaderSettings.addEventListener('click', () => {
    switchTab('tab-settings');
  });

  // Onboarding API key save
  elements.btnSaveOnboardingKey.addEventListener('click', async () => {
    const key = elements.onboardingKeyInput.value.trim();
    if (!key) {
      showToast('Please enter your Gemini API key');
      return;
    }

    elements.btnSaveOnboardingKey.textContent = 'Checking...';
    elements.btnSaveOnboardingKey.disabled = true;

    const validation = await GeminiApi.validateApiKey(key);
    elements.btnSaveOnboardingKey.disabled = false;
    elements.btnSaveOnboardingKey.textContent = 'Verify';

    if (validation.valid) {
      appState.apiKey = key;
      appState.hasCompletedOnboarding = true;
      await Storage.set({ apiKey: key, hasCompletedOnboarding: true });
      elements.settingsApiKey.value = key;
      updateApiStatusUI();
      showToast('API key verified and connected!');
    } else {
      alert(`Validation failed: ${validation.error}`);
    }
  });

  // Editor actions
  elements.rawPromptInput.addEventListener('input', updateCharCounter);

  elements.btnPastePrompt.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        elements.rawPromptInput.value = text;
        updateCharCounter();
        showToast('Pasted from clipboard');
      }
    } catch {
      showToast('Clipboard read access denied. Paste directly into box.');
    }
  });

  elements.btnClearPrompt.addEventListener('click', () => {
    elements.rawPromptInput.value = '';
    updateCharCounter();
    elements.rawPromptInput.focus();
  });

  // Primary action: Optimize Prompt
  elements.btnOptimize.addEventListener('click', executeOptimization);

  // Subtabs inside Result Card
  elements.subtabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.subtabButtons.forEach((b) => b.classList.remove('active'));
      elements.subtabOutput.style.display = 'none';
      elements.subtabRationale.style.display = 'none';
      elements.subtabVars.style.display = 'none';

      btn.classList.add('active');
      const subtabId = btn.dataset.subtab;
      document.getElementById(subtabId).style.display = 'block';
    });
  });

  // Copy Result
  elements.btnCopyResult.addEventListener('click', () => {
    if (!currentOptimizationResult) return;
    navigator.clipboard.writeText(currentOptimizationResult.optimizedPrompt);
    showToast('Copied optimized prompt to clipboard!');
  });

  // Save to Library Modal Trigger
  elements.btnSaveToLibrary.addEventListener('click', () => {
    if (!currentOptimizationResult) return;
    openSaveModal({
      title: deriveTitleFromPrompt(currentOptimizationResult.optimizedPrompt),
      rawPrompt: elements.rawPromptInput.value,
      optimizedPrompt: currentOptimizationResult.optimizedPrompt,
      variables: currentOptimizationResult.detectedVariables,
      category: 'custom',
      tags: ['optimized']
    });
  });

  // Toggle Live Test Runner
  elements.btnToggleTestDrawer.addEventListener('click', () => {
    const isVisible = elements.runnerDrawer.style.display === 'block';
    elements.runnerDrawer.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
      renderRunnerInputs();
    }
  });

  elements.btnCloseRunner.addEventListener('click', () => {
    elements.runnerDrawer.style.display = 'none';
  });

  elements.btnExecuteTest.addEventListener('click', executePromptTest);

  // Library Search and Filters
  elements.librarySearchInput.addEventListener('input', () => {
    renderLibrary();
  });

  elements.categoryFilterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.categoryFilterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentActiveCategoryFilter = btn.dataset.cat;
      renderLibrary();
    });
  });

  elements.btnNewPromptModal.addEventListener('click', () => {
    openSaveModal({
      title: '',
      description: '',
      category: 'custom',
      tags: [],
      rawPrompt: '',
      optimizedPrompt: ''
    });
  });

  // Modal Cancel / Close
  elements.btnCloseSaveModal.addEventListener('click', closeSaveModal);
  elements.btnCancelSaveModal.addEventListener('click', closeSaveModal);
  elements.btnConfirmSavePrompt.addEventListener('click', confirmSavePrompt);

  // History Clear
  elements.btnClearHistory.addEventListener('click', async () => {
    if (confirm('Clear all prompt history?')) {
      await Storage.clearHistory();
      appState.history = [];
      renderHistory();
      showToast('History cleared');
    }
  });

  // Settings Actions
  elements.btnTestKey.addEventListener('click', async () => {
    const key = elements.settingsApiKey.value.trim();
    if (!key) {
      showKeyStatus('Please enter an API key to test.', 'danger');
      return;
    }
    showKeyStatus('Validating with Google Gemini...', 'muted');
    const result = await GeminiApi.validateApiKey(key);
    if (result.valid) {
      showKeyStatus('✓ API Key is valid and active!', 'success');
    } else {
      showKeyStatus(`✗ ${result.error}`, 'danger');
    }
  });

  elements.btnSaveKey.addEventListener('click', async () => {
    const key = elements.settingsApiKey.value.trim();
    appState.apiKey = key;
    await Storage.set({ apiKey: key });
    updateApiStatusUI();
    showToast('API key saved');
  });

  elements.modelRadioGroup.addEventListener('change', async (e) => {
    const selected = e.target.value;
    appState.model = selected;
    await Storage.set({ model: selected });
    updateModelBadge();
    showToast(`Model set to ${selected}`);
  });

  elements.btnSaveSystemInstructions.addEventListener('click', async () => {
    const instructions = elements.settingsSystemInstructions.value.trim();
    appState.systemInstructions = instructions;
    await Storage.set({ systemInstructions: instructions });
    showToast('Custom instructions saved');
  });

  elements.btnExportData.addEventListener('click', async () => {
    const dataStr = await Storage.exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-optimizer-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Prompts exported');
  });

  elements.btnImportDataTrigger.addEventListener('click', () => {
    elements.importFileInput.click();
  });

  elements.importFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const content = evt.target?.result;
      if (typeof content === 'string') {
        const result = await Storage.importData(content);
        if (result.error) {
          alert(`Import error: ${result.error}`);
        } else {
          appState = await Storage.getState();
          renderLibrary();
          showToast(`Successfully imported ${result.count} prompts!`);
        }
      }
    };
    reader.readAsText(file);
    elements.importFileInput.value = '';
  });

  elements.btnResetAllData.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all data and restore default starter prompts? This cannot be undone.')) {
      localStorage.clear();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.clear();
      }
      location.reload();
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    // Cmd/Ctrl + Enter to optimize
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab && activeTab.id === 'tab-optimizer') {
        e.preventDefault();
        executeOptimization();
      }
    }

    // '/' to focus search when on Library tab
    if (e.key === '/' && document.activeElement !== elements.rawPromptInput && document.activeElement !== elements.librarySearchInput) {
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab && activeTab.id === 'tab-library') {
        e.preventDefault();
        elements.librarySearchInput.focus();
      }
    }

    // Escape to close modal
    if (e.key === 'Escape') {
      closeSaveModal();
      elements.runnerDrawer.style.display = 'none';
    }
  });
}

/**
 * Updates Character and Word Counter
 */
function updateCharCounter() {
  const metrics = countMetrics(elements.rawPromptInput.value);
  elements.inputCharCounter.textContent = `${metrics.words} words • ${metrics.chars} chars • ~${metrics.estimatedTokens} tokens`;
}

/**
 * Execute Optimization
 */
async function executeOptimization() {
  const rawPrompt = elements.rawPromptInput.value.trim();
  if (!rawPrompt) {
    showToast('Please enter a prompt to optimize');
    elements.rawPromptInput.focus();
    return;
  }

  if (!appState.apiKey) {
    switchTab('tab-settings');
    elements.settingsApiKey.focus();
    showToast('Please configure your Google Gemini API key first');
    return;
  }

  // Set loading state
  elements.btnOptimize.disabled = true;
  elements.optimizeBtnSpinner.style.display = 'inline-block';
  elements.optimizeBtnText.textContent = 'Optimizing with Gemini...';

  const activePreset = OPTIMIZATION_PRESETS.find((p) => p.id === currentActivePresetId);

  try {
    const result = await GeminiApi.optimizePrompt({
      apiKey: appState.apiKey,
      model: appState.model,
      rawPrompt,
      presetInstruction: activePreset?.instruction || '',
      customInstructions: appState.systemInstructions || ''
    });

    currentOptimizationResult = result;

    // Show Result Card
    elements.resultCard.style.display = 'flex';
    elements.subtabOutput.textContent = result.optimizedPrompt;

    // Populate Rationale
    elements.rationaleList.innerHTML = '';
    const lines = result.rationale.split('\n').filter((l) => l.trim().length > 0);
    lines.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line.replace(/^[-*•\d.]+\s*/, '');
      elements.rationaleList.appendChild(li);
    });

    // Populate Variables
    elements.variablesContainer.innerHTML = '';
    if (result.detectedVariables.length > 0) {
      elements.varCountBadge.style.display = 'inline';
      elements.varCountBadge.textContent = `(${result.detectedVariables.length})`;
      result.detectedVariables.forEach((v) => {
        const span = document.createElement('span');
        span.className = 'var-badge';
        span.textContent = `{{${v}}}`;
        elements.variablesContainer.appendChild(span);
      });
    } else {
      elements.varCountBadge.style.display = 'none';
      elements.variablesContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 11.5px;">No template variables detected. Prompt is self-contained.</span>';
    }

    // Default to Output subtab
    elements.subtabButtons[0].click();

    // Add to history
    await Storage.addHistory({
      rawPrompt,
      optimizedPrompt: result.optimizedPrompt,
      rationale: result.rationale,
      preset: currentActivePresetId,
      model: appState.model,
      variables: result.detectedVariables
    });

    appState = await Storage.getState();
    showToast('Prompt optimized successfully!');

    // Smooth scroll result into view
    elements.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    alert(`Optimization Error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    elements.btnOptimize.disabled = false;
    elements.optimizeBtnSpinner.style.display = 'none';
    elements.optimizeBtnText.textContent = 'Optimize Prompt';
  }
}

/**
 * Render Variable Inputs in Live Test Sandbox
 */
function renderRunnerInputs() {
  if (!currentOptimizationResult) return;
  elements.runnerInputsGrid.innerHTML = '';
  elements.runnerOutput.style.display = 'none';
  elements.runnerOutput.textContent = '';

  const vars = currentOptimizationResult.detectedVariables;
  if (vars.length === 0) {
    elements.runnerInputsGrid.innerHTML = '<span style="font-size: 11px; color: var(--text-secondary);">No variables required. Ready to run as-is.</span>';
    return;
  }

  vars.forEach((v) => {
    const row = document.createElement('div');
    row.className = 'runner-var-row';
    row.innerHTML = `
      <label class="runner-var-label">{{${v}}}</label>
      <input type="text" class="text-input runner-var-input" data-var="${v}" placeholder="Value for ${v}...">
    `;
    elements.runnerInputsGrid.appendChild(row);
  });
}

/**
 * Execute Test against Gemini Flash
 */
async function executePromptTest() {
  if (!currentOptimizationResult) return;
  if (!appState.apiKey) {
    showToast('Google Gemini API key required.');
    return;
  }

  // Collect values
  const inputs = elements.runnerInputsGrid.querySelectorAll('.runner-var-input');
  const values = {};
  inputs.forEach((input) => {
    values[input.dataset.var] = input.value.trim();
  });

  const filledPrompt = fillVariables(currentOptimizationResult.optimizedPrompt, values);

  elements.btnExecuteTest.disabled = true;
  elements.testBtnSpinner.style.display = 'inline-block';
  elements.testBtnText.textContent = 'Executing...';
  elements.runnerOutput.style.display = 'block';
  elements.runnerOutput.textContent = 'Calling Gemini...';

  try {
    const output = await GeminiApi.testPrompt({
      apiKey: appState.apiKey,
      model: appState.model,
      promptText: filledPrompt
    });
    elements.runnerOutput.textContent = output;
  } catch (err) {
    elements.runnerOutput.textContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
  } finally {
    elements.btnExecuteTest.disabled = false;
    elements.testBtnSpinner.style.display = 'none';
    elements.testBtnText.textContent = 'Run with Gemini';
  }
}

/**
 * Render Library of Saved Prompts
 */
function renderLibrary() {
  elements.promptCardsList.innerHTML = '';
  const query = elements.librarySearchInput.value.toLowerCase().trim();
  const prompts = appState.savedPrompts || [];

  const filtered = prompts.filter((p) => {
    // Filter by Category
    if (currentActiveCategoryFilter === 'favorite' && !p.isFavorite) return false;
    if (currentActiveCategoryFilter !== 'all' && currentActiveCategoryFilter !== 'favorite' && p.category !== currentActiveCategoryFilter) {
      return false;
    }
    // Filter by Search Query
    if (query) {
      const matchTitle = p.title.toLowerCase().includes(query);
      const matchDesc = (p.description || '').toLowerCase().includes(query);
      const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(query));
      const matchContent = (p.optimizedPrompt || '').toLowerCase().includes(query);
      return matchTitle || matchDesc || matchTags || matchContent;
    }
    return true;
  });

  if (filtered.length === 0) {
    elements.promptCardsList.innerHTML = `
      <div class="empty-state">
        <p>No saved prompts found.</p>
        <p style="font-size: 11px; margin-top: 4px;">Click "+ New" or optimize a draft to save it here.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((prompt) => {
    const card = document.createElement('article');
    card.className = 'prompt-card';

    const tagsHtml = (prompt.tags || [])
      .map((t) => `<span class="tag-badge">#${t}</span>`)
      .join('');

    card.innerHTML = `
      <div class="prompt-card-header">
        <span class="prompt-card-title">${escapeHtml(prompt.title)}</span>
        <button class="mini-btn btn-star" title="Favorite" data-id="${prompt.id}">
          ${prompt.isFavorite ? '★' : '☆'}
        </button>
      </div>
      ${prompt.description ? `<p class="prompt-card-desc">${escapeHtml(prompt.description)}</p>` : ''}
      <div class="prompt-card-footer">
        <div class="prompt-card-tags">
          <span class="tag-badge" style="color: var(--accent);">${prompt.category}</span>
          ${tagsHtml}
        </div>
        <div class="prompt-card-actions">
          <button class="action-pill-btn btn-card-copy" data-id="${prompt.id}" title="Copy optimized prompt">Copy</button>
          <button class="action-pill-btn btn-card-use" data-id="${prompt.id}" title="Open in Optimizer">Edit</button>
          <button class="mini-btn btn-card-delete" data-id="${prompt.id}" title="Delete prompt" style="color: var(--text-muted);">&times;</button>
        </div>
      </div>
    `;

    // Star toggle
    card.querySelector('.btn-star').addEventListener('click', async (e) => {
      e.stopPropagation();
      const newFav = await Storage.toggleFavorite(prompt.id);
      prompt.isFavorite = newFav;
      renderLibrary();
    });

    // Copy action
    card.querySelector('.btn-card-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(prompt.optimizedPrompt || prompt.rawPrompt);
      showToast(`Copied "${prompt.title}"`);
    });

    // Use in Optimizer
    card.querySelector('.btn-card-use').addEventListener('click', () => {
      elements.rawPromptInput.value = prompt.rawPrompt || prompt.optimizedPrompt;
      updateCharCounter();
      switchTab('tab-optimizer');
      showToast('Loaded into Optimizer');
    });

    // Delete action
    card.querySelector('.btn-card-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete prompt "${prompt.title}"?`)) {
        await Storage.deletePrompt(prompt.id);
        appState = await Storage.getState();
        renderLibrary();
        showToast('Prompt deleted');
      }
    });

    elements.promptCardsList.appendChild(card);
  });
}

/**
 * Render History List
 */
function renderHistory() {
  elements.historyList.innerHTML = '';
  const history = appState.history || [];

  if (history.length === 0) {
    elements.historyList.innerHTML = '<div class="empty-state">No recent optimizations logged yet.</div>';
    return;
  }

  history.forEach((item) => {
    const el = document.createElement('div');
    el.className = 'history-item';
    const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.innerHTML = `
      <div class="history-item-top">
        <span style="font-family: var(--font-mono); color: var(--accent);">${item.preset} &bull; ${item.model}</span>
        <span>${dateStr}</span>
      </div>
      <div class="history-item-preview">${escapeHtml(item.optimizedPrompt)}</div>
      <div style="display: flex; justify-content: flex-end; gap: 4px; margin-top: 4px;">
        <button class="action-pill-btn btn-history-copy" title="Copy">Copy</button>
        <button class="action-pill-btn btn-history-restore" title="Restore to Editor">Restore</button>
      </div>
    `;

    el.querySelector('.btn-history-copy').addEventListener('click', () => {
      navigator.clipboard.writeText(item.optimizedPrompt);
      showToast('Copied from history');
    });

    el.querySelector('.btn-history-restore').addEventListener('click', () => {
      elements.rawPromptInput.value = item.rawPrompt || item.optimizedPrompt;
      updateCharCounter();
      switchTab('tab-optimizer');
      showToast('Restored to Optimizer');
    });

    elements.historyList.appendChild(el);
  });
}

/**
 * Modal Handling
 */
function openSaveModal(data) {
  editingPromptId = data.id || null;
  elements.saveModalTitle.textContent = editingPromptId ? 'Edit Prompt' : 'Save to Prompt Library';
  elements.saveModalPromptTitle.value = data.title || '';
  elements.saveModalDescription.value = data.description || '';
  elements.saveModalCategory.value = data.category || 'custom';
  elements.saveModalTags.value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
  elements.savePromptModal.classList.add('active');
  elements.saveModalPromptTitle.focus();
}

function closeSaveModal() {
  elements.savePromptModal.classList.remove('active');
  editingPromptId = null;
}

async function confirmSavePrompt() {
  const title = elements.saveModalPromptTitle.value.trim();
  if (!title) {
    alert('Please enter a title for this prompt.');
    elements.saveModalPromptTitle.focus();
    return;
  }

  const category = elements.saveModalCategory.value;
  const description = elements.saveModalDescription.value.trim();
  const tags = elements.saveModalTags.value
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const rawPrompt = elements.rawPromptInput.value;
  const optimizedPrompt = currentOptimizationResult ? currentOptimizationResult.optimizedPrompt : rawPrompt;
  const variables = detectVariables(optimizedPrompt);

  const promptObj = {
    id: editingPromptId || 'user_' + Math.random().toString(36).substring(2, 9),
    title,
    description,
    category,
    tags,
    rawPrompt,
    optimizedPrompt,
    variables,
    isFavorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await Storage.savePrompt(promptObj);
  appState = await Storage.getState();
  closeSaveModal();
  renderLibrary();
  showToast(`Saved "${title}" to Library`);
}

/**
 * Utilities
 */
function switchTab(tabId) {
  const targetBtn = Array.from(elements.navTabs).find((t) => t.dataset.tab === tabId);
  if (targetBtn) targetBtn.click();
}

function showToast(msg) {
  elements.toastMessage.textContent = msg;
  elements.toastMessage.classList.add('show');
  setTimeout(() => {
    elements.toastMessage.classList.remove('show');
  }, 2400);
}

function showKeyStatus(msg, type) {
  elements.keyStatusAlert.style.display = 'block';
  elements.keyStatusAlert.textContent = msg;
  elements.keyStatusAlert.style.color = type === 'success' ? 'var(--success)' : (type === 'danger' ? 'var(--danger)' : 'var(--text-muted)');
}

function deriveTitleFromPrompt(text) {
  if (!text) return 'Custom Prompt';
  const firstLine = text.trim().split('\n')[0].replace(/^[#*\s-]+/, '').trim();
  return firstLine.slice(0, 40) || 'Custom Prompt';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Boot
document.addEventListener('DOMContentLoaded', init);
