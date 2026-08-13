#!/usr/bin/env python3
"""IELTS 阅读学习助手 本地服务器
- 提供静态页面（开发：项目根目录 / 原生 ES Modules；生产：--prod 时服务 dist/ 构建产物）
- /api/chinese?word=xxx  代理有道词典中文释义（解决浏览器跨域限制）
- 默认 IPv6 双栈绑定（::，同时支持 IPv4/IPv6 访问）；可用 --host 指定
"""
import json
import os
import socket
import subprocess
import sys
import urllib.parse
import urllib.error
import urllib.request
import api_db
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
os.chdir(BASE_DIR)
# 生产模式：--prod 且存在构建产物 dist/ 时，静态目录指向 dist/
if '--prod' in sys.argv and os.path.isdir(os.path.join(BASE_DIR, 'dist')):
    os.chdir(os.path.join(BASE_DIR, 'dist'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


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
        if self.path.startswith('/api/chinese'):
            self.handle_chinese()
        elif self.path.startswith('/api/pron'):
            self.handle_pron()
        elif self.path.startswith('/api/sentences'):
            self.handle_sentences()
        else:
            parsed = urllib.parse.urlparse(self.path)
            payload = api_db.handle_get(parsed.path, urllib.parse.parse_qs(parsed.query))
            if payload is not None:
                self.send_json(payload)
            else:
                super().do_GET()

    def do_POST(self):
        if self.path.startswith('/api/ai_chat'):
            self.handle_ai_chat()
            return
        parsed = urllib.parse.urlparse(self.path)
        payload = api_db.handle_post(parsed.path, urllib.parse.parse_qs(parsed.query),
                                     api_db.read_body(self))
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
        self.wfile.write(body)

    def handle_pron(self):
        # 有道词典音标/发音接口：返回英音(ukphone)与美音(usphone)两套音标
        try:
            q = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(q.query)
            word = (params.get('word') or [''])[0].strip().lower()
            if not word:
                self.send_json({'ok': False, 'error': 'empty word'})
                return
            url = 'https://dict.youdao.com/jsonapi?q=' + urllib.parse.quote(word)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode('utf-8', 'ignore')
            data = json.loads(raw)
            ec_words = (data.get('ec') or {}).get('word') or []
            hit = None
            for w in ec_words:
                phrase = ((w.get('return-phrase') or {}).get('l') or {}).get('i') or []
                if phrase and str(phrase[0]).strip().lower() == word:
                    hit = w
                    break
            if hit is None and ec_words:
                hit = ec_words[0]
            entry = hit or {}
            payload = {
                'ok': bool(entry),
                'word': word,
                'ukphone': (entry.get('ukphone') or '').strip(),
                'usphone': (entry.get('usphone') or '').strip(),
                'ukspeech': entry.get('ukspeech') or '',
                'usspeech': entry.get('usspeech') or '',
            }
        except Exception as ex:
            payload = {'ok': False, 'error': str(ex)}
        self.send_json(payload)

    def handle_sentences(self):
        # 有道词典双语例句：blng_sents_part.sentence-pair[] -> {en, zh}
        try:
            q = urllib.parse.urlparse(self.path)
            params = urllib.parse.parse_qs(q.query)
            word = (params.get('word') or [''])[0].strip().lower()
            if not word:
                self.send_json({'ok': False, 'error': 'empty word'})
                return
            url = 'https://dict.youdao.com/jsonapi?q=' + urllib.parse.quote(word)
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=8) as resp:
                raw = resp.read().decode('utf-8', 'ignore')
            data = json.loads(raw)
            pairs = ((data.get('blng_sents_part') or {}).get('sentence-pair') or [])[:3]
            sentences = []
            for p in pairs:
                en = (p.get('sentence') or '').strip()
                zh = (p.get('sentence-translation') or '').strip()
                if en:
                    sentences.append({'en': en, 'zh': zh})
            payload = {'ok': bool(sentences), 'word': word, 'sentences': sentences}
        except Exception as ex:
            payload = {'ok': False, 'error': str(ex)}
        self.send_json(payload)

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

    # OpenAI 兼容 chat/completions 代理：本地转发，避免浏览器跨域限制
    def handle_ai_chat(self):
        try:
            length = int(self.headers.get('Content-Length') or 0)
            raw = self.rfile.read(length)
            data = json.loads(raw.decode('utf-8'))
        except Exception:
            self.send_json({'ok': False, 'error': '请求体不是有效的 JSON'})
            return
        provider = str(data.get('provider') or '').strip()
        api_key = str(data.get('apiKey') or '').strip()
        model = str(data.get('model') or '').strip()
        base_url = str(data.get('baseUrl') or '').strip()
        message = str(data.get('message') or '').strip()
        thinking = bool(data.get('thinking'))  # 思考模式开关（前端全局设置）
        # 未传 Key（或传的是掩码）时：从服务器数据库读取已绑定 Key，实现跨设备生效
        if not api_key or api_key == '••••••••':
            cred = api_db.get_ai_credentials(provider or None)
            if cred:
                provider = cred['provider']
                api_key = cred['key']
                if not model:
                    model = cred['model']
                if not base_url:
                    base_url = cred['baseUrl']
        if not provider or not api_key:
            self.send_json({'ok': False, 'error': '未绑定 API Key，请先到主页右上角「设置 → AI 设置」添加并保存'})
            return
        if not model:
            self.send_json({'ok': False, 'error': '该服务商未选择模型，请到「AI 设置」中修改'})
            return
        if not message:
            self.send_json({'ok': False, 'error': '缺少 message'})
            return
        ENDPOINTS = {
            'openai': 'https://api.openai.com/v1',
            'deepseek': 'https://api.deepseek.com/v1',
            'opencode': 'https://opencode.ai/zen/v1',
            'go': 'https://opencode.ai/zen/go/v1',
        }
        base = base_url if base_url else ENDPOINTS.get(provider, '')
        if not base:
            self.send_json({'ok': False, 'error': '未知服务商，或 OpenAI 兼容格式需要填写 Base URL'})
            return
        url = base.rstrip('/') + '/chat/completions'
        payload = {
            'model': model,
            'messages': [{'role': 'user', 'content': message}],
            'stream': False,
        }
        # DeepSeek V4：默认禁用思考模式（官方默认开启且 effort=high，会导致响应慢/易超时）；
        # 前端「思考模式」开关开启时改为 enabled
        if provider == 'deepseek':
            payload['thinking'] = {'type': 'enabled' if thinking else 'disabled'}
        req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers={
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api_key,
            'User-Agent': ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) '
                           'AppleWebKit/537.36 (KHTML, like Gecko) '
                           'Chrome/120.0 Safari/537.36'),
        })
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                result = json.loads(resp.read().decode('utf-8', 'ignore'))
            choices = result.get('choices') or []
            content = ''
            if choices:
                content = (choices[0].get('message') or {}).get('content') or ''
            self.send_json({'ok': True, 'content': content, 'model': model})
        except urllib.error.HTTPError as ex:
            try:
                err_text = ex.read().decode('utf-8', 'ignore')
            except Exception:
                err_text = ''
            self.send_json({'ok': False, 'status': ex.code, 'error': err_text or str(ex.reason)})
        except Exception as ex:
            self.send_json({'ok': False, 'error': str(ex)})

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
        server = V6Server((host, PORT), Handler)
    else:
        server = ThreadingHTTPServer((host, PORT), Handler)
    print(f'IELTS 阅读学习助手已启动（绑定 {host}）')
    print(f'  本机访问   ：http://localhost:{PORT}')
    pub = public_ipv6()
    if pub:
        print(f'  IPv6 公网  ：http://[{pub}]:{PORT}')
    print('按 Ctrl+C 停止')
    server.serve_forever()
