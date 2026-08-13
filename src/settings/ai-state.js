/* ============ AI 设置共享状态 ============
 * settings/ai-form.js、ai-list.js、ai.js 共享的可变状态与通用函数：
 *   - state：服务器读取的 AI 设置 {keys, defaultProvider, thinking}
 *   - editingProvider：当前正在编辑的服务商 id（null = 新增模式）
 *   - refreshState()：从服务器刷新 state
 *   - postKeysFromState()：把 state.keys 转成可提交的 POST 结构（已绑定填掩码）
 * 本模块不涉及 DOM，只做状态管理。
 */
import { loadSettings, MASK } from '../lib/db-settings.js';

export const state = { keys: {}, defaultProvider: '', thinking: false };
let editingProvider = null;

export function getEditingProvider() { return editingProvider; }
export function setEditingProvider(id) { editingProvider = id || null; }

export async function refreshState() {
  const next = await loadSettings();
  state.keys = next.keys;
  state.defaultProvider = next.defaultProvider;
  state.thinking = next.thinking;
  return state;
}

// 把当前 state.keys（含 hasKey 标记）转成可提交的 POST 结构：
// 已绑定服务商一律填掩码 MASK，后端据此保留原 Key；overrides 用于覆盖本次表单改动。
export function postKeysFromState(overrides = {}) {
  const keys = {};
  Object.keys(state.keys).forEach((id) => {
    const c = state.keys[id] || {};
    keys[id] = { key: MASK, model: c.model || '', baseUrl: c.baseUrl || '' };
  });
  Object.keys(overrides).forEach((id) => {
    keys[id] = overrides[id];
  });
  return keys;
}
