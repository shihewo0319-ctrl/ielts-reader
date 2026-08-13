# 版本规则

- 当前版本：**1.1.41**
- 每次改动：patch +1 → 1.0.1、1.0.2、…、1.0.9
- 第 10 次改动：minor +1、patch 归零 → 1.1.0
- 之后同理：1.1.4 → 1.1.5 → … → 1.1.9 → 1.2.0 → …

## 更新日志规则
- **功能更新**（新增功能、更换实现方式、功能增强等）：升版本号后，必须在下方「更新日志」里新增一条，写明版本号和更新内容
- **小改动**（如 UI 位置/排版调整、纯修复等）：只升版本号，不写入更新日志

## 每次改版本时需要同步的位置（index.html / reader.html）
1. index.html / reader.html 标题旁的版本徽章：`v1.1.41`
2. index.html / reader.html 的样式引用（`/src/styles/*.css`）
3. reader.html 的脚本引用（`/src/reader.js`）

---

# 更新日志

## v1.1.41 修复：主页也触发旧 API Key 自动迁移
- 修复：之前旧 localStorage 里的 API Key 只在**阅读器页面**打开时才自动迁移到服务器数据库，只打开主页 / 设置面板时看不到已绑定 Key（误以为 Key 丢失）
- 现在打开**任意页面**（主页 / 阅读器 / 我的文章 / 生词本）都会自动把 v1.1.40 之前存在 localStorage 的旧 Key 一次性迁移到服务器并清除本地；迁移成功前不清除本地数据，失败下次重试
- 已绑定 Key 依旧加密存服务器（v1.1.40 机制不变），刷新页面后可在「设置 → AI 设置」看到恢复的 Key

## v1.1.40 API Key 迁移到服务器数据库（加密存储）
- API Key / 默认服务商 / 思考模式从浏览器 localStorage 迁移到服务器数据库 `data/ielts.db` 的 `settings` 表：绑定一次，手机 / 平板等所有设备通用（平板之前"未绑定 API Key"的问题由此解决）
- 密钥**加密存储**：新增 `secure.py`，使用 Fernet 对称加密；主密钥保存在 `data/.secrets.key`（权限 600、自动生成、gitignore，不进入版本库），数据库里只存密文，浏览器也拿不到明文 Key（编辑时只显示掩码，保存掩码即保留原 Key）
- 后端新增 `/api/settings`（GET 读取 / POST 整体保存，`api_db.py`）；`server.py` 的 `/api/ai_chat` 支持不传 apiKey 时按服务商自动从数据库读取（跨设备调用）
- 前端新增 `src/lib/db-settings.js`（设置 API 封装）；`ai-config.js` 改为异步读取服务器设置（含旧 localStorage 数据一次性自动迁移并清除）；`settings/ai.js` 绑定/删除/设默认/思考模式全部走服务器
- 备份提醒：`data/` 目录现在包含 `ielts.db` 和 `.secrets.key`，两者要一起备份才能恢复已绑定的 API Key

## v1.1.39 数据库整合（SQLite：文章库 / 生词本 / 学习记录）
- 新增本地 SQLite 数据库 `data/ielts.db`（`data/` 已加入 .gitignore，不进入版本库），三张表：`articles` 文章库、`words` 生词本、`lookups` 学习记录；数据读写统一走 `db.py`（新建，数据层）
- 后端新增数据库 API 路由（`api_db.py` 新建，`server.py` 增加 `do_DELETE` 与路由分发）：
  - `/api/articles`：GET 列表/详情、POST 保存（同标题覆盖）、DELETE 删除
  - `/api/words`：GET 列表、POST 加入生词本（同词覆盖句子/备注）、DELETE 删除
  - `/api/lookups`：GET 最近记录、POST 记录一次查词、DELETE 清空记录
