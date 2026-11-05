/**
 * PromptOptimizer - Background Service Worker
 * Handles Side Panel behavior, browser action clicks, and context menus
 */

// Cross-browser API adapter
const extApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

// Configure Side Panel behavior for Chromium browsers (Chrome, Edge, Brave, Opera)
if (extApi?.sidePanel?.setPanelBehavior) {
  extApi.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((err) => console.log('[PromptOptimizer] Side panel behavior set error:', err));
}

// Action click fallback
if (extApi?.action?.onClicked) {
  extApi.action.onClicked.addListener(async (tab) => {
    // If Firefox with sidebarAction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyBrowser = globalThis.browser || extApi;
    if (anyBrowser?.sidebarAction?.open) {
      try {
        await anyBrowser.sidebarAction.open();
        return;
      } catch (e) {
        console.log('[PromptOptimizer] Firefox sidebarAction error:', e);
      }
    }

    // Chromium fallback if openPanelOnActionClick isn't active
    if (extApi?.sidePanel?.open && tab?.windowId) {
      try {
        await extApi.sidePanel.open({ windowId: tab.windowId });
      } catch (e) {
        console.log('[PromptOptimizer] Sidepanel open fallback error:', e);
      }
    }
  });
}

// Context Menu: "Optimize in PromptOptimizer"
if (extApi?.runtime?.onInstalled) {
  extApi.runtime.onInstalled.addListener(() => {
    if (extApi.contextMenus) {
      extApi.contextMenus.create({
        id: 'optimize-selection-in-sidebar',
        title: 'Optimize in PromptOptimizer',
        contexts: ['selection']
      });
    }
  });
}

if (extApi?.contextMenus?.onClicked) {
  extApi.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'optimize-selection-in-sidebar' && info.selectionText) {
      // Store selected text as pending prompt
      if (extApi.storage?.local) {
        await extApi.storage.local.set({ pendingPrompt: info.selectionText.trim() });
      }

      // Open sidepanel if in Chromium
      if (extApi.sidePanel?.open && tab?.windowId) {
        try {
          await extApi.sidePanel.open({ windowId: tab.windowId });
        } catch (err) {
          console.log('[PromptOptimizer] Context menu open sidepanel error:', err);
        }
      }
    }
  });
}
