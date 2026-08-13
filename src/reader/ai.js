/* ============ AI 语境翻译 + 句子语法分析 ============
 * 调用本地 /api/ai_chat，使用 AI 设置中绑定的 API Key（见 lib/ai-config.js）。
 * 同一单词 + 同一句子只请求一次（内存缓存），避免重复消耗 token。
 */
import { getDefaultAiConfig } from '../lib/ai-config.js';

export const PROVIDER_NAMES = {
  go: 'OpenCode Go',
  opencode: 'OpenCode Zen',
  deepseek: 'DeepSeek',
  openai: 'OpenAI',
  'openai-compatible': 'OpenAI 兼容',
};

const successCache = new Map(); // key -> { ok:true, content, provider }

function cacheKey(kind, word, sentence) {
  return kind + '\u0000' + (word || '') + '\u0000' + (sentence || '');
}

function buildPrompt(kind, word, sentence) {
  if (kind === 'translate') {
    return '下面是一篇英文文章中的一句话（双引号内）：\n"' + sentence + '"\n\n'
      + '请解释单词 "' + word + '" 在这句话语境下的具体含义，用中文回答，按下面格式：\n'
      + '【词性】\n【在此语境中的意思】\n【中文翻译】\n'
      + '【语境说明】用一两句话说明为什么在这个句子里它是这个意思。';
  }
  return '下面是一句英文（双引号内）：\n"' + sentence + '"\n\n'
    + '请用中文对它做语法分析，包含：\n'
    + '1. 句子主干（主谓宾 / 主系表）\n'
    + '2. 从句与修饰成分（定语 / 状语 / 插入语等）\n'
    + '3. 时态与语态\n'
    + '4. 如果是长难句，给出拆分理解';
}

// kind: 'translate' | 'grammar'
export async function fetchAi(kind, word, sentence) {
  const key = cacheKey(kind, word, sentence);
  const cached = successCache.get(key);
  if (cached) return cached;

  const cfg = getDefaultAiConfig();
  if (!cfg) {
    return { ok: false, error: '未绑定 API Key，请先到主页右上角「设置 → AI 设置」添加并保存' };
  }

  let thinking = false;
  try { thinking = localStorage.getItem('ieltsThinking') === '1'; } catch (e) {}

  try {
    const resp = await fetch('/api/ai_chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: cfg.provider,
        apiKey: cfg.apiKey,
        model: cfg.model,
        baseUrl: cfg.baseUrl || '',
        thinking,
        message: buildPrompt(kind, word, sentence),
      }),
    });
    const res = await resp.json();
    if (res.ok) {
      const out = { ok: true, content: res.content || '', provider: cfg.provider };
      successCache.set(key, out);
      return out;
    }
    let msg = String(res.error || '未知错误');
    if (res.status) msg = 'HTTP ' + res.status + ' ' + msg;
    return { ok: false, error: msg };
  } catch (err) {
    return { ok: false, error: '无法连接本地服务：' + err.message };
  }
}
