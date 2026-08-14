/* ============ 语法分析页入口（grammar.html） ============
 * 独立功能：粘贴任意英文句子 → AI 语法分析 → 三合一渲染
 * （结构树 + 流水词块 + 双语对照，见 reader/grammar-view.js）。
 * 复用阅读器 AI 调用链（reader/ai.js 的 fetchAi kind='grammar'），
 * AI 输出 JSON（summary + translation + chunks），解析后交给三合一渲染。
 */
import { $, escapeHtml } from './lib/dom.js';
import { fetchAi, parseGrammarJson } from './reader/ai.js';
import { renderGrammarCombined } from './reader/grammar-view.js';
import { initAiConfig } from './lib/ai-config.js';
import { providerName } from './lib/providers.js';

initAiConfig(); // 预加载服务器 AI 设置（未绑定时提示引导去设置）

const input = $('grammar-input');
const result = $('grammar-result');
const btn = $('btn-analyze');
const clearBtn = $('btn-clear');

async function analyze(sentence) {
  if (!sentence.trim()) { input.focus(); return; }
  btn.disabled = true;
  const orig = btn.textContent;
  btn.textContent = '⏳ 分析中…';
  result.hidden = false;
  result.innerHTML = '<div class="ga-loading">⏳ AI 语法分析中（同一句只请求一次，最长约 2 分钟）…</div>';
  const res = await fetchAi('grammar', '', sentence);
  if (res.ok) {
    const parsed = parseGrammarJson(res.content);
    if (parsed.ok) {
      result.innerHTML = '';
      const meta = document.createElement('div');
      meta.className = 'ga-meta';
      meta.textContent = '由 ' + providerName(res.provider) + ' 生成 · 点击任意句子中的词可复习';
      result.appendChild(meta);
      result.appendChild(renderGrammarCombined(parsed));
    } else {
      result.innerHTML = '<div class="ga-error">❌ AI 返回格式无法解析，原始内容：<pre>'
        + escapeHtml(res.content) + '</pre></div>';
    }
  } else {
    result.innerHTML = '<div class="ga-error">❌ ' + escapeHtml(res.error) + '</div>';
  }
  btn.disabled = false;
  btn.textContent = orig;
}

btn.addEventListener('click', () => analyze(input.value.trim()));

// 一键清空：清空输入框与结果区，聚焦输入框
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    input.value = '';
    result.innerHTML = '';
    result.hidden = true;
    input.focus();
  });
}
