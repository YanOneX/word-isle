// 首页：今日单词卡、学习计划、打卡与统计入口

import { esc, dayKey, todayWeek, WEEK_LABEL, shortMeanings, debounce } from '../util.js';
import { icon, toast, openModal } from '../ui.js';
import {
  state,
  settings,
  todayNewCount,
  todayReviewedCount,
  newGoal,
  dueRecords,
  nextStudyWords,
  orderedChapter,
  currentGroupIndex,
  startSession,
  streakDays,
  bookProgress,
  save,
  emit,
} from '../store.js';
import { bookById, attachImage, searchWords, getWordObj } from '../data.js';
import { openWordDetail } from './detail.js';
import { speak } from '../speech.js';

let cardIndex = 0;
let cardWords = [];

function weekStrip() {
  const punched = new Set(state.data.streak.days || []);
  const t = dayKey();
  return `<div class="week">${todayWeek()
    .map((d, i) => {
      const k = dayKey(d);
      return `<div class="day ${k === t ? 'today' : ''}"><span>${WEEK_LABEL[i]}</span><b>${d.getDate()}</b>${punched.has(k) ? '<i class="dot"></i>' : ''}</div>`;
    })
    .join('')}</div>`;
}

function currentBookWords() {
  const book = bookById(state.data.bookId);
  if (!book) return [];
  const chapter = currentGroupIndex(state.data.bookId);
  let list = orderedChapter(state.data.bookId, chapter);
  if (!list.length) list = orderedChapter(state.data.bookId, 0);
  return list;
}

function wordCardHtml() {
  const w = cardWords[cardIndex];
  if (!w) {
    return `<div class="word-card"><div class="empty-state"><div class="big">📖</div>这本词书暂时没有可展示的词</div></div>`;
  }
  return `<div class="word-card">
    <button class="wc-arrow l" data-prev>${icon('chevL')}</button>
    <button class="wc-arrow r" data-next>${icon('chevR')}</button>
    <div class="wc-img"><img alt="${esc(w.w)}" /></div>
    <div class="wc-word" data-detail>${esc(w.w)}</div>
    <div class="wc-mean">${esc(shortMeanings(w.t, 2) || '点击查看释义')}</div>
    <div class="wc-phon">
      ${w.us ? `<span class="chip"><button data-say="us" style="display:inline-flex;color:inherit">${icon('speaker')}</button>${esc(w.us)}</span>` : ''}
      ${w.uk ? `<span class="chip"><button data-say="uk" style="display:inline-flex;color:inherit">${icon('speaker')}</button>${esc(w.uk)}</span>` : ''}
      <button class="detail" data-detail>详解</button>
    </div>
    <div class="dots">${cardWords.map((_, i) => `<i class="${i === cardIndex ? 'on' : ''}"></i>`).join('')}</div>
  </div>`;
}

function planHtml() {
  const goal = newGoal();
  const done = todayNewCount();
  const revDone = todayReviewedCount();
  const due = dueRecords().length;
  const newLeft = Math.max(0, goal - done);
  const revLeft = Math.max(0, 5 - revDone);
  return `<div class="panel">
    <div class="panel-head"><span>今日计划</span><span class="tag"><i></i>${newLeft || revLeft ? '进行中' : '已达标'}</span></div>
    <div class="plan-nums">
      <div class="plan-num">
        <div class="num">${newLeft}<small>/${goal} 新词</small></div>
        <div class="bar"><i style="width:${goal ? Math.min(100, (done / goal) * 100) : 0}%"></i></div>
        <div class="sub">已学 ${done} 个</div>
      </div>
      <div class="plan-num">
        <div class="num">${revLeft}<small>/5 复习</small></div>
        <div class="bar blue"><i style="width:${Math.min(100, (revDone / 5) * 100)}%"></i></div>
        <div class="sub">待复习 ${due} 个</div>
      </div>
    </div>
    <div class="plan-actions">
      <button class="btn primary" data-learn>开始学习</button>
      <button class="btn ghost" data-review>开始复习</button>
    </div>
  </div>`;
}

function miniCardsHtml() {
  const streak = streakDays();
  const prog = bookProgress();
  return `<div class="mini-cards">
    <div class="mini-card" data-calendar>
      <div class="mc-head"><span>连续打卡</span><span class="ico">${icon('chevR')}</span></div>
      <div class="mc-value">${streak}<small>天</small></div>
      <span class="flame">${icon('flame')}</span>
    </div>
    <div class="mini-card" data-stats>
      <div class="mc-head"><span>词书掌握</span><span class="ico">${icon('chevR')}</span></div>
      <div class="mc-value">${prog.percent}<small>%</small></div>
      <div class="avatars"><span>已</span><span>在</span><span>剩</span></div>
    </div>
  </div>`;
}

