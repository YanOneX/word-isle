// 词库：特色书、词书进度、分类浏览、选关、搜索

import { esc, fmtNum, debounce, clamp } from '../util.js';
import { icon, toast, bookCover, openModal } from '../ui.js';
import {
  state,
  bookProgress,
  learnedCount,
  masteredCount,
  wrongRecords,
  favoriteRecords,
  totalChapters,
  completedGroups,
  currentGroupIndex,
  orderedChapter,
  startSession,
  nextStudyWords,
  save,
  emit,
} from '../store.js';
import { data, bookById, bookShortTitle, bookLabel, categoryOf, CATEGORY_ORDER, searchWords } from '../data.js';
import { openWordDetail } from './detail.js';

let libCat = '大学';

function featuredHtml() {
  const cur = bookById(state.data.bookId);
  return `<div class="featured">
    <div class="fbook" data-wrong>
      ${bookCover(null, { special: 'wrong', size: 'lg', count: wrongRecords().length })}
      <span class="flabel">错词本</span>
    </div>
    <div class="fbook" data-fav>
      ${bookCover(null, { special: 'favorite', size: 'lg', count: favoriteRecords().length })}
      <span class="flabel">生词本</span>
    </div>
    <div class="fbook" data-cur>
      ${bookCover(cur, { size: 'lg' })}
      <span class="flabel">当前词书</span>
    </div>
  </div>`;
}

function progressHtml() {
  const book = bookById(state.data.bookId);
  const p = bookProgress();
  return `<div class="lib-title"><h2>${esc(book ? book.title : '—')}</h2></div>
  <div class="lib-percent">${p.percent}<small>%</small></div>
  <div class="lib-bar"><i style="width:${p.percent}%"></i></div>
  <div class="lib-stats">
    <div><div class="num">${fmtNum(p.mastered)}<small>词</small></div><div class="lbl">已掌握</div></div>
    <div><div class="num">${fmtNum(p.remaining)}<small>词</small></div><div class="lbl">待掌握</div></div>
    <div><div class="num">${p.daysLeft}<small>天</small></div><div class="lbl">预计完成</div></div>
  </div>`;
}

function tabsHtml() {
  return `<div class="cat-tabs">${CATEGORY_ORDER.map(
    (c) => `<button data-cat="${c}" class="${c === libCat ? 'on' : ''}">${c}${c === '大学' ? '<i class="gk"></i>' : ''}</button>`,
  ).join('')}</div>`;
}

function gridHtml() {
  const list = data.books
    .filter((b) => categoryOf(b) === libCat)
    .sort((a, b) => b.totalWords - a.totalWords);
  const total = list.length;
  return `<div class="section-head">
      <h3>${libCat}词书<small>${total} 本</small></h3>
      <button class="fab-search" data-search>${icon('search')}</button>
    </div>
    <div class="book-grid">${list
      .map((b) => {
        const p = bookProgress(b.id);
        return `<div class="grid-book" data-book="${esc(b.id)}">
          ${bookCover(b, { size: 'sm' })}
          <div class="gmeta">
            <div class="gname">${esc(bookLabel(b))}</div>
            <div class="gsub ${p.mastered ? 'green' : ''}">${p.mastered ? `已掌握 ${fmtNum(p.mastered)}` : `${fmtNum(b.totalWords)} 词`}</div>
          </div>
        </div>`;
      })
      .join('')}</div>`;
}

function bindFeatured(root, ctx) {
  root.querySelector('[data-wrong]').addEventListener('click', () => {
    if (!wrongRecords().length) {
      toast('错词本是空的，先去学习吧');
      return;
    }
    ctx.go('mask', { kind: 'wrong' });
  });
  root.querySelector('[data-fav]').addEventListener('click', () => {
    if (!favoriteRecords().length) {
      toast('还没有收藏的单词');
      return;
    }
    ctx.go('mask', { kind: 'fav' });
  });
  root.querySelector('[data-cur]').addEventListener('click', () => {
    const b = bookById(state.data.bookId);
    if (b) openBookModal(b, ctx);
  });
}

