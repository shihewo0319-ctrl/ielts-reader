/* ============ AI 调用配置：选择默认服务商 / 读取已绑定 Key ============
 * 与 settings.js 共用 localStorage：
 *   - ielts_api_keys       已绑定的 API Key（{ provider: {key,model,baseUrl} }）
 *   - ieltsDefaultProvider 用户手动选择的默认服务商
 * 选择逻辑：优先用户设置的默认服务商 → 否则按顺序选第一个已绑定的。
 */
const STORE_KEY = 'ielts_api_keys';
const DEFAULT_KEY = 'ieltsDefaultProvider';
export const AI_PROVIDER_ORDER = ['go', 'opencode', 'deepseek', 'openai', 'openai-compatible'];

export function getDefaultProvider() {
  try { return localStorage.getItem(DEFAULT_KEY) || ''; } catch (e) { return ''; }
}
export function setDefaultProvider(id) {
  try {
    if (id) localStorage.setItem(DEFAULT_KEY, id);
    else localStorage.removeItem(DEFAULT_KEY);
  } catch (e) {}
}

export function getDefaultAiConfig() {
  let keys = {};
  try { keys = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { keys = {}; }
  const pick = (id) => {
    const c = keys[id];
    if (c && c.key && c.model) return { provider: id, apiKey: c.key, model: c.model, baseUrl: c.baseUrl || '' };
    return null;
  };
  const preferred = getDefaultProvider();
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
