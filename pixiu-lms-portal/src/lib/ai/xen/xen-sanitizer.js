/**
 * Defensive client-side sanitizer and Markdown segment normalizer for Xen responses.
 * Trims leaked protocol boundary markers, strips accidental leading reasoning blocks,
 * repairs escaped Markdown & HTML entity corruption outside code/math, and splits
 * fenced code blocks (standard, indented, inline-opening, 4+ backtick, or tilde).
 */

function stripLeadingThinkBlock(text, { stripIncompleteTrailingThink = false } = {}) {
  const closedMatch = text.match(/^\s*<think>[\s\S]*?<\/think>[\r\n]*/);
  if (closedMatch) {
    return text.slice(closedMatch[0].length);
  }
  if (stripIncompleteTrailingThink && /^\s*<think>/.test(text) && !text.includes('</think>')) {
    return '';
  }
  return text;
}

function decodeHtmlEntitiesInText(segment) {
  if (!segment || typeof segment !== 'string') return segment || '';
  return segment
    // Unwrap doubly-escaped HTML entities (e.g. &amp;#x20; -> &#x20;, &amp;lt; -> &lt;)
    .replace(/&amp;(amp|lt|gt|quot|apos|nbsp|#x0*20|#0*32|#x0*a0|#0*160|#0*39|#x0*27|#x0*0a|#0*10|#x0*09|#0*9);/gi, '&$1;')
    // Normalize space and whitespace character references across prose, headings, tables, and math
    .replace(/&#x0*20;|&#0*32;|&nbsp;|&#0*160;|&#x0*a0;|&#x0*09;|&#0*9;/gi, ' ')
    .replace(/&#x0*0a;|&#0*10;/gi, '\n');
}

function normalizeLatexDelimiters(segment) {
  let out = segment.replace(/\\\[([\s\S]*?)\\\]/g, (full, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return full;
    if (trimmed.includes('\n')) return `\n$$\n${trimmed}\n$$\n`;
    return `$$${trimmed}$$`;
  });
  out = out.replace(/\\\(([^\n]*?)\\\)/g, (full, inner) => {
    const trimmed = inner.trim();
    if (!trimmed) return full;
    if (/^[a-zA-Z]$/.test(trimmed) || /[=+\-*/^_\\{}<>]/.test(trimmed)) {
      return `$${trimmed}$`;
    }
    return full;
  });
  return out;
}

function makeSafePlaceholderPrefix(text, label) {
  let prefix = `__XEN_${label}_`;
  while (text.includes(prefix)) {
    prefix += 'X';
  }
  return prefix;
}

function unescapeCorruptedMarkdownProse(segment) {
  let out = decodeHtmlEntitiesInText(segment);
  out = normalizeLatexDelimiters(out);

  // Protect $...$ and $$...$$ LaTeX spans so TeX commands keep their backslashes
  const protectedMath = [];
  const mathPrefix = makeSafePlaceholderPrefix(out, 'MATH');
  out = out.replace(/\$\$[\s\S]*?\$\$|(?<!\\)\$(?!\s)([^\n$]*?\S)(?<!\\)\$/g, (mathExpr) => {
    const token = `${mathPrefix}${protectedMath.length}__`;
    protectedMath.push(decodeHtmlEntitiesInText(mathExpr));
    return token;
  });

  // Unescape backslash-escaped ATX headings at line starts (\# Title, \#\# Sub)
  out = out.replace(/(^|\n)([ \t]*)((?:\\\\?#){1,6})(?=[ \t]+|$)/g, (_, pre, indent, hashes) => {
    return `${pre}${indent}${hashes.replace(/\\\\?#/g, '#')}`;
  });

  // Unescape line-start escaped bullets (\* item, \- item) and numbered dots (1\. step)
  out = out.replace(/(^|\n)([ \t]*)\\\\?([-*+])([ \t]+)/g, '$1$2$3$4');
  out = out.replace(/(^|\n)([ \t]*\d+)\\\\?\.([ \t]+)/g, '$1$2.$3');

  // Unescape paired bold (\*\*text\*\* or \\*\\*text\\*\\*, \_\_text\_\_)
  out = out.replace(
    /(?:\\\\|\\)\*(?:\\\\|\\)\*(?=\S)([^\n]*?\S)(?:\\\\|\\)\*(?:\\\\|\\)\*/g,
    '**$1**'
  );
  out = out.replace(
    /(?:\\\\|\\)_(?:\\\\|\\)_(?=\S)([^\n]*?\S)(?:\\\\|\\)_(?:\\\\|\\)_/g,
    '__$1__'
  );

  // Unescape paired italic (\*text\* and word-bounded \_text\_) while preserving multiplication (2 \* 3)
  out = out.replace(
    /(?<![\\*])(?:\\\\|\\)\*(?![*\s])([^\n]*?\S)(?<![\\*])(?:\\\\|\\)\*(?!\*)/g,
    '*$1*'
  );
  out = out.replace(
    /(^|[^\w\\])(?:\\\\|\\)_(?![_\s])([^\n]*?\S)(?:\\\\|\\)_(?=$|[^\w])/g,
    '$1_$2_'
  );

  // Unescape paired strikethrough (\~\~text\~\~)
  out = out.replace(
    /(?:\\\\|\\)~(?:\\\\|\\)~(?=\S)([^\n]*?\S)(?:\\\\|\\)~(?:\\\\|\\)~/g,
    '~~$1~~'
  );

  const mathRestore = new RegExp(`${mathPrefix}(\\d+)__`, 'g');
  return out.replace(mathRestore, (_, idx) => protectedMath[Number(idx)] ?? '');
}

function splitFenceSegments(text) {
  const segments = [];
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let proseLines = [];
  let codeLines = [];
  let inCode = false;
  let fenceChar = '';
  let fenceLen = 0;
  let fenceOpenLine = '';
  let language = 'text';

  const flushProse = () => {
    if (!proseLines.length) return;
    segments.push({ type: 'text', lines: proseLines });
    proseLines = [];
  };

  for (const line of lines) {
    if (!inCode) {
      const fenceLineMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})([\w+-]*)[ \t]*$/);
      if (fenceLineMatch) {
        flushProse();
        inCode = true;
        fenceChar = fenceLineMatch[1][0];
        fenceLen = fenceLineMatch[1].length;
        fenceOpenLine = line;
        language = (fenceLineMatch[2] || 'text').toLowerCase();
        codeLines = [];
        continue;
      }

      const inlineFenceMatch = line.match(/^(.*?[^`\s][^\n`]*?)[ \t]*(`{3,}|~{3,})([\w+-]*)[ \t]*$/);
      if (inlineFenceMatch && !inlineFenceMatch[1].includes(inlineFenceMatch[2])) {
        if (inlineFenceMatch[1].trim()) {
          proseLines.push(inlineFenceMatch[1].trimEnd());
        }
        flushProse();
        inCode = true;
        fenceChar = inlineFenceMatch[2][0];
        fenceLen = inlineFenceMatch[2].length;
        fenceOpenLine = inlineFenceMatch[2] + (inlineFenceMatch[3] || '');
        language = (inlineFenceMatch[3] || 'text').toLowerCase();
        codeLines = [];
        continue;
      }

      proseLines.push(line);
    } else {
      const closeMatch = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/);
      if (closeMatch && closeMatch[1][0] === fenceChar && closeMatch[1].length >= fenceLen) {
        segments.push({
          type: 'code',
          language,
          openLine: fenceOpenLine,
          closeLine: line,
          lines: codeLines,
        });
        codeLines = [];
        inCode = false;
        fenceChar = '';
        fenceLen = 0;
        fenceOpenLine = '';
        language = 'text';
        continue;
      }
      codeLines.push(line);
    }
  }

  if (inCode) {
    segments.push({
      type: 'code',
      language,
      openLine: fenceOpenLine,
      closeLine: null,
      lines: codeLines,
    });
  } else {
    flushProse();
  }

  return segments;
}

/**
 * Normalize escaped Markdown markers, LaTeX delimiters, and HTML entity leakage in
 * Markdown prose while keeping fenced code blocks and inline code spans verbatim.
 */
export function normalizeXenMarkdown(text) {
  if (!text || typeof text !== 'string') return '';
  const segments = splitFenceSegments(text);
  const rebuilt = [];

  for (const seg of segments) {
    if (seg.type === 'code') {
      const inner = seg.lines.join('\n');
      const block = seg.closeLine !== null
        ? (inner ? `${seg.openLine}\n${inner}\n${seg.closeLine}` : `${seg.openLine}\n${seg.closeLine}`)
        : (inner ? `${seg.openLine}\n${inner}` : seg.openLine);
      rebuilt.push(block);
    } else {
      const rawProse = seg.lines.join('\n');
      const inlineCodes = [];
      const codePrefix = makeSafePlaceholderPrefix(rawProse, 'CODE');
      const masked = rawProse.replace(/(`+)([^\n]*?)\1/g, (span) => {
        const token = `${codePrefix}${inlineCodes.length}__`;
        inlineCodes.push(span);
        return token;
      });
      const codeRestore = new RegExp(`${codePrefix}(\\d+)__`, 'g');
      const normalized = unescapeCorruptedMarkdownProse(masked).replace(
        codeRestore,
        (_, idx) => inlineCodes[Number(idx)] ?? ''
      );
      rebuilt.push(normalized);
    }
  }

  return rebuilt.join('\n');
}

export function sanitizeStreamingOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.replace(/\r\n?/g, '\n');
  cleaned = cleaned.replace(/^\s*<\|im_start\|>(?:assistant|user|system)?[^\S\n]*\n?/i, '');
  cleaned = stripLeadingThinkBlock(cleaned, { stripIncompleteTrailingThink: true });
  cleaned = cleaned.replace(/(?:<\|im_end\|>|<\|endoftext\|>|<\|im_e(?:nd?)?|<\|endoft(?:ext?)?)$/i, '');
  return normalizeXenMarkdown(cleaned);
}

export function sanitizeClientOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.replace(/\r\n?/g, '\n').trim();
  // Strip leaked ChatML header if present at the very start
  cleaned = cleaned.replace(/^<\|im_start\|>(?:assistant|user|system)?\s*/i, '');
  cleaned = stripLeadingThinkBlock(cleaned, { stripIncompleteTrailingThink: false });
  // Strip trailing protocol tokens only if at the end of the response
  for (const suffix of ['<|im_end|>', '<|endoftext|>']) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trimEnd();
    }
  }
  return normalizeXenMarkdown(cleaned).trim();
}

// An unfinished fenced block is a normal state while an answer is arriving.
export function splitXenResponse(text) {
  const source = sanitizeClientOutput(text);
  if (!source) return [];

  const segments = splitFenceSegments(source);
  const sections = [];

  for (const seg of segments) {
    if (seg.type === 'code') {
      sections.push({
        type: 'code',
        language: seg.language,
        code: seg.lines.join('\n').replace(/\n+$/, ''),
      });
    } else {
      const content = seg.lines.join('\n').trim();
      if (content) sections.push({ type: 'text', content });
    }
  }

  return sections;
}
