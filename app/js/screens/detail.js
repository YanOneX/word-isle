// 单词详情弹窗（对应原版「详解」）

import { esc } from '../util.js';
import { getWordObj, attachImage, imageUrl } from '../data.js';
import { openModal, icon, toast } from '../ui.js';
import { speak } from '../speech.js';
import { settings, recordOf, ensureRecord, toggleFavorite, graduateWord, resetWordStage, save, emit } from '../store.js';
import { reviewAt } from '../util.js';

function meaningRows(w) {
  const t = String(w.t || '');
  if (!t) return '';
  const parts = t.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  const rows = parts.length ? parts : [t];
  return rows
    .map((line, i) => {
      const m = line.match(/^([a-z]+\.)\s*(.*)$/i);
      const pos = m ? m[1] : i === 0 ? w.p || '' : '';
      const txt = m ? m[2] : line;
      return `<div class="detail-mean"><div class="pos">${esc(pos)}</div><div class="txt">${esc(txt)}</div></div>`;
    })
    .join('');
}

export function openWordDetail(word, { onChange } = {}) {
  const w = typeof word === 'string' ? getWordObj(word) : word;
  if (!w) return null;
  const rec = recordOf(w.w);
  const mastered = !!(rec && rec.isMastered);
  const fav = !!(rec && rec.isFavorite);
  const has = (arr) => Array.isArray(arr) && arr.length > 0;

  const html = `<div class="detail-modal">
    <div class="detail-badge">${mastered ? '<button class="mastered" data-master>已掌握 · 点击重学</button>' : '<span class="mastered" data-master style="background:transparent;border-color:var(--line);color:var(--muted)">标记已掌握</span>'}</div>
    <div class="detail-close">
      <button class="iconbtn" data-fav title="收藏">${icon('star')}</button>
      <button class="iconbtn" data-close title="关闭">${icon('x')}</button>
    </div>
    <div class="detail-img"><img alt="${esc(w.w)}" /></div>
    <div class="detail-word">${esc(w.w)}</div>
    <div class="detail-phon">
      ${w.us ? `<button data-say="us">${icon('speaker')}<span>美 ${esc(w.us)}</span></button>` : ''}
      ${w.uk ? `<button data-say="uk">${icon('speaker')}<span>英 ${esc(w.uk)}</span></button>` : ''}
    </div>
    ${meaningRows(w)}
    ${
      w.en
        ? `<div class="detail-block"><h4><span>例句</span><button class="iconbtn" style="width:22px;height:22px" data-say-example>${icon('speaker')}</button></h4>
            <div class="en">${esc(w.en)}</div>${w.cn ? `<div class="cn">${esc(w.cn)}</div>` : ''}</div>`
        : ''
    }
    ${
      has(w.phr)
        ? `<div class="detail-block"><h4>常用词组</h4><div class="chip-row">${w.phr.map((p) => `<span class="chip">${esc(p)}</span>`).join('')}</div></div>`
        : ''
    }
    ${
      has(w.conf)
        ? `<div class="detail-block"><h4>易混词</h4><div class="chip-row">${w.conf
            .map((c) => `<span class="chip">${esc(c.w)} ${esc(c.pos || '')} ${esc(c.def || '')}</span>`)
            .join('')}</div></div>`
        : ''
    }
    ${
      has(w.fam)
        ? `<div class="detail-block"><h4>同族词</h4><div class="fam-row">${w.fam
            .map((f) => `<div class="fam">${esc(f.w)} <small>${esc(f.pos || '')} ${esc(f.def || '')}</small></div>`)
            .join('')}</div></div>`
        : ''
    }
    ${w.tip ? `<div class="detail-block"><h4>记忆提示</h4><div class="tips">${esc(w.tip)}</div></div>` : ''}
    <div class="detail-foot">
      <button class="btn soft" data-fav-btn>${fav ? '已收藏' : '收藏这个词'}</button>
      <button class="btn primary" data-close>知道了</button>
    </div>
  </div>`;

  const modal = openModal(html, { className: 'detail', closeOnBackdrop: true });
  const sheet = modal.sheet;

  const img = sheet.querySelector('.detail-img img');
  if (imageUrl(w)) attachImage(img, w);
  else img.src = '';

  const syncFav = (on) => {
    const favIcon = sheet.querySelector('[data-fav]');
    favIcon.classList.toggle('star-on', on);
    const btn = sheet.querySelector('[data-fav-btn]');
    if (btn) btn.textContent = on ? '已收藏' : '收藏这个词';
  };
  syncFav(fav);

  sheet.querySelectorAll('[data-say]').forEach((btn) => {
    btn.addEventListener('click', () => {
      speak(w.w, { accent: btn.dataset.say, rate: 0.88 });
    });
  });
  const exBtn = sheet.querySelector('[data-say-example]');
  if (exBtn) exBtn.addEventListener('click', () => speak(w.en, { accent: settings().accent, rate: 0.92 }));

  const doFav = () => {
    const on = toggleFavorite(w.w);
    syncFav(on);
    toast(on ? '已加入生词本' : '已取消收藏');
    onChange && onChange();
  };
  sheet.querySelector('[data-fav]').addEventListener('click', doFav);
  sheet.querySelector('[data-fav-btn]').addEventListener('click', doFav);

  sheet.querySelectorAll('[data-master]').forEach((el) => {
    el.addEventListener('click', () => {
      const r = recordOf(w.w);
      if (r && r.isMastered) {
        // 原版：从已掌握恢复为待学 —— 回到第 1 阶段，保留错误次数
        r.isMastered = false;
        r.stage = 1;
        r.nextReviewAt = reviewAt(1);
        r.lastReviewedAt = Date.now();
        save();
        emit();
        toast(`已将 “${w.w}” 恢复为待学状态`);
      } else {
        ensureRecord(w);
        const rr = recordOf(w.w);
        graduateWord(rr);
        toast(`已标记 “${w.w}” 为掌握`);
      }
      onChange && onChange();
      openWordDetail(w, { onChange });
      modal.close();
    });
  });

  return modal;
}
