# IELTS 学习台（ielts-reader）

雅思阅读学习工具：上传阅读文章，点击任意单词即可查看**英文释义、音标、中文释义、双语例句**，支持选中词组查询、英/美音发音；内置 **SQLite 数据库**，支持「我的文章」「生词本 / 学习记录」的保存与跨设备同步；**AI API Key 加密保存在服务器数据库**，绑定一次、所有设备通用。

## 快速开始

```bash
python3 server.py          # 默认端口 8123
# 打开 http://localhost:8123
```

零依赖即可运行：前端使用原生 ES Modules，由本地 Python 服务器直接提供静态文件。

### 本地数据库（SQLite）

- 数据文件：`data/ielts.db`（首次启动 `server.py` 自动建表；`data/` 已加入 `.gitignore`，不进入版本库）
- 四张表：`articles` 文章库（同标题保存自动覆盖）、`words` 生词本（同词覆盖句子/备注）、`lookups` 学习记录（查词自动记录，v1.1.43 起带 `article_id` 关联文章）、`settings` 设置（加密后的 AI API Key / 默认服务商 / 思考模式）
- 建表/升级走 `PRAGMA user_version` 逐级迁移（`db.py` 的 `MIGRATIONS`，幂等），老数据库启动时自动升级，无需手动操作
- 页面入口：主页「📚 我的文章」→ `library.html`；「📒 生词本」→ `wordbook.html`；阅读器「💾 保存文章」「⭐ 加入生词本」
- 数据保存在**运行服务器的那台电脑**上；手机等设备通过 Tailscale 访问同一服务器即实现跨设备同步
- 备份：直接复制 `data/ielts.db` 即可（如需彻底备份可先停服务或用 `sqlite3 .backup`）

### IPv6 公网访问

- server.py 默认 **IPv6 双栈绑定**（`::`），IPv4 / IPv6 同时可访问，启动时会自动打印公网 IPv6 地址
- 外网设备访问格式：`http://[公网IPv6地址]:8123`（IPv6 地址需要方括号包裹）
- 自定义绑定地址：`python3 server.py 8123 --host <地址>`
- 注意：公网 IPv6 地址会随运营商分配变化；路由器/运营商若拦截入站需放行；外网访问属公网暴露，建议后续加访问鉴权

### 外部访问方式（当前）

- **当前实际使用：Tailscale 内网穿透**（已配置好，无视光猫/路由器 NAT）：手机装 Tailscale App 登录同一账号后，直接访问 `http://100.118.65.125:8123`
- IPv6 直连代码已保留（v1.1.36 起），网络环境支持后可直接使用公网 IPv6 访问

## 可选：前端工程化（Vite）

已内置 Vite 多页配置，需要热更新 / 构建时使用：

```bash
npm install        # 安装依赖（首次）
npm run dev        # 开发：http://localhost:5173（热更新）
npm run build      # 生产构建 → dist/
python3 server.py 8123 --prod   # 部署：服务 dist/ 构建产物
```

## 项目结构

```
ielts-reader/
├── index.html            # 主页（Vite 入口 1）
├── reader.html           # 阅读器（Vite 入口 2）
├── library.html          # 我的文章（Vite 入口 3）
├── wordbook.html         # 生词本 / 学习记录（Vite 入口 4）
├── server.py             # ★ 本地服务器（路由分发层，143 行）：静态文件 + 代理/数据库路由表分发
├── api_db.py             # ★ 数据库 API 路由（127 行）：/api/articles /api/words /api/lookups /api/settings 解析，SQL 全在 db.py
├── db.py                 # ★ SQLite 数据层（207 行）：建表 + PRAGMA user_version 迁移机制 + 四张表 CRUD
├── settings_store.py     # AI 设置存储：API Key 加密入库 / 读取 / 凭证获取（128 行）
├── proxy.py              # 外部 API 代理：有道词典（中文/音标/例句）+ OpenAI 兼容 AI chat（172 行）
├── providers.py          # 后端服务商端点表（与 src/lib/providers.js 保持一致）
├── config.py             # 全局配置：端口 / 目录 / 超时（28 行）
├── secure.py             # API Key 加密（Fernet，主密钥 data/.secrets.key，权限 600）
├── data/                 # 本地数据库目录（gitignore，不进入版本库）
├── src/
│   ├── home.js           # 主页入口（卡片跳转逻辑 + 名言渲染）
│   ├── settings.js       # 设置入口：渲染菜单 HTML 并装配子模块
│   ├── settings/
│   │   ├── menu.js       # 设置菜单 HTML 模板 + 开关 / 面板切换
│   │   ├── ai.js         # AI 设置编排（77 行）：思考模式 + 表单/列表装配
│   │   ├── ai-state.js   # AI 设置共享状态（state / refreshState / 掩码提交，无 DOM）
│   │   ├── ai-form.js    # API Key 表单渲染（服务商/模型/Base URL 下拉）
│   │   ├── ai-list.js    # 已绑定 API Key 列表（编辑/删除/设默认/测试接线）
│   │   └── ai-test.js    # 「测试连接」按钮（真实调用 /api/ai_chat 验证 Key）
│   ├── reader.js         # 阅读器入口：组装各模块并初始化
│   ├── reader/
│   │   ├── article.js    # 文章加载 / 渲染 / 分词 / 文件上传
│   │   ├── dict.js       # 词典查询（多源 + 中文 + 例句 + 释义 HTML）
│   │   ├── popup.js      # 释义弹窗：显示 / 定位 / 点击查词 / 词组查询 / AI 标签页
│   │   ├── grammar.js    # 语法分析渲染（Enpuz 式词块 / 图例 / 单词高亮）
│   │   ├── tts.js        # 单词发音 / 音标
│   │   └── sample.js     # 示例文章
│   ├── library.js        # 我的文章页（列表 / 阅读 / 删除）
│   ├── wordbook.js       # 生词本 / 学习记录页
│   ├── lib/
│   │   ├── dom.js        # 通用 DOM / 字符串工具
│   │   ├── api.js        # 统一请求封装：fetchJson / postJson / deleteJson（超时 + 业务错误）
│   │   ├── db-api.js     # 数据库 API 封装（文章库 / 生词本 / 学习记录）
│   │   ├── db-settings.js# AI 设置 API 封装（/api/settings，密钥只存服务器）
│   │   ├── ai-config.js  # AI 调用配置：默认服务商 / 读取已绑定 Key（异步，读服务器）
│   │   └── providers.js  # AI 服务商 / 模型 / Base URL 数据表
│   └── styles/
│       ├── theme.css     # 变量 + 通用（顶部栏 / 按钮 / 面板）
│       ├── home.css      # 主页 + 设置菜单 + API Key
│       ├── reader.css    # 阅读器 + 弹窗 + 音标
│       ├── library.css   # 我的文章页
│       └── wordbook.css  # 生词本 / 学习记录页
├── package.json          # Vite 工程化配置（可选）
└── vite.config.js
```

