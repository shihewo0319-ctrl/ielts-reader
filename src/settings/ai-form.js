/* ============ AI 设置：API Key 表单渲染 ============
 * 只负责「添加 / 编辑 API Key」表单：服务商下拉、模型下拉、Base URL、掩码回填。
 * 状态与服务器保存逻辑在 ai-state.js / ai.js，本模块不直接读写服务器。
 */
import { PROVIDERS, MODELS, BASE_URLS } from '../lib/providers.js';
import { MASK } from '../lib/db-settings.js';
import { state, getEditingProvider, setEditingProvider } from './ai-state.js';

export function renderProviderSelect(keys, current) {
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

export function renderModelSelect(provider, currentModel) {
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

export function renderBaseUrl(provider, currentBaseUrl) {
  const row = document.getElementById('apikeyBaseUrlRow');
  const input = document.getElementById('apikeyBaseUrl');
  const auto = BASE_URLS[provider] || '';
  row.hidden = false;
  input.value = currentBaseUrl || auto;
  input.readOnly = !!auto;
  input.placeholder = auto ? '' : 'Base URL（OpenAI 兼容格式必填），如 https://api.xxx.com/v1';
  input.title = auto ? '该服务商官方端点已自动填写' : 'OpenAI 兼容格式需要填写你的 Base URL';
}

// 打开表单（id 为空 = 新增模式）
export function openForm(id) {
  setEditingProvider(id || null);
  renderProviderSelect(state.keys, getEditingProvider());
  const conf = id ? (state.keys[id] || {}) : {};
  const input = document.getElementById('apikeyInput');
  // 浏览器拿不到真实 Key，已绑定的只显示掩码
  input.value = id && conf.hasKey ? MASK : '';
  input.type = 'password';
  // 新增模式（id 为空）默认选第一个服务商 openai，Base URL 也自动填 openai 官方端点
  renderModelSelect(id || 'openai', conf.model || '');
  renderBaseUrl(id || 'openai', conf.baseUrl || '');
  document.getElementById('apikeyForm').hidden = false;
  input.focus();
}

export function closeForm() {
  setEditingProvider(null);
  document.getElementById('apikeyForm').hidden = true;
}

// 读取表单当前值（供 ai.js 保存时使用）
export function readFormValues() {
  const id = document.getElementById('apikeyProvider').value;
  const keyVal = document.getElementById('apikeyInput').value.trim();
  const sel = document.getElementById('apikeyModel');
  const model = (sel.value === '__custom__')
    ? document.getElementById('apikeyModelCustom').value.trim()
    : sel.value;
  const baseUrl = document.getElementById('apikeyBaseUrl').value.trim();
  const finalKey = (keyVal === MASK) ? MASK : keyVal;
  return { id, keyVal, model, baseUrl, finalKey };
}
