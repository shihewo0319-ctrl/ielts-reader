#!/bin/bash
# 一键启动 IELTS 阅读学习助手（自动找空闲端口）
cd "$(dirname "$0")"
for port in 8000 8080 8123 9000 9090; do
  if ! (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    echo "✅ 启动成功，浏览器打开：http://localhost:$port"
    echo "（按 Ctrl+C 停止）"
    python3 server.py "$port"
    exit 0
  fi
done
echo "❌ 常用端口都被占用，请手动执行：python3 -m http.server 8123"
