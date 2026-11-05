/**
 * PromptOptimizer - Permissions Management Service
 * Detects, validates, and dynamically requests permissions using the WebExtensions Permissions API.
 */

const extApi = typeof chrome !== 'undefined' ? chrome : (typeof browser !== 'undefined' ? browser : null);

export const Permissions = {
  /**
   * The host origin required for Cloudflare Workers AI Gateway
   */
  REQUIRED_ORIGINS: ['https://prompt-optimizer-api.patelbr5118s.workers.dev/*'],

  /**
   * Optional permissions that can be requested on-demand
   */
  OPTIONAL_PERMISSIONS: ['clipboardRead', 'tabs'],

  /**
   * Checks the status of all permissions
   */
  async checkAll() {
    if (!extApi?.permissions?.getAll) {
      // Running in standard browser tab outside extension sandbox
      return {
        isExtension: false,
        allGranted: true,
        permissions: [],
        origins: [],
        missing: []
      };
    }

    return new Promise((resolve) => {
      extApi.permissions.getAll((current) => {
        const grantedPerms = new Set(current.permissions || []);
        const grantedOrigins = new Set(current.origins || []);

        const missing = [];

        // Check Cloudflare AI Gateway origin
        const hasGatewayOrigin = this.REQUIRED_ORIGINS.every((orig) => {
          return Array.from(grantedOrigins).some((g) => g.includes('prompt-optimizer-api.patelbr5118s.workers.dev') || g === '<all_urls>');
        });

        if (!hasGatewayOrigin) {
          missing.push('Cloudflare AI Gateway Network Access');
        }

        // Check essential permissions
        const essential = ['storage', 'clipboardWrite'];
        for (const p of essential) {
          if (!grantedPerms.has(p)) {
            missing.push(p);
          }
        }

        resolve({
          isExtension: true,
          allGranted: missing.length === 0,
          permissions: Array.from(grantedPerms),
          origins: Array.from(grantedOrigins),
          hasClipboardRead: grantedPerms.has('clipboardRead'),
          hasTabs: grantedPerms.has('tabs'),
          hasGatewayOrigin,
          missing
        });
      });
    });
  },

  /**
   * Prompts the browser's native permission dialog to request missing permissions.
   * MUST be called from a user gesture (e.g. click).
   */
  async request(permissions = [], origins = []) {
    if (!extApi?.permissions?.request) {
      return true;
    }

    return new Promise((resolve) => {
      const requestPayload = {};
      if (permissions.length > 0) requestPayload.permissions = permissions;
      if (origins.length > 0) requestPayload.origins = origins;

      try {
        extApi.permissions.request(requestPayload, (granted) => {
          if (extApi.runtime?.lastError) {
            console.warn('[PromptOptimizer] Permission request warning:', extApi.runtime.lastError);
            resolve(false);
          } else {
            resolve(Boolean(granted));
          }
        });
      } catch (err) {
        console.error('[PromptOptimizer] Permission request error:', err);
        resolve(false);
      }
    });
  },

  /**
   * Requests Cloudflare AI Gateway host permissions if not already granted
   */
  async requestGatewayHost() {
    return this.request([], this.REQUIRED_ORIGINS);
  },

  /**
   * Requests clipboard reading permission when user clicks "Paste"
   */
  async requestClipboardRead() {
    return this.request(['clipboardRead']);
  },

  /**
   * Requests tabs permission when user clicks "Attach Tab Context"
   */
  async requestTabs() {
    return this.request(['tabs']);
  }
};
