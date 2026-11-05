/**
 * PromptOptimizer - Google Gemini API Client
 * Direct browser-to-API communication with dynamic model resolution,
 * automatic fallback handling, and self-healing for model version changes.
 */

import { detectVariables, countMetrics } from './prompts.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const GeminiApi = {
  cachedModels: [],

  /**
   * Fetches models directly from Google ModelService that support generateContent
   */
  async getAvailableModels(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return [];
    }

    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models?key=${encodeURIComponent(apiKey.trim())}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        const supported = (data.models || [])
          .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));

        this.cachedModels = supported;
        return supported;
      }
    } catch (err) {
      console.warn('[PromptOptimizer] getAvailableModels error:', err);
    }

    return [];
  },

  /**
   * Resolves the best available working model name to prevent "model not found" errors
   */
  async resolveWorkingModel(apiKey, preferredModel = 'gemini-1.5-flash') {
    const cleanPreferred = (preferredModel || '').replace(/^models\//, '').trim();

    let models = this.cachedModels;
    if (!models || models.length === 0) {
      models = await this.getAvailableModels(apiKey);
    }

    if (!models || models.length === 0) {
      return cleanPreferred || 'gemini-1.5-flash';
    }

    // 1. Exact match
    if (models.includes(cleanPreferred)) {
      return cleanPreferred;
    }

    // 2. Starts with preferred (e.g., gemini-1.5-flash-latest, gemini-1.5-flash-002, gemini-1.5-flash-001)
    const variant = models.find((m) => m.startsWith(cleanPreferred));
    if (variant) return variant;

    // 3. Any 1.5 flash variant
    const flash15 = models.find((m) => m.includes('1.5-flash') || m.includes('1.5_flash'));
    if (flash15) return flash15;

    // 4. Any flash model (e.g. gemini-2.0-flash, gemini-2.5-flash)
    const anyFlash = models.find((m) => m.includes('flash'));
    if (anyFlash) return anyFlash;

    // 5. Any Gemini model supporting generateContent
    const anyGemini = models.find((m) => m.includes('gemini'));
    if (anyGemini) return anyGemini;

    // 6. First supported model
    return models[0] || cleanPreferred || 'gemini-1.5-flash';
  },

  /**
   * Validates API key and returns list of supported generation models
   */
  async validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return { valid: false, error: 'Please enter a valid Google Gemini API key.' };
    }

    const trimmedKey = apiKey.trim();

    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models?key=${encodeURIComponent(trimmedKey)}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || [])
          .filter((m) => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
          .map((m) => m.name.replace(/^models\//, ''));

        this.cachedModels = models;
        return { valid: true, models };
      }

      if (response.status === 400 || response.status === 403) {
        return {
          valid: false,
          error: 'Invalid API key. Verify your key at https://aistudio.google.com/apikey'
        };
      }

      if (response.status === 429) {
        return {
          valid: false,
          error: 'Rate limit or quota exceeded. Check Google AI Studio billing/quota.'
        };
      }

      return {
        valid: false,
        error: `Google API error (${response.status}): ${response.statusText}`
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? `Network error: ${err.message}` : 'Failed to reach Google Gemini API'
      };
    }
  },

  /**
   * Helper to parse the completion response into structured result
   */
  parseCompletionResult(candidate, rawPrompt, usedModel) {
    let optimizedPrompt = '';
    let rationale = '';

    const promptMatch = candidate.match(/<<<OPTIMIZED_PROMPT>>>([\s\S]*?)<<<END_OPTIMIZED_PROMPT>>>/);
    const rationaleMatch = candidate.match(/<<<RATIONALE>>>([\s\S]*?)<<<END_RATIONALE>>>/);

    if (promptMatch && promptMatch[1]) {
      optimizedPrompt = promptMatch[1].trim();
    } else {
      optimizedPrompt = candidate.trim();
    }

    if (rationaleMatch && rationaleMatch[1]) {
      rationale = rationaleMatch[1].trim();
    } else {
      rationale = 'Structured inputs, eliminated ambiguity, and enforced explicit output constraints.';
    }

    const detectedVariables = detectVariables(optimizedPrompt);
    const beforeMetrics = countMetrics(rawPrompt);
    const afterMetrics = countMetrics(optimizedPrompt);

    return {
      optimizedPrompt,
      rationale,
      detectedVariables,
      usedModel,
      metrics: {
        beforeWords: beforeMetrics.words,
        afterWords: afterMetrics.words,
        estimatedTokens: afterMetrics.estimatedTokens
      }
    };
  },

  /**
   * Optimizes a raw prompt using the best available Gemini model
   */
  async optimizePrompt({ apiKey, model = 'gemini-1.5-flash', rawPrompt, presetInstruction = '', customInstructions = '' }) {
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing. Configure it in Settings.');
    }

    const trimmedPrompt = rawPrompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Input prompt cannot be empty.');
    }

    // Dynamically resolve working model
    let targetModel = await this.resolveWorkingModel(apiKey, model);

    const systemPrompt = `You are a Principal Prompt Engineer and LLM Architect. 
Your mission is to transform user prompts from vague, brittle, or ambiguous drafts into production-grade, highly-deterministic, bulletproof prompts.

## OPTIMIZATION METHODOLOGY:
1. **Role Framing**: Establish a world-class specialist persona with explicit standards.
2. **Context & Objective**: Define the precise problem space and high-stakes goal.
3. **Structured Inputs**: Use {{variable_name}} syntax whenever the prompt expects user-supplied data, text snippets, or parameters.
4. **Actionable Constraints**: Enforce strict boundary conditions, negative constraints (what NOT to do), and edge-case handling.
5. **Output Contract**: Provide a structured schema or format (e.g. JSON, Markdown tables, or step-by-step sections).
6. **Eliminate Fluff**: Cut pleasantries, filler, and vague buzzwords.

${presetInstruction ? `## STRATEGY DIRECTIVE:\n${presetInstruction}\n` : ''}
${customInstructions ? `## USER CUSTOM GUIDELINES:\n${customInstructions}\n` : ''}

