/* ============ 主页入口 ============
 * 主页目前是纯静态卡片（<a> 链接跳转，无需 JS 逻辑）。
 * 设置菜单 + AI 设置（API Key / 思考模式）在 ./settings.js，由主页入口引入。
 * 以后新增功能卡片 / 主页交互逻辑写在这个文件里。
 */
import '../lib/nav.js';
import '../lib/version.js';
import { randomQuote } from '../lib/quotes.js';
import { fetchJson } from '../lib/api.js';
import { initSuggestBox } from '../lib/suggest-box.js';
import { SETTINGS_MENU_HTML, initSettingsMenu } from '../settings/menu.js';
import { initAiSettings, openAiPanel } from '../settings/ai.js';
import { initAiConfig } from '../lib/ai-config.js';

/* ===== 设置菜单（主页右上角）：渲染进挂载点并装配 AI 设置 =====
 * 先 await initAiConfig() 预加载/迁移服务器 AI 设置（失败不阻塞），
 * 确保打开面板时列表已包含恢复的 Key（原 src/settings.js）。 */
const settingsRoot = document.getElementById('settings-menu-root');
if (settingsRoot) {
  initAiConfig().catch(() => {}).finally(() => {
    settingsRoot.innerHTML = SETTINGS_MENU_HTML;
    initSettingsMenu({ onAiPanelOpen: openAiPanel });
    initAiSettings();
  });
}

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

/* ===== 单词查询搜索框：跳转查询页 + 输入联想 =====
 * v1.1.66 起经 sessionStorage 一次性传词（不再写 ?word= URL，避免查询页刷新残留结果）。 */
function initDictSearch() {
  const form = document.getElementById('dict-form');
  const input = document.getElementById('dict-input');
  if (!form || !input) return;

  const go = (word) => {
    if (!word) return;
    sessionStorage.setItem('dictInitWord', word); // 一次性：查询页读取后即删除
    location.href = 'dict.html';
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    go(input.value.trim());
  });

  // 搜索引擎式输入联想（有道 suggest，最多 8 条；选中/回车即跳转查询页）
  initSuggestBox(input, {
    fetch: async (q) => {
      const data = await fetchJson('/api/suggest?word=' + encodeURIComponent(q), 6000);
      return (data && data.ok && Array.isArray(data.entries)) ? data.entries : [];
    },
    onPick: go,
  });
}

initDictSearch();
