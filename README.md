<div align="center">

# PromptOptimizer

**A tactile, keyboard-driven browser sidebar extension to engineer, test, and manage production-grade AI prompts with Google Gemini Flash.**

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-f59e0b?style=flat-square)](#)
[![Browsers](https://img.shields.io/badge/Browsers-Chrome%20%7C%20Firefox%20%7C%20Edge%20%7C%20Brave-10b981?style=flat-square)](#)
[![Runtime](https://img.shields.io/badge/Runtime-Vanilla%20ES%20Modules%20(Zero%20React)-blue?style=flat-square)](#)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20%7C%20Zero%20Telemetry-purple?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

</div>

---

## Overview

**PromptOptimizer** is a minimalist browser copilot designed to sit natively inside your browser's sidebar. Inspired by second-brain productivity workflows, it takes raw ideas, vague questions, or unformatted instructions and systematically refines them into high-potency, deterministic prompts with explicit role framing, operational context, variable injection, and edge-case handling.

Built entirely with standard WebExtension APIs, CSS custom properties, and native ES modules — **with zero React runtime overhead, zero telemetry, and zero intermediate proxy servers**.

```
┌────────────────────────────────────────────────────────────────────────┐
│  PromptOptimizer Native Sidebar (Chrome SidePanel / Firefox Sidebar)  │
│                                                                        │
│  [⚡ Optimizer]                     [📚 Library & History]     [⚙️]   │
│  ────────────────────────────────────────────────────────────────────  │
│  Strategies: [ 🧠 Reasoning ] [ 💻 Code ] [ ⚡ Direct ] [ 📋 JSON ]   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ User Draft: "Review this pull request for concurrency bugs"      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│  [ ⌘↵ Optimize Prompt ]                                                │
│                                                                        │
│  ┌─ Output Card ────────────────────────────────────────────────────┐  │
│  │ Role: Principal Systems & Concurrency Engineer                   │  │
│  │ Context: Production Review | Variables: {{language}}, {{code}}   │  │
│  │ Actions: [ 📋 Copy ] [ 💾 Save ] [ ▶ Test Sandbox ]             │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ Direct Client-to-API (HTTPS)    │ Local Persistence
                   ▼                                 ▼
      Google Generative Language API        chrome.storage.local
      (Gemini 1.5 Flash / 2.5 Flash)        (API Keys, Prompts, History)
```

---

## Key Capabilities

### 1. Distraction-Free, Tactile Sidebar
- **Zero AI-Slop Design**: Built without generic backdrop-blur glassmorphism, bloated card grids, or purple gradients. Uses deep obsidian/charcoal surfaces (`#090b0e`, `#11141a`), calibrated solar amber accents (`#f59e0b`), and precision hairline borders.
- **Bespoke Typography**: Integrated via Google CDN with **Plus Jakarta Sans** for typographic clarity and **JetBrains Mono** for code and variable expressions, compliant with Manifest V3 CSP.
- **Native Browser Side Panel**: Integrates with Chrome's native `sidePanel` API and Firefox's `sidebar_action` API to sit alongside active tabs without consuming window real estate.
- **Full Workstation Mode**: Pop out into a dedicated full-screen tab anytime with one click.

### 2. Markdown Preview & Raw Toggle
- **Safe Markdown Rendering**: Real-time rendering of headers, code blocks with syntax tags, tables, blockquotes, ordered/unordered lists, and highlighted `{{variable}}` pills.
- **Preview / Raw Mode**: Seamless toggle between formatted Markdown visual presentation and raw monospace output in both the optimizer result and the test sandbox.
- **Strict XSS Isolation**: Sanitizes all input through entity encoding and placeholder tokens before markdown compilation.

### 3. Direct-to-Google Privacy Architecture
- **Client-Only Architecture**: All requests route directly from your local browser to Google's official Generative Language API (`https://generativelanguage.googleapis.com`).
- **No Third-Party Proxies**: No backend servers, no analytics, no external telemetry.
- **Local Credential Storage**: Your Google Gemini API key and prompt library are stored exclusively in your browser's local sandbox (`chrome.storage.local` or `browser.storage.local`).

### 4. Low-Latency Gemini Engine with Dynamic Model Discovery
- **Self-Healing Model Fallback**: Automatically discovers and lists valid models for your API key via `ModelService.ListModels`, preventing `404 Not Found` API version mismatches.
- **Multi-Model Support**: Defaults to fast models (`gemini-2.0-flash`, `gemini-1.5-flash-latest`) and seamlessly adapts to your account's tier.
- **Configurable**: Easily switchable via topbar dropdown or Settings drawer.

### 5. Specialized Optimization Directives
- **Reasoning & CoT**: Enforces rigorous chain-of-thought deconstruction, edge-case analysis, and clear delineation between thinking and final output.
- **Code & Systems**: Enforces explicit runtime types, error propagation contracts, asymptotic complexity bounds, and clean code blocks.
- **Direct & Crisp**: Strips pleasantries, conversational filler, and vague buzzwords; structures queries into dense imperative commands.
- **Structured & JSON**: Generates deterministic JSON/Markdown schemas, validation rules, null-handling specifications, and negative constraints.
- **Expert Persona**: Establishes world-class domain authority framing and rigorous decision criteria.

### 6. Interactive Test Sandbox & Variable Detection
- **Auto-Parameterization**: Automatically identifies dynamic placeholders (e.g. `{{language}}`, `{{code_snippet}}`, `{{schema}}`).
- **In-Sidebar Execution**: Test the generated prompt live inside the sidebar before deploying. PromptOptimizer renders interactive input fields for each variable, substitutes values, executes against Gemini Flash, and displays the response with Markdown preview.

### 7. Portable Prompt Library & History
- **Searchable Repository**: Organize prompts by category (`Engineering`, `Reasoning`, `Analysis`, `Writing`, `System`) and tags.
- **Starter Curations**: Pre-seeded with production-grade templates (Senior Code Review & Security Audit, First-Principles Explainer, Strict JSON Schema Extractor, and Bug Triage & Surgical Patch).
- **Recent History**: Automatically preserves previous optimizations for one-click rollback.
- **JSON Portability**: Full backup export and import for team sharing and repository backups.

---

## Permissions & Security

PromptOptimizer adheres to the principle of least privilege. Permissions are declared in [manifest.json](file:///home/reak/git/PromptOptimizer/manifest.json) and dynamically managed via the WebExtensions Permissions API:

| Permission | Scope | Requirement | Justification |
| :--- | :--- | :--- | :--- |
| `https://generativelanguage.googleapis.com/*` | Host | Required | Communicates directly with Google's Gemini API endpoints. |
| `sidePanel` | Chrome API | Required (Chromium) | Enables native side panel display behavior in Chrome, Edge, and Brave. |
| `storage` | Browser API | Required | Persists your API key, saved prompts, and preferences locally. |
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
3. Toggle on **Developer mode** in the upper-right corner.
4. Click **Load unpacked**.
5. Select the repository root folder (`PromptOptimizer`) or the prebuilt `PromptOptimizer/dist/chrome` directory.
6. Click the **PromptOptimizer** extension icon in your browser toolbar to open the sidebar.

### For Mozilla Firefox

1. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Open `PromptOptimizer/dist/firefox` (or run `npm run build` to package it).
4. Select `manifest.json`.
5. Press `Alt + Shift + S` or click the sidebar toggle in Firefox to launch PromptOptimizer.

---

## Getting Started

1. **Obtain a Google Gemini API Key**:
   - If you do not have a key, generate one for free at [Google AI Studio](https://aistudio.google.com/apikey).
2. **Connect**:
   - Paste your API key into the onboarding banner or open **Settings** (`⚙️`) and click **Verify & Connect**.
   - PromptOptimizer verifies connectivity against `/v1beta/models` without consuming generation tokens.
3. **Optimize**:
   - Type or paste your draft into the editor.
   - Choose a directive (`Reasoning`, `Code`, `Direct`, `JSON`, `Persona`).
   - Press <kbd>Cmd</kbd> + <kbd>Enter</kbd> (or <kbd>Ctrl</kbd> + <kbd>Enter</kbd>).
4. **Test & Save**:
   - Inspect detected `{{variables}}` and improvements rationale.
   - Click **▶ Test** to run the prompt with live inputs, or click **💾 Save** to archive it to your Library.

---

## Keyboard Shortcuts

| Shortcut | Context | Action |
| :--- | :--- | :--- |
| <kbd>Cmd</kbd> + <kbd>Enter</kbd> / <kbd>Ctrl</kbd> + <kbd>Enter</kbd> | Optimizer Editor | Execute prompt optimization |
| <kbd>/</kbd> | Library View | Instantly focus the prompt search bar |
| <kbd>Esc</kbd> | Global | Close modals, drawers, and overlays |

---

## Project Structure

```
PromptOptimizer/
├── manifest.json              # Chromium Manifest V3 (Chrome, Edge, Brave)
├── manifest.firefox.json      # Firefox Manifest V3 (sidebar_action & gecko ID)
├── background.js              # Background service worker (sidePanel & context menus)
├── sidepanel.html             # Streamlined sidebar UI markup
├── sidepanel.css              # Custom property design tokens (anti-slop, tactile)
├── sidepanel.js               # Reactive UI controller (Vanilla ES modules)
├── lib/
│   ├── gemini.js              # Direct Google Generative Language API client
│   ├── permissions.js         # WebExtensions Permissions API detection & request
│   ├── storage.js             # Local storage adapter & JSON import/export
│   └── prompts.js             # Curated presets, starter library & variable parser
├── icons/                     # Vector SVG and crisp raster PNGs (16, 32, 48, 128px)
├── dist/
│   ├── chrome/                # Ready-to-load unpacked Chrome build
│   └── firefox/               # Ready-to-load unpacked Firefox build
├── scripts/
│   ├── build.mjs              # Multi-browser distribution packager
│   └── generate-icons.mjs     # SVG-to-raster icon builder
├── package.json
└── README.md
```

---

## Build & Development

The repository is fully functional as unpacked source files. If you modify assets or code, use the included Node scripts to synchronize distribution builds:

```bash
# Install development tooling (Sharp for icon generation)
npm install

# Build distribution packages for Chrome and Firefox
npm run build

# Regenerate raster icon assets from the SVG source
npm run icons
```

---

## License

Distributed under the **MIT License**. Created and maintained by [sandeshPatel06](https://github.com/sandeshPatel06).
