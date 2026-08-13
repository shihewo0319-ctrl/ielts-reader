#!/usr/bin/env python3
"""IELTS 学习台 数据库 API 路由

server.py 把 /api/articles、/api/words、/api/lookups、/api/settings 请求转交给本模块：
  - articles 文章库：GET 列表/详情、POST 保存（标题相同覆盖）、DELETE 删除
  - words    生词本：GET 列表、POST 添加、DELETE 删除
  - lookups  学习记录：GET 最近记录、POST 添加一条查词记录、DELETE 清空
  - settings 设置：GET 读取 / POST 整体保存（API Key 加密后入库，浏览器拿不到真实 Key）

handle_* 返回 None 表示"不是数据库路由"，由 server.py 走默认逻辑。
数据读写统一走 db.py（SQLite），本模块只负责解析请求参数与组装响应。
"""
import json
import urllib.parse

import db
import secure

# API Key 掩码：前端编辑时输入框里的占位符，后端见到它表示"保留原 Key 不变"
MASK = '••••••••'
# settings 表中的键名
K_KEYS = 'ai_api_keys'          # 加密后的 JSON：{provider: {key, model, baseUrl}}
K_DEFAULT = 'ai_default_provider'  # 默认服务商 id
K_THINKING = 'ai_thinking'         # 思考模式：'1' / '0'


def read_body(handler):
    """读取并解析 JSON 请求体；非法 JSON 返回 None"""
    try:
        length = int(handler.headers.get('Content-Length') or 0)
        if length <= 0:
            return {}
        return json.loads(handler.rfile.read(length).decode('utf-8'))
    except Exception:
        return None


def _first(query, key):
    vals = query.get(key) or []
    return vals[0].strip() if vals else ''


def _int(query, key):
    raw = _first(query, key)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


# ============ AI 设置（API Key 加密存储） ============
def _load_ai_state():
    """读取并解密 AI 设置：{keys:{provider:{key,model,baseUrl}}, defaultProvider, thinking}"""
    keys = {}
    raw = db.get_setting(K_KEYS)
    if raw:
        try:
            keys = json.loads(secure.decrypt_text(raw) or '{}')
        except Exception:
            keys = {}
    default = db.get_setting(K_DEFAULT)
    thinking = db.get_setting(K_THINKING) == '1'
    return {'keys': keys, 'defaultProvider': default, 'thinking': thinking}


def get_ai_credentials(provider=None):
    """返回某服务商（缺省为默认服务商）的解密凭证 {key, model, baseUrl}；
    未绑定返回 None。供 server.py 的 /api/ai_chat 在未传 apiKey 时回退使用。"""
    state = _load_ai_state()
    keys = state['keys'] or {}
    pid = provider or state['defaultProvider'] or ''
    conf = keys.get(pid)
    if conf and conf.get('key'):
        return {'provider': pid, 'key': conf['key'],
                'model': conf.get('model') or '',
                'baseUrl': conf.get('baseUrl') or ''}
    # provider 指定但未绑定：回退默认服务商
    if provider and state['defaultProvider'] and provider != state['defaultProvider']:
        conf = keys.get(state['defaultProvider'])
        if conf and conf.get('key'):
            return {'provider': state['defaultProvider'], 'key': conf['key'],
                    'model': conf.get('model') or '',
                    'baseUrl': conf.get('baseUrl') or ''}
    return None


