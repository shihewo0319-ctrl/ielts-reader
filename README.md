# IELTS 学习台（ielts-reader）

雅思阅读学习工具：上传阅读文章，点击任意单词即可查看**英文释义、音标、中文释义、双语例句**，支持选中词组查询、英/美音发音；内置 **SQLite 数据库**，支持「我的文章」「生词本 / 学习记录」的保存与跨设备同步；**AI API Key 加密保存在服务器数据库**，绑定一次、所有设备通用。

内置 **🎯 背单词**：雅思高频词库 477 条（含词组），按**艾宾浩斯遗忘曲线**间隔复习，每日词量自由设定。

界面为**黏土拟物（Claymorphism）**设计系统：无边框膨润浮雕、超大圆角、内凹输入框（薰衣草奶白 × 暖珊瑚配色），全部设计令牌集中在 `src/styles/theme.css`。

## 快速开始

```bash
pip install -r requirements.txt   # 首次：安装 Python 依赖（cryptography）
python3 server.py                 # 默认端口 8123
# 打开 http://localhost:8123
```

或直接 `./start.sh`（自动在 8000/8080/8123/9000/9090 中找空闲端口）。

前端为原生 ES Modules，由本地 Python 服务器直接提供静态文件，**无需 Node 即可运行**；Node/Vite 仅用于构建和测试（见下）。

### 本地数据库（SQLite）

- 数据文件：`data/ielts.db`（首次启动 `server.py` 自动建表；`data/` 已加入 `.gitignore`，不进入版本库）
- 四张表：`articles` 文章库（同标题保存自动覆盖）、`words` 生词本（同词覆盖句子/备注）、`lookups` 学习记录（查词自动记录，带 `article_id` 关联文章）、`settings` 设置（加密后的 AI API Key / 默认服务商 / 思考模式）
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
- IPv6 直连代码已保留，网络环境支持后可直接使用公网 IPv6 访问

## 工程化（Vite / 测试 / 格式化）

```bash
npm install          # 首次：安装前端开发依赖
npm run dev          # 开发热更新：http://localhost:5173
npm run build        # 生产构建 → dist/（部署用 python3 server.py 8123 --prod）
npm test             # Playwright 冒烟测试（自动拉起服务器，外网接口已 mock，离线可跑）
npm run format       # Prettier 统一格式（首次运行会重排版存量文件，之后保持一致）
```

冒烟测试覆盖：六页面加载、版本单一来源、阅读器「粘贴→点词→弹窗」核心链路、生词本标签切换、设计令牌基线（圆角/无边框/膨润阴影）。改动核心链路后请跑一次 `npm test`。

## 项目结构

```
ielts-reader/
├── index.html … grammar.html   # 六个页面（Vite 多页入口），每个 2 个 CSS + 1 个入口脚本
├── server.py          # ★ 本地服务器（路由分发层）：静态文件 + 代理/数据库路由表分发
├── api_db.py          # ★ 数据库 API 路由：/api/articles /api/words /api/lookups /api/settings
├── db.py              # ★ SQLite 数据层：建表 + PRAGMA user_version 迁移 + 四张表 CRUD
├── settings_store.py  # AI 设置存储：API Key 加密入库 / 读取 / 凭证获取
├── proxy.py           # 外部 API 代理：有道词典（中文/音标/例句）+ OpenAI 兼容 AI chat
├── providers.py       # 后端服务商端点表（与 src/lib/providers.js 保持一致）
├── config.py          # 全局配置：端口 / 目录 / 超时
├── secure.py          # API Key 加密（Fernet，主密钥 data/.secrets.key，权限 600）
├── requirements.txt   # Python 依赖（cryptography）
├── data/              # 本地数据库目录（gitignore）
├── tests/             # Playwright 冒烟测试
└── src/
    ├── pages/         # ★ 页面入口（只组装，不写业务）
    │   ├── home.js    #   主页：名言/搜索联想 + 设置菜单装配（原 settings.js 已并入）
    │   ├── reader.js  #   阅读器：组装 article/popup/dict 等模块
    │   │   └── vocab.js    #   背单词：仪表盘/学习卡片流/词库浏览
    │   ├── dict.js / library.js / wordbook.js / grammar.js
    ├── features/      # ★ 跨页面复用的功能模块
    │   ├── vocab/       #   背单词：wordlist.js（词库数据）+ srs.js（间隔重复引擎）
    │   ├── dict.js    #   词典查询（多源 + 中文 + 例句 + 释义 HTML）——reader/dict/wordbook 三页共用
    │   ├── grammar.js / grammar-view.js  # 语法分析（弹窗内渲染 + 独立页三合一渲染）
    │   ├── ai.js      #   AI 调用链（语境翻译 / 语法分析共用）
    │   └── tts.js     #   单词发音 / 音标
    ├── reader/        # 阅读器专属：article.js（加载/分词/上传）、popup.js（弹窗）、sample.js
    ├── settings/      # 设置菜单：menu.js（模板+开关）、ai*.js（AI 设置五个子模块）
    ├── lib/           # 通用层：dom / api / db-api / db-settings / ai-config / providers / nav / version / suggest-box / quotes
    └── styles/
        ├── theme.css  # ★ 设计令牌（色板/圆角/阴影/字体/边框宽度）+ 顶栏/按钮/面板 —— 黏土拟物唯一定义处
        ├── shared.css # ★ 跨页共享组件：词典展示(.dict-view 作用域)/搜索框/输入联想/危险按钮/空态/页面标题
        ├── home.css / reader.css / dict.css / library.css / wordbook.css / grammar.css  # 各页独有样式
```

