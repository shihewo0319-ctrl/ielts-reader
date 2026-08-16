# 版本规则

- 当前版本：**1.4.4**
- 每次改动：patch +1 → 1.0.1、1.0.2、…、1.0.9
- 第 10 次改动：minor +1、patch 归零 → 1.1.0
- 之后同理：1.1.4 → 1.1.5 → … → 1.1.9 → 1.2.0 → …

## 更新日志规则
- **功能更新**（新增功能、更换实现方式、功能增强等）：升版本号后，必须在下方「更新日志」里新增一条，写明版本号和更新内容
- **小改动**（如 UI 位置/排版调整、纯修复等）：只升版本号，不写入更新日志

## 每次改版本时需要同步的位置（v1.4.0 起仅两处）
1. `src/lib/version.js` 的 `VERSION`（页面顶栏徽章由它自动填充，HTML 不再写死）
2. `package.json` 的 `version`（保持一致即可）

---

# 更新日志

## v1.4.2 词库升级为独立「词库总览」页：全量单词分页 + 四类标签
- 背单词页的页内搜索浏览改为入口卡（含 已学/未学/今日新学/顽固 四类实时统计），点击跳转新页 `vocab-bank.html`
- 词库总览页：全量单词**每页 20 条分页**（页码窗口 + 首末省略），四个分类标签页——**已学单词**（含阶段与下次复习日）/ **未学单词**（含档位）/ **今日新学** / **顽固单词**（忘了 ≥3 次，按遗忘次数排序）
- 点词条仍直达查词页看完整释义；「重置全部进度」移至词库页工具栏
- 词库页导航归属背单词（顶栏不重复显示）


## v1.4.1 新增「🎯 背单词」：雅思高频词库 + 艾宾浩斯遗忘曲线科学复习
- **新页面 vocab.html**（首页第 5 张卡片 + 顶栏导航）：内置雅思高频词库 **477 条**（基础/核心/进阶三档单词 379 + 高频词组 98，含音标与释义）
- **科学记忆流程**：回想 → 显示答案 → 四档自评（忘了/模糊/认识/秒懂）；间隔重复引擎 `features/vocab/srs.js`——新词「认识」后 1 天首复，「忘了」10 分钟内本轮重现，复习间隔按遗忘曲线 ×难度系数自适应拉长（≈1→2→4→7→15→30…天），间隔 ≥45 天标记「已掌握」
- **每日词量自由设定**（5/10/15/20/30 快捷档 + 任意 1~100 自定义），词库范围可按档位勾选；到期复习优先并有洪水保护
- 仪表盘：今日任务/连续打卡🔥/总进度；完成页统计 + 下次复习时间；词库浏览支持搜索/筛选/状态徽章，点词条直达查词页看完整释义
- 后端：`vocab_progress`/`vocab_log` 两张表（schema v3，`server.py` 启动自动迁移）；`/api/vocab/*` 路由；进度跨设备同步（同生词本）
- 冒烟测试新增背单词用例（5/5 通过）


## v1.4.0 全站 UI 改版（黏土拟物设计系统）+ 工程化重构
- **UI 改版**：复古像素风 → 黏土拟物（Claymorphism）：无边框膨润浮雕（外投影+内高光）、26px 超大圆角、内凹输入框、浅薰衣草×暖珊瑚配色；顶栏改浅色黏土条，全站入场/悬停动效统一（弹簧曲线、依次浮现）
- **设计令牌化**：全部视觉参数集中在 `src/styles/theme.css` 的 `:root` 变量（色板/圆角/阴影/边框宽度/字体），改一处全站生效；曾内置 10 套可切换 UI 风格（玻璃拟态/新粗野主义/终端代码等），按需求移除切换系统，黏土拟物固化为唯一样式
- **工程化重构**：
  - 前端目录重组：`src/pages/`（页面入口）+ `src/features/`（跨页功能：词典/语法/AI/发音）+ `src/lib/`（通用层）；settings 入口并入首页
  - 版本号单一来源：`src/lib/version.js`，页面徽章自动填充
  - 样式去重：新增 `src/styles/shared.css`（词典展示 `.dict-view` 作用域统一弹窗/查词页、搜索框、输入联想、危险按钮、空态等），删除五处双份维护
  - `nav.js` 统一为模块引入（不再单独 script 标签）
  - 新增 `requirements.txt`（cryptography）、Playwright 冒烟测试（`npm test`）、Prettier/.editorconfig 规范
