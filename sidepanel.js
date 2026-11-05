/**
 * PromptOptimizer - Main UI Controller (Production AI Gateway)
 * Native <dialog>, IME safety, container-aware layout, and zero-login Cloudflare Workers AI integration.
 */

import { Storage } from './lib/storage.js';
import { OptimizerApi, DEFAULT_GATEWAY_URL } from './lib/api.js';
import { Permissions } from './lib/permissions.js';
import { OPTIMIZATION_PRESETS, detectVariables, fillVariables, countMetrics } from './lib/prompts.js';
import { renderMarkdown } from './lib/markdown.js';

const elements = {
  statusDot: document.getElementById('statusDot'),
  quotaBadgeText: document.getElementById('quotaBadgeText'),
  gatewayPill: document.getElementById('gatewayPill'),
  btnPopOut: document.getElementById('btnPopOut'),
  btnHeaderSettings: document.getElementById('btnHeaderSettings'),
  
  navSegmentBtns: document.querySelectorAll('.nav-segment-btn'),
  panes: document.querySelectorAll('.pane'),
  
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
  
  // Settings Dialog
  settingsModal: document.getElementById('settingsModal'),
  btnCloseSettingsModal: document.getElementById('btnCloseSettingsModal'),
  settingsGatewayUrl: document.getElementById('settingsGatewayUrl'),
  btnTestGateway: document.getElementById('btnTestGateway'),
  gatewayStatusAlert: document.getElementById('gatewayStatusAlert'),
  settingsQuotaDaily: document.getElementById('settingsQuotaDaily'),
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

  // Configure Gateway
  const gateway = appState.gatewayUrl || DEFAULT_GATEWAY_URL;
  OptimizerApi.setGatewayUrl(gateway);
  if (elements.settingsGatewayUrl) {
    elements.settingsGatewayUrl.value = gateway;
  }
  if (elements.settingsSystemInstructions) {
    elements.settingsSystemInstructions.value = appState.systemInstructions || '';
  }

  renderPresets();
  await updateQuotaDisplay();
  await checkGatewayStatus();
  await checkPermissionsHealth();

  if (appState.pendingPrompt) {
    elements.rawPromptInput.value = appState.pendingPrompt;
    updateCharCounter();
    await Storage.set({ pendingPrompt: '' });
  }

  setupEventListeners();
  renderLibrary();
}

/**
 * Checks AI Gateway status and sets topbar indicator
 */
async function checkGatewayStatus() {
  try {
    const health = await OptimizerApi.checkHealth();
    if (health.status === 'online') {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-indicator online';
      }
      if (elements.gatewayPill) {
        elements.gatewayPill.title = `AI Gateway: Online (${health.model || 'Llama 3.1 8B'})`;
      }
    } else {
      if (elements.statusDot) {
        elements.statusDot.className = 'status-indicator offline';
      }
      if (elements.gatewayPill) {
        elements.gatewayPill.title = 'AI Gateway: Offline';
      }
    }
  } catch {
    if (elements.statusDot) {
      elements.statusDot.className = 'status-indicator offline';
    }
  }
}

/**
 * Displays live quota remaining to the user
 */
async function updateQuotaDisplay() {
  const remaining = await Storage.getDailyRemaining(100);
  if (elements.quotaBadgeText) {
    elements.quotaBadgeText.textContent = `${remaining}/100 Free`;
  }
  if (elements.settingsQuotaDaily) {
    elements.settingsQuotaDaily.textContent = `${remaining} / 100 requests remaining`;
  }
}

async function checkPermissionsHealth() {
  const permStatus = await Permissions.checkAll();
  renderPermissionDiagnostics(permStatus);
}

