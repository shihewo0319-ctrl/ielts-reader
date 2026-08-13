#!/usr/bin/env python3
"""IELTS 学习台 数据库 API 路由

server.py 把 /api/articles、/api/words、/api/lookups 三类请求转交给本模块：
  - articles 文章库：GET 列表/详情、POST 保存（标题相同覆盖）、DELETE 删除
  - words    生词本：GET 列表、POST 添加、DELETE 删除
  - lookups  学习记录：GET 最近记录、POST 添加一条查词记录

handle_* 返回 None 表示"不是数据库路由"，由 server.py 走默认逻辑。
数据读写统一走 db.py（SQLite），本模块只负责解析请求参数与组装响应。
"""
import json
import urllib.parse

import db


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
    return None