- README 全面重写（新结构、设计系统说明、新页面接入清单）


## v1.3.3 生词本 / 学习记录的单词可点击，跳转单词查询页自动查词
- 生词本「⭐ 生词本」和「🕘 学习记录」两个标签页里的单词现在可点击（悬停下划线 + 高亮提示），点击跳转单词查询页（dict.html）自动查询该词
- 复用 sessionStorage 一次性传词机制（dictInitWord），与首页搜索框一致；刷新查询页仍是空白页（v1.1.66 规则不变）
- 样式：wordbook.css 新增 `.wb-word-link`（悬停高亮 + 下划线）

## v1.3.1 新增独立「语法分析」功能页（结构树 + 流水词块 + 双语对照三合一）
- 新页面 grammar.html + 首页第 4 张功能卡片「🧩 语法分析」+ 顶栏导航 + vite 多页入口
- 粘贴任意英文句子 → 复用 AI 语法分析链路（fetchAi kind='grammar'）→ 三合一渲染：
  ① 结构树（按主句/从句分组列出成分）② 流水词块（词在上、成分标签在下，红边=主句/紫边=从句）③ 双语对照（英文按成分着色 + 中文翻译 + 结构总结）
- 渲染逻辑新建 `src/reader/grammar-view.js`（阅读器弹窗仍用原 Enpuz 行内样式不变）；样式新建 `src/styles/grammar.css`（像素风）
- AI 语法分析提示词新增 `translation` 字段（整句中文翻译），`parseGrammarJson` 返回 translation（可选，弹窗不受影响）
- 内置两个示例句按钮（让步状语从句 / that 宾语从句），未绑定 API Key 时提示去「设置 → AI 设置」
- 预览稿：Project/grammar-combined-preview/index.html（独立页面，未入库）

## v1.1.66 单词查询页移除 URL 记忆（刷新即空白页，不再残留上次结果）
- 查询结果不再写入 URL（v1.1.49 的「链接可刷新/收藏/分享」特性移除）：刷新 / 重新打开 / 旧收藏链接都只显示空白搜索框
- 首页搜索框跳转改为 sessionStorage 一次性传词（`dictInitWord`，查询页读取即删），首页搜索体验不变
- 代价说明：收藏/分享查询链接失效；刷新需重新输入；浏览器后退不再回到上一个查询词

## v1.1.65 单词查询改为搜索引擎式输入联想（替换结果页联想词区）
- 搜索框输入英文时实时联想：有道 suggest 前缀匹配，**最多 8 条**，每条显示英文单词 + 简短中文释义，↑/↓ 选择、Enter 确认、点击即查、Esc / 点外部关闭、180ms 防抖
- 首页搜索框与单词查询页搜索框**都**接入联想（共用新组件 `src/lib/suggest-box.js`，fetch 由调用方注入，lib 层无业务依赖）
- **移除**结果页的「联想词」区与「你是不是想找」纠错区（下拉联想已替代）；中文查询的中→英映射列表保留
- 样式：dict.css / home.css 新增 `.suggest-dropdown` / `.suggest-item`，删除结果页 `.dict-suggest-chips` / `.dict-suggest-chip` 等无用样式

## v1.1.64 单词查询支持中文 + 英文联想词
- 中文查询：输入中文走有道 suggest 中→英映射，列出对应英文词（带中文释义），点击即查该英文词；无结果给提示
- 英文查询：结果下方新增「联想词」区（有道 suggest：相关英文词 + 中文释义，点击即查），已排除被查单词本身
- 英文拼写容错：未精确匹配时该区自动变为「你是不是想找」（如 urbanisaton → urbanisation）
- 后端新增 `/api/suggest`（`proxy.py` 抽出 `_youdao_suggest` 供 chinese/suggest 共用，`server.py` PROXY_GET 加路由）；前端 `reader/dict.js` 新增 `isChinese` / `suggestEntries`，`src/dict.js` 按中/英分流渲染，`dict.css` 新增联想词与中→英映射样式

