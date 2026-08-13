#!/usr/bin/env python3
"""外部 API 代理：有道词典 + OpenAI 兼容 chat/completions

server.py 只做路由分发，实际逻辑在这里（每个函数返回 dict payload，由 server.py send_json）：
  - chinese()    /api/chinese?word=xxx    有道词典中文释义（suggest 接口，解决跨域）
  - pron()       /api/pron?word=xxx       有道词典音标 / 发音（jsonapi 接口，英音+美音）
  - sentences()  /api/sentences?word=xxx  有道词典双语例句
  - ai_chat()    /api/ai_chat              OpenAI 兼容 chat/completions 转发
                                            （Key 由服务器按 provider 从数据库读取，浏览器不发明文）
"""
import json
import urllib.error
import urllib.parse
import urllib.request

import config
import providers
from settings_store import get_credentials

_UA = {'User-Agent': 'Mozilla/5.0'}


def _query(path):
    return urllib.parse.parse_qs(urllib.parse.urlparse(path).query)


def _first(params, key):
    vals = params.get(key) or []
    return vals[0].strip() if vals else ''


def _youdao_jsonapi(word):
    """请求有道词典 jsonapi 接口并解析 JSON（pron / sentences 共用）"""
    url = 'https://dict.youdao.com/jsonapi?q=' + urllib.parse.quote(word)
    req = urllib.request.Request(url, headers=_UA)
    with urllib.request.urlopen(req, timeout=config.YOUDAO_TIMEOUT) as resp:
        raw = resp.read().decode('utf-8', 'ignore')
    return json.loads(raw)


def chinese(path):
    """有道词典中文释义（suggest 接口）"""
    try:
        word = _first(_query(path), 'word')
        if not word:
            return {'ok': False, 'error': 'empty word'}
        url = ('https://dict.youdao.com/suggest?num=3&ver=3.0&doctype=json'
               '&cache=false&le=en&q=' + urllib.parse.quote(word))
        req = urllib.request.Request(url, headers=_UA)
        with urllib.request.urlopen(req, timeout=config.YOUDAO_TIMEOUT) as resp:
            raw = resp.read().decode('utf-8', 'ignore')
        data = json.loads(raw)
        entries = (data.get('data') or {}).get('entries') or []
        hit = next((e for e in entries if (e.get('entry') or '').lower() == word.lower()),
                   entries[0] if entries else None)
        explain = (hit or {}).get('explain', '')
        return {'ok': bool(explain), 'explain': explain}
    except Exception as ex:
        return {'ok': False, 'error': str(ex)}


def pron(path):
    """有道词典音标/发音接口：返回英音(ukphone)与美音(usphone)两套音标"""
    try:
        word = _first(_query(path), 'word').lower()
        if not word:
            return {'ok': False, 'error': 'empty word'}
        data = _youdao_jsonapi(word)
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
        return {
            'ok': bool(entry),
            'word': word,
            'ukphone': (entry.get('ukphone') or '').strip(),
            'usphone': (entry.get('usphone') or '').strip(),
            'ukspeech': entry.get('ukspeech') or '',
            'usspeech': entry.get('usspeech') or '',
        }
    except Exception as ex:
        return {'ok': False, 'error': str(ex)}


def sentences(path):
    """有道词典双语例句：blng_sents_part.sentence-pair[] -> {en, zh}"""
    try:
        word = _first(_query(path), 'word').lower()
        if not word:
            return {'ok': False, 'error': 'empty word'}
        data = _youdao_jsonapi(word)
        pairs = ((data.get('blng_sents_part') or {}).get('sentence-pair') or [])[:3]
        sentences_list = []
        for p in pairs:
            en = (p.get('sentence') or '').strip()
            zh = (p.get('sentence-translation') or '').strip()
            if en:
                sentences_list.append({'en': en, 'zh': zh})
        return {'ok': bool(sentences_list), 'word': word, 'sentences': sentences_list}
    except Exception as ex:
        return {'ok': False, 'error': str(ex)}


def ai_chat(body):
    """OpenAI 兼容 chat/completions 代理：本地转发，避免浏览器跨域限制。
    body 为已解析的 JSON（None 表示非法请求体，由 server.py 的 read_body 给出）。"""
    if body is None:
        return {'ok': False, 'error': '请求体不是有效的 JSON'}
    provider = str(body.get('provider') or '').strip()
    api_key = str(body.get('apiKey') or '').strip()
    model = str(body.get('model') or '').strip()
    base_url = str(body.get('baseUrl') or '').strip()
    message = str(body.get('message') or '').strip()
    thinking = bool(body.get('thinking'))  # 思考模式开关（前端全局设置）
    # 未传 Key（或传的是掩码）时：从服务器数据库读取已绑定 Key，实现跨设备生效
    if not api_key or api_key == '••••••••':
        cred = get_credentials(provider or None)
        if cred:
            provider = cred['provider']
            api_key = cred['key']
            if not model:
                model = cred['model']
            if not base_url:
                base_url = cred['baseUrl']
    if not provider or not api_key:
        return {'ok': False, 'error': '未绑定 API Key，请先到主页右上角「设置 → AI 设置」添加并保存'}
    if not model:
        return {'ok': False, 'error': '该服务商未选择模型，请到「AI 设置」中修改'}
    if not message:
        return {'ok': False, 'error': '缺少 message'}
    base = providers.resolve_base_url(provider, base_url)
    if not base:
        return {'ok': False, 'error': '未知服务商，或 OpenAI 兼容格式需要填写 Base URL'}
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
        with urllib.request.urlopen(req, timeout=config.AI_CHAT_TIMEOUT) as resp:
            result = json.loads(resp.read().decode('utf-8', 'ignore'))
        choices = result.get('choices') or []
        content = ''
        if choices:
            content = (choices[0].get('message') or {}).get('content') or ''
        return {'ok': True, 'content': content, 'model': model}
    except urllib.error.HTTPError as ex:
        try:
            err_text = ex.read().decode('utf-8', 'ignore')
        except Exception:
            err_text = ''
        return {'ok': False, 'status': ex.code, 'error': err_text or str(ex.reason)}
    except Exception as ex:
        return {'ok': False, 'error': str(ex)}
