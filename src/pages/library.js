/* ============ 我的文章页 ============
 * 展示已保存的文章列表：阅读 / 删除 / 新建。
 * 数据读写走 src/lib/db-api.js（后端 SQLite）。
 */
import '../lib/nav.js';
import '../lib/version.js';
import { $, escapeHtml } from '../lib/dom.js';
import { listArticles, deleteArticle } from '../lib/db-api.js';

async function load() {
  const listEl = $('article-list');
  const empty = $('empty-state');
  listEl.innerHTML = '<div class="loading">加载中…</div>';
  let articles = [];
  try {
    articles = await listArticles();
  } catch (e) {
    listEl.innerHTML = '<div class="empty-state">❌ 加载失败：' + escapeHtml(e.message) + '</div>';
    return;
  }
  if (!articles.length) {
    listEl.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  listEl.innerHTML = '';
  for (const a of articles) {
    const item = document.createElement('div');
    item.className = 'article-item';

    const head = document.createElement('div');
    head.className = 'article-item-head';
    const title = document.createElement('span');
    title.className = 'article-item-title';
    title.textContent = a.title;
    head.appendChild(title);
    const meta = document.createElement('span');
    meta.className = 'article-item-meta';
    meta.textContent = (a.content_len || 0) + ' 字 · 更新于 ' + String(a.updated_at || '').slice(0, 16);
    head.appendChild(meta);
    item.appendChild(head);

    const ops = document.createElement('div');
    ops.className = 'article-item-ops';
    const readBtn = document.createElement('a');
    readBtn.className = 'btn btn-primary';
    readBtn.href = 'reader.html?article=' + a.id;
    readBtn.textContent = '📖 阅读';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-danger';
    delBtn.textContent = '🗑 删除';
    delBtn.addEventListener('click', async () => {
      if (!confirm('确定删除《' + a.title + '》吗？')) return;
      delBtn.disabled = true;
      try {
        await deleteArticle(a.id);
        load();
      } catch (e) {
        delBtn.disabled = false;
        alert('删除失败：' + e.message);
      }
    });
    ops.appendChild(readBtn);
    ops.appendChild(delBtn);
    item.appendChild(ops);
    listEl.appendChild(item);
  }
}

load();