function bindSearch(root, ctx) {
  const wrap = root.querySelector('.search-wrap');
  const input = wrap.querySelector('input');
  const box = wrap.querySelector('.search-box');
  const results = wrap.querySelector('.search-results');
  const clear = wrap.querySelector('.clear');
  const cancel = wrap.querySelector('.cancel');

  if (window.innerWidth < 760 && wrap.dataset.mobile !== '1') {
    // 移动端点击搜索图标再展开
    input.setAttribute('readonly', 'readonly');
    box.addEventListener('click', () => {
      input.removeAttribute('readonly');
      input.focus();
    });
  }

  const renderRows = (list, q) => {
    if (!q.trim()) {
      results.innerHTML = '';
      wrap.classList.remove('active');
      return;
    }
    wrap.classList.add('active');
    if (!list.length) {
      results.innerHTML = `<div class="empty">没有找到 “${esc(q)}”</div>`;
      return;
    }
    results.innerHTML = list
      .map(
        (w, i) => `<div class="row" data-i="${i}"><span>${esc(w.w)}</span><span class="mean">${esc((w.t || '').replace(/\n/g, ' '))}</span></div>`,
      )
      .join('');
    results.querySelectorAll('.row').forEach((row) => {
      row.addEventListener('click', () => {
        const w = list[Number(row.dataset.i)];
        openWordDetail(w, { onChange: () => ctx.refresh() });
      });
    });
  };

  const onInput = debounce(async () => {
    const q = input.value;
    const list = await searchWords(q, 8);
    if (input.value !== q) return;
    renderRows(list, q);
  }, 150);

  input.addEventListener('input', () => {
    box.classList.toggle('has', !!input.value);
    onInput();
  });
  input.addEventListener('focus', () => {
    if (input.value.trim()) {
      wrap.classList.add('active');
    }
  });
  clear.addEventListener('click', () => {
    input.value = '';
    box.classList.remove('has');
    wrap.classList.remove('active');
    results.innerHTML = '';
    input.focus();
  });
  cancel.addEventListener('click', () => {
    input.value = '';
    box.classList.remove('has');
    wrap.classList.remove('active');
    results.innerHTML = '';
    input.blur();
  });
  document.addEventListener('mousedown', (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('active');
    }
  });
}

function bindHome(root, ctx) {
  const card = root.querySelector('.word-card');
  if (card) {
    const img = card.querySelector('.wc-img img');
    if (img) attachImage(img, cardWords[cardIndex]);
    card.querySelectorAll('[data-prev]').forEach((b) =>
      b.addEventListener('click', () => {
        cardIndex = (cardIndex - 1 + cardWords.length) % Math.max(1, cardWords.length);
        rerenderCard(root, ctx);
      }),
    );
    card.querySelectorAll('[data-next]').forEach((b) =>
      b.addEventListener('click', () => {
        cardIndex = (cardIndex + 1) % Math.max(1, cardWords.length);
        rerenderCard(root, ctx);
      }),
    );
    card.querySelectorAll('[data-detail]').forEach((b) =>
      b.addEventListener('click', () => openWordDetail(cardWords[cardIndex], { onChange: () => ctx.refresh() })),
    );
    card.querySelectorAll('[data-say]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const w = cardWords[cardIndex];
        speak(w.w, { accent: b.dataset.say, rate: 0.88 });
      }),
    );
  }

  root.querySelector('[data-learn]').addEventListener('click', () => {
    const pending = nextStudyWords(state.data.bookId);
    if (!pending.words.length) {
      toast('这本词书已经全部学完啦，换一本吧');
      return;
    }
    const hadRec = pending.words.map((w) => !!state.data.records[w.w]);
    const session = startSession('learn', { words: pending.words, chapter: pending.chapter });
    pending.words.forEach((w, i) => {
      session.results[w.w].newWord = !hadRec[i];
    });
    session.save && session.save();
    save(true);
    emit();
    ctx.go('study');
  });

  root.querySelector('[data-review]').addEventListener('click', () => {
    const due = dueRecords();
    if (!due.length) {
      toast('今天没有到期的复习，先去学几个新词吧');
      return;
    }
    const words = due.slice(0, Math.max(5, settings().batchSize)).map((r) => getWordObj(r.word));
    startSession('review', { words });
    ctx.go('study');
  });

  root.querySelector('[data-calendar]').addEventListener('click', () => openCalendar());
  root.querySelector('[data-stats]').addEventListener('click', () => ctx.go('stats'));
  bindSearch(root, ctx);
}

