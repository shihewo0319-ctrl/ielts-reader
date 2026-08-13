/* ============ AI 调用配置：从 AI 设置中挑选一个已绑定的服务商 ============
 * 与 settings.js 共用同一个 localStorage 键（ielts_api_keys）。
 * 选择顺序：OpenCode Go → OpenCode Zen → DeepSeek → OpenAI → OpenAI 兼容。
 */
const STORE_KEY = 'ielts_api_keys';
export const AI_PROVIDER_ORDER = ['go', 'opencode', 'deepseek', 'openai', 'openai-compatible'];

export function getDefaultAiConfig() {
  let keys = {};
  try { keys = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { keys = {}; }
  for (const id of AI_PROVIDER_ORDER) {
    const c = keys[id];
    if (c && c.key && c.model) {
      return { provider: id, apiKey: c.key, model: c.model, baseUrl: c.baseUrl || '' };
    }
  }
  return null;
}
