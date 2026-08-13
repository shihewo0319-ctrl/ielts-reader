/* ============ 设置菜单：HTML 模板 + 开关 / 面板切换 ============
 * 设置菜单的整块 HTML 由 JS 模板渲染（不再写死在 index.html），
 * 菜单只负责：打开/关闭、主面板与子面板切换、点外部/Esc 关闭。
 * AI 设置子面板的业务（API Key / 思考模式）在 ./ai.js，通过 onAiPanelOpen 钩子联动。
 */
export const SETTINGS_MENU_HTML = `
<div class="settings-wrap">
  <button class="settings-btn" id="settingsBtn" title="设置" aria-label="设置">⚙️</button>
  <div class="settings-menu" id="settingsMenu" hidden>
    <div class="settings-panel" id="settingsMain">
      <div class="settings-title">设置</div>
      <button class="settings-item" data-panel="ai">AI 设置 <span class="arrow">→</span></button>
      <div class="settings-more">更多子菜单即将上线…</div>
    </div>
    <div class="settings-panel" id="settingsAi" hidden>
      <div class="settings-title">
        <button class="settings-back" id="settingsBack" title="返回设置">←</button>
        AI 设置
      </div>
      <div class="settings-body">
        <div class="settings-section">思考模式</div>
        <label class="think-row" title="DeepSeek 思考模式开关">
          <input type="checkbox" id="thinkingToggle" class="think-checkbox">
          <span class="think-switch" aria-hidden="true"></span>
          <span class="think-text">对 DeepSeek 模型启用思考模式</span>
        </label>
        <p class="settings-hint">默认关闭（响应快）。开启后 DeepSeek V4（flash / pro）会先推理再回答，更准确但更慢、更耗 token。仅 DeepSeek 生效，其它服务商不受影响。</p>
        <div class="settings-section">API Key 绑定</div>
        <p class="settings-hint">点击「添加 API KEY」，选择服务商、模型并填写密钥（已知服务商的 Base URL 会自动填写）。绑定后可用「测试连接」真实调用该服务商验证 Key。密钥加密保存在服务器数据库（浏览器拿不到明文），绑定一次、手机/平板等所有设备通用。绑定多个 API 时，可在列表中把某个设为「⭐ 默认」，阅读器的 AI 语境翻译 / 语法分析会默认调用它。</p>
        <div class="apikey-bound" id="apikeyBound"></div>
        <div class="apikey-empty" id="apikeyEmpty" hidden>尚未绑定任何 API Key</div>
        <button class="apikey-btn apikey-add" id="apikeyAdd" type="button">＋ 添加 API KEY</button>
        <div class="apikey-form" id="apikeyForm" hidden>
          <select class="apikey-select" id="apikeyProvider"></select>
          <div class="apikey-row">
            <input type="password" class="apikey-input" id="apikeyInput" placeholder="填入 API Key">
            <button class="apikey-btn apikey-toggle" id="apikeyToggle" type="button" title="显示/隐藏">👁</button>
          </div>
          <div class="apikey-row" id="apikeyModelRow">
            <select class="apikey-select apikey-model-select" id="apikeyModel" title="选择模型"></select>
            <input type="text" class="apikey-input" id="apikeyModelCustom" placeholder="输入模型名，如 gpt-4o-mini" hidden>
          </div>
          <div class="apikey-row" id="apikeyBaseUrlRow" hidden>
            <input type="text" class="apikey-input" id="apikeyBaseUrl" placeholder="Base URL（OpenAI 兼容格式必填），如 https://api.xxx.com/v1" autocomplete="off">
          </div>
          <div class="apikey-row apikey-form-btns">
            <button class="apikey-btn apikey-save" id="apikeySave" type="button">保存</button>
            <button class="apikey-btn apikey-cancel" id="apikeyCancel" type="button">取消</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
`;

// 初始化设置菜单：开关、主面板/子面板切换、点外部与 Esc 关闭
export function initSettingsMenu({ onAiPanelOpen } = {}) {
  const btn = document.getElementById('settingsBtn');
  const menu = document.getElementById('settingsMenu');
  const main = document.getElementById('settingsMain');
  const ai = document.getElementById('settingsAi');
  const back = document.getElementById('settingsBack');
  if (!btn || !menu || !main || !ai || !back) return;

  function resetPanels() { main.hidden = false; ai.hidden = true; }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = menu.hidden;
    menu.hidden = !opening;
    if (opening) resetPanels();
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.settings-wrap')) { menu.hidden = true; resetPanels(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { menu.hidden = true; resetPanels(); }
  });

  back.addEventListener('click', () => resetPanels());
  document.querySelector('[data-panel="ai"]')?.addEventListener('click', () => {
    main.hidden = true; ai.hidden = false;
    if (onAiPanelOpen) onAiPanelOpen();
  });
}