function rerenderCard(root, ctx) {
  const card = root.querySelector('.word-card');
  if (!card) return;
  const tmp = document.createElement('div');
  tmp.innerHTML = wordCardHtml();
  const fresh = tmp.firstElementChild;
  card.replaceWith(fresh);
  const img = fresh.querySelector('.wc-img img');
  if (img) attachImage(img, cardWords[cardIndex]);
  fresh.querySelectorAll('[data-prev]').forEach((b) =>
    b.addEventListener('click', () => {
      cardIndex = (cardIndex - 1 + cardWords.length) % Math.max(1, cardWords.length);
      rerenderCard(root, ctx);
    }),
  );
  fresh.querySelectorAll('[data-next]').forEach((b) =>
    b.addEventListener('click', () => {
      cardIndex = (cardIndex + 1) % Math.max(1, cardWords.length);
      rerenderCard(root, ctx);
    }),
  );
  fresh.querySelectorAll('[data-detail]').forEach((b) =>
    b.addEventListener('click', () => openWordDetail(cardWords[cardIndex], { onChange: () => ctx.refresh() })),
  );
  fresh.querySelectorAll('[data-say]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      speak(cardWords[cardIndex].w, { accent: b.dataset.say, rate: 0.88 });
    }),
  );
}

// ---------- 打卡日历 ----------
export function openCalendar() {
  const punched = new Set(state.data.streak.days || []);
  const now = new Date();
  let ym = { y: now.getFullYear(), m: now.getMonth() };
  const html = `<div class="cal-modal">
    <h3>学习打卡</h3>
    <div class="cal-month">
      <button data-prev>${icon('chevL')}</button>
      <span data-label></span>
      <button data-next>${icon('chevR')}</button>
    </div>
    <div class="cal-grid" data-grid></div>
    <div class="cal-foot" data-foot></div>
  </div>`;
  const modal = openModal(html, { className: 'bare', closeOnBackdrop: true });
  const sheet = modal.sheet;
  const grid = sheet.querySelector('[data-grid]');
  const label = sheet.querySelector('[data-label]');
  const foot = sheet.querySelector('[data-foot]');

  function draw() {
    const { y, m } = ym;
    label.textContent = `${y} 年 ${m + 1} 月`;
    const first = new Date(y, m, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const len = new Date(y, m + 1, 0).getDate();
    let cells = ['一', '二', '三', '四', '五', '六', '日'].map((d) => `<div class="cl">${d}</div>`).join('');
    for (let i = 0; i < startOffset; i++) cells += '<div></div>';
    let monthPunches = 0;
    for (let d = 1; d <= len; d++) {
      const key = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const on = punched.has(key);
      if (on) monthPunches++;
      cells += `<div class="cal-day ${on ? 'punch' : ''} ${key === dayKey() ? 'today' : ''}">${d}</div>`;
    }
    grid.innerHTML = cells;
    foot.textContent = `本月打卡 ${monthPunches} 天 · 累计 ${punched.size} 天`;
  }
  sheet.querySelector('[data-prev]').addEventListener('click', () => {
    ym.m--;
    if (ym.m < 0) {
      ym.m = 11;
      ym.y--;
    }
    draw();
  });
  sheet.querySelector('[data-next]').addEventListener('click', () => {
    ym.m++;
    if (ym.m > 11) {
      ym.m = 0;
      ym.y++;
    }
    draw();
  });
  draw();
  return modal;
}

export function renderHome(root, params, ctx) {
  cardWords = currentBookWords().slice(0, 5);
  if (cardIndex >= cardWords.length) cardIndex = 0;
  const book = bookById(state.data.bookId);
  root.innerHTML = `<div class="page">
    ${weekStrip()}
    <div class="search-wrap">
      <div class="search-box">
        ${icon('search')}
        <input type="search" placeholder="搜索单词或中文释义" autocomplete="off" spellcheck="false" />
        <button class="clear">${icon('x')}</button>
        <button class="cancel">取消</button>
      </div>
      <div class="search-results"></div>
    </div>
    <div class="home-grid">
      ${wordCardHtml()}
      <div class="side-col">
        ${planHtml()}
        ${miniCardsHtml()}
      </div>
    </div>
    <div style="text-align:center;color:var(--faint);font-size:10px;margin-top:22px">当前词书 · ${esc(book ? book.title : '')} · 快捷键 / 搜索</div>
  </div>`;
  bindHome(root, ctx);
}
