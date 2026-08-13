/* ============ 状态 ============ */
let articleText = '';          // 当前文章纯文本

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
const popup = $('popup');

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

/* ============ 文章加载 ============ */
function loadArticle(text, title = '阅读文章') {
  articleText = text;
  articleTitle.textContent = title;
  renderArticle();
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

// 中文释义：通过本地代理请求有道词典（同源，避免浏览器跨域限制）
async function lookupChinese(word) {
  const data = await fetchJson(`/api/chinese?word=${encodeURIComponent(word)}`, 6000);
  if (!data || !data.ok || !data.explain) throw new Error('无中文释义');
  return data.explain;
}

function buildPopupHtml(entry, zh, examples) {
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

// 例句：通过本地代理请求有道词典（同源，避免跨域），返回英中双语例句
const exampleCache = {};
async function lookupExamples(word) {
  if (exampleCache[word]) return exampleCache[word];
  const data = await fetchJson(`/api/sentences?word=${encodeURIComponent(word)}`, 6000);
  const list = (data && data.ok && Array.isArray(data.sentences)) ? data.sentences : [];
  exampleCache[word] = list;
  return list;
}

function buildExamplesHtml(sentences) {
  let html = '<div class="popup-examples-label">例句</div>';
  for (const s of sentences.slice(0, 3)) {
    html += '<div class="popup-example">';
    if (s.en) html += `<div class="ex-en">${escapeHtml(s.en)}</div>`;
    if (s.zh) html += `<div class="ex-zh">${escapeHtml(s.zh)}</div>`;
    html += '</div>';
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
    html += `<div class="def"><span class="pos">${escapeHtml(m.partOfSpeech || '')}</span><span class="def-text">${escapeHtml(m.definition)}</span>`;
    if (m.example) html += `<div class="ex">例：${escapeHtml(m.example)}</div>`;
    html += `</div>`;
  }
  // 必须有 .popup-meanings 包裹层，词性标签样式才能生效
  return html ? `<div class="popup-meanings">${html}</div>` : '<div class="popup-error">暂无释义</div>';
}

/* ============ 弹窗 ============ */
// 单词发音：默认用有道词典发音接口（免费、无需 key、国内稳定，type=2 美音 / type=1 英音）；
// 若播放失败或超时未开始播放，兜底用浏览器内置语音合成。
let ttsVoices = [];
function initTts() {
  if (!('speechSynthesis' in window)) return;
  const load = () => { try { ttsVoices = speechSynthesis.getVoices() || []; } catch (e) {} };
  load();
  try { speechSynthesis.onvoiceschanged = load; } catch (e) {}
}
initTts();

function pickEnVoice() {
  return ttsVoices.find(v => /^en(-|_)?(US|GB)/i.test(v.lang) && /Google|Microsoft|Samantha|Daniel|Alex|Aria|Jenny|Guy|Libby|Zira|Hazel|Susan/i.test(v.name))
      || ttsVoices.find(v => /^en(-|_)?US/i.test(v.lang))
      || ttsVoices.find(v => /^en/i.test(v.lang))
      || null;
}

function ttsSpeak(word) {
  if (!('speechSynthesis' in window)) return;
  let started = false;
  try { speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.9;
  const voice = pickEnVoice();
  if (voice) u.voice = voice;
  // Chrome 已知问题：cancel 后立刻 speak 可能被吞掉，稍作延迟
  setTimeout(() => {
    if (!started) { try { speechSynthesis.resume(); } catch (e) {} speechSynthesis.speak(u); }
  }, 60);
}

function speakWord(word, accent) {
  // 播放反馈：高亮被点击的音标标签（或兜底喇叭按钮）
  const sel = accent ? '.popup .popup-phonetic[data-accent="' + accent + '"]' : '.popup .popup-sound';
  const btn = document.querySelector(sel);
  if (btn) {
    btn.classList.remove('speaking');
    void btn.offsetWidth; // 重置动画
    btn.classList.add('speaking');
    setTimeout(() => btn.classList.remove('speaking'), 1600);
  }
  // 默认：有道发音（type=2 美音 / type=1 英音）
  const type = accent === 'uk' ? 1 : 2;
  let used = false;
  const fallback = () => { if (!used) { used = true; ttsSpeak(word); } };
  try {
    const audio = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=' + type);
    audio.play().then(() => { used = true; }).catch(fallback);
    setTimeout(() => { if (!used) fallback(); }, 2000);
  } catch (e) {
    fallback();
  }
}

// 音标：有道 /api/pron 返回英音(ukphone)/美音(usphone)两套音标，点击哪个就发哪个音
const pronCache = {};
async function loadPhonetics(word, wrap) {
  let data = null;
  if (pronCache[word]) {
    data = pronCache[word];
  } else {
    try {
      data = await fetchJson('/api/pron?word=' + encodeURIComponent(word), 6000);
      if (data && data.ok) pronCache[word] = data;
    } catch (e) { data = null; }
  }
  const uk = data && (data.ukphone || '').trim();
  const us = data && (data.usphone || '').trim();
  if (!uk && !us) return; // 没有音标时保留 🔊 兜底按钮
  wrap.innerHTML = '';
  if (us) wrap.appendChild(makePhoneticBtn(word, 'us', us));
  if (uk) wrap.appendChild(makePhoneticBtn(word, 'uk', uk));
}

function makePhoneticBtn(word, accent, ipa) {
  const b = document.createElement('button');
  b.className = 'popup-phonetic';
  b.dataset.accent = accent;
  b.title = (accent === 'uk' ? '英音' : '美音') + '发音';
  b.setAttribute('aria-label', (accent === 'uk' ? '英音' : '美音') + ' ' + word);
  const ipaSpan = document.createElement('span');
  ipaSpan.className = 'ipa';
  ipaSpan.textContent = '/' + ipa + '/';
  const accSpan = document.createElement('span');
  accSpan.className = 'accent';
  accSpan.textContent = accent === 'uk' ? '英' : '美';
  b.appendChild(ipaSpan);
  b.appendChild(accSpan);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    speakWord(word, accent);
  });
  return b;
}

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
  const [entry, zh, examples] = await Promise.all([
    lookupWord(word).catch(err => ({ error: err })),
    lookupChinese(word).catch(() => ''),
    lookupExamples(word).catch(() => []),
  ]);
  showPopupAt(span.getBoundingClientRect(), buildPopupHtml(entry, zh, examples), word);
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

/* ============ 工具 ============ */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// 首次进入自动展示示例文章，方便立刻体验
loadArticle(SAMPLE_ARTICLE, '示例文章：The Impact of Urban Green Spaces');
