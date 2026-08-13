/* ============ AI 设置：已绑定 API Key 列表 ============
 * 渲染已绑定服务商列表（名称 / 掩码 / 模型 / Base URL），并为每条接线：
 * 编辑（跳转 ai-form.js）、删除、设为默认、测试连接（ai-test.js）。
 * 状态与服务器保存逻辑在 ai-state.js / ai.js。
 */
import { providerName } from '../lib/providers.js';
import { saveSettings, MASK } from '../lib/db-settings.js';
import { state, refreshState, postKeysFromState, getEditingProvider } from './ai-state.js';
import { openForm, closeForm, renderProviderSelect } from './ai-form.js';
import { bindTestButton } from './ai-test.js';

export function renderApiKeys() {
  const keys = state.keys;
  const bound = document.getElementById('apikeyBound');
  const empty = document.getElementById('apikeyEmpty');
  bound.innerHTML = '';
  const ids = Object.keys(keys);
  empty.hidden = ids.length > 0;
  ids.forEach((id) => {
    const conf = keys[id] || {};
    const item = document.createElement('div');
    item.className = 'apikey-bound-item';

    const head = document.createElement('div');
    head.className = 'apikey-head';
    const name = document.createElement('span');
    name.className = 'apikey-name';
    name.textContent = providerName(id);
    const val = document.createElement('span');
    val.className = 'apikey-val';
    val.textContent = MASK;
    const status = document.createElement('span');
    status.className = 'apikey-status bound';
    status.textContent = '已绑定';
    head.appendChild(name); head.appendChild(val); head.appendChild(status);
    if (state.defaultProvider === id) {
      const badge = document.createElement('span');
      badge.className = 'apikey-default-badge';
      badge.textContent = '⭐ 默认';
      head.appendChild(badge);
    }

    const meta = document.createElement('div');
    meta.className = 'apikey-meta';
    let metaText = conf.model ? ('模型：' + conf.model) : '模型：未选择';
    if (conf.baseUrl) metaText += ' · Base URL：' + conf.baseUrl;
    meta.textContent = metaText;

    const ops = document.createElement('div');
    ops.className = 'apikey-row apikey-ops';
    const edit = document.createElement('button');
    edit.type = 'button'; edit.className = 'apikey-btn'; edit.textContent = '✏️';
    edit.title = '修改';
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'apikey-btn apikey-del'; del.textContent = '🗑';
    del.title = '删除';
    const setDefault = document.createElement('button');
    setDefault.type = 'button';
    setDefault.className = 'apikey-btn' + (state.defaultProvider === id ? ' apikey-default-on' : '');
    setDefault.textContent = state.defaultProvider === id ? '✓ 默认' : '⭐ 设为默认';
    setDefault.title = '设为默认 API（阅读器 AI 语境翻译 / 语法分析默认使用）';
    setDefault.disabled = state.defaultProvider === id;
    setDefault.addEventListener('click', async () => {
      state.defaultProvider = id;
      try {
        await saveSettings({ defaultProvider: id });
      } catch (e) { alert('保存失败：' + e.message); }
      renderApiKeys();
    });
    const test = document.createElement('button');
    test.type = 'button'; test.className = 'apikey-btn apikey-test'; test.textContent = '🔌 测试连接';
    test.title = '真实调用该服务商 API 验证 Key';
    const result = document.createElement('div');
    result.className = 'apikey-test-result';
    ops.appendChild(edit); ops.appendChild(del); ops.appendChild(setDefault); ops.appendChild(test);

    edit.addEventListener('click', () => openForm(id));
    del.addEventListener('click', async () => {
      const keysMap = postKeysFromState();
      delete keysMap[id];
      const def = state.defaultProvider === id ? '' : state.defaultProvider;
      try {
        await saveSettings({ keys: keysMap, defaultProvider: def, thinking: state.thinking });
        await refreshState();
      } catch (e) { alert('删除失败：' + e.message); return; }
      if (getEditingProvider() === id) closeForm();
      renderApiKeys();
    });
    bindTestButton({
      test,
      result,
      getConfig: () => {
        const c = state.keys[id] || {};
        return { id, model: c.model || '', baseUrl: c.baseUrl || '', hasKey: !!c.hasKey };
      },
      getThinking: () => state.thinking,
    });

    item.appendChild(head); item.appendChild(meta); item.appendChild(ops); item.appendChild(result);
    bound.appendChild(item);
  });
  renderProviderSelect(keys, getEditingProvider());
}
