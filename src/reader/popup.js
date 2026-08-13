/* ============ 释义弹窗：显示 / 定位 / 点击查词 / 选中词组查询 ============
 * 点击单词时弹窗带标签页：📖 词典 | 🤖 语境翻译 | 📚 语法分析
 */
import { $, escapeHtml } from '../lib/dom.js';
import { lookupWord, lookupChinese, lookupExamples, buildPopupHtml } from './dict.js';
import { speakWord, loadPhonetics } from './tts.js';
import { fetchAi, PROVIDER_NAMES, buildAiContentHtml, parseGrammarJson } from './ai.js';

let lastAnchor = null;

function positionPopup() {
  const popup = $('popup');
  if (!popup || !lastAnchor) return;
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  let left = lastAnchor.left + lastAnchor.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = lastAnchor.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = lastAnchor.top - ph - 8;
  if (top < 8) top = 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

export function showPopupAt(anchorRect, contentHtml, title, ai) {
  lastAnchor = anchorRect;
  const popup = $('popup');
  popup.innerHTML = '';
  popup.classList.remove('hidden');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hidePopup);
  popup.appendChild(closeBtn);
  if (title) {
    const w = document.createElement('div');
    w.className = 'popup-word';
    const wordSpan = document.createElement('span');
    wordSpan.className = 'popup-word-text';
    wordSpan.textContent = title;
    w.appendChild(wordSpan);
    const chips = document.createElement('span');
    chips.className = 'popup-phonetics';
    // 兜底喇叭按钮：音标加载出来后会被替换成 英/美 两个音标标签
    const fallbackBtn = document.createElement('button');
    fallbackBtn.className = 'popup-sound';
    fallbackBtn.textContent = '🔊';
    fallbackBtn.title = '美音发音';
    fallbackBtn.addEventListener('click', (e) => { e.stopPropagation(); speakWord(title, 'us'); });
    chips.appendChild(fallbackBtn);
    w.appendChild(chips);
    popup.appendChild(w);
    loadPhonetics(title, chips);
  }

  if (ai && ai.sentence) {
    // 带标签页：词典 / AI 语境翻译 / 语法分析
    const tabs = document.createElement('div');
    tabs.className = 'popup-tabs';
    const defs = [
      ['dict', '📖 词典'],
      ['ai-translate', '🤖 语境翻译'],
      ['ai-grammar', '📚 语法分析'],
    ];
    defs.forEach(([id, label]) => {
      const b = document.createElement('button');
      b.className = 'popup-tab' + (id === 'dict' ? ' active' : '');
      b.dataset.tab = id;
      b.textContent = label;
      tabs.appendChild(b);
    });
    popup.appendChild(tabs);

    const panes = {};
    ['dict', 'ai-translate', 'ai-grammar'].forEach(id => {
      const p = document.createElement('div');
      p.className = 'popup-pane' + (id === 'dict' ? '' : ' hidden');
      p.dataset.pane = id;
      popup.appendChild(p);
      panes[id] = p;
    });
    panes.dict.innerHTML = contentHtml;

    tabs.addEventListener('click', (e) => {
      const tab = e.target.closest('.popup-tab');
      if (!tab) return;
      const id = tab.dataset.tab;
      tabs.querySelectorAll('.popup-tab').forEach(t => t.classList.toggle('active', t === tab));
      Object.keys(panes).forEach(k => panes[k].classList.toggle('hidden', k !== id));
      if (id === 'ai-translate') loadAiPane(panes['ai-translate'], 'translate', ai);
      if (id === 'ai-grammar') loadAiPane(panes['ai-grammar'], 'grammar', ai);
    });
  } else {
    // 无 AI 上下文（如选中词组查询）：保持原样
    const body = document.createElement('div');
    body.innerHTML = contentHtml;
    popup.appendChild(body);
  }

  positionPopup();
}

