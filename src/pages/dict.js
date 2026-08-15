/* ============ 单词查询页入口（dict.html） ============
 * 页面内查询（v1.1.66 起结果不写 URL）：刷新即空白搜索框，不再残留上次结果；
 * 首页搜索框跳转经 sessionStorage 一次性传词。
 * 功能：搜索框输入时实时联想（有道 suggest，最多 8 条，单词 + 中文释义）；
 *       中文查询：有道 suggest 映射出对应英文词，点击后查该英文词。
 */
import '../lib/nav.js';
import '../lib/version.js';
import {
  lookupWord, lookupChinese, lookupExamples, buildPopupHtml, buildWordHeader,
  isChinese, suggestEntries,
} from '../features/dict.js';
import { initSuggestBox } from '../lib/suggest-box.js';

/* ===== 中文查询：显示中→英映射列表（点击某项查英文） ===== */
async function renderChinese(word, result) {
  const entries = await suggestEntries(word);
  const card = document.createElement('div');
  card.className = 'popup-card dict-view';
  result.innerHTML = '';
  result.appendChild(card);

  const head = document.createElement('div');
  head.className = 'popup-word';
  const span = document.createElement('span');
  span.className = 'popup-word-text';
  span.textContent = word;
  head.appendChild(span);
  card.appendChild(head);

  if (!entries.length) {
    const err = document.createElement('div');
    err.className = 'popup-error';
    err.textContent = '未找到「' + word + '」对应的英文单词';
    card.appendChild(err);
    return;
  }
  const label = document.createElement('div');
  label.className = 'dict-suggest-label';
  label.textContent = '「' + word + '」对应的英文（点击查询）：';
  card.appendChild(label);
  const list = document.createElement('div');
  list.className = 'dict-suggest-list';
  entries.forEach(e => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'dict-suggest-item';
    const w = document.createElement('span');
    w.className = 'dict-suggest-word';
    w.textContent = e.explain; // 中文输入时 explain = 英文
    const zh = document.createElement('span');
    zh.className = 'dict-suggest-zh';
    zh.textContent = e.entry;  // entry = 中文
    item.appendChild(w);
    item.appendChild(zh);
    item.addEventListener('click', () => search(e.explain));
    list.appendChild(item);
  });
  card.appendChild(list);
}

/* ===== 查询并渲染结果（与阅读器弹窗一致的卡片） ===== */
async function search(word) {
  const result = document.getElementById('dict-result');
  if (!result) return;
  result.hidden = false;
  result.innerHTML = '<div class="dict-loading">🔍 查询中…</div>';

  // 中文输入：走中→英映射
  if (isChinese(word)) return renderChinese(word, result);

  // 英文输入：与阅读器一致，英文释义 + 中文释义 + 双语例句，三个来源并行请求
  const [enR, zhR, exR] = await Promise.allSettled([
    lookupWord(word),
    lookupChinese(word),
    lookupExamples(word),
  ]);
  const entry = enR.status === 'fulfilled'
    ? enR.value
    : { error: { message: (enR.reason && enR.reason.message) || '未找到该词' } };
  const zh = zhR.status === 'fulfilled' ? zhR.value : '';
  const examples = exR.status === 'fulfilled' ? exR.value : [];

  // 卡片容器：外观与阅读器词典弹窗一致
  const card = document.createElement('div');
  card.className = 'popup-card dict-view';
  result.innerHTML = '';
  result.appendChild(card);

  // 词头：单词 + 音标发音 + 加入生词本（与阅读器弹窗共用 buildWordHeader，保证一致）
  card.appendChild(buildWordHeader(word, ''));

  const body = document.createElement('div');
  body.innerHTML = buildPopupHtml(entry, zh, examples);
  card.appendChild(body);
}

/* ===== 搜索框：输入联想 + 页面内查询（v1.1.66 起不再写 URL，刷新即空白页） ===== */
function initDictSearch() {
  const form = document.getElementById('dict-form');
  const input = document.getElementById('dict-input');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;
    search(word);
  });

  // 搜索引擎式输入联想（有道 suggest，最多 8 条；选中/回车即查询）
  initSuggestBox(input, {
    fetch: suggestEntries,
    onPick: (word) => search(word),
  });
}

initDictSearch();

// 从首页搜索框跳转过来的单词：经 sessionStorage 一次性传递（读取即删除）。
// 不用 URL 传递 → 刷新 / 重新打开 / 收藏的链接都不会残留上次查询结果。
const initWord = (sessionStorage.getItem('dictInitWord') || '').trim();
sessionStorage.removeItem('dictInitWord');
if (initWord) {
  const input = document.getElementById('dict-input');
  if (input) input.value = initWord;
  search(initWord);
}
