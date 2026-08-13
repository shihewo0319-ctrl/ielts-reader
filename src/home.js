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
    '<div class="quote-card">'
    + '<div class="quote-kicker">✦ DAILY QUOTE · 每日一句 ✦</div>'
    + '<div class="quote-en">“' + esc(q.en) + '”</div>'
    + '<div class="quote-zh">' + esc(q.zh) + '</div>'
    + '<div class="quote-author">— ' + esc(q.author) + '</div>'
    + '</div>'
    + '<button class="quote-refresh" title="换一句" aria-label="换一句">🔄</button>';
  const btn = box.querySelector('.quote-refresh');
  if (btn) btn.addEventListener('click', renderQuote);
}

renderQuote();
