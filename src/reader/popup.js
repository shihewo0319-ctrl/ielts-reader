/* ============ 释义弹窗：显示 / 定位 / 点击查词 / 选中词组查询 ============ */
import { $ } from '../lib/dom.js';
import { lookupWord, lookupChinese, lookupExamples, buildPopupHtml } from './dict.js';
import { speakWord, loadPhonetics } from './tts.js';

export function showPopupAt(anchorRect, contentHtml, title) {
  const popup = $('popup');
  popup.innerHTML = '';
  popup.classList.remove('hidden');
  const closeBtn = document.createElement('button');
  closeBtn.className = 'popup-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', hidePopup);
  popup.appendChild(closeBtn);
  if (title) {
    const w = document.createElement('div');
    w.className = 'popup-word';
    const wordSpan = document.createElement('span');
    wordSpan.className = 'popup-word-text';
    wordSpan.textContent = title;
    w.appendChild(wordSpan);
    const chips = document.createElement('span');
    chips.className = 'popup-phonetics';
    // 兜底喇叭按钮：音标加载出来后会被替换成 英/美 两个音标标签
    const fallbackBtn = document.createElement('button');
    fallbackBtn.className = 'popup-sound';
    fallbackBtn.textContent = '🔊';
    fallbackBtn.title = '美音发音';
    fallbackBtn.addEventListener('click', (e) => { e.stopPropagation(); speakWord(title, 'us'); });
    chips.appendChild(fallbackBtn);
    w.appendChild(chips);
    popup.appendChild(w);
    loadPhonetics(title, chips);
  }
  const body = document.createElement('div');
  body.innerHTML = contentHtml;
  popup.appendChild(body);

  // 定位：优先放在锚点下方，超出屏幕则放上方
  popup.style.left = '0px';
  popup.style.top = '0px';
  const pw = popup.offsetWidth;
  const ph = popup.offsetHeight;
  let left = anchorRect.left + anchorRect.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = anchorRect.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = anchorRect.top - ph - 8;
  if (top < 8) top = 8;
  popup.style.left = left + 'px';
  popup.style.top = top + 'px';
}

export function hidePopup() {
  const popup = $('popup');
  popup.classList.add('hidden');
  popup.innerHTML = '';
}
document.addEventListener('click', (e) => { if (!$('popup').contains(e.target)) hidePopup(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hidePopup(); });

/* 点击单词查词 + 选中词组查询 */
export function initWordLookup() {
  const articleContent = $('article-content');

  articleContent.addEventListener('click', async (e) => {
    const span = e.target.closest('.word');
    if (!span) return;
    e.stopPropagation();
    const word = span.dataset.word;
    showPopupAt(span.getBoundingClientRect(), '<div class="popup-error">查询中…</div>', word);
    const [entry, zh, examples] = await Promise.all([
      lookupWord(word).catch(err => ({ error: err })),
      lookupChinese(word).catch(() => ''),
      lookupExamples(word).catch(() => []),
    ]);
    showPopupAt(span.getBoundingClientRect(), buildPopupHtml(entry, zh, examples), word);
  });

  articleContent.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text || text.length < 2) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      showLookupBtn(rect, text);
    }, 10);
  });
}

export function showLookupBtn(rect, text) {
  const old = document.getElementById('lookup-btn');
  if (old) old.remove();
  const btn = document.createElement('button');
  btn.id = 'lookup-btn';
  btn.className = 'btn btn-primary';
  btn.textContent = '🔍 查询词组';
  btn.style.cssText = 'position:fixed;z-index:150;';
  btn.style.left = Math.min(rect.left, window.innerWidth - 120) + 'px';
  btn.style.top = (rect.bottom + 6) + 'px';
  btn.addEventListener('click', async () => {
    btn.remove();
    hidePopup();
    showPopupAt(rect, '<div class="popup-error">查询中…</div>', text);
    const [entry, zh] = await Promise.all([
      lookupWord(text).catch(err => ({ error: err })),
      lookupChinese(text).catch(() => ''),
    ]);
    if ((entry && entry.error) && !zh) {
      showPopupAt(rect, '<div class="popup-error">词组未收录，试试点击单个单词查词</div>', text);
    } else {
      showPopupAt(rect, buildPopupHtml(entry, zh), text);
    }
  });
  document.body.appendChild(btn);
}
document.addEventListener('click', (e) => {
  if (e.target.id !== 'lookup-btn') {
    const b = document.getElementById('lookup-btn');
    if (b) b.remove();
  }
});
