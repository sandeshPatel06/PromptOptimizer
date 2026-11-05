/**
 * PromptOptimizer - Preset definitions, starter prompts, and prompt analysis tools
 */

export const OPTIMIZATION_PRESETS = [
  {
    id: 'reasoning',
    name: 'Reasoning & CoT',
    tagline: 'Step-by-step thinking & edge-cases',
    glyph: '🧠',
    instruction: `Transform this prompt to require rigorous Chain-of-Thought (CoT) reasoning. 
1. Instruct the model to break down complex problems step-by-step before arriving at the conclusion.
2. Require probing for non-obvious edge cases, hidden assumptions, and potential failure modes.
3. Enforce clear section headers for the reasoning chain versus final verdict.`
  },
  {
    id: 'code',
    name: 'Code & Systems',
    tagline: 'Type-safety, performance & clean architecture',
    glyph: '💻',
    instruction: `Transform this prompt for senior software engineering tasks.
1. Specify explicit programming languages, frameworks, and typing constraints.
2. Require production-grade error handling, zero unhandled edge-cases, and asymptotic complexity awareness.
3. Enforce clean idiomatic code output with concise explanatory commentary.`
  },
  {
    id: 'direct',
    name: 'Direct & Crisp',
    tagline: 'Zero fluff, high signal-to-noise ratio',
    glyph: '⚡',
    instruction: `Transform this prompt to be hyper-concise and direct.
1. Eliminate all pleasantries, generic filler, preamble, and conversational fluff.
2. Structure the prompt with strict imperative verbs and unambiguous constraints.
3. Mandate direct answers, concise bulleted summaries, and maximum density of actionable insight.`
  },
  {
    id: 'structured',
    name: 'Structured & JSON',
    tagline: 'Deterministic schema & machine-readable data',
    glyph: '📋',
    instruction: `Transform this prompt for strict structured data extraction or generation.
1. Provide an explicit output contract (e.g. strict JSON or Markdown table).
2. Mandate validation rules (handling nulls, enforcing types, date formats).
3. Explicitly forbid preamble, conversational filler, and markdown noise when JSON is requested.`
  },
  {
    id: 'persona',
    name: 'Expert Persona',
    tagline: 'World-class specialist framing & standards',
    glyph: '🎭',
    instruction: `Transform this prompt by assigning a world-class domain expert role.
1. Establish a specialized persona with defined expertise, philosophical principles, and quality standards.
2. Frame the user query within a realistic, high-stakes operational context.
3. Guide tone, depth of technical specificity, and decision-making criteria.`
  }
];

