/* ============ 语法分析页三合一渲染（结构树 + 流水词块 + 双语对照） ============
 * 供 grammar.html 使用（阅读器弹窗仍走 grammar.js 的 Enpuz 行内样式）。
 * 输入：parseGrammarJson 的解析结果 { summary, translation, chunks:[{text,role,clause}] }。
 * 输出：包含三个区块的 DOM 元素（样式见 src/styles/grammar.css，类前缀 gav-）。
 */
import { escapeHtml } from '../lib/dom.js';
import { roleColorClass } from './grammar.js';

// 从句分类：主句 / 从句 / 无从句信息
function clauseKind(clause) {
  if (!clause) return '';
  return clause === '主句' ? 'main' : 'dep';
}

/* ===== 区块 ① 结构树：按从句分组列出成分 ===== */
function buildTreeEl(chunks) {
  const groups = [];
  const map = new Map();
  for (const c of chunks) {
    if (c.role === '标点' || !c.clause) continue;
    if (!map.has(c.clause)) { map.set(c.clause, []); groups.push(c.clause); }
    map.get(c.clause).push(c);
  }
  const box = document.createElement('div');
  box.className = 'gav-tree';
  const root = document.createElement('div');
  root.className = 'gav-tree-root';
  root.textContent = groups.length > 1
    ? '句子结构（' + groups.join(' + ') + '）'
    : (groups.length === 1 ? '句子结构（' + groups[0] + '）' : '句子结构');
  box.appendChild(root);

  if (!groups.length) {
    const empty = document.createElement('div');
    empty.className = 'gav-tree-line';
    empty.textContent = '（AI 未返回从句信息）';
    box.appendChild(empty);
    return box;
  }

  // 缩进：第 0 层为从句名，第 1 层为成分（超过一层用两个 tab 缩进表示嵌套）
  let lastIdx = -1;
  groups.forEach((clause) => {
    const kind = clauseKind(clause);
    const line = document.createElement('div');
    line.className = 'gav-tree-line';
    const marker = document.createElement('span');
    marker.className = 'gav-tree-marker';
    marker.textContent = (lastIdx >= 0) ? '└─' : '├─';
    const name = document.createElement('span');
    name.className = 'gav-clause ' + (kind === 'main' ? 'main' : 'dep');
    name.textContent = clause;
    line.appendChild(marker);
    line.appendChild(name);
    box.appendChild(line);
    lastIdx = 0;

    const items = map.get(clause) || [];
    items.forEach((c, i) => {
      const node = document.createElement('div');
      node.className = 'gav-tree-line';
      const pad = document.createElement('span');
      pad.className = 'gav-tree-marker';
      pad.textContent = (i === items.length - 1 ? '└─ ' : '├─ ');
      const role = document.createElement('span');
      role.className = 'gav-role';
      role.textContent = c.role ? c.role + '：' : '';
      const text = document.createElement('span');
      text.textContent = c.text;
      node.appendChild(pad);
      node.appendChild(role);
      node.appendChild(text);
      box.appendChild(node);
    });
  });
  return box;
}

/* ===== 区块 ② 流水词块：词在上、成分标签在下，主句/从句用边框色 ===== */
function buildStreamEl(chunks) {
  const stream = document.createElement('div');
  stream.className = 'gav-stream';
  for (const c of chunks) {
    if (c.role === '标点') {
      const punc = document.createElement('span');
      punc.className = 'gav-punc';
      punc.textContent = c.text;
      stream.appendChild(punc);
      continue;
    }
    const kind = clauseKind(c.clause);
    const card = document.createElement('span');
    card.className = 'gav-chunk' + (kind ? ' ' + kind : '');
    card.title = c.clause || c.role || '';
    const txt = document.createElement('span');
    txt.className = 'gav-chunk-txt';
    txt.textContent = c.text;
    card.appendChild(txt);
    if (c.role) {
      const tag = document.createElement('span');
      tag.className = 'gav-chunk-role ' + roleColorClass(c.role);
      tag.textContent = c.role;
      card.appendChild(tag);
    }
    stream.appendChild(card);
  }
  return stream;
}

/* ===== 区块 ③ 双语对照：英文按成分着色 + 中文翻译 + 结构总结 ===== */
function buildBilingualEl(parsed) {
  const box = document.createElement('div');
  box.className = 'gav-bili';

  // 英文行：按 chunks 还原，成分着色，标点紧跟无空格
  const en = document.createElement('div');
  en.className = 'gav-en';
  let first = true;
  for (const c of parsed.chunks) {
    if (c.role === '标点') {
      en.appendChild(document.createTextNode(c.text));
      continue;
    }
    if (!first) en.appendChild(document.createTextNode(' '));
    first = false;
    const w = document.createElement('span');
    w.className = roleColorClass(c.role);
    w.textContent = c.text;
    if (c.clause) w.title = c.clause;
    en.appendChild(w);
  }
  box.appendChild(en);

  if (parsed.translation) {
    const zh = document.createElement('div');
    zh.className = 'gav-zh';
    zh.textContent = parsed.translation;
    box.appendChild(zh);
  }

  if (parsed.summary) {
    const sum = document.createElement('div');
    sum.className = 'gav-summary';
    sum.textContent = '结构总结：' + parsed.summary;
    box.appendChild(sum);
  }
  return box;
}

/* ===== 组装：三区块带小标题 ===== */
function section(title, emoji, body) {
  const sec = document.createElement('div');
  sec.className = 'gav-section';
  const head = document.createElement('div');
  head.className = 'gav-sec-head';
  head.textContent = emoji + ' ' + title;
  sec.appendChild(head);
  sec.appendChild(body);
  return sec;
}

export function renderGrammarCombined(parsed) {
  const wrap = document.createElement('div');
  wrap.className = 'gav';
  wrap.appendChild(section('结构树 · 句子层次', '①', buildTreeEl(parsed.chunks)));
  wrap.appendChild(section('流水词块 · 原文成分', '②', buildStreamEl(parsed.chunks)));
  wrap.appendChild(section('双语对照 · 整句理解', '③', buildBilingualEl(parsed)));
  return wrap;
}
