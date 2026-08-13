/* ============ 单词查询页入口（dict.html） ============
 * 独立查询页：从 URL 的 ?word= 读取单词自动查询，
 * 释义展示格式与阅读器词典弹窗完全一致。
 */
import { lookupWord, lookupChinese, lookupExamples, buildPopupHtml } from './reader/dict.js';
import { loadPhonetics, speakWord } from './reader/tts.js';
import { addWord } from './lib/db-api.js';

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

  // 词头：单词 + 音标发音 + 加入生词本（与阅读器弹窗一致）
  const head = document.createElement('div');
  head.className = 'popup-word';

  const wordSpan = document.createElement('span');
  wordSpan.className = 'popup-word-text';
  wordSpan.textContent = word;
  head.appendChild(wordSpan);

  const chips = document.createElement('span');
  chips.className = 'popup-phonetics';
  const fallbackBtn = document.createElement('button');
  fallbackBtn.className = 'popup-sound';
  fallbackBtn.textContent = '🔊';
  fallbackBtn.title = '美音发音';
  fallbackBtn.addEventListener('click', () => speakWord(word, 'us'));
  chips.appendChild(fallbackBtn);
  head.appendChild(chips);

  const wbBtn = document.createElement('button');
  wbBtn.className = 'popup-wordbook';
  wbBtn.textContent = '⭐ 加入生词本';
  wbBtn.addEventListener('click', async () => {
    wbBtn.disabled = true;
    try {
      await addWord(word, '', '');
      wbBtn.textContent = '✅ 已加入生词本';
    } catch (err) {
      wbBtn.textContent = '❌ 加入失败';
      setTimeout(() => {
        wbBtn.textContent = '⭐ 加入生词本';
        wbBtn.disabled = false;
      }, 1500);
    }
  });
  // 元信息行：音标 + 加入生词本按钮 同一行（按钮在音标右侧）
  const meta = document.createElement('div');
  meta.className = 'popup-word-meta';
  meta.appendChild(chips);
  meta.appendChild(wbBtn);
  head.appendChild(meta);

  // 卡片容器：外观与阅读器词典弹窗一致
  const card = document.createElement('div');
  card.className = 'popup-card';
  result.innerHTML = '';
  result.appendChild(card);

  card.appendChild(head);
  loadPhonetics(word, chips); // 异步加载英/美音标（失败时保留 🔊 兜底）

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