export const STARTER_PROMPTS = [
  {
    id: 'starter-code-audit',
    title: 'Senior Code Review & Security Audit',
    description: 'Rigorously audits code for subtle security flaws, memory leaks, concurrency races, and clean architecture.',
    category: 'engineering',
    tags: ['code', 'security', 'architecture', 'refactor'],
    rawPrompt: 'Review this code for bugs and security issues',
    optimizedPrompt: `You are a Principal Software & Security Engineer conducting an unsparing, high-standard code review.

### TARGET ENVIRONMENT & CONTEXT
- Language / Runtime: {{language}}
- Component Purpose: {{context}}

### INPUT CODE
\`\`\`{{language}}
{{code_snippet}}
\`\`\`

### EVALUATION CRITERIA
1. **Security & Vulnerabilities**: Identify any injection vectors, broken access control, unhandled edge-cases, or memory/resource leaks.
2. **Correctness & Concurrency**: Probe for race conditions, re-entrancy issues, unhandled error paths, and off-by-one errors.
3. **Performance & Complexity**: Flag quadratic loops, unnecessary allocations, or redundant I/O operations.
4. **Architecture & Idiomatic Style**: Assess naming clarity, single-responsibility cohesion, and maintainability.

### REQUIRED OUTPUT FORMAT
Provide your review structured strictly as follows:
- **Executive Verdict**: [APPROVE / CHANGES REQUESTED / CRITICAL BLOCKER] with a 2-sentence rationale.
- **Findings Table**: Columns for Severity [Critical/High/Medium/Low], Location, Issue Summary, and Security Impact.
- **Surgical Refactoring**: Provide the corrected, production-ready replacement code with comments explaining non-obvious fixes.`,
    variables: ['language', 'context', 'code_snippet'],
    isFavorite: true,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2
  },
  {
    id: 'starter-first-principles',
    title: 'First-Principles Technical Explainer',
    description: 'Demystifies complex technical paradigms or algorithms from fundamental physical/mathematical primitives.',
    category: 'reasoning',
    tags: ['education', 'mental-models', 'architecture'],
    rawPrompt: 'Explain how {{topic}} works simply',
    optimizedPrompt: `You are an elite systems architect and educator skilled in the Feynman Technique and first-principles deconstruction.

### TOPIC TO EXPLAIN
{{topic}}

### TARGET AUDIENCE
{{target_audience}}

### DECONSTRUCTION FRAMEWORK
1. **The Ground Truth (Level 0)**: What physical, mathematical, or logistical reality necessitated this invention? Avoid analogies initially; explain the core mechanic in terms of state, memory, or communication primitives.
2. **Mental Model & Mechanical Analogy**: Provide an intuitive, real-world metaphor that is mathematically sound (do not gloss over edge cases).
3. **Step-by-Step State Lifecycle**: Trace an exact request or data unit moving through the system from start to finish.
4. **The Critical Trade-Off**: What did this design sacrifice to achieve its primary strength (CAP theorem, latency vs throughput, memory vs compute)?
5. **Anti-Patterns & Misconceptions**: Address 2 common ways practitioners misunderstand or misuse this concept.

Output with concise headers, minimal jargon, and high signal-to-noise ratio.`,
    variables: ['topic', 'target_audience'],
    isFavorite: true,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 86400000
  },
  {
    id: 'starter-json-schema',
    title: 'Strict JSON Schema Extractor',
    description: 'Extracts unstructured text into deterministic, strictly validated JSON matching a specific schema.',
    category: 'analysis',
    tags: ['json', 'data', 'extraction', 'structured'],
    rawPrompt: 'extract data from text into json',
    optimizedPrompt: `You are an automated, deterministic data transformation engine. Your sole objective is to parse raw input data and format it into strictly validated JSON.

### SCHEMA SPECIFICATION
\`\`\`json
{{schema_definition}}
\`\`\`

### RAW INPUT DATA
"""
{{raw_input}}
"""

### CONSTRAINTS
- Return ONLY valid JSON adhering strictly to the provided schema.
- Do NOT include markdown code blocks, backticks, preamble, conversational text, or postscripts.
- Coerce missing or ambiguous fields to null or reasonable schema-defined defaults.
- All timestamps must be ISO 8601 UTC.
- Enforce exact key casing as defined in the schema.`,
    variables: ['schema_definition', 'raw_input'],
    isFavorite: false,
    createdAt: Date.now() - 3600000 * 5,
    updatedAt: Date.now() - 3600000 * 5
  },
  {
    id: 'starter-bug-patch',
    title: 'Root Cause Triage & Surgical Patch',
    description: 'Diagnoses failure stack traces and reproduction steps to produce a minimal, regression-safe patch.',
    category: 'engineering',
    tags: ['debugging', 'patch', 'root-cause'],
    rawPrompt: 'Fix this bug and stack trace',
    optimizedPrompt: `You are an expert debugger tasked with root-cause analysis and producing a minimal, surgical patch for a software failure.

### ENVIRONMENT & CONTEXT
- Framework / Stack: {{stack}}
- Observed Behavior: {{observed_failure}}
- Expected Behavior: {{expected_behavior}}

### REPRODUCTION / LOGS / STACK TRACE
\`\`\`
{{logs_or_stacktrace}}
\`\`\`

### RELEVANT CODE
\`\`\`
{{source_code}}
\`\`\`

### REQUIRED ANALYSIS
1. **Root Cause Hypothesis**: Explain exactly why the failure occurs at the micro-instruction or state level. Distinguish between symptoms and proximate cause.
2. **Failure Mechanism**: Describe the exact sequence of events leading to this state.
3. **Surgical Diff / Patch**: Provide a unified diff or minimal targeted code replacement that fixes the issue without introducing unintended side-effects.
4. **Regression Prevention**: Provide a concrete unit or integration test case that triggers the original failure and verifies the fix.`,
    variables: ['stack', 'observed_failure', 'expected_behavior', 'logs_or_stacktrace', 'source_code'],
    isFavorite: false,
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2
  }
];

/**
 * Extracts {{variable_name}} tokens from a prompt template string
 */
export function detectVariables(text) {
  if (!text) return [];
  const regex = /\{\{([a-zA-Z0-9_\s-]+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(text)) !== null) {
    const varName = match[1].trim();
    if (varName) {
      matches.add(varName);
    }
  }
  return Array.from(matches);
}

/**
 * Replaces variables in a prompt template with provided values
 */
export function fillVariables(template, values) {
  if (!template) return '';
  return template.replace(/\{\{([a-zA-Z0-9_\s-]+)\}\}/g, (fullMatch, varName) => {
    const trimmed = varName.trim();
    if (values && values[trimmed] !== undefined && values[trimmed] !== '') {
      return values[trimmed];
    }
    return fullMatch;
  });
}

/**
 * Approximates token count and word count
 */
export function countMetrics(text) {
  if (!text) return { words: 0, estimatedTokens: 0, chars: 0 };
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = text.length;
  // Gemini / standard LLM rule-of-thumb: ~4 characters per token
  const estimatedTokens = Math.ceil(chars / 3.8);
  return { words, estimatedTokens, chars };
}
