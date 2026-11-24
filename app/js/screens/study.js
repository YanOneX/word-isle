// 学习与复习：对齐原版的两段式流程
//   第一段：看图选义（整组 5 词）→ 第二段：看义拼写（整组非跳过词）
// 顶部：返回 / 第 N 组 / ‹ 1/5 › / 跳过（✓），进度条 5 段

import { esc, sample, coreMeaning, escapeReg, dayKey } from '../util.js';
import { icon, toast, confirmDialog } from '../ui.js';
import {
  state,
  settings,
  activeSession,
  save,
  endSession,
  recordOf,
  ensureRecord,
  recordCorrectReview,
  recordMistake,
  advanceAfterStep1MistakeRecovery,
  scheduleLearnedWord,
  dailyEntry,
  punchToday,
  markGroupCompleted,
} from '../store.js';
import { getWordObj, bookById, bookWords, attachImage } from '../data.js';
import { speak } from '../speech.js';
import { comboHit, success as okSound, error as errSound } from '../sfx.js';
import { openWordDetail } from './detail.js';
import { awardStickers } from './stickers.js';

let lock = false;
let spellLock = false;
let keyHandler = null;
let autoSpoken = '';
let navToken = 0;
let timer = null;
let bankMode = false;

function setKeyHandler(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

function later(ms, fn) {
  if (timer) clearTimeout(timer);
  const token = ++navToken;
  timer = setTimeout(() => {
    if (token !== navToken) return;
    timer = null;
    fn();
  }, ms);
}

function cancelLater() {
  if (timer) clearTimeout(timer);
  timer = null;
  navToken++;
}

function lettersOf(word) {
  return [...String(word)].filter((c) => /[a-z]/i.test(c)).map((c) => c.toLowerCase());
}

// 原版学习页只显示前两个义项，用「；」连接
function meaningText(w, n = 2) {
  const core = coreMeaning(w && w.t ? w.t : '');
  return core
    .split(/[；;，,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, n)
    .join('；');
}

// 原版音标只显示一个（默认美音），方括号换成斜杠
function phonText(w) {
  const raw = String(w.us || w.uk || '').trim();
  if (!raw) return '';
  const inner = raw.replace(/^[\[/]+|[\]/]+$/g, '');
  return inner ? `/${inner}/` : '';
}

function posText(w) {
  return String(w.p || '').replace(/[.\s]+$/, '');
}

function sayBtn(w) {
  return `<button class="say" data-say title="发音">${icon('speaker')}</button>`;
}

function poolFor(bookId, correct) {
  const conf = Array.isArray(correct.conf)
    ? correct.conf.map((c) => getWordObj(c.w)).filter((w) => w && w.t && w.w !== correct.w)
    : [];
  const book = bookById(bookId);
  const rest = book ? bookWords(book).filter((w) => w && w.w !== correct.w && w.t) : [];
  return [...conf, ...sample(rest, 60)];
}

function pickMode(w) {
  const setting = settings().step1 || 'pic_meaning';
  const canCloze = !!(w.en && new RegExp(`\\b${escapeReg(w.w)}\\b`, 'i').test(w.en));
  const canPic = !!w.img || true;
  if (setting === 'mix') {
    const pool = ['pic_meaning', 'word_pic'];
    if (canCloze) pool.push('cloze');
    return pool[Math.floor(Math.random() * pool.length)];
  }
  if (setting === 'cloze') return canCloze ? 'cloze' : 'pic_meaning';
  if (setting === 'word_pic') return canPic ? 'word_pic' : 'pic_meaning';
  return 'pic_meaning';
}

function makeOptions(correct, pool, keyOfCorrect) {
  const seen = new Set([keyOfCorrect]);
  const picked = [];
  for (const cand of pool) {
    if (picked.length >= 3) break;
    const key = keyOfCorrect === 't' ? cand.t : cand.w;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    picked.push(cand);
  }
  // 池子不够时用词书里其它词补足
  if (picked.length < 3) {
    for (const cand of pool) {
      if (picked.length >= 3) break;
      if (picked.includes(cand)) continue;
      picked.push(cand);
    }
  }
  const arr = [correct, ...picked];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.map((w) => w.w);
}

function ensurePlan(session) {
  if (Array.isArray(session.plan) && session.plan.length === session.words.length) return session.plan;
  session.plan = session.words.map((key) => {
    const w = getWordObj(key);
    const mode = pickMode(w);
    const pool = poolFor(session.bookId, w);
    const options = makeOptions(w, pool, mode === 'pic_meaning' ? 't' : 'w');
    return { w: key, mode, options };
  });
  save();
  return session.plan;
}

function ensureSpellQueue(session) {
  if (Array.isArray(session.spellQueue)) return session.spellQueue;
  session.spellQueue = session.words.filter((k) => !(session.results[k] || {}).skipped);
  save();
  return session.spellQueue;
}

function listOf(session) {
  return session.step === 'spell' ? ensureSpellQueue(session) : session.words;
}

// ---------- 连击动画 ----------
function comboFx(n) {
  const burst = document.createElement('div');
  burst.className = 'celebrate';
  burst.innerHTML = `<div class="burst">
    <div class="nice">NICE!</div>
    <div class="hits">✨ ${n} HIT${n > 1 ? 'S' : ''}!</div>
    ${Array.from({ length: 8 }, () => {
      const dx = (Math.random() * 240 - 120).toFixed(0);
      const dy = (Math.random() * -190 - 40).toFixed(0);
      const colors = ['#34d399', '#60a5fa', '#fbbf24', '#f472b6'];
      return `<span class="star" style="left:50%;top:48%;--dx:${dx}px;--dy:${dy}px;color:${colors[Math.floor(Math.random() * colors.length)]}">✦</span>`;
    }).join('')}
  </div>`;
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1000);
}

// ---------- 顶部 ----------
function headHtml(session, total) {
  const label = session.kind === 'review' ? '复习' : `第 ${(session.chapter || 0) + 1} 组`;
  const n = Math.min(session.index + 1, total);
  const prevDis = session.index <= 0 ? ' disabled' : '';
  const nextDis = session.index >= total - 1 ? ' disabled' : '';
  return `<header class="st-head">
    <button class="st-back" data-exit title="退出">${icon('chevL')}</button>
    <div class="st-mid">
      <button class="st-group" data-group>${label}${icon('chevD', 'chev')}</button>
      <span class="st-div"></span>
      <div class="st-nav">
        <button data-prev${prevDis}>${icon('chevL')}</button>
        <span class="st-count"><b>${n}</b><i>/</i>${total}</span>
        <button data-next${nextDis}>${icon('chevR')}</button>
      </div>
    </div>
    <span class="st-spacer"></span>
  </header>
  <div class="st-bar">${Array.from({ length: total }, () => '<i></i>').join('')}</div>
  <div class="st-skiprow"><button class="st-skip" data-skip title="跳过">${icon('check')}</button></div>`;
}

function paintBar(root, session, total) {
  const bars = root.querySelectorAll('.st-bar i');
  const results = session.results;
  const keys = listOf(session);
  bars.forEach((el, i) => {
    const k = keys[i];
    const r = k ? results[k] || {} : {};
    const done = session.step === 'spell' ? r.spellDone : r.quizDone;
    if (i === session.index) el.className = done ? 'done' : 'now';
    else if (done) el.className = 'done';
    else el.className = '';
  });
}

function bindChrome(root, session, ctx) {
  bindExit(root, session, ctx);
  const total = listOf(session).length;
  root.querySelector('[data-prev]')?.addEventListener('click', () => go(session, session.index - 1, ctx, root, total));
  root.querySelector('[data-next]')?.addEventListener('click', () => go(session, session.index + 1, ctx, root, total));
  root.querySelector('[data-group]')?.addEventListener('click', () => toast(`${session.kind === 'review' ? '本轮复习' : `第 ${(session.chapter || 0) + 1} 组`} · 共 ${total} 个词`));
  root.querySelector('[data-skip]').addEventListener('click', () => skipCurrent(root, session, ctx));
}

function go(session, idx, ctx, root, total) {
  if (idx < 0 || idx >= total) return;
  cancelLater();
  lock = false;
  spellLock = false;
  session.index = idx;
  session.feedback = null;
  save();
  renderCurrent(root, session, ctx);
}

function bindExit(root, session, ctx) {
  root.querySelectorAll('[data-exit]').forEach((b) =>
    b.addEventListener('click', async () => {
      cancelLater();
      const ok = await confirmDialog({
        title: '要退出本组学习吗？',
        body: '退出后本组未完成的进度不会保留，已答对的单词进度会保存。',
        okText: '退出',
        cancelText: '继续学习',
        danger: true,
      });
      if (!ok) return;
      endSession();
      ctx.go('home');
    }),
  );
}

function markSkipDone(root, session) {
  const r = (session.results[listOf(session)[session.index]] || {});
  const done = session.step === 'spell' ? r.spellDone : r.quizDone;
  root.querySelector('[data-skip]')?.classList.toggle('done', !!done);
}

// ---------- 流程 ----------
function advance(session, ctx, root) {
  cancelLater();
  const total = listOf(session).length;
  session.feedback = null;
  if (session.index + 1 >= total) {
    if (session.step !== 'spell') beginSpell(session, ctx, root);
    else finish(session, ctx, root);
    return;
  }
  session.index += 1;
  save();
  renderCurrent(root, session, ctx);
}

function beginSpell(session, ctx, root) {
  cancelLater();
  session.step = 'spell';
  session.index = 0;
  session.feedback = null;
  const queue = ensureSpellQueue(session);
  save(true);
  if (!queue.length) {
    finish(session, ctx, root);
    return;
  }
  renderSpell(root, session, ctx);
}

function skipCurrent(root, session, ctx) {
  cancelLater();
  const key = listOf(session)[session.index];
  if (!key) return;
  const res = session.results[key];
  const w = getWordObj(key);
  if (session.step === 'spell') {
    res.spellDone = true;
    res.spellSkipped = true;
    save();
    advance(session, ctx, root);
    return;
  }
  res.skipped = true;
  res.quizDone = true;
  res.quizFirstTry = null;
  // 原版跳过 = 认识，按已学处理
  const { rec } = ensureRecord(w, session.bookId);
  scheduleLearnedWord(rec, 1);
  save(true);
  later(180, () => advance(session, ctx, root));
}

function renderCurrent(root, session, ctx) {
  if (session.step === 'spell') renderSpell(root, session, ctx);
  else renderQuiz(root, session, ctx);
}

// ---------- 第一段：看图选义 ----------
function renderQuiz(root, session, ctx) {
  bankMode = false;
  lock = false;
  autoSpoken = '';
  const plan = ensurePlan(session)[session.index];
  const w = getWordObj(plan.w);
  const res = session.results[w.w];
  const mode = plan.mode;
  const fb = session.feedback;
  const options = plan.options.map((k) => getWordObj(k));
  const total = session.words.length;

  let stage = '';
  if (mode === 'word_pic') {
    stage = `<div class="quiz-visual">
      <div class="quiz-word" data-detail>${esc(w.w)}</div>
      <div class="quiz-phon">${phonText(w) ? `<span>${esc(phonText(w))}</span>` : ''}${sayBtn(w)}</div>
    </div>`;
  } else if (mode === 'cloze') {
    const re = new RegExp(`\\b${escapeReg(w.w)}\\b`, 'ig');
    const sentence = String(w.en || '').replace(re, '____');
    stage = `<div class="quiz-visual"><div class="cloze-sentence">${esc(sentence)}</div></div>`;
  } else {
    stage = `<div class="quiz-visual">
      <div class="quiz-art"><div class="quiz-art-in"><img alt="${esc(w.w)}" /></div></div>
      <div class="quiz-word" data-detail>${esc(w.w)}</div>
      <div class="quiz-phon">
        ${phonText(w) ? `<span>${esc(phonText(w))}</span>` : ''}
        ${sayBtn(w)}
      </div>
    </div>`;
  }

  const optHtml = options
    .map((o) => {
      let inner;
      if (mode === 'word_pic') inner = `<span class="oimg"><img alt="${esc(o.w)}" /></span>`;
      else inner = `<span class="otext">${esc(meaningText(o))}</span>`;
      let cls = 'option';
      let mark = '';
      if (mode === 'word_pic') cls += ' picopt';
      if (fb) {
        if (o.w === w.w) {
          cls += ' right';
          mark = `<span class="mark ok">${icon('check')}</span>`;
        } else if (o.w === fb.chosen) {
          cls += ' wrong';
          mark = `<span class="mark no">${icon('x')}</span>`;
        } else cls += ' dim';
      } else if (res.skipped || res.quizDone) {
        if (o.w === w.w) {
          cls += ' right';
          mark = `<span class="mark ok">${icon('check')}</span>`;
        } else cls += ' dim';
      }
      return `<button class="${cls}" data-opt="${esc(o.w)}">${inner}${mark}</button>`;
    })
    .join('');

  root.innerHTML = `<div class="study-screen">
    <div class="study-shell">
      ${headHtml(session, total)}
      <main class="st-body quiz-body">
        ${stage}
        <div class="quiz-options ${mode === 'word_pic' ? 'image-options' : ''}">${optHtml}</div>
      </main>
    </div>
  </div>`;

  paintBar(root, session, total);
  markSkipDone(root, session);
  bindChrome(root, session, ctx);

  const img = root.querySelector('.quiz-art img');
  if (img) attachImage(img, w);
  if (mode === 'word_pic') {
    root.querySelectorAll('.option .oimg img').forEach((im, i) => attachImage(im, options[i]));
  }

  root.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => openWordDetail(w)));
  root.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => speak(w.w, { accent: settings().accent, rate: 0.85 })));

  const optEls = [...root.querySelectorAll('.option')];
  const correctBtn = optEls.find((b) => b.dataset.opt === w.w);

  optEls.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (lock) return;
      const chosen = btn.dataset.opt;
      if (session.feedback) {
        // 答错后：点正确项才继续，不奖励连击、不进入拼写
        if (chosen !== w.w) return;
        lock = true;
        markAnswer(optEls, w.w, true, session.feedback.chosen);
        okSound();
        save();
        later(430, () => advance(session, ctx, root));
        return;
      }
      if (res.skipped || res.quizDone) return;
      if (chosen === w.w) {
        lock = true;
        answerCorrect(session, w, res);
        markAnswer(optEls, w.w, true);
        okSound();
        comboHit(session.combo);
        if (session.combo > 0) comboFx(session.combo);
        if (settings().readExample && w.en) setTimeout(() => speak(w.en, { accent: settings().accent, rate: 0.92 }), 300);
        save();
        later(700, () => advance(session, ctx, root));
      } else {
        res.quizFirstTry = false;
        res.quizMistakes = (res.quizMistakes || 0) + 1;
        session.combo = 0;
        session.feedback = { chosen };
        recordMistake(w, session.bookId);
        const d = dailyEntry();
        d.total = (d.total || 0) + 1;
        errSound();
        save(true);
        renderQuiz(root, session, ctx);
      }
    });
  });

  if (!fb && !res.quizDone && !res.skipped && settings().autoPronounce) {
    const tag = `${session.index}:${w.w}`;
    if (autoSpoken !== tag) {
      autoSpoken = tag;
      setTimeout(() => speak(w.w, { accent: settings().accent, rate: 0.87 }), 260);
    }
  }

  setKeyHandler((e) => {
    if (document.querySelector('.modal-backdrop.open')) return;
    if (session.step !== 'quiz' || state.data.session !== session) return;
    const k = e.key.toLowerCase();
    let idx = -1;
    if (/^[1-4]$/.test(k)) idx = Number(k) - 1;
    else if (/^[a-d]$/.test(k)) idx = k.charCodeAt(0) - 97;
    if (idx < 0 || !optEls[idx]) return;
    e.preventDefault();
    optEls[idx].click();
  });
}

