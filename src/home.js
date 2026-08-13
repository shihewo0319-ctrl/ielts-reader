/* ============ 主页入口 ============
 * 主页目前是纯静态卡片（<a> 链接跳转，无需 JS 逻辑）。
 * 设置菜单 + AI 设置（API Key / 思考模式）在 ./settings.js，由主页入口引入。
 * 以后新增功能卡片 / 主页交互逻辑写在这个文件里。
 */
import './settings.js';
import { randomQuote } from './lib/quotes.js';

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

/* ===== 单词查询搜索框：跳转到独立查询页（dict.html?word=xxx） ===== */
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
