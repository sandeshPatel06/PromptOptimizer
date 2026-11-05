/**
 * PromptOptimizer - Main UI Controller
 * Built strictly according to Modern Web Guidance (native <dialog>, IME safety, container-aware).
 * With dynamic model discovery and auto-recovery from API version differences.
 */

import { Storage } from './lib/storage.js';
import { GeminiApi } from './lib/gemini.js';
import { Permissions } from './lib/permissions.js';
import { OPTIMIZATION_PRESETS, detectVariables, fillVariables, countMetrics } from './lib/prompts.js';
import { renderMarkdown } from './lib/markdown.js';

const elements = {
  headerModelSelect: document.getElementById('headerModelSelect'),
  statusDot: document.getElementById('statusDot'),
  btnPopOut: document.getElementById('btnPopOut'),
  btnHeaderSettings: document.getElementById('btnHeaderSettings'),
  
  navSegmentBtns: document.querySelectorAll('.nav-segment-btn'),
  panes: document.querySelectorAll('.pane'),
  
  permBanner: document.getElementById('permBanner'),
  btnGrantBannerPerm: document.getElementById('btnGrantBannerPerm'),
  
  onboardingCard: document.getElementById('onboardingCard'),
  onboardingKeyInput: document.getElementById('onboardingKeyInput'),
  btnSaveOnboardingKey: document.getElementById('btnSaveOnboardingKey'),
  
  presetsContainer: document.getElementById('presetsContainer'),
  rawPromptInput: document.getElementById('rawPromptInput'),
  inputCharCounter: document.getElementById('inputCharCounter'),
  btnPastePrompt: document.getElementById('btnPastePrompt'),
  btnClearPrompt: document.getElementById('btnClearPrompt'),
  btnOptimize: document.getElementById('btnOptimize'),
  optimizeBtnText: document.getElementById('optimizeBtnText'),
  optimizeBtnSpinner: document.getElementById('optimizeBtnSpinner'),
  
  resultCard: document.getElementById('resultCard'),
  resultStatsBadge: document.getElementById('resultStatsBadge'),
  btnViewPreview: document.getElementById('btnViewPreview'),
  btnViewRaw: document.getElementById('btnViewRaw'),
  resultPreview: document.getElementById('resultPreview'),
  resultRaw: document.getElementById('resultRaw'),
  variablesBar: document.getElementById('variablesBar'),
  variablesContainer: document.getElementById('variablesContainer'),
  improvementsDrawer: document.getElementById('improvementsDrawer'),
  improvementsSummary: document.getElementById('improvementsSummary'),
  rationaleList: document.getElementById('rationaleList'),
  btnCopyResult: document.getElementById('btnCopyResult'),
  btnSaveToLibrary: document.getElementById('btnSaveToLibrary'),
  btnToggleTestDrawer: document.getElementById('btnToggleTestDrawer'),
  
  runnerDrawer: document.getElementById('runnerDrawer'),
  btnCloseRunner: document.getElementById('btnCloseRunner'),
  runnerInputsGrid: document.getElementById('runnerInputsGrid'),
  btnExecuteTest: document.getElementById('btnExecuteTest'),
  testBtnText: document.getElementById('testBtnText'),
  testBtnSpinner: document.getElementById('testBtnSpinner'),
  runnerOutputWrapper: document.getElementById('runnerOutputWrapper'),
  btnSandboxPreview: document.getElementById('btnSandboxPreview'),
  btnSandboxRaw: document.getElementById('btnSandboxRaw'),
  runnerOutputPreview: document.getElementById('runnerOutputPreview'),
  runnerOutputRaw: document.getElementById('runnerOutputRaw'),
  
  librarySearchInput: document.getElementById('librarySearchInput'),
  filterPills: document.querySelectorAll('.filter-pill'),
  promptCardsList: document.getElementById('promptCardsList'),
  btnNewPromptModal: document.getElementById('btnNewPromptModal'),
  
  // Native HTML5 <dialog> elements
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
  settingsApiKey: document.getElementById('settingsApiKey'),
  btnTestKey: document.getElementById('btnTestKey'),
  keyStatusAlert: document.getElementById('keyStatusAlert'),
  modelRadioGroup: document.getElementById('modelRadioGroup'),
  permDiagList: document.getElementById('permDiagList'),
  btnRequestAllPerms: document.getElementById('btnRequestAllPerms'),
  settingsSystemInstructions: document.getElementById('settingsSystemInstructions'),
  btnSaveAllSettings: document.getElementById('btnSaveAllSettings'),
  btnExportData: document.getElementById('btnExportData'),
  btnImportDataTrigger: document.getElementById('btnImportDataTrigger'),
  importFileInput: document.getElementById('importFileInput'),
  btnResetAllData: document.getElementById('btnResetAllData'),
  
  savePromptModal: document.getElementById('savePromptModal'),
  saveModalTitle: document.getElementById('saveModalTitle'),
  saveModalPromptTitle: document.getElementById('saveModalPromptTitle'),
  saveModalCategory: document.getElementById('saveModalCategory'),
  saveModalTags: document.getElementById('saveModalTags'),
  saveModalDescription: document.getElementById('saveModalDescription'),
  btnCloseSaveModal: document.getElementById('btnCloseSaveModal'),
  btnCancelSaveModal: document.getElementById('btnCancelSaveModal'),
  btnConfirmSavePrompt: document.getElementById('btnConfirmSavePrompt'),
  
  toastMessage: document.getElementById('toastMessage')
};

