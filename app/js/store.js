// 状态、艾宾浩斯算法、会话与统计

import { dayKey, endOfToday, reviewAt, startOfToday, addDaysKey, seededShuffle, todayWeek, coreMeaning } from './util.js';
import { bookById, bookWords, data, getWordObj } from './data.js';
import { idbGet, idbSet } from './db.js';

const LEGACY_KEY = 'bwt_state_v2';
const CONFIG_KEY = 'bwt_config_v2';
const DATA_KEY = 'bwt_data_v2';
const CONFIG_FIELDS = ['version', 'settings', 'bookId', 'lastTab', 'maskColor', 'maskView', 'seenIntro'];
const DATA_FIELDS = ['records', 'daily', 'completedGroups', 'currentGroup', 'seeds', 'groupLog', 'streak', 'stickers', 'session'];
let idbEnabled = true;

function defaultState() {
  return {
    version: 2,
    settings: {
      batchSize: 5,
      dailyGroups: 2,
      order: 'shuffle',
      step1: 'pic_meaning',
      accent: 'us',
      autoPronounce: false,
      dictationAuto: false,
      readExample: false,
      sfx: true,
      comboFx: true,
      dark: false,
      haptics: true,
    },
    bookId: 'cet4',
    records: {},
    daily: {},
    completedGroups: {},
    currentGroup: {},
    seeds: {},
    stickers: { unlocked: [], starred: [] },
    streak: { days: [] },
    lastTab: 'home',
    session: null,
    maskColor: '烟雨灰',
    maskView: { color: '烟雨灰', x: null, y: null, visible: true },
    seenIntro: false,
    groupLog: {},
  };
}

export const state = {
  data: defaultState(),
  saveTimer: null,
  listeners: new Set(),
};

function applyState(parsed) {
  state.data = Object.assign(defaultState(), parsed);
  state.data.settings = Object.assign(defaultState().settings, parsed.settings || {});
  state.data.stickers = Object.assign({ unlocked: [], starred: [] }, parsed.stickers || {});
  state.data.streak = Object.assign({ days: [] }, parsed.streak || {});
  state.data.maskView = Object.assign(defaultState().maskView, parsed.maskView || {});
  delete state.data.savedAt;
}

function applyData(stored) {
  if (!stored) return;
  for (const k of DATA_FIELDS) {
    if (stored[k] !== undefined) state.data[k] = stored[k];
  }
  state.data.stickers = Object.assign({ unlocked: [], starred: [] }, state.data.stickers || {});
  state.data.streak = Object.assign({ days: [] }, state.data.streak || {});
}

function configSnapshot(stamp) {
  const out = { savedAt: stamp };
  for (const k of CONFIG_FIELDS) out[k] = state.data[k];
  return out;
}

function dataSnapshot(stamp) {
  const out = { savedAt: stamp };
  for (const k of DATA_FIELDS) out[k] = state.data[k];
  return out;
}

async function persist(stamp = Date.now()) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(configSnapshot(stamp)));
  await idbSet(DATA_KEY, dataSnapshot(stamp));
}

export async function initStore() {
  let cfg = null;
  let legacy = null;
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) cfg = JSON.parse(raw);
  } catch (e) {
    console.warn('配置读取失败', e);
  }
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (raw) legacy = JSON.parse(raw);
  } catch (e) {
    console.warn('旧状态读取失败', e);
  }
  let stored = null;
  try {
    stored = await idbGet(DATA_KEY);
  } catch (e) {
    console.warn('IndexedDB 不可用，回退到 localStorage', e);
    idbEnabled = false;
  }

  const cfgTime = cfg && cfg.version === 2 ? cfg.savedAt || 0 : 0;
  const dataTime = stored ? stored.savedAt || 0 : 0;
  const legTime = legacy && legacy.version === 2 ? legacy.savedAt || 0 : 0;
  const useLegacy =
    !!legacy &&
    legacy.version === 2 &&
    ((!cfg && !stored) || legTime > dataTime || (!stored && legTime >= cfgTime));

  if (useLegacy) {
    applyState(legacy);
  } else {
    if (cfg && cfg.version === 2) applyState(cfg);
    if (stored) applyData(stored);
  }

  if (useLegacy && idbEnabled) {
    try {
      await persist();
      localStorage.removeItem(LEGACY_KEY);
    } catch (e) {
      console.warn('旧数据迁移失败，继续使用 localStorage', e);
      idbEnabled = false;
    }
  }
  if (!idbEnabled && !localStorage.getItem(LEGACY_KEY)) {
    try {
      localStorage.setItem(LEGACY_KEY, JSON.stringify(state.data));
    } catch {}
  }
  // 词书合法性要等词库加载后再校验（见 main.js）；此处 bookById 还没有数据
}

