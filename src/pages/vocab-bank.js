/* ============ 词库总览页（背单词 · 全量单词分页浏览） ============
 * 四个分类标签页：已学 / 未学 / 今日新学 / 顽固（忘了 ≥3 次）。
 * 每页 20 条，分页浏览；点词条跳查词页看完整释义。
 * 只读页面：学习进度仍在背单词页产生，本页重置按钮可清空全部进度。
 */
import '../lib/nav.js';
import '../lib/version.js';
import { escapeHtml } from '../lib/dom.js';
import { listVocabProgress, resetVocabProgress } from '../lib/db-api.js';
import { VOCAB_BANK } from '../features/vocab/wordlist.js';
import { localIso } from '../features/vocab/srs.js';

const $ = (id) => document.getElementById(id);
const PAGE_SIZE = 20;
const TODAY = localIso().slice(0, 10);
const STAGE_NAME = ['未学', '学习中', '复习中', '已掌握'];

const state = {
  progress: new Map(),
  tab: 'learned',
  page: 1,
};

/* 分类定义：match 判断词条归属；sort 排序（null 保持词库原序） */
const TABS = [
  {
    id: 'learned', label: '已学单词',
    match: (p) => p && p.stage > 0,
    badge: (p) => STAGE_NAME[p.stage] + (p.stage === 1 || p.stage === 2 ? ' · 下次 ' + (p.due || '').slice(5, 10) : ''),
    badgeCls: (p) => 'st' + p.stage,
  },
  {
    id: 'fresh', label: '未学单词',
    match: (p) => !p,
    badge: (p, item) => (item.type === 'phrase' ? '词组' : ['基础', '核心', '进阶'][item.tier - 1] || '词汇'),
    badgeCls: () => 'st0',
  },
  {
    id: 'today', label: '今日新学',
    match: (p) => p && (p.added_at || '').slice(0, 10) === TODAY,
    badge: (p) => '今天 · ' + STAGE_NAME[p.stage],
    badgeCls: (p) => 'st' + p.stage,
  },
  {
    id: 'stubborn', label: '顽固单词',
    match: (p) => p && (p.lapses || 0) >= 3,
    sort: (a, b) => (b.p.lapses || 0) - (a.p.lapses || 0),
    badge: (p) => '忘了 ' + (p.lapses || 0) + ' 次',
    badgeCls: () => 'stubborn',
  },
];

function tabItems(tab) {
  const rows = [];
  for (const item of VOCAB_BANK) {
    const p = state.progress.get(item.vid);
    if (tab.match(p)) rows.push({ item, p });
  }
  if (tab.sort) rows.sort(tab.sort);
  return rows;
}

/* ---------- 渲染 ---------- */
function renderTabs() {
  const box = $('vb-tabs');
  box.innerHTML = '';
  for (const t of TABS) {
    const n = tabItems(t).length;
    const b = document.createElement('button');
    b.className = 'vb-tab' + (state.tab === t.id ? ' on' : '');
    b.innerHTML = escapeHtml(t.label) + ' <i>' + n + '</i>';
    b.addEventListener('click', () => {
      state.tab = t.id;
      state.page = 1;
      render();
    });
    box.appendChild(b);
  }
}

function renderList() {
  const tab = TABS.find((t) => t.id === state.tab);
  const rows = tabItems(tab);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  state.page = Math.min(state.page, pages);
  const slice = rows.slice((state.page - 1) * PAGE_SIZE, state.page * PAGE_SIZE);

  const list = $('vb-list');
  list.innerHTML = slice.length ? '' : '<div class="empty-state">这个分类下暂时没有单词</div>';
  const frag = document.createDocumentFragment();
  const startNo = (state.page - 1) * PAGE_SIZE + 1;
  slice.forEach((row, i) => {
    const { item, p } = row;
    const el = document.createElement('div');
    el.className = 'vc-item';
    el.innerHTML =
      `<span class="vi-no">${startNo + i}</span>` +
      `<span class="vi-w" data-w="${escapeHtml(item.w)}">${escapeHtml(item.w)}</span>` +
      `<span class="vi-p">${escapeHtml(item.p || '')}</span>` +
      `<span class="vi-d">${escapeHtml(item.d)}</span>` +
      `<span class="vi-badge ${tab.badgeCls(p, item)}">${escapeHtml(tab.badge(p, item))}</span>`;
    frag.appendChild(el);
  });
  list.appendChild(frag);
}

function renderPager() {
  const tab = TABS.find((t) => t.id === state.tab);
  const total = tabItems(tab).length;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pager = $('vb-pager');
  pager.innerHTML = '';
  const mk = (text, target, disabled, on) => {
    const b = document.createElement('button');
    b.className = 'vb-page' + (on ? ' on' : '');
    b.textContent = text;
    b.disabled = disabled;
    if (!disabled && target) b.addEventListener('click', () => { state.page = target; render(); });
    pager.appendChild(b);
  };
  mk('‹', state.page - 1, state.page <= 1);
  // 页码窗口：最多显示 7 个，带省略号
  const win = pageWindow(state.page, pages, 7);
  win.forEach((n) => (n === '…' ? mk('…', null, true) : mk(String(n), n, false, n === state.page)));
  mk('›', state.page + 1, state.page >= pages);

  $('vb-page-info').textContent = `第 ${state.page} / ${pages} 页 · 共 ${total} 词`;
}

function pageWindow(cur, total, max) {
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set([1, total, cur - 1, cur, cur + 1]);
  let lo = cur - Math.floor(max / 2), hi = lo + max - 1;
  if (lo < 1) { lo = 1; hi = max; }
  if (hi > total) { hi = total; lo = total - max + 1; }
  for (let i = lo; i <= hi; i++) set.add(i);
  const nums = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const n of nums) {
    if (n - prev > 1) out.push('…');
    out.push(n);
    prev = n;
  }
  return out;
}

function render() {
  $('vb-total').textContent = VOCAB_BANK.length;
  renderTabs();
  renderList();
  renderPager();
}

/* ---------- 事件 ---------- */
function bind() {
  // 点词条 → 查词页完整释义（一次性传词）
  $('vb-list').addEventListener('click', (e) => {
    const w = e.target.closest('.vi-w')?.dataset.w;
    if (!w) return;
    sessionStorage.setItem('dictInitWord', w);
    location.href = 'dict.html';
  });
  $('vb-reset').addEventListener('click', async () => {
    if (!confirm('确定清空全部背单词进度吗？此操作不可恢复。')) return;
    await resetVocabProgress();
    state.progress = new Map();
    state.page = 1;
    render();
  });
}

(async function init() {
  bind();
  const rows = await listVocabProgress();
  state.progress = new Map(rows.map((p) => [p.vid, p]));
  render();
})();
