#!/usr/bin/env python3
"""IELTS 阅读学习助手 本地服务器
- 提供静态页面
- /api/chinese?word=xxx  代理有道词典中文释义（解决浏览器跨域限制）
"""
import json
import os
import sys
import urllib.parse
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith('/api/chinese'):
            self.handle_chinese()
        else:
            super().do_GET()

    def handle_chinese(self):
        try:
            q = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(q.query)
            word = (params.get('word') or [''])[0]
            url = ('https://dict.youdao.com/suggest?num=3&ver=3.0&doctype=json'
                   '&cache=false&le=en&q=' + urllib.parse.quote(word))
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode('utf-8', 'ignore')
            data = json.loads(raw)
            entries = (data.get('data') or {}).get('entries') or []
            hit = next((e for e in entries if (e.get('entry') or '').lower() == word.lower()),
                       entries[0] if entries else None)
            explain = (hit or {}).get('explain', '')
            payload = {'ok': bool(explain), 'explain': explain}
        except Exception as ex:
            payload = {'ok': False, 'error': str(ex)}
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # 禁止浏览器缓存，确保每次刷新都拿到最新代码
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, fmt, *args):
        pass  # 安静模式


if __name__ == '__main__':
    server = ThreadingHTTPServer(('0.0.0.0', PORT), Handler)
    print(f'IELTS 阅读学习助手：http://localhost:{PORT}  (Ctrl+C 停止)')
    server.serve_forever()