function markAnswer(optEls, correct, good, chosen) {
  rootMark(optEls, correct, good, chosen);
}
function rootMark(optEls, correct, good, chosen) {
  for (const el of optEls) {
    const mark = el.querySelector('.mark');
    if (mark) mark.remove();
    if (el.dataset.opt === correct) {
      el.classList.remove('wrong', 'dim');
      el.classList.add('right');
      el.insertAdjacentHTML('beforeend', `<span class="mark ok">${icon('check')}</span>`);
    } else if (!good && el.dataset.opt === chosen) {
      el.classList.remove('right', 'dim');
      el.classList.add('wrong');
      el.insertAdjacentHTML('beforeend', `<span class="mark no">${icon('x')}</span>`);
    } else {
      el.classList.remove('right', 'wrong');
      el.classList.add('dim');
    }
  }
}

function answerCorrect(session, w, res) {
  const had = recordOf(w.w);
  const fresh = !had || ((had.stage || 0) === 0 && !had.isMastered && !(had.wrongCount > 0));
  if (session.kind === 'review' || !fresh) {
    ensureRecord(w, session.bookId);
    recordCorrectReview(recordOf(w.w));
  } else {
    ensureRecord(w, session.bookId);
    scheduleLearnedWord(recordOf(w.w), 1);
  }
  session.combo = (session.combo || 0) + 1;
  session.maxCombo = Math.max(session.maxCombo || 0, session.combo);
  const d = dailyEntry();
  d.total = (d.total || 0) + 1;
  d.correct = (d.correct || 0) + 1;
  res.quizFirstTry = true;
  res.quizDone = true;
  save();
}

