/* ============ AI 设置：测试连接 ============
 * 「🔌 测试连接」按钮：真实调用本地 /api/ai_chat 验证所选服务商 Key。
 * 与 AI 设置业务解耦：配置与思考模式通过 getConfig / getThinking 注入。
 * v1.1.40 起 Key 加密存在服务器数据库，前端不发真实 Key（apiKey 留空，
 * 后端 /api/ai_chat 会按 provider 从数据库读取）。
 * 请求封装统一走 lib/api.js（postJson 在业务失败时抛 Error，含 err.status）。
 */
import { postJson } from '../lib/api.js';
import { providerName } from '../lib/providers.js';

export function bindTestButton({ test, result, getConfig, getThinking }) {
  test.addEventListener('click', () => {
    const c = getConfig();
    if (!c.hasKey || !c.model) {
      result.className = 'apikey-test-result fail';
      result.textContent = '❌ 该服务商未绑定 Key 或未选择模型';
      return;
    }
    test.disabled = true;
    const orig = test.textContent;
    test.textContent = '测试中…';
    result.className = 'apikey-test-result testing';
    result.textContent = '⏳ 正在调用 ' + providerName(c.id) + '…';
    postJson('/api/ai_chat', {
      provider: c.id,
      apiKey: '',
      model: c.model,
      baseUrl: c.baseUrl || '',
      thinking: getThinking(),
      message: '你好，请只回复四个字：连接成功'
    }, 120000).then((res) => {
      test.disabled = false;
      test.textContent = orig;
      result.className = 'apikey-test-result ok';
      result.textContent = '✅ 连接成功：' + String(res.content || '').slice(0, 150);
    }).catch((err) => {
      test.disabled = false;
      test.textContent = orig;
      result.className = 'apikey-test-result fail';
      let msg = String(err.message || err);
      if (err.status) msg = (err.status > 0 ? 'HTTP ' + err.status + ' ' : '') + msg;
      result.textContent = '❌ 连接失败：' + msg.slice(0, 220);
    });
  });
}
