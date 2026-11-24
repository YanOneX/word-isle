// 统计：学习量、正确率、热力图、掌握进度、记忆分布

import { esc, fmtNum, fmtMinutes, dayKey, startOfToday } from '../util.js';
import { icon } from '../ui.js';
import {
  state,
  settings,
  rangeData,
  barData,
  masteryBuckets,
  bookProgress,
  bookRecords,
  wrongRecords,
  streakDays,
  longestStreak,
} from '../store.js';
import { bookById, getWordObj } from '../data.js';
import { openPoster } from './poster.js';

let range = 'week';
let metric = 'new';

function rangeLabel() {
  return range === 'week' ? '本周' : range === 'month' ? '本月' : '累计';
}

function heatWeeks(weeks = 20) {
  const today = startOfToday();
  const dow = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (weeks - 1) * 7);
  const out = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = dayKey(d);
    const e = state.data.daily[k];
    const v = e ? (e.newW || 0) + (e.revW || 0) : 0;
    out.push({ key: k, value: v, future: d.getTime() > today.getTime() });
  }
  return out;
}

function levelOf(v) {
  if (v <= 0) return '';
  if (v < 4) return 'lv1';
  if (v < 9) return 'lv2';
  if (v < 16) return 'lv3';
  return 'lv4';
}

