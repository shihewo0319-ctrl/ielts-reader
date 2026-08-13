# IELTS 学习台（ielts-reader）

雅思阅读学习工具：上传阅读文章，点击任意单词即可查看**英文释义、音标、中文释义、双语例句**，支持选中词组查询、英/美音发音。

## 快速开始

```bash
python3 server.py          # 默认端口 8123
# 打开 http://localhost:8123
```

零依赖即可运行：前端使用原生 ES Modules，由本地 Python 服务器直接提供静态文件。

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
│   ├── home.js           # 主页入口（卡片跳转逻辑，未来新功能入口）
│   ├── settings.js       # 设置菜单 + AI 设置（API Key / 思考模式）
│   ├── reader.js         # 阅读器入口：组装各模块并初始化
│   ├── reader/
│   │   ├── article.js    # 文章加载 / 渲染 / 分词 / 文件上传
│   │   ├── dict.js       # 词典查询（多源 + 中文 + 例句 + 释义 HTML）
│   │   ├── popup.js      # 释义弹窗：显示 / 定位 / 点击查词 / 词组查询
│   │   ├── tts.js        # 单词发音 / 音标
│   │   └── sample.js     # 示例文章
│   ├── lib/
│   │   ├── dom.js        # 通用 DOM / 字符串工具
│   │   └── api.js        # 带超时的 JSON 请求封装
│   └── styles/
│       ├── theme.css     # 变量 + 通用（顶部栏 / 按钮 / 面板）
│       ├── home.css      # 主页 + 设置菜单 + API Key
│       └── reader.css    # 阅读器 + 弹窗 + 音标
├── server.py             # 本地服务器 + API 代理（有道/词典/AI）
├── package.json          # Vite 工程化配置（可选）
└── vite.config.js
```

## 新增功能怎么加

- **新功能模块**：在 `src/` 下建独立目录/文件，从 `src/reader.js` 或 `src/home.js` 入口引入（设置相关写进 `src/settings.js`），主页卡片加在 `index.html` 的 `.home-grid` 里。
- **新 API 代理**：在 `server.py` 的 `Handler` 里加一个 `handle_xxx` 方法，并在 `do_GET`/`do_POST` 中路由。
- **版本**：每次改动在 `VERSION.md` 升版本（功能更新同步更新日志）。

## API Key 说明

- 绑定后仅保存在本机浏览器 `localStorage`，不会上传。
- 「测试连接」通过本地服务器 `server.py` 真实调用所选服务商，避免浏览器跨域限制。
