/* ============ 全站冒烟测试 ============
 * 覆盖最核心的链路：页面可加载、版本单一来源、阅读器「粘贴→点词→弹窗」。
 * 外网词典/AI 接口用 route 拦截 mock，保证测试离线可跑、结果稳定。
 * 运行：npm test
 */
import { test, expect } from '@playwright/test';

// 词典查询 mock：/api/ 开头的代理请求返回一份最小词典数据
const DICT_ENTRY = {
  word: 'garden',
  phonetics: [{ text: '/ˈɡɑː.dən/', accent: '英' }],
  meanings: [{ pos: 'n.', def: '花园；庭院' }],
  examples: [{ en: 'The garden is full of roses.', zh: '花园里开满了玫瑰。' }],
};

test.beforeEach(async ({ page }) => {
  // 拦截所有 /api/ 代理请求（词典/联想/AI），按路径返回最小数据
  await page.route('**/api/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/suggest')) {
      return route.fulfill({ json: { ok: true, entries: [{ entry: 'garden', explain: 'n. 花园' }] } });
    }
    if (url.includes('/api/words') || url.includes('/api/lookups') || url.includes('/api/articles')) {
      return route.fulfill({ json: { ok: true, items: [], entries: [], list: [] } });
    }
    if (url.includes('/api/ai_chat')) {
      return route.fulfill({ json: { ok: true, content: 'ok' } });
    }
    // 单词查询类（词典代理）
    return route.fulfill({ json: { ok: true, entries: [DICT_ENTRY], entry: DICT_ENTRY } });
  });
});

test('首页：核心入口齐全，版本胶囊来自单一来源', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.home-hero h2')).toBeVisible();
  await expect(page.locator('.feature-card')).toHaveCount(4);
  await expect(page.locator('.dict-search-input')).toBeVisible();
  // 版本号由 lib/version.js 填充
  await expect(page.locator('.version')).toHaveText(/^v\d+\.\d+\.\d+$/);
  // 名言区渲染
  await expect(page.locator('.quote-en')).toContainText('“');
});

test('阅读器：粘贴文章 → 单词可点 → 词典弹窗打开', async ({ page }) => {
  await page.goto('/reader.html');
  await page.fill('#paste-text', 'The garden is full of roses.');
  await page.click('#btn-paste');
  await expect(page.locator('#article-panel')).toBeVisible();
  const wordCount = await page.locator('.word').count();
  expect(wordCount).toBeGreaterThan(3);

  // 点击 garden 触发词典弹窗（外网已 mock）
  await page.locator('.word', { hasText: 'garden' }).first().click();
  const popup = page.locator('#popup');
  await expect(popup).toBeVisible();
  await expect(popup.locator('.popup-word-text')).toContainText(/garden/i, { timeout: 8000 });
});

test('生词本/我的文章/查词/语法页可加载，导航与空态正常', async ({ page }) => {
  for (const p of ['wordbook', 'library', 'dict', 'grammar']) {
    await page.goto(`/${p}.html`);
    await expect(page.locator('.topbar h1')).toBeVisible();
    // 非首页应渲染顶栏导航按钮（nav.js 模块引入）
    const navBtns = await page.locator('.topbar-nav-btn').count();
    expect(navBtns).toBeGreaterThan(0);
  }
  // 生词本标签页切换
  await page.goto('/wordbook.html');
  await expect(page.locator('.wb-tabs')).toBeVisible();
  await page.click('.wb-tab[data-tab="lookups"]');
  await expect(page.locator('#tab-lookups')).toBeVisible();
  await expect(page.locator('#tab-words')).toBeHidden();
});

test('黏土设计系统令牌生效（全站视觉基线）', async ({ page }) => {
  await page.goto('/index.html');
  const card = page.locator('.feature-card').first();
  await expect(card).toBeVisible();
  await expect(card).toHaveCSS('border-radius', '26px');
  await expect(card).toHaveCSS('border-top-width', '0px');
  const shadow = await card.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).toContain('inset'); // 蓬润浮雕（内高光）
});
