/* ============ 数据库 API 封装（文章库 / 生词本 / 学习记录） ============
 * 对应后端 /api/articles、/api/words、/api/lookups（见 server.py + api_db.py + db.py）。
 * 前端统一从这里读写 SQLite 数据，页面组件不直接 fetch；
 * 请求封装统一走 lib/api.js（fetchJson / postJson / deleteJson）。
 */
import { fetchJson, postJson, deleteJson } from './api.js';

/* ===== 文章库 ===== */
export async function listArticles() {
  const res = await fetchJson('/api/articles');
  if (!res.ok) throw new Error(res.error || '获取文章列表失败');
  return res.articles || [];
}

export async function getArticle(id) {
  const res = await fetchJson('/api/articles?id=' + encodeURIComponent(id));
  if (!res.ok) throw new Error(res.error || '获取文章失败');
  return res.article || null;
}

export async function saveArticle(title, content) {
  const data = await postJson('/api/articles', { title, content });
  return data.id;
}

export async function deleteArticle(id) {
  await deleteJson('/api/articles?id=' + encodeURIComponent(id));
}

/* ===== 生词本 ===== */
export async function listWords() {
  const res = await fetchJson('/api/words');
  if (!res.ok) throw new Error(res.error || '获取生词本失败');
  return res.words || [];
}

export async function addWord(word, sentence = '', note = '') {
  const data = await postJson('/api/words', { word, sentence, note });
  return data.id;
}

export async function deleteWord(id) {
  await deleteJson('/api/words?id=' + encodeURIComponent(id));
}

/* ===== 学习记录 ===== */
export async function listLookups(limit = 100) {
  const res = await fetchJson('/api/lookups?limit=' + encodeURIComponent(limit));
  if (!res.ok) throw new Error(res.error || '获取学习记录失败');
  return res.lookups || [];
}

export async function addLookup(word, sentence = '', articleTitle = '', articleId = null) {
  // 记录失败不打断查词流程，静默忽略
  try {
    await postJson('/api/lookups', {
      word,
      sentence,
      article_title: articleTitle,
      article_id: articleId,
    });
  } catch (e) { /* ignore */ }
}

export async function clearLookups() {
  await deleteJson('/api/lookups');
}
