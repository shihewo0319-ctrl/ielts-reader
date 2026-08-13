/* ============ 主页入口 ============
 * 主页目前是纯静态卡片（<a> 链接跳转，无需 JS 逻辑）。
 * 设置菜单 + AI 设置（API Key / 思考模式）在 ./settings.js，由主页入口引入。
 * 以后新增功能卡片 / 主页交互逻辑写在这个文件里。
 */
import './settings.js';
import { randomQuote } from './lib/quotes.js';
import { lookupWord, lookupChinese, lookupExamples, buildPopupHtml } from './reader/dict.js';
import { loadPhonetics, speakWord } from './reader/tts.js';
import { addWord } from './lib/db-api.js';

/* ===== 主页底部：随机英语名言 + 中文翻译（艺术字体） ===== */
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderQuote() {
  const box = document.getElementById('quote-box');
  if (!box) return;
  const q = randomQuote();
  box.innerHTML =
    '<div class="quote-en">“' + esc(q.en) + '”</div>'
    + '<div class="quote-zh">' + esc(q.zh) + '</div>';
}

renderQuote();

/* ===== 单词查询（搜索框）：释义展示格式与阅读器词典弹窗一致 ===== */
function initDictSearch() {
  const form = document.getElementById('dict-form');
  const input = document.getElementById('dict-input');
  const result = document.getElementById('dict-result');
  if (!form || !input || !result) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const word = input.value.trim();
    if (!word) return;
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
    head.appendChild(wbBtn);

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
  });
}

initDictSearch();
