/* ============ 阅读器入口：组装各模块并初始化 ============ */
import { $ } from './lib/dom.js';
import { loadArticle, initUploadPanel } from './reader/article.js';
import { dictSourceKey, getDictSource } from './reader/dict.js';
import { hidePopup, initWordLookup } from './reader/popup.js';
import { initTts } from './reader/tts.js';

initTts();
initUploadPanel();
initWordLookup();

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

