/* ============ AI 设置业务编排 ============
 * 面板 HTML 由 src/settings/menu.js 的模板渲染，本模块负责：
 *   - 思考模式开关（存服务器 /api/settings，跨设备生效）
 *   - 新增 / 保存 / 取消 API Key（表单渲染在 ai-form.js，已绑定列表在 ai-list.js）
 * 浏览器拿不到真实 Key，编辑时输入框只显示掩码 MASK，保存掩码表示保留原 Key。
 */
import { saveSettings } from '../lib/db-settings.js';
import { state, refreshState, postKeysFromState } from './ai-state.js';
import { openForm, closeForm, readFormValues } from './ai-form.js';
import { renderApiKeys } from './ai-list.js';

/* ===== 思考模式开关 ===== */
function syncThinkingToggle() {
  const toggle = document.getElementById('thinkingToggle');
  if (toggle) toggle.checked = state.thinking;
}
function wireThinkingToggle() {
  const toggle = document.getElementById('thinkingToggle');
  if (!toggle) return;
  toggle.addEventListener('change', async () => {
    const v = toggle.checked;
    state.thinking = v;
    try {
      await saveSettings({ thinking: v });
    } catch (e) {
      toggle.checked = !v;
      alert('保存失败：' + e.message);
    }
  });
}

/* 进入 AI 设置子面板时：收起表单并从服务器刷新已绑定列表 */
export async function openAiPanel() {
  closeForm();
  try {
    await refreshState();
  } catch (e) { /* 服务器不可用时保留旧状态 */ }
  syncThinkingToggle();
  renderApiKeys();
}

/* 初始化：接线思考模式开关 + API Key 表单 + 首次加载服务器数据 */
export function initAiSettings() {
  wireThinkingToggle();
  document.getElementById('apikeyAdd').addEventListener('click', () => openForm(null));
  document.getElementById('apikeyToggle').addEventListener('click', () => {
    const input = document.getElementById('apikeyInput');
    input.type = (input.type === 'text') ? 'password' : 'text';
  });
  document.getElementById('apikeySave').addEventListener('click', async () => {
    const { id, keyVal, model, baseUrl, finalKey } = readFormValues();
    if (!keyVal) { document.getElementById('apikeyInput').focus(); return; }
    if (id === 'openai-compatible' && !baseUrl) {
      document.getElementById('apikeyBaseUrl').focus();
      return;
    }
    const keysMap = postKeysFromState();
    keysMap[id] = { key: finalKey, model, baseUrl };
    try {
      await saveSettings({ keys: keysMap, defaultProvider: state.defaultProvider, thinking: state.thinking });
      await refreshState();
    } catch (e) {
      alert('保存失败：' + e.message);
      return;
    }
    closeForm();
    renderApiKeys();
  });
  document.getElementById('apikeyCancel').addEventListener('click', () => {
    closeForm();
    renderApiKeys();
  });
  // 首次加载服务器数据（后台异步，成功后渲染列表）
  refreshState()
    .then(() => { syncThinkingToggle(); renderApiKeys(); })
    .catch(() => { renderApiKeys(); });
}