export function save(immediate = false) {
  clearTimeout(state.saveTimer);
  const doSave = () => {
    const stamp = Date.now();
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(configSnapshot(stamp)));
    } catch (e) {
      console.warn('配置保存失败', e);
    }
    if (!idbEnabled) {
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify(state.data));
      } catch (e) {
        console.warn('保存失败', e);
      }
      return;
    }
    idbSet(DATA_KEY, dataSnapshot(stamp)).catch((e) => {
      console.warn('IndexedDB 保存失败，回退到 localStorage', e);
      idbEnabled = false;
      try {
        localStorage.setItem(LEGACY_KEY, JSON.stringify(state.data));
      } catch (err) {
        console.warn('回退保存失败', err);
      }
    });
  };
  if (immediate) doSave();
  else state.saveTimer = setTimeout(doSave, 250);
}

export function subscribe(fn) {
  state.listeners.add(fn);
  return () => state.listeners.delete(fn);
}
export function emit() {
  for (const fn of state.listeners) fn();
}

export function settings() {
  return state.data.settings;
}

export function setSetting(key, value) {
  state.data.settings[key] = value;
  save();
  emit();
}

export function today() {
  return dayKey();
}

export function dailyEntry(day = today()) {
  const d = state.data.daily;
  if (!d[day]) d[day] = { n: 0, newW: 0, revW: 0, correct: 0, total: 0, seconds: 0, newWords: [], reviewed: [] };
  return d[day];
}

// ---------- 单词记录 ----------
export function recordOf(word) {
  return state.data.records[word] || null;
}

export function allRecords() {
  return Object.values(state.data.records).filter(Boolean);
}

export function bookRecords(bookId = state.data.bookId) {
  return allRecords().filter((r) => r.bookId === bookId);
}

export function ensureRecord(w, bookId = state.data.bookId) {
  const key = w.w;
  if (state.data.records[key]) return { rec: state.data.records[key], created: false };
  const rec = {
    wordId: w.id || key,
    word: key,
    translation: w.t || '',
    phonetic: w.us || w.uk || '',
    image: w.img || w.s || key,
    audio: w.aud || w.img || w.s || key,
    partOfSpeech: w.p || '',
    exampleEn: w.en || '',
    exampleCn: w.cn || '',
    bookId,
    isFavorite: false,
    wrongCount: 0,
    firstAddedAt: Date.now(),
    lastReviewedAt: Date.now(),
    stage: 0,
    nextReviewAt: Date.now(),
    isMastered: false,
  };
  state.data.records[key] = rec;
  return { rec, created: true };
}

// 原版 recordCorrectReview
export function recordCorrectReview(rec) {
  const stage = Math.min(3, (rec.stage || 0) + 1);
  let mastered = false;
  let next;
  if (stage >= 3) {
    mastered = true;
    next = reviewAt(30);
  } else if (stage === 2) {
    next = reviewAt(7);
  } else {
    next = reviewAt(1);
  }
  rec.stage = stage;
  rec.lastReviewedAt = Date.now();
  rec.nextReviewAt = next;
  rec.isMastered = mastered;
  save();
}

export function recordMistake(w, bookId = state.data.bookId) {
  const { rec, created } = ensureRecord(w, bookId);
  rec.wrongCount = (rec.wrongCount || 0) + 1;
  rec.stage = 0;
  rec.nextReviewAt = rec.lastReviewedAt || Date.now();
  rec.isMastered = false;
  rec.lastReviewedAt = Date.now();
  if (created) rec.firstAddedAt = Date.now();
  save();
  return { rec, created };
}

export function advanceAfterStep1MistakeRecovery(rec) {
  rec.stage = Math.max(1, rec.stage || 0);
  rec.isMastered = false;
  rec.nextReviewAt = reviewAt(1);
  rec.lastReviewedAt = Date.now();
  save();
}

