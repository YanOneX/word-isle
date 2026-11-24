// UI 基础件：图标、弹窗、toast、书籍封面

import { h, esc, fmtNum } from './util.js';
import { bookCode, bookShortTitle, categoryOf } from './data.js';

export const ICONS = {
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V21h13V9.5"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5A1.5 1.5 0 0 0 20 18.5z"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11"/><path d="M12 20V4"/><path d="M19 20v-6"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c.8-3.6 3.7-5.6 7.5-5.6s6.7 2 7.5 5.6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m16.2 16.2 4 4"/></svg>',
  chevR: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 5 7 7-7 7"/></svg>',
  chevL: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  chevD: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 9 7 7 7-7"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10v4h3l4.5 3.5v-11L7 10z"/><path d="M15 9.5a3.6 3.6 0 0 1 0 5"/><path d="M17.4 7.2a7 7 0 0 1 0 9.6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 6.8"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.2a1.9 1.9 0 0 0 1.4-3.2 1.9 1.9 0 0 1 1.4-3.2H18a3 3 0 0 0 3-3A9 9 0 0 0 12 3z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="14.2" cy="6.6" r="1"/><circle cx="17" cy="9.4" r="1"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15V3"/><path d="m7.5 7.5 4.5-4.5 4.5 4.5"/><path d="M5 13v6.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V13"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5-7 7 7 7"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2.5c.4 3.3-2.5 4.8-2.5 7.6 0 1.2.6 2 1.3 2.5-.2-2.2 1.6-3.5 2.7-4.8 2.3 2 4 4.5 4 7.4 0 3.5-2.6 6.3-5.5 6.3S6.5 18.7 6.5 15.2c0-4.6 3.3-8.8 5.5-12.7z" fill="#F97362"/></svg>',
  lamp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 20h16"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 20h16"/></svg>',
};

export function icon(name, cls = '') {
  return `<span class="ico ${cls}">${ICONS[name] || ''}</span>`;
}

// ---------- Toast ----------
let toastTimer = null;
export function toast(msg, ms = 2200) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  root.innerHTML = `<div class="toast">${esc(msg)}</div>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (root.innerHTML = ''), ms);
}

// ---------- Modal ----------
const stack = [];

export function openModal(html, { className = '', onMount, closeOnBackdrop = true } = {}) {
  const backdrop = h(`<div class="modal-backdrop ${className}"><div class="modal-sheet">${html}</div></div>`);
  document.getElementById('modal-root').appendChild(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('open'));
  const sheet = backdrop.querySelector('.modal-sheet');
  const entry = { backdrop, sheet, close };
  stack.push(entry);

  function close() {
    backdrop.classList.remove('open');
    backdrop.classList.add('closing');
    const idx = stack.indexOf(entry);
    if (idx >= 0) stack.splice(idx, 1);
    setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  }
  let onClose = null;
  entry.setOnClose = (fn) => (onClose = fn);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && closeOnBackdrop) close();
  });
  const xBtn = backdrop.querySelector('[data-close]');
  if (xBtn) xBtn.addEventListener('click', close);
  if (onMount) setTimeout(() => onMount(sheet, close), 0);
  return entry;
}

export function closeTopModal() {
  const top = stack[stack.length - 1];
  if (top) {
    top.backdrop.classList.remove('open');
    top.backdrop.classList.add('closing');
    setTimeout(() => top.backdrop.remove(), 220);
    stack.pop();
    return true;
  }
  return false;
}

export function confirmDialog({ title, body, okText = '确定', cancelText = '取消', danger = false }) {
  return new Promise((resolve) => {
    const m = openModal(
      `<div class="dlg">
        <div class="dlg-title">${esc(title)}</div>
        <div class="dlg-body">${esc(body)}</div>
        <div class="dlg-actions">
          <button class="btn ghost" data-act="cancel">${esc(cancelText)}</button>
          <button class="btn ${danger ? 'danger' : 'primary'}" data-act="ok">${esc(okText)}</button>
        </div>
      </div>`,
      { className: 'center' },
    );
    m.sheet.querySelector('[data-act="cancel"]').onclick = () => {
      m.close();
      resolve(false);
    };
    m.sheet.querySelector('[data-act="ok"]').onclick = () => {
      m.close();
      resolve(true);
    };
  });
}

export function loadingScreen(text = '正在加载…') {
  let el = document.getElementById('boot-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'boot-loading';
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="boot-mark">屿</div><div class="boot-text">${esc(text)}</div>`;
}