## OUTPUT FORMAT:
You MUST structure your entire response using the exact two markdown code delimiters below:

<<<OPTIMIZED_PROMPT>>>
[Insert the fully optimized, production-ready prompt here. Maintain {{variable}} placeholders where dynamic data belongs.]
<<<END_OPTIMIZED_PROMPT>>>

<<<RATIONALE>>>
[Provide 3 to 5 concise bullet points explaining the surgical improvements made (e.g., added constraints, eliminated ambiguity, introduced variables).]
<<<END_RATIONALE>>>`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `${systemPrompt}\n\n## RAW USER PROMPT TO OPTIMIZE:\n"""\n${trimmedPrompt}\n"""`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048
      }
    };

    let endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Self-healing fallback if model is not found or unsupported on this account
    if (!response.ok) {
      let errorMsg = `API request failed (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch {
        // ignore
      }

      // Check for model not found / unsupported error
      if (response.status === 404 || errorMsg.includes('not found') || errorMsg.includes('not supported for generateContent')) {
        console.warn(`[PromptOptimizer] Model ${targetModel} not found. Attempting dynamic resolution...`);
        const available = await this.getAvailableModels(apiKey);
        const fallback = await this.resolveWorkingModel(apiKey, 'flash');

        if (fallback && fallback !== targetModel) {
          console.log(`[PromptOptimizer] Auto-retrying with active model: ${fallback}`);
          targetModel = fallback;
          endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
          response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }
      }

      if (!response.ok) {
        throw new Error(errorMsg);
      }
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
      throw new Error('Gemini API returned an empty completion response.');
    }

    return this.parseCompletionResult(candidate, rawPrompt, targetModel);
  },

  /**
   * Executes a prompt with Gemini to test it live inside the sidebar
   */
  async testPrompt({ apiKey, model = 'gemini-1.5-flash', promptText }) {
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing.');
    }

    let targetModel = await this.resolveWorkingModel(apiKey, model);

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: promptText }]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    };

    let endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    let response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Self-healing fallback
      const available = await this.getAvailableModels(apiKey);
      const fallback = await this.resolveWorkingModel(apiKey, 'flash');
      if (fallback && fallback !== targetModel) {
        targetModel = fallback;
        endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        let errorMsg = `Test execution failed (${response.status})`;
        try {
          const errorData = await response.json();
          if (errorData?.error?.message) {
            errorMsg = errorData.error.message;
          }
        } catch {
          // ignore
        }
        throw new Error(errorMsg);
      }
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return '(No response generated)';
    }

    return resultText.trim();
  }
};
