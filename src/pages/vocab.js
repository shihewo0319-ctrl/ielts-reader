/* ============ 背单词页面入口 ============
 * 艾宾浩斯间隔重复流程：
 *   新词 → 显示答案自评 → 认识/秒懂进入复习队列（1~2 天后），
 *   忘了 → 10 分钟后本轮重现；复习间隔按遗忘曲线 ×难度系数 拉长，
 *   间隔 ≥45 天标记「已掌握」。
 * 每日队列 = 到期复习（优先，上限保护） + 新词（每日设定量 − 今天已学）。
 * 数据：词库在前端（wordlist.js），进度在服务器（vocab_progress）。
 */
import '../lib/nav.js';
import '../lib/version.js';
import { escapeHtml } from '../lib/dom.js';

/* 本页元素访问统一走本地 $（document 直查，规避模块绑定问题） */
const $ = (id) => document.getElementById(id);
import { initTts, speakWord } from '../features/tts.js';
import {
  listVocabProgress, saveVocabReview, getVocabSettings, saveVocabSettings,
  listVocabLog,
} from '../lib/db-api.js';
import { VOCAB_BANK, TIERS } from '../features/vocab/wordlist.js';
import {
  newCardState, gradeCard, previewNext, localIso, isDue,
} from '../features/vocab/srs.js';

const BANK_BY_ID = new Map(VOCAB_BANK.map((x) => [x.vid, x]));
const tierKey = (item) => (item.type === 'phrase' ? 'p' : String(item.tier));
const todayStr = () => localIso().slice(0, 10);
let TODAY = todayStr();

const state = {
  settings: { daily_new: 10, tiers: '1,2,3,p' },
  progress: new Map(),   // vid -> progress row
  log: [],
  queue: [],             // 本次学习队列 [{ item, progress, isNew }]
  pos: 0,
  done: { review: 0, again: 0, fresh: 0, t0: 0 },
};

/* ---------- 数据加载 ---------- */
async function loadAll() {
  const [progress, settings, log] = await Promise.all([
    listVocabProgress(), getVocabSettings(), listVocabLog(),
  ]);
  state.progress = new Map(progress.map((p) => [p.vid, p]));
  state.settings = settings;
  state.log = log;
}

/* ---------- 队列构建 ---------- */
function buildQueue() {
  const now = new Date();
  const dailyNew = Number(state.settings.daily_new) || 10;
  const active = new Set(String(state.settings.tiers || '').split(','));

  // ① 到期复习（学习阶段 10 分钟步进 + 复习阶段跨天），按到期先后
  const reviews = VOCAB_BANK
    .filter((b) => {
      const p = state.progress.get(b.vid);
      return p && (p.stage === 1 || p.stage === 2) && isDue(p.due, now);
    })
    .sort((a, b) => (state.progress.get(a.vid).due || '').localeCompare(state.progress.get(b.vid).due || ''))
    .slice(0, Math.max(40, dailyNew * 3)); // 复习洪水保护：超出部分明天自然顺延

  // ② 新词：今日已加入进度表的不重复计
  const today = todayStr();
  const addedToday = [...state.progress.values()]
    .filter((p) => (p.added_at || '').slice(0, 10) === today).length;
  const fresh = VOCAB_BANK
    .filter((b) => active.has(tierKey(b)) && !state.progress.has(b.vid))
    .slice(0, Math.max(0, dailyNew - addedToday));

  return [
    ...reviews.map((item) => ({ item, progress: state.progress.get(item.vid), isNew: false })),
    ...fresh.map((item) => ({ item, progress: null, isNew: true })),
  ];
}

/* ---------- 仪表盘渲染 ---------- */
function renderDash() {
  const now = new Date();
  let learned = 0, mastered = 0, due = 0;
  for (const p of state.progress.values()) {
    if (p.stage > 0) learned += 1;
    if (p.stage === 3) mastered += 1;
    if ((p.stage === 1 || p.stage === 2) && isDue(p.due, now)) due += 1;
  }
  const queue = buildQueue();
  $('vc-due').textContent = queue.filter((c) => !c.isNew).length;
  $('vc-new').textContent = queue.filter((c) => c.isNew).length;
  $('vc-total').textContent = VOCAB_BANK.length;
  $('vc-learned').textContent = learned;
  $('vc-mastered').textContent = mastered;
  $('vc-progress').textContent = Math.round((mastered / VOCAB_BANK.length) * 100) + '%';
  $('vc-streak').textContent = streakText();
  renderBankEntry(learned);
  $('vc-start').disabled = queue.length === 0;
  $('vc-start').textContent = queue.length === 0 ? '今日已完成 ✓' : (due > 0 ? '开始学习' : '学习新词');
}

