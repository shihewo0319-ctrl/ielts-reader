/* ============ AI 设置服务器 API 封装（/api/settings） ============
 * 对应后端 api_db.py 的 /api/settings 路由 + settings_store.py 加密存储：
 *   - GET  读取 {keys, defaultProvider, thinking}
 *          keys 不含真实 Key，只有 hasKey 标记（浏览器拿不到明文 Key）
 *   - POST 整体保存 {keys, defaultProvider, thinking}；key 为掩码 MASK 时后端保留原 Key
 * API Key 加密存储在服务器数据库 data/ielts.db，跨设备绑定一次全端生效。
 * 请求封装统一走 lib/api.js。
 */
import { fetchJson, postJson } from './api.js';

// 与后端 settings_store.py 保持一致：输入框里显示的掩码，后端见到它表示"保留原 Key 不变"
export const MASK = '••••••••';

export async function loadSettings() {
  const res = await fetchJson('/api/settings');
  if (!res.ok) throw new Error(res.error || '读取设置失败');
  return {
    keys: res.keys || {},
    defaultProvider: res.defaultProvider || '',
    thinking: !!res.thinking,
  };
}

// keys 传 undefined 时不修改 Key（只更新默认服务商 / 思考模式）
export async function saveSettings({ keys, defaultProvider, thinking } = {}) {
  const body = {};
  if (keys !== undefined) body.keys = keys;
  if (defaultProvider !== undefined) body.defaultProvider = defaultProvider;
  if (thinking !== undefined) body.thinking = thinking;
  return postJson('/api/settings', body);
}
