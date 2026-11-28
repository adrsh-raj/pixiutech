import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
import {
  splitXenResponse,
  sanitizeClientOutput,
  sanitizeStreamingOutput,
  normalizeXenMarkdown,
} from '../../src/lib/ai/xen/xen-sanitizer.js';

const xenMdBundle = await build({
  stdin: {
    contents: `
      export { createElement } from 'react';
      export { renderToString } from 'react-dom/server';
      export { default as ReactMarkdown } from 'react-markdown';
      export { default as remarkGfm } from 'remark-gfm';
      export { default as remarkMath } from 'remark-math';
      export { default as rehypeKatex } from 'rehype-katex';
      export { XenMarkdown } from './src/components/xen/XenMarkdown.jsx';
    `,
    resolveDir: fileURLToPath(new URL('../..', import.meta.url)),
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  write: false,
  jsx: 'automatic',
  banner: {
    js: `import { createRequire as __xenCreateReq } from 'node:module'; const require = __xenCreateReq(${JSON.stringify(import.meta.url)});`,
  },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const {
  createElement: h,
  renderToString,
  ReactMarkdown,
  remarkGfm,
  remarkMath,
  rehypeKatex,
  XenMarkdown,
} = await import(
  `data:text/javascript;base64,${Buffer.from(xenMdBundle.outputFiles[0].contents).toString('base64')}`
);

function renderMarkdown(content) {
  return renderToString(
    h(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
      },
      content
    )
  );
}

function renderXenMarkdown(content, isUser = false) {
  return renderToString(h(XenMarkdown, { content, isUser }));
}

test('1. Bold text: This is **apple** -> renders <strong>apple</strong>, no asterisks', () => {
  const html = renderMarkdown('This is **apple**.');
  assert.match(html, /<strong>apple<\/strong>/);
  assert.doesNotMatch(html, /\*\*apple\*\*/);
});

test('2. Bold text: **ffsdf** -> renders <strong>ffsdf</strong>', () => {
  const html = renderMarkdown('**ffsdf**');
  assert.match(html, /<strong>ffsdf<\/strong>/);
  assert.doesNotMatch(html, /\*\*ffsdf\*\*/);
});

test('3. Invalid emphasis with leading space: ** ffsdf** -> remains literal asterisks', () => {
  const html = renderMarkdown('** ffsdf**');
  assert.doesNotMatch(html, /<strong>/);
  assert.match(html, /\*\* ffsdf\*\*/);
});

test('4. Inline math: $V=IR$ -> renders KaTeX inline math span', () => {
  const html = renderMarkdown('The equation is $V=IR$ in electronics.');
  assert.match(html, /class="katex"/);
  assert.match(html, /<math/);
  assert.doesNotMatch(html, /\$V=IR\$/);
});

test('5. Display math: $$I=\\frac{V}{R}$$ -> renders KaTeX display math block', () => {
  const html = renderMarkdown('$$\nI=\\frac{V}{R}\n$$');
  assert.match(html, /class="katex-display"/);
  assert.match(html, /class="katex"/);
  assert.match(html, /<math/);
});

test('6. Math with subscripts, superscripts, Greek letters & brackets: $R_{total} = 220\\,\\Omega, x^2, [a, b]$', () => {
  const html = renderMarkdown('$R_{total} = 220\\,\\Omega, x^2, [a, b]$');
  assert.match(html, /class="katex"/);
  assert.match(html, /<math/);
});

test('7. GFM table and lists render properly', () => {
  const md = `
| Input A | Input B | Output |
|---|---|---|
| 0 | 0 | 0 |
| 1 | 1 | 1 |

- Bullet item 1
- Bullet item 2

1. Numbered 1
2. Numbered 2
`;
  const html = renderMarkdown(md);
  assert.match(html, /<table>/);
  assert.match(html, /<th>Input A<\/th>/);
  assert.match(html, /<td>0<\/td>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>Bullet item 1<\/li>/);
  assert.match(html, /<ol>/);
  assert.match(html, /<li>Numbered 1<\/li>/);
});

test('8. Fenced code blocks parsed by splitXenResponse remain code blocks', () => {
  const response = `Here is the Arduino blink code:
\`\`\`cpp
void setup() {
  pinMode(13, OUTPUT);
}
\`\`\`
Explanation: This blinks the LED.`;

  const sections = splitXenResponse(response);
  assert.equal(sections.length, 3);
  assert.equal(sections[0].type, 'text');
  assert.equal(sections[1].type, 'code');
  assert.equal(sections[1].language, 'cpp');
  assert.match(sections[1].code, /pinMode\(13, OUTPUT\)/);
  assert.equal(sections[2].type, 'text');
});

test('9. CODE_ONLY responses parse cleanly to pure code section', () => {
  const response = `\`\`\`python
def find_max(numbers):
    return max(numbers)
\`\`\``;
  const sections = splitXenResponse(response);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].type, 'code');
  assert.equal(sections[0].language, 'python');
});

test('10. Partial/incomplete math or markdown during streaming does not crash', () => {
  // Incomplete math delimiter
  assert.doesNotThrow(() => {
    const html = renderMarkdown('Voltage formula: $V = \\frac{');
    assert.ok(html);
  });

  // Incomplete display math delimiter
  assert.doesNotThrow(() => {
    const html = renderMarkdown('Display math starting: $$\n\\frac{V}{R');
    assert.ok(html);
  });

  // Incomplete bold delimiter
  assert.doesNotThrow(() => {
    const html = renderMarkdown('This is **incompl');
    assert.match(html, /incompl/);
  });
});

