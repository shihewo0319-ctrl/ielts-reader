/* ============ API 请求封装（统一 fetch + 超时 + 业务错误） ============
 * 所有前端请求都走这里：fetchJson（GET）/ postJson（POST）/ deleteJson（DELETE）。
 * 后端统一返回 {ok:true,...} / {ok:false,error}：
 *   - HTTP 非 2xx 或 ok=false 时抛 Error（message 为错误信息；err.status 为 HTTP 或业务状态码）
 *   - ok=true 时返回完整响应体
 * 注意：fetchJson 保持"原始 JSON 获取"，不校验 ok（外部词典 API 的响应结构不同）；
 * postJson / deleteJson 校验 ok 并抛错，业务层 try/catch 即可。
 */
export async function fetchJson(url, timeout = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function requestJson(method, url, body, timeout) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const opts = { method, signal: ctrl.signal };
    if (body !== undefined) {
      opts.headers = { 'Content-Type': 'application/json' };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    if (!res.ok) {
      const err = new Error('请求失败');
      err.status = res.status;
      throw err;
    }
    const data = await res.json();
    if (!data.ok) {
      const err = new Error(data.error || '请求失败');
      err.status = data.status || 0; // 0 = HTTP 200 但业务失败（后端未带 status）
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export function postJson(url, body, timeout = 8000) {
  return requestJson('POST', url, body, timeout);
}

export function deleteJson(url, timeout = 8000) {
  return requestJson('DELETE', url, undefined, timeout);
}
