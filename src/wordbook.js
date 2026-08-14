/* ============ 生词本 / 学习记录页 ============
 * 两个标签页：
 *   - ⭐ 生词本：阅读时点单词旁「⭐ 加入生词本」收藏，这里可查看/删除
 *   - 🕘 学习记录：阅读时点击单词查词会自动记录，这里可查看/清空
 * 数据读写走 src/lib/db-api.js（后端 SQLite）；中文释义复用 reader/dict.js 的 lookupChinese。
 */
import { $, escapeHtml } from './lib/dom.js';
import { lookupChinese, lookupExamples } from './reader/dict.js';
import { highlightWord } from './reader/grammar.js';
import { listWords, deleteWord, listLookups, clearLookups } from './lib/db-api.js';

// 中文释义内存缓存（word -> 释义文本），避免重复请求有道接口
const zhCache = new Map();

function fmtTime(s) {
  return String(s || '').replace('T', ' ').slice(0, 16);
}

/* 例句行：句子里的单词高亮显示。
 * 从阅读器加入的词带原句直接用；单词查询页加入的词没有句子（sentence 为空），
 * 用有道例句接口（/api/sentences，内存缓存）自动补一句展示（不落库）。 */
function makeSentenceEl(word, sentence) {
  const s = document.createElement('div');
  s.className = 'wb-sentence';
  if (sentence) {
    s.innerHTML = highlightWord(escapeHtml(sentence), word);
    return s;
  }
  s.textContent = '⏳ 加载例句…';
  lookupExamples(word)
    .then(list => {
      const en = (list && list[0] && list[0].en) || '';
      s.innerHTML = en ? highlightWord(escapeHtml(en), word) : '';
    })
    .catch(() => { s.innerHTML = ''; });
  return s;
}

async function loadWords() {
  const box = $('tab-words');
  box.innerHTML = '<div class="loading">加载中…</div>';
  let words = [];
  try {
    words = await listWords();
  } catch (e) {
    box.innerHTML = '<div class="empty-state">❌ 加载失败：' + escapeHtml(e.message) + '</div>';
    return;
  }
  if (!words.length) {
    box.innerHTML = '<div class="empty-state">生词本还是空的，阅读时点击单词旁的「⭐ 加入生词本」收藏单词</div>';
    return;
  }
  box.innerHTML = '';
  for (const w of words) {
    const item = document.createElement('div');
    item.className = 'wb-item';

    const head = document.createElement('div');
    head.className = 'wb-item-head';
    const wordEl = document.createElement('span');
    wordEl.className = 'wb-word wb-word-link';
    wordEl.textContent = w.word;
    // 点击单词 → 跳转单词查询页自动查词（sessionStorage 一次性传词，刷新即空白页）
    wordEl.title = '点击查询「' + w.word + '」';
    wordEl.addEventListener('click', () => {
      sessionStorage.setItem('dictInitWord', w.word);
      location.href = 'dict.html';
    });
    head.appendChild(wordEl);
    item.appendChild(head);

    const body = document.createElement('div');
    body.className = 'wb-item-body';
    // 例句：高亮单词；没有句子的（单词查询页加入）自动用有道例句补一句
    body.appendChild(makeSentenceEl(w.word, w.sentence));
    if (w.note) {
      const n = document.createElement('div');
      n.className = 'wb-note';
      n.textContent = w.note;
      body.appendChild(n);
    }
    if (body.childNodes.length) item.appendChild(body);

    // 中文释义面板：默认隐藏（max-height:0），点击「释义」按钮特效展开/收起
    const meaning = document.createElement('div');
    meaning.className = 'wb-meaning';

    // 操作区：释义按钮（左）+ 删除按钮（右）
    const actions = document.createElement('div');
    actions.className = 'wb-actions';

    const zhBtn = document.createElement('button');
    zhBtn.className = 'btn wb-zh-btn';
    zhBtn.textContent = '📖 释义';
    zhBtn.title = '显示 / 隐藏中文释义';
    zhBtn.addEventListener('click', async () => {
      if (meaning.classList.contains('open')) {
        meaning.classList.remove('open'); // 特效收起
        return;
      }
      if (!meaning.dataset.loaded) {
        zhBtn.disabled = true;
        try {
          let explain = zhCache.get(w.word);
          if (explain === undefined) {
            try {
              explain = await lookupChinese(w.word);
            } catch (e) {
              explain = '（暂无中文释义）';
            }
            zhCache.set(w.word, explain);
          }
          meaning.innerHTML = '<span class="wb-zh-label">中文释义</span>' + escapeHtml(explain);
          meaning.dataset.loaded = '1';
        } catch (e) {
          meaning.innerHTML = '<span class="wb-zh-label">中文释义</span>获取失败：' + escapeHtml(e.message || e);
          meaning.dataset.loaded = '1';
        } finally {
          zhBtn.disabled = false;
        }
        void meaning.offsetHeight; // 强制回流，保证展开动画从 0 开始
      }
      meaning.classList.add('open');
    });
    actions.appendChild(zhBtn);

    const del = document.createElement('button');
    del.className = 'btn btn-danger';
    del.textContent = '🗑';
    del.title = '从生词本删除';
    del.addEventListener('click', async () => {
      if (!confirm('删除生词 ' + w.word + ' ？')) return;
      try {
        await deleteWord(w.id);
        loadWords();
      } catch (e) {
        alert('删除失败：' + e.message);
      }
    });
    actions.appendChild(del);

    item.appendChild(actions);
    item.appendChild(meaning);
    box.appendChild(item);
  }
}

