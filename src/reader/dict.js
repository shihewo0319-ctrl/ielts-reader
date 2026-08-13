/* ============ 词典查询（多源 + 中文 + 例句 + 释义 HTML 构建） ============ */
import { escapeHtml, stripHtml } from '../lib/dom.js';
import { fetchJson } from '../lib/api.js';

// 源1：Free Dictionary API（信息最全：音标+释义+例句）
async function lookupFreeDict(word) {
  const data = await fetchJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!Array.isArray(data) || !data[0]) throw new Error('未找到该词');
  const e = data[0];
  return {
    source: 'Free Dictionary API',
    phonetic: (e.phonetics || []).map(p => p.text).filter(Boolean)[0] || '',
    meanings: (e.meanings || []).slice(0, 3).map(m => ({
      partOfSpeech: m.partOfSpeech || '',
      definition: (m.definitions || []).map(d => d.definition).filter(Boolean)[0] || '',
      example: (m.definitions || []).map(d => d.example).filter(Boolean)[0] || '',
    })).filter(m => m.definition),
  };
}

// 源2：Datamuse（稳定、响应快，无需 Key）
async function lookupDatamuse(word) {
  const data = await fetchJson(`https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d,p&max=1`);
  const e = Array.isArray(data) && data[0];
  if (!e || !Array.isArray(e.defs) || !e.defs.length) throw new Error('未找到该词');
  const tags = e.tags || [];
  const pron = tags.find(t => t.startsWith('pron:')) || '';
  return {
    source: 'Datamuse',
    phonetic: pron.replace(/^pron:/, ''),
    meanings: e.defs.slice(0, 3).map(d => {
      const i = d.indexOf('\t');
      return {
        partOfSpeech: i > 0 ? d.slice(0, i) : '',
        definition: i > 0 ? d.slice(i + 1) : d,
        example: '',
      };
    }),
  };
}

// 源3：Wiktionary（维基媒体基础设施，长期稳定）
async function lookupWiktionary(word) {
  const data = await fetchJson(`https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(word)}`);
  const list = data && data.en;
  if (!Array.isArray(list) || !list.length) throw new Error('未找到该词');
  const meanings = [];
  for (const item of list.slice(0, 3)) {
    const def = (item.definitions || []).map(d => stripHtml(d.definition || '')).filter(Boolean)[0];
    if (!def) continue;
    meanings.push({ partOfSpeech: item.partOfSpeech || '', definition: def, example: '' });
  }
  if (!meanings.length) throw new Error('未找到该词');
  return { source: 'Wiktionary', phonetic: '', meanings };
}

// 中文释义：通过本地代理请求有道词典（同源，避免浏览器跨域限制）
export async function lookupChinese(word) {
  const data = await fetchJson(`/api/chinese?word=${encodeURIComponent(word)}`, 6000);
  if (!data || !data.ok || !data.explain) throw new Error('无中文释义');
  return data.explain;
}

// 例句：通过本地代理请求有道词典（同源，避免跨域），返回英中双语例句
const exampleCache = {};
export async function lookupExamples(word) {
  if (exampleCache[word]) return exampleCache[word];
  const data = await fetchJson(`/api/sentences?word=${encodeURIComponent(word)}`, 6000);
  const list = (data && data.ok && Array.isArray(data.sentences)) ? data.sentences : [];
  exampleCache[word] = list;
  return list;
}

// 词典源选择（localStorage 持久化）
export const dictSourceKey = 'ieltsDictSource';
export function getDictSource() {
  try { return localStorage.getItem(dictSourceKey) || 'auto'; } catch { return 'auto'; }
}

// 统一入口：按用户选择的源查询；选"自动"则按顺序尝试
export async function lookupWord(word) {
  const source = getDictSource();
  const sourceMap = {
    free: [lookupFreeDict],
    datamuse: [lookupDatamuse],
    wiktionary: [lookupWiktionary],
    auto: [lookupFreeDict, lookupDatamuse, lookupWiktionary],
  };
  const list = sourceMap[source] || sourceMap.auto;
  const errors = [];
  for (const fn of list) {
    try {
      return await fn(word);
    } catch (e) {
      errors.push(e.message || e);
    }
  }
  throw new Error('词典查询失败：' + [...new Set(errors)].join(' / '));
}

export function buildMeaningsHtml(entry) {
  let html = '';
  for (const m of (entry.meanings || [])) {
    if (!m.definition) continue;
    html += `<div class="def"><span class="pos">${escapeHtml(m.partOfSpeech || '')}</span><span class="def-text">${escapeHtml(m.definition)}</span>`;
    if (m.example) html += `<div class="ex">例：${escapeHtml(m.example)}</div>`;
    html += `</div>`;
  }
  // 必须有 .popup-meanings 包裹层，词性标签样式才能生效
  return html ? `<div class="popup-meanings">${html}</div>` : '<div class="popup-error">暂无释义</div>';
}

export function buildExamplesHtml(sentences) {
  let html = '<div class="popup-examples-label">例句</div>';
  for (const s of sentences.slice(0, 3)) {
    html += '<div class="popup-example">';
    if (s.en) html += `<div class="ex-en">${escapeHtml(s.en)}</div>`;
    if (s.zh) html += `<div class="ex-zh">${escapeHtml(s.zh)}</div>`;
    html += '</div>';
  }
  return html;
}

export function buildPopupHtml(entry, zh, examples) {
  let html = '';
  const hasEn = !(entry && entry.error);
  if (entry && entry.error) {
    html += `<div class="popup-error">${escapeHtml(entry.error.message || '英文释义查询失败')}</div>`;
  } else if (entry) {
    const phonetic = (entry.phonetics || []).map(p => p.text).filter(Boolean)[0] || '';
    if (phonetic) html += `<div class="popup-phonetic">${escapeHtml(phonetic)}</div>`;
    html += buildMeaningsHtml(entry);
    html += `<div class="popup-src">来源：${escapeHtml(entry.source || "词典")}</div>`;
  }
  if (zh) {
    // 英文释义正常显示时，用分割线隔开；只有中文时不再加分割线
    if (hasEn) html += '<div class="popup-divider"></div>';
    html += `<div class="popup-zh"><span class="pos">中文</span>${escapeHtml(zh)}</div>`;
  }
  if (examples && examples.length) {
    // 例句区与上文用分割线隔开
    if (hasEn || zh) html += '<div class="popup-divider"></div>';
    html += buildExamplesHtml(examples);
  }
  return html;
}
