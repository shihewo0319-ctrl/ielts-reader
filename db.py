#!/usr/bin/env python3
"""IELTS 学习台 数据层（SQLite）
- 负责建表与所有增删查操作，供 server.py 的 /api/* 路由调用
- 数据库文件：data/ielts.db（data/ 已 gitignore，不进入版本库）
- 表：articles 文章库 / words 生词本 / lookups 学习记录
"""
import json
import os
import sqlite3

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
DB_PATH = os.path.join(DATA_DIR, 'ielts.db')

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL UNIQUE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  word       TEXT NOT NULL UNIQUE,
  sentence   TEXT NOT NULL DEFAULT '',
  note       TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS lookups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  word          TEXT NOT NULL,
  sentence      TEXT NOT NULL DEFAULT '',
  article_title TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
"""


def get_conn():
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    return conn


def init_db():
    conn = get_conn()
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()


# ============ 文章 articles ============
def list_articles():
    """返回文章列表（不含正文，轻量）"""
    conn = get_conn()
    try:
        rows = conn.execute(
            'SELECT id, title, created_at, updated_at,'
            ' (SELECT length(content)) AS content_len'
            ' FROM articles ORDER BY updated_at DESC, id DESC').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def get_article(article_id):
    conn = get_conn()
    try:
        row = conn.execute(
            'SELECT * FROM articles WHERE id = ?', (article_id,)).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


def save_article(title, content):
    """保存文章；标题相同时覆盖更新（先查后插/更新，不依赖 UNIQUE 约束）"""
    conn = get_conn()
    try:
        row = conn.execute('SELECT id FROM articles WHERE title = ?', (title,)).fetchone()
        if row:
            conn.execute(
                'UPDATE articles SET content = ?,'
                " updated_at = datetime('now','localtime') WHERE id = ?",
                (content, row['id']))
            aid = row['id']
        else:
            cur = conn.execute('INSERT INTO articles (title, content) VALUES (?, ?)',
                               (title, content))
            aid = cur.lastrowid
        conn.commit()
        return aid
    finally:
        conn.close()


def delete_article(article_id):
    conn = get_conn()
    try:
        conn.execute('DELETE FROM articles WHERE id = ?', (article_id,))
        conn.commit()
    finally:
        conn.close()


# ============ 生词本 words ============
def list_words():
    conn = get_conn()
    try:
        rows = conn.execute(
            'SELECT id, word, sentence, note, created_at'
            ' FROM words ORDER BY created_at DESC, id DESC').fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def add_word(word, sentence='', note=''):
    """加入生词本；单词已存在时更新句子/备注"""
    conn = get_conn()
    try:
        conn.execute(
            'INSERT INTO words (word, sentence, note) VALUES (?, ?, ?)'
            ' ON CONFLICT(word) DO UPDATE SET sentence=excluded.sentence,'
            ' note=excluded.note',
            (word, sentence, note))
        conn.commit()
        row = conn.execute('SELECT id FROM words WHERE word = ?', (word,)).fetchone()
        return row['id']
    finally:
        conn.close()


def delete_word(word_id):
    conn = get_conn()
    try:
        conn.execute('DELETE FROM words WHERE id = ?', (word_id,))
        conn.commit()
    finally:
        conn.close()


# ============ 学习记录 lookups ============
def list_lookups(limit=100):
    conn = get_conn()
    try:
        rows = conn.execute(
            'SELECT id, word, sentence, article_title, created_at'
            ' FROM lookups ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def add_lookup(word, sentence='', article_title=''):
    conn = get_conn()
    try:
        conn.execute(
            'INSERT INTO lookups (word, sentence, article_title) VALUES (?, ?, ?)',
            (word, sentence, article_title))
        conn.commit()
    finally:
        conn.close()


def clear_lookups():
    conn = get_conn()
    try:
        conn.execute('DELETE FROM lookups')
        conn.commit()
    finally:
        conn.close()


if __name__ == '__main__':
    # 自检：初始化数据库并打印表结构
    init_db()
    conn = get_conn()
    try:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        print('数据库已初始化：', DB_PATH)
        print('表：', ', '.join(tables))
    finally:
        conn.close()