test('11. Exact User Welcome String: Hello! I am **Xen**, your AI Circuit Copilot powered by **Xen Step-700**.', () => {
  const welcome = "Hello! I am **Xen**, your AI Circuit Copilot powered by **Xen Step-700**.";
  const html = renderMarkdown(welcome);
  assert.match(html, /<strong>Xen<\/strong>/);
  assert.match(html, /<strong>Xen Step-700<\/strong>/);
  assert.doesNotMatch(html, /\*\*Xen\*\*/);
  assert.doesNotMatch(html, /\*\*Xen Step-700\*\*/);
});

test('12. Italic, underline, and strikethrough typography support', () => {
  const text = "This is *italic text*, this is _also italic_, and this is ~strikethrough~.";
  const html = renderMarkdown(text);
  assert.match(html, /<em>italic text<\/em>/);
  assert.match(html, /<em>also italic<\/em>/);
  assert.match(html, /<del>strikethrough<\/del>/);
});

test('13. Escaped Markdown (\\*\\*, \\#, \\*, 1\\., \\_) repairs in XenMarkdown prose while preserving multiplication & code', () => {
  const dirty = [
    '\\# Title&#x20;Here',
    '',
    '\\*\\*Summary:\\*\\* \\\\*\\\\*Xen\\\\*\\\\* helps with 2 \\* 3 = 6.',
    '',
    '- \\* First item',
    '1\\. Step one',
    '',
    'Keep variable `my_var` and math $\\mathbf{v} = \\frac{1}{2}$ intact.',
  ].join('\n');
  const html = renderXenMarkdown(dirty);
  assert.match(html, /<h1[^>]*>Title Here<\/h1>/);
  assert.match(html, /<strong[^>]*>Summary:<\/strong>/);
  assert.match(html, /<strong[^>]*>Xen<\/strong>/);
  assert.match(html, /2 \* 3 = 6/);
  assert.match(html, /<ul[\s\S]*<li>|<ul[\s\S]*<li[^>]*>\* First item|<li[^>]*>First item/);
  assert.match(html, /<ol[\s\S]*<li[^>]*>Step one/);
  assert.doesNotMatch(html, /&#x20;|\\\*\\\*|\\#/);
});

test('14. HTML entity leakage (&#x20;, &nbsp;, &amp;#x20;) and safe inline HTML formatting render cleanly without XSS', () => {
  const input = 'Space&#x20;one &amp;#x20;two &nbsp;three, <b>bold</b>, <i>ital</i>, <u>under</u>, line1<br/>line2, inline `&#x20;`';
  const html = renderXenMarkdown(input);
  assert.match(html, /Space\s+one\s+two\s+three/);
  const proseBeforeCode = html.split('<code')[0];
  assert.doesNotMatch(proseBeforeCode, /&amp;#x20;|&#x20;/);
  assert.match(html, /<code[^>]*>&amp;#x20;<\/code>/);
  assert.match(html, /<strong[^>]*>bold<\/strong>/);
  assert.match(html, /<em[^>]*>ital<\/em>/);
  assert.match(html, /<span[^>]*class="underline[^"]*"[^>]*>under<\/span>/);
  assert.match(html, /<br\s*\/>/);
  assert.doesNotMatch(html, /dangerouslySetInnerHTML/);
});

test('15. LaTeX paren/bracket delimiters \\(...\\) and \\[...\\] render with KaTeX cleanly', () => {
  const input = 'Inline \\(V = I \\times R\\) and display:\n\n\\[KE = \\frac{1}{2}mv^2\\]';
  const html = renderXenMarkdown(input);
  assert.match(html, /class="katex"/);
  assert.match(html, /<math/);
  assert.doesNotMatch(html, /\\\[KE|\\\(V = I/);
});

test('16. splitXenResponse handles inline fences, indented fences, 4-backtick nested blocks, tilde fences & long/short replies', () => {
  assert.deepEqual(splitXenResponse("I'm good!<|im_end|>"), [{ type: 'text', content: "I'm good!" }]);

  const nested = [
    'Use this markdown example:```markdown',
    '# Inner prose',
    '```',
    '',
    '````markdown',
    '```python',
    'print("\\*\\*raw inside nested code\\*\\*")',
    '```',
    '````',
    '',
    '~~~cpp',
    'int pin = 13;',
    '~~~',
    '',
    'Final \\*\\*summary\\*\\*.',
  ].join('\n');

  const sections = splitXenResponse(nested);
  assert.equal(sections.length, 5);
  assert.deepEqual(sections[0], { type: 'text', content: 'Use this markdown example:' });
  assert.equal(sections[1].type, 'code');
  assert.equal(sections[1].language, 'markdown');
  assert.equal(sections[2].type, 'code');
  assert.match(sections[2].code, /print\("\\\*\\\*raw inside nested code\\\*\\\*"\)/);
  assert.equal(sections[3].type, 'code');
  assert.equal(sections[3].language, 'cpp');
  assert.equal(sections[4].type, 'text');
  assert.equal(sections[4].content, 'Final **summary**.');

  // Streaming helper hides unclosed <think> while keeping clean partial markdown
  assert.equal(sanitizeStreamingOutput('<think>hidden reasoning'), '');
  assert.equal(sanitizeStreamingOutput('<think>ok</think>\n\n\\*\\*Hello\\*\\* '), '**Hello** ');
  assert.equal(normalizeXenMarkdown('`&#x20;` stays verbatim'), '`&#x20;` stays verbatim');
});
