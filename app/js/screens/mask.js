// 遮挡背词（错词本 / 生词本）：可拖动的色块 + 八色自定义

import { esc, clamp } from '../util.js';
import { icon, toast } from '../ui.js';
import { state, wrongRecords, favoriteRecords, save } from '../store.js';
import { getWordObj } from '../data.js';
import { openWordDetail } from './detail.js';

export const MASK_COLORS = [
  { name: '烟雨灰', hex: '#3A4453' },
  { name: '冷苔灰', hex: '#55605A' },
  { name: '燕麦灰', hex: '#756B5C' },
  { name: '豆沙绿', hex: '#5C7364' },
  { name: '雾霾蓝', hex: '#4B5F73' },
  { name: '肉粉灰', hex: '#7C6666' },
  { name: '灰香芋', hex: '#675E78' },
  { name: '冰雾青', hex: '#4E6B6B' },
];

let filterText = '';

function colorOf(name) {
  return (MASK_COLORS.find((c) => c.name === name) || MASK_COLORS[0]).hex;
}

export function renderMask(root, params, ctx) {
  const kind = params.kind === 'fav' ? 'fav' : 'wrong';
  const recs = (kind === 'fav' ? favoriteRecords() : wrongRecords()).slice();
  if (kind === 'fav') recs.sort((a, b) => (b.favUpdatedAt || 0) - (a.favUpdatedAt || 0));
  else recs.sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
  const title = kind === 'fav' ? '生词本' : '错词本';
  const view = state.data.maskView || (state.data.maskView = { color: '烟雨灰', x: null, y: null, visible: true });
  filterText = '';

  const rows = recs
    .map((r) => {
      const w = getWordObj(r.word);
      return `<div class="mask-row" data-row data-text="${esc((r.word + ' ' + (r.translation || w.t || '')).toLowerCase())}">
        <span class="word">${esc(r.word)}</span>
        <span class="mean">${esc((r.translation || w.t || '').replace(/\n/g, ' ').slice(0, 46))}</span>
      </div>`;
    })
    .join('');

  root.innerHTML = `<div class="mask-screen">
    <div class="mask-inner">
      <div class="mask-head">
        <div style="display:flex;align-items:center;gap:12px">
          <button class="iconbtn solid" data-back>${icon('back')}</button>
          <div><h2>${title}</h2><div class="muted" style="font-size:10.5px;margin-top:2px">共 <span data-count>${recs.length}</span> 词 · 拖动色块遮住释义自测</div></div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn soft mini" data-visible>${view.visible ? '隐藏色块' : '显示色块'}</button>
          <button class="iconbtn solid" data-palette title="色块颜色">${icon('palette')}</button>
        </div>
      </div>
      <div class="mask-tools">
        <div class="mask-search">${icon('search')}<input placeholder="搜索错词或释义" autocomplete="off" /></div>
        <span class="muted" style="font-size:10.5px">点击任意一行查看单词详情</span>
      </div>
      <div class="mask-list" data-list>
        ${rows || '<div class="empty-state"><div class="big">✦</div>这里还没有单词</div>'}
        <div class="mask-card" data-card style="background:${colorOf(view.color)};display:${view.visible ? 'block' : 'none'}">
          <div class="grab"></div>
          <div class="mask-hint">拖动我 · 遮住右侧释义</div>
        </div>
      </div>
    </div>
  </div>`;

  root.querySelector('[data-back]').addEventListener('click', () => {
    ctx.go(params.from === 'me' ? 'me' : params.from === 'stats' ? 'stats' : 'library');
  });

  const list = root.querySelector('[data-list]');
  const card = root.querySelector('[data-card]');
  const search = root.querySelector('.mask-search input');
  const countEl = root.querySelector('[data-count]');

  // 初始位置
  requestAnimationFrame(() => {
    const maxX = Math.max(0, list.clientWidth - card.offsetWidth - 12);
    const maxY = Math.max(0, list.clientHeight - card.offsetHeight - 12);
    let x = view.x == null ? maxX - 8 : clamp(view.x, 0, maxX);
    let y = view.y == null ? 14 : clamp(view.y, 0, maxY);
    card.style.left = x + 'px';
    card.style.top = y + 'px';
  });

  let drag = null;
  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.grab') || e.target === card || e.target.classList.contains('mask-hint')) {
      const rect = list.getBoundingClientRect();
      drag = { dx: e.clientX - rect.left - card.offsetLeft, dy: e.clientY - rect.top - card.offsetTop, rect };
      card.setPointerCapture(e.pointerId);
      card.style.cursor = 'grabbing';
      e.preventDefault();
    }
  });
  card.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = drag.rect;
    const maxX = Math.max(0, list.clientWidth - card.offsetWidth - 12);
    const maxY = Math.max(0, list.clientHeight - card.offsetHeight - 12);
    const x = clamp(e.clientX - rect.left - drag.dx, 0, maxX);
    const y = clamp(e.clientY - rect.top - drag.dy, 0, maxY);
    card.style.left = x + 'px';
    card.style.top = y + 'px';
    view.x = x;
    view.y = y;
  });
  card.addEventListener('pointerup', (e) => {
    if (!drag) return;
    drag = null;
    card.style.cursor = 'grab';
    view.x = card.offsetLeft;
    view.y = card.offsetTop;
    save();
    card.releasePointerCapture(e.pointerId);
  });

  root.querySelector('[data-visible]').addEventListener('click', (e) => {
    view.visible = !view.visible;
    card.style.display = view.visible ? 'block' : 'none';
    e.currentTarget.textContent = view.visible ? '隐藏色块' : '显示色块';
    save();
  });

  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let n = 0;
    list.querySelectorAll('[data-row]').forEach((row) => {
      const hit = !q || row.dataset.text.includes(q);
      row.style.display = hit ? '' : 'none';
      if (hit) n++;
    });
    countEl.textContent = String(n);
    if (q && !n) {
      if (!list.querySelector('.no-hit')) {
        const d = document.createElement('div');
        d.className = 'empty-state no-hit';
        d.textContent = '没有匹配的单词';
        list.appendChild(d);
      }
    } else {
      list.querySelector('.no-hit')?.remove();
    }
  });

  list.querySelectorAll('[data-row]').forEach((row) =>
    row.addEventListener('click', () => {
      const word = row.querySelector('.word').textContent;
      openWordDetail(word, {
        onChange: () => ctx.refresh(),
      });
    }),
  );

  // 调色板
  let pop = null;
  function closePop() {
    if (pop) {
      pop.remove();
      pop = null;
      document.removeEventListener('mousedown', outside, true);
    }
  }
  function outside(e) {
    if (pop && !pop.contains(e.target)) closePop();
  }
  root.querySelector('[data-palette]').addEventListener('click', (e) => {
    e.stopPropagation();
    if (pop) {
      closePop();
      return;
    }
    pop = document.createElement('div');
    pop.className = 'palette-pop';
    pop.innerHTML = `<div class="pp-head"><span>遮挡色块</span><span>${esc(view.color)}</span></div>
      <div class="palette-grid">${MASK_COLORS.map(
        (c) =>
          `<button data-color="${esc(c.name)}" class="${c.name === view.color ? 'on' : ''}"><span class="sw" style="background:${c.hex}"></span><span class="pn">${esc(c.name)}</span></button>`,
      ).join('')}</div>`;
    document.body.appendChild(pop);
    const r = e.currentTarget.getBoundingClientRect();
    pop.style.position = 'fixed';
    pop.style.left = Math.min(window.innerWidth - 270, Math.max(12, r.right - 252)) + 'px';
    pop.style.top = r.bottom + 8 + 'px';
    pop.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-color]');
      if (!b) return;
      const name = b.dataset.color;
      view.color = name;
      card.style.background = colorOf(name);
      pop.querySelector('.pp-head span:last-child').textContent = name;
      pop.querySelectorAll('[data-color]').forEach((x) => x.classList.toggle('on', x.dataset.color === name));
      state.data.maskColor = name;
      save();
      toast(`已换成「${name}」`);
    });
    setTimeout(() => document.addEventListener('mousedown', outside, true), 0);
  });
}