function bindGrid(root, ctx) {
  root.querySelectorAll('[data-cat]').forEach((b) =>
    b.addEventListener('click', () => {
      libCat = b.dataset.cat;
      ctx.refresh();
    }),
  );
  root.querySelectorAll('[data-book]').forEach((el) =>
    el.addEventListener('click', () => {
      const b = bookById(el.dataset.book);
      if (b) openBookModal(b, ctx);
    }),
  );
  root.querySelector('[data-search]').addEventListener('click', () => openSearch(ctx));
}

// ---------- 书详情 ----------
export function openBookModal(book, ctx) {
  const p = bookProgress(book.id);
  const learned = learnedCount(book.id);
  const mastered = masteredCount(book.id);
  const isCur = book.id === state.data.bookId;
  const html = `<div class="book-modal">
    <button class="iconbtn bm-close" data-close>${icon('x')}</button>
    <div class="bm-top">
      ${bookCover(book, { size: 'lg' })}
      <div class="bm-info">
        <div class="bm-kicker">${esc(categoryOf(book))} · ${esc(book.tag || '')}</div>
        <div class="bm-title">${esc(book.title)}</div>
        <div class="bm-count">${fmtNum(book.totalWords)}<small>词</small></div>
        ${book.description ? `<div class="muted" style="font-size:11px;margin-top:8px;line-height:1.6">${esc(book.description)}</div>` : ''}
      </div>
    </div>
    <div class="bm-stats">
      <div><div class="num">${fmtNum(mastered)}<small> 词</small></div><div class="lbl">已掌握</div></div>
      <div><div class="num">${fmtNum(learned)}<small> 词</small></div><div class="lbl">已学习</div></div>
      <div><div class="num">${p.percent}<small>%</small></div><div class="lbl">完成度</div></div>
      <div><div class="num">${p.chapters}<small> 关</small></div><div class="lbl">总关卡</div></div>
    </div>
    <div class="bm-actions">
      <button class="btn ghost" data-levels>选择关卡</button>
      <button class="btn primary" data-start>${isCur ? '开始学习' : '设为当前并学习'}</button>
    </div>
  </div>`;
  const modal = openModal(html, { className: 'wide', closeOnBackdrop: true });
  const sheet = modal.sheet;
  sheet.querySelector('[data-levels]').addEventListener('click', () => {
    modal.close();
    openLevelModal(book, ctx);
  });
  sheet.querySelector('[data-start]').addEventListener('click', () => {
    state.data.bookId = book.id;
    save(true);
    emit();
    modal.close();
    const pending = nextStudyWords(book.id);
    if (!pending.words.length) {
      toast(`「${book.title}」已经全部学完啦，可以选关复习`);
      ctx.go('library');
      return;
    }
    startSession('learn', { words: pending.words, chapter: pending.chapter });
    toast(`已切换到「${book.title}」`);
    ctx.go('study');
  });
}

