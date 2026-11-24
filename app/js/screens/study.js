// 学习与复习：看词/看图/语境/拼写、连击动效、错题补救

import { esc, h, sample, coreMeaning, escapeReg, dayKey } from '../util.js';
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
import { getWordObj, bookById, bookWords, attachImage, imageUrl } from '../data.js';
import { speak } from '../speech.js';
import { comboHit, success as okSound, error as errSound } from '../sfx.js';
import { openWordDetail } from './detail.js';
import { awardStickers } from './stickers.js';

let lock = false;
let spellLock = false;
let keyHandler = null;
let autoSpoken = '';

function setKeyHandler(fn) {
  if (keyHandler) document.removeEventListener('keydown', keyHandler);
  keyHandler = fn;
  if (fn) document.addEventListener('keydown', fn);
}

function lettersOf(word) {
  return [...String(word)].filter((c) => /[a-z]/i.test(c)).map((c) => c.toLowerCase());
}

function meaningText(w) {
  return coreMeaning(w.t || '').replace(/\s+/g, ' ').trim();
}

function poolFor(bookId, correct) {
  const book = bookById(bookId);
  if (!book) return [correct];
  const all = bookWords(book);
  const nearby = all.filter((w) => w && w.w !== correct.w && w.t);
  return sample(nearby, 60);
}

function pickMode(w) {
  const setting = settings().step1 || 'pic_meaning';
  const canCloze = !!(w.en && new RegExp(`\\b${escapeReg(w.w)}\\b`, 'i').test(w.en));
  const canPic = !!(w.img || imageUrl(w));
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

function planFor(session) {
  return session.plan[session.index];
}

function comboFx(n) {
  const burst = h(`<div class="celebrate"><div class="burst">
    <div class="nice">NICE!</div>
    <div class="hits">${n} 连击</div>
    ${Array.from({ length: 7 }, () => {
      const dx = (Math.random() * 220 - 110).toFixed(0);
      const dy = (Math.random() * -170 - 30).toFixed(0);
      return `<span class="star" style="left:50%;top:45%;--dx:${dx}px;--dy:${dy}px">✦</span>`;
    }).join('')}
  </div></div>`);
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 1300);
}

function segbar(session) {
  return `<div class="segbar">${session.words
    .map((key, i) => {
      const r = session.results[key];
      if (i === session.index && !r.done) return '<i class="now"></i>';
      if (r.quizFirstTry === false && r.done) return '<i class="bad"></i>';
      if (r.done) return '<i class="done"></i>';
      return '<i></i>';
    })
    .join('')}</div>`;
}

function headHtml(session, extra = '') {
  const label = session.kind === 'review' ? '复习' : `第 ${(session.chapter || 0) + 1} 关`;
  return `<div class="study-head">
    <div class="sh-left"><button class="iconbtn" data-exit>${icon('x')}</button></div>
    <div class="sh-center">
      <span class="group-btn">${label}</span>
      <span class="nav">
        <button disabled>${icon('chevL')}</button>
        <span class="count">${Math.min(session.index + 1, session.words.length)} / ${session.words.length}</span>
        <button disabled>${icon('chevR')}</button>
      </span>
    </div>
    <div class="sh-right">${extra}</div>
  </div>`;
}

