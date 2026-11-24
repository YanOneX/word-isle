// GitHub 私有仓库同步：用 Contents API 读写 state.json
// token 只保存在本机浏览器的 localStorage，不进入导出备份，也不随应用上传。

const API = 'https://api.github.com';
const CFG_KEY = 'bwt_gh_sync_v1';
const FILE = 'state.json';
const MAX_BYTES = 20 * 1024 * 1024;
const TIMEOUT = 30000;

export function loadSyncConfig() {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (!raw || !raw.owner || !raw.repo || !raw.token) return null;
    return normalizeConfig(raw);
  } catch {
    return null;
  }
}

export function normalizeConfig(input = {}) {
  let owner = String(input.owner || '').trim().replace(/^@/, '');
  let repo = String(input.repo || '').trim();
  const fromUrl = /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i.exec(repo);
  if (fromUrl) {
    owner = owner || fromUrl[1];
    repo = fromUrl[2];
  }
  owner = owner.replace(/^https?:\/\/github\.com\//i, '').split('/')[0];
  repo = repo.replace(/^https?:\/\/github\.com\/[^/]+\//i, '').split('/')[0].replace(/\.git$/i, '');
  return {
    owner,
    repo,
    branch: String(input.branch || 'main').trim() || 'main',
    token: String(input.token || '').trim(),
  };
}

export function saveSyncConfig(input) {
  const cfg = normalizeConfig(input);
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  return cfg;
}

export function clearSyncConfig() {
  localStorage.removeItem(CFG_KEY);
}

export function syncConfigKey() {
  return CFG_KEY;
}

function assertConfig(cfg) {
  if (!cfg || !cfg.owner || !cfg.repo || !cfg.token) throw new Error('请先完成 GitHub 同步设置');
}

function apiPath(cfg, suffix = '') {
  return `/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}${suffix}`;
}

function contentPath(cfg) {
  return apiPath(cfg, `/contents/${encodeURIComponent(FILE)}`);
}

async function gh(cfg, path, { method = 'GET', body } = {}) {
  assertConfig(cfg);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${cfg.token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === 'AbortError') throw new Error('连接 GitHub 超时，请稍后重试');
    throw new Error('无法连接 GitHub，请检查网络或代理');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    let message = '';
    try {
      const data = await res.json();
      message = data && data.message ? data.message : '';
    } catch {}
    const err = new Error(message || `GitHub 返回 ${res.status}`);
    err.status = res.status;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function decodeBase64(b64) {
  const bin = atob(String(b64 || '').replace(/\s+/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export async function getRemoteMeta(cfg) {
  try {
    const data = await gh(cfg, contentPath(cfg));
    if (Array.isArray(data)) throw new Error('远端路径不是文件');
    return {
      exists: true,
      sha: data.sha,
      size: data.size || 0,
      htmlUrl: data.html_url || '',
    };
  } catch (e) {
    if (e.status === 404) {
      // 404 可能是 state.json 还没有，也可能是仓库不存在/无权访问；再查一次仓库本身。
      try {
        await gh(cfg, apiPath(cfg));
      } catch (repoErr) {
        if (repoErr.status === 404) {
          const err = new Error('仓库不存在，或 token 没有访问权限');
          err.status = 404;
          throw err;
        }
        throw repoErr;
      }
      return { exists: false, size: 0 };
    }
    throw e;
  }
}

export async function getRemoteCommitDate(cfg) {
  try {
    const list = await gh(cfg, apiPath(cfg, `/commits?path=${encodeURIComponent(FILE)}&per_page=1`));
    return list && list[0] && list[0].commit && list[0].commit.committer
      ? list[0].commit.committer.date
      : null;
  } catch {
    return null;
  }
}

export async function uploadRemote(cfg, text) {
  assertConfig(cfg);
  if (typeof text !== 'string' || !text) throw new Error('没有可上传的数据');
  const bytes = new TextEncoder().encode(text).length;
  if (bytes > MAX_BYTES) throw new Error('存档超过 20 MB，无法通过 GitHub Contents API 上传');

  const meta = await getRemoteMeta(cfg);
  const body = {
    message: `sync ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
    content: encodeBase64(text),
    branch: cfg.branch || 'main',
  };
  if (meta.exists) body.sha = meta.sha;

  try {
    const res = await gh(cfg, contentPath(cfg), { method: 'PUT', body });
    return { sha: res.content && res.content.sha, size: res.content && res.content.size };
  } catch (e) {
    // 另一端刚上传过会导致 sha 冲突；取最新 sha 再试一次，最后一次写入生效。
    if (e.status === 409 || e.status === 422) {
      const latest = await getRemoteMeta(cfg);
      if (latest.exists) {
        body.sha = latest.sha;
        const res = await gh(cfg, contentPath(cfg), { method: 'PUT', body });
        return { sha: res.content && res.content.sha, size: res.content && res.content.size, overwritten: true };
      }
    }
    throw e;
  }
}

export async function downloadRemote(cfg) {
  assertConfig(cfg);
  const data = await gh(cfg, contentPath(cfg));
  if (Array.isArray(data)) throw new Error('远端路径不是文件');
  if (data.content && data.encoding === 'base64') {
    return { text: decodeBase64(data.content), size: data.size || 0, sha: data.sha };
  }
  // 1 MB 以上的文件 Contents API 不返回正文，改用 Git Blobs API。
  const blob = await gh(cfg, apiPath(cfg, `/git/blobs/${data.sha}`));
  if (!blob || blob.encoding !== 'base64') throw new Error('无法读取远端存档');
  return { text: decodeBase64(blob.content), size: data.size || 0, sha: data.sha };
}

export function friendlyError(e) {
  if (!e) return '未知错误';
  if (e.status === 401) return 'token 无效或已过期，请重新生成';
  if (e.status === 403) {
    if (/rate limit/i.test(e.message || '')) return 'GitHub API 访问次数超限，请稍后再试';
    return 'token 没有该仓库的读写权限';
  }
  if (e.status === 404) return '仓库或 state.json 不存在，请检查用户名、仓库名和 token 权限';
  if (e.status === 409 || e.status === 422) return '远端存档刚被其他设备更新，请重试';
  if (e.status === 413) return '存档太大，GitHub 拒绝接收';
  return e.message || '请求失败';
}

export function formatSize(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
