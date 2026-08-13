# 版本规则

- 当前版本：**1.1.10**
- 每次改动：patch +1 → 1.0.1、1.0.2、…、1.0.9
- 第 10 次改动：minor +1、patch 归零 → 1.1.0
- 之后同理：1.1.4 → 1.1.5 → … → 1.1.9 → 1.2.0 → …

## 更新日志规则
- **功能更新**（新增功能、更换实现方式、功能增强等）：升版本号后，必须在下方「更新日志」里新增一条，写明版本号和更新内容
- **小改动**（如 UI 位置/排版调整、纯修复等）：只升版本号，不写入更新日志

## 每次改版本时需要同步的位置（index.html / reader.html）
1. index.html / reader.html 标题旁的版本徽章：`v1.1.9`
2. index.html / reader.html 的 `style.css?v=1.1.9`
3. reader.html 的 `app.js?v=1.1.9`

---

# 更新日志

## v1.1.10 修正 OpenCode Go 官方模型列表
- OpenCode Go 官方模型列表中不存在 glm-5 / kimi-k2.5（已在 Zen 下线），已改为官方 chat/completions 端点可用模型：grok-4.5、glm-5.2、glm-5.1、kimi-k3、kimi-k2.7-code、kimi-k2.6、deepseek-v4-pro、deepseek-v4-flash、mimo-v2.5、mimo-v2.5-pro、hy3
- OpenCode Go 默认模型改为官方旗舰 glm-5.2
- 说明：官方另 7 款模型（gpt-5.6-luna、minimax-m3/m2.7/m2.5、qwen3.8-max/qwen3.7-max/qwen3.7-plus/qwen3.6-plus）走 Responses / Anthropic 端点，暂未列入

## v1.1.9 AI 设置新增「思考模式」开关
- 主页 → 设置 → AI 设置 新增思考模式开关（默认关闭）
- 开启后 DeepSeek V4（flash / pro）请求带 thinking: enabled，先推理再回答（更准但更慢、更耗 token）
- 关闭（默认）时带 thinking: disabled，响应快且稳定；仅 DeepSeek 生效，其它服务商不受影响
- 开关状态保存于浏览器 localStorage，测试连接时同步生效

## v1.1.8 DeepSeek 思考模式处理
- 根据 DeepSeek 官方文档：V4 模型思考模式默认开启（effort=high），会导致响应慢、测试连接易超时
- 现对 DeepSeek 请求默认禁用思考模式（thinking: disabled），响应更快更稳定

## v1.1.7 修正 DeepSeek 官方模型列表
- DeepSeek 官方 API 的旧模型名 deepseek-chat / deepseek-reasoner 已于 2026-07-24 停用，现更新为官方当前主模型 deepseek-v4-flash / deepseek-v4-pro
- 已保存的旧 DeepSeek 模型名会自动迁移到 deepseek-v4-flash

## v1.1.6 Base URL 自动填写
- 添加 API Key 时，已知服务商（OpenAI / DeepSeek / OpenCode Zen / OpenCode Go）的 Base URL 自动填写官方端点并设为只读，无需手动输入
- OpenAI 兼容格式仍由用户手动填写 Base URL；服务端优先使用前端传入的 Base URL，缺失时回退到官方端点

## v1.1.5 API Key 真实调用
- 新增本地代理接口 /api/ai_chat：绑定 API Key 后通过本地服务器真实调用所选服务商，解决浏览器跨域限制
- 服务商命名修正：原「Go」改为「OpenCode Go」（https://opencode.ai/go），原「OpenCode」改为「OpenCode Zen」
- 添加 API Key 时支持选择模型（各服务商常用模型预设，可自定义）与填写 Base URL（OpenAI 兼容格式必填）
- 已绑定列表新增「测试连接」按钮：真实调用该服务商 API 验证 Key 是否可用，并显示服务商返回结果

## v1.1.4 API Key 绑定改为手动添加方式
- 进入 AI 设置不再一次性列出全部服务商，改为点击「＋ 添加 API KEY」后选择服务商并填写密钥
- 已绑定列表支持显示/隐藏明文、修改、删除

## v1.1.3 AI 设置新增 API Key 绑定
- AI 设置子菜单新增「API Key 绑定」：可分别绑定 OpenAI、OpenAI 兼容格式、DeepSeek、OpenCode、Go 的 API Key
- 支持显示/隐藏、保存、清除，数据仅存储在本机浏览器 localStorage

## v1.1.2 主页设置菜单
- 主页右上角新增设置按钮，点击弹出复古像素风格设置菜单
- 新增「AI 设置」子菜单入口，结构可扩展，后续其他子菜单直接追加即可

## v1.1.1 新增主页
- 新增卡片式主页（index.html）：复古像素风格，当前提供「阅读学习助手」入口，后续新功能以卡片形式继续添加
- 阅读器页面移至 reader.html，左上角标题改为「IELTS 学习台」，点击可返回主页

## v1.0.9 复古像素风格
- UI 风格从高对比学习切换为复古像素：米黄纸底、深棕粗边框 + 硬阴影、红/橙点缀、等宽字体；单词为红色 + 橙色粗下划线，AI 重点词汇浅黄底突出

## v1.0.7 例句功能
- 释义弹窗新增「例句」：使用有道双语例句接口，显示英文例句及中文翻译

## v1.0.4 音标发音
- 发音按钮改为音标样式：弹窗并列显示 英音 / 美音 两个音标（有道音标数据），点击哪个音标就播放哪个版本的发音

## v1.0.3 发音源优化
- 发音默认改用有道词典接口（免费、无需 Key、国内稳定），播放失败时自动兜底浏览器语音合成

## v1.0.1 新增发音功能
- 新增单词发音功能：释义弹窗单词右侧加发音按钮（🔊，小字体），用浏览器内置语音合成朗读