function renderPermissionDiagnostics(status) {
  if (!elements.permDiagList) return;
  elements.permDiagList.innerHTML = '';

  const list = [
    {
      name: 'Cloudflare AI Gateway Access',
      granted: status.hasGatewayOrigin,
      onRequest: async () => {
        const ok = await Permissions.requestGatewayHost();
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

function setupEventListeners() {
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

  // Native HTML5 <dialog> for Settings
  elements.btnHeaderSettings.addEventListener('click', async () => {
    elements.settingsGatewayUrl.value = appState.gatewayUrl || DEFAULT_GATEWAY_URL;
    elements.settingsSystemInstructions.value = appState.systemInstructions || '';
    await updateQuotaDisplay();
    await checkPermissionsHealth();
    elements.settingsModal.showModal();
  });

  elements.btnCloseSettingsModal.addEventListener('click', () => {
    elements.settingsModal.close();
  });

  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.close();
    }
  });

  // IME-Safe Input Character Counter
  elements.rawPromptInput.addEventListener('input', (e) => {
    if (e.isComposing) return;
    updateCharCounter();
  });

  elements.rawPromptInput.addEventListener('compositionend', () => {
    updateCharCounter();
  });

  // Keyboard shortcut: Cmd/Ctrl + Enter to refine
  elements.rawPromptInput.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      executeOptimization();
    }
  });

  // Paste Action with Permission Handling
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

  // Optimize Prompt
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

  // Settings: Ping AI Gateway
  if (elements.btnTestGateway) {
    elements.btnTestGateway.addEventListener('click', async () => {
      const url = elements.settingsGatewayUrl.value.trim() || DEFAULT_GATEWAY_URL;
      OptimizerApi.setGatewayUrl(url);
      showGatewayStatus('Testing gateway...', 'muted');
      const health = await OptimizerApi.checkHealth();
      if (health.status === 'online') {
        showGatewayStatus(`✓ Online: ${health.service || 'AI Gateway'} (${health.model || 'Llama 3.1 8B'})`, 'success');
        await checkGatewayStatus();
      } else {
        showGatewayStatus('✗ Gateway unreachable. Check URL or network.', 'danger');
      }
    });
  }

  // Settings: Save Changes
  elements.btnSaveAllSettings.addEventListener('click', async () => {
    const gateway = elements.settingsGatewayUrl.value.trim() || DEFAULT_GATEWAY_URL;
    const instructions = elements.settingsSystemInstructions.value.trim();

    appState.gatewayUrl = gateway;
    appState.systemInstructions = instructions;
    OptimizerApi.setGatewayUrl(gateway);

    await Storage.set({
      gatewayUrl: gateway,
      systemInstructions: instructions
    });

    await checkGatewayStatus();
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

  elements.importFileInput.addEventListener('change', (e) => {
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
      await Storage.clearAll();
      appState = await Storage.getState();
      renderPresets();
      renderLibrary();
      await updateQuotaDisplay();
      elements.settingsModal.close();
      showToast('Reset completed');
    }
  });

  elements.btnRequestAllPerms.addEventListener('click', async () => {
    const granted = await Permissions.requestGatewayHost();
    if (granted) {
      showToast('All permissions granted');
      await checkPermissionsHealth();
    }
  });
}

function updateCharCounter() {
  const text = elements.rawPromptInput.value;
  const metrics = countMetrics(text);
  elements.inputCharCounter.textContent = `${metrics.chars} chars • ~${metrics.tokens} tokens`;
}

function showGatewayStatus(text, variant) {
  if (!elements.gatewayStatusAlert) return;
  elements.gatewayStatusAlert.style.display = 'block';
  elements.gatewayStatusAlert.textContent = text;
  elements.gatewayStatusAlert.className = `form-hint ${variant}`;
}