// ---------- 选关 ----------
export function openLevelModal(book, ctx) {
  const total = totalChapters(book.id);
  const perPage = 30;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const done = new Set(completedGroups(book.id));
  let page = clamp(Math.floor(currentGroupIndex(book.id) / perPage), 0, pages - 1);
  let selected = clamp(currentGroupIndex(book.id), 0, total - 1);

  const html = `<div class="level-modal">
    <button class="iconbtn close" data-close>${icon('x')}</button>
    <h3>${esc(bookShortTitle(book) || book.title)}<small>共 ${total} 关</small></h3>
    <div class="lm-pages" data-pages></div>
    <div class="lm-grid" data-grid></div>
    <div class="lm-actions">
      <button class="btn ghost" data-random>随机一组</button>
      <button class="btn primary" data-go>开始第 <span data-sel>${selected + 1}</span> 关</button>
    </div>
  </div>`;
  const modal = openModal(html, { className: 'bare', closeOnBackdrop: true });
  const sheet = modal.sheet;

  function draw() {
    sheet.querySelector('[data-pages]').innerHTML = Array.from({ length: pages }, (_, i) => {
      const from = i * perPage + 1;
      const to = Math.min(total, (i + 1) * perPage);
      return `<button data-page="${i}" class="${i === page ? 'on' : ''}">${from}-${to}</button>`;
    }).join('');
    sheet.querySelector('[data-pages]').querySelectorAll('[data-page]').forEach((b) =>
      b.addEventListener('click', () => {
        page = Number(b.dataset.page);
        draw();
      }),
    );
    const from = page * perPage;
    const to = Math.min(total, from + perPage);
    let cells = '';
    for (let c = from; c < to; c++) {
      const cls = done.has(c) ? 'done' : c === selected ? 'current' : '';
      cells += `<button class="lm-cell ${cls}" data-chapter="${c}">${c + 1}${done.has(c) ? '<i class="dot"></i>' : ''}</button>`;
    }
    sheet.querySelector('[data-grid]').innerHTML = cells;
    sheet.querySelector('[data-grid]').querySelectorAll('[data-chapter]').forEach((b) =>
      b.addEventListener('click', () => {
        selected = Number(b.dataset.chapter);
        draw();
      }),
    );
    sheet.querySelector('[data-sel]').textContent = String(selected + 1);
  }

  function startAt(chapter) {
    const words = orderedChapter(book.id, chapter).filter((w) => {
      const r = state.data.records[w.w];
      return !(r && r.isMastered);
    });
    if (!words.length) {
      toast('这一关的单词已经全部掌握啦，换一关试试');
      return;
    }
    state.data.bookId = book.id;
    save(true);
    startSession('learn', { words, chapter, bookId: book.id });
    modal.close();
    ctx.go('study');
  }

  sheet.querySelector('[data-go]').addEventListener('click', () => startAt(selected));
  sheet.querySelector('[data-random]').addEventListener('click', () => {
    let c = Math.floor(Math.random() * total);
    if (total > 1 && c === selected) c = (c + 1) % total;
    selected = c;
    page = Math.floor(c / perPage);
    draw();
    startAt(c);
  });
  draw();
}

// ---------- 搜索 ----------
function openSearch(ctx) {
  const html = `<div class="search-modal">
    <div class="sm-head"><h3>搜索单词</h3><button class="iconbtn" data-close>${icon('x')}</button></div>
    <div class="sm-input">${icon('search')}<input type="search" placeholder="输入英文单词或中文释义" autocomplete="off" /></div>
    <div class="sm-results"><div class="empty">输入关键词开始搜索</div></div>
  </div>`;
  const modal = openModal(html, { className: 'bare', closeOnBackdrop: true });
  const sheet = modal.sheet;
  const input = sheet.querySelector('input');
  const results = sheet.querySelector('.sm-results');
  input.focus();
  const run = debounce(async () => {
    const q = input.value;
    if (!q.trim()) {
      results.innerHTML = '<div class="empty">输入关键词开始搜索</div>';
      return;
    }
    const list = await searchWords(q, 20);
    if (input.value !== q) return;
    if (!list.length) {
      results.innerHTML = '<div class="empty">没有找到相关单词</div>';
      return;
    }
    results.innerHTML = list
      .map(
        (w, i) =>
          `<div class="sm-row" data-i="${i}"><div><b>${esc(w.w)}</b>${w.us ? `<small>${esc(w.us)}</small>` : ''}</div><span>${esc((w.t || '').slice(0, 40))}</span></div>`,
      )
      .join('');
    results.querySelectorAll('.sm-row').forEach((row) =>
      row.addEventListener('click', () => {
        const w = list[Number(row.dataset.i)];
        openWordDetail(w, { onChange: () => ctx.refresh() });
      }),
    );
  }, 160);
  input.addEventListener('input', run);
}

export function renderLibrary(root, params, ctx) {
  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>词库</h1></div>
    ${featuredHtml()}
    ${progressHtml()}
    ${tabsHtml()}
    ${gridHtml()}
  </div>`;
  bindFeatured(root, ctx);
  bindGrid(root, ctx);
}
