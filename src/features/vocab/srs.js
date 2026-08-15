/* ============ 艾宾浩斯间隔重复引擎（SRS） ============
 * 模型：学习阶段（会话内 10 分钟步进，遵循「学后即时复习」）+
 *       复习阶段按遗忘曲线拉长间隔（SM-2 的 ease 系数自适应难度）。
 *
 * 间隔规则（grade：0 忘了 / 1 模糊 / 2 认识 / 3 秒懂）：
 *   忘了：回到学习阶段，10 分钟后重现；难度 +0.2，遗忘 +1
 *   模糊：学习阶段停留 10 分钟；复习阶段间隔 ×1.2（至少 1 天）
 *   认识：学习阶段毕业 → 1 天后复习；复习阶段间隔 × ease（≈1/2/4/7/15/30…自然逼近遗忘节点）
 *   秒懂：同认识但 ×1.3 加速；难度 -0.15
 *   间隔 ≥ 45 天 → 已掌握（stage 3，不再进入队列）
 *
 * ease 限定在 [1.3, 3.0]；间隔上限 120 天。
 * 纯函数实现：状态由调用方持有，返回新对象。
 */

export const GRADE_AGAIN = 0;
export const GRADE_HARD = 1;
export const GRADE_GOOD = 2;
export const GRADE_EASY = 3;

export const MIN_EASE = 1.3;
export const MAX_EASE = 3.0;
export const MAX_INTERVAL = 120;   // 天
export const MASTER_INTERVAL = 45; // 间隔达到即「已掌握」
const MIN10_IN_DAYS = 10 / (24 * 60);

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function newCardState() {
  return { stage: 0, due: '', interval_d: 0, ease: 2.5, reps: 0, lapses: 0 };
}

/* 对一张卡评分，返回下一状态（不修改入参） */
export function gradeCard(state, grade) {
  const s = { ...state, reps: state.reps + 1 };
  const now = new Date();
  const dueIn = (days) => {
    const d = new Date(now.getTime() + days * 86400000);
    return localIso(d);
  };

  if (grade === GRADE_AGAIN) {
    s.lapses += 1;
    s.ease = clamp(s.ease - 0.2, MIN_EASE, MAX_EASE);
    s.stage = 1;
    s.interval_d = MIN10_IN_DAYS;
    s.due = dueIn(MIN10_IN_DAYS);
    return s;
  }

  if (grade === GRADE_HARD) {
    s.ease = clamp(s.ease - 0.1, MIN_EASE, MAX_EASE);
    if (s.stage === 2) {
      s.interval_d = clamp(Math.max(1, s.interval_d * 1.2), 1, MAX_INTERVAL);
      s.due = dueIn(s.interval_d);
    } else {
      s.stage = 1;
      s.interval_d = MIN10_IN_DAYS;
      s.due = dueIn(MIN10_IN_DAYS);
    }
    return s;
  }

  const mult = grade === GRADE_EASY ? 1.3 : 1;
  if (grade === GRADE_EASY) s.ease = clamp(s.ease + 0.15, MIN_EASE, MAX_EASE);

  if (s.stage !== 2) {
    // 学习阶段毕业：认识 → 1 天后首次复习（艾宾浩斯第一个跨天节点）
    s.stage = 2;
    s.interval_d = grade === GRADE_EASY ? 2 : 1;
  } else {
    s.interval_d = clamp(s.interval_d * s.ease * mult, 1, MAX_INTERVAL);
  }
  s.stage = s.interval_d >= MASTER_INTERVAL ? 3 : 2;
  s.due = dueIn(s.interval_d);
  return s;
}

/* 评分按钮上显示的「下次复习时间」提示 */
export function previewNext(state, grade) {
  const s = gradeCard(state, grade);
  if (s.stage === 3) return '已掌握';
  if (s.interval_d < 1) return `${Math.round(s.interval_d * 24 * 60)} 分钟后`;
  const d = s.interval_d;
  if (d < 30) return `${Math.round(d)} 天后`;
  return `${Math.round(d / 30)} 个月后`;
}

/* 本地时间 ISO（SQLite datetime('now','localtime') 同格式，分钟精度） */
export function localIso(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* due 是否已到期（due 为空或格式非法视为未到期） */
export function isDue(due, now = new Date()) {
  if (!due) return false;
  const t = new Date(due.replace(' ', 'T'));
  return !isNaN(t) && t <= now;
}
