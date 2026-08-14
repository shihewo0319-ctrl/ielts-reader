/* ============ 单词查询页入口（dict.html） ============
 * 独立查询页：从 URL 的 ?word= 读取单词自动查询，
 * 释义展示格式与阅读器词典弹窗完全一致（词头/释义都复用 reader/dict.js）。
 */
import { lookupWord, lookupChinese, lookupExamples, buildPopupHtml, buildWordHeader } from './reader/dict.js';

/* ===== 查询并渲染结果（与阅读器弹窗一致的卡片） ===== */
async function search(word) {
  const result = document.getElementById('dict-result');
  if (!result) return;
  result.hidden = false;
  result.innerHTML = '<div class="dict-loading">🔍 查询中…</div>';

  // 与阅读器一致：英文释义 + 中文释义 + 双语例句，三个来源并行请求
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
  card.className = 'popup-card';
  result.innerHTML = '';
  result.appendChild(card);

  // 词头：单词 + 音标发音 + 加入生词本（与阅读器弹窗共用 buildWordHeader，保证一致）
  card.appendChild(buildWordHeader(word, ''));

  const body = document.createElement('div');
  body.innerHTML = buildPopupHtml(entry, zh, examples);
  card.appendChild(body);
}

/* ===== 搜索框：换词后跳转到带 word 参数的 URL（可刷新/收藏/分享） ===== */
function initDictSearch() {
  const form = document.getElementById('dict-form');
  const input = document.getElementById('dict-input');
  if (!form || !input) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;
    location.href = 'dict.html?word=' + encodeURIComponent(word);
  });
}

initDictSearch();

// 从 URL 读取初始单词并自动查询
const params = new URLSearchParams(location.search);
const initWord = (params.get('word') || '').trim();
if (initWord) {
  const input = document.getElementById('dict-input');
  if (input) input.value = initWord;
  search(initWord);
}