export function hideLoading() {
  const el = document.getElementById('boot-loading');
  if (el) el.remove();
}

// ---------- 书籍封面 ----------
const PALETTES = [
  { bg: '#EDE8DC', ink: '#1C2030', plate: '#F6F2E7', spine: 'rgba(28,32,48,.72)', accent: '#B68B57' },
  { bg: '#DCE6F0', ink: '#233548', plate: '#EAF1F8', spine: 'rgba(35,53,72,.6)', accent: '#5C86AE' },
  { bg: '#E3E9DE', ink: '#27372B', plate: '#EFF3E9', spine: 'rgba(39,55,43,.6)', accent: '#6F8E6B' },
  { bg: '#E8E3DA', ink: '#332F28', plate: '#F3EFE6', spine: 'rgba(51,47,40,.55)', accent: '#A88B67' },
  { bg: '#F2F0EA', ink: '#22252C', plate: '#FAF8F2', spine: 'rgba(34,37,44,.5)', accent: '#9AA39B' },
  { bg: '#E5EAE4', ink: '#2A352D', plate: '#F2F5EE', spine: 'rgba(42,53,45,.55)', accent: '#7E957F' },
];
const STYLES = ['buckram', 'swiss', 'atelier', 'saddle', 'band', 'frame'];

function hash(s) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) >>> 0;
  return x;
}

export function bookCover(book, { size = 'md', special = null, count = 0 } = {}) {
  if (special === 'wrong') {
    return `<div class="book-cover bk-wrong ${size}">
      <div class="bc-sew"></div>
      <div class="bc-plate">
        <div class="bc-kicker">专属 · 错题集</div>
        <div class="bc-title">错词本</div>
        <div class="bc-line"></div>
        <div class="bc-foot"><span>${count} 词</span><span class="bc-dot"></span></div>
      </div>
      <div class="bc-spine red"></div>
    </div>`;
  }
  if (special === 'favorite') {
    return `<div class="book-cover bk-fav ${size}">
      <div class="bc-plate plain">
        <div class="bc-kicker">收藏 · 重点词</div>
        <div class="bc-hash">#</div>
        <div class="bc-num">02</div>
        <div class="bc-title small">生词本</div>
        <div class="bc-foot"><span>${count} 词</span><span class="bc-dot blue"></span></div>
      </div>
    </div>`;
  }
  const id = book ? book.id : 'unknown';
  const pal = PALETTES[hash(id) % PALETTES.length];
  const style = STYLES[hash(id + 's') % STYLES.length];
  const n = book ? book.totalWords : 0;
  const code = bookCode(book);
  return `<div class="book-cover ${size} st-${style}" style="--bg:${pal.bg};--ink:${pal.ink};--plate:${pal.plate};--spine:${pal.spine};--accent:${pal.accent}">
    <div class="bc-texture"></div>
    <div class="bc-spine-line"></div>
    <div class="bc-plate">
      <div class="bc-kicker">${esc(categoryOf(book))} · ${style.toUpperCase()}</div>
      <div class="bc-title${code.length > 4 ? ' long' : ''}">${esc(code)}</div>
      <div class="bc-mini">${esc(bookShortTitle(book))}</div>
      <div class="bc-foot"><span>${fmtNum(n)} 词</span><span>${String((hash(id) % 89) + 10)}</span></div>
    </div>
  </div>`;
}
