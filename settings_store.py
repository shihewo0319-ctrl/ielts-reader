#!/usr/bin/env python3
"""AI 设置存储（API Key 加密入库）

- settings 表的三个键：ai_api_keys / ai_default_provider / ai_thinking
- 读取 / 保存 / 凭证获取都集中在这里；api_db.py（路由层）与 proxy.py（AI 代理层）只负责调用
- 加密走 secure.py（Fernet）：数据库里只存密文，浏览器拿不到明文 Key
"""
import json

import db
import secure

# API Key 掩码：前端编辑时输入框里的占位符，后端见到它表示"保留原 Key 不变"
MASK = '••••••••'
# settings 表中的键名
K_KEYS = 'ai_api_keys'             # 加密后的 JSON：{provider: {key, model, baseUrl}}
K_DEFAULT = 'ai_default_provider'  # 默认服务商 id
K_THINKING = 'ai_thinking'         # 思考模式：'1' / '0'


def load_state():
    """读取并解密 AI 设置：{keys, defaultProvider, thinking}"""
    keys = {}
    raw = db.get_setting(K_KEYS)
    if raw:
        try:
            keys = json.loads(secure.decrypt_text(raw) or '{}')
        except Exception:
            keys = {}
    # v1.1.42 兼容修复：v1.1.40/41 误把内层 Key 也加密了一次（双重加密），
    # 读取时若发现内层 key 仍是 Fernet 密文（gAAAA 开头）则再解密一次，并把修复后的数据回写（幂等）
    repaired = False
    for pid in list(keys.keys()):
        conf = keys[pid]
        if isinstance(conf, dict) and isinstance(conf.get('key'), str) and conf['key'].startswith('gAAAA'):
            inner = secure.decrypt_text(conf['key'])
            if inner:
                conf['key'] = inner
                repaired = True
    if repaired:
        if keys:
            db.set_setting(K_KEYS, secure.encrypt_text(json.dumps(keys, ensure_ascii=False)))
        else:
            db.delete_setting(K_KEYS)
    default = db.get_setting(K_DEFAULT)
    thinking = db.get_setting(K_THINKING) == '1'
    return {'keys': keys, 'defaultProvider': default, 'thinking': thinking}


def get_credentials(provider=None):
    """返回某服务商（缺省为默认服务商）的解密凭证 {provider, key, model, baseUrl}；
    未绑定返回 None。供 proxy.ai_chat 在未传 apiKey 时回退使用。"""
    state = load_state()
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


def safe_state():
    """GET /api/settings 的安全视图：不返回真实 Key，只给"是否已绑定"标记"""
    state = load_state()
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


def save_settings(body):
    """整体保存 AI 设置：keys 合并保存（MASK 保留原 Key、空值删除）、defaultProvider、thinking"""
    state = load_state()
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
                # 注意：只在外层加密整个 JSON（下方 db.set_setting），这里不要再单独加密 key，
                # 否则会双重加密导致发给服务商的是密文（v1.1.42 修复）
                new[pid] = {
                    'key': key_val,
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

    # 只更新请求里显式给出的字段：避免"只改思考模式"时误把默认服务商清空
    if 'defaultProvider' in body:
        db.set_setting(K_DEFAULT, str(body.get('defaultProvider') or '').strip())
    if 'thinking' in body and body.get('thinking') is not None:
        db.set_setting(K_THINKING, '1' if body.get('thinking') else '0')
    return {'ok': True}