function streakText() {
  const days = new Set(state.log.filter((l) => l.reviewed > 0).map((l) => l.day));
  if (days.size === 0) return '';
  let n = 0;
  const d = new Date();
  if (!days.has(localIso(d).slice(0, 10))) d.setDate(d.getDate() - 1); // 今天还没学则从昨天数
  while (days.has(localIso(d).slice(0, 10))) { n += 1; d.setDate(d.getDate() - 1); }
  return n > 0 ? `🔥 连续 ${n} 天` : '';
}

/* ---------- 词库总览入口卡统计 ---------- */
function renderBankEntry(learned) {
  let today = 0, stubborn = 0;
  for (const p of state.progress.values()) {
    if ((p.added_at || '').slice(0, 10) === TODAY) today += 1;
    if ((p.lapses || 0) >= 3) stubborn += 1;
  }
  const learnedN = learned != null ? learned
    : [...state.progress.values()].filter((p) => p.stage > 0).length;
  const el = $('vc-bank-summary');
  if (el) el.textContent =
    `已学 ${learnedN} · 未学 ${VOCAB_BANK.length - learnedN} · 今日新学 ${today} · 顽固 ${stubborn}`;
}

/* ---------- 设置区 ---------- */
function renderSettings() {
  const daily = Number(state.settings.daily_new) || 10;
  const chips = $('vc-daily-chips');
  chips.innerHTML = '';
  [5, 10, 15, 20, 30].forEach((n) => {
    const b = document.createElement('button');
    b.className = 'vc-chip' + (daily === n ? ' on' : '');
    b.textContent = n;
    b.addEventListener('click', () => setDaily(n));
    chips.appendChild(b);
  });
  const input = $('vc-daily-input');
  input.value = daily;
  input.onchange = () => setDaily(Math.max(1, Math.min(100, Number(input.value) || 10)));

  const active = new Set(String(state.settings.tiers || '').split(','));
  const tchips = $('vc-tier-chips');
  tchips.innerHTML = '';
  TIERS.forEach((t) => {
    const b = document.createElement('button');
    b.className = 'vc-chip' + (active.has(t.id) ? ' on' : '');
    b.textContent = t.name;
    b.addEventListener('click', async () => {
      active.has(t.id) ? active.delete(t.id) : active.add(t.id);
      if (active.size === 0) active.add(t.id); // 至少保留一个
      await saveVocabSettings(state.settings.daily_new, [...active].join(','));
      state.settings.tiers = [...active].join(',');
      renderSettings(); renderDash();
    });
    tchips.appendChild(b);
  });
}

async function setDaily(n) {
  state.settings.daily_new = n;
  await saveVocabSettings(n, state.settings.tiers);
  renderSettings(); renderDash();
}

/* ---------- 学习流程 ---------- */
function startStudy() {
  state.queue = buildQueue();
  if (state.queue.length === 0) return;
  state.pos = 0;
  state.done = { review: 0, again: 0, fresh: 0, t0: Date.now() };
  $('vocab-dash').classList.add('hidden');
  $('vocab-bank-entry').classList.add('hidden');
  $('vocab-done').classList.add('hidden');
  $('vocab-study').classList.remove('hidden');
  showCard();
}

function showCard() {
  if (state.pos >= state.queue.length) { finishStudy(); return; }
  const { item, progress } = state.queue[state.pos];
  $('vc-bar').style.width = `${(state.pos / state.queue.length) * 100}%`;
  $('vc-count').textContent = `${state.pos + 1} / ${state.queue.length}`;

  const tierName = item.type === 'phrase' ? '词组' : TIERS.find((t) => t.id === String(item.tier))?.name;
  $('vc-card-tier').textContent = tierName + (progress ? ' · 复习' : ' · 新词');
  $('vc-word').textContent = item.w;
  $('vc-phonetic').textContent = item.p || '';
  $('vc-sound').style.display = item.p ? '' : 'none';
  $('vc-def').textContent = item.d;
  $('vc-def-word').textContent = item.w;
  $('vc-card-back').classList.add('hidden');
  $('vc-grades').classList.add('hidden');
  $('vc-actions').classList.remove('hidden');
  // 重播入场动画
  const card = $('vc-card');
  card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
}

