#!/usr/bin/env python3
"""IELTS 学习台 数据层（SQLite）
- 负责建表、版本迁移与所有增删查操作，供 /api/* 路由调用
- 数据库文件：data/ielts.db（data/ 已 gitignore，不进入版本库）
- 迁移机制：PRAGMA user_version 记录 schema 版本，MIGRATIONS 按版本逐级执行（幂等，可重复调用）
- 使用：统一用 `with cursor() as conn:` 上下文管理器，自动提交/回滚/关闭，不再手写 get_conn/close
- 路径常量来自 config.py，本模块不再自行拼路径
"""
import os
import sqlite3
from contextlib import contextmanager

from config import DATA_DIR, DB_PATH

# ============ Schema 与迁移 ============
# v1：初始四张表（articles 文章库 / words 生词本 / lookups 学习记录 / settings 键值设置）
SCHEMA_V1 = """
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
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
"""

# v2：lookups 增加 article_id（可空，兼容旧数据，关联文章库）+ 常用索引
SCHEMA_V2 = """
ALTER TABLE lookups ADD COLUMN article_id INTEGER;
CREATE INDEX IF NOT EXISTS idx_lookups_word    ON lookups(word);
CREATE INDEX IF NOT EXISTS idx_lookups_article ON lookups(article_id);
CREATE INDEX IF NOT EXISTS idx_articles_updated ON articles(updated_at);
CREATE INDEX IF NOT EXISTS idx_words_created   ON words(created_at);
"""

# v3：背单词（艾宾浩斯间隔重复）——进度表 + 每日学习日志（打卡/统计）
# vid 词条 id 由前端词库定义（w:单词 / p:词组），服务端只存进度不存词条内容
SCHEMA_V3 = """
CREATE TABLE IF NOT EXISTS vocab_progress (
  vid        TEXT PRIMARY KEY,
  stage      INTEGER NOT NULL DEFAULT 0,   -- 0 新词 1 学习中 2 复习中 3 已掌握
  due        TEXT NOT NULL DEFAULT '',     -- 下次到期时间（本地时间 ISO）
  interval_d REAL NOT NULL DEFAULT 0,      -- 当前间隔（天；<1 为会话内分钟级）
  ease       REAL NOT NULL DEFAULT 2.5,    -- SM-2 难度系数
  reps       INTEGER NOT NULL DEFAULT 0,
  lapses     INTEGER NOT NULL DEFAULT 0,
  added_at   TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  last_at    TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_vocab_due ON vocab_progress(due);
CREATE TABLE IF NOT EXISTS vocab_log (
  day      TEXT PRIMARY KEY,               -- YYYY-MM-DD
  reviewed INTEGER NOT NULL DEFAULT 0,     -- 当天评分次数
  again    INTEGER NOT NULL DEFAULT 0,     -- 当天「忘了」次数
  new_cnt  INTEGER NOT NULL DEFAULT 0      -- 当天首次学习的新词数
);
"""

# 迁移清单：[(版本号, SQL)]，init_db() 从当前 user_version 逐级执行到最新
MIGRATIONS = [
    (1, SCHEMA_V1),
    (2, SCHEMA_V2),
    (3, SCHEMA_V3),
]


@contextmanager
def cursor():
    """数据库连接上下文管理器：自动提交 / 异常回滚 / 关闭连接"""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA journal_mode=WAL')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """建表 + 按 user_version 逐级执行迁移（幂等，可重复调用）"""
    with cursor() as conn:
        version = conn.execute('PRAGMA user_version').fetchone()[0]
        for v, sql in MIGRATIONS:
            if v > version:
                conn.executescript(sql)
                conn.execute('PRAGMA user_version = %d' % v)


# ============ 文章 articles ============
def list_articles():
    """返回文章列表（不含正文，轻量）"""
    with cursor() as conn:
        rows = conn.execute(
            'SELECT id, title, created_at, updated_at,'
            ' (SELECT length(content)) AS content_len'
            ' FROM articles ORDER BY updated_at DESC, id DESC').fetchall()
        return [dict(r) for r in rows]


def get_article(article_id):
    with cursor() as conn:
        row = conn.execute('SELECT * FROM articles WHERE id = ?', (article_id,)).fetchone()
        return dict(row) if row else None


def save_article(title, content):
    """保存文章；标题相同时覆盖更新（先查后插/更新，不依赖 UNIQUE 约束）"""
    with cursor() as conn:
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
        return aid


def delete_article(article_id):
    with cursor() as conn:
        conn.execute('DELETE FROM articles WHERE id = ?', (article_id,))


# ============ 生词本 words ============
def list_words():
    with cursor() as conn:
        rows = conn.execute(
            'SELECT id, word, sentence, note, created_at'
            ' FROM words ORDER BY created_at DESC, id DESC').fetchall()
        return [dict(r) for r in rows]


