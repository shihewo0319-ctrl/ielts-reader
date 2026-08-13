/* ============ 状态 ============ */
let articleText = '';          // 当前文章纯文本
let aiVocab = [];              // AI 整理出的词汇 [{word, meaning}]
const settingsKey = 'ieltsAiSettings';

/* ============ 示例文章 ============ */
const SAMPLE_ARTICLE = `The Impact of Urban Green Spaces

Urbanisation has accelerated at an unprecedented rate over the past century, with more than half of the world's population now residing in cities. While urban development has brought economic prosperity and improved living standards, it has also given rise to a range of environmental and social challenges. One increasingly prominent solution is the creation and preservation of green spaces within cities.

Green spaces, which include parks, gardens, and tree-lined streets, provide a multitude of benefits. Firstly, they contribute to the mitigation of air pollution by absorbing carbon dioxide and releasing oxygen. Trees also act as natural filters, trapping particulate matter that would otherwise be inhaled by residents. Furthermore, green areas help to regulate urban temperatures, counteracting the so-called "heat island" effect whereby concrete and asphalt retain heat and make cities considerably warmer than surrounding rural areas.

In addition to environmental advantages, green spaces have a significant impact on public health and wellbeing. Research has consistently demonstrated that access to nature reduces stress levels, lowers blood pressure, and improves mental health. Children who play in parks tend to be more physically active, which helps to combat the growing problem of childhood obesity. Moreover, these spaces foster social cohesion by providing neutral grounds where people from diverse backgrounds can interact and form communities.

Nevertheless, the provision of green space is not without controversy. Critics argue that land in urban centres is too valuable to be reserved for parks, particularly in cities facing acute housing shortages. They contend that the same land could accommodate residential developments, thereby alleviating pressure on housing markets. Proponents, however, counter that the long-term costs of neglecting green infrastructure, such as higher healthcare expenditure and degraded air quality, far outweigh the short-term economic gains.

In conclusion, although the debate between development and environmental preservation is unlikely to be resolved easily, the evidence overwhelmingly supports the integration of green spaces into urban planning. Cities that prioritise greenery are not only more sustainable but also more liveable, offering their inhabitants a healthier and more harmonious environment in which to thrive.`;

/* ============ DOM ============ */
const $ = (id) => document.getElementById(id);
const dropZone = $('drop-zone');
const fileInput = $('file-input');
const articlePanel = $('article-panel');
const articleTitle = $('article-title');
const articleContent = $('article-content');
const vocabPanel = $('vocab-panel');
const vocabList = $('vocab-list');
const vocabCount = $('vocab-count');
const popup = $('popup');
const btnAI = $('btn-ai');

/* 词典源选择器 */
const dictSelect = $('dict-source');
if (dictSelect) {
  dictSelect.value = getDictSource();
  const syncTitle = () => {
    const opt = dictSelect.options[dictSelect.selectedIndex];
    dictSelect.title = '当前词典源：' + (opt ? opt.text : '');
  };
  syncTitle();
  dictSelect.addEventListener('change', () => {
    localStorage.setItem(dictSourceKey, dictSelect.value);
    syncTitle();
    hidePopup();
  });
}
const settingsModal = $('settings-modal');

/* ============ 文章加载 ============ */
function loadArticle(text, title = '阅读文章') {
  articleText = text;
  aiVocab = [];
  articleTitle.textContent = title;
  renderArticle();
  vocabPanel.classList.add('hidden');
  $('upload-panel').classList.add('hidden');
  articlePanel.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderArticle() {
  articleContent.innerHTML = '';
  const paragraphs = articleText.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.appendChild(tokenizeToSpans(para));
    articleContent.appendChild(p);
  }
}

// 把一段文本拆成可点击的单词 span 和纯文本
function tokenizeToSpans(text) {
  const frag = document.createDocumentFragment();
  // 匹配英文单词（含连字符/撇号）或数字
  const re = /[A-Za-z]+(?:['’\-][A-Za-z]+)*|\d+(?:\.\d+)?/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = m[0];
    span.dataset.word = m[0].toLowerCase();
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

/* ============ 文件上传 ============ */
$('btn-choose').addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) readFile(f);
  fileInput.value = '';
});

['dragover', 'dragenter'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); })
);
['dragleave', 'drop'].forEach(ev =>
  dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); })
);
dropZone.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (f) readFile(f);
});

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result || '');
    // 简单去掉 HTML 标签
    text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<[^>]+>/g, ' ');
    loadArticle(text, file.name.replace(/\.(txt|md|html?)$/i, ''));
  };
  reader.readAsText(file, 'utf-8');
}

