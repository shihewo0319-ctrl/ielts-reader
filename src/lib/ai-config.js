/* ============ AI 调用配置：默认服务商 / 已绑定 Key（服务器数据库） ============
 * 自 v1.1.40 起 API Key 加密存到服务器数据库（/api/settings），不再用 localStorage：
 *   - initAiConfig()        启动时预加载（含旧 localStorage 数据一次性迁移）
 *   - getDefaultAiConfig()  异步返回默认服务商配置 {provider, model, baseUrl, thinking}
 *   - getDefaultProvider() / setDefaultProvider()  默认服务商（异步，写入服务器）
 *   - getThinkingSetting() / setThinkingSetting()  思考模式开关（异步，写入服务器）
 * 选择逻辑：优先用户设置的默认服务商 → 否则按顺序选第一个已绑定的。
 */
import { loadSettings, saveSettings } from './db-settings.js';

export const AI_PROVIDER_ORDER = ['go', 'opencode', 'deepseek', 'openai', 'openai-compatible'];

// localStorage 旧键名（v1.1.40 之前用，一次性迁移后清除）
const LEGACY_KEYS = 'ielts_api_keys';
const LEGACY_DEFAULT = 'ieltsDefaultProvider';
const LEGACY_THINKING = 'ieltsThinking';

let state = { keys: {}, defaultProvider: '', thinking: false, loaded: false };

/* ===== 初始化 / 预加载（含旧数据迁移） ===== */
export async function initAiConfig(force = false) {
  if (state.loaded && !force) return state;
  let remote;
  try {
    remote = await loadSettings();
  } catch (e) {
    state = { keys: {}, defaultProvider: '', thinking: false, loaded: false };
    return state;
  }
  try {
    remote = await migrateLegacy(remote);
  } catch (e) { /* 迁移失败不阻塞，下次再试 */ }
  state = { ...remote, loaded: true };
  return state;
}

/* 旧 localStorage → 服务器一次性迁移：服务器没有 Key 时上传本地数据，成功后清空 */
async function migrateLegacy(remote) {
  const hasRemote = Object.keys(remote.keys || {})
    .some(id => remote.keys[id] && remote.keys[id].hasKey);
  if (hasRemote) { clearLegacy(); return remote; }
  const local = readLegacy();
  if (!Object.keys(local.keys).length) { clearLegacy(); return remote; }
  try {
    await saveSettings(local);
    clearLegacy();
    return await loadSettings(); // 重新读取服务器状态（含 hasKey 标记）
  } catch (e) {
    return remote; // 上传失败：保留 localStorage，下次再试
  }
}

function readLegacy() {
  const keys = {};
  try {
    const raw = JSON.parse(localStorage.getItem(LEGACY_KEYS) || '{}');
    Object.keys(raw).forEach((id) => {
      const v = raw[id];
      const conf = (typeof v === 'string') ? { key: v, model: '', baseUrl: '' } : (v || {});
      if (conf.key) keys[id] = { key: conf.key, model: conf.model || '', baseUrl: conf.baseUrl || '' };
    });
  } catch (e) {}
  let defaultProvider = '';
  let thinking = false;
  try {
    defaultProvider = localStorage.getItem(LEGACY_DEFAULT) || '';
    thinking = localStorage.getItem(LEGACY_THINKING) === '1';
  } catch (e) {}
  return { keys, defaultProvider, thinking };
}

function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEYS);
    localStorage.removeItem(LEGACY_DEFAULT);
    localStorage.removeItem(LEGACY_THINKING);
  } catch (e) {}
}

/* ===== 默认服务商 ===== */
export async function getDefaultProvider() {
  const st = await initAiConfig();
  return st.defaultProvider;
}

export async function setDefaultProvider(id) {
  await initAiConfig();
  state.defaultProvider = id || '';
  try {
    await saveSettings({ defaultProvider: state.defaultProvider });
  } catch (e) { throw e; }
}

/* ===== 思考模式 ===== */
export async function getThinkingSetting() {
  const st = await initAiConfig();
  return st.thinking;
}

export async function setThinkingSetting(v) {
  await initAiConfig();
  state.thinking = !!v;
  try {
    await saveSettings({ thinking: state.thinking });
  } catch (e) { throw e; }
}

/* ===== 默认 AI 调用配置 ===== */
export async function getDefaultAiConfig() {
  const st = await initAiConfig();
  const keys = st.keys || {};
  const pick = (id) => {
    const c = keys[id];
    if (c && c.hasKey && c.model) {
      return { provider: id, model: c.model, baseUrl: c.baseUrl || '', thinking: !!st.thinking };
    }
    return null;
  };
  const preferred = st.defaultProvider;
  if (preferred) {
    const c = pick(preferred);
    if (c) return c;
  }
  for (const id of AI_PROVIDER_ORDER) {
    const c = pick(id);
    if (c) return c;
  }
  return null;
}