function bindExit(root, session, ctx) {
  root.querySelectorAll('[data-exit]').forEach((b) =>
    b.addEventListener('click', async () => {
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

// ---------- 选择答案 ----------
function renderQuiz(root, session, ctx) {
  lock = false;
  const plan = planFor(session);
  const w = getWordObj(plan.w);
  const res = session.results[w.w];
  const mode = plan.mode;
  const fb = session.feedback;
  const options = plan.options.map((k) => getWordObj(k));

  let stage = '';
  if (mode === 'pic_meaning') {
    stage = `<div class="quiz-img"><img alt="${esc(w.w)}" /></div>
      <div class="quiz-actions">
        <button class="pill" data-hint>提示</button>
        <button class="pill" data-detail>详解</button>
      </div>`;
  } else if (mode === 'word_pic') {
    stage = `<div class="quiz-word" data-detail>${esc(w.w)}</div>
      <div class="quiz-phon">${w.us ? `<button data-say="us">${icon('speaker')}<span>${esc(w.us)}</span></button>` : ''}
        ${w.uk ? `<button data-say="uk">${icon('speaker')}<span>${esc(w.uk)}</span></button>` : ''}</div>
      <div class="quiz-actions">
        <button class="pill" data-hint>提示</button>
        <button class="pill" data-detail>详解</button>
      </div>`;
  } else {
    const re = new RegExp(`\\b${escapeReg(w.w)}\\b`, 'ig');
    const sentence = String(w.en || '').replace(re, '____');
    stage = `<div class="cloze-sentence">${esc(sentence)}<span class="hint">选出最合适的单词填入空格</span></div>
      <div class="quiz-actions">
        <button class="pill" data-hint>提示</button>
        <button class="pill" data-detail>详解</button>
      </div>`;
  }

  const optHtml = options
    .map((o, i) => {
      let inner = '';
      if (mode === 'pic_meaning') {
        inner = `<span>${esc(meaningText(o).slice(0, 26))}</span>`;
      } else if (mode === 'word_pic') {
        inner = `<span class="oimg"><img alt="${esc(o.w)}" /></span>`;
      } else {
        inner = `<span>${esc(o.w)}</span>`;
      }
      const label = 'ABCD'[i];
      let cls = 'option';
      let mark = '';
      if (fb) {
        if (o.w === w.w) {
          cls += ' right';
          mark = `<span class="mark ok">${icon('check')}</span>`;
        } else if (o.w === fb.chosen) {
          cls += ' wrong';
          mark = `<span class="mark no">${icon('x')}</span>`;
        } else cls += ' dim';
      }
      return `<button class="${cls}" data-opt="${esc(o.w)}"><span class="opt-label">${label}</span>${inner}${mark}</button>`;
    })
    .join('');

  root.innerHTML = `<div class="study-screen">
    ${headHtml(session, `<button class="skip" data-skip title="跳过">${icon('chevR')}</button>`)}
    ${segbar(session)}
    <div class="study-body">
      ${stage}
      ${fb ? `<div class="spell-msg" style="color:var(--danger);min-height:16px;margin:14px 0 -10px">没关系，再点一下正确答案，然后拼写一遍加深记忆</div>` : ''}
      <div class="options ${mode === 'word_pic' ? 'image-options' : ''}">${optHtml}</div>
    </div>
  </div>`;

  const img = root.querySelector('.quiz-img img');
  if (img) attachImage(img, w);
  if (mode === 'word_pic') {
    root.querySelectorAll('.option .oimg img').forEach((im, i) => attachImage(im, options[i]));
  }
  bindExit(root, session, ctx);

  root.querySelectorAll('[data-detail]').forEach((b) => b.addEventListener('click', () => openWordDetail(w)));
  root.querySelectorAll('[data-say]').forEach((b) =>
    b.addEventListener('click', () => speak(w.w, { accent: b.dataset.say, rate: 0.87 })),
  );

  const optEls = [...root.querySelectorAll('.option')];
  const correctBtn = optEls.find((b) => b.dataset.opt === w.w);

  root.querySelector('[data-hint]').addEventListener('click', () => {
    const wrong = optEls.filter((b) => b.dataset.opt !== w.w && !b.classList.contains('dim') && !b.disabled);
    if (wrong.length <= 1) {
      toast('已经很接近了');
      return;
    }
    const kill = wrong[Math.floor(Math.random() * wrong.length)];
    kill.classList.add('dim');
    kill.disabled = true;
    session.hintsUsed = (session.hintsUsed || 0) + 1;
    save();
  });

  root.querySelector('[data-skip]').addEventListener('click', () => {
    if (lock) return;
    lock = true;
    res.skipped = true;
    res.quizFirstTry = false;
    res.done = true;
    toast('已跳过，本词不计入连击');
    advance(root, session, ctx);
  });

  optEls.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const chosen = btn.dataset.opt;
      if (session.feedback) {
        if (chosen !== w.w) return;
        startSpell(root, session, ctx);
        return;
      }
      if (lock) return;
      if (chosen === w.w) {
        lock = true;
        res.quizFirstTry = true;
        answerCorrect(session, w, res);
        markAnswer(root, optEls, w.w, true);
        okSound();
        comboHit(session.combo);
        if (session.combo > 0 && session.combo % 5 === 0) comboFx(session.combo);
        if (settings().readExample && w.en) setTimeout(() => speak(w.en, { accent: settings().accent, rate: 0.92 }), 320);
        setTimeout(() => {
          // 听写模式：答对后也要亲手拼一遍
          if (settings().dictationAuto) startSpell(root, session, ctx);
          else advance(root, session, ctx);
        }, 680);
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
        // 重绘并保留红色反馈；此时必须点击正确项，随后进入拼写补救
        renderQuiz(root, session, ctx);
        return;
      }
      save();
    });
  });

  // 键盘：1-4 / a-d 选项
  setKeyHandler((e) => {
    if (e.key === 'Escape') return;
    if (document.querySelector('.modal-backdrop.open')) return;
    const k = e.key.toLowerCase();
    let idx = -1;
    if (/^[1-4]$/.test(k)) idx = Number(k) - 1;
    else if (/^[a-d]$/.test(k)) idx = k.charCodeAt(0) - 97;
    if (idx < 0 || !optEls[idx]) return;
    e.preventDefault();
    optEls[idx].click();
  });

  if (settings().autoPronounce && !session.feedback) {
    const tag = session.index + ':' + w.w;
    if (autoSpoken !== tag) {
      autoSpoken = tag;
      setTimeout(() => speak(w.w, { accent: settings().accent, rate: 0.87 }), 260);
    }
  }
}

