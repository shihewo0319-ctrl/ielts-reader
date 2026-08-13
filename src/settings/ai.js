/* ============ AI 设置：思考模式 + API Key 绑定 + 测试连接 ============
 * 面板 HTML 由 src/settings/menu.js 的模板渲染，本模块负责全部业务：
 *   - 思考模式开关（localStorage: ieltsThinking）
 *   - API Key 绑定 / 修改 / 删除 / 设为默认（localStorage: ielts_api_keys）
 *   - 「测试连接」真实调用本地 /api/ai_chat 验证 Key
 */
import { getDefaultProvider, setDefaultProvider } from '../lib/ai-config.js';
import { PROVIDERS, MODELS, DEFAULT_MODELS, BASE_URLS, providerName } from '../lib/providers.js';
import { bindTestButton } from './ai-test.js';

const THINKING_KEY = 'ieltsThinking';
const STORE_KEY = 'ielts_api_keys';
const MASK = '••••••••';
let editingProvider = null;

/* ===== 思考模式开关 ===== */
function loadThinking() {
  try { return localStorage.getItem(THINKING_KEY) === '1'; } catch (e) { return false; }
}
function saveThinking(v) {
  try { localStorage.setItem(THINKING_KEY, v ? '1' : '0'); } catch (e) {}
}
function wireThinkingToggle() {
  const toggle = document.getElementById('thinkingToggle');
  if (!toggle) return;
  toggle.checked = loadThinking();
  toggle.addEventListener('change', () => saveThinking(toggle.checked));
}

/* ===== API Key 存取（含旧数据迁移） ===== */
function loadKeys() {
  let keys = {};
  try { keys = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { keys = {}; }
  let changed = false;
  Object.keys(keys).forEach((id) => {
    const v = keys[id];
    if (typeof v === 'string') {
      keys[id] = { key: v, model: DEFAULT_MODELS[id] || '', baseUrl: '' };
      changed = true;
    } else if (!v || typeof v !== 'object') {
      delete keys[id];
      changed = true;
    }
  });
  // 旧 DeepSeek 模型名迁移：deepseek-chat / deepseek-reasoner 已于 2026-07-24 停用
  if (keys.deepseek && keys.deepseek.model === 'deepseek-chat') {
    keys.deepseek.model = 'deepseek-v4-flash';
    changed = true;
  } else if (keys.deepseek && keys.deepseek.model === 'deepseek-reasoner') {
    keys.deepseek.model = 'deepseek-v4-flash';
    changed = true;
  }
  if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(keys));
  return keys;
}
function storeKey(id, keyVal, model, baseUrl) {
  const keys = loadKeys();
  if (keyVal && keyVal !== MASK) {
    keys[id] = { key: keyVal, model: model || '', baseUrl: baseUrl || '' };
  } else {
    delete keys[id];
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(keys));
}

/* ===== 表单渲染 ===== */
function renderProviderSelect(keys, current) {
  const sel = document.getElementById('apikeyProvider');
  sel.innerHTML = '';
  PROVIDERS.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    const bound = !!keys[p.id];
    opt.textContent = p.name + (bound ? '（已绑定）' : '');
    if (bound && p.id !== current) opt.disabled = true;
    sel.appendChild(opt);
  });
  if (current) sel.value = current;
  sel.onchange = () => {
    const conf = loadKeys()[sel.value] || {};
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
  const keys = loadKeys();
  renderProviderSelect(keys, editingProvider);
  const conf = id ? (keys[id] || {}) : {};
  const input = document.getElementById('apikeyInput');
  input.value = id ? (conf.key || '') : '';
  input.type = 'password';
  renderModelSelect(id || 'openai', conf.model || '');
  renderBaseUrl(id || '', conf.baseUrl || '');
  document.getElementById('apikeyForm').hidden = false;
  input.focus();
}

function renderApiKeys() {
  const keys = loadKeys();
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
    if (getDefaultProvider() === id) {
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
    setDefault.className = 'apikey-btn' + (getDefaultProvider() === id ? ' apikey-default-on' : '');
    setDefault.textContent = getDefaultProvider() === id ? '✓ 默认' : '⭐ 设为默认';
    setDefault.title = '设为默认 API（阅读器 AI 语境翻译 / 语法分析默认使用）';
    setDefault.disabled = getDefaultProvider() === id;
    setDefault.addEventListener('click', () => {
      setDefaultProvider(id);
      renderApiKeys();
    });
    const test = document.createElement('button');
    test.type = 'button'; test.className = 'apikey-btn apikey-test'; test.textContent = '🔌 测试连接';
    test.title = '真实调用该服务商 API 验证 Key';
    const result = document.createElement('div');
    result.className = 'apikey-test-result';
    ops.appendChild(edit); ops.appendChild(del); ops.appendChild(setDefault); ops.appendChild(test);

    edit.addEventListener('click', () => openForm(id));
    del.addEventListener('click', () => {
      storeKey(id, '');
      if (getDefaultProvider() === id) setDefaultProvider('');
      if (editingProvider === id) { editingProvider = null; document.getElementById('apikeyForm').hidden = true; }
      renderApiKeys();
    });
    bindTestButton({
      test,
      result,
      getConfig: () => {
        const conf = loadKeys()[id] || {};
        return { id, key: conf.key || '', model: conf.model || '', baseUrl: conf.baseUrl || '' };
      },
      getThinking: () => loadThinking(),
    });

    item.appendChild(head); item.appendChild(meta); item.appendChild(ops); item.appendChild(result);
    bound.appendChild(item);
  });
  renderProviderSelect(keys, editingProvider);
}

/* 进入 AI 设置子面板时：收起表单并刷新已绑定列表 */
export function openAiPanel() {
  editingProvider = null;
  document.getElementById('apikeyForm').hidden = true;
  renderApiKeys();
}

/* 初始化：接线思考模式开关 + API Key 表单 */
export function initAiSettings() {
  wireThinkingToggle();
  document.getElementById('apikeyAdd').addEventListener('click', () => {
    editingProvider = null;
    renderProviderSelect(loadKeys(), null);
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
  document.getElementById('apikeySave').addEventListener('click', () => {
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
    const prev = (loadKeys()[id] || {}).key || '';
    const finalKey = (keyVal === MASK) ? prev : keyVal;
    storeKey(id, finalKey, model, baseUrl);
    editingProvider = null;
    document.getElementById('apikeyForm').hidden = true;
    renderApiKeys();
  });
  document.getElementById('apikeyCancel').addEventListener('click', () => {
    editingProvider = null;
    document.getElementById('apikeyForm').hidden = true;
    renderApiKeys();
  });
}
