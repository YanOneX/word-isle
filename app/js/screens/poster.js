// 学习海报：Canvas 生成、可保存 PNG

import { icon, openModal, toast } from '../ui.js';
import { fmtNum, dayKey } from '../util.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPoster(canvas, d) {
  const W = 660;
  const H = 1020;
  const scale = 2;
  canvas.width = W * scale;
  canvas.height = H * scale;
  canvas.style.width = W / 2 + 'px';
  canvas.style.height = H / 2 + 'px';
  const c = canvas.getContext('2d');
  c.scale(scale, scale);
  c.fillStyle = '#ffffff';
  c.fillRect(0, 0, W, H);

  c.fillStyle = '#6b7280';
  c.font = '20px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText('我的背单词记录', 52, 84);
  c.fillStyle = '#17202f';
  c.font = '600 26px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText(d.bookTitle || '词书', 52, 122);

  c.fillStyle = '#1c8f62';
  c.font = '600 118px "Source Serif 4",Georgia,serif';
  c.fillText(fmtNum(d.main), 48, 260);
  const mainW = c.measureText(fmtNum(d.main)).width;
  c.fillStyle = '#17202f';
  c.font = '26px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText(d.mainUnit || '词', 48 + mainW + 10, 258);
  c.fillStyle = '#8a94a3';
  c.font = '19px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText(d.mainLabel || '累计掌握', 52, 300);

  const stats = [
    [fmtNum(d.newW), '新词'],
    [fmtNum(d.revW), '复习'],
    [d.accuracy + '%', '正确率'],
    [d.streak + ' 天', '连续打卡'],
  ];
  stats.forEach(([v, l], i) => {
    const x = 52 + i * 143;
    c.fillStyle = '#17202f';
    c.font = '600 32px "PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(v, x, 390);
    c.fillStyle = '#8a94a3';
    c.font = '17px "PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText(l, x, 420);
  });

  c.strokeStyle = '#eef0f2';
  c.beginPath();
  c.moveTo(52, 452);
  c.lineTo(608, 452);
  c.stroke();

  c.fillStyle = '#6b7280';
  c.font = '18px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText('近 18 周学习热力', 52, 496);

  const cell = 18;
  const gap = 6;
  const startX = 52;
  const startY = 522;
  const cols = 18;
  const rows = 7;
  const allVals = d.heat || [];
  const vals = allVals.slice(-cols * rows);
  for (let i = 0; i < cols * rows; i++) {
    const x = startX + Math.floor(i / rows) * (cell + gap);
    const y = startY + (i % rows) * (cell + gap);
    const v = vals[i] || 0;
    c.fillStyle = v > 15 ? '#1c8f62' : v > 8 ? '#5cbb95' : v > 3 ? '#a7ddc7' : v > 0 ? '#d9f1e6' : '#f1f3f4';
    roundRect(c, x, y, cell, cell, 4);
    c.fill();
  }

  const words = (d.hard || []).slice(0, 4);
  c.fillStyle = '#6b7280';
  c.font = '18px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText('还在路上的词', 52, 720);
  words.forEach((w, i) => {
    const y = 760 + i * 44;
    c.fillStyle = '#17202f';
    c.font = '500 21px "Inter","PingFang SC",sans-serif';
    c.fillText(w.w, 52, y);
    c.fillStyle = '#8a94a3';
    c.font = '16px "PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText((w.mean || '').slice(0, 20), 250, y);
  });
  if (!words.length) {
    c.fillStyle = '#b0b7c0';
    c.font = '17px "PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('暂时没有错词，保持住。', 52, 762);
  }

  c.fillStyle = '#b0b7c0';
  c.font = '15px "PingFang SC","Microsoft YaHei",sans-serif';
  c.fillText(`${dayKey()} · 词屿`, 52, 962);
  c.textAlign = 'right';
  c.fillText('稳稳地，一个一个来', 608, 962);
  c.textAlign = 'left';
}

export function openPoster(data) {
  const html = `<div class="poster-modal">
    <canvas class="poster-canvas"></canvas>
    <div class="poster-actions">
      <button class="btn primary" data-save>${icon('download')} 保存图片</button>
      <button class="btn ghost" data-close>关闭</button>
    </div>
  </div>`;
  const modal = openModal(html, { className: 'bare', closeOnBackdrop: true });
  const canvas = modal.sheet.querySelector('canvas');
  drawPoster(canvas, data);
  modal.sheet.querySelector('[data-save]').addEventListener('click', () => {
    try {
      const a = document.createElement('a');
      a.download = `词屿-${dayKey()}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
      toast('海报已保存');
    } catch {
      toast('保存失败，可尝试截图');
    }
  });
  return modal;
}
