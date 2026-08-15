#!/usr/bin/env python3
"""IELTS 学习台 数据库 API 路由

server.py 把 /api/articles、/api/words、/api/lookups、/api/settings 请求转交给本模块：
  - articles 文章库：GET 列表/详情、POST 保存（标题相同覆盖）、DELETE 删除
  - words    生词本：GET 列表、POST 添加、DELETE 删除
  - lookups  学习记录：GET 最近记录、POST 添加一条查词记录、DELETE 清空
  - settings 设置：GET 读取 / POST 整体保存（API Key 加密后入库，浏览器拿不到真实 Key）

handle_* 返回 None 表示"不是数据库路由"，由 server.py 走默认逻辑。
数据读写统一走 db.py（SQLite），本模块只负责解析请求参数与组装响应；
AI 设置的加解密 / 保存逻辑在 settings_store.py，本模块只做路由转发。
"""
import json

import db
from settings_store import safe_state, save_settings


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


def _body_int(body, key):
    """从 POST JSON 体里取整数（值可为 null / '' / 数字字符串）"""
    raw = body.get(key) if isinstance(body, dict) else None
    if raw is None or raw == '':
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
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
        return safe_state()
    if path == '/api/vocab/progress':
        return {'ok': True, 'progress': db.list_vocab_progress()}
    if path == '/api/vocab/log':
        return {'ok': True, 'log': db.list_vocab_log()}
    if path == '/api/vocab/settings':
        return {
            'ok': True,
            'daily_new': int(db.get_setting('vocab.daily_new') or 10),
            'tiers': db.get_setting('vocab.tiers') or '1,2,3,p',
        }
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
            str(body.get('article_title') or '').strip(),
            _body_int(body, 'article_id'))
        return {'ok': True}
    if path == '/api/settings':
        return save_settings(body)
    if path == '/api/vocab/review':
        # 前端 srs.js 算好下一状态，服务端持久化并累计当日日志
        vid = str(body.get('vid') or '').strip()
        if not vid:
            return {'ok': False, 'error': '缺少 vid'}
        item = {
            'vid': vid,
            'stage': _body_int(body, 'stage') or 0,
            'due': str(body.get('due') or ''),
            'interval_d': float(body.get('interval_d') or 0),
            'ease': float(body.get('ease') or 2.5),
            'reps': _body_int(body, 'reps') or 0,
            'lapses': _body_int(body, 'lapses') or 0,
        }
        db.save_vocab_review(item)
        day = str(body.get('day') or '')[:10]
        if day:
            db.vocab_log_bump(
                day,
                reviewed=1,
                again=1 if _body_int(body, 'grade') == 0 else 0,
                new_cnt=1 if body.get('was_new') else 0)
        return {'ok': True}
    if path == '/api/vocab/settings':
        daily = _body_int(body, 'daily_new')
        if daily is not None:
            db.set_setting('vocab.daily_new', max(1, min(100, daily)))
        tiers = str(body.get('tiers') or '').strip()
        if tiers:
            db.set_setting('vocab.tiers', tiers[:40])
        return {'ok': True}
    return None


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
    if path == '/api/vocab/progress':
        vid = _first(query, 'vid')
        db.reset_vocab_progress(vid or None)
        return {'ok': True}
    return None
