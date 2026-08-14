/* ============ 语法分析渲染（Enpuz 式行内下标注） ============
 * 把 ai.js 的 parseGrammarJson 结果渲染成：整句保持原样、每个词/短语下方
 * 用小标签标出成分、主句与从句用底色区分、底部带图例。
 * 同时提供在句子中高亮选中单词的工具函数（语境翻译原句也用）。
 * 注：语法分析页（grammar.html）的三合一渲染在 grammar-view.js，本模块只管弹窗。
 */
// 成分 → 标签颜色（弹窗渲染与语法分析页共用）
export function roleColorClass(role) {
  if (/主语/.test(role)) return 'subj';
  if (/谓语|系表/.test(role)) return 'pred';
  if (/宾语/.test(role)) return 'obj';
  if (/状语|补语/.test(role)) return 'adv';
  if (/连词/.test(role)) return 'conj';
  if (/定语/.test(role)) return 'att';
  return 'def';
}

// 从句名 → 底色（区分多个从句）
function clauseBg(clause) {
  let h = 0;
  for (const ch of String(clause)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return ['c1', 'c2', 'c3', 'c4'][h % 4];
}

function legendItem(label, cls) {
  const item = document.createElement('span');
  item.className = 'grammar-legend-item';
  const sw = document.createElement('i');
  sw.className = 'legend-swatch ' + cls;
  item.appendChild(sw);
  item.appendChild(document.createTextNode(label));
  return item;
}

export function renderGrammarChunks(parsed) {
  const wrap = document.createElement('div');
  wrap.className = 'ai-grammar';

  if (parsed.summary) {
    const sum = document.createElement('div');
    sum.className = 'grammar-summary';
    sum.textContent = parsed.summary;
    wrap.appendChild(sum);
  }

  const sent = document.createElement('div');
  sent.className = 'grammar-chunks';
  for (const c of parsed.chunks) {
    const item = document.createElement('span');
    item.className = 'grammar-chunk';
    if (c.clause) {
      item.classList.add('in-clause', clauseBg(c.clause));
      item.title = c.clause;
    }
    const txt = document.createElement('span');
    txt.className = 'grammar-word';
    txt.textContent = c.text;
    item.appendChild(txt);
    if (c.role && c.role !== '标点') {
      const tag = document.createElement('span');
      tag.className = 'grammar-tag ' + roleColorClass(c.role);
      tag.textContent = c.role;
      item.appendChild(tag);
    }
    sent.appendChild(item);
  }
  wrap.appendChild(sent);

  // 图例
  const legend = document.createElement('div');
  legend.className = 'grammar-legend';
  [['主语', 'subj'], ['谓语/系表', 'pred'], ['宾语', 'obj'],
   ['状语/补语', 'adv'], ['连词', 'conj'], ['定语', 'att']]
    .forEach(([label, cls]) => legend.appendChild(legendItem(label, cls)));
  wrap.appendChild(legend);

  return wrap;
}

// 在句子中高亮选中单词（不区分大小写，按词边界匹配）
export function highlightWord(escapedSentence, word) {
  if (!word) return escapedSentence;
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(\\b' + w + '\\b)', 'gi');
  return escapedSentence.replace(re, '<span class="ai-word-hl">$1</span>');
}
