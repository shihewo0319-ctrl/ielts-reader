/* ============ 设置入口 ============
 * 主页右上角「⚙️ 设置」菜单。
 * 职责：把菜单 HTML 渲染进挂载点，并装配两个子模块：
 *   - src/settings/menu.js  菜单开关 / 面板切换（含 HTML 模板）
 *   - src/settings/ai.js    AI 设置：API Key 绑定 / 思考模式 / 测试连接
 * 主页引入本文件即可（见 src/home.js）。
 */
import { SETTINGS_MENU_HTML, initSettingsMenu } from './settings/menu.js';
import { initAiSettings, openAiPanel } from './settings/ai.js';

const root = document.getElementById('settings-menu-root');
if (root) {
  root.innerHTML = SETTINGS_MENU_HTML;
  initSettingsMenu({ onAiPanelOpen: openAiPanel });
  initAiSettings();
}