async function loadLookups() {
  const box = $('tab-lookups');
  box.innerHTML = '<div class="loading">加载中…</div>';
  let lookups = [];
  try {
    lookups = await listLookups(200);
  } catch (e) {
    box.innerHTML = '<div class="empty-state">❌ 加载失败：' + escapeHtml(e.message) + '</div>';
    return;
  }
  if (!lookups.length) {
    box.innerHTML = '<div class="empty-state">还没有查词记录，在阅读器点击任意单词后会自动记录</div>';
    return;
  }
  box.innerHTML = '';
  const listWrap = document.createElement('div');
  listWrap.className = 'lookup-list';
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn btn-danger';
  clearBtn.textContent = '🗑 清空记录';
  clearBtn.addEventListener('click', async () => {
    if (!confirm('确定清空全部学习记录吗？')) return;
    try {
      await clearLookups();
      loadLookups();
    } catch (e) {
      alert('清空失败：' + e.message);
    }
  });
  listWrap.appendChild(clearBtn);

  for (const l of lookups) {
    const item = document.createElement('div');
    item.className = 'lookup-item';
    const head = document.createElement('div');
    head.className = 'lookup-item-head';
    const wordEl = document.createElement('span');
    wordEl.className = 'wb-word wb-word-link';
    wordEl.textContent = l.word;
    // 点击单词 → 跳转单词查询页自动查词（与生词本一致）
    wordEl.title = '点击查询「' + l.word + '」';
    wordEl.addEventListener('click', () => {
      sessionStorage.setItem('dictInitWord', l.word);
      location.href = 'dict.html';
    });
    const meta = document.createElement('span');
    meta.className = 'wb-time';
    meta.textContent = fmtTime(l.created_at) + (l.article_title ? ' · 《' + l.article_title + '》' : '');
    head.appendChild(wordEl);
    head.appendChild(meta);
    item.appendChild(head);
    if (l.sentence) {
      const s = document.createElement('div');
      s.className = 'wb-sentence';
      s.innerHTML = highlightWord(escapeHtml(l.sentence), l.word);
      item.appendChild(s);
    }
    listWrap.appendChild(item);
  }
  box.appendChild(listWrap);
}

function switchTab(tab) {
  document.querySelectorAll('.wb-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $('tab-words').classList.toggle('hidden', tab !== 'words');
  $('tab-lookups').classList.toggle('hidden', tab !== 'lookups');
  if (tab === 'words') loadWords();
  else loadLookups();
}

document.querySelectorAll('.wb-tab').forEach(b => {
  b.addEventListener('click', () => switchTab(b.dataset.tab));
});

switchTab('words');
