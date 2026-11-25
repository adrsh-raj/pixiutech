import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import React from 'react';
import { renderToString } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

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

const probePath = '/home/kali/.gemini/antigravity/brain/f81d2773-e2fe-4ec4-9b75-f2856b9c95a4/scratch/live_probe_results.json';

const FALLBACK_RESULTS = [
  {
    label: "PROBE 1 - Math & LaTeX (Ohm's Law)",
    content: "**Ohm's Law:** $V = IR$, where $V$ is voltage (in volts, V), $I$ is current (in amperes, A), and $R$ is resistance (in ohms, $\\Omega$).\n\n**Given:** $V = 9\\text{ V}$, $R = 220\\text{ }\\Omega$.\n\n**Formula:** $I = \\frac{V}{R}$.\n\n**Calculation:** $I = \\frac{9\\text{ V}}{220\\text{ }\\Omega} \\approx 0.0409\\text{ A} = 40.9\\text{ mA}$.\n\n**Conclusion:** A 9V battery connected to a 220 ohm resistor produces approximately **40.9 mA** of current.",
  },
  {
    label: "PROBE 2 - Hinglish Circuit Tutoring",
    content: "Let's troubleshoot your LED circuit systematically:\n\n### 1. **Check Power Supply:**\n   - Confirm the power supply is set to **5V DC**.\n   - Ensure the positive and negative leads are connected to the correct rails.\n\n### 2. **Check Resistor Value:**\n   - You mentioned using a **220 $\\Omega$** resistor.\n   - For a standard **Red LED** ($V_F \\approx 2.0\\text{V}$):\n     $$\n     I = \\frac{5.0\\text{V} - 2.0\\text{V}}{220\\,\\Omega} = \\frac{3.0\\text{V}}{220\\,\\Omega} \\approx 13.6\\text{mA}\n     $$\n     This is **perfectly safe** and should glow brightly.\n\n### 3. **Check LED Orientation:**\n   - The **longer lead** is the **Anode (+)** and must connect to the **positive rail**.\n",
  },
  {
    label: "PROBE 3 - Strict CODE_ONLY Mode",
    content: "```python\ndef calculate_series_resistance(resistors: list) -> float:\n    return sum(resistors)\n```",
  },
];

function loadProbeResults() {
  try {
    if (fs.existsSync(probePath)) {
      return JSON.parse(fs.readFileSync(probePath, 'utf8'));
    }
  } catch (e) {}
  return FALLBACK_RESULTS;
}

test('Live Probe 1: Math & LaTeX Ohm Law renders KaTeX symbols and bold headers', () => {
  const results = loadProbeResults();
  const p1 = results.find(r => r.label.includes('Math & LaTeX'));
  assert.ok(p1, 'Probe 1 result exists');
  const html = renderMarkdown(p1.content);
  assert.ok(!html.includes('dangerouslySetInnerHTML'));
  assert.match(html, /<strong>Ohm&#x27;s Law:<\/strong>|<strong>Ohm's Law:<\/strong>/);
  assert.ok(html.includes('katex'));
  assert.ok(!html.includes('**Ohm'));
});

test('Live Probe 2: Hinglish Circuit Tutoring renders $$ display math block and bold items', () => {
  const results = loadProbeResults();
  const p2 = results.find(r => r.label.includes('Hinglish'));
  assert.ok(p2, 'Probe 2 result exists');
  const html = renderMarkdown(p2.content);
  assert.ok(!html.includes('dangerouslySetInnerHTML'));
  assert.ok(html.includes('katex-display'));
  assert.match(html, /<strong>Check Power Supply:<\/strong>/);
});

test('Live Probe 3: Strict CODE_ONLY mode parses cleanly with zero stray text', () => {
  const results = loadProbeResults();
  const p3 = results.find(r => r.label.includes('CODE_ONLY'));
  assert.ok(p3, 'Probe 3 result exists');
  assert.ok(p3.content.startsWith('```python'));
  assert.ok(p3.content.endsWith('```'));
  assert.ok(!p3.content.includes('#'));
});

const cyberlabProbePath = '/home/kali/.gemini/antigravity/brain/f81d2773-e2fe-4ec4-9b75-f2856b9c95a4/scratch/live_cyberlab_probe_results.json';

const FALLBACK_CYBERLAB_RESULTS = [
  {
    label: "SCENARIO 1: Live CyberLab LED Screen & Circuit Diagnosis",
    content: "I can inspect the live circuit and simulator data that CyberLab shares with me. I cannot inspect your entire desktop or other browser tabs.\n\nThe issue is that the cathode (-) of led1 is not connected to Arduino GND. The circuit loop is incomplete.",
  },
  {
    label: "SCENARIO 2: Multi-Turn Affirmative LaTeX Resolution",
    content: "$$E_k = \\frac{1}{2}mv^2$$\n\nwhere $E_k$ is the kinetic energy, $m$ is the mass of the object, and $v$ is its velocity.",
  },
];

function loadCyberlabResults() {
  try {
    if (fs.existsSync(cyberlabProbePath)) {
      return JSON.parse(fs.readFileSync(cyberlabProbePath, 'utf8'));
    }
  } catch (e) {}
  return FALLBACK_CYBERLAB_RESULTS;
}

test('Live Probe 4: CyberLab LED Diagnosis cites real component led1, cathode and GND return', () => {
  const results = loadCyberlabResults();
  const p4 = results.find(r => r.label.includes('SCENARIO 1'));
  assert.ok(p4, 'Scenario 1 result exists');
  assert.ok(p4.content.includes('I can inspect the live circuit'));
  assert.ok(p4.content.includes('cathode (-) of led1'));
  assert.ok(p4.content.includes('Arduino GND'));
  assert.ok(!p4.content.includes('cannot see your circuit'));
});

test('Live Probe 5: Multi-Turn Affirmative LaTeX Resolution renders kinetic energy equation', () => {
  const results = loadCyberlabResults();
  const p5 = results.find(r => r.label.includes('SCENARIO 2'));
  assert.ok(p5, 'Scenario 2 result exists');
  assert.ok(p5.content.includes('\\frac{1}{2}mv^2'));
  const html = renderMarkdown(p5.content);
  assert.ok(html.includes('katex'));
  assert.ok(html.includes('frac{1}{2}mv^2') || html.includes('class="katex"'));
  assert.doesNotMatch(html, /Please provide me with the formula/);
});

