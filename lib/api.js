/**
 * PromptOptimizer - Cloudflare Workers AI Client
 * Connects directly to the custom Cloudflare Workers AI Gateway.
 * Zero-login, zero-API-key out-of-the-box text optimization using Meta Llama 3.1 8B.
 */

export const DEFAULT_GATEWAY_URL = 'https://prompt-optimizer-api.patelbr5118s.workers.dev';

export const OptimizerApi = {
  gatewayUrl: DEFAULT_GATEWAY_URL,

  setGatewayUrl(url) {
    if (url && typeof url === 'string' && url.trim()) {
      this.gatewayUrl = url.trim().replace(/\/+$/, '');
    } else {
      this.gatewayUrl = DEFAULT_GATEWAY_URL;
    }
  },

  /**
   * Health check to verify AI gateway availability
   */
  async checkHealth() {
    try {
      const response = await fetch(`${this.gatewayUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        return await response.json();
      }
    } catch (err) {
      console.warn('[PromptOptimizer] Gateway health check failed:', err);
    }
    return { status: 'offline' };
  },

  /**
   * Optimizes a user prompt using the Cloudflare Workers AI backend
   */
  async optimizePrompt({ rawPrompt, presetInstruction = '', customInstructions = '' }) {
    if (!rawPrompt || !rawPrompt.trim()) {
      throw new Error('Prompt input is empty.');
    }

    const payload = {
      rawPrompt: rawPrompt.trim(),
      presetInstruction: presetInstruction || '',
      customInstructions: customInstructions || ''
    };

    const response = await fetch(`${this.gatewayUrl}/api/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `Gateway request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMsg = errorData.error;
        }
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();

    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    return {
      optimizedPrompt: data.optimizedPrompt,
      rationale: data.rationale || 'Engineered role framing, added constraints, and structured output expectations.',
      detectedVariables: Array.isArray(data.detectedVariables) ? data.detectedVariables : [],
      metrics: data.metrics || {
        words: data.optimizedPrompt.trim().split(/\s+/).filter(Boolean).length,
        characters: data.optimizedPrompt.length,
        estimatedTokens: Math.ceil(data.optimizedPrompt.length / 3.8)
      },
      usedModel: 'Llama 3.1 8B (Cloudflare Workers AI)'
    };
  },

  /**
   * Executes a test prompt against the Cloudflare Workers AI backend
   */
  async testPrompt({ promptText }) {
    if (!promptText || !promptText.trim()) {
      throw new Error('Prompt text cannot be empty.');
    }

    const response = await fetch(`${this.gatewayUrl}/api/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ promptText: promptText.trim() })
    });

    if (!response.ok) {
      let errorMsg = `Test execution failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.error) {
          errorMsg = errorData.error;
        }
      } catch {
        // ignore
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    if (!data.success && data.error) {
      throw new Error(data.error);
    }

    return data.response ? data.response.trim() : '(No response generated)';
  }
};
