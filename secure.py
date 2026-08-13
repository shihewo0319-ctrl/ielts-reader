#!/usr/bin/env python3
"""API Key 加密存储（Fernet 对称加密）

- 主密钥保存在 data/.secrets.key（权限 600，首次启动自动生成，data/ 已 gitignore）
- 服务器重启后密钥不变，已加密的 API Key 仍可解密（单用户本地场景）
- db.py 只负责存取密文，不接触加密细节；本模块负责加解密
"""
import os

from cryptography.fernet import Fernet

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
KEY_FILE = os.path.join(DATA_DIR, '.secrets.key')


def get_or_create_key():
    """读取主密钥；不存在则生成 600 权限的新密钥文件"""
    os.makedirs(DATA_DIR, exist_ok=True)
    if os.path.exists(KEY_FILE):
        with open(KEY_FILE, 'rb') as f:
            return f.read().strip()
    key = Fernet.generate_key()
    fd = os.open(KEY_FILE, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(key)
    except Exception:
        os.close(fd)
        raise
    return key


def _fernet():
    return Fernet(get_or_create_key())


def encrypt_text(plaintext):
    """加密明文 → Fernet token 字符串（密文）"""
    if plaintext is None:
        return ''
    return _fernet().encrypt(str(plaintext).encode('utf-8')).decode('ascii')


def decrypt_text(token):
    """解密 Fernet token 字符串 → 明文；失败返回 ''"""
    try:
        if not token:
            return ''
        return _fernet().decrypt(token.encode('ascii')).decode('utf-8')
    except Exception:
        return ''


if __name__ == '__main__':
    t = encrypt_text('sk-test-123')
    print('密文:', t)
    print('解密:', decrypt_text(t))
    print('密钥文件:', KEY_FILE)
