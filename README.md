<div align="center">

# PromptOptimizer

**A tactile, keyboard-driven browser sidebar extension to engineer, test, and manage production-grade AI prompts with Meta Llama 3.1 8B on Cloudflare Workers AI.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-f59e0b?style=flat-square)](#)
[![Browsers](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-10b981?style=flat-square)](#)
[![Backend](https://img.shields.io/badge/Backend-Cloudflare%20Workers%20AI-orange?style=flat-square)](#)
[![Setup](https://img.shields.io/badge/Setup-Zero%20Login%20%7C%20Instant%20Start-blue?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## Overview

**PromptOptimizer** is a minimalist browser copilot designed to sit natively inside your browser's sidebar. Inspired by second-brain productivity workflows, it takes raw ideas, vague questions, or unformatted instructions and systematically refines them into high-potency, deterministic prompts with explicit role framing, operational context, variable injection, and edge-case handling.

Built for **instant out-of-the-box production usage**:
- **Zero Login & Zero API Key Setup**: End users never need to generate an API key or log in; it runs immediately on install.
- **Enterprise-Grade Rate Protection**: Protected by custom Cloudflare Workers AI with sliding-window burst limits and daily quota allocation.
- **Pure WebExtensions Standards**: Built with vanilla ES modules, CSS custom properties, and native HTML5 `<dialog>` — zero React bloat.

```
┌────────────────────────────────────────────────────────────────────────┐
│  PromptOptimizer Native Sidebar (Chrome SidePanel / Firefox Sidebar)  │
│                                                                        │
│  [PROMPT // OPT]          [● 100/100 Free]              [🗖]  [⚙️]     │
│  ────────────────────────────────────────────────────────────────────  │
│  Strategies: [ 🧠 Reasoning ] [ 💻 Code ] [ ⚡ Direct ] [ 📋 JSON ]   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ User Draft: "Review this pull request for concurrency bugs"      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  [ ⌘↵ Refine Prompt ]                                                  │
│                                                                        │
│  ┌─ Output Card ────────────────────────────────────────────────────┐  │
│  │ Role: Principal Systems & Concurrency Engineer                   │  │
│  │ Context: Production Review | Variables: {{language}}, {{code}}   │  │
│  │ Actions: [ 📋 Copy ] [ 💾 Save ] [ ▶ Test Sandbox ]             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTPS (CORS + Rate Limited)     │ Local Persistence
                   ▼                                 ▼
       Cloudflare Workers AI Gateway            chrome.storage.local
       (Meta Llama 3.1 8B FP8)                  (Prompts, History, Quotas)
```

---

## Production Security & Rate Limiting Architecture

From both an **end-user perspective** and an **organizational perspective**, PromptOptimizer implements multiple layers of defense:

1. **Sliding-Window Burst Protection**:
   - Caps requests to **15 calls per minute per IP address** (`LIMITS.BURST_PER_MINUTE`) to block automated scrapers, spammers, and token denial-of-service attempts.
2. **24-Hour Rolling Quota Allocation**:
   - Allocates **100 free optimizations per 24 hours per user** (`LIMITS.DAILY_QUOTA`).
   - The topbar displays a real-time counter (`100/100 Free`) so users always know their remaining capacity.
3. **Payload Sanitization & Size Guard**:
   - Rejects prompts exceeding 10,000 characters (`MAX_PROMPT_LENGTH`) with HTTP 413 to prevent token exhaustion.
4. **Resilient JSON Output Parser**:
   - Sanitizes and extracts structured prompt outputs even when models return code fences or slight syntax variations.
5. **Circuit-Breaking & Polite Throttling**:
   - Returns standard HTTP 429 (`Too Many Requests`) with `Retry-After` headers; the UI surfaces a graceful notification rather than crashing.

---

## Key Capabilities

### 1. Zero-Config, Distraction-Free Sidebar
- **Zero AI-Slop Design**: Built without generic backdrop-blur glassmorphism, bloated card grids, or purple gradients. Uses deep obsidian/charcoal surfaces (`#090b0e`, `#11141a`), calibrated solar amber accents (`#f59e0b`), and precision hairline borders.
- **Bespoke Typography**: Integrated via Google CDN with **Plus Jakarta Sans** for typographic clarity and **JetBrains Mono** for code and variable expressions.
- **Native Browser Side Panel**: Integrates with Chrome's native `sidePanel` API and Firefox's `sidebar_action` API.

### 2. Markdown Preview & Raw Toggle
- **Safe Markdown Rendering**: Real-time rendering of headers, code blocks with syntax tags, tables, blockquotes, ordered/unordered lists, and highlighted `{{variable}}` pills.
- **Preview / Raw Mode**: Seamless toggle between formatted Markdown visual presentation and raw monospace output in both the optimizer result and the test sandbox.
- **Strict XSS Isolation**: Sanitizes all input through entity encoding and placeholder tokens before markdown compilation.

### 3. Specialized Optimization Directives
- **Reasoning & CoT**: Enforces rigorous chain-of-thought deconstruction, edge-case analysis, and clear delineation between thinking and final output.
- **Code & Systems**: Enforces explicit runtime types, error propagation contracts, asymptotic complexity bounds, and clean code blocks.
- **Direct & Crisp**: Strips pleasantries, conversational filler, and vague buzzwords; structures queries into dense imperative commands.
- **Structured & JSON**: Generates deterministic JSON/Markdown schemas, validation rules, null-handling specifications, and negative constraints.
- **Expert Persona**: Establishes world-class domain authority framing and rigorous decision criteria.

### 4. Interactive Test Sandbox & Variable Detection
- **Auto-Parameterization**: Automatically identifies dynamic placeholders (e.g. `{{language}}`, `{{code_snippet}}`, `{{schema}}`).
- **In-Sidebar Execution**: Test the generated prompt live inside the sidebar with variables populated before deploying.

### 5. Portable Prompt Library & History
- **Searchable Repository**: Organize prompts by category (`Engineering`, `Reasoning`, `Analysis`, `Writing`, `System`) and tags.
- **Starter Curations**: Pre-seeded with production-grade templates.
- **JSON Portability**: Full backup export and import for team sharing and repository backups.

---

## Permissions & Security

PromptOptimizer adheres to the principle of least privilege:

| Permission | Scope | Requirement | Justification |
| :--- | :--- | :--- | :--- |
| `https://prompt-optimizer-api.patelbr5118s.workers.dev/*` | Host | Required | Communicates with the Cloudflare Workers AI Gateway. |
| `sidePanel` | Chrome API | Required (Chromium) | Enables native side panel display behavior in Chrome, Edge, and Brave. |
| `storage` | Browser API | Required | Persists your prompt library, local history, and daily quota counts. |
| `clipboardWrite` | Browser API | Required | Enables one-click copying of optimized prompts to your clipboard. |
| `contextMenus` | Browser API | Required | Adds right-click context menu: *"Optimize in PromptOptimizer"*. |
| `clipboardRead` | Browser API | Optional (On-Demand) | Requested only when clicking the "Paste" button in the prompt editor. |
| `tabs` | Browser API | Optional (On-Demand) | Requested only when capturing active tab context into a prompt. |

> **Permission Health Check**: The extension automatically verifies its permission status on startup. If any required network host access is absent, a one-click **Grant Access** prompt appears to request it natively.

---

## Installation Guide

### For Google Chrome, Microsoft Edge, Brave, and Opera

1. Clone or download this repository:
   ```bash
   git clone https://github.com/sandeshPatel06/PromptOptimizer.git
   ```
2. Open your Chromium browser and open the Extensions manager:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the `dist/chrome` folder in this repository.
5. Click the PromptOptimizer extension icon in your toolbar, or click your browser's Side Panel icon and choose **PromptOptimizer**.

### For Mozilla Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `dist/firefox/manifest.json`.
4. Open the Firefox sidebar (Ctrl+B / Cmd+B) and select **PromptOptimizer**.

---

## Deploying Your Own Cloudflare Workers AI Gateway (Optional)

If your organization prefers to self-host the backend worker:

```bash
cd worker
npm install
npx wrangler deploy
```

Then in the extension's Settings drawer, paste your worker URL into the **Cloudflare AI Gateway** field.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| `⌘ + Enter` / `Ctrl + Enter` | Text Editor | Refine current prompt |
| `Esc` | Modals / Dialogs | Close active dialog |

---

## License

MIT License. Designed and engineered for production prompt optimization workflows.
