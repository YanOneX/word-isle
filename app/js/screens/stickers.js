// 贴纸图鉴：完成学习组后获得贴纸（本地化替代原版云端收集）

import { esc } from '../util.js';
import { icon, toast } from '../ui.js';
import { state, save, emit } from '../store.js';

export const STICKERS = [
  { id: 's01', img: 'settle', name: '稳稳起步', mean: '第一步，稳稳地', filter: 'none' },
  { id: 's02', img: 'settle', name: '稳稳加油', mean: '不慌，慢慢来', filter: 'hue-rotate(-12deg) saturate(1.1)' },
  { id: 's03', img: 'settle', name: '稳稳通关', mean: '这一关拿下', filter: 'hue-rotate(18deg) saturate(1.15)' },
  { id: 's04', img: 'settle', name: '稳稳收藏', mean: '收藏进心里', filter: 'hue-rotate(42deg) saturate(0.92)' },
  { id: 's05', img: 'failure', name: '不怕错', mean: '错了才记得牢', filter: 'none' },
  { id: 's06', img: 'failure', name: '再来一次', mean: '第二次一定行', filter: 'hue-rotate(-16deg) saturate(1.1)' },
  { id: 's07', img: 'failure', name: '越挫越勇', mean: '错词也是朋友', filter: 'hue-rotate(24deg) saturate(1.05)' },
  { id: 's08', img: 'failure', name: '错词猎人', mean: '把漏网之鱼抓回来', filter: 'hue-rotate(-38deg)' },
  { id: 's09', img: 'stack', name: '词汇叠叠乐', mean: '一层一层叠起来', filter: 'none' },
  { id: 's10', img: 'stack', name: '厚积薄发', mean: '今天的积累会发光', filter: 'hue-rotate(30deg) saturate(1.1)' },
  { id: 's11', img: 'stack', name: '每日一叠', mean: '每天都加一层', filter: 'hue-rotate(-24deg)' },
  { id: 's12', img: 'stack', name: '叠满整本', mean: '词书迟早叠满', filter: 'hue-rotate(58deg) saturate(0.9)' },
  { id: 's13', img: 'adjustment', name: '及时调整', mean: '方法对了就快了', filter: 'none' },
  { id: 's14', img: 'adjustment', name: '换个角度', mean: '绕个弯也能到', filter: 'hue-rotate(-20deg) saturate(1.12)' },
  { id: 's15', img: 'adjustment', name: '今日复盘', mean: '回头看一眼更清楚', filter: 'hue-rotate(36deg)' },
  { id: 's16', img: 'adjustment', name: '稳稳上岸', mean: '目标就在前面', filter: 'hue-rotate(14deg) saturate(1.2)' },
];

function stickerById(id) {
  return STICKERS.find((s) => s.id === id) || STICKERS[0];
}

export function stickerImg(s, cls = '') {
  return `<img src="./assets/art/${s.img}.svg" alt="${esc(s.name)}" class="${cls}" style="filter:${s.filter}" draggable="false" />`;
}

export function awardStickers(n = 1) {
  const unlocked = new Set(state.data.stickers.unlocked || []);
  const locked = STICKERS.filter((s) => !unlocked.has(s.id));
  const got = [];
  while (got.length < n && locked.length) {
    const i = Math.floor(Math.random() * locked.length);
    const s = locked.splice(i, 1)[0];
    unlocked.add(s.id);
    got.push(s.id);
  }
  state.data.stickers.unlocked = [...unlocked];
  save();
  emit();
  return got;
}

let tab = 'all';
let previewId = null;

export function renderStickers(root, params, ctx) {
  const unlocked = new Set(state.data.stickers.unlocked || []);
  const starred = new Set(state.data.stickers.starred || []);
  const all = STICKERS;
  const list = tab === 'all' ? all : tab === 'own' ? all.filter((s) => unlocked.has(s.id)) : all.filter((s) => starred.has(s.id));
  const firstOwned = all.find((s) => unlocked.has(s.id)) || all[0];
  const preview = stickerById(previewId && all.some((s) => s.id === previewId) ? previewId : firstOwned.id);
  const isOwned = unlocked.has(preview.id);
  const isStar = starred.has(preview.id);

  root.innerHTML = `<div class="stickers-screen">
    <div class="stickers-inner">
      <div class="page-head">
        <button class="iconbtn back" data-back>${icon('back')}</button>
        <h1>贴纸图鉴</h1>
      </div>
      <div class="stickers-preview">
        <div class="sp-img">${stickerImg(preview)}</div>
        <h2>${esc(isOwned ? preview.name : '未解锁')}</h2>
        <div class="mean">${esc(isOwned ? preview.mean : '完成一组学习，就有机会获得新贴纸')}</div>
        <div class="card3d">✦ 3D 收藏卡 · ${unlocked.size}/${all.length}</div>
        ${
          isOwned
            ? `<button class="btn ${isStar ? 'green' : 'soft'}" style="height:34px;margin-top:12px;font-size:11.5px" data-star>${icon('star')} ${isStar ? '已星标' : '星标这张'}</button>`
            : ''
        }
      </div>
      <div class="sticker-tabs">
        <button data-tab="all" class="${tab === 'all' ? 'on' : ''}">全部 ${all.length}</button>
        <button data-tab="own" class="${tab === 'own' ? 'on' : ''}">已收集 ${unlocked.size}</button>
        <button data-tab="star" class="${tab === 'star' ? 'on' : ''}">星标 ${starred.size}</button>
      </div>
      ${
        list.length
          ? `<div class="sticker-grid">${list
              .map(
                (s) => `<div class="sticker-cell ${unlocked.has(s.id) ? '' : 'locked'} ${s.id === preview.id ? 'on' : ''}" data-id="${s.id}">
                  <div class="sc-img">${stickerImg(s)}</div>
                  <div class="sc-name">${unlocked.has(s.id) ? esc(s.name) : '？？？'}${starred.has(s.id) ? ' ★' : ''}</div>
                </div>`,
              )
              .join('')}</div>`
          : `<div class="sticker-empty">${tab === 'star' ? '还没有星标的贴纸' : '还没有收集到贴纸，先去学习吧'}</div>`
      }
    </div>
  </div>`;

  root.querySelector('[data-back]').addEventListener('click', () => {
    const s = state.data.session;
    if (params && params.from === 'summary' && s && s.phase === 'summary') ctx.go('summary');
    else ctx.go('me');
  });
  root.querySelectorAll('[data-tab]').forEach((b) =>
    b.addEventListener('click', () => {
      tab = b.dataset.tab;
      ctx.refresh();
    }),
  );
  root.querySelectorAll('[data-id]').forEach((el) =>
    el.addEventListener('click', () => {
      previewId = el.dataset.id;
      if (!unlocked.has(el.dataset.id)) toast('完成一组学习即可解锁这张贴纸');
      ctx.refresh();
    }),
  );
  const star = root.querySelector('[data-star]');
  if (star)
    star.addEventListener('click', () => {
      const starSet = new Set(state.data.stickers.starred || []);
      if (starSet.has(preview.id)) starSet.delete(preview.id);
      else starSet.add(preview.id);
      state.data.stickers.starred = [...starSet];
      save();
      ctx.refresh();
    });
}
