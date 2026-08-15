// Playwright 配置：冒烟测试
// 运行：npm test（自动拉起本地服务器，无需手动启动）
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:8123',
    headless: true,
    viewport: { width: 1280, height: 900 },
    // 外网词典/AI 请求在测试环境不可靠，统一拦截（见 tests/smoke.spec.js）
  },
  webServer: {
    command: 'python3 server.py 8123',
    port: 8123,
    reuseExistingServer: true,
    timeout: 15000,
  },
});