def handle_get(path, query):
    if path == '/api/articles':
        aid = _int(query, 'id')
        if aid is not None:
            article = db.get_article(aid)
            if not article:
                return {'ok': False, 'error': '文章不存在'}
            return {'ok': True, 'article': article}
        return {'ok': True, 'articles': db.list_articles()}
    if path == '/api/words':
        return {'ok': True, 'words': db.list_words()}
    if path == '/api/lookups':
        limit = _int(query, 'limit') or 100
        return {'ok': True, 'lookups': db.list_lookups(min(max(limit, 1), 500))}
    if path == '/api/settings':
        state = _load_ai_state()
        # 不返回真实 Key，只给"是否已绑定"标记，前端展示掩码即可
        safe = {}
        for pid, conf in (state['keys'] or {}).items():
            safe[pid] = {
                'model': conf.get('model') or '',
                'baseUrl': conf.get('baseUrl') or '',
                'hasKey': bool(conf.get('key')),
            }
        return {'ok': True, 'keys': safe,
                'defaultProvider': state['defaultProvider'],
                'thinking': state['thinking']}
    return None


def handle_post(path, query, body):
    if body is None:
        return {'ok': False, 'error': '请求体不是有效的 JSON'}
    if path == '/api/articles':
        title = str(body.get('title') or '').strip()
        content = str(body.get('content') or '').strip()
        if not title or not content:
            return {'ok': False, 'error': '缺少 title 或 content'}
        aid = db.save_article(title, content)
        return {'ok': True, 'id': aid}
    if path == '/api/words':
        word = str(body.get('word') or '').strip()
        if not word:
            return {'ok': False, 'error': '缺少 word'}
        wid = db.add_word(
            word,
            str(body.get('sentence') or '').strip(),
            str(body.get('note') or '').strip())
        return {'ok': True, 'id': wid}
    if path == '/api/lookups':
        word = str(body.get('word') or '').strip()
        if not word:
            return {'ok': False, 'error': '缺少 word'}
        db.add_lookup(
            word,
            str(body.get('sentence') or '').strip(),
            str(body.get('article_title') or '').strip())
        return {'ok': True}
    if path == '/api/settings':
        return _save_settings(body)
    return None


def _save_settings(body):
    """整体保存 AI 设置：keys 合并保存（MASK 保留原 Key、空值删除）、defaultProvider、thinking"""
    state = _load_ai_state()
    old = state['keys'] or {}
    new = {}
    incoming = body.get('keys')
    if isinstance(incoming, dict):
        for pid, conf in incoming.items():
            pid = str(pid).strip()
            if not isinstance(conf, dict):
                continue
            key_val = str(conf.get('key') or '').strip()
            if key_val == MASK:
                # 保留原 Key（前端看不到真实 Key）
                if old.get(pid, {}).get('key'):
                    new[pid] = {
                        'key': old[pid]['key'],
                        'model': str(conf.get('model') or old[pid].get('model') or '').strip(),
                        'baseUrl': str(conf.get('baseUrl') or old[pid].get('baseUrl') or '').strip(),
                    }
            elif key_val:
                new[pid] = {
                    'key': secure.encrypt_text(key_val),
                    'model': str(conf.get('model') or '').strip(),
                    'baseUrl': str(conf.get('baseUrl') or '').strip(),
                }
            # key_val 为空：视为删除该服务商，不加入 new
    else:
        # 未传 keys：保留原有
        new = old

    if new:
        db.set_setting(K_KEYS, secure.encrypt_text(json.dumps(new, ensure_ascii=False)))
    else:
        db.delete_setting(K_KEYS)

    default = str(body.get('defaultProvider') or '').strip()
    db.set_setting(K_DEFAULT, default)
    if body.get('thinking') is not None:
        db.set_setting(K_THINKING, '1' if body.get('thinking') else '0')
    return {'ok': True}


def handle_delete(path, query):
    if path == '/api/articles':
        aid = _int(query, 'id')
        if aid is None:
            return {'ok': False, 'error': '缺少 id'}
        db.delete_article(aid)
        return {'ok': True}
    if path == '/api/words':
        wid = _int(query, 'id')
        if wid is None:
            return {'ok': False, 'error': '缺少 id'}
        db.delete_word(wid)
        return {'ok': True}
    if path == '/api/lookups':
        # 不带 id：清空全部学习记录（生词本不可整体清空，避免误删）
        db.clear_lookups()
        return {'ok': True}
    return None
