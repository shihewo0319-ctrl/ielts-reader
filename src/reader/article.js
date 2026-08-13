/* ============ 文章加载 / 渲染 / 分词 / 文件上传 ============ */
import { $ } from '../lib/dom.js';
import { SAMPLE_ARTICLE } from './sample.js';
import { hidePopup } from './popup.js';

let articleText = '';          // 当前文章纯文本

export function loadArticle(text, title = '阅读文章') {
  articleText = text;
  $('article-title').textContent = title;
  renderArticle();
  $('upload-panel').classList.add('hidden');
  $('article-panel').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export function renderArticle() {
  const articleContent = $('article-content');
  articleContent.innerHTML = '';
  const paragraphs = articleText.split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const p = document.createElement('p');
    p.appendChild(tokenizeToSpans(para));
    articleContent.appendChild(p);
  }
}

// 把一段文本拆成可点击的单词 span 和纯文本
export function tokenizeToSpans(text) {
  const frag = document.createDocumentFragment();
  // 匹配英文单词（含连字符/撇号）或数字
  const re = /[A-Za-z]+(?:['’\-][A-Za-z]+)*|\d+(?:\.\d+)?/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    const span = document.createElement('span');
    span.className = 'word';
    span.textContent = m[0];
    span.dataset.word = m[0].toLowerCase();
    frag.appendChild(span);
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

/* ============ 文件上传面板 ============ */
export function initUploadPanel() {
  const dropZone = $('drop-zone');
  const fileInput = $('file-input');

  $('btn-choose').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) readFile(f);
    fileInput.value = '';
  });

  ['dragover', 'dragenter'].forEach(ev =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); })
  );
  ['dragleave', 'drop'].forEach(ev =>
    dropZone.addEventListener(ev, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); })
  );
  dropZone.addEventListener('drop', (e) => {
    const f = e.dataTransfer.files[0];
    if (f) readFile(f);
  });

  // 粘贴文章文本
  $('btn-paste').addEventListener('click', () => {
    const text = $('paste-text').value.trim();
    if (!text) {
      $('paste-text').focus();
      return;
    }
    loadArticle(text, '粘贴的文章');
  });

  $('btn-sample').addEventListener('click', () => loadArticle(SAMPLE_ARTICLE, '示例文章：The Impact of Urban Green Spaces'));
  $('btn-reset').addEventListener('click', () => {
    $('article-panel').classList.add('hidden');
    $('upload-panel').classList.remove('hidden');
    hidePopup();
  });
}

function readFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let text = String(reader.result || '');
    // 简单去掉 HTML 标签
    text = text.replace(/<script[\s\S]*?<\/script>/gi, ' ')
               .replace(/<style[\s\S]*?<\/style>/gi, ' ')
               .replace(/<[^>]+>/g, ' ');
    loadArticle(text, file.name.replace(/\.(txt|md|html?)$/i, ''));
  };
  reader.readAsText(file, 'utf-8');
}
