/* ============ AI 服务商静态数据：服务商 / 模型 / Base URL ============
 * 只放纯数据表 + 一个查询函数，不涉及 DOM / localStorage。
 * 供 src/settings/ai.js（API Key 表单）使用。
 */
export const PROVIDERS = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'openai-compatible', name: 'OpenAI 兼容格式' },
  { id: 'deepseek', name: 'DeepSeek' },
  { id: 'opencode', name: 'OpenCode Zen' },
  { id: 'go', name: 'OpenCode Go' },
];

export const MODELS = {
  openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
  'openai-compatible': [],
  deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
  opencode: ['glm-5', 'glm-5.1', 'glm-5.2', 'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code', 'deepseek-v4-pro', 'deepseek-v4-flash'],
  go: ['grok-4.5', 'glm-5.2', 'glm-5.1', 'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6', 'deepseek-v4-pro', 'deepseek-v4-flash', 'mimo-v2.5', 'mimo-v2.5-pro', 'hy3'],
};

export const DEFAULT_MODELS = {
  openai: 'gpt-4o-mini',
  'openai-compatible': '',
  deepseek: 'deepseek-v4-flash',
  opencode: 'glm-5',
  go: 'glm-5.2',
};

export const BASE_URLS = {
  openai: 'https://api.openai.com/v1',
  'openai-compatible': '',
  deepseek: 'https://api.deepseek.com/v1',
  opencode: 'https://opencode.ai/zen/v1',
  go: 'https://opencode.ai/zen/go/v1',
};

export function providerName(id) {
  const p = PROVIDERS.find(p => p.id === id);
  return p ? p.name : id;
}