// ---------- 第二段：看义拼写 ----------
function chunksOf(word) {
  const str = String(word);
  if (str.length <= 5) return [...str];
  const re = /[^aeiouy]*[aeiouy]+(?:[^aeiouy](?![aeiouy]))?/gi;
  const out = str.match(re) || [];
  const used = out.join('').length;
  if (used < str.length) out.push(str.slice(used));
  return out.filter(Boolean);
}

function renderSpell(root, session, ctx) {
  bankMode = false;
  lock = false;
  spellLock = false;
  const queue = ensureSpellQueue(session);
  const key = queue[session.index];
  const w = getWordObj(key);
  const res = session.results[key];
  const total = queue.length;
  const letters = lettersOf(w.w);
  res.spellInput = res.spellInput || '';

  const meta = `<div class="spell-meta">
      <div class="left">
        ${posText(w) ? `<span class="pos">${esc(posText(w))}</span><span class="dot">·</span>` : ''}
        ${phonText(w) ? `<span class="phon">${esc(phonText(w))}</span>` : ''}
        ${phonText(w) ? sayBtn(w) : ''}
      </div>
      <div class="spell-tools">
        <button class="pill" data-detail>详解</button>
        <button class="pill hint" data-hint>💡 提示</button>
      </div>
    </div>`;

  const slotsHtml = () => {
    let li = 0;
    return [...String(w.w)]
      .map((ch) => {
        if (/[a-z]/i.test(ch)) {
          const idx = li++;
          const v = res.spellInput[idx] || '';
          const isActive = idx === res.spellInput.length && !res.spellDone;
          let cls = 'st-slot';
          if (res.spellDone) cls += ' done';
          else if (v) cls += ' filled';
          if (isActive) cls += ' active';
          return `<span class="${cls}">${esc(v)}</span>`;
        }
        if (ch === ' ') return '<span class="st-slot sp space"></span>';
        return `<span class="st-slot sp">${esc(ch)}</span>`;
      })
      .join('');
  };

  root.innerHTML = `<div class="study-screen">
    <div class="study-shell">
      ${headHtml(session, total)}
      <main class="st-body spell-body">
        <div class="spell-block">
          <div class="spell-meaning">${esc(meaningText(w, 2))}</div>
          ${meta}
          <div class="st-slots" data-slots>${slotsHtml()}</div>
        </div>
      </main>
      <div class="st-kb" data-kb>
        ${kbRowsHtml()}
      </div>
    </div>
  </div>`;

  paintBar(root, session, total);
  markSkipDone(root, session);
  bindChrome(root, session, ctx);

  const slots = root.querySelector('[data-slots]');
  const kb = root.querySelector('[data-kb]');

  root.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => openWordDetail(w)));
  root.querySelectorAll('[data-say]').forEach((b) => b.addEventListener('click', () => speak(w.w, { accent: settings().accent, rate: 0.85 })));
  root.querySelector('[data-hint]').addEventListener('click', () => hint());

  const refreshSlots = () => {
    slots.innerHTML = slotsHtml();
  };

  function paint(mode, firstWrong) {
    const els = [...slots.querySelectorAll('.st-slot:not(.sp)')];
    els.forEach((el, i) => {
      el.classList.remove('ok', 'bad', 'done');
      if (mode === 'done') el.classList.add('done');
      else if (mode === 'ok') {
        if (i < firstWrong) el.classList.add('ok');
        else if (i === firstWrong) el.classList.add('bad');
      }
    });
  }

  function type(ch) {
    if (spellLock || res.spellDone) return;
    const i = res.spellInput.length;
    if (i >= letters.length) return;
    res.spellInput += ch;
    save();
    refreshSlots();
    if (res.spellInput.length === letters.length) later(70, check);
  }

  function back() {
    if (spellLock || res.spellDone) return;
    res.spellInput = res.spellInput.slice(0, -1);
    save();
    refreshSlots();
  }

  function hint() {
    if (spellLock || res.spellDone) return;
    const i = res.spellInput.length;
    if (i >= letters.length) return;
    res.spellInput += letters[i];
    save();
    refreshSlots();
    if (res.spellInput.length === letters.length) later(70, check);
  }

  function check() {
    if (lock || res.spellDone) return;
    if (res.spellInput.length < letters.length) return;
    const answer = letters.join('');
    let firstWrong = -1;
    for (let i = 0; i < letters.length; i++) {
      if (res.spellInput[i] !== letters[i]) {
        firstWrong = i;
        break;
      }
    }
    if (firstWrong === -1) {
      lock = true;
      spellLock = true;
      paint('done');
      res.spellDone = true;
      res.spellInput = answer;
      res.spellMistakes = res.spellMistakes || 0;
      // 首答错的词：拼写正确后提升一档；首答对的词已在选义时记录
      if (res.quizFirstTry === false) {
        const rec = recordOf(w.w);
        if (rec) advanceAfterStep1MistakeRecovery(rec);
      }
      session.combo = (session.combo || 0) + 1;
      session.maxCombo = Math.max(session.maxCombo || 0, session.combo);
      const d = dailyEntry();
      d.correct = (d.correct || 0) + 1;
      save(true);
      okSound();
      comboHit(session.combo);
      if (session.combo > 0) comboFx(session.combo);
      later(650, () => advance(session, ctx, root));
      return;
    }

    res.spellMistakes = (res.spellMistakes || 0) + 1;
    session.combo = 0;
    errSound();
    paint('ok', firstWrong);
    slots.classList.remove('shake');
    void slots.offsetWidth;
    slots.classList.add('shake');
    spellLock = true;
    save();
    later(650, () => {
      res.spellInput = res.spellInput.slice(0, firstWrong);
      spellLock = false;
      save();
      refreshSlots();
      slots.classList.remove('shake');
    });
  }

  function renderKeyboard() {
    kb.innerHTML = bankMode ? bankHtml(w) : kbRowsHtml();
    bindKeys();
    if (bankMode) {
      kb.querySelectorAll('[data-chunk]').forEach((b) =>
        b.addEventListener('click', () => {
          if (spellLock || res.spellDone) return;
          const chunk = b.dataset.chunk;
          for (const ch of chunk) {
            if (res.spellInput.length >= letters.length) break;
            res.spellInput += ch;
          }
          save();
          refreshSlots();
          b.classList.add('used');
          if (res.spellInput.length === letters.length) later(70, check);
        }),
      );
    }
  }

  function bindKeys() {
    kb.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => type(b.dataset.key)));
    kb.querySelectorAll('[data-fn]').forEach((b) =>
      b.addEventListener('click', () => {
        const fn = b.dataset.fn;
        if (fn === 'back') back();
        else if (fn === 'bank') {
          bankMode = !bankMode;
          renderKeyboard();
        } else if (fn === 'kb') {
          bankMode = false;
          renderKeyboard();
        }
      }),
    );
  }

  bindKeys();

  setKeyHandler((e) => {
    if (document.querySelector('.modal-backdrop.open')) return;
    if (state.data.session !== session || session.step !== 'spell') return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-z]$/i.test(e.key)) {
      e.preventDefault();
      type(e.key.toLowerCase());
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      back();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      check();
    }
  });
}