let appState = null;
let currentActivePresetId = 'reasoning';
let currentActiveCategoryFilter = 'all';
let currentOptimizationResult = null;
let editingPromptId = null;

async function init() {
  appState = await Storage.getState();
  currentActivePresetId = appState.activePreset || 'reasoning';

  renderPresets();
  updateApiStatusUI();
  updateModelDropdown();

  elements.settingsApiKey.value = appState.apiKey || '';
  elements.settingsSystemInstructions.value = appState.systemInstructions || '';
  selectModelRadio(appState.model);

  await checkPermissionsHealth();

  // Dynamically discover supported models for this key
  if (appState.apiKey) {
    populateDynamicModels().catch(console.warn);
  }

  if (appState.pendingPrompt) {
    elements.rawPromptInput.value = appState.pendingPrompt;
    updateCharCounter();
    await Storage.set({ pendingPrompt: '' });
  }

  setupEventListeners();
  renderLibrary();
}

/**
 * Dynamically queries Google ModelService to list models actually available on this key
 */
async function populateDynamicModels() {
  if (!appState.apiKey) return;
  const models = await GeminiApi.getAvailableModels(appState.apiKey);
  if (!models || models.length === 0) return;

  // Filter models relevant to text generation
  const genModels = models.filter((m) => m.includes('gemini') || m.includes('flash') || m.includes('pro'));
  if (genModels.length === 0) return;

  elements.headerModelSelect.innerHTML = '';
  genModels.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    const label = m.replace(/^gemini-/, '').replace(/-/g, ' ');
    opt.textContent = label;
    elements.headerModelSelect.appendChild(opt);
  });

  // Verify active model exists in supported list
  if (!genModels.includes(appState.model)) {
    const resolved = await GeminiApi.resolveWorkingModel(appState.apiKey, appState.model);
    appState.model = resolved;
    await Storage.set({ model: resolved });
  }

  elements.headerModelSelect.value = appState.model;
}

async function checkPermissionsHealth() {
  const permStatus = await Permissions.checkAll();

  if (permStatus.isExtension && !permStatus.hasGeminiOrigin) {
    elements.permBanner.style.display = 'flex';
  } else {
    elements.permBanner.style.display = 'none';
  }

  renderPermissionDiagnostics(permStatus);
}

