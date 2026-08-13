/* ============ 阅读器入口：组装各模块并初始化 ============ */
import { $ } from './lib/dom.js';
import { loadArticle, getCurrentArticle, initUploadPanel } from './reader/article.js';
import { dictSourceKey, getDictSource } from './reader/dict.js';
import { hidePopup, initWordLookup } from './reader/popup.js';
import { initTts } from './reader/tts.js';
import { getArticle, saveArticle } from './lib/db-api.js';
import { initAiConfig } from './lib/ai-config.js';

initTts();
initUploadPanel();
initWordLookup();
initAiConfig(); // 预加载服务器 AI 设置（API Key / 思考模式），首次点击语境翻译更快

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

/* ===== 从「我的文章」打开：reader.html?article=<id> ===== */
(async function loadFromLibrary() {
  const id = new URLSearchParams(location.search).get('article');
  if (!id) return;
  try {
    const article = await getArticle(id);
    if (article) loadArticle(article.content, article.title);
  } catch (e) {
    alert('打开文章失败：' + e.message);
  }
})();

/* ===== 保存文章到「我的文章」 ===== */
const saveBtn = $('btn-save');
if (saveBtn) {
  saveBtn.addEventListener('click', async () => {
    const { text, title } = getCurrentArticle();
    if (!text.trim()) return;
    // 默认标题（示例/粘贴）保存前让用户命名
    let name = title;
    if (!name || name === '阅读文章' || name === '粘贴的文章' || name === '示例文章：The Impact of Urban Green Spaces') {
      name = prompt('给这篇文章起个标题：', title === '粘贴的文章' ? '我的雅思阅读' : title);
      if (!name) return;
      name = name.trim() || '未命名文章';
    }
    saveBtn.disabled = true;
    const orig = saveBtn.textContent;
    saveBtn.textContent = '⏳ 保存中…';
    try {
      await saveArticle(name, text);
      saveBtn.textContent = '✅ 已保存';
      setTimeout(() => { saveBtn.textContent = orig; saveBtn.disabled = false; }, 2000);
    } catch (e) {
      saveBtn.textContent = orig;
      saveBtn.disabled = false;
      alert('保存失败：' + e.message);
    }
  });
}
