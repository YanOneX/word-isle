// 我的：当前词书、入口、全部学习设置、备份与重置

import { esc, fmtNum, dayKey } from '../util.js';
import { icon, toast, bookCover, openModal, confirmDialog } from '../ui.js';
import {
  state,
  settings,
  setSetting,
  bookProgress,
  masteredCount,
  learnedCount,
  wrongRecords,
  favoriteRecords,
  exportBackup,
  importBackup,
  resetAll,
} from '../store.js';
import { bookById } from '../data.js';
import {
  loadSyncConfig,
  saveSyncConfig,
  clearSyncConfig,
  getRemoteMeta,
  getRemoteCommitDate,
  uploadRemote,
  downloadRemote,
  friendlyError,
  formatSize,
} from '../github.js';
import { showOnboarding } from './onboarding.js';

function toggleRow(key, label, hint) {
  const on = !!settings()[key];
  return `<div class="set-row"><div class="set-label">${label}${hint ? `<span class="hint">${hint}</span>` : ''}</div>
    <button class="toggle ${on ? 'on' : ''}" data-toggle="${key}" aria-label="${esc(label)}"></button></div>`;
}

function segRow(key, label, options) {
  const cur = settings()[key];
  return `<div class="set-row"><div class="set-label">${label}</div>
    <div class="mini-seg" data-seg="${key}">${options
      .map(([v, t]) => `<button data-val="${esc(v)}" class="${cur === v ? 'on' : ''}">${t}</button>`)
      .join('')}</div></div>`;
}

function stepperRow(key, label, min, max, suffix) {
  const v = settings()[key];
  return `<div class="set-row"><div class="set-label">${label}</div>
    <div class="stepper" data-stepper="${key}" data-min="${min}" data-max="${max}" data-suffix="${esc(suffix)}">
      <button data-step="-1">${icon('minus')}</button><span>${v} ${suffix}</span><button data-step="1">${icon('plus')}</button>
    </div></div>`;
}

function openHelp() {
  openModal(
    `<div>
      <div class="dlg-title">使用帮助</div>
      <div class="dlg-body">· 首页「开始学习」按当前词书顺序学习新词，每组词数可在设置中调整。
· 答错的词会立即进入拼写补救，拼对后才算过关，并按艾宾浩斯节奏安排复习。
· 复习入口只出现到期单词：第 1/7/30 天，具体在本地零点生效。
· 词库里可以切换词书、选择关卡；错词本和生词本支持拖动色块遮挡自测。
· 所有进度默认保存在本机浏览器；建议定期导出 JSON 备份。
· 多设备同步：在「GitHub 同步」绑定私有仓库，旧设备点「上传本机进度」，新设备填写同一仓库后点「从 GitHub 恢复」。
· token 只保存在当前浏览器，不会写进导出备份；公共电脑上用完请清除同步配置。</div>
      <div class="dlg-actions"><button class="btn primary" data-close>知道了</button></div>
    </div>`,
    { className: 'center' },
  );
}

function openAbout() {
  openModal(
    `<div>
      <div class="dlg-title">关于词屿</div>
      <div class="dlg-body">词屿是一个离线优先、独立实现的背单词 Web 应用。

学习进度默认保存在本机浏览器；绑定 GitHub 私有仓库后，可在手机与电脑之间手动上传、恢复进度。发音使用浏览器语音合成，单词插画按需从网络加载并缓存，离线时已有缓存的插画仍可显示。

本项目与任何视频平台及其创作者无关。</div>
      <div class="dlg-actions"><button class="btn primary" data-close>好的</button></div>
    </div>`,
    { className: 'center' },
  );
}