function reveal() {
  $('vc-actions').classList.add('hidden');
  $('vc-card-back').classList.remove('hidden');
  const grades = $('vc-grades');
  grades.classList.remove('hidden');
  const { progress } = state.queue[state.pos];
  const base = progress || newCardState();
  grades.querySelectorAll('.vc-grade').forEach((btn) => {
    btn.querySelector('[data-hint]').textContent = previewNext(base, Number(btn.dataset.g));
  });
}

async function grade(g) {
  const card = state.queue[state.pos];
  const base = card.progress || newCardState();
  const next = gradeCard(base, g);
  const wasNew = card.isNew;
  card.progress = next;
  state.progress.set(card.item.vid, { ...next, vid: card.item.vid, added_at: localIso() });
  state.done.review += 1;
  if (g === 0) state.done.again += 1;
  if (wasNew) state.done.fresh += 1;
  // 先推进界面再落库：即使服务器短暂卡顿，学习节奏也不中断
  saveVocabReview({
    vid: card.item.vid, ...next, grade: g, was_new: wasNew, day: todayStr(),
  }).catch((err) => console.warn('评分保存失败（稍后可重新评分）:', err));
  // 「忘了 / 模糊」且仍在学习阶段 → 本轮末尾重现（艾宾浩斯会话内复习）
  if (next.stage === 1 && state.pos < state.queue.length - 1) {
    state.queue.push({ item: card.item, progress: next, isNew: false });
  }
  state.pos += 1;
  showCard();
}

function finishStudy() {
  $('vocab-study').classList.add('hidden');
  $('vocab-done').classList.remove('hidden');
  const mins = Math.max(1, Math.round((Date.now() - state.done.t0) / 60000));
  $('vc-done-stats').innerHTML = `
    <span class="vc-n"><b>${state.done.review}</b><i>评分次数</i></span>
    <span class="vc-n"><b>${state.done.fresh}</b><i>新学</i></span>
    <span class="vc-n"><b>${state.done.again}</b><i>忘了</i></span>
    <span class="vc-n"><b>${mins}</b><i>分钟</i></span>`;
  const nextDue = [...state.progress.values()]
    .filter((p) => p.stage === 1 || p.stage === 2)
    .map((p) => p.due).sort()[0];
  $('vc-done-next').textContent = nextDue
    ? `下一次复习：${nextDue.replace('T', ' ')}（到时打开本页会自动提醒）`
    : '词库内暂无待复习项，明天再来学新词吧！';
  renderDash();
}

function exitStudy() {
  $('vocab-study').classList.add('hidden');
  $('vocab-done').classList.add('hidden');
  $('vocab-dash').classList.remove('hidden');
  $('vocab-bank-entry').classList.remove('hidden');
  renderDash();
}


/* ---------- 事件与初始化 ---------- */
function bind() {

  $('vc-start').addEventListener('click', startStudy);
  $('vc-reveal').addEventListener('click', reveal);
  $('vc-grades').addEventListener('click', (e) => {
    const btn = e.target.closest('.vc-grade');
    if (btn) grade(Number(btn.dataset.g));
  });
  $('vc-exit').addEventListener('click', exitStudy);
  $('vc-back').addEventListener('click', exitStudy);
  $('vc-again').addEventListener('click', startStudy);
  $('vc-sound').addEventListener('click', (e) => {
    const w = $('vc-word').textContent;
    if (!w.includes(' ')) speakWord(w); // 词组不走词典发音
    const btn = e.currentTarget;
    btn.classList.remove('speaking'); void btn.offsetWidth; btn.classList.add('speaking');
  });
}

(async function init() {
  initTts();
  bind();
  await loadAll();
  renderDash();
  renderSettings();
})();
