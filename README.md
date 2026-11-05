# PromptOptimizer

A tactile, keyboard-driven browser sidebar extension to engineer, refine, test, and save AI prompts with Google Gemini Flash. Built in standard WebExtension architecture for Chrome, Firefox, Edge, Brave, and Chromium browsers.

Inspired by second-brain prompt workflows, PromptOptimizer turns raw notes and messy queries into production-grade, highly-deterministic system prompts with explicit roles, context, variables, and edge-case handling.

---

## Highlights

- **Standard Extension Architecture**: Zero React runtime bloat, zero heavy build dependencies. Built directly with standard HTML5, custom property CSS, and vanilla ES modules for instant loading and minimal memory footprint.
- **Chrome & Firefox Native Sidebar**:
  - Chrome / Chromium (Edge, Brave, Arc): Native Chrome Side Panel (`sidePanel` API) that opens directly alongside your web pages.
  - Firefox: Native Sidebar Action (`sidebar_action` API) with keyboard toggles and popup fallback.
  - Universal Pop-out: Dedicated full-tab workstation mode (`sidepanel.html`) for deep prompt engineering sessions.
- **Direct-to-Google Privacy**: Communicates directly from your browser to Google's Generative Language API. Zero middleman proxies, zero telemetry, zero analytics. Your API key and prompt library are saved locally in extension storage (`chrome.storage.local` / `browser.storage.local`).
- **Low-Latency Gemini Models**: Defaulted to `gemini-1.5-flash` and `gemini-2.5-flash` for high throughput, sub-second latency, and cost-effective iteration. Easily switchable to `gemini-2.0-flash` or `gemini-1.5-pro` in Settings.
- **5 Optimization Directives**:
  1. **Reasoning & CoT (🧠)**: Enforces step-by-step chain-of-thought, edge-case probing, and distinct thinking phases.
  2. **Code & Systems (💻)**: Enforces strict type signatures, asymptotic bounds, error propagation, and clean code output.
  3. **Direct & Crisp (⚡)**: Strips filler and pleasantries, prioritizing dense, imperative instructions.
  4. **Structured & JSON (📋)**: Enforces deterministic data contracts, schema definitions, and machine-readable output.
  5. **Expert Persona (🎭)**: Configures world-class domain specialist framing with explicit quality benchmarks.
- **Interactive Test Sandbox**: Automatically detects `{{variable_name}}` template tags, provides input inputs right in the sidebar, and runs test executions with Gemini so you can verify prompt behavior before deploying.
- **Persistent Prompt Library**: Save, tag, search, star, and categorize prompts. Pre-seeded with production starter templates (Senior Code Review, First-Principles Explainer, Strict JSON Schema Extractor, Bug Triage & Patch).
- **Import / Export**: Full JSON import and export for team sharing and local backups.
- **Tactile, Bespoke UI**: Designed to adhere to strict anti-slop design principles (monochrome graphite canvas, amber accents, 1px hairline borders, monospace tags, and zero blurry glassmorphism).

---

## Installation

### For Google Chrome, Brave, Microsoft Edge, and Opera

1. Clone or download this repository:
   ```bash
   git clone https://github.com/sandeshPatel06/PromptOptimizer.git
   ```
2. Open your Chromium-based browser and navigate to the Extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
3. Enable **Developer mode** (toggle located in the top-right corner).
4. Click **Load unpacked**.
5. Select either:
   - The root repository folder (`PromptOptimizer`), or
   - The prebuilt distribution folder (`PromptOptimizer/dist/chrome`).
6. Click the PromptOptimizer extension icon in your toolbar (or pin it) to open the side panel.

---

### For Mozilla Firefox

1. Open Firefox and navigate to:
   ```
   about:debugging#/runtime/this-firefox
   ```
2. Click **Load Temporary Add-on...**
3. Navigate into `PromptOptimizer/dist/firefox` (or run `npm run build` to generate it).
4. Select `manifest.json`.
5. The extension will register the Firefox sidebar panel. Press `Alt + Shift + S` or open the Firefox sidebar menu to access PromptOptimizer.

---

## First-Time Configuration

1. When first opened, the extension displays a setup banner requesting your **Google Gemini API Key**.
2. If you don't already have one, generate a free API key at [Google AI Studio](https://aistudio.google.com/apikey).
3. Paste the key into the input field and click **Verify**.
4. The key is validated live against Google's API endpoint (`/v1beta/models`) and stored securely in local browser storage.
5. You can update or re-test your key anytime under the **Settings** tab.

---

## Workflow & Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Enter` (or `Cmd + Enter`) | Optimize current prompt with active directive |
| `/` | Focus search bar when on the Prompt Library tab |
| `Escape` | Dismiss modal dialogs and close the test drawer |

---

## Project Structure

```
PromptOptimizer/
├── manifest.json              # Chrome / Chromium Manifest V3
├── manifest.firefox.json      # Mozilla Firefox Manifest V3
├── background.js              # Service worker (Side Panel & context menus)
├── sidepanel.html             # Sidebar HTML entry point
├── sidepanel.css              # Custom property design tokens (anti-slop, tactile)
├── sidepanel.js               # Reactive UI controller (Vanilla ES modules)
├── lib/
│   ├── gemini.js              # Direct Google Generative Language API client
│   ├── storage.js             # Cross-browser storage adapter & JSON import/export
│   └── prompts.js             # Starter templates, presets, and variable parser
├── icons/                     # Vector SVG and crisp raster PNGs (16, 32, 48, 128px)
├── dist/
│   ├── chrome/                # Ready-to-load unpacked Chrome build
│   └── firefox/               # Ready-to-load unpacked Firefox build
├── scripts/
│   ├── build.mjs              # Multi-browser build packager
│   └── generate-icons.mjs     # Automated vector-to-raster icon generator
├── package.json
└── README.md
```

---

## Development & Customization

To regenerate icons or package distribution builds:

```bash
# Install development tools
npm install

# Build Chrome and Firefox distribution packages
npm run build

# Re-render icon assets from SVG source
npm run icons
```

---

## License

MIT License. Designed and maintained by [sandeshPatel06](https://github.com/sandeshPatel06).
