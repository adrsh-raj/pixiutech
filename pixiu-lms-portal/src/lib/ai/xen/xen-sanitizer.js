/**
 * Defensive client-side sanitizer to trim leaked protocol boundary markers
 * while strictly preserving legitimate literal strings in code and documentation.
 */
export function sanitizeClientOutput(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  // Strip leaked ChatML header if present at the very start
  cleaned = cleaned.replace(/^<\|im_start\|>(?:assistant|user|system)?\s*/i, '');
  // Strip trailing protocol tokens only if at the end of the response
  for (const suffix of ['<|im_end|>', '<|endoftext|>']) {
    if (cleaned.endsWith(suffix)) {
      cleaned = cleaned.slice(0, -suffix.length).trimEnd();
    }
  }
  return cleaned;
}

// An unfinished fenced block is a normal state while an answer is arriving.
export function splitXenResponse(text) {
  const source = sanitizeClientOutput(text);
  const sections = [];
  const fences = /^`{3}([\w+-]*)[^\S\n]*(?:\n|$)/gm;
  let start = 0;
  let language = null;
  for (const match of source.matchAll(fences)) {
    const content = source.slice(start, match.index);
    if (language !== null) sections.push({ type: 'code', code: content, language });
    else if (content) sections.push({ type: 'text', content });
    language = language === null ? match[1] || 'text' : null;
    start = match.index + match[0].length;
  }
  const tail = source.slice(start);
  if (language !== null) sections.push({ type: 'code', code: tail, language });
  else if (tail) sections.push({ type: 'text', content: tail });
  return sections;
}