function renderPermissionDiagnostics(status) {
  if (!elements.permDiagList) return;
  elements.permDiagList.innerHTML = '';

  const list = [
    {
      name: 'Google Gemini API Access',
      granted: status.hasGeminiOrigin,
      onRequest: async () => {
        const ok = await Permissions.requestGeminiHost();
        if (ok) {
          showToast('Access granted');
          await checkPermissionsHealth();
        }
      }
    },
    {
      name: 'Clipboard Read/Paste',
      granted: status.hasClipboardRead,
      onRequest: async () => {
        const ok = await Permissions.requestClipboardRead();
        if (ok) {
          showToast('Clipboard access granted');
          await checkPermissionsHealth();
        }
      }
    },
    {
      name: 'Storage & Preferences',
      granted: true
    }
  ];

  list.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'perm-item';
    row.innerHTML = `
      <span>${item.name}</span>
      <div>
        ${item.granted 
          ? '<span class="perm-ok">✓ OK</span>' 
          : '<button class="btn-xs btn-req">Grant</button>'
        }
      </div>
    `;

    if (!item.granted && item.onRequest) {
      row.querySelector('.btn-req').addEventListener('click', item.onRequest);
    }

    elements.permDiagList.appendChild(row);
  });
}

function renderPresets() {
  elements.presetsContainer.innerHTML = '';
  OPTIMIZATION_PRESETS.forEach((preset) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `mode-chip ${preset.id === currentActivePresetId ? 'active' : ''}`;
    chip.dataset.id = preset.id;
    chip.textContent = preset.name;
    chip.title = preset.tagline;

    chip.addEventListener('click', async () => {
      document.querySelectorAll('.mode-chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      currentActivePresetId = preset.id;
      await Storage.set({ activePreset: preset.id });
    });

    elements.presetsContainer.appendChild(chip);
  });
}

function updateApiStatusUI() {
  const hasKey = Boolean(appState.apiKey && appState.apiKey.trim() !== '');
  if (hasKey) {
    elements.statusDot.className = 'status-indicator active';
    elements.statusDot.title = 'Gemini Connected';
    elements.onboardingCard.style.display = 'none';
  } else {
    elements.statusDot.className = 'status-indicator missing';
    elements.statusDot.title = 'API Key Required';
    elements.onboardingCard.style.display = 'flex';
  }
}

function updateModelDropdown() {
  const model = appState.model || 'gemini-1.5-flash';
  elements.headerModelSelect.value = model;
}

function selectModelRadio(modelId) {
  const radios = elements.modelRadioGroup.querySelectorAll('input[type="radio"]');
  radios.forEach((r) => {
    r.checked = r.value === modelId;
  });
}