function kbRowsHtml() {
  const rows = ['qwertyuiop', 'asdfghjkl'];
  const row3 = 'zxcvbnm';
  return `<div class="kb-row">${[...rows[0]].map((c) => `<button class="kb-key" data-key="${c}">${c}</button>`).join('')}</div>
    <div class="kb-row">${[...rows[1]].map((c) => `<button class="kb-key" data-key="${c}">${c}</button>`).join('')}</div>
    <div class="kb-row">
      <button class="kb-key wide" data-fn="bank">连词</button>
      ${[...row3].map((c) => `<button class="kb-key" data-key="${c}">${c}</button>`).join('')}
      <button class="kb-key wide back" data-fn="back">${icon('back')}</button>
    </div>`;
}

function bankHtml(w) {
  const chunks = chunksOf(w.w);
  const shuffle = chunks
    .map((c, i) => ({ c, i }))
    .sort(() => Math.random() - 0.5);
  const bubbles = shuffle
    .map(({ c }) => {
      const dy = (Math.random() * 34 - 17).toFixed(0);
      return `<button class="chunk" data-chunk="${esc(c)}" style="--dy:${dy}px">${esc(c)}</button>`;
    })
    .join('');
  return `<div class="kb-bank">${bubbles}</div>
    <div class="kb-row kb-bankrow">
      <button class="kb-key wide" data-fn="kb">键盘</button>
      <span class="kb-gap"></span>
      <button class="kb-key wide back" data-fn="back">${icon('back')}</button>
    </div>`;
}

