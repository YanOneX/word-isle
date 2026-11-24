// 一组学习结束后的总结页

import { esc, fmtDuration, dayKey, todayWeek, WEEK_LABEL } from '../util.js';
import { icon, toast } from '../ui.js';
import {
  state,
  settings,
  activeSession,
  endSession,
  startSession,
  nextStudyWords,
  dueRecords,
} from '../store.js';
import { getWordObj } from '../data.js';
import { openWordDetail } from './detail.js';
import { STICKERS, stickerImg } from './stickers.js';

let expandAll = false;

function weekDots() {
  const punched = new Set(state.data.streak.days || []);
  return `<div class="summary-week">${todayWeek()
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
  const visible = expandAll ? words : words.slice(0, 3);
  const stickers = (sum.stickers || []).map((id) => STICKERS.find((s) => s.id === id)).filter(Boolean);
  const label = session.kind === 'review' ? '复习' : `第 ${(session.chapter || 0) + 1} 关`;

  root.innerHTML = `<div class="summary-screen">
    <div class="summary-head">
      <span class="pill">${icon('check')} ${label} · 完成</span>
      <button class="iconbtn" data-done>${icon('x')}</button>
    </div>
    <div class="summary-inner">
      <img class="summary-mascot" src="./assets/art/settle.svg" alt="完成" />
      <div class="summary-title">${sum.accuracy >= 90 ? '稳稳拿下' : sum.accuracy >= 60 ? '又前进了一步' : '记住它们就好'}</div>
      <div class="summary-sub">本组 ${sum.total || words.length} 个单词 · 用时 ${fmtDuration(sum.seconds)}${sum.maxCombo ? ` · 最高 ${sum.maxCombo} 连击` : ''}</div>
      <div class="summary-card">
        <div class="summary-stats">
          <div><div class="sn">${sum.newW || 0}<small> 词</small></div><div class="sl">本组新词</div></div>
          <div><div class="sn">${sum.accuracy || 0}<small>%</small></div><div class="sl">首次答对率</div></div>
        </div>
        ${weekDots()}
      </div>
      <div class="rank-bar">
        <span class="left"><i></i><span>首次答对 ${sum.correct || 0}/${sum.total || words.length} 个 · 复习词 ${sum.revW || 0} 个</span></span>
        <span class="link" data-stats>查看统计</span>
      </div>
      <div class="sticker-card">
        <div class="sc-head"><span>本组贴纸</span><span class="link" data-dex>查看图鉴 ${icon('chevR')}</span></div>
        ${
          stickers.length
            ? `<div class="sticker-row">${stickers
                .map(
                  (s) => `<div class="sticker-tile"><div class="st-img">${stickerImg(s)}</div><div class="st-name">${esc(s.name)}</div></div>`,
                )
                .join('')}</div>`
            : `<div class="muted" style="font-size:11px;margin-top:12px">这组没有新的贴纸，继续学习还有机会</div>`
        }
      </div>
      <div class="review-list">
        <div class="rl-head"><span>再看一眼</span><button class="btn soft" data-expand>${expandAll ? '收起' : '展开全部'}</button></div>
        ${visible
          .map(
            (x) => `<div class="review-item" data-word="${esc(x.key)}">
              <div><b>${esc(x.w.w)}</b> <span class="ri-mean">${esc((x.w.t || '').slice(0, 30))}</span></div>
              <span class="ri-mark ${x.res.quizFirstTry === false ? '' : 'on'}"></span>
            </div>`,
          )
          .join('')}
      </div>
      <div class="summary-actions">
        <button class="btn soft" data-again>再来一组</button>
        <button class="btn primary" data-done>完成</button>
      </div>
    </div>
  </div>`;

  root.querySelectorAll('[data-done]').forEach((b) =>
    b.addEventListener('click', () => {
      endSession();
      ctx.go('home');
    }),
  );
  root.querySelector('[data-again]').addEventListener('click', () => startNext(ctx));
  root.querySelector('[data-stats]').addEventListener('click', () => {
    endSession();
    ctx.go('stats');
  });
  root.querySelector('[data-dex]').addEventListener('click', () => ctx.go('stickers', { from: 'summary' }));
  root.querySelector('[data-expand]').addEventListener('click', () => {
    expandAll = !expandAll;
    ctx.refresh();
  });
  root.querySelectorAll('[data-word]').forEach((el) =>
    el.addEventListener('click', () => openWordDetail(el.dataset.word)),
  );
}
