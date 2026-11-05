/**
 * PromptOptimizer - Production Cloudflare Workers AI Gateway
 * Enterprise-grade security, anti-abuse rate limiting, daily quota tracking,
 * and zero-login prompt optimization powered by Meta Llama 3.1 8B FP8.
 */

const AI_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
const APP_CLIENT_HEADER = 'promptoptimizer-client';
const MAX_PROMPT_LENGTH = 10000;

// Production Quota & Throttling Limits
const LIMITS = {
  BURST_PER_MINUTE: 15,     // Max 15 calls per minute per IP
  DAILY_QUOTA: 100,         // Max 100 optimizations per 24 hours per IP
  WINDOW_MINUTE_MS: 60 * 1000,
  WINDOW_DAY_MS: 24 * 60 * 60 * 1000
};

// In-Memory sliding-window rate tracking (per worker edge instance)
const rateLimits = new Map();

/**
 * Periodically cleans up expired rate limit entries to prevent memory leaks
 */
function cleanupRateLimits() {
  const now = Date.now();
  for (const [ip, data] of rateLimits.entries()) {
    if (now - data.firstSeen > LIMITS.WINDOW_DAY_MS) {
      rateLimits.delete(ip);
    }
  }
}

/**
 * Evaluates rate limit and daily quota for a client IP
 */
