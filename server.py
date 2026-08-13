#!/usr/bin/env python3
"""IELTS 学习台 本地服务器（路由分发层）

职责边界：
  - 静态页面：开发服务项目根目录 / 原生 ES Modules；生产 --prod 时服务 dist/ 构建产物
  - 路由分发：外部 API 代理（有道词典 / AI chat）→ proxy.py；数据库 API → api_db.py
  - 启动参数：python3 server.py <port> [--host <地址>] [--prod]
- 默认 IPv6 双栈绑定（::，同时支持 IPv4/IPv6 访问）；系统无 IPv6 时回退 0.0.0.0
"""
import json
import os
import socket
import subprocess
import sys
import urllib.parse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

import api_db
import config
import proxy

os.chdir(config.STATIC_DIR or config.BASE_DIR)

# 外部 API 代理路由（前缀匹配，处理函数见 proxy.py，返回 dict payload）
PROXY_GET = [
    ('/api/chinese', proxy.chinese),
    ('/api/pron', proxy.pron),
    ('/api/sentences', proxy.sentences),
]
PROXY_POST = [
    ('/api/ai_chat', proxy.ai_chat),
]


def resolve_host():
    """--host <地址> 指定绑定地址；默认 ::（IPv6 双栈，同时支持 IPv4/IPv6），
    系统无 IPv6 时回退 0.0.0.0。"""
    if '--host' in sys.argv:
        i = sys.argv.index('--host')
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    try:
        s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
        s.close()
        return '::'
    except OSError:
        return '0.0.0.0'


def public_ipv6():
    """从系统全局地址里找公网 IPv6 用于提示外网访问地址。
    优先返回稳定的 /64 SLAAC 地址，避免临时隐私地址（/128，会频繁变化）。"""
    try:
        out = subprocess.run(
            ['ip', '-6', 'addr', 'show', 'scope', 'global'],
            capture_output=True, text=True, timeout=3).stdout
        candidates = []
        for line in out.splitlines():
            line = line.strip()
            if not line.startswith('inet6 '):
                continue
            ip, _, prefix = line.split()[1].partition('/')
            if '::1' in ip or ip.startswith('fd') or ip.startswith('fe8'):
                continue
            candidates.append((ip, int(prefix or 0)))
        if not candidates:
            return ''
        stable = [a for a in candidates if a[1] == 64]
        pick = stable[0] if stable else candidates[0]
        return pick[0]
    except Exception:
        return ''


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        for prefix, fn in PROXY_GET:
            if parsed.path.startswith(prefix):
                # 传入完整 self.path（含 query），代理函数内部自行解析
                self.send_json(fn(self.path))
                return
        payload = api_db.handle_get(parsed.path, urllib.parse.parse_qs(parsed.query))
        if payload is not None:
            self.send_json(payload)
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        body = api_db.read_body(self)
        for prefix, fn in PROXY_POST:
            if parsed.path.startswith(prefix):
                self.send_json(fn(body))
                return
        payload = api_db.handle_post(parsed.path, urllib.parse.parse_qs(parsed.query), body)
        if payload is not None:
            self.send_json(payload)
        else:
            self.send_error(404)

    def do_DELETE(self):
        parsed = urllib.parse.urlparse(self.path)
        payload = api_db.handle_delete(parsed.path, urllib.parse.parse_qs(parsed.query))
        if payload is not None:
            self.send_json(payload)
        else:
            self.send_error(404)

    def send_json(self, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass  # 客户端提前断开：静默忽略，不影响其它请求

    def end_headers(self):
        # 禁止浏览器缓存，确保每次刷新都拿到最新代码
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 安静模式


if __name__ == '__main__':
    host = resolve_host()
    if ':' in host:
        class V6Server(ThreadingHTTPServer):
            address_family = socket.AF_INET6
        server = V6Server((host, config.PORT), Handler)
    else:
        server = ThreadingHTTPServer((host, config.PORT), Handler)
    print(f'IELTS 阅读学习助手已启动（绑定 {host}）')
    print(f'  本机访问   ：http://localhost:{config.PORT}')
    pub = public_ipv6()
    if pub:
        print(f'  IPv6 公网  ：http://[{pub}]:{config.PORT}')
    print('按 Ctrl+C 停止')
    server.serve_forever()