## v1.1.62 生词本例句高亮 + 单词查询加入的生词自动补例句
- 生词本 / 学习记录里的例句中，把当前单词高亮显示（`.ai-word-hl`，与阅读器弹窗 AI 语境翻译高亮样式一致）
- 单词查询页（dict.html）加入的生词原本没有例句（sentence 为空），现在生词本展示时会自动用有道例句接口（/api/sentences，内存缓存）补一句展示；不落库，每次打开页面重新获取

## v1.1.60 模块化重构（代码结构优化，功能不变）
- 断开 `article.js` ↔ `popup.js` 循环引用：「换一篇」按钮接线移入入口 `reader.js`（新增 `resetArticle()`），弹窗隐藏与面板切换解耦
- 弹窗 / 单词查询页共用的词头（单词 + 英/美音标 + 🔊 兜底 + ⭐ 加入生词本）抽成 `reader/dict.js` 的 `buildWordHeader(word, sentence)`，两处各删约 45 行重复代码
- 生词本「📖 释义」按钮改用 `reader/dict.js` 的 `lookupChinese()` 封装，不再直接 fetch `/api/chinese`
- 删除 `reader.html` 死代码弹窗骨架（静态 `#popup-*` div，`showPopupAt()` 全量重建从未用到）

## v1.1.53 恢复顶栏导航：仅非首页显示，且不含首页按钮
- 恢复 v1.1.51 的顶栏页面跳转按钮，但仅阅读器 / 我的文章 / 生词本 / 单词查询页显示
- 首页不显示导航（已有卡片 + 搜索框入口）；其他页面不显示「首页」按钮
  （左上角「🏠 IELTS 学习台」标题即为返回首页入口）
- 恢复 src/lib/nav.js 与 theme.css 导航样式

## v1.1.52 移除顶栏全局导航按钮
- 移除 v1.1.51 的顶栏页面跳转按钮：各页面已有卡片 / 按钮 / 搜索框入口，
  左上角「🏠 IELTS 学习台」即返回首页入口，无需额外导航
- 删除 src/lib/nav.js 及 theme.css 导航样式，5 个页面顶栏恢复原布局

## v1.1.51 顶栏新增全局页面导航
- 所有页面顶栏（与标题 / 设置按钮同行）新增导航按钮：🏠 首页、📖 阅读器、📚 我的文章、📒 生词本、🔍 单词查询
- 自动隐藏当前页按钮，其余页面一键跳转；按钮多时自动换行（移动端友好）
- 新增共享模块 src/lib/nav.js（自动识别当前页渲染按钮）+ theme.css 顶栏导航样式，
  各页面只需挂载 <nav id="top-nav"> 并引入即可

## v1.1.49 单词查询结果改为独立页面展示
- 首页搜索框保持不变，查询后跳转到独立「单词查询」页（dict.html?word=xxx）展示结果，
  链接可刷新、收藏、分享
- 新增 dict.html + src/dict.js + src/styles/dict.css，释义格式与阅读器词典弹窗一致
  （单词 + 音标 + 加入生词本 + 英文释义 + 中文释义 + 双语例句）
- 查询页自带搜索框，可直接换词继续查询；vite.config.js 新增 dict 多页入口

## v1.1.48 首页新增单词查询搜索框
- 首页在功能卡片上方新增「🔍 单词查询」搜索框入口（非卡片），输入英文单词后回车或点「查询」即可查词
- 释义展示格式与阅读器词典弹窗完全一致：单词 + 英/美音标（可点击发音）+ ⭐ 加入生词本 +
  英文释义（Free Dictionary / Datamuse / Wiktionary）+ 中文释义（有道）+ 双语例句（有道），三来源并行请求
- 复用阅读器词典模块（reader/dict.js / tts.js），无重复实现

## v1.1.47 生词本：移除词条添加时间显示
- 生词本词条不再显示添加时间，只保留单词 + 例句 + 「释义」/「删除」按钮

## v1.1.46 生词本：时间移到单词下方 + 新增中文释义
- 生词条目头部由「单词 + 时间」并排改为上下排列：单词在上，添加时间移到单词下方
- 删除按钮左侧新增「📖 释义」按钮：默认不显示释义，点击后调用本地有道代理
  （/api/chinese）获取真实中文释义并特效展开（max-height + 透明度过渡），再点收起；
  释义内存缓存，重复点击不重复请求
