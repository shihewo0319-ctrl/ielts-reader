# IELTS 学习台（ielts-reader）

雅思阅读学习工具：上传阅读文章，点击任意单词即可查看**英文释义、音标、中文释义、双语例句**，支持选中词组查询、英/美音发音。

## 快速开始

```bash
python3 server.py          # 默认端口 8123
# 打开 http://localhost:8123
```

零依赖即可运行：前端使用原生 ES Modules，由本地 Python 服务器直接提供静态文件。

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
├── src/
│   ├── home.js           # 主页入口（卡片跳转逻辑 + 名言渲染）
│   ├── settings.js       # 设置入口：渲染菜单 HTML 并装配子模块
│   ├── settings/
│   │   ├── menu.js       # 设置菜单 HTML 模板 + 开关 / 面板切换
│   │   ├── ai.js         # AI 设置：API Key 绑定 / 思考模式
│   │   └── ai-test.js    # 「测试连接」按钮（真实调用 /api/ai_chat 验证 Key）
│   ├── reader.js         # 阅读器入口：组装各模块并初始化
│   ├── reader/
│   │   ├── article.js    # 文章加载 / 渲染 / 分词 / 文件上传
│   │   ├── dict.js       # 词典查询（多源 + 中文 + 例句 + 释义 HTML）
│   │   ├── popup.js      # 释义弹窗：显示 / 定位 / 点击查词 / 词组查询 / AI 标签页
│   │   ├── grammar.js    # 语法分析渲染（Enpuz 式词块 / 图例 / 单词高亮）
│   │   ├── tts.js        # 单词发音 / 音标
│   │   └── sample.js     # 示例文章
│   ├── lib/
│   │   ├── dom.js        # 通用 DOM / 字符串工具
│   │   ├── api.js        # 带超时的 JSON 请求封装
│   │   ├── ai-config.js  # AI 调用配置：默认服务商 / 读取已绑定 Key
│   │   └── providers.js  # AI 服务商 / 模型 / Base URL 数据表
│   └── styles/
│       ├── theme.css     # 变量 + 通用（顶部栏 / 按钮 / 面板）
│       ├── home.css      # 主页 + 设置菜单 + API Key
│       └── reader.css    # 阅读器 + 弹窗 + 音标
├── server.py             # 本地服务器 + API 代理（有道/词典/AI）
├── package.json          # Vite 工程化配置（可选）
└── vite.config.js
```

## 新增功能怎么加

- **新功能模块**：在 `src/` 下建独立目录/文件，从 `src/reader.js` 或 `src/home.js` 入口引入（设置相关拆进 `src/settings/` 对应子模块，不要往 `settings/menu.js` / `settings/ai.js` 里堆无关逻辑），主页卡片加在 `index.html` 的 `.home-grid` 里。
- **新 API 代理**：在 `server.py` 的 `Handler` 里加一个 `handle_xxx` 方法，并在 `do_GET`/`do_POST` 中路由。
- **版本**：每次改动在 `VERSION.md` 升版本（功能更新同步更新日志）。

## API Key 说明

- 绑定后仅保存在本机浏览器 `localStorage`，不会上传。
- 「测试连接」通过本地服务器 `server.py` 真实调用所选服务商，避免浏览器跨域限制。

## 模块化约定（所有改动必须遵守）

> 目标是：项目变大后依然容易维护、定位问题快。**每个新改动先想好放哪个模块，不要往现有文件里堆。**

1. **一个职责一个文件**：每个文件只做一件事。新功能建新文件（如 `src/reader/xxx.js`），不要塞进 `popup.js` / `dict.js` 等已有文件里。
2. **页面入口只组装**：`src/reader.js` / `src/home.js` 只负责引入模块并初始化，不写业务逻辑。
3. **通用工具放 `src/lib/`**：被多个模块复用的函数（DOM 操作、请求封装、配置读取）放 `src/lib/`，并加一行职责注释。
4. **数据与 UI 分离**：逻辑（词典/AI/发音调用）在独立模块里，UI 组装在弹窗/页面模块里，通过 import 连接。
5. **行数红线**：单文件超过约 300 行时，主动拆分（如弹窗 AI 标签页逻辑可拆出 `src/reader/ai-pane.js`）。当前 `src/reader/popup.js`(237) 是最大文件，接近红线时再拆。
6. **样式按页面分文件**：`src/styles/theme.css`（通用）/ `home.css`（主页）/ `reader.css`（阅读器），新增页面样式新建对应 css。
7. **新功能检查清单**：建独立模块 ✓ → 入口引入 ✓ → 主页加卡片 ✓ → 样式加对文件 ✓ → 升版本 + 写 VERSION.md（功能更新） ✓ → `npm run build` 能过 ✓