## 设计系统（黏土拟物）

改配色 / 圆角 / 阴影只需动 `theme.css` 的 `:root` 变量，全站生效：

| 变量组 | 内容 | 当前值示例 |
|---|---|---|
| `--bg / --card / --surface / --text / --muted` | 底色与文字层级 | `#edeaf8` 薰衣草底 |
| `--primary(-dark/-soft/-tint) / --accent` | 主色珊瑚系 | `#ff7f5c` |
| `--gradient / --pos-grad / --hero` | 渐变（主按钮/词性标签/大标题） | `#ff9d7e→#ff7f5c` |
| `--r-sm/md/lg/full` | 圆角 | 面板 26px、胶囊 999px |
| `--shadow-sm/md/lg/primary` | 膨润浮雕（外投影 + `inset` 高光） | 见文件 |
| `--bw / --bw-lg / --bw-acc` | 边框宽度 | 黏土风 `0px`（全靠阴影） |
| `--tb(-text/-btn-bg/…) / --ring / --track …` | 顶栏 / 焦点环 / 分段底槽等 | 见文件 |

词典展示样式在 `shared.css` 里以 `.dict-view` 作用域定义：阅读器弹窗（`#popup`）和查词页结果卡都挂 `dict-view` 类，同一套样式两处生效，**不要在页面 CSS 里重复定义**。

## 新增功能怎么加

- **新功能模块**：跨页复用的放 `src/features/`，单页专属的放该页目录（如 `src/reader/`），通用工具放 `src/lib/`；入口从 `src/pages/` 对应文件引入，主页卡片加在 `index.html` 的 `.home-grid`。
- **新页面接入清单**：① 根目录建 `xxx.html`（复制任一现有页面头部：theme.css + shared.css + 页面 css + `/src/pages/xxx.js`）② 建 `src/pages/xxx.js` 入口（首行 `import '../lib/nav.js'; import '../lib/version.js';`）③ 新建 `src/styles/xxx.css` ④ `vite.config.js` 的 `input` 加一行 ⑤ 页面标题用 `page-title` 类（shared.css）。
- **新 API 代理**：逻辑写到 `proxy.py`（每个函数返回 dict payload），在 `server.py` 的 `PROXY_GET` / `PROXY_POST` 路由表加一行前缀映射（server.py 只做分发，不写业务）。
- **新数据库接口**：表/读写逻辑加到 `db.py`（新表/新列在 `MIGRATIONS` 加 `SCHEMA_Vn`，不改已发布 schema），路由解析加到 `api_db.py`；涉及加密用 `secure.py` + `settings_store.py`。

## API Key 说明

- **加密存储在服务器数据库**（`data/ielts.db` 的 `settings` 表，密文），主密钥在 `data/.secrets.key`（权限 600、自动生成、gitignore）。浏览器拿不到明文 Key，编辑时只显示掩码，保存掩码即保留原 Key。
- 绑定一次，手机 / 平板等所有设备通用（AI 语境翻译 / 语法分析调用时由服务器从数据库读取 Key，前端不传 Key）。
- 「测试连接」通过本地服务器真实调用所选服务商，避免浏览器跨域限制。
- 备份：`data/` 目录里 `ielts.db` 与 `.secrets.key` 要**一起备份**，否则重启/迁移后无法解密已绑定的 Key。

## 模块化约定（所有改动必须遵守）

> 目标是：项目变大后依然容易维护、定位问题快。**每个新改动先想好放哪个模块，不要往现有文件里堆。**

1. **一个职责一个文件**：新功能建新文件，不要塞进 `popup.js` / `dict.js` 等已有文件。
2. **页面入口只组装**：`src/pages/*.js` 只负责引入模块并初始化，不写业务逻辑。
3. **三层定位法**：通用工具 → `src/lib/`；跨页功能 → `src/features/`；单页专属 → 页面目录或入口。
4. **数据与 UI 分离**：调用逻辑在独立模块，UI 组装在弹窗/页面模块，通过 import 连接。
5. **行数红线**：单文件超过约 300 行时主动拆分。
6. **样式三层法**：设计令牌 → `theme.css`；跨页组件 → `shared.css`；页面独有 → 页面 css。禁止在多个页面 css 里复制同一段样式。
7. **新功能检查清单**：建独立模块 ✓ → 入口引入 ✓ → 主页加卡片（如需）✓ → 样式加对文件 ✓ → `npm test` 能过 ✓ → 升版本（见下）✓

## 版本管理

- **版本号唯一来源：`src/lib/version.js` 的 `VERSION`**（顶栏胶囊自动填充），`package.json` 保持同步即可，页面 HTML 不再写死版本号。
- 版本规则与更新日志见 `VERSION.md`（功能更新必须写日志；小改动只升版本）。
