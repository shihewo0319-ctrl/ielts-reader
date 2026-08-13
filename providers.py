#!/usr/bin/env python3
"""AI 服务商静态数据（后端）

与前端 src/lib/providers.js 保持一致：服务商 id → OpenAI 兼容官方端点。
Base URL 允许用户手动覆盖（OpenAI 兼容格式必填），默认取官方端点。
"""
# 服务商 → OpenAI 兼容端点（/chat/completions 的前缀）
ENDPOINTS = {
    'openai': 'https://api.openai.com/v1',
    'deepseek': 'https://api.deepseek.com/v1',
    'opencode': 'https://opencode.ai/zen/v1',
    'go': 'https://opencode.ai/zen/go/v1',
}


def resolve_base_url(provider, base_url=''):
    """返回有效 Base URL：优先用户填写值，其次官方端点；未知服务商返回 ''"""
    return (base_url or '').strip() or ENDPOINTS.get(provider, '')