export function scheduleLearnedWord(rec, n = 1) {
  if (rec.wrongCount > 0 || (rec.stage || 0) >= n) return;
  rec.stage = n;
  rec.isMastered = n >= 3;
  rec.nextReviewAt = reviewAt(n >= 3 ? 30 : n >= 2 ? 7 : 1);
  rec.lastReviewedAt = Date.now();
  save();
}

export function graduateWord(rec) {
  rec.stage = 3;
  rec.isMastered = true;
  rec.nextReviewAt = reviewAt(30);
  rec.lastReviewedAt = Date.now();
  save();
}

export function resetWordStage(rec) {
  rec.stage = 0;
  rec.isMastered = false;
  rec.nextReviewAt = rec.lastReviewedAt || Date.now();
  save();
}

export function toggleFavorite(word) {
  const { rec } = ensureRecord(getWordObj(word));
  rec.isFavorite = !rec.isFavorite;
  rec.favUpdatedAt = Date.now();
  const star = state.data.stickers.starred;
  const i = star.indexOf(rec.word);
  if (rec.isFavorite && i < 0) star.push(rec.word);
  if (!rec.isFavorite && i >= 0) star.splice(i, 1);
  // 原版：无任何学习痕迹且取消收藏时删除记录
  if (!rec.isFavorite && (rec.wrongCount || 0) === 0 && (rec.stage || 0) === 0 && !rec.isMastered) {
    delete state.data.records[rec.word];
    if (state.data.session && state.data.session.kind === 'favorite') {
      // 当前会话继续保留词表
    }
  }
  save();
  emit();
  return rec.isFavorite;
}

// ---------- 查询 ----------
export function dueRecords(bookId = state.data.bookId) {
  const end = endOfToday();
  return bookRecords(bookId).filter((r) => !r.isMastered && ((r.wrongCount || 0) > 0 || (r.stage || 0) > 0) && r.nextReviewAt <= end);
}

export function wrongRecords(bookId = state.data.bookId) {
  return bookRecords(bookId).filter((r) => (r.wrongCount || 0) > 0 && !r.isMastered);
}

export function favoriteRecords() {
  return allRecords().filter((r) => r.isFavorite);
}

export function learnedCount(bookId = state.data.bookId) {
  return bookRecords(bookId).filter((r) => r.stage > 0 || r.isMastered || r.wrongCount > 0).length;
}

export function masteredCount(bookId = state.data.bookId) {
  return bookRecords(bookId).filter((r) => r.isMastered).length;
}

export function todayNewCount() {
  const d = state.data.daily[today()];
  return d && Array.isArray(d.newWords) ? d.newWords.length : 0;
}

export function todayReviewedCount() {
  const d = state.data.daily[today()];
  return d && Array.isArray(d.reviewed) ? d.reviewed.length : 0;
}

export function newGoal() {
  return settings().dailyGroups * settings().batchSize;
}

// ---------- 词书分组 ----------
export function seedFor(bookId) {
  if (!state.data.seeds[bookId]) {
    state.data.seeds[bookId] = 202704 + Array.from(bookId).reduce((a, c) => a + c.charCodeAt(0), 0) * 17;
  }
  return state.data.seeds[bookId];
}

export function orderedChapter(bookId, idx) {
  const book = bookById(bookId);
  const words = bookWords(book);
  const size = settings().batchSize;
  let list = words.slice(idx * size, idx * size + size);
  if (settings().order === 'shuffle') list = seededShuffle(list, seedFor(bookId) + idx * 31);
  else list.sort((a, b) => a.w.localeCompare(b.w));
  return list;
}

export function chapterOfWord(bookId, word) {
  const book = bookById(bookId);
  if (!book) return 0;
  // 词在词表中的位置
  const words = bookWords(book);
  const pos = words.findIndex((w) => w.w === word);
  return pos < 0 ? 0 : Math.floor(pos / settings().batchSize);
}

export function totalChapters(bookId) {
  const book = bookById(bookId);
  if (!book) return 1;
  return Math.max(1, Math.ceil(book.totalWords / settings().batchSize));
}

export function completedGroups(bookId = state.data.bookId) {
  return state.data.completedGroups[bookId] || [];
}

export function markGroupCompleted(bookId, idx) {
  const arr = state.data.completedGroups[bookId] || (state.data.completedGroups[bookId] = []);
  if (!arr.includes(idx)) arr.push(idx);
  state.data.currentGroup[bookId] = Math.max(state.data.currentGroup[bookId] || 0, idx + 1);
  save();
}

