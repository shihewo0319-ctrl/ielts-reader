/* ============ 顶部导航（除首页外的页面共享） ============
 * 在顶栏渲染除当前页外的其他页面跳转按钮。
 * 规则：首页不显示导航（已有卡片 / 搜索框入口）；
 *       其他页面不显示「首页」按钮（左上角标题即可返回首页）。
 * 使用：在 HTML 顶栏加 <nav id="top-nav" class="topbar-nav"></nav>
 *       并引入本模块，自动填充按钮。
 */
const NAV_PAGES = [
  { id: 'index', label: '🏠 首页', href: 'index.html' },
  { id: 'reader', label: '📖 阅读器', href: 'reader.html' },
  { id: 'library', label: '📚 我的文章', href: 'library.html' },
  { id: 'wordbook', label: '📒 生词本', href: 'wordbook.html' },
  { id: 'grammar', label: '🧩 语法分析', href: 'grammar.html' },
  { id: 'vocab', label: '🎯 背单词', href: 'vocab.html' },
  { id: 'dict', label: '🔍 单词查询', href: 'dict.html' },
];

function currentPage() {
  let name = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  if (name === 'vocab-bank.html') name = 'vocab.html'; // 词库总览归属背单词导航
  for (const p of NAV_PAGES) {
    if (name === p.href) return p.id;
  }
  return null;
}

function initTopNav() {
  const nav = document.getElementById('top-nav');
  if (!nav) return;
  const cur = currentPage();
  if (cur === 'index') return; // 首页不显示导航
  for (const p of NAV_PAGES) {
    if (p.id === 'index') continue; // 不显示首页按钮，左上角标题即可返回
    if (p.id === cur) continue; // 当前页不显示自己的按钮
    const a = document.createElement('a');
    a.className = 'topbar-nav-btn';
    a.href = p.href;
    a.textContent = p.label;
    nav.appendChild(a);
  }
}

initTopNav();
