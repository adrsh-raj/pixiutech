import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { splitXenResponse } from '../../src/lib/ai/xen/xen-sanitizer.js';

function renderMarkdown(content) {
  return renderToString(
    React.createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkMath],
        rehypePlugins: [[rehypeKatex, { throwOnError: false, strict: false }]],
      },
      content
    )
  );
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

test('11. Exact User Welcome String: Hello! I am **8square**, your AI Circuit Copilot powered by **Xen Step-700**.', () => {
  const welcome = "Hello! I am **8square**, your AI Circuit Copilot powered by **Xen Step-700**.";
  const html = renderMarkdown(welcome);
  assert.match(html, /<strong>8square<\/strong>/);
  assert.match(html, /<strong>Xen Step-700<\/strong>/);
  assert.doesNotMatch(html, /\*\*8square\*\*/);
  assert.doesNotMatch(html, /\*\*Xen Step-700\*\*/);
});

test('12. Italic, underline, and strikethrough typography support', () => {
  const text = "This is *italic text*, this is _also italic_, and this is ~strikethrough~.";
  const html = renderMarkdown(text);
  assert.match(html, /<em>italic text<\/em>/);
  assert.match(html, /<em>also italic<\/em>/);
  assert.match(html, /<del>strikethrough<\/del>/);
});