export function currentGroupIndex(bookId = state.data.bookId) {
  const c = state.data.currentGroup[bookId];
  if (typeof c === 'number') return c;
  const comp = completedGroups(bookId);
  return comp.length ? Math.max(...comp) + 1 : 0;
}

export function nextStudyWords(bookId = state.data.bookId, chapter = null) {
  const book = bookById(bookId);
  if (!book) return { words: [], chapter: 0 };
  const size = settings().batchSize;
  let start = chapter == null ? currentGroupIndex(bookId) : chapter;
  let acc = [];
  let usedChapter = start;
  const maxChapters = totalChapters(bookId);
  for (let c = start; c < maxChapters && acc.length < size; c++) {
    const words = orderedChapter(bookId, c);
    for (const w of words) {
      if (acc.length >= size) break;
      const rec = state.data.records[w.w];
      if (chapter != null) {
        // 主动选关：整组照常学习（已掌握的词不再纳入，避免重置）
        if (rec && rec.isMastered) continue;
        acc.push(w);
      } else if (!rec) {
        acc.push(w);
      }
    }
    if (acc.length && c === start) usedChapter = c;
  }
  if (!acc.length && chapter == null) {
    usedChapter = start;
  }
  return { words: acc.slice(0, size), chapter: usedChapter };
}

export function bookProgress(bookId = state.data.bookId) {
  const book = bookById(bookId);
  const total = book ? book.totalWords : 0;
  const mastered = masteredCount(bookId);
  return {
    total,
    mastered,
    remaining: Math.max(0, total - mastered),
    percent: total ? Math.round((mastered / total) * 100) : 0,
    chapters: totalChapters(bookId),
    daysLeft: Math.ceil(Math.max(0, total - mastered) / Math.max(1, settings().dailyGroups * settings().batchSize)),
  };
}

// ---------- 会话 ----------
export function activeSession() {
  return state.data.session;
}

export function startSession(kind, opts = {}) {
  const bookId = opts.bookId || state.data.bookId;
  const words = (opts.words || []).map((w) => (typeof w === 'string' ? getWordObj(w) : w));
  const session = {
    kind,
    bookId,
    chapter: opts.chapter != null ? opts.chapter : null,
    words: words.map((w) => w.w),
    index: 0,
    step: 'quiz',
    startedAt: Date.now(),
    elapsed: 0,
    results: {},
    quiz: {},
    spell: {},
    mask: null,
    summary: null,
  };
  for (const w of session.words) {
    session.results[w] = {
      quizFirstTry: null,
      quizMistakes: 0,
      spellMistakes: 0,
      done: false,
      skipped: false,
      newWord: !state.data.records[w],
    };
  }
  state.data.session = session;
  save(true);
  emit();
  return session;
}

export function updateSession(mutator) {
  const s = state.data.session;
  if (!s) return null;
  mutator(s);
  save();
  return s;
}

export function endSession() {
  state.data.session = null;
  save();
  emit();
}

export function newWordCountInSession(session) {
  if (!session) return 0;
  return Object.values(session.results).filter((r) => r.newWord).length;
}

export function sessionAccuracy(session) {
  if (!session) return 0;
  const vals = Object.values(session.results);
  if (!vals.length) return 0;
  const firstTry = vals.filter((r) => r.quizFirstTry !== false).length;
  return Math.round((firstTry / vals.length) * 100);
}

// ---------- 统计 ----------
export function streakDays() {
  const days = new Set(state.data.streak.days || []);
  let count = 0;
  let key = today();
  while (days.has(key)) {
    count++;
    key = addDaysKey(key, -1);
  }
  return count;
}

export function longestStreak() {
  const days = [...new Set(state.data.streak.days || [])].sort();
  let best = 0;
  let cur = 0;
  let prev = null;
  for (const d of days) {
    if (prev && addDaysKey(prev, 1) === d) cur++;
    else cur = 1;
    best = Math.max(best, cur);
    prev = d;
  }
  return best;
}

export function punchToday() {
  const days = state.data.streak.days;
  const t = today();
  if (!days.includes(t)) {
    days.push(t);
    if (days.length > 800) state.data.streak.days = days.slice(-800);
    save();
  }
}

export function addSeconds(sec) {
  if (!sec) return;
  const d = dailyEntry();
  d.seconds = (d.seconds || 0) + sec;
  save();
}