function exportFile() {
  try {
    const text = exportBackup();
    const blob = new Blob([text], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `词屿备份-${dayKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
    toast('备份已导出');
  } catch {
    toast('导出失败');
  }
}

function importFile(ctx) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', async () => {
    const f = input.files && input.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      const ok = await confirmDialog({
        title: '导入备份？',
        body: '导入会覆盖当前所有学习进度、设置与收藏。建议先导出当前备份。',
        okText: '确认导入',
        cancelText: '取消',
        danger: true,
      });
      if (!ok) return;
      importBackup(text);
      toast('备份导入成功');
      ctx.go('home');
    } catch (e) {
      toast('导入失败：' + (e.message || '文件格式不正确'));
    }
  });
  input.click();
}

function syncTime(value) {
  const d = new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function openSyncSettings(onSaved) {
  const existing = loadSyncConfig();
  const m = openModal(
    `<div>
      <div class="dlg-title">GitHub 同步设置</div>
      <div class="dlg-body">用一个 GitHub 私有仓库保存 state.json。token 只保存在这台设备的浏览器里，不会写进导出备份。</div>
      <div class="sync-form">
        <label class="sync-field">GitHub 用户名
          <input data-f="owner" value="${esc(existing ? existing.owner : '')}" placeholder="例如 octocat" autocomplete="username" spellcheck="false" />
        </label>
        <label class="sync-field">私有仓库名
          <input data-f="repo" value="${esc(existing ? existing.repo : 'word-isle-progress')}" placeholder="word-isle-progress" autocomplete="off" spellcheck="false" />
        </label>
        <label class="sync-field">分支
          <input data-f="branch" value="${esc(existing ? existing.branch : 'main')}" placeholder="main" autocomplete="off" spellcheck="false" />
        </label>
        <label class="sync-field">Fine-grained token
          <input data-f="token" type="password" value="" placeholder="${existing ? '已保存；留空保持不变' : 'github_pat_...'}" autocomplete="new-password" spellcheck="false" />
        </label>
      </div>
      <div class="sync-note">还没有仓库？<a href="https://github.com/new?name=word-isle-progress&visibility=private" target="_blank" rel="noopener">新建私有仓库</a>，名称填 <b>word-isle-progress</b>。<br />
      再到 <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">Fine-grained tokens</a> 生成 token：只选这个仓库，权限勾选 <b>Contents: Read and write</b>。<br />
      token 等同密码，不要发给别人；可随时在 GitHub 撤销。</div>
      <div class="dlg-actions">
        <button class="btn ghost" data-clear>清除</button>
        <button class="btn ghost" data-close>取消</button>
        <button class="btn primary" data-save>保存</button>
      </div>
    </div>`,
    { className: 'center' },
  );
  const sheet = m.sheet;
  const field = (name) => sheet.querySelector(`[data-f="${name}"]`);

  sheet.querySelector('[data-save]').addEventListener('click', () => {
    const token = field('token').value.trim() || (existing ? existing.token : '');
    const cfg = {
      owner: field('owner').value,
      repo: field('repo').value,
      branch: field('branch').value,
      token,
    };
    if (!cfg.owner.trim() || !cfg.repo.trim()) return toast('请填写用户名和仓库名');
    if (!cfg.token) return toast('请填写 GitHub token');
    saveSyncConfig(cfg);
    m.close();
    toast('同步设置已保存');
    if (onSaved) onSaved();
  });

  sheet.querySelector('[data-clear]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '清除同步配置？',
      body: '只会删除这台浏览器保存的仓库地址与 token，不会删除 GitHub 上的存档，也不会影响本机学习进度。',
      okText: '清除',
      cancelText: '取消',
      danger: true,
    });
    if (!ok) return;
    clearSyncConfig();
    m.close();
    toast('已清除同步配置');
    if (onSaved) onSaved();
  });
}

async function refreshSyncStatus(el) {
  if (!el) return;
  const cfg = loadSyncConfig();
  el.classList.remove('err');
  if (!cfg) {
    el.textContent = '未配置。绑定一个 GitHub 私有仓库后，可在手机和电脑之间同步进度。';
    return;
  }
  el.textContent = `正在读取 ${cfg.owner}/${cfg.repo}…`;
  try {
    const meta = await getRemoteMeta(cfg);
    if (!meta.exists) {
      el.textContent = `已连接 ${cfg.owner}/${cfg.repo}。远端还没有存档，先上传本机进度。`;
      return;
    }
    const when = await getRemoteCommitDate(cfg);
    el.textContent = `已连接 ${cfg.owner}/${cfg.repo} · 存档 ${formatSize(meta.size)}${when ? ` · 最近 ${syncTime(when)}` : ''}`;
  } catch (e) {
    el.textContent = `连接失败：${friendlyError(e)}`;
    el.classList.add('err');
  }
}

async function uploadSync(btn, statusEl, onNeedConfig) {
  const cfg = loadSyncConfig();
  if (!cfg) {
    toast('先完成同步设置');
    if (onNeedConfig) onNeedConfig();
    return;
  }
  const old = btn.innerHTML;
  btn.disabled = true;
  btn.textContent = '上传中…';
  try {
    const meta = await getRemoteMeta(cfg);
    if (meta.exists) {
      const ok = await confirmDialog({
        title: '覆盖 GitHub 存档？',
        body: `远端已有 ${formatSize(meta.size)} 的存档。上传会用本机进度覆盖它；如果另一台设备刚更新过，请先在那边上传或先恢复确认。`,
        okText: '覆盖上传',
        cancelText: '取消',
        danger: true,
      });
      if (!ok) return;
    }
    const res = await uploadRemote(cfg, exportBackup());
    toast(res && res.overwritten ? '已上传（远端旧存档已被覆盖）' : '已上传到 GitHub');
    await refreshSyncStatus(statusEl);
  } catch (e) {
    const msg = friendlyError(e);
    toast('上传失败：' + msg);
    if (statusEl) {
      statusEl.textContent = '连接失败：' + msg;
      statusEl.classList.add('err');
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

async function downloadSync(ctx, statusEl, onNeedConfig) {
  const cfg = loadSyncConfig();
  if (!cfg) {
    toast('先完成同步设置');
    if (onNeedConfig) onNeedConfig();
    return;
  }
  try {
    const remote = await downloadRemote(cfg);
    let count = 0;
    try {
      const obj = JSON.parse(remote.text);
      const st = obj.state || obj;
      if (!st || st.version !== 2) throw new Error('bad');
      count = st.records ? Object.keys(st.records).length : 0;
    } catch {
      toast('恢复失败：GitHub 存档格式不正确');
      return;
    }
    const ok = await confirmDialog({
      title: '从 GitHub 恢复进度？',
      body: `GitHub 存档包含 ${count} 条单词记录（${formatSize(remote.size)}）。恢复会覆盖本机全部学习进度、设置与收藏；如果本机有更新的进度，请先上传。`,
      okText: '覆盖并恢复',
      cancelText: '取消',
      danger: true,
    });
    if (!ok) return;
    importBackup(remote.text);
    toast('已从 GitHub 恢复');
    ctx.go('home');
  } catch (e) {
    const msg = friendlyError(e);
    toast('恢复失败：' + msg);
    if (statusEl) {
      statusEl.textContent = '连接失败：' + msg;
      statusEl.classList.add('err');
    }
  }
}

export function renderMe(root, params, ctx) {
  const book = bookById(state.data.bookId);
  const prog = bookProgress();
  const wrongN = wrongRecords().length;
  const favN = favoriteRecords().length;
  const stickersN = (state.data.stickers.unlocked || []).length;

  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>我的</h1></div>
    <div class="me-grid">
      <div class="me-left">
        <div class="me-book">
          <div class="mb-top">
            ${bookCover(book, { size: 'xs' })}
            <div class="mb-title"><small>当前词书</small><b>${esc(book ? book.title : '—')}</b></div>
            <button class="change" data-change>更换 ${icon('chevR')}</button>
          </div>
          <div class="mb-progress"><i style="width:${prog.percent}%"></i></div>
          <div class="mb-stats">
            <span>已掌握 <b>${fmtNum(masteredCount())}</b></span>
            <span>已学习 <b>${fmtNum(learnedCount())}</b></span>
            <span>${prog.percent}%</span>
          </div>
        </div>
        <div class="me-links">
          <div class="link-row" data-link="wrong"><span class="lr-left">${icon('book')} 错词本 <span class="badge">${wrongN}</span></span><span class="view">去复习</span></div>
          <div class="link-row" data-link="fav"><span class="lr-left">${icon('star')} 生词本 <span class="badge">${favN}</span></span><span class="view">翻一翻</span></div>
          <div class="link-row" data-link="stickers"><span class="lr-left">${icon('check')} 贴纸图鉴 <span class="badge">${stickersN}</span></span><span class="view">查看</span></div>
          <div class="link-row" data-link="stats"><span class="lr-left">${icon('chart')} 学习数据</span><span class="view">统计</span></div>
          <div class="link-row" data-link="help"><span class="lr-left">${icon('lamp')} 使用帮助</span><span class="view">查看</span></div>
          <div class="link-row" data-link="about"><span class="lr-left">${icon('share')} 关于词屿</span><span class="view">说明</span></div>
        </div>
        <div class="me-version"><span>词屿 v1.0.0</span><span>数据保存在本机</span></div>
      </div>
      <div class="me-right">
        <div class="settings-card">
          <div class="set-row" style="border-bottom:0;padding-bottom:4px"><div class="set-label" style="font-weight:600;font-size:13px">学习设置</div></div>
          ${stepperRow('batchSize', '每组词数', 3, 10, '个/组')}
          ${stepperRow('dailyGroups', '每日组数', 1, 5, '组/天')}
          ${segRow('order', '学习顺序', [
            ['shuffle', '随机'],
            ['alpha', '字母'],
          ])}
          ${segRow('step1', '第一步题型', [
            ['pic_meaning', '看图选意'],
            ['word_pic', '看词识图'],
            ['cloze', '语境填空'],
            ['mix', '混合'],
          ])}
          ${segRow('accent', '发音口音', [
            ['us', '美音'],
            ['uk', '英音'],
          ])}
          ${toggleRow('autoPronounce', '自动发音', '出现新词时朗读')}
          ${toggleRow('readExample', '朗读例句', '答对后读一遍例句')}
          ${toggleRow('dictationAuto', '听写模式', '每个词都亲手拼一遍')}
          ${toggleRow('sfx', '音效', '')}
          ${toggleRow('comboFx', '连击动效', '连续答对 5 个触发')}
          ${toggleRow('haptics', '震动反馈', '支持的设备上生效')}
          ${toggleRow('dark', '深色模式', '')}
        </div>
        <div class="settings-card">
          <div class="set-row" style="border-bottom:0;padding-bottom:4px"><div class="set-label" style="font-weight:600;font-size:13px">数据与备份</div></div>
          <div class="me-actions" style="padding:6px 0 10px">
            <button class="btn soft" data-export>${icon('download')} 导出备份</button>
            <button class="btn soft" data-import>${icon('upload')} 导入备份</button>
          </div>
          <div class="set-row" style="padding-top:6px">
            <div class="set-label">重置所有数据 <span class="hint">会清空进度与设置</span></div>
            <button class="btn mini danger" data-reset>重置</button>
          </div>
        </div>
        <div class="settings-card">
          <div class="set-row" style="border-bottom:0;padding-bottom:4px">
            <div class="set-label" style="font-weight:600;font-size:13px">GitHub 同步 <span class="hint">私有仓库</span></div>
            <button class="btn mini soft" data-sync-config>设置</button>
          </div>
          <div class="set-row" style="display:block;padding:6px 0 8px">
            <div class="sync-status" data-sync-status>正在检查同步配置…</div>
            <div class="me-actions" style="margin-top:0">
              <button class="btn soft" data-sync-up>${icon('upload')} 上传本机进度</button>
              <button class="btn soft" data-sync-down>${icon('download')} 从 GitHub 恢复</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;

  root.querySelector('[data-change]').addEventListener('click', () => ctx.go('library'));
  root.querySelectorAll('[data-link]').forEach((row) =>
    row.addEventListener('click', () => {
      const k = row.dataset.link;
      if (k === 'wrong') {
        if (!wrongN) return toast('错词本是空的');
        ctx.go('mask', { kind: 'wrong', from: 'me' });
      } else if (k === 'fav') {
        if (!favN) return toast('还没有收藏的单词');
        ctx.go('mask', { kind: 'fav', from: 'me' });
      } else if (k === 'stickers') ctx.go('stickers');
      else if (k === 'stats') ctx.go('stats');
      else if (k === 'help') openHelp();
      else if (k === 'about') openAbout();
    }),
  );

  root.querySelectorAll('[data-stepper]').forEach((box) => {
    const key = box.dataset.stepper;
    const min = Number(box.dataset.min);
    const max = Number(box.dataset.max);
    const suffix = box.dataset.suffix;
    box.querySelectorAll('[data-step]').forEach((b) =>
      b.addEventListener('click', () => {
        const cur = Number(settings()[key]);
        const next = Math.min(max, Math.max(min, cur + Number(b.dataset.step)));
        if (next === cur) return;
        setSetting(key, next);
        box.querySelector('span').textContent = `${next} ${suffix}`;
        if (navigator.vibrate && settings().haptics) navigator.vibrate(6);
      }),
    );
  });

  root.querySelectorAll('[data-seg]').forEach((box) => {
    const key = box.dataset.seg;
    box.querySelectorAll('[data-val]').forEach((b) =>
      b.addEventListener('click', () => {
        setSetting(key, b.dataset.val);
        box.querySelectorAll('[data-val]').forEach((x) => x.classList.toggle('on', x === b));
        if (navigator.vibrate && settings().haptics) navigator.vibrate(6);
      }),
    );
  });

  root.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.toggle;
      const next = !settings()[key];
      setSetting(key, next);
      btn.classList.toggle('on', next);
      if (key === 'dark') document.documentElement.classList.toggle('dark', next);
      if (navigator.vibrate && settings().haptics) navigator.vibrate(8);
      if (key === 'dark') toast(next ? '已切换到深色模式' : '已切换到浅色模式');
    });
  });

  root.querySelector('[data-export]').addEventListener('click', exportFile);
  root.querySelector('[data-import]').addEventListener('click', () => importFile(ctx));
  const syncStatus = root.querySelector('[data-sync-status]');
  const onSyncSaved = () => refreshSyncStatus(syncStatus);
  refreshSyncStatus(syncStatus);
  root.querySelector('[data-sync-config]').addEventListener('click', () => openSyncSettings(onSyncSaved));
  root.querySelector('[data-sync-up]').addEventListener('click', (e) =>
    uploadSync(e.currentTarget, syncStatus, () => openSyncSettings(onSyncSaved)),
  );
  root.querySelector('[data-sync-down]').addEventListener('click', () =>
    downloadSync(ctx, syncStatus, () => openSyncSettings(onSyncSaved)),
  );
  root.querySelector('[data-reset]').addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: '重置所有数据？',
      body: '将清空全部学习进度、设置、收藏与贴纸，无法恢复。建议先导出备份。',
      okText: '确认重置',
      cancelText: '取消',
      danger: true,
    });
    if (!ok) return;
    resetAll();
    document.documentElement.classList.remove('dark');
    toast('已重置，重新开始');
    ctx.go('home');
  });

  // 引导可再次查看
  const help = root.querySelector('[data-link="help"]');
  help?.addEventListener('dblclick', () => showOnboarding());
}
