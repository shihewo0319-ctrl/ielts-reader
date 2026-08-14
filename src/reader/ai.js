/* ============ AI 语境翻译 + 句子语法分析 ============
 * 调用本地 /api/ai_chat，使用 AI 设置中绑定的 API Key（见 lib/ai-config.js）。
 * v1.1.40 起 Key 加密存服务器数据库，前端不传 Key，由后端按 provider 读取。
 * 同一单词 + 同一句子只请求一次（内存缓存），避免重复消耗 token。
 */
import { getDefaultAiConfig } from '../lib/ai-config.js';
import { postJson } from '../lib/api.js';
import { escapeHtml } from '../lib/dom.js';

const successCache = new Map(); // key -> { ok:true, content, provider }（当前页面内存缓存，刷新即清空）

// 清理：移除已废弃的持久缓存（v1.1.21 引入、v1.1.24 移除）
try { localStorage.removeItem('ielts_ai_cache'); } catch (e) {}

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
    + '请像专业语法分析工具 Enpuz 那样分析这句话，只输出一个 JSON 对象（不要输出任何其他文字、不要用 markdown 代码块包裹），格式如下：\n'
    + '{\n'
    + '  "summary": "句子类型（简单句/并列句/复合句及从句类型）+ 主干 + 时态语态，用中文一句话概括",\n'
    + '  "translation": "整个句子的通顺中文翻译",\n'
    + '  "chunks": [\n'
    + '    {"text": "单词或短语原文", "role": "成分名", "clause": "所属从句名"}\n'
    + '  ]\n'
    + '}\n'
    + '要求：\n'
    + '1. chunks 按原文从左到右列出，覆盖整句，不遗漏任何单词\n'
    + '2. 多词短语作为一个 chunk，例如 "the old man" 整体作为一个 chunk\n'
    + '3. role 用中文成分名：主语/谓语动词/宾语/表语/定语/状语/补语/连词/系表结构/介词短语等\n'
    + '4. clause 填该 chunk 属于的主句或从句名（如 主句 / 让步状语从句 / 宾语从句），标点符号的 clause 填空字符串\n'
    + '5. 标点符号（逗号句号等）单独作为一个 chunk，role 填 "标点"\n'
    + '6. translation 必须是整个句子的通顺中文翻译，不要省略'
}

// kind: 'translate' | 'grammar'
export async function fetchAi(kind, word, sentence) {
  const key = cacheKey(kind, word, sentence);
  const cached = successCache.get(key);
  if (cached) return cached;

  const cfg = await getDefaultAiConfig();
  if (!cfg) {
    return { ok: false, error: '未绑定 API Key，请先到主页右上角「设置 → AI 设置」添加并保存' };
  }

  // 语法分析不需要深度思考：强制关闭，避免思考模式导致 60s+ 超时
  // （全局「思考模式」开关只对语境翻译生效，存于服务器设置）
  const thinking = kind !== 'grammar' && !!cfg.thinking;

  try {
    // apiKey 留空：v1.1.40 起 Key 加密存服务器数据库，后端按 provider 自动读取
    const res = await postJson('/api/ai_chat', {
      provider: cfg.provider,
      apiKey: '',
      model: cfg.model,
      baseUrl: cfg.baseUrl || '',
      thinking,
      message: buildPrompt(kind, word, sentence),
    }, 120000);
    if (res.ok) {
      const out = { ok: true, content: res.content || '', provider: cfg.provider };
      successCache.set(key, out);
      return out;
    }
    return { ok: false, error: String(res.error || '未知错误') };
  } catch (err) {
    const msg = String(err.message || err);
    if (err.status) return { ok: false, error: (err.status > 0 ? 'HTTP ' + err.status + ' ' : '') + msg };
    return { ok: false, error: '无法连接本地服务：' + msg };
  }
}

// 把 AI 返回内容里的【标签】转成带背景色的标签样式（与词典标签一致）
export function buildAiContentHtml(content) {
  const esc = escapeHtml(content);
  return esc.replace(/【([^】]+)】/g, '<span class="pos">$1</span>');
}

// 解析语法分析的 JSON 输出（容忍 markdown 代码块 / 前后多余文字）
// 返回 { ok:true, summary, translation, chunks:[{text,role,clause}] } 或 { ok:false }
export function parseGrammarJson(content) {
  try {
    let text = String(content || '').trim();
    // 去掉可能的 ```json ... ``` 代码块
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) text = fence[1].trim();
    // 提取第一个 { ... } 对象
    const s = text.indexOf('{');
    const e = text.lastIndexOf('}');
    if (s === -1 || e === -1 || e <= s) return { ok: false };
    const obj = JSON.parse(text.slice(s, e + 1));
    if (!obj || !Array.isArray(obj.chunks)) return { ok: false };
    const chunks = obj.chunks
      .filter(c => c && typeof c.text === 'string')
      .map(c => ({
        text: c.text,
        role: typeof c.role === 'string' ? c.role : '',
        clause: typeof c.clause === 'string' ? c.clause : '',
      }));
    if (!chunks.length) return { ok: false };
    return {
      ok: true,
      summary: typeof obj.summary === 'string' ? obj.summary : '',
      translation: typeof obj.translation === 'string' ? obj.translation : '',
      chunks,
    };
  } catch (e) {
    return { ok: false };
  }
}