async function executeOptimization() {
  const rawPrompt = elements.rawPromptInput.value.trim();
  if (!rawPrompt) {
    elements.rawPromptInput.focus();
    return;
  }

  // Check remaining quota locally before request
  const remaining = await Storage.getDailyRemaining(100);
  if (remaining <= 0) {
    showToast('Daily quota of 100 requests reached. Resets in 24 hours.');
    return;
  }

  elements.btnOptimize.disabled = true;
  elements.optimizeBtnSpinner.style.display = 'inline-block';
  elements.optimizeBtnText.textContent = 'Refining...';

  const activePreset = OPTIMIZATION_PRESETS.find((p) => p.id === currentActivePresetId);

  try {
    const result = await OptimizerApi.optimizePrompt({
      rawPrompt,
      presetInstruction: activePreset?.instruction || '',
      customInstructions: appState.systemInstructions || ''
    });

    currentOptimizationResult = result;

    // Record usage and update quota counter
    await Storage.recordUsage();
    await updateQuotaDisplay();

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
      model: result.usedModel || 'Llama 3.1 8B',
      variables: result.detectedVariables
    });

    appState = await Storage.getState();
    showToast('Prompt refined');

    elements.resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Rate limit') || msg.includes('429')) {
      showToast('Burst limit reached. Please wait 15 seconds.');
    } else {
      showToast(`Error: ${msg}`);
    }
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
    elements.runnerOutputPreview.innerHTML = '<span style="color: var(--text-muted);">Executing with Cloudflare AI...</span>';
  }
  if (elements.runnerOutputRaw) {
    elements.runnerOutputRaw.textContent = 'Executing with Cloudflare AI...';
  }
  setSandboxViewMode('preview');

  try {
    const output = await OptimizerApi.testPrompt({
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
      const matchTitle = (p.title || '').toLowerCase().includes(query);
      const matchDesc = (p.description || '').toLowerCase().includes(query);
      const matchTags = (p.tags || []).some((t) => t.toLowerCase().includes(query));
      return matchTitle || matchDesc || matchTags;
    }
    return true;
  });

  if (filtered.length === 0) {
    elements.promptCardsList.innerHTML = `
      <div style="padding: 24px 16px; text-align: center; color: var(--text-muted); font-size: 11.5px;">
        No prompts found matching your search.
      </div>
    `;
    return;
  }

  filtered.forEach((prompt) => {
    const item = document.createElement('div');
    item.className = 'library-item';
    item.dataset.id = prompt.id;

    const tagsHtml = (prompt.tags || [])
      .map((t) => `<span class="library-tag">${t}</span>`)
      .join('');

    item.innerHTML = `
      <div class="library-item-head">
        <div class="library-item-title-row">
          <button class="btn-fav ${prompt.isFavorite ? 'active' : ''}" title="Star prompt" aria-label="Star prompt">★</button>
          <span class="library-item-title">${escapeHtml(prompt.title)}</span>
        </div>
        <span class="library-category-badge">${prompt.category || 'custom'}</span>
      </div>
      <p class="library-item-desc">${escapeHtml(prompt.description || prompt.optimizedPrompt.slice(0, 90) + '...')}</p>
      <div class="library-item-foot">
        <div class="library-tags-list">${tagsHtml}</div>
        <div class="library-actions">
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
  elements.saveModalCategory.value = data.category || 'custom';
  elements.saveModalTags.value = Array.isArray(data.tags) ? data.tags.join(', ') : '';
  elements.saveModalDescription.value = data.description || '';
  elements.savePromptModal.showModal();
}

function closeSaveModal() {
  elements.savePromptModal.close();
}

async function confirmSavePrompt() {
  const title = elements.saveModalPromptTitle.value.trim();
  if (!title) {
    elements.saveModalPromptTitle.focus();
    return;
  }

  const category = elements.saveModalCategory.value;
  const tags = elements.saveModalTags.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const description = elements.saveModalDescription.value.trim();

  let optimizedPrompt = '';
  let rawPrompt = '';
  let variables = [];

  if (currentOptimizationResult) {
    optimizedPrompt = currentOptimizationResult.optimizedPrompt;
    rawPrompt = elements.rawPromptInput.value;
    variables = currentOptimizationResult.detectedVariables;
  } else {
    rawPrompt = elements.rawPromptInput.value;
    optimizedPrompt = rawPrompt;
  }

  const promptObj = {
    id: editingPromptId || 'prompt_' + Date.now().toString(36),
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
  }, 2000);
}

function deriveTitleFromPrompt(text) {
  const firstLine = text.trim().split('\n')[0].replace(/^#+\s*/, '').trim();
  if (firstLine.length > 36) {
    return firstLine.slice(0, 36) + '...';
  }
  return firstLine || 'Engineered Prompt';
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
