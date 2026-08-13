/* ============ 设置（设置菜单 + AI 设置：API Key 绑定 + 思考模式） ============ */

import { getDefaultProvider, setDefaultProvider } from './lib/ai-config.js';

// ===== 思考模式开关（v1.1.9 补充：修复 loadThinking 未定义 / 开关未接线） =====
const THINKING_KEY = 'ieltsThinking';
function loadThinking() {
  try { return localStorage.getItem(THINKING_KEY) === '1'; } catch (e) { return false; }
}
function saveThinking(v) {
  try { localStorage.setItem(THINKING_KEY, v ? '1' : '0'); } catch (e) {}
}
(function wireThinkingToggle() {
  const toggle = document.getElementById('thinkingToggle');
  if (!toggle) return;
  toggle.checked = loadThinking();
  toggle.addEventListener('change', function () { saveThinking(toggle.checked); });
})();

    var btn = document.getElementById('settingsBtn');
    var menu = document.getElementById('settingsMenu');
    var main = document.getElementById('settingsMain');
    var ai = document.getElementById('settingsAi');
    var back = document.getElementById('settingsBack');

    function resetPanels() { main.hidden = false; ai.hidden = true; }

    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var opening = menu.hidden;
      menu.hidden = !opening;
      if (opening) resetPanels();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.settings-wrap')) { menu.hidden = true; resetPanels(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { menu.hidden = true; resetPanels(); }
    });

    // ===== API Key 绑定（手动添加方式，支持真实调用测试） =====
    var PROVIDERS = [
      { id: 'openai', name: 'OpenAI' },
      { id: 'openai-compatible', name: 'OpenAI 兼容格式' },
      { id: 'deepseek', name: 'DeepSeek' },
      { id: 'opencode', name: 'OpenCode Zen' },
      { id: 'go', name: 'OpenCode Go' }
    ];
    var MODELS = {
      openai: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1', 'gpt-4.1-mini'],
      'openai-compatible': [],
      deepseek: ['deepseek-v4-flash', 'deepseek-v4-pro'],
      opencode: ['glm-5', 'glm-5.1', 'glm-5.2', 'kimi-k2.5', 'kimi-k2.6', 'kimi-k2.7-code', 'deepseek-v4-pro', 'deepseek-v4-flash'],
      go: ['grok-4.5', 'glm-5.2', 'glm-5.1', 'kimi-k3', 'kimi-k2.7-code', 'kimi-k2.6', 'deepseek-v4-pro', 'deepseek-v4-flash', 'mimo-v2.5', 'mimo-v2.5-pro', 'hy3']
    };
    var DEFAULT_MODELS = {
      openai: 'gpt-4o-mini',
      'openai-compatible': '',
      deepseek: 'deepseek-v4-flash',
      opencode: 'glm-5',
      go: 'glm-5.2'
    };
    var BASE_URLS = {
      openai: 'https://api.openai.com/v1',
      'openai-compatible': '',
      deepseek: 'https://api.deepseek.com/v1',
      opencode: 'https://opencode.ai/zen/v1',
      go: 'https://opencode.ai/zen/go/v1'
    };
    var STORE_KEY = 'ielts_api_keys';
    var MASK = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
    var editingProvider = null;

    function loadKeys() {
      var keys = {};
      try { keys = JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); } catch (e) { keys = {}; }
      var changed = false;
      Object.keys(keys).forEach(function (id) {
        var v = keys[id];
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
      var keys = loadKeys();
      if (keyVal && keyVal !== MASK) {
        keys[id] = { key: keyVal, model: model || '', baseUrl: baseUrl || '' };
      } else {
        delete keys[id];
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(keys));
    }
    function providerName(id) {
      for (var i = 0; i < PROVIDERS.length; i++) { if (PROVIDERS[i].id === id) return PROVIDERS[i].name; }
      return id;
    }
    function renderProviderSelect(keys, current) {
      var sel = document.getElementById('apikeyProvider');
      sel.innerHTML = '';
      PROVIDERS.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        var bound = !!keys[p.id];
        opt.textContent = p.name + (bound ? '（已绑定）' : '');
        if (bound && p.id !== current) opt.disabled = true;
        sel.appendChild(opt);
      });
      if (current) sel.value = current;
      sel.onchange = function () {
        var conf = loadKeys()[sel.value] || {};
        renderModelSelect(sel.value, conf.model || '');
        renderBaseUrl(sel.value, conf.baseUrl || '');
      };
    }
    function renderModelSelect(provider, currentModel) {
      var sel = document.getElementById('apikeyModel');
      var custom = document.getElementById('apikeyModelCustom');
      sel.innerHTML = '';
      (MODELS[provider] || []).forEach(function (m) {
        var opt = document.createElement('option');
        opt.value = m; opt.textContent = m;
        sel.appendChild(opt);
      });
      var optC = document.createElement('option');
      optC.value = '__custom__'; optC.textContent = '自定义…';
      sel.appendChild(optC);
      var presets = MODELS[provider] || [];
      if (currentModel && presets.indexOf(currentModel) >= 0) {
        sel.value = currentModel; custom.hidden = true; custom.value = '';
      } else if (currentModel) {
        sel.value = '__custom__'; custom.hidden = false; custom.value = currentModel;
      } else {
        sel.value = presets.length ? presets[0] : '__custom__';
        custom.hidden = presets.length > 0; custom.value = '';
      }
      sel.onchange = function () {
        custom.hidden = sel.value !== '__custom__';
        if (sel.value === '__custom__') custom.focus();
      };
    }
    function renderBaseUrl(provider, currentBaseUrl) {
      var row = document.getElementById('apikeyBaseUrlRow');
      var input = document.getElementById('apikeyBaseUrl');
      var auto = BASE_URLS[provider] || '';
      row.hidden = false;
      input.value = currentBaseUrl || auto;
      input.readOnly = !!auto;
      input.placeholder = auto ? '' : 'Base URL（OpenAI 兼容格式必填），如 https://api.xxx.com/v1';
      input.title = auto ? '该服务商官方端点已自动填写' : 'OpenAI 兼容格式需要填写你的 Base URL';
    }
    function openForm(id) {
      editingProvider = id || null;
      var keys = loadKeys();
      renderProviderSelect(keys, editingProvider);
      var conf = id ? (keys[id] || {}) : {};
      var input = document.getElementById('apikeyInput');
      input.value = id ? (conf.key || '') : '';
      input.type = 'password';
      renderModelSelect(id || 'openai', conf.model || '');
      renderBaseUrl(id || '', conf.baseUrl || '');
      document.getElementById('apikeyForm').hidden = false;
      input.focus();
    }
    function effectiveBaseUrl(provider, stored) {
      return (stored && stored.baseUrl) ? stored.baseUrl : (BASE_URLS[provider] || '');
    }
    function renderApiKeys() {
      var keys = loadKeys();
      var bound = document.getElementById('apikeyBound');
      var empty = document.getElementById('apikeyEmpty');
      bound.innerHTML = '';
      var ids = Object.keys(keys);
      empty.hidden = ids.length > 0;
      ids.forEach(function (id) {
        var conf = keys[id] || {};
        var item = document.createElement('div');
        item.className = 'apikey-bound-item';
        var head = document.createElement('div');
        head.className = 'apikey-head';
        var name = document.createElement('span');
        name.className = 'apikey-name';
        name.textContent = providerName(id);
        var val = document.createElement('span');
        val.className = 'apikey-val';
        val.textContent = MASK;
        var status = document.createElement('span');
        status.className = 'apikey-status bound';
        status.textContent = '已绑定';
        head.appendChild(name); head.appendChild(val); head.appendChild(status);
        var isDefault = getDefaultProvider() === id;
        if (isDefault) {
          var badge = document.createElement('span');
          badge.className = 'apikey-default-badge';
          badge.textContent = '⭐ 默认';
          head.appendChild(badge);
        }

        var meta = document.createElement('div');
        meta.className = 'apikey-meta';
        var metaText = conf.model ? ('模型：' + conf.model) : '模型：未选择';
        if (conf.baseUrl) metaText += ' · Base URL：' + conf.baseUrl;
        meta.textContent = metaText;

        var ops = document.createElement('div');
        ops.className = 'apikey-row apikey-ops';
        var edit = document.createElement('button');
        edit.type = 'button'; edit.className = 'apikey-btn'; edit.textContent = '✏️';
        edit.title = '修改';
        var del = document.createElement('button');
        del.type = 'button'; del.className = 'apikey-btn apikey-del'; del.textContent = '🗑';
        del.title = '删除';
        var test = document.createElement('button');
        test.type = 'button'; test.className = 'apikey-btn apikey-test'; test.textContent = '🔌 测试连接';
        test.title = '真实调用该服务商 API 验证 Key';
        var result = document.createElement('div');
        result.className = 'apikey-test-result';
        var setDefault = document.createElement('button');
        setDefault.type = 'button';
        setDefault.className = 'apikey-btn' + (isDefault ? ' apikey-default-on' : '');
        setDefault.textContent = isDefault ? '✓ 默认' : '⭐ 设为默认';
        setDefault.title = '设为默认 API（阅读器 AI 语境翻译 / 语法分析默认使用）';
        setDefault.disabled = isDefault;
        setDefault.addEventListener('click', function () { setDefaultProvider(id); renderApiKeys(); });
        ops.appendChild(edit); ops.appendChild(del); ops.appendChild(setDefault); ops.appendChild(test);

        edit.addEventListener('click', function () { openForm(id); });
        del.addEventListener('click', function () {
          storeKey(id, '');
          if (getDefaultProvider() === id) setDefaultProvider('');
          if (editingProvider === id) { editingProvider = null; document.getElementById('apikeyForm').hidden = true; }
          renderApiKeys();
        });
        test.addEventListener('click', function () {
          var c = loadKeys()[id] || {};
          if (!c.key || !c.model) {
            result.className = 'apikey-test-result fail';
            result.textContent = '❌ 请先保存模型（OpenAI 兼容格式还需 Base URL）';
            return;
          }
          test.disabled = true;
          var orig = test.textContent;
          test.textContent = '测试中…';
          result.className = 'apikey-test-result testing';
          result.textContent = '⏳ 正在调用 ' + providerName(id) + '…';
          fetch('/api/ai_chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: id,
              apiKey: c.key,
              model: c.model,
              baseUrl: c.baseUrl || '',
              thinking: loadThinking(),
              message: '你好，请只回复四个字：连接成功'
            })
          }).then(function (r) { return r.json(); }).then(function (res) {
            test.disabled = false;
            test.textContent = orig;
            if (res.ok) {
              result.className = 'apikey-test-result ok';
              result.textContent = '✅ 连接成功：' + String(res.content || '').slice(0, 150);
            } else {
              result.className = 'apikey-test-result fail';
              var msg = String(res.error || '未知错误');
              if (res.status) msg = 'HTTP ' + res.status + ' ' + msg;
              result.textContent = '❌ 连接失败：' + msg.slice(0, 220);
            }
          }).catch(function (err) {
            test.disabled = false;
            test.textContent = orig;
            result.className = 'apikey-test-result fail';
            result.textContent = '❌ 无法连接本地服务：' + err.message;
          });
        });

        item.appendChild(head); item.appendChild(meta); item.appendChild(ops); item.appendChild(result);
        bound.appendChild(item);
      });
      renderProviderSelect(keys, editingProvider);
    }

    document.getElementById('apikeyAdd').addEventListener('click', function () {
      editingProvider = null;
      renderProviderSelect(loadKeys(), null);
      var input = document.getElementById('apikeyInput');
      input.value = '';
      input.type = 'password';
      renderModelSelect('openai', '');
      renderBaseUrl('openai', '');
      document.getElementById('apikeyForm').hidden = false;
      input.focus();
    });
    document.getElementById('apikeyToggle').addEventListener('click', function () {
      var input = document.getElementById('apikeyInput');
      input.type = (input.type === 'text') ? 'password' : 'text';
    });
    document.getElementById('apikeySave').addEventListener('click', function () {
      var id = document.getElementById('apikeyProvider').value;
      var keyVal = document.getElementById('apikeyInput').value.trim();
      if (!keyVal) { document.getElementById('apikeyInput').focus(); return; }
      var sel = document.getElementById('apikeyModel');
      var model = (sel.value === '__custom__')
        ? document.getElementById('apikeyModelCustom').value.trim()
        : sel.value;
      var baseUrl = document.getElementById('apikeyBaseUrl').value.trim();
      if (id === 'openai-compatible' && !baseUrl) {
        document.getElementById('apikeyBaseUrl').focus();
        return;
      }
      var prev = (loadKeys()[id] || {}).key || '';
      var finalKey = (keyVal === MASK) ? prev : keyVal;
      storeKey(id, finalKey, model, baseUrl);
      editingProvider = null;
      document.getElementById('apikeyForm').hidden = true;
      renderApiKeys();
    });
    document.getElementById('apikeyCancel').addEventListener('click', function () {
      editingProvider = null;
      document.getElementById('apikeyForm').hidden = true;
      renderApiKeys();
    });

    back.addEventListener('click', function () { resetPanels(); });
    document.querySelector('[data-panel="ai"]').addEventListener('click', function () {
      main.hidden = true; ai.hidden = false;
      document.getElementById('apikeyForm').hidden = true;
      editingProvider = null;
      renderApiKeys();
    });
  
