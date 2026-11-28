import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { normalizeXenMarkdown } from '../../lib/ai/xen/xen-sanitizer.js';

const SAFE_INLINE_HTML_MAP = {
  u: 'u',
  ins: 'u',
  b: 'strong',
  strong: 'strong',
  i: 'em',
  em: 'em',
  s: 'del',
  del: 'del',
  sub: 'sub',
  sup: 'sup',
};

function buildSafeInlineElement(tagName, children) {
  if (tagName === 'code') {
    const textValue = children.map((c) => (typeof c?.value === 'string' ? c.value : '')).join('');
    return { type: 'inlineCode', value: textValue };
  }
  const hName = SAFE_INLINE_HTML_MAP[tagName];
  if (!hName) return null;
  return {
    type: 'element',
    data: { hName },
    children,
  };
}

/**
 * Lightweight remark AST plugin to transform safe inline formatting HTML tags
 * (<u>, <ins>, <b>, <strong>, <i>, <em>, <s>, <del>, <code>, <sub>, <sup>, <br/>)
 * without dangerouslySetInnerHTML or raw script/attribute pass-through.
 */
function remarkSafeInlineHtml() {
  return (tree) => {
    function visit(node) {
      if (!node || !Array.isArray(node.children)) return;
      const newChildren = [];
      let i = 0;
      while (i < node.children.length) {
        const child = node.children[i];
        if (child.type === 'html' && typeof child.value === 'string') {
          const trimmedHtml = child.value.trim();
          if (/^<br\s*\/?>$/i.test(trimmedHtml)) {
            newChildren.push({ type: 'break' });
            i++;
            continue;
          }
          const selfPaired = trimmedHtml.match(/^<(u|ins|b|strong|i|em|s|del|code|sub|sup)(?:\s+[^>]*)?>([\s\S]*?)<\/\1>$/i);
          if (selfPaired) {
            const el = buildSafeInlineElement(selfPaired[1].toLowerCase(), [{ type: 'text', value: selfPaired[2] }]);
            if (el) {
              newChildren.push(el);
              i++;
              continue;
            }
          }
          const openMatch = trimmedHtml.match(/^<(u|ins|b|strong|i|em|s|del|code|sub|sup)(?:\s+[^>]*)?>$/i);
          if (openMatch) {
            const tag = openMatch[1].toLowerCase();
            const closeRegex = new RegExp(`^<\\/${tag}>$`, 'i');
            const innerChildren = [];
            let j = i + 1;
            let foundClose = false;
            while (j < node.children.length) {
              const sib = node.children[j];
              if (sib.type === 'html' && typeof sib.value === 'string' && closeRegex.test(sib.value.trim())) {
                foundClose = true;
                break;
              }
              innerChildren.push(sib);
              j++;
            }
            if (foundClose) {
              const el = buildSafeInlineElement(tag, innerChildren);
              if (el) {
                visit(el);
                newChildren.push(el);
                i = j + 1;
                continue;
              }
            }
          }
        }
        visit(child);
        newChildren.push(child);
        i++;
      }
      node.children = newChildren;
    }
    visit(tree);
  };
}

/**
 * Scoped, dark-theme Markdown & KaTeX LaTeX renderer for Xen responses.
 * Never uses dangerouslySetInnerHTML.
 * Ensures equations, tables, lists, and typography render cleanly across desktop and mobile.
 */
export function XenMarkdown({ content, isUser = false, className = '' }) {
  if (!content) return null;
  const renderedContent = isUser ? content : normalizeXenMarkdown(content);

  return (
    <div
      className={`xen-markdown text-sm leading-relaxed ${
        isUser ? 'text-white' : 'text-slate-100'
      } ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath, remarkSafeInlineHtml]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base font-bold my-2 text-white border-b border-slate-700/60 pb-1">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-bold my-1.5 text-slate-100">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs font-bold my-1 text-slate-200">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 last:mb-0 leading-relaxed whitespace-pre-wrap">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-white">
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-200">
              {children}
            </em>
          ),
          u: ({ children }) => (
            <span className="underline underline-offset-2 text-cyan-300">
              {children}
            </span>
          ),
          ins: ({ children }) => (
            <span className="underline underline-offset-2 text-cyan-300">
              {children}
            </span>
          ),
          del: ({ children }) => (
            <del className="line-through text-slate-400">
              {children}
            </del>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1 my-1.5 pl-1 text-slate-200">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1 my-1.5 pl-1 text-slate-200">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">
              {children}
            </li>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cyan-400/80 pl-3 my-2 italic text-slate-300 bg-slate-900/50 py-1 rounded-r">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2.5 rounded-lg border border-slate-700/80 bg-slate-900/40">
              <table className="min-w-full divide-y divide-slate-700 text-xs text-left">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-slate-800/90 text-slate-200 font-semibold border-b border-slate-700">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="hover:bg-slate-800/30 transition-colors">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 font-semibold text-slate-200">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 text-slate-300">
              {children}
            </td>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 underline underline-offset-2 hover:text-cyan-300 transition-colors"
            >
              {children}
            </a>
          ),
          code: ({ children, className: _className }) => (
            <code className="rounded bg-slate-900/90 px-1.5 py-0.5 font-mono text-[11px] text-cyan-300 border border-slate-700/60">
              {children}
            </code>
          ),
        }}
      >
        {renderedContent}
      </ReactMarkdown>
    </div>
  );
}