function markAnswer(root, optEls, correct, good, chosen) {
  for (const el of optEls) {
    if (el.dataset.opt === correct) {
      el.classList.add('right');
      el.insertAdjacentHTML('beforeend', `<span class="mark ok">${icon('check')}</span>`);
    } else if (!good && el.dataset.opt === chosen) {
      el.classList.add('wrong');
      el.insertAdjacentHTML('beforeend', `<span class="mark no">${icon('x')}</span>`);
    } else {
      el.classList.add('dim');
    }
    el.disabled = true;
  }
  if (!good) root.querySelector('.mark.ok')?.closest('.option')?.removeAttribute('disabled');
  const cd = root.querySelector('.mark.ok')?.closest('.option');
  if (cd) cd.disabled = false;
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
  save();
}

function advance(root, session, ctx) {
  const current = session.words[session.index];
  if (current && session.results[current]) session.results[current].done = true;
  session.index += 1;
  session.feedback = null;
  session.step = 'quiz';
  session.spellInput = '';
  session.feedback = null;
  save();
  if (session.index >= session.words.length) {
    finish(session, ctx, root);
    return;
  }
  renderQuiz(root, session, ctx);
}

function startSpell(root, session, ctx) {
  session.step = 'spell';
  session.feedback = null;
  session.spellInput = '';
  session.spellMistakes = 0;
  save();
  renderSpell(root, session, ctx);
}