- 释义面板独占条目第二行（flex-wrap + flex: 0 0 100%），不影响第一行布局

## v1.1.45 修复：生词本条目时间与句子重叠
- 修复：`.wb-item-head` 设了 `min-width: 0`，句子较长时 flex 会压缩头部，
  头部里 nowrap 的添加时间溢出并穿过句子的左边线、与句子文字重叠
- 现在头部 `flex-shrink: 0` 禁止被压缩，句子区域 `flex: 1 1 auto` 填满剩余空间，
  删除按钮固定靠右

## v1.1.44 修复：OpenCode Go / Zen 走 DeepSeek 模型未禁用思考模式，语法分析超时
- 修复：`proxy.py` 之前只在 `provider == 'deepseek'` 时显式发送 `thinking: {'type': 'disabled'}`，
  OpenCode Go / OpenCode Zen 网关背后的 deepseek 模型默认开启思考模式（reasoning: true），
  语法分析（长句 + JSON + 高 effort）会非常慢甚至超时；DeepSeek 官方不受影响
- 现在改为按**模型名**判断（含 `deepseek` 即显式传 thinking 参数）：go / opencode 上的
  deepseek-v4-flash、deepseek-v4-pro 同样默认禁用思考（前端「思考模式」开关开启时仍可启用）；
  glm / kimi / grok 等非 deepseek 模型不传该参数，避免网关报错
- 已实测：OpenCode Go + deepseek-v4-flash + thinking=disabled 正常返回且无思考痕迹

## v1.1.43 模块化重构（数据库迁移机制 + 后端/前端拆分，功能不变）
- **数据库层**（db.py 207 行）：新增 `PRAGMA user_version` 逐级迁移机制（SCHEMA_V1 四张表 → SCHEMA_V2：`lookups.article_id` 列 + 4 个索引），全部读写统一走 `with cursor()` 上下文管理器（自动提交/回滚/关闭），删除手写 get_conn；数据文件自动迁移，旧数据完好
- **后端拆分**：新增 `config.py`（端口/目录/超时集中管理）、`providers.py`（服务商端点表，与前端 providers.js 保持一致）、`proxy.py`（有道词典 + AI chat 代理，172 行）、`settings_store.py`（AI 设置加密存储，128 行）
- **server.py 精简到 143 行**：改为前缀路由表（PROXY_GET / PROXY_POST）+ api_db 分发，`send_json` 加固（BrokenPipeError 静默）；**api_db.py 精简到 127 行**：只做路由解析，SQL 全在 db.py，AI 设置转 settings_store
- **前端请求统一**：`lib/api.js` 新增 `postJson` / `deleteJson`（统一校验 ok、抛带 status 的 Error），db-api / db-settings / reader/ai / ai-test 全部改用统一封装
- **AI 设置拆四文件**：`settings/ai-state.js`（共享状态）+ `ai-form.js`（表单渲染）+ `ai-list.js`（已绑定列表）+ `ai.js`（77 行，只做编排）；删除 `PROVIDER_NAMES` 重复表（统一用 lib/providers.js 的 `providerName`）
- **修复**：① 默认服务商被清空（只改思考模式时误写空 defaultProvider，现改为仅显式提交才写）；② 新增表单 Base URL 不自动回填（openForm 传空 id 的问题）；③ 词典代理丢 query 导致 empty word；④ 客户端提前断开时报 BrokenPipeError
- 阅读器弹窗点词时 `lookups` 记录新增 `article_id` 字段（从文章库打开时带上文章 id）

## v1.1.42 修复：API Key 双重加密导致 AI 调用 401
- 修复：v1.1.40/41 保存 Key 时误加密了两次（内层先加密一次、外层又加密整个 JSON 一次），读取时只解密外层，导致发给服务商的是**密文**而非真实 Key，语境翻译 / 语法分析报 `HTTP 401 Invalid API key`
- 现在只做单层加密（外层加密整个 JSON），并在读取时**自动检测并修复**数据库里已有的双重加密数据（幂等，无需重新绑定 Key，原有绑定自动恢复可用）
- 已实测：修复后服务器从数据库读取真实 Key 调用 OpenCode Go 成功返回，认证通过

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
