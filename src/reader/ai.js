/* ============ AI 语境翻译 + 句子语法分析 ============
 * 调用本地 /api/ai_chat，使用 AI 设置中绑定的 API Key（见 lib/ai-config.js）。
 * 同一单词 + 同一句子只请求一次（内存缓存），避免重复消耗 token。
 */
import { getDefaultAiConfig } from '../lib/ai-config.js';
import { escapeHtml } from '../lib/dom.js';

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
      + '【词性】\n【语境翻译】这个词在此句中的意思\n【句子翻译】整个句子的中文翻译\n'
      + '【语境说明】用一两句话说明为什么在这个句子里它是这个意思。';
  }
  return '下面是一句英文（双引号内）：\n"' + sentence + '"\n\n'
    + '请像专业语法分析工具 Enpuz 那样，用中文对这句话做完整语法分析，严格按下面的【标签】逐项输出：\n'
    + '【句子类型】判断陈述句/疑问句/祈使句/感叹句，以及简单句/并列句/复合句\n'
    + '【时态语态】时态（如一般现在时）与语态（主动/被动）\n'
    + '【成分划分】从左到右逐词/逐短语标注句子成分，示例格式："The old man(主语) slowly(方式状语) walked(谓语动词) along the river(地点状语)."；'
    + '多词短语用 ··· 连接；存在从句时，分别用【主句】与【从句】分段，从句注明类型（如定语从句/状语从句/宾语从句/主语从句）；'
    + '形式主语/形式宾语需标注其真实主语/真实宾语\n'
    + '【主干结构】一句话概括句子主干（主谓宾 / 主系表 / 主谓等），并列或嵌套关系一并说明\n'
    + '【理解要点】长难句给出拆分理解：先抓主干再逐层加修饰；特殊结构（倒装、省略、独立主格、非谓语等）单独说明';
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

// 把 AI 返回内容里的【标签】转成带背景色的标签样式（与词典标签一致）
export function buildAiContentHtml(content, compact = false) {
  let text = content;
  // 语法分析：压缩结构之间的连续空行，让间距更紧凑
  if (compact) text = text.replace(/\n{2,}/g, '\n');
  const esc = escapeHtml(text);
  return esc.replace(/【([^】]+)】/g, '<span class="pos">$1</span>');
}