// ---------- 拼写 ----------
function renderSpell(root, session, ctx) {
  lock = false;
  spellLock = false;
  const w = getWordObj(session.words[session.index]);
  const res = session.results[w.w];
  const letters = lettersOf(w.w);
  session.spellInput = session.spellInput || '';

  const slotsHtml = (input) => {
    let li = 0;
    return [...String(w.w)]
      .map((ch) => {
        if (/[a-z]/i.test(ch)) {
          const v = input[li++] || '';
          return `<span class="slot ${li - 1 === input.length ? 'active' : ''}">${esc(v)}</span>`;
        }
        if (ch === ' ') return '<span class="slot space"></span>';
        return `<span class="slot hyphen">${esc(ch)}</span>`;
      })
      .join('');
  };

  root.innerHTML = `<div class="study-screen">
    ${headHtml(session)}
    ${segbar(session)}
    <div class="spell-wrap">
      <div class="spell-head">
        <div>
          <div class="spell-meaning">${esc(coreMeaning(w.t || ''))}</div>
          <div class="spell-sub">${w.p ? `<span class="pos">${esc(w.p)}.</span>` : ''}<span>${letters.length} 个字母 · 拼出这个单词</span></div>
        </div>
        <div class="spell-tools">
          <button class="pill hint" data-hint>${icon('lamp')}提示</button>
          <button class="pill" data-detail>详解</button>
        </div>
      </div>
      <div class="slots" data-slots>${slotsHtml(session.spellInput)}</div>
      <div class="spell-msg" data-msg></div>
      <div class="keyboard">
        ${['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
          .map(
            (row, ri) => `<div class="krow">
            ${ri === 2 ? `<button class="key wide" data-fn="hint">提示</button>` : ''}
            ${[...row].map((c) => `<button class="key" data-key="${c}">${c}</button>`).join('')}
            ${ri === 2 ? `<button class="key back" data-fn="back">${icon('back')}</button>` : ''}
          </div>`,
          )
          .join('')}
        <div class="krow"><button class="key wide" data-fn="clear">清空</button><button class="key wide" data-fn="check">检查</button></div>
      </div>
    </div>
  </div>`;

  bindExit(root, session, ctx);
  const slots = root.querySelector('[data-slots]');
  const msg = root.querySelector('[data-msg]');

  const refresh = () => {
    slots.innerHTML = slotsHtml(session.spellInput);
    save();
  };

  function type(ch) {
    if (spellLock) return;
    if (session.spellInput.length >= letters.length) return;
    session.spellInput += ch;
    refresh();
    if (session.spellInput.length === letters.length) setTimeout(check, 80);
  }
  function back() {
    if (spellLock) return;
    session.spellInput = session.spellInput.slice(0, -1);
    refresh();
    msg.textContent = '';
  }
  function hint() {
    if (spellLock) return;
    const i = session.spellInput.length;
    if (i >= letters.length) return;
    session.spellInput += letters[i];
    refresh();
    if (session.spellInput.length === letters.length) setTimeout(check, 80);
  }
  function clearAll() {
    if (spellLock) return;
    session.spellInput = '';
    refresh();
  }

  function check() {
    if (lock) return;
    if (session.spellInput.length < letters.length) {
      msg.textContent = '还差几个字母';
      return;
    }
    const answer = letters.join('');
    if (session.spellInput === answer) {
      lock = true;
      res.spellMistakes = session.spellMistakes || 0;
      slots.querySelectorAll('.slot').forEach((s) => s.classList.add('on'));
      slots.style.transition = 'none';
      slots.querySelectorAll('.slot').forEach((s) => (s.style.color = 'var(--accent-strong)'));
      okSound();
      const rec = recordOf(w.w);
      // 只有「答错后的补救拼写」才调整复习阶段；听写模式答对不改变节奏
      if (rec && res.quizFirstTry === false) advanceAfterStep1MistakeRecovery(rec);
      msg.style.color = 'var(--accent-strong)';
      msg.textContent = '拼写正确，记住了！';
      setTimeout(() => advance(root, session, ctx), 520);
    } else {
      session.spellMistakes = (session.spellMistakes || 0) + 1;
      res.spellMistakes = session.spellMistakes;
      session.combo = 0;
      errSound();
      msg.style.color = 'var(--danger)';
      msg.textContent = '拼写有误，再试一次';
      slots.classList.remove('shake');
      void slots.offsetWidth;
      spellLock = true;
      slots.classList.add('shake');
      setTimeout(() => {
        spellLock = false;
        session.spellInput = '';
        refresh();
      }, 380);
      save();
    }
  }

  root.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => type(b.dataset.key)));
  root.querySelectorAll('[data-fn]').forEach((b) =>
    b.addEventListener('click', () => {
      const fn = b.dataset.fn;
      if (fn === 'back') back();
      else if (fn === 'hint') hint();
      else if (fn === 'clear') clearAll();
      else if (fn === 'check') check();
    }),
  );
  root.querySelector('[data-hint]').addEventListener('click', hint);
  root.querySelector('[data-detail]').addEventListener('click', () => openWordDetail(w));

  setKeyHandler((e) => {
    if (state.data.session !== session || session.step !== 'spell') return;
    if (document.querySelector('.modal-backdrop.open')) return;
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

// ---------- 完成 ----------
function finish(session, ctx, root) {
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
  // 记录一次「组」的日志，供统计与总结使用
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
  if (session.step === 'spell') renderSpell(root, session, ctx);
  else renderQuiz(root, session, ctx);
}
