#!/usr/bin/env python3
"""全局配置（端口 / 目录 / 超时）

集中管理服务器常量，避免 server.py / db.py / secure.py 各自重复定义路径。
使用方式：`import config` 后直接读属性；命令行参数在模块加载时解析一次。
"""
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
DB_PATH = os.path.join(DATA_DIR, 'ielts.db')

# 生产模式：--prod 且存在构建产物 dist/ 时，静态目录指向 dist/
STATIC_DIR = None
if '--prod' in sys.argv and os.path.isdir(os.path.join(BASE_DIR, 'dist')):
    STATIC_DIR = os.path.join(BASE_DIR, 'dist')

# 端口：python3 server.py <port> 指定，默认 8123
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123

# 外部 API 代理超时（秒）
YOUDAO_TIMEOUT = 8
AI_CHAT_TIMEOUT = 120
