/* ============ 搜索框输入联想下拉（搜索引擎式，v1.1.65） ============
 * 用法：initSuggestBox(input, { fetch, onPick })
 *   - input : <input> 搜索框元素
 *   - fetch : async (query) => [{entry, explain}, ...]  联想数据源（调用方注入，保持本模块无业务依赖）
 *   - onPick: (word) => void                             点击/回车选中条目后的回调（如跳转查询页）
 * 行为：输入英文字符 180ms 防抖后拉取联想（最多 8 条，显示单词 + 简短中文释义）；
 *      含中文字符时不显示联想（中文走中→英查询）；↑/↓ 选择、Enter 确认、Esc / 点击外部关闭。
 */
export function initSuggestBox(input, { fetch, onPick }) {
  if (!input || typeof fetch !== 'function') return;
  input.setAttribute('autocomplete', 'off');
  let timer = null;
  let items = [];   // 当前下拉的单词列表
  let cur = -1;     // 当前高亮下标
  let active = null; // 下拉容器元素

  function close() {
    if (active) { active.remove(); active = null; }
    items = []; cur = -1;
  }

  function move(dir) {
    if (!active || !items.length) return;
    cur = (cur + dir + items.length) % items.length;
    active.querySelectorAll('.suggest-item').forEach((el, i) => {
      el.classList.toggle('active', i === cur);
      if (i === cur) el.scrollIntoView({ block: 'nearest' });
    });
  }

  async function buildDropdown(list) {
    close();
    const box = document.createElement('div');
    box.className = 'suggest-dropdown';
    list.forEach((s, i) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'suggest-item';
      const w = document.createElement('span');
      w.className = 'suggest-item-word';
      w.textContent = s.entry;
      const zh = document.createElement('span');
      zh.className = 'suggest-item-zh';
      zh.textContent = (s.explain || '').length > 24 ? s.explain.slice(0, 24) + '…' : (s.explain || '');
      item.appendChild(w);
      item.appendChild(zh);
      item.addEventListener('click', () => {
        const word = s.entry;
        close();
        onPick(word);
      });
      box.appendChild(item);
    });
    // 定位：基于输入框父容器（absolute 脱离 flex 流，宽同整条搜索栏）
    const parent = input.parentElement;
    if (parent) {
      parent.style.position = 'relative';
      box.style.position = 'absolute';
      box.style.top = '100%';
      box.style.left = '0';
      box.style.right = '0';
      box.style.zIndex = '100';
      parent.appendChild(box);
    } else {
      const r = input.getBoundingClientRect();
      box.style.position = 'absolute';
      box.style.top = (r.bottom + window.scrollY) + 'px';
      box.style.left = (r.left + window.scrollX) + 'px';
      box.style.width = r.width + 'px';
      document.body.appendChild(box);
    }
    active = box;
    items = list.map(s => s.entry);
    cur = -1;
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    const v = input.value.trim();
    // 含中文：不显示英文联想（中文走中→英查询）
    if (!v || /[\u4e00-\u9fff]/.test(v)) { close(); return; }
    timer = setTimeout(async () => {
      if (input.value.trim() !== v) return; // 输入已变化，丢弃过期结果
      const entries = await fetch(v);
      if (!Array.isArray(entries) || !entries.length) { close(); return; }
      buildDropdown(entries.slice(0, 8));
    }, 180);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { close(); return; }
    if (!active || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const word = cur >= 0 ? items[cur] : input.value.trim();
      close();
      if (word) onPick(word);
    }
  });

  document.addEventListener('click', (e) => {
    if (active && !active.contains(e.target) && e.target !== input) close();
  });
}
