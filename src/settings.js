/* ============ 设置入口 ============
 * 主页右上角「⚙️ 设置」菜单。
 * 职责：把菜单 HTML 渲染进挂载点，并装配两个子模块：
 *   - src/settings/menu.js  菜单开关 / 面板切换（含 HTML 模板）
 *   - src/settings/ai.js    AI 设置：API Key 绑定 / 思考模式 / 测试连接
 * 主页引入本文件即可（见 src/home.js）。
 *
 * 说明：装配前先 await initAiConfig()——它负责预加载服务器 AI 设置，
 * 并把 v1.1.40 之前存在 localStorage 里的旧 API Key 一次性迁移到服务器
 * （迁移只跑一次，成功后才清除本地）。之前迁移只在阅读器页面触发，
 * 导致只打开主页/设置面板的用户看不到已绑定 Key，这里补齐入口。
 */
import { SETTINGS_MENU_HTML, initSettingsMenu } from './settings/menu.js';
import { initAiSettings, openAiPanel } from './settings/ai.js';
import { initAiConfig } from './lib/ai-config.js';

const root = document.getElementById('settings-menu-root');
if (root) {
  // 先预加载 / 迁移（失败不阻塞），再装配设置面板，确保打开时列表已含恢复的 Key
  initAiConfig().catch(() => {}).finally(() => {
    root.innerHTML = SETTINGS_MENU_HTML;
    initSettingsMenu({ onAiPanelOpen: openAiPanel });
    initAiSettings();
  });
}