// ---------- 完成 ----------
function finish(session, ctx, root) {
  cancelLater();
  if (session.finished) {
    ctx.go('summary');
    return;
  }
  session.finished = true;
  session.phase = 'summary';
  session.endedAt = Date.now();
  session.elapsed = Math.max(1, Math.round((session.endedAt - session.startedAt) / 1000));

  const d = dailyEntry();
  if (!Array.isArray(d.newWords)) d.newWords = [];
  if (!Array.isArray(d.reviewed)) d.reviewed = [];
  let newW = 0;
  let revW = 0;
  for (const key of session.words) {
    const res = session.results[key];
    if (!res || res.skipped) continue;
    if (res.newWord) {
      newW++;
      if (!d.newWords.includes(key)) d.newWords.push(key);
    } else {
      revW++;
      if (!d.reviewed.includes(key)) d.reviewed.push(key);
    }
  }
  d.newW = (d.newW || 0) + newW;
  d.revW = (d.revW || 0) + revW;
  d.n = (d.newW || 0) + (d.revW || 0);
  d.seconds = (d.seconds || 0) + session.elapsed;

  const answered = session.words.filter((k) => session.results[k] && !session.results[k].skipped);
  const firstTry = answered.filter((k) => session.results[k].quizFirstTry !== false);
  const accuracy = answered.length ? Math.round((firstTry.length / answered.length) * 100) : 0;
  const count = 1 + (accuracy >= 90 ? 1 : 0);
  const stickers = awardStickers(count);

  session.summary = {
    newW,
    revW,
    total: answered.length,
    correct: firstTry.length,
    accuracy,
    seconds: session.elapsed,
    maxCombo: session.maxCombo || 0,
    stickers,
    at: Date.now(),
    words: session.words.filter((k) => session.results[k] && !session.results[k].skipped),
  };

  punchToday();
  if (session.kind === 'learn' && session.chapter != null) {
    markGroupCompleted(session.bookId, session.chapter);
  }
  const log = state.data.groupLog || (state.data.groupLog = {});
  const day = dayKey();
  (log[day] || (log[day] = [])).push({ ...session.summary, kind: session.kind });
  save(true);
  ctx.go('summary');
}

export function renderStudy(root, params, ctx) {
  const session = activeSession();
  if (!session || !session.words || !session.words.length) {
    ctx.go('home');
    return;
  }
  if (session.phase === 'summary') {
    ctx.go('summary');
    return;
  }
  ensurePlan(session);
  ensureSpellQueue(session);
  if (session.step === 'spell') renderSpell(root, session, ctx);
  else renderQuiz(root, session, ctx);
}
