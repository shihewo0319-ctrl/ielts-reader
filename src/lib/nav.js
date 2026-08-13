/* ============ 顶部导航（所有页面共享） ============
 * 在顶栏渲染除当前页外的其他页面跳转按钮。
 * 使用：在 HTML 顶栏加 <nav id="top-nav" class="topbar-nav"></nav>
 * 并引入本模块，自动填充按钮。
 */
const NAV_PAGES = [
  { id: 'index', label: '🏠 首页', href: 'index.html' },
  { id: 'reader', label: '📖 阅读器', href: 'reader.html' },
  { id: 'library', label: '📚 我的文章', href: 'library.html' },
  { id: 'wordbook', label: '📒 生词本', href: 'wordbook.html' },
  { id: 'dict', label: '🔍 单词查询', href: 'dict.html' },
];

function currentPage() {
  const name = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  for (const p of NAV_PAGES) {
    if (name === p.href) return p.id;
  }
  return null; // 未知页面名时不过滤，全部显示
}

function initTopNav() {
  const nav = document.getElementById('top-nav');
  if (!nav) return;
  const cur = currentPage();
  for (const p of NAV_PAGES) {
    if (p.id === cur) continue; // 当前页不显示自己的按钮
    const a = document.createElement('a');
    a.className = 'topbar-nav-btn';
    a.href = p.href;
    a.textContent = p.label;
    nav.appendChild(a);
  }
}

initTopNav();