function setupEventListeners() {
  // Topbar model selector
  elements.headerModelSelect.addEventListener('change', async (e) => {
    const selected = e.target.value;
    appState.model = selected;
    await Storage.set({ model: selected });
    selectModelRadio(selected);
    showToast(`Model: ${selected}`);
  });

  // Top navigation switcher
  elements.navSegmentBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      elements.navSegmentBtns.forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      elements.panes.forEach((p) => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (targetId === 'tab-library') {
        renderLibrary();
      }
    });
  });

  // Pop-out Tab
  elements.btnPopOut.addEventListener('click', () => {
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
      chrome.tabs.create({ url: 'sidepanel.html' });
    } else {
      window.open('sidepanel.html', '_blank');
    }
  });

  // Native HTML5 <dialog> for Settings (per modern-web-guidance dialog)
  elements.btnHeaderSettings.addEventListener('click', async () => {
    elements.settingsApiKey.value = appState.apiKey || '';
    elements.settingsSystemInstructions.value = appState.systemInstructions || '';
    selectModelRadio(appState.model);
    await checkPermissionsHealth();
    elements.settingsModal.showModal();
  });

  elements.btnCloseSettingsModal.addEventListener('click', () => {
    elements.settingsModal.close();
  });

  // Grant banner permission
  elements.btnGrantBannerPerm.addEventListener('click', async () => {
    const granted = await Permissions.requestGeminiHost();
    if (granted) {
      elements.permBanner.style.display = 'none';
      showToast('Network access granted');
      await checkPermissionsHealth();
    }
  });

  // Request all permissions
  elements.btnRequestAllPerms.addEventListener('click', async () => {
    await Permissions.request(
      ['clipboardRead', 'tabs'],
      ['https://generativelanguage.googleapis.com/*']
    );
    await checkPermissionsHealth();
    showToast('Permissions refreshed');
  });

  // Save onboarding key
  elements.btnSaveOnboardingKey.addEventListener('click', async () => {
    const key = elements.onboardingKeyInput.value.trim();
    if (!key) {
      showToast('Enter a Gemini API key');
      return;
    }

    elements.btnSaveOnboardingKey.disabled = true;
    elements.btnSaveOnboardingKey.textContent = '...';

    await Permissions.requestGeminiHost();

    const validation = await GeminiApi.validateApiKey(key);
    elements.btnSaveOnboardingKey.disabled = false;
    elements.btnSaveOnboardingKey.textContent = 'Save';

    if (validation.valid) {
      appState.apiKey = key;
      appState.hasCompletedOnboarding = true;
      await Storage.set({ apiKey: key, hasCompletedOnboarding: true });
      elements.settingsApiKey.value = key;
      updateApiStatusUI();
      await populateDynamicModels();
      showToast('Gemini connected');
    } else {
      alert(`Invalid key: ${validation.error}`);
    }
  });

  // Editor Actions
  elements.rawPromptInput.addEventListener('input', updateCharCounter);

  elements.btnPastePrompt.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        elements.rawPromptInput.value = text;
        updateCharCounter();
        showToast('Pasted');
        return;
      }
    } catch {
      const granted = await Permissions.requestClipboardRead();
      if (granted) {
        try {
          const text = await navigator.clipboard.readText();
          if (text) {
            elements.rawPromptInput.value = text;
            updateCharCounter();
            showToast('Pasted');
            return;
          }
        } catch {
          // fallback
        }
      }
      showToast('Press Cmd+V / Ctrl+V to paste');
    }
  });

  elements.btnClearPrompt.addEventListener('click', () => {
    elements.rawPromptInput.value = '';
    updateCharCounter();
    elements.rawPromptInput.focus();
  });

  // Optimize
  elements.btnOptimize.addEventListener('click', executeOptimization);

  // View Mode Toggles (Result)
  if (elements.btnViewPreview && elements.btnViewRaw) {
    elements.btnViewPreview.addEventListener('click', () => setResultViewMode('preview'));
    elements.btnViewRaw.addEventListener('click', () => setResultViewMode('raw'));
  }

  // View Mode Toggles (Sandbox Output)
  if (elements.btnSandboxPreview && elements.btnSandboxRaw) {
    elements.btnSandboxPreview.addEventListener('click', () => setSandboxViewMode('preview'));
    elements.btnSandboxRaw.addEventListener('click', () => setSandboxViewMode('raw'));
  }

  // Copy Result
  elements.btnCopyResult.addEventListener('click', () => {
    if (!currentOptimizationResult) return;
    navigator.clipboard.writeText(currentOptimizationResult.optimizedPrompt);
    showToast('Copied to clipboard');
  });

  // Save Result to Library
  elements.btnSaveToLibrary.addEventListener('click', () => {
    if (!currentOptimizationResult) return;
    openSaveModal({
      title: deriveTitleFromPrompt(currentOptimizationResult.optimizedPrompt),
      rawPrompt: elements.rawPromptInput.value,
      optimizedPrompt: currentOptimizationResult.optimizedPrompt,
      variables: currentOptimizationResult.detectedVariables,
      category: 'custom',
      tags: ['refined']
    });
  });

  // Toggle Test Drawer
  elements.btnToggleTestDrawer.addEventListener('click', () => {
    const isVisible = elements.runnerDrawer.style.display === 'flex';
    elements.runnerDrawer.style.display = isVisible ? 'none' : 'flex';
    if (!isVisible) {
      renderRunnerInputs();
    }
  });

  elements.btnCloseRunner.addEventListener('click', () => {
    elements.runnerDrawer.style.display = 'none';
  });

  elements.btnExecuteTest.addEventListener('click', executePromptTest);

  // Library Search and Filters
  elements.librarySearchInput.addEventListener('input', renderLibrary);

  elements.filterPills.forEach((btn) => {
    btn.addEventListener('click', () => {
      elements.filterPills.forEach((b) => b.classList.remove('active'));
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

  // Native HTML5 <dialog> for Save Prompt
  elements.btnCloseSaveModal.addEventListener('click', closeSaveModal);
  elements.btnCancelSaveModal.addEventListener('click', closeSaveModal);
  elements.btnConfirmSavePrompt.addEventListener('click', confirmSavePrompt);

  // Settings Actions
  elements.btnTestKey.addEventListener('click', async () => {
    const key = elements.settingsApiKey.value.trim();
    if (!key) {
      showKeyStatus('Enter an API key to test.', 'danger');
      return;
    }
    showKeyStatus('Verifying...', 'muted');
    const result = await GeminiApi.validateApiKey(key);
    if (result.valid) {
      showKeyStatus('✓ Key is valid', 'success');
      await populateDynamicModels();
    } else {
      showKeyStatus(`✗ ${result.error}`, 'danger');
    }
  });

  elements.btnSaveAllSettings.addEventListener('click', async () => {
    const key = elements.settingsApiKey.value.trim();
    const instructions = elements.settingsSystemInstructions.value.trim();
    const selectedModel = elements.modelRadioGroup.querySelector('input[type="radio"]:checked')?.value || 'gemini-1.5-flash';

    appState.apiKey = key;
    appState.systemInstructions = instructions;
    appState.model = selectedModel;

    await Storage.set({
      apiKey: key,
      systemInstructions: instructions,
      model: selectedModel
    });

    updateApiStatusUI();
    updateModelDropdown();
    if (key) {
      await populateDynamicModels();
    }
    elements.settingsModal.close();
    showToast('Settings saved');
  });

  elements.btnExportData.addEventListener('click', async () => {
    const dataStr = await Storage.exportData();
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-optimizer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported');
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
          showToast(`Imported ${result.count} prompts`);
        }
      }
    };
    reader.readAsText(file);
    elements.importFileInput.value = '';
  });

  elements.btnResetAllData.addEventListener('click', async () => {
    if (confirm('Reset prompts and storage to factory defaults?')) {
      localStorage.clear();
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.clear();
      }
      location.reload();
    }
  });

  // Global Keyboard Shortcuts (with IME-safe enter submit per modern-web-guidance)
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) {
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      const activePane = document.querySelector('.pane.active');
      if (activePane && activePane.id === 'tab-optimizer') {
        e.preventDefault();
        executeOptimization();
      }
    }

    if (e.key === '/' && document.activeElement !== elements.rawPromptInput && document.activeElement !== elements.librarySearchInput) {
      const activePane = document.querySelector('.pane.active');
      if (activePane && activePane.id === 'tab-library') {
        e.preventDefault();
        elements.librarySearchInput.focus();
      }
    }
  });
}