- 新增页面「📚 我的文章」（`library.html`）：保存的文章列表，可阅读 / 删除 / 新建；阅读器顶部新增「💾 保存文章」按钮，同标题再次保存自动覆盖更新
- 新增页面「📒 生词本」（`wordbook.html`）：⭐ 生词本（收藏单词，阅读时点弹窗里的「⭐ 加入生词本」）+ 🕘 学习记录（点击单词查词自动记录，可清空）
- 主页新增「我的文章」「生词本」两张功能卡片；阅读器支持 `reader.html?article=<id>` 从文章库直接打开
- 前端新增 `src/lib/db-api.js`（数据库 API 封装），`vite.config.js` 增加 library / wordbook 两个多页入口
- 数据保存在运行服务器的那台电脑上；通过 Tailscale 访问同一服务器即实现跨设备同步


## v1.1.36 支持 IPv6 公网访问
- server.py 默认改为 IPv6 双栈绑定（`::`），IPv4/IPv6 同时可访问；可用 `--host <地址>` 指定绑定地址
- 启动时自动检测并打印本机公网 IPv6 地址（优先稳定的 /64 地址，避免临时隐私地址），供外网直接访问
- 无 IPv6 环境的系统自动回退绑定 `0.0.0.0`，本地访问行为不变



## v1.1.33 模块化重构（代码结构优化，功能不变）
- AI 设置面板 HTML 从 index.html 移出，改为 JS 模板渲染（`src/settings/menu.js`），主页只留一个挂载点
- 设置模块拆分：`src/settings.js`（入口）+ `src/settings/menu.js`（菜单开关/面板切换）+ `src/settings/ai.js`（API Key 绑定 / 思考模式）+ `src/settings/ai-test.js`（测试连接）+ `src/lib/providers.js`（服务商 / 模型 / Base URL 数据表）
- 语法分析渲染（Enpuz 式词块 + 成分颜色 + 从句底色 + 图例 + 单词高亮）从 `popup.js` 拆出到 `src/reader/grammar.js`
- 清理死代码（`effectiveBaseUrl`），统一设置模块代码风格（全部改为 const / 箭头函数）
- 效果：`popup.js` 318 → 237 行、`settings.js` 346 → 拆分为 3 个小文件，全部低于 300 行红线

## v1.1.13 AI 语境翻译 + 句子语法分析
- 释义弹窗改为标签页：📖 词典（默认，免费快速）｜🤖 语境翻译（AI 结合单词所在句子解释语境含义）｜📚 语法分析（分析句子主干/从句/时态，长难句拆分理解）
- AI 功能使用主页「AI 设置」中绑定的 API Key（自动选择已绑定的服务商），未绑定时点击给出提示
- 同一单词 + 同一句子只调用一次 AI（内存缓存），避免重复消耗 token

## v1.1.11 项目模块化重构
- 前端按功能拆分为 ES Modules：`src/home.js`（主页/AI 设置）、`src/reader.js`（阅读器入口）、`src/reader/`（article 文章、dict 词典、popup 弹窗、tts 发音、sample 示例）、`src/lib/`（dom/api 通用工具）
- 样式拆分：`src/styles/theme.css`（通用）/ `home.css`（主页与设置）/ `reader.css`（阅读器与弹窗）
- 引入 Vite 多页工程化（可选）：`npm install` → `npm run dev` 热更新 / `npm run build` 构建；`python3 server.py --prod` 可服务构建产物
- 顺带修复：思考模式开关未接线、`loadThinking` 未定义（v1.1.9 遗留问题），现在开关真实生效

## v1.1.1 新增主页
- 新增卡片式主页（index.html）：复古像素风格，当前提供「阅读学习助手」入口，后续新功能以卡片形式继续添加
- 阅读器页面移至 reader.html，左上角标题改为「IELTS 学习台」，点击可返回主页

## v1.0.7 例句功能
- 释义弹窗新增「例句」：使用有道双语例句接口，显示英文例句及中文翻译

## v1.0.1 新增发音功能
- 新增单词发音功能：释义弹窗单词右侧加发音按钮（🔊，小字体），用浏览器内置语音合成朗读