export function rangeData(range) {
  const now = new Date();
  let start;
  if (range === 'week') {
    const monday = todayWeek()[0];
    start = dayKey(monday);
  } else if (range === 'month') {
    start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  } else {
    const keys = Object.keys(state.data.daily).sort();
    start = keys[0] || today();
  }
  const keys = Object.keys(state.data.daily).filter((k) => k >= start && k <= today()).sort();
  const agg = { newW: 0, revW: 0, correct: 0, total: 0, seconds: 0, days: 0, n: 0 };
  for (const k of keys) {
    const d = state.data.daily[k];
    if (!d) continue;
    const n = (d.newW || 0) + (d.revW || 0);
    if (n > 0) {
      agg.days++;
      agg.n += n;
    }
    agg.newW += d.newW || 0;
    agg.revW += d.revW || 0;
    agg.correct += d.correct || 0;
    agg.total += d.total || 0;
    agg.seconds += d.seconds || 0;
  }
  agg.accuracy = agg.total ? Math.round((agg.correct / agg.total) * 100) : 0;
  return { start, keys, agg };
}

export function barData(range) {
  const days = [];
  const now = new Date();
  if (range === 'week') {
    for (const d of todayWeek()) {
      const k = dayKey(d);
      days.push({ key: k, label: '一二三四五六日'[((d.getDay() + 6) % 7)], value: (state.data.daily[k]?.newW || 0), acc: state.data.daily[k]?.total ? Math.round((state.data.daily[k].correct / state.data.daily[k].total) * 100) : 0 });
    }
  } else if (range === 'month') {
    const y = now.getFullYear();
    const m = now.getMonth();
    const len = new Date(y, m + 1, 0).getDate();
    for (let i = 1; i <= len; i++) {
      const k = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      days.push({ key: k, label: String(i), value: state.data.daily[k]?.newW || 0, acc: state.data.daily[k]?.total ? Math.round((state.data.daily[k].correct / state.data.daily[k].total) * 100) : 0 });
    }
  } else {
    const map = new Map();
    for (const [k, d] of Object.entries(state.data.daily)) {
      const mk = k.slice(0, 7);
      const e = map.get(mk) || { newW: 0, correct: 0, total: 0 };
      e.newW += d.newW || 0;
      e.correct += d.correct || 0;
      e.total += d.total || 0;
      map.set(mk, e);
    }
    const keys = [...map.keys()].sort().slice(-12);
    for (const k of keys) {
      const e = map.get(k);
      days.push({ key: k, label: k.slice(5) + '月', value: e.newW, acc: e.total ? Math.round((e.correct / e.total) * 100) : 0 });
    }
  }
  return days;
}

export function heatmapDays(count = 140) {
  const res = [];
  const d = startOfToday();
  d.setDate(d.getDate() - count + 1);
  for (let i = 0; i < count; i++) {
    const k = dayKey(d);
    const e = state.data.daily[k];
    res.push({ key: k, date: new Date(d), value: e ? (e.newW || 0) + (e.revW || 0) : 0, punch: (state.data.streak.days || []).includes(k) });
    d.setDate(d.getDate() + 1);
  }
  return res;
}

export function masteryBuckets(bookId = state.data.bookId) {
  const recs = bookRecords(bookId);
  return {
    firm: recs.filter((r) => r.isMastered).length,
    stable: recs.filter((r) => !r.isMastered && r.stage === 2).length,
    fuzzy: recs.filter((r) => !r.isMastered && r.stage === 1).length,
    forgot: recs.filter((r) => !r.isMastered && (r.stage || 0) === 0 && (r.wrongCount || 0) > 0).length,
  };
}

export function wordsForRecord(rec) {
  const w = getWordObj(rec.word);
  return w;
}

// ---------- 备份 ----------
export function exportBackup() {
  return JSON.stringify({ app: 'word-isle-local', exportedAt: new Date().toISOString(), state: state.data }, null, 2);
}

export function importBackup(json) {
  const obj = JSON.parse(json);
  const st = obj.state || obj;
  if (!st || st.version !== 2) throw new Error('备份格式不匹配');
  state.data = Object.assign(defaultState(), st);
  state.data.settings = Object.assign(defaultState().settings, st.settings || {});
  save(true);
  emit();
}

export function resetAll() {
  state.data = defaultState();
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
  save(true);
  emit();
}