function updateCharCounter() {
  const metrics = countMetrics(elements.rawPromptInput.value);
  elements.inputCharCounter.textContent = `${metrics.words} words • ${metrics.chars} chars`;
}

async function executeOptimization() {
  const rawPrompt = elements.rawPromptInput.value.trim();
  if (!rawPrompt) {
    showToast('Enter a prompt first');
    elements.rawPromptInput.focus();
    return;
  }

  if (!appState.apiKey) {
    elements.btnHeaderSettings.click();
    showToast('Gemini API key required');
    return;
  }

  const permStatus = await Permissions.checkAll();
  if (permStatus.isExtension && !permStatus.hasGeminiOrigin) {
    const granted = await Permissions.requestGeminiHost();
    if (!granted) {
      alert('Network permission required to contact Google Gemini API.');
      return;
    }
  }

  elements.btnOptimize.disabled = true;
  elements.optimizeBtnSpinner.style.display = 'inline-block';
  elements.optimizeBtnText.textContent = 'Refining...';

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

    // If auto-resolved to a different working model (e.g. gemini-2.0-flash or gemini-1.5-flash-latest)
    if (result.usedModel && result.usedModel !== appState.model) {
      appState.model = result.usedModel;
      await Storage.set({ model: result.usedModel });
      updateModelDropdown();
    }

    elements.resultCard.style.display = 'flex';
    if (elements.resultPreview) {
      elements.resultPreview.innerHTML = renderMarkdown(result.optimizedPrompt);
    }
    if (elements.resultRaw) {
      elements.resultRaw.textContent = result.optimizedPrompt;
    }
    setResultViewMode('preview');
    elements.resultStatsBadge.textContent = `~${result.metrics.estimatedTokens} tokens`;

    elements.variablesContainer.innerHTML = '';
    if (result.detectedVariables.length > 0) {
      elements.variablesBar.style.display = 'flex';
      result.detectedVariables.forEach((v) => {
        const span = document.createElement('span');
        span.className = 'var-token';
        span.textContent = `{{${v}}}`;
        elements.variablesContainer.appendChild(span);
      });
    } else {
      elements.variablesBar.style.display = 'none';
    }

    elements.rationaleList.innerHTML = '';
    const lines = result.rationale.split('\n').filter((l) => l.trim().length > 0);
    elements.improvementsSummary.textContent = `${lines.length} modifications applied`;
    lines.forEach((line) => {
      const li = document.createElement('li');
      li.textContent = line.replace(/^[-*•\d.]+\s*/, '');
      elements.rationaleList.appendChild(li);
    });

    await Storage.addHistory({
      rawPrompt,
      optimizedPrompt: result.optimizedPrompt,
      rationale: result.rationale,
      preset: currentActivePresetId,
      model: appState.model,
      variables: result.detectedVariables
    });

    appState = await Storage.getState();
    showToast('Prompt refined');

    elements.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    alert(`Optimization error: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    elements.btnOptimize.disabled = false;
    elements.optimizeBtnSpinner.style.display = 'none';
    elements.optimizeBtnText.textContent = 'Refine Prompt';
  }
}

function setResultViewMode(mode) {
  if (mode === 'preview') {
    elements.btnViewPreview?.classList.add('active');
    elements.btnViewRaw?.classList.remove('active');
    if (elements.resultPreview) elements.resultPreview.style.display = 'block';
    if (elements.resultRaw) elements.resultRaw.style.display = 'none';
  } else {
    elements.btnViewPreview?.classList.remove('active');
    elements.btnViewRaw?.classList.add('active');
    if (elements.resultPreview) elements.resultPreview.style.display = 'none';
    if (elements.resultRaw) elements.resultRaw.style.display = 'block';
  }
}

function setSandboxViewMode(mode) {
  if (mode === 'preview') {
    elements.btnSandboxPreview?.classList.add('active');
    elements.btnSandboxRaw?.classList.remove('active');
    if (elements.runnerOutputPreview) elements.runnerOutputPreview.style.display = 'block';
    if (elements.runnerOutputRaw) elements.runnerOutputRaw.style.display = 'none';
  } else {
    elements.btnSandboxPreview?.classList.remove('active');
    elements.btnSandboxRaw?.classList.add('active');
    if (elements.runnerOutputPreview) elements.runnerOutputPreview.style.display = 'none';
    if (elements.runnerOutputRaw) elements.runnerOutputRaw.style.display = 'block';
  }
}

function renderRunnerInputs() {
  if (!currentOptimizationResult) return;
  elements.runnerInputsGrid.innerHTML = '';
  if (elements.runnerOutputWrapper) {
    elements.runnerOutputWrapper.style.display = 'none';
  }
  if (elements.runnerOutputPreview) {
    elements.runnerOutputPreview.innerHTML = '';
  }
  if (elements.runnerOutputRaw) {
    elements.runnerOutputRaw.textContent = '';
  }

  const vars = currentOptimizationResult.detectedVariables;
  if (vars.length === 0) {
    elements.runnerInputsGrid.innerHTML = '<span style="font-size: 11px; color: var(--text-muted);">No variables required. Ready to run directly.</span>';
    return;
  }

  vars.forEach((v) => {
    const row = document.createElement('div');
    row.className = 'sandbox-row';
    row.innerHTML = `
      <label class="sandbox-label" for="sandbox_var_${v}">{{${v}}}</label>
      <input type="text" id="sandbox_var_${v}" class="input-flat sandbox-var-input" data-var="${v}" placeholder="Value for ${v}...">
    `;
    elements.runnerInputsGrid.appendChild(row);
  });
}

async function executePromptTest() {
  if (!currentOptimizationResult) return;
  if (!appState.apiKey) {
    showToast('Gemini API key required');
    return;
  }

  const inputs = elements.runnerInputsGrid.querySelectorAll('.sandbox-var-input');
  const values = {};
  inputs.forEach((input) => {
    values[input.dataset.var] = input.value.trim();
  });

  const filledPrompt = fillVariables(currentOptimizationResult.optimizedPrompt, values);

  elements.btnExecuteTest.disabled = true;
  elements.testBtnSpinner.style.display = 'inline-block';
  elements.testBtnText.textContent = 'Running...';
  if (elements.runnerOutputWrapper) {
    elements.runnerOutputWrapper.style.display = 'block';
  }
  if (elements.runnerOutputPreview) {
    elements.runnerOutputPreview.innerHTML = '<span style="color: var(--text-muted);">Executing with Gemini...</span>';
  }
  if (elements.runnerOutputRaw) {
    elements.runnerOutputRaw.textContent = 'Executing with Gemini...';
  }
  setSandboxViewMode('preview');

  try {
    const output = await GeminiApi.testPrompt({
      apiKey: appState.apiKey,
      model: appState.model,
      promptText: filledPrompt
    });
    if (elements.runnerOutputPreview) {
      elements.runnerOutputPreview.innerHTML = renderMarkdown(output);
    }
    if (elements.runnerOutputRaw) {
      elements.runnerOutputRaw.textContent = output;
    }
  } catch (err) {
    const errMsg = `Error: ${err instanceof Error ? err.message : String(err)}`;
    if (elements.runnerOutputPreview) {
      elements.runnerOutputPreview.innerHTML = `<span style="color: var(--danger);">${errMsg}</span>`;
    }
    if (elements.runnerOutputRaw) {
      elements.runnerOutputRaw.textContent = errMsg;
    }
  } finally {
    elements.btnExecuteTest.disabled = false;
    elements.testBtnSpinner.style.display = 'none';
    elements.testBtnText.textContent = 'Execute Test';
  }
}

function renderLibrary() {
  elements.promptCardsList.innerHTML = '';
  const query = elements.librarySearchInput.value.toLowerCase().trim();
  const prompts = appState.savedPrompts || [];

  const filtered = prompts.filter((p) => {
    if (currentActiveCategoryFilter === 'favorite' && !p.isFavorite) return false;
    if (currentActiveCategoryFilter !== 'all' && currentActiveCategoryFilter !== 'favorite' && p.category !== currentActiveCategoryFilter) {
      return false;
    }
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
      <div class="empty-view">
        <p>No saved prompts found.</p>
      </div>
    `;
    return;
  }

  filtered.forEach((prompt) => {
    const item = document.createElement('article');
    item.className = 'prompt-item';

    const tagsHtml = (prompt.tags || [])
      .map((t) => `<span class="tag-unit">#${t}</span>`)
      .join('');

    item.innerHTML = `
      <div class="prompt-item-head">
        <span class="prompt-item-title">${escapeHtml(prompt.title)}</span>
        <button class="btn-text btn-fav" title="Star" data-id="${prompt.id}">
          ${prompt.isFavorite ? '★' : '☆'}
        </button>
      </div>
      ${prompt.description ? `<p class="prompt-item-desc">${escapeHtml(prompt.description)}</p>` : ''}
      <div class="prompt-item-foot">
        <div class="meta-tags">
          <span class="tag-cat">${prompt.category}</span>
          ${tagsHtml}
        </div>
        <div class="item-actions">
          <button class="tool-btn btn-item-copy">Copy</button>
          <button class="tool-btn btn-item-use">Use</button>
          <button class="btn-text btn-item-del" style="color: var(--text-muted);">&times;</button>
        </div>
      </div>
    `;

    item.querySelector('.btn-fav').addEventListener('click', async (e) => {
      e.stopPropagation();
      const newFav = await Storage.toggleFavorite(prompt.id);
      prompt.isFavorite = newFav;
      renderLibrary();
    });

    item.querySelector('.btn-item-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(prompt.optimizedPrompt || prompt.rawPrompt);
      showToast(`Copied "${prompt.title}"`);
    });

    item.querySelector('.btn-item-use').addEventListener('click', () => {
      elements.rawPromptInput.value = prompt.rawPrompt || prompt.optimizedPrompt;
      updateCharCounter();
      document.querySelector('.nav-segment-btn[data-tab="tab-optimizer"]').click();
      showToast('Loaded into editor');
    });

    item.querySelector('.btn-item-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${prompt.title}"?`)) {
        await Storage.deletePrompt(prompt.id);
        appState = await Storage.getState();
        renderLibrary();
        showToast('Deleted');
      }
    });

    elements.promptCardsList.appendChild(item);
  });
}

