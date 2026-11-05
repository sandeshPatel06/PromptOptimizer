/**
 * PromptOptimizer - Safe Markdown Renderer
 * Converts Markdown text into sanitized, structured HTML.
 * Escapes all raw HTML first to prevent XSS, protects code blocks and variables with tokens,
 * and maps markdown syntax to safe semantic tags.
 */

export function renderMarkdown(markdownText) {
  if (!markdownText) return '';

  // 1. First, strictly escape raw HTML characters
  let safe = markdownText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Storage for protected tokens to prevent formatting collisions
  const tokens = [];
  const stashToken = (html) => {
    const id = `%%MD_TOKEN_${tokens.length}%%`;
    tokens.push(html);
    return id;
  };

  // 2. Multi-line Code blocks: ```lang ... ```
  safe = safe.replace(/```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g, (match, lang, code) => {
    const langLabel = lang ? `<span class="code-lang">${lang}</span>` : '';
    const cleanCode = code.replace(/^\n+|\n+$/g, '');
    return stashToken(`<div class="md-code-block">${langLabel}<pre><code>${cleanCode}</code></pre></div>`);
  });

  // 3. Inline code: `code`
  safe = safe.replace(/`([^`\n]+)`/g, (match, code) => {
    return stashToken(`<code class="md-inline-code">${code}</code>`);
  });

  // 4. Highlight template variables: {{variable_name}}
  safe = safe.replace(/\{\{([a-zA-Z0-9_\s-]+)\}\}/g, (match, varName) => {
    return stashToken(`<span class="md-var">{{${varName.trim()}}}</span>`);
  });

  // 5. Headings: #, ##, ###, ####
  safe = safe.replace(/^#### (.*$)/gim, '<h4 class="md-h4">$1</h4>');
  safe = safe.replace(/^### (.*$)/gim, '<h3 class="md-h3">$1</h3>');
  safe = safe.replace(/^## (.*$)/gim, '<h2 class="md-h2">$1</h2>');
  safe = safe.replace(/^# (.*$)/gim, '<h1 class="md-h1">$1</h1>');

  // 6. Blockquotes: &gt; text
  safe = safe.replace(/^(?:&gt;|>)\s?(.*$)/gim, '<blockquote class="md-quote">$1</blockquote>');

  // 7. Bold and Italic
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  safe = safe.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
  safe = safe.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em>$1</em>');

  // 8. Horizontal rules: --- or ***
  safe = safe.replace(/^(?:---|\*\*\*|___)\s*$/gim, '<hr class="md-hr">');

  // 9. Markdown Tables
  safe = renderMarkdownTables(safe);

  // 10. Lists (Unordered and Ordered)
  safe = renderMarkdownLists(safe);

  // 11. Paragraphs (lines separated by double newlines)
  const paragraphs = safe.split(/\n{2,}/);
  let rendered = paragraphs.map((para) => {
    const trimmed = para.trim();
    if (!trimmed) return '';
    // If paragraph starts with block tag or token of block, do not wrap in <p>
    if (/^<(div|h1|h2|h3|h4|ul|ol|blockquote|table|hr)/i.test(trimmed)) {
      return trimmed;
    }
    // If the whole paragraph is a stashed block token
    if (/^%%MD_TOKEN_\d+%%$/.test(trimmed)) {
      return trimmed;
    }
    // Replace single newlines with <br> inside paragraphs
    return `<p class="md-p">${trimmed.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 12. Restore protected tokens
  tokens.forEach((html, idx) => {
    const placeholder = new RegExp(`%%MD_TOKEN_${idx}%%`, 'g');
    rendered = rendered.replace(placeholder, () => html);
  });

  return rendered;
}

/**
 * Parses and formats markdown tables
 */
function renderMarkdownTables(text) {
  const tableRegex = /((?:\|[^\n]+\|\r?\n)+)/g;
  return text.replace(tableRegex, (match) => {
    const lines = match.trim().split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return match;

    // Check if second line is a delimiter: | --- | --- |
    if (!/^\|(?:\s*:?-+:?\s*\|)+$/.test(lines[1])) {
      return match;
    }

    const parseRow = (line) => {
      return line
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim());
    };

    const headers = parseRow(lines[0]);
    const thead = `<thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;

    const bodyRows = lines.slice(2);
    const tbody = `<tbody>${bodyRows.map(row => {
      const cells = parseRow(row);
      return `<tr>${cells.map(c => `<td>${c}</td>`).join('')}</tr>`;
    }).join('')}</tbody>`;

    return `<div class="md-table-wrapper"><table class="md-table">${thead}${tbody}</table></div>`;
  });
}

/**
 * Parses markdown unordered and ordered lists
 */
function renderMarkdownLists(text) {
  // Unordered lists (- or *)
  let result = text.replace(/(?:^[*-]\s+.*(?:\n|$))+/gm, (listBlock) => {
    const items = listBlock.trim().split('\n').map(item => {
      const content = item.replace(/^[*-]\s+/, '').trim();
      return `<li>${content}</li>`;
    }).join('');
    return `<ul class="md-ul">${items}</ul>`;
  });

  // Ordered lists (1. 2.)
  result = result.replace(/(?:^\d+\.\s+.*(?:\n|$))+/gm, (listBlock) => {
    const items = listBlock.trim().split('\n').map(item => {
      const content = item.replace(/^\d+\.\s+/, '').trim();
      return `<li>${content}</li>`;
    }).join('');
    return `<ol class="md-ol">${items}</ol>`;
  });

  return result;
}
