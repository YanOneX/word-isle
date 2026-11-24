// 一组学习结束后的结算页（对齐原版 settle 布局）

import { esc, fmtDuration, dayKey, todayWeek, WEEK_LABEL, coreMeaning } from '../util.js';
import { icon, toast } from '../ui.js';
import {
  state,
  settings,
  activeSession,
  endSession,
  startSession,
  nextStudyWords,
  dueRecords,
  dailyEntry,
  recordOf,
  toggleFavorite,
} from '../store.js';
import { getWordObj, attachImage } from '../data.js';
import { openWordDetail } from './detail.js';

function meaning2(w) {
  return coreMeaning(w.t || '')
    .split(/[；;，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join('；');
}

function weekDots() {
  const punched = new Set(state.data.streak.days || []);
  return `<div class="settle-week">${todayWeek()
    .map((d, i) => {
      const k = dayKey(d);
      return `<span class="${punched.has(k) ? 'on' : ''}"><b>${WEEK_LABEL[i]}</b><i></i></span>`;
    })
    .join('')}</div>`;
}

function startNext(ctx) {
  const s = activeSession();
  const kind = s ? s.kind : 'learn';
  if (kind === 'review') {
    const due = dueRecords();
    if (!due.length) {
      toast('今天到期的复习已经全部完成，去学点新词吧');
      endSession();
      ctx.go('home');
      return;
    }
    const words = due.slice(0, Math.max(5, settings().batchSize)).map((r) => getWordObj(r.word));
    endSession();
    startSession('review', { words });
    ctx.go('study');
    return;
  }
  const pending = nextStudyWords(state.data.bookId);
  if (!pending.words.length) {
    toast('这本词书已经全部学完啦，去词库换一本吧');
    endSession();
    ctx.go('library');
    return;
  }
  endSession();
  startSession('learn', { words: pending.words, chapter: pending.chapter });
  ctx.go('study');
}

export function renderSummary(root, params, ctx) {
  const session = activeSession();
  if (!session || !session.summary) {
    ctx.go('home');
    return;
  }
  const sum = session.summary;
  const words = (sum.words || []).map((k) => ({ key: k, w: getWordObj(k), res: session.results[k] || {} }));
  const label = session.kind === 'review' ? '复习' : `第${(session.chapter || 0) + 1}组`;

  const d = dailyEntry();
  const learnedToday = (d.newW || 0) + (d.revW || 0);
  const goal = Math.max(1, settings().dailyGroups * settings().batchSize);
  const left = Math.max(0, goal - learnedToday);
  const title = left > 0 ? 'Almost there' : '今日计划完成啦';
  const sub = left > 0
    ? `还差 ${left} 个完成今日计划 · 本轮用时 ${fmtDuration(sum.seconds)}`
    : `今日计划已完成 · 本轮用时 ${fmtDuration(sum.seconds)}`;

  root.innerHTML = `<div class="settle">
    <div class="settle-head">
      <button class="settle-back" data-done title="返回">${icon('chevL')}</button>
      <span class="settle-pill">${label}${icon('check', 'ok')}</span>
      <span class="settle-spacer"></span>
    </div>
    <div class="settle-scroll">
      <img class="settle-mascot" src="./assets/art/settle.svg" alt="完成" />
      <h1 class="settle-title">${title}</h1>
      <p class="settle-sub">${sub}</p>

      <div class="settle-card settle-stats-card">
        <div class="settle-stats">
          <div><div class="sv">${learnedToday}<small>/${goal}</small></div><div class="sl">已学单词</div></div>
          <div><div class="sv">${sum.accuracy || 0}<small>%</small></div><div class="sl">正确率</div></div>
        </div>
        ${weekDots()}
      </div>

      <div class="settle-card settle-sticker-card">
        <div class="settle-sec-head"><span>点亮 ${words.length} 枚新贴纸</span><span class="settle-link" data-dex>图鉴 ${icon('chevR')}</span></div>
        <div class="settle-tiles">
          ${words
            .map(
              (x) => `<div class="settle-tile" data-word="${esc(x.key)}">
                <div class="sti"><img alt="${esc(x.w.w)}" /></div>
                <div class="stn">${esc(x.w.w)}</div>
              </div>`,
            )
            .join('')}
        </div>
      </div>

      <div class="settle-review-head">
        <span>再看一眼</span>
        <button class="settle-add" data-addall><i></i>全部加入生词本</button>
      </div>
      <div class="settle-words">
        ${words
          .map(
            (x) => `<div class="settle-word" data-word="${esc(x.key)}">
              <b>${esc(x.w.w)}</b>
              <span class="sw-mean">${esc(meaning2(x.w))}</span>
              <span class="sw-dot"></span>
            </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="settle-actions">
      <button class="settle-btn ghost" data-again>再来一组</button>
      <button class="settle-btn primary" data-done>完成</button>
    </div>
  </div>`;

  root.querySelectorAll('.settle-tile img').forEach((img, i) => {
    const w = words[i] && words[i].w;
    if (w) attachImage(img, w);
  });

  root.querySelectorAll('[data-done]').forEach((b) =>
    b.addEventListener('click', () => {
      endSession();
      ctx.go('home');
    }),
  );
  root.querySelector('[data-again]').addEventListener('click', () => startNext(ctx));
  root.querySelector('[data-dex]').addEventListener('click', () => ctx.go('stickers', { from: 'summary' }));
  root.querySelector('[data-addall]').addEventListener('click', () => {
    let n = 0;
    for (const x of words) {
      if (!x.w || !x.w.w) continue;
      const rec = recordOf(x.w.w);
      if (!rec || !rec.isFavorite) {
        toggleFavorite(x.w.w);
        n++;
      }
    }
    toast(n ? `已把 ${n} 个单词加入生词本` : '本组单词已经都在生词本里了');
  });
  root.querySelectorAll('[data-word]').forEach((el) => {
    el.addEventListener('click', () => openWordDetail(el.dataset.word));
  });
}