async function loadAiPane(pane, kind, ai) {
  if (pane.dataset.loaded === '1') return;
  pane.dataset.loaded = '1';
  // 语境翻译：顶部显示原句 + 高亮选中单词
  if (kind === 'translate' && ai.sentence) {
    const sent = document.createElement('div');
    sent.className = 'ai-sentence';
    sent.innerHTML = highlightWord(escapeHtml(ai.sentence), ai.word);
    pane.appendChild(sent);
  }
  // 结果容器：loading / 结果 / 错误都放在这里，保留上面的原句
  const box = document.createElement('div');
  box.className = 'ai-result-box';
  pane.appendChild(box);
  const loadingText = kind === 'translate'
    ? '⏳ AI 结合语境分析「' + ai.word + '」…'
    : '⏳ 语法分析中…';
  box.innerHTML = '<div class="ai-loading">' + escapeHtml(loadingText) + '</div>';
  const res = await fetchAi(kind, ai.word, ai.sentence);
  if (res.ok) {
    box.innerHTML = '';
    const meta = document.createElement('div');
    meta.className = 'ai-meta';
    meta.textContent = '由 ' + (PROVIDER_NAMES[res.provider] || res.provider) + ' 生成 · 同一单词同一句子只请求一次';
    box.appendChild(meta);
    if (kind === 'grammar') {
      const parsed = parseGrammarJson(res.content);
      if (parsed.ok) {
        box.appendChild(renderGrammarChunks(parsed));
      } else {
        const content = document.createElement('div');
        content.className = 'ai-content';
        content.textContent = res.content;
        box.appendChild(content);
      }
    } else {
      const content = document.createElement('div');
      content.className = 'ai-content';
      content.innerHTML = buildAiContentHtml(res.content);
      box.appendChild(content);
    }
  } else {
    box.innerHTML = '<div class="popup-error">❌ ' + escapeHtml(res.error) + '</div>';
  }
  positionPopup();
}

// ===== 语法分析：行内下标注（Enpuz 式）渲染 =====
// 整句保持原样，每个词/短语下方用小标签标出成分，主句与从句用底色区分
function renderGrammarChunks(parsed) {
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

// 成分 → 标签颜色
function roleColorClass(role) {
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

// 在句子中高亮选中单词（不区分大小写，按词边界匹配）
function highlightWord(escapedSentence, word) {
  if (!word) return escapedSentence;
  const w = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('(\\b' + w + '\\b)', 'gi');
  return escapedSentence.replace(re, '<span class="ai-word-hl">$1</span>');
}

export function hidePopup() {
  const popup = $('popup');
  popup.classList.add('hidden');
  popup.innerHTML = '';
}
document.addEventListener('click', (e) => { if (!$('popup').contains(e.target)) hidePopup(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopup(); });

/* 取单词所在句子（按标点切分，找到包含该单词的那一句） */
function sentenceOf(span) {
  const p = span.closest('p');
  if (!p) return '';
  const text = p.textContent || '';
  const word = (span.dataset.word || '').toLowerCase();
  const re = /[^.!?。！？]+[.!?。！？]*/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m[0].toLowerCase().includes(word)) return m[0].trim();
  }
  return text.trim();
}

/* 点击单词查词 + 选中词组查询 */
export function initWordLookup() {
  const articleContent = $('article-content');

  articleContent.addEventListener('click', async (e) => {
    const span = e.target.closest('.word');
    if (!span) return;
    e.stopPropagation();
    const word = span.dataset.word;
    const aiCtx = { word, sentence: sentenceOf(span) };
    showPopupAt(span.getBoundingClientRect(), '<div class="popup-error">查询中…</div>', word, aiCtx);
    const [entry, zh, examples] = await Promise.all([
      lookupWord(word).catch(err => ({ error: err })),
      lookupChinese(word).catch(() => ''),
      lookupExamples(word).catch(() => []),
    ]);
    showPopupAt(span.getBoundingClientRect(), buildPopupHtml(entry, zh, examples), word, aiCtx);
  });

  articleContent.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text || text.length < 2) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showLookupBtn(rect, text);
    }, 10);
  });
}

export function showLookupBtn(rect, text) {
  const old = document.getElementById('lookup-btn');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.id = 'lookup-btn';
  btn.className = 'btn btn-primary';
  btn.textContent = '🔍 查询词组';
  btn.style.cssText = 'position:fixed;z-index:150;';
  btn.style.left = Math.min(rect.left, window.innerWidth - 120) + 'px';
  btn.style.top = (rect.bottom + 6) + 'px';
  btn.addEventListener('click', async () => {
    btn.remove();
    hidePopup();
    showPopupAt(rect, '<div class="popup-error">查询中…</div>', text);
    const [entry, zh] = await Promise.all([
      lookupWord(text).catch(err => ({ error: err })),
      lookupChinese(text).catch(() => ''),
    ]);
    if ((entry && entry.error) && !zh) {
      showPopupAt(rect, '<div class="popup-error">词组未收录，试试点击单个单词查词</div>', text);
    } else {
      showPopupAt(rect, buildPopupHtml(entry, zh), text);
    }
  });
  document.body.appendChild(btn);
}
document.addEventListener('click', (e) => {
  if (e.target.id !== 'lookup-btn') {
    const b = document.getElementById('lookup-btn');
    if (b) b.remove();
  }
});