export function renderStats(root, params, ctx) {
  const rd = rangeData(range);
  const bd = barData(range);
  const agg = rd.agg;
  const total = (agg.newW || 0) + (agg.revW || 0);
  const days = agg.days || 0;
  const avg = days ? Math.round(total / days) : 0;
  const prog = bookProgress();
  const buckets = masteryBuckets();
  const recs = bookRecords();
  const maxCount = Math.max(1, buckets.firm, buckets.stable, buckets.fuzzy, buckets.forgot);
  const hard = wrongRecords()
    .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0))
    .slice(0, 5);
  const book = bookById(state.data.bookId);
  const eta = new Date();
  eta.setDate(eta.getDate() + (prog.daysLeft || 0));
  const etaYear = eta.getFullYear() === new Date().getFullYear() ? '' : `${eta.getFullYear()} 年 `;
  const etaText = `${etaYear}${eta.getMonth() + 1} 月 ${eta.getDate()} 日`;

  const maxBar = metric === 'acc' ? 100 : Math.max(1, ...bd.map((d) => d.value));
  const chart = bd
    .map((d, i) => {
      const v = metric === 'acc' ? d.acc : d.value;
      const h = v > 0 ? Math.max(3, (v / maxBar) * 100) : 0;
      const showLabel =
        range === 'week' ||
        (range === 'month' && (i === 0 || (i + 1) % 5 === 0)) ||
        (range === 'all' && i % 2 === 0);
      return `<div class="bcol ${v > 0 ? '' : 'empty'}" title="${esc(d.key)} · ${metric === 'acc' ? d.acc + '%' : d.value + ' 词'}">
        <div class="bval" style="height:${h}%"></div>
        ${showLabel ? `<span class="blabel">${esc(d.label)}</span>` : ''}
      </div>`;
    })
    .join('');

  const heat = heatWeeks(20);
  const heatCells = heat.map((d) => `<i class="${d.future ? 'future' : levelOf(d.value)}" title="${d.key} · ${d.value} 词"></i>`).join('');

  root.innerHTML = `<div class="page">
    <div class="page-head"><h1>统计</h1></div>
    <div class="stats-top">
      <div class="seg">
        <button data-range="week" class="${range === 'week' ? 'on' : ''}">本周</button>
        <button data-range="month" class="${range === 'month' ? 'on' : ''}">本月</button>
        <button data-range="all" class="${range === 'all' ? 'on' : ''}">全部</button>
      </div>
      <button class="share" data-poster title="生成海报">${icon('share')}</button>
    </div>
    <div class="stats-headline">${rangeLabel()}学习单词</div>
    <div class="stats-big">${fmtNum(total)}<small>词</small></div>
    <div class="stats-note">活跃 ${days} 天 · 日均 ${fmtNum(avg)} 词 · 首次正确率 ${agg.accuracy || 0}%</div>
    <div class="stats-trio">
      <div><div class="num">${agg.accuracy || 0}<small>%</small></div><div class="lbl">正确率</div></div>
      <div><div class="num">${fmtMinutes(agg.seconds)}</div><div class="lbl">学习时长</div></div>
      <div><div class="num">${streakDays()}<small>天</small></div><div class="lbl">连续打卡</div></div>
    </div>
    <div class="chart-head">
      <div class="mini-seg">
        <button data-metric="new" class="${metric === 'new' ? 'on' : ''}">新词量</button>
        <button data-metric="acc" class="${metric === 'acc' ? 'on' : ''}">正确率</button>
      </div>
    </div>
    <div class="barchart">${chart}</div>
    <div class="heat-wrap">
      <div class="heat-head"><span>学习热力</span><small>最近 20 周 · 最长连续 ${longestStreak()} 天</small></div>
      <div class="heatmap">${heatCells}</div>
    </div>
    <div class="stats-cards">
      <div class="scard">
        <div class="card-top"><span>当前词书掌握进度</span><span class="link" data-library>词库 ${icon('chevR')}</span></div>
        <div class="pct">${prog.percent}<small>%</small><span class="count">${fmtNum(prog.mastered)}<small>已掌握</small></span></div>
        <div class="plabel">${esc(book ? book.title : '')} · 共 ${fmtNum(prog.total)} 词</div>
        <div class="pbar"><i style="width:${prog.percent}%"></i></div>
        <div class="eta">
          <div class="date">${etaText}<small>预计完成日期</small></div>
          <div class="daily">按每天 ${settings().dailyGroups * settings().batchSize} 词估算</div>
        </div>
      </div>
      <div class="scard">
        <div class="card-top"><span>记忆分布</span><span class="muted">${fmtNum(recs.length)} 条记录</span></div>
        ${[
          ['牢固', buckets.firm, 'var(--accent)'],
          ['稳定', buckets.stable, '#8ccfb2'],
          ['模糊', buckets.fuzzy, '#d9c18c'],
          ['遗忘', buckets.forgot, '#e79aa3'],
        ]
          .map(
            ([name, count, color]) => `<div class="master-row">
              <span class="mname">${name}</span>
              <span class="mbar"><i style="width:${(count / maxCount) * 100}%;background:${color}"></i></span>
              <span class="mnum">${fmtNum(count)}</span>
            </div>`,
          )
          .join('')}
        <div class="hard-head"><span>最需要关注</span><span class="link" data-hard>去特训 ${icon('chevR')}</span></div>
        ${
          hard.length
            ? `<div class="hard-list">${hard
                .map((r) => `<div class="row"><span>${esc(r.word)}</span><small>错 ${r.wrongCount} 次</small></div>`)
                .join('')}</div>`
            : `<div class="muted" style="font-size:11px;padding:12px 0">还没有错词，继续保持</div>`
        }
      </div>
    </div>
    <div class="stats-cta">
      <span>${hard.length ? `有 ${hard.length} 个词需要再巩固一下` : '今天也没有错词，稳稳的'}</span>
      <button class="btn primary" data-hard>${hard.length ? '错词特训' : '去学习'}</button>
    </div>
  </div>`;

  root.querySelectorAll('[data-range]').forEach((b) =>
    b.addEventListener('click', () => {
      range = b.dataset.range;
      ctx.refresh();
    }),
  );
  root.querySelectorAll('[data-metric]').forEach((b) =>
    b.addEventListener('click', () => {
      metric = b.dataset.metric;
      ctx.refresh();
    }),
  );
  root.querySelector('[data-library]').addEventListener('click', () => ctx.go('library'));
  root.querySelectorAll('[data-hard]').forEach((b) =>
    b.addEventListener('click', () => {
      if (!hard.length) {
        ctx.go('home');
        return;
      }
      ctx.go('mask', { kind: 'wrong', from: 'stats' });
    }),
  );
  root.querySelector('[data-poster]').addEventListener('click', () => {
    openPoster({
      main: prog.mastered,
      mainUnit: '词',
      mainLabel: `已掌握 · ${book ? book.title : ''}`,
      bookTitle: book ? book.title : '',
      newW: agg.newW || 0,
      revW: agg.revW || 0,
      accuracy: agg.accuracy || 0,
      streak: streakDays(),
      heat: heat.map((h) => h.value),
      hard: hard.map((r) => ({ w: r.word, mean: getWordObj(r.word).t })),
    });
  });
}
