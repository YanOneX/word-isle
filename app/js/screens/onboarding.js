// 首次使用引导

import { state, save } from '../store.js';

const SLIDES = [
  {
    art: '<img src="./assets/art/stack.svg" alt="" style="width:220px;height:170px;object-fit:contain" />',
    title: '一次只学一小叠',
    body: '看图选意、看词识图，还可以切换到语境填空。每个词都配了插画与发音，记不住的时候，点开详解看看例句和记忆提示。',
    extra: '<div class="ob-modes"><span class="on">看图选意</span><span>看词识图</span><span>语境填空</span></div>',
  },
  {
    art: '<div class="ob-art">✍️</div>',
    title: '答错就拼一遍',
    body: '第一遍没答对没关系。点一下正确答案，再把这个词亲手拼出来，错词会被安排到最近的复习里，直到真正记住。',
    extra: '',
  },
  {
    art: '<div class="ob-art">🗓️</div>',
    title: '按节奏走，稳稳的',
    body: '答对后会在第 1、7、30 天安排复习，答错会重新开始。每天按计划学几组，其余的交给节奏。进度只保存在这台设备上。',
    extra: '',
  },
];

let overlay = null;

function finish() {
  state.data.seenIntro = true;
  save(true);
  if (overlay) {
    const el = overlay;
    overlay = null;
    el.style.opacity = '0';
    el.style.transition = 'opacity .25s';
    setTimeout(() => el.remove(), 260);
  }
}

export function showOnboarding() {
  if (overlay) return;
  let idx = 0;
  overlay = document.createElement('div');
  overlay.className = 'onboarding';
  document.body.appendChild(overlay);

  function draw() {
    const s = SLIDES[idx];
    overlay.innerHTML = `<button class="skip" data-skip>跳过</button>
      <div class="ob-dots">${SLIDES.map((_, i) => `<i class="${i === idx ? 'on' : ''}"></i>`).join('')}</div>
      <div class="ob-stage">
        <div class="ob-slide">
          ${s.art}
          ${s.extra || ''}
          <h2>${s.title}</h2>
          <p>${s.body}</p>
          <button class="btn primary" data-next>${idx === SLIDES.length - 1 ? '开始使用' : '下一步'}</button>
        </div>
      </div>`;
    overlay.querySelector('[data-skip]').addEventListener('click', finish);
    overlay.querySelector('[data-next]').addEventListener('click', () => {
      if (idx >= SLIDES.length - 1) {
        finish();
        return;
      }
      idx++;
      draw();
    });
  }
  draw();
}