function checkRateLimit(clientIp) {
  const now = Date.now();
  let record = rateLimits.get(clientIp);

  if (!record || (now - record.windowStart) > LIMITS.WINDOW_DAY_MS) {
    record = {
      windowStart: now,
      firstSeen: now,
      dailyCount: 0,
      minuteCalls: []
    };
    rateLimits.set(clientIp, record);
  }

  // Filter calls within the last 60 seconds
  record.minuteCalls = record.minuteCalls.filter(t => (now - t) < LIMITS.WINDOW_MINUTE_MS);

  // 1. Check Burst Limit (per minute)
  if (record.minuteCalls.length >= LIMITS.BURST_PER_MINUTE) {
    const oldest = record.minuteCalls[0];
    const retryAfterSeconds = Math.max(1, Math.ceil((LIMITS.WINDOW_MINUTE_MS - (now - oldest)) / 1000));
    return {
      allowed: false,
      reason: 'BURST_LIMIT',
      message: `Rate limit exceeded. Maximum ${LIMITS.BURST_PER_MINUTE} requests per minute.`,
      retryAfter: retryAfterSeconds,
      remainingDaily: Math.max(0, LIMITS.DAILY_QUOTA - record.dailyCount)
    };
  }

  // 2. Check 24-Hour Daily Quota
  if (record.dailyCount >= LIMITS.DAILY_QUOTA) {
    const resetsInSeconds = Math.max(1, Math.ceil((LIMITS.WINDOW_DAY_MS - (now - record.windowStart)) / 1000));
    return {
      allowed: false,
      reason: 'DAILY_QUOTA',
      message: `Daily free quota of ${LIMITS.DAILY_QUOTA} requests reached. Resets in ${Math.ceil(resetsInSeconds / 3600)} hours.`,
      retryAfter: resetsInSeconds,
      remainingDaily: 0
    };
  }

  // Increment usage
  record.minuteCalls.push(now);
  record.dailyCount += 1;

  if (Math.random() < 0.05) {
    cleanupRateLimits();
  }

  return {
    allowed: true,
    remainingDaily: LIMITS.DAILY_QUOTA - record.dailyCount,
    remainingMinute: LIMITS.BURST_PER_MINUTE - record.minuteCalls.length,
    dailyLimit: LIMITS.DAILY_QUOTA
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-App',
  'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After',
  'Content-Type': 'application/json'
};

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const clientIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';

    // 2. Health & Status Check: GET / or GET /health
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        service: 'PromptOptimizer Production Gateway',
        model: AI_MODEL,
        limits: {
          burstPerMinute: LIMITS.BURST_PER_MINUTE,
          dailyQuota: LIMITS.DAILY_QUOTA
        },
        timestamp: new Date().toISOString()
      }), { headers: CORS_HEADERS });
    }

    // 3. Quota Status: GET /api/quota
    if (url.pathname === '/api/quota' && request.method === 'GET') {
      const record = rateLimits.get(clientIp);
      const usedToday = record ? record.dailyCount : 0;
      const remaining = Math.max(0, LIMITS.DAILY_QUOTA - usedToday);
      return new Response(JSON.stringify({
        dailyLimit: LIMITS.DAILY_QUOTA,
        remainingToday: remaining,
        usedToday: usedToday,
        burstPerMinute: LIMITS.BURST_PER_MINUTE
      }), { headers: CORS_HEADERS });
    }

    // 4. Rate Limiting Guard on API endpoints
    if (url.pathname.startsWith('/api/')) {
      const rateCheck = checkRateLimit(clientIp);
      if (!rateCheck.allowed) {
        return new Response(JSON.stringify({
          error: rateCheck.message,
          code: rateCheck.reason,
          retryAfter: rateCheck.retryAfter,
          remainingDaily: rateCheck.remainingDaily
        }), {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            'Retry-After': String(rateCheck.retryAfter),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Limit': String(LIMITS.DAILY_QUOTA)
          }
        });
      }
    }

    // 5. Endpoint: POST /api/optimize
    if (url.pathname === '/api/optimize' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { rawPrompt, presetInstruction, customInstructions } = body;

        // Security Validation
        if (!rawPrompt || typeof rawPrompt !== 'string' || !rawPrompt.trim()) {
          return new Response(JSON.stringify({ error: 'rawPrompt string is required.' }), {
            status: 400,
            headers: CORS_HEADERS
          });
        }

        if (rawPrompt.length > MAX_PROMPT_LENGTH) {
          return new Response(JSON.stringify({
            error: `Payload too large. Maximum prompt length is ${MAX_PROMPT_LENGTH} characters.`
          }), {
            status: 413,
            headers: CORS_HEADERS
          });
        }

        const systemMessage = `You are an elite Prompt Engineer and AI Optimization Specialist.
Your mission is to transform raw, vague, or draft user prompts into deterministic, production-grade AI instructions.

OPTIMIZATION RULES:
1. Establish a precise role and domain authority persona.
2. Structure the prompt with clear operational context, task definition, and explicit constraints.
3. Automatically detect dynamic parameters that the user will supply at runtime and wrap them in double curly braces (e.g. {{variable_name}}).
4. Remove all conversational filler, pleasantries, and AI-slop buzzwords.
5. Define the exact desired output format (e.g., Markdown structure, JSON schema, or step-by-step reasoning).
${presetInstruction ? `\nSTRATEGY DIRECTIVE:\n${presetInstruction}` : ''}
${customInstructions ? `\nUSER CUSTOM PREFERENCES:\n${customInstructions}` : ''}

You MUST reply with ONLY a valid, raw JSON object (no markdown code blocks, no backticks, no prefix or suffix text) matching this exact schema:
{
  "optimizedPrompt": "The fully engineered prompt ready for execution, containing {{variables}} where dynamic inputs are needed.",
  "rationale": "Bullet 1 explaining improvements\\nBullet 2 explaining edge-case handling\\nBullet 3 explaining output constraints",
  "detectedVariables": ["list", "of", "variable_names"]
}`;

        const aiResponse = await env.AI.run(AI_MODEL, {
          messages: [
            { role: 'system', content: systemMessage },
            { role: 'user', content: `Please optimize this raw prompt:\n\n${rawPrompt}` }
          ],
          temperature: 0.2,
          max_tokens: 2048
        });

        const rawText = aiResponse.response || '';
        const parsed = parseAiOutput(rawText, rawPrompt);

        const words = parsed.optimizedPrompt.trim().split(/\s+/).filter(Boolean).length;
        const characters = parsed.optimizedPrompt.length;
        const estimatedTokens = Math.ceil(characters / 3.8);

        return new Response(JSON.stringify({
          success: true,
          model: AI_MODEL,
          optimizedPrompt: parsed.optimizedPrompt,
          rationale: parsed.rationale,
          detectedVariables: parsed.detectedVariables,
          metrics: { words, characters, estimatedTokens }
        }), {
          headers: {
            ...CORS_HEADERS,
            'X-RateLimit-Limit': String(LIMITS.DAILY_QUOTA)
          }
        });

      } catch (err) {
        return new Response(JSON.stringify({
          error: err instanceof Error ? err.message : String(err)
        }), {
          status: 500,
          headers: CORS_HEADERS
        });
      }
    }

    // 6. Endpoint: POST /api/test
    if (url.pathname === '/api/test' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { promptText } = body;

        if (!promptText || typeof promptText !== 'string' || !promptText.trim()) {
          return new Response(JSON.stringify({ error: 'promptText is required.' }), {
            status: 400,
            headers: CORS_HEADERS
          });
        }

        if (promptText.length > MAX_PROMPT_LENGTH) {
          return new Response(JSON.stringify({
            error: `Payload too large. Maximum test input length is ${MAX_PROMPT_LENGTH} characters.`
          }), {
            status: 413,
            headers: CORS_HEADERS
          });
        }

        const aiResponse = await env.AI.run(AI_MODEL, {
          messages: [
            { role: 'user', content: promptText }
          ],
          temperature: 0.7,
          max_tokens: 2048
        });

        return new Response(JSON.stringify({
          success: true,
          response: aiResponse.response || ''
        }), { headers: CORS_HEADERS });

      } catch (err) {
        return new Response(JSON.stringify({
          error: err instanceof Error ? err.message : String(err)
        }), {
          status: 500,
          headers: CORS_HEADERS
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Endpoint Not Found' }), {
      status: 404,
      headers: CORS_HEADERS
    });
  }
};

/**
 * Resilient JSON parser that handles markdown code-fencing or malformed LLM responses
 */
function parseAiOutput(text, fallbackRawPrompt) {
  let cleaned = text.trim();

  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  try {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.optimizedPrompt) {
        const detected = Array.isArray(parsed.detectedVariables) && parsed.detectedVariables.length > 0
          ? parsed.detectedVariables
          : extractVariables(parsed.optimizedPrompt);

        return {
          optimizedPrompt: parsed.optimizedPrompt,
          rationale: parsed.rationale || 'Engineered role framing, added constraints, and structured output expectations.',
          detectedVariables: detected
        };
      }
    }
  } catch {
    // Fallback if model did not produce valid JSON
  }

  return {
    optimizedPrompt: cleaned || fallbackRawPrompt,
    rationale: 'Applied direct clarity and structured task framing.',
    detectedVariables: extractVariables(cleaned || fallbackRawPrompt)
  };
}

function extractVariables(text) {
  const matches = text.match(/\{\{([a-zA-Z0-9_\s-]+)\}\}/g) || [];
  const unique = new Set(matches.map(m => m.replace(/[\{\}]/g, '').trim()));
  return Array.from(unique);
}
