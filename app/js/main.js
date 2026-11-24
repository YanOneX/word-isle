// 应用入口：加载数据、路由、主题、底部导航

import { initStore, state, settings, activeSession, save } from './store.js';
import { loadData, bookById } from './data.js';
import { loadingScreen, hideLoading, icon } from './ui.js';
import { renderHome } from './screens/home.js';
import { renderLibrary } from './screens/library.js';
import { renderStats } from './screens/stats.js';
import { renderMe } from './screens/me.js';
import { renderStudy } from './screens/study.js';
import { renderSummary } from './screens/summary.js';
import { renderMask } from './screens/mask.js';
import { renderStickers } from './screens/stickers.js';
import { showOnboarding } from './screens/onboarding.js';

const app = document.getElementById('app');
const screens = {
  home: renderHome,
  library: renderLibrary,
  stats: renderStats,
  me: renderMe,
  study: renderStudy,
  summary: renderSummary,
  mask: renderMask,
  stickers: renderStickers,
};
const TABS = ['home', 'library', 'stats', 'me'];
const TAB_LABEL = { home: '首页', library: '词库', stats: '统计', me: '我的' };
const TAB_ICON = { home: 'home', library: 'book', stats: 'chart', me: 'user' };

let current = { name: 'home', params: {} };
let booted = false;
let scrollMemo = {};

export const ctx = {
  go(name, params = {}) {
    if (!screens[name]) name = 'home';
    if (TABS.includes(current.name)) scrollMemo[current.name] = window.scrollY;
    current = { name, params };
    if (TABS.includes(name)) state.data.lastTab = name;
    render();
    const y = TABS.includes(name) ? scrollMemo[name] || 0 : 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  },
  refresh() {
    render();
  },
  get route() {
    return current.name;
  },
};

function applyTheme() {
  document.documentElement.classList.toggle('dark', !!settings().dark);
}

function tabbar(active) {
  return `<nav class="tabbar">${TABS.map(
    (t) => `<button data-tab="${t}" class="${t === active ? 'on' : ''}">${icon(TAB_ICON[t])}<span class="lbl">${TAB_LABEL[t]}</span></button>`,
  ).join('')}</nav>`;
}

function bindTabbar() {
  app.querySelectorAll('.tabbar [data-tab]').forEach((b) => {
    b.addEventListener('click', () => {
      if (b.dataset.tab === current.name) return;
      ctx.go(b.dataset.tab);
    });
  });
}

function render() {
  applyTheme();
  app.innerHTML = '';
  const screen = screens[current.name] || renderHome;
  screen(app, current.params, ctx);
  if (TABS.includes(current.name)) {
    app.insertAdjacentHTML('beforeend', tabbar(current.name));
    bindTabbar();
  }
  document.body.classList.remove('no-scroll');
}

async function boot() {
  loadingScreen('正在加载词库…');
  await initStore();
  applyTheme();
  try {
    await loadData((text) => {
      if (text) loadingScreen(text);
    });
  } catch (e) {
    console.error(e);
    loadingScreen('词库加载失败，请通过本地服务器打开（见 README）');
    return;
  }
  // 词库就绪后再校验上次的词书；过早校验会把有效词书误判为无效并改回四级
  if (!bookById(state.data.bookId)) {
    state.data.bookId = 'cet4';
    save(true);
  }
  hideLoading();
  booted = true;

  const s = activeSession();
  if (s && Array.isArray(s.words) && s.words.length) {
    if (s.phase === 'summary') ctx.go('summary');
    else ctx.go('study');
  } else {
    ctx.go(TAB_LABEL[state.data.lastTab] ? state.data.lastTab : 'home');
  }
  if (!state.data.seenIntro) {
    setTimeout(() => showOnboarding(), 260);
  }
  // 刷新前若在学，前进浏览器历史意义不大；保留返回首页的快捷键
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const open = document.querySelector('.modal-backdrop.open');
      if (open) {
        e.preventDefault();
        open.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }
    if (e.key === '/' && current.name !== 'study') {
      const input = document.querySelector('.search-box input');
      if (input) {
        e.preventDefault();
        input.focus();
      }
    }
  });
  window.addEventListener('beforeunload', () => {
    // 状态已在各处即时保存；这里仅提示离开会中断学习
    if (activeSession() && activeSession().phase !== 'summary') return undefined;
  });
}

boot();