## 新增功能怎么加

- **新功能模块**：在 `src/` 下建独立目录/文件，从 `src/reader.js` 或 `src/home.js` 入口引入（设置相关拆进 `src/settings/` 对应子模块，不要往 `settings/menu.js` / `settings/ai.js` 里堆无关逻辑），主页卡片加在 `index.html` 的 `.home-grid` 里。
- **新 API 代理**：外部接口（有道 / AI）的逻辑写到 `proxy.py`（每个函数返回 dict payload），然后在 `server.py` 的 `PROXY_GET` / `PROXY_POST` 路由表里加一行前缀映射（server.py 只做分发，不写业务逻辑）。
- **新数据库接口**：数据表/读写逻辑加到 `db.py`（含迁移：新表/新列在 `MIGRATIONS` 里加一条 `SCHEMA_Vn`，不要改已发布的 schema），路由解析加到 `api_db.py`（`handle_get/post/delete`）；涉及加密（如 Key）用 `secure.py` + `settings_store.py`。
- **版本**：每次改动在 `VERSION.md` 升版本（功能更新同步更新日志）。

## API Key 说明

- **加密存储在服务器数据库**（`data/ielts.db` 的 `settings` 表，密文），主密钥在 `data/.secrets.key`（权限 600、自动生成、gitignore）。浏览器拿不到明文 Key，编辑时只显示掩码，保存掩码即保留原 Key。
- 绑定一次，手机 / 平板等所有设备通用（阅读器的 AI 语境翻译 / 语法分析调用时由服务器从数据库读取 Key，前端不传 Key）。
- 「测试连接」通过本地服务器 `server.py` 真实调用所选服务商，避免浏览器跨域限制。
- 备份：`data/` 目录里 `ielts.db` 与 `.secrets.key` 要**一起备份**，否则重启/迁移后无法解密已绑定的 Key。

## 模块化约定（所有改动必须遵守）

> 目标是：项目变大后依然容易维护、定位问题快。**每个新改动先想好放哪个模块，不要往现有文件里堆。**

1. **一个职责一个文件**：每个文件只做一件事。新功能建新文件（如 `src/reader/xxx.js`），不要塞进 `popup.js` / `dict.js` 等已有文件里。
2. **页面入口只组装**：`src/reader.js` / `src/home.js` 只负责引入模块并初始化，不写业务逻辑。
3. **通用工具放 `src/lib/`**：被多个模块复用的函数（DOM 操作、请求封装、配置读取）放 `src/lib/`，并加一行职责注释。
4. **数据与 UI 分离**：逻辑（词典/AI/发音调用）在独立模块里，UI 组装在弹窗/页面模块里，通过 import 连接。
5. **行数红线**：单文件超过约 300 行时，主动拆分。当前最大文件 `src/reader/popup.js`（约 262 行）、`db.py`（207 行）、`proxy.py`（172 行），全部低于红线。
6. **样式按页面分文件**：`src/styles/theme.css`（通用）/ `home.css`（主页）/ `reader.css`（阅读器），新增页面样式新建对应 css。
7. **新功能检查清单**：建独立模块 ✓ → 入口引入 ✓ → 主页加卡片 ✓ → 样式加对文件 ✓ → 升版本 + 写 VERSION.md（功能更新） ✓ → `npm run build` 能过 ✓