def add_word(word, sentence='', note=''):
    """加入生词本；单词已存在时更新句子/备注"""
    with cursor() as conn:
        conn.execute(
            'INSERT INTO words (word, sentence, note) VALUES (?, ?, ?)'
            ' ON CONFLICT(word) DO UPDATE SET sentence=excluded.sentence,'
            ' note=excluded.note',
            (word, sentence, note))
        row = conn.execute('SELECT id FROM words WHERE word = ?', (word,)).fetchone()
        return row['id']


def delete_word(word_id):
    with cursor() as conn:
        conn.execute('DELETE FROM words WHERE id = ?', (word_id,))


# ============ 学习记录 lookups ============
def list_lookups(limit=100):
    with cursor() as conn:
        rows = conn.execute(
            'SELECT id, word, sentence, article_title, article_id, created_at'
            ' FROM lookups ORDER BY id DESC LIMIT ?', (limit,)).fetchall()
        return [dict(r) for r in rows]


def add_lookup(word, sentence='', article_title='', article_id=None):
    """记录一次查词；article_id 可空（粘贴文本无文章 id 时为 None）"""
    with cursor() as conn:
        conn.execute(
            'INSERT INTO lookups (word, sentence, article_title, article_id)'
            ' VALUES (?, ?, ?, ?)',
            (word, sentence, article_title, article_id))


def clear_lookups():
    with cursor() as conn:
        conn.execute('DELETE FROM lookups')


# ============ 设置 settings（键值对，用于加密后的 API Key 等） ============
def get_setting(key):
    """读取设置项；不存在返回 ''"""
    with cursor() as conn:
        row = conn.execute('SELECT value FROM settings WHERE key = ?', (key,)).fetchone()
        return row['value'] if row else ''


def set_setting(key, value):
    """写入设置项（存在则覆盖）"""
    with cursor() as conn:
        conn.execute(
            'INSERT INTO settings (key, value) VALUES (?, ?)'
            ' ON CONFLICT(key) DO UPDATE SET value=excluded.value',
            (key, str(value)))


def delete_setting(key):
    with cursor() as conn:
        conn.execute('DELETE FROM settings WHERE key = ?', (key,))


# ============ 背单词 vocab（艾宾浩斯间隔重复） ============
def list_vocab_progress():
    """全部词条进度（前端与词库 join 后自行组队列）"""
    with cursor() as conn:
        rows = conn.execute('SELECT * FROM vocab_progress').fetchall()
        return [dict(r) for r in rows]


def save_vocab_review(item):
    """upsert 一条词条进度（间隔计算在前端 srs.js，服务端只持久化）"""
    with cursor() as conn:
        conn.execute(
            'INSERT INTO vocab_progress (vid, stage, due, interval_d, ease, reps, lapses, last_at)'
            " VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))"
            ' ON CONFLICT(vid) DO UPDATE SET stage=excluded.stage, due=excluded.due,'
            ' interval_d=excluded.interval_d, ease=excluded.ease, reps=excluded.reps,'
            ' lapses=excluded.lapses, last_at=excluded.last_at',
            (item['vid'], item['stage'], item['due'], item['interval_d'],
             item['ease'], item['reps'], item['lapses']))


def vocab_log_bump(day, reviewed=0, again=0, new_cnt=0):
    """累计当日学习日志（打卡 / 统计用，幂等 upsert 自增）"""
    with cursor() as conn:
        conn.execute(
            'INSERT INTO vocab_log (day, reviewed, again, new_cnt) VALUES (?, ?, ?, ?)'
            ' ON CONFLICT(day) DO UPDATE SET reviewed=reviewed+excluded.reviewed,'
            ' again=again+excluded.again, new_cnt=new_cnt+excluded.new_cnt',
            (day, reviewed, again, new_cnt))


def list_vocab_log(limit=400):
    with cursor() as conn:
        rows = conn.execute(
            'SELECT * FROM vocab_log ORDER BY day DESC LIMIT ?', (limit,)).fetchall()
        return [dict(r) for r in rows]


def reset_vocab_progress(vid=None):
    """清除学习进度：指定词条重置，或不带 vid 清空全部"""
    with cursor() as conn:
        if vid:
            conn.execute('DELETE FROM vocab_progress WHERE vid = ?', (vid,))
        else:
            conn.execute('DELETE FROM vocab_progress')


if __name__ == '__main__':
    # 自检：初始化数据库并打印表结构 / 版本 / 索引
    init_db()
    with cursor() as conn:
        tables = [r[0] for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        version = conn.execute('PRAGMA user_version').fetchone()[0]
        print('数据库已初始化：', DB_PATH)
        print('schema 版本：', version)
        print('表：', ', '.join(tables))
