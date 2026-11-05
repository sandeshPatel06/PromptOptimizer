/**
 * PromptOptimizer - Google Gemini API Client
 * Direct browser-to-API communication using Google's Generative Language API
 */

import { detectVariables, countMetrics } from './prompts.js';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

export const GeminiApi = {
  /**
   * Validates API key without consuming prompt generation tokens
   */
  async validateApiKey(apiKey) {
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim() === '') {
      return { valid: false, error: 'Please enter a valid Google Gemini API key.' };
    }

    const trimmedKey = apiKey.trim();

    try {
      const response = await fetch(`${GEMINI_BASE_URL}/models?key=${encodeURIComponent(trimmedKey)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        const models = (data.models || []).map((m) => m.name.replace('models/', ''));
        return { valid: true, models };
      }

      if (response.status === 400 || response.status === 403) {
        return {
          valid: false,
          error: 'Invalid API key. Please check your key at https://aistudio.google.com/apikey'
        };
      }

      if (response.status === 429) {
        return {
          valid: false,
          error: 'Rate limit or quota exceeded. Verify billing or free tier quota on Google AI Studio.'
        };
      }

      return {
        valid: false,
        error: `Google API returned status ${response.status}: ${response.statusText}`
      };
    } catch (err) {
      return {
        valid: false,
        error: err instanceof Error ? `Network error: ${err.message}` : 'Failed to reach Google Gemini API'
      };
    }
  },

  /**
   * Optimizes a raw prompt using the selected Gemini model and preset
   */
  async optimizePrompt({ apiKey, model = 'gemini-1.5-flash', rawPrompt, presetInstruction = '', customInstructions = '' }) {
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing. Configure it in Settings or Onboarding.');
    }

    const trimmedPrompt = rawPrompt.trim();
    if (!trimmedPrompt) {
      throw new Error('Input prompt cannot be empty.');
    }

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

    const targetModel = model || 'gemini-1.5-flash';
    const endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      let errorMsg = `API request failed with status ${response.status}`;
      try {
        const errorData = await response.json();
        if (errorData?.error?.message) {
          errorMsg = errorData.error.message;
        }
      } catch {
        // ignore parse error
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidate) {
      throw new Error('Gemini API returned an empty completion response.');
    }

    // Extract optimized prompt and rationale
    let optimizedPrompt = '';
    let rationale = '';

    const promptMatch = candidate.match(/<<<OPTIMIZED_PROMPT>>>([\s\S]*?)<<<END_OPTIMIZED_PROMPT>>>/);
    const rationaleMatch = candidate.match(/<<<RATIONALE>>>([\s\S]*?)<<<END_RATIONALE>>>/);

    if (promptMatch && promptMatch[1]) {
      optimizedPrompt = promptMatch[1].trim();
    } else {
      // Fallback if delimiters were partially omitted
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
      metrics: {
        beforeWords: beforeMetrics.words,
        afterWords: afterMetrics.words,
        estimatedTokens: afterMetrics.estimatedTokens
      }
    };
  },

  /**
   * Executes a prompt with Gemini to test it live inside the sidebar
   */
  async testPrompt({ apiKey, model = 'gemini-1.5-flash', promptText }) {
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing.');
    }

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

    const targetModel = model || 'gemini-1.5-flash';
    const endpoint = `${GEMINI_BASE_URL}/models/${targetModel}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

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

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!resultText) {
      return '(No response generated)';
    }

    return resultText.trim();
  }
};