$('btn-sample').addEventListener('click', () => loadArticle(SAMPLE_ARTICLE, '示例文章：The Impact of Urban Green Spaces'));
$('btn-reset').addEventListener('click', () => {
  articlePanel.classList.add('hidden');
  vocabPanel.classList.add('hidden');
  $('upload-panel').classList.remove('hidden');
  hidePopup();
});

/* ============ 词典查询（多 API 自动切换） ============ */
async function fetchJson(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

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

function stripHtml(s) {
  return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

// 中文释义：有道词典（免费、国内稳定）
async function lookupChinese(word) {
  const url = `https://dict.youdao.com/suggest?num=3&ver=3.0&doctype=json&cache=false&le=en&q=${encodeURIComponent(word)}`;
  const data = await fetchJson(url, 6000);
  const entries = data && data.data && data.data.entries;
  if (!Array.isArray(entries) || !entries.length) throw new Error('无中文释义');
  // 优先返回完全匹配的词条
  let hit = entries.find(e => String(e.entry || '').toLowerCase() === word.toLowerCase());
  if (!hit) hit = entries[0];
  if (!hit || !hit.explain) throw new Error('无中文释义');
  return hit.explain;
}

function buildPopupHtml(entry, zh) {
  let html = '';
  if (zh) html += `<div class="popup-zh"><span class="pos">中文</span>${escapeHtml(zh)}</div>`;
  if (entry && entry.error) {
    html += `<div class="popup-error">${escapeHtml(entry.error.message || '英文释义查询失败')}</div>`;
  } else if (entry) {
    const phonetic = (entry.phonetics || []).map(p => p.text).filter(Boolean)[0] || '';
    if (phonetic) html += `<div class="popup-phonetic">${escapeHtml(phonetic)}</div>`;
    html += buildMeaningsHtml(entry);
    html += `<div class="popup-src">来源：${escapeHtml(entry.source || "词典")}${zh ? ' ＋ 有道词典' : ''}</div>`;
  }
  return html;
}

// 词典源选择（localStorage 持久化）
const dictSourceKey = 'ieltsDictSource';
function getDictSource() {
  try { return localStorage.getItem(dictSourceKey) || 'auto'; } catch { return 'auto'; }
}

// 统一入口：按用户选择的源查询；选"自动"则按顺序尝试
async function lookupWord(word) {
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

function buildMeaningsHtml(entry) {
  let html = '';
  for (const m of (entry.meanings || [])) {
    if (!m.definition) continue;
    html += `<div class="def"><span class="pos">${escapeHtml(m.partOfSpeech || '')}</span>${escapeHtml(m.definition)}`;
    if (m.example) html += `<div class="ex">例：${escapeHtml(m.example)}</div>`;
    html += `</div>`;
  }
  return html || '<div class="popup-error">暂无释义</div>';
}

/* ============ 弹窗 ============ */
function showPopupAt(anchorRect, contentHtml, title) {
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
    w.textContent = title;
    popup.appendChild(w);
  }
  const body = document.createElement('div');
  body.innerHTML = contentHtml;
  popup.appendChild(body);

  // 定位：优先放在锚点下方，超出屏幕则放上方
  popup.style.left = '0px';
  popup.style.top = '0px';
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  let left = anchorRect.left + anchorRect.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = anchorRect.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = anchorRect.top - ph - 8;
  if (top < 8) top = 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

function hidePopup() { popup.classList.add('hidden'); popup.innerHTML = ''; }
document.addEventListener('click', (e) => { if (!popup.contains(e.target)) hidePopup(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopup(); });

/* 点击单词查词 */
articleContent.addEventListener('click', async (e) => {
  const span = e.target.closest('.word');
  if (!span) return;
  e.stopPropagation();
  const word = span.dataset.word;
  showPopupAt(span.getBoundingClientRect(), '<div class="popup-error">查询中…</div>', word);
  const [entry, zh] = await Promise.all([
    lookupWord(word).catch(err => ({ error: err })),
    lookupChinese(word).catch(() => ''),
  ]);
  showPopupAt(span.getBoundingClientRect(), buildPopupHtml(entry, zh), word);
});

/* 选中词组查询 */
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

function showLookupBtn(rect, text) {
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

/* ============ AI 整理 ============ */
function getSettings() {
  try { return JSON.parse(localStorage.getItem(settingsKey)) || {}; } catch { return {}; }
}

$('btn-settings').addEventListener('click', () => {
  const s = getSettings();
  $('set-base').value = s.base || '';
  $('set-key').value = s.key || '';
  $('set-model').value = s.model || '';
  $('settings-msg').textContent = '';
  settingsModal.classList.remove('hidden');
});
$('btn-cancel-settings').addEventListener('click', () => settingsModal.classList.add('hidden'));
$('btn-save-settings').addEventListener('click', () => {
  localStorage.setItem(settingsKey, JSON.stringify({
    base: $('set-base').value.trim(),
    key: $('set-key').value.trim(),
    model: $('set-model').value.trim(),
  }));
  $('settings-msg').textContent = '✅ 已保存';
  setTimeout(() => settingsModal.classList.add('hidden'), 800);
});

btnAI.addEventListener('click', async () => {
  const s = getSettings();
  if (!s.base || !s.key || !s.model) {
    alert('请先在 ⚙️ 设置 里填写 AI 的 API 地址、Key 和模型名称');
    return;
  }
  if (!articleText) { alert('请先上传或加载一篇文章'); return; }

  btnAI.disabled = true;
  btnAI.textContent = '⏳ AI 整理中…';
  try {
    const prompt = `你是雅思阅读老师。请从下面的文章中提取 15-25 个对雅思阅读最重要的学术词汇或词组（包括高频同义替换），并为每个给出中文释义和英文简单释义。

文章：
"""
${articleText.slice(0, 8000)}
"""

只输出 JSON 数组，格式如下，不要输出其他内容：
[{"word": "mitigation", "meaning": "缓解"}, ...]`;

    const res = await fetch(`${s.base.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${s.key}`,
      },
      body: JSON.stringify({
        model: s.model,
        messages: [
          { role: 'system', content: 'You are a helpful IELTS reading tutor. Always respond with valid JSON only.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`AI 请求失败（${res.status}）：${errText.slice(0, 200)}`);
    }
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '';
    aiVocab = parseAiJson(content);
    if (!aiVocab.length) throw new Error('AI 返回格式无法解析，请检查模型是否支持 JSON 输出');

    applyAiHighlight();
    renderVocabList();
    vocabPanel.classList.remove('hidden');
    vocabPanel.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    alert('AI 整理失败：' + err.message);
  } finally {
    btnAI.disabled = false;
    btnAI.textContent = '✨ AI 整理';
  }
});

function parseAiJson(content) {
  let text = content.trim();
  // 去掉 ```json ... ``` 包裹
  text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  try {
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr.filter(x => x && x.word).map(x => ({ word: x.word, meaning: x.meaning || '' })) : [];
  } catch {
    // 尝试提取第一个 [ ... ]
    const m = text.match(/\[[\s\S]*\]/);
    if (m) {
      try {
        const arr = JSON.parse(m[0]);
        return Array.isArray(arr) ? arr.filter(x => x && x.word).map(x => ({ word: x.word, meaning: x.meaning || '' })) : [];
      } catch { return []; }
    }
    return [];
  }
}

function applyAiHighlight() {
  // 重新渲染文章，并给 AI 词汇加高亮
  renderArticle();
  for (const item of aiVocab) {
    const key = item.word.toLowerCase();
    const spans = articleContent.querySelectorAll('span.word');
    spans.forEach(sp => {
      if (sp.dataset.word === key) sp.classList.add('highlight-ai');
    });
  }
}

function renderVocabList() {
  vocabList.innerHTML = '';
  vocabCount.textContent = `共 ${aiVocab.length} 个`;
  for (const item of aiVocab) {
    const div = document.createElement('div');
    div.className = 'vocab-item';
    const w = document.createElement('span');
    w.className = 'v-word';
    w.textContent = item.word;
    w.addEventListener('click', () => {
      // 高亮并滚动到文章中的对应词
      const spans = articleContent.querySelectorAll('span.word');
      let target = null;
      for (const sp of spans) {
        if (sp.dataset.word === item.word.toLowerCase()) { target = sp; break; }
      }
      if (target) {
        target.classList.add('active');
        setTimeout(() => target.classList.remove('active'), 1500);
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showPopupAt(target.getBoundingClientRect(), `<div class="def"><span class="pos">AI 释义</span>${escapeHtml(item.meaning || '')}</div>`, item.word);
      }
    });
    const m = document.createElement('div');
    m.className = 'v-mean';
    m.textContent = item.meaning || '';
    div.appendChild(w);
    div.appendChild(m);
    vocabList.appendChild(div);
  }
}

/* ============ 工具 ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 首次进入自动展示示例文章，方便立刻体验
loadArticle(SAMPLE_ARTICLE, '示例文章：The Impact of Urban Green Spaces');