function openSaveModal(data) {
  editingPromptId = data.id || null;
  elements.saveModalTitle.textContent = editingPromptId ? 'Edit Prompt' : 'Save Prompt';
  elements.saveModalPromptTitle.value = data.title || '';
  elements.saveModalDescription.value = data.description || '';
  elements.saveModalCategory.value = data.category || 'custom';
  elements.saveModalTags.value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
  elements.savePromptModal.showModal();
}

function closeSaveModal() {
  elements.savePromptModal.close();
  editingPromptId = null;
}

async function confirmSavePrompt() {
  const title = elements.saveModalPromptTitle.value.trim();
  if (!title) {
    alert('Please enter a title.');
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
  showToast(`Saved "${title}"`);
}

function showToast(msg) {
  elements.toastMessage.textContent = msg;
  elements.toastMessage.classList.add('show');
  setTimeout(() => {
    elements.toastMessage.classList.remove('show');
  }, 1800);
}

function showKeyStatus(msg, type) {
  elements.keyStatusAlert.style.display = 'block';
  elements.keyStatusAlert.textContent = msg;
  elements.keyStatusAlert.style.color = type === 'success' ? 'var(--success)' : (type === 'danger' ? 'var(--danger)' : 'var(--text-muted)');
}

function deriveTitleFromPrompt(text) {
  if (!text) return 'Custom Prompt';
  const firstLine = text.trim().split('\n')[0].replace(/^[#*\s-]+/, '').trim();
  return firstLine.slice(0, 32) || 'Custom Prompt';
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

document.addEventListener('DOMContentLoaded', init);
