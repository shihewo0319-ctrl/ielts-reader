/* ============ AI 设置：思考模式 + API Key 绑定 + 测试连接 ============
 * 面板 HTML 由 src/settings/menu.js 的模板渲染，本模块负责全部业务：
 *   - 思考模式开关（存服务器 /api/settings，跨设备生效）
 *   - API Key 绑定 / 修改 / 删除 / 设为默认（加密存服务器数据库 data/ielts.db）
 *   - 「测试连接」真实调用本地 /api/ai_chat 验证 Key（Key 由服务器从数据库读取）
 * 浏览器拿不到真实 Key，编辑时输入框只显示掩码 MASK，保存掩码表示保留原 Key。
 */
import { PROVIDERS, MODELS, BASE_URLS, providerName } from '../lib/providers.js';
import { loadSettings, saveSettings, MASK } from '../lib/db-settings.js';
import { bindTestButton } from './ai-test.js';

let editingProvider = null;
let state = { keys: {}, defaultProvider: '', thinking: false };

/* ===== 从服务器刷新状态（打开面板 / 每次保存后调用） ===== */
async function refreshState() {
  state = await loadSettings();
}

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

/* ===== 把当前 state.keys（含 hasKey 标记）转成可提交的 POST 结构 =====
 * 已绑定服务商一律填掩码 MASK，后端据此保留原 Key；overrides 用于覆盖本次表单改动。
 */
function postKeysFromState(overrides = {}) {
  const keys = {};
  Object.keys(state.keys).forEach((id) => {
    const c = state.keys[id] || {};
    keys[id] = { key: MASK, model: c.model || '', baseUrl: c.baseUrl || '' };
  });
  Object.keys(overrides).forEach((id) => {
    keys[id] = overrides[id];
  });
  return keys;
}

/* ===== 表单渲染 ===== */
function renderProviderSelect(keys, current) {
  const sel = document.getElementById('apikeyProvider');
  sel.innerHTML = '';
  PROVIDERS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const bound = !!(keys[p.id] && keys[p.id].hasKey);
    opt.textContent = p.name + (bound ? '（已绑定）' : '');
    if (bound && p.id !== current) opt.disabled = true;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
  sel.onchange = () => {
    const conf = state.keys[sel.value] || {};
    renderModelSelect(sel.value, conf.model || '');
    renderBaseUrl(sel.value, conf.baseUrl || '');
  };
}

function renderModelSelect(provider, currentModel) {
  const sel = document.getElementById('apikeyModel');
  const custom = document.getElementById('apikeyModelCustom');
  sel.innerHTML = '';
  (MODELS[provider] || []).forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m; opt.textContent = m;
    sel.appendChild(opt);
  });
  const optC = document.createElement('option');
  optC.value = '__custom__'; optC.textContent = '自定义…';
  sel.appendChild(optC);
  const presets = MODELS[provider] || [];
  if (currentModel && presets.indexOf(currentModel) >= 0) {
    sel.value = currentModel; custom.hidden = true; custom.value = '';
  } else if (currentModel) {
    sel.value = '__custom__'; custom.hidden = false; custom.value = currentModel;
  } else {
    sel.value = presets.length ? presets[0] : '__custom__';
    custom.hidden = presets.length > 0; custom.value = '';
  }
  sel.onchange = () => {
    custom.hidden = sel.value !== '__custom__';
    if (sel.value === '__custom__') custom.focus();
  };
}

function renderBaseUrl(provider, currentBaseUrl) {
  const row = document.getElementById('apikeyBaseUrlRow');
  const input = document.getElementById('apikeyBaseUrl');
  const auto = BASE_URLS[provider] || '';
  row.hidden = false;
  input.value = currentBaseUrl || auto;
  input.readOnly = !!auto;
  input.placeholder = auto ? '' : 'Base URL（OpenAI 兼容格式必填），如 https://api.xxx.com/v1';
  input.title = auto ? '该服务商官方端点已自动填写' : 'OpenAI 兼容格式需要填写你的 Base URL';
}

function openForm(id) {
  editingProvider = id || null;
  renderProviderSelect(state.keys, editingProvider);
  const conf = id ? (state.keys[id] || {}) : {};
  const input = document.getElementById('apikeyInput');
  // 浏览器拿不到真实 Key，已绑定的只显示掩码
  input.value = id && conf.hasKey ? MASK : '';
  input.type = 'password';
  renderModelSelect(id || 'openai', conf.model || '');
  renderBaseUrl(id || '', conf.baseUrl || '');
  document.getElementById('apikeyForm').hidden = false;
  input.focus();
}

function renderApiKeys() {
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
      if (editingProvider === id) { editingProvider = null; document.getElementById('apikeyForm').hidden = true; }
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
  renderProviderSelect(keys, editingProvider);
}

/* 进入 AI 设置子面板时：收起表单并从服务器刷新已绑定列表 */
export async function openAiPanel() {
  editingProvider = null;
  document.getElementById('apikeyForm').hidden = true;
  try {
    await refreshState();
  } catch (e) { /* 服务器不可用时保留旧状态 */ }
  syncThinkingToggle();
  renderApiKeys();
}

/* 初始化：接线思考模式开关 + API Key 表单 + 首次加载服务器数据 */
export function initAiSettings() {
  wireThinkingToggle();
  document.getElementById('apikeyAdd').addEventListener('click', () => {
    editingProvider = null;
    renderProviderSelect(state.keys, null);
    const input = document.getElementById('apikeyInput');
    input.value = '';
    input.type = 'password';
    renderModelSelect('openai', '');
    renderBaseUrl('openai', '');
    document.getElementById('apikeyForm').hidden = false;
    input.focus();
  });
  document.getElementById('apikeyToggle').addEventListener('click', () => {
    const input = document.getElementById('apikeyInput');
    input.type = (input.type === 'text') ? 'password' : 'text';
  });
  document.getElementById('apikeySave').addEventListener('click', async () => {
    const id = document.getElementById('apikeyProvider').value;
    const keyVal = document.getElementById('apikeyInput').value.trim();
    if (!keyVal) { document.getElementById('apikeyInput').focus(); return; }
    const sel = document.getElementById('apikeyModel');
    const model = (sel.value === '__custom__')
      ? document.getElementById('apikeyModelCustom').value.trim()
      : sel.value;
    const baseUrl = document.getElementById('apikeyBaseUrl').value.trim();
    if (id === 'openai-compatible' && !baseUrl) {
      document.getElementById('apikeyBaseUrl').focus();
      return;
    }
    const finalKey = (keyVal === MASK) ? MASK : keyVal;
    const keysMap = postKeysFromState();
    keysMap[id] = { key: finalKey, model, baseUrl };
    try {
      await saveSettings({ keys: keysMap, defaultProvider: state.defaultProvider, thinking: state.thinking });
      await refreshState();
    } catch (e) {
      alert('保存失败：' + e.message);
      return;
    }
    editingProvider = null;
    document.getElementById('apikeyForm').hidden = true;
    renderApiKeys();
  });
  document.getElementById('apikeyCancel').addEventListener('click', () => {
    editingProvider = null;
    document.getElementById('apikeyForm').hidden = true;
    renderApiKeys();
  });
  // 首次加载服务器数据（后台异步，成功后渲染列表）
  refreshState()
    .then(() => { syncThinkingToggle(); renderApiKeys(); })
    .catch(() => { renderApiKeys(); });
}
