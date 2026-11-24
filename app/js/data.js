// 词库数据加载、单词图片、搜索

import { seededShuffle, sample, coreMeaning, escapeReg } from './util.js';

export const IMG_BASE = 'https://bilibilitoyassets.top/word_toy/word_images/';

export const data = {
  books: [],
  bookMap: new Map(),
  vocab: [],
  wordMap: new Map(),
  dict: null,
  dictMap: null,
};

let booksLoaded = null;

export function loadData(onProgress = () => {}) {
  if (booksLoaded) return booksLoaded;
  booksLoaded = (async () => {
    onProgress('正在加载词库…');
    const [booksRaw, vocab] = await Promise.all([
      fetch('./data/books.json').then((r) => r.json()),
      fetch('./data/words.json').then((r) => r.json()),
    ]);
    data.books = Object.values(booksRaw);
    data.vocab = vocab;
    data.bookMap = new Map(data.books.map((b) => [b.id, b]));
    data.wordMap = new Map(vocab.map((w) => [w.w.toLowerCase(), w]));
    onProgress('');
    return data;
  })();
  return booksLoaded;
}

export function bookById(id) {
  return data.bookMap.get(id);
}

export function bookWords(book) {
  if (!book) return [];
  return book.words.map((i) => data.vocab[i]).filter(Boolean);
}

export function getWordObj(word) {
  return data.wordMap.get(String(word).toLowerCase()) || { w: word, s: word, t: '', p: '', us: '', uk: '', en: '', cn: '' };
}

// 词书封面代号
const CODE_MAP = [
  [/专业四级|TEM-4/i, 'TEM-4'],
  [/专业八级|TEM-8/i, 'TEM-8'],
  [/四级/, 'CET-4'],
  [/六级/, 'CET-6'],
  [/考研英语（一）|考研英语\(一\)|考研一/, '考研一'],
  [/考研英语（二）|考研英语\(二\)|考研二/, '考研二'],
  [/雅思|IELTS/i, 'IELTS'],
  [/托福|TOEFL/i, 'TOEFL'],
  [/专升本/, '专升本'],
  [/高考/, '高考'],
  [/中考/, '中考'],
  [/必修第一册/, '必修一'],
  [/必修第二册/, '必修二'],
  [/必修第三册/, '必修三'],
  [/选择性必修一/, '选必一'],
  [/选择性必修二/, '选必二'],
  [/选择性必修三/, '选必三'],
  [/选择性必修四/, '选必四'],
  [/七年级上册/, '七上'],
  [/七年级下册/, '七下'],
  [/八年级上册/, '八上'],
  [/八年级下册/, '八下'],
  [/九年级/, '九全'],
  [/一年级上册/, '一上'],
  [/一年级下册/, '一下'],
  [/二年级上册/, '二上'],
  [/二年级下册/, '二下'],
  [/三年级上册/, '三上'],
  [/三年级下册/, '三下'],
  [/四年级上册/, '四上'],
  [/四年级下册/, '四下'],
  [/五年级上册/, '五上'],
  [/五年级下册/, '五下'],
  [/六年级上册/, '六上'],
  [/六年级下册/, '六下'],
];

export function bookCode(book) {
  if (!book) return 'WORD';
  for (const [re, code] of CODE_MAP) if (re.test(book.title)) return code;
  return book.title.slice(0, 6);
}

export function bookShortTitle(book) {
  if (!book) return '';
  const code = bookCode(book);
  let s = String(book.tag || book.title);
  s = s.replace(new RegExp(`^${escapeReg(code)}\\s*·\\s*`), '');
  s = s.replace(/\s*\d[\d,]*\s*词\s*$/, '').replace(/\s*\d[\d,]*\s*核心\s*$/, '').trim();
  if (!s) s = String(book.title).replace(/(大纲|核心|常用|必备)?词汇$/, '').trim() || code;
  return s;
}

// 网格/封面上用的短名：取标签第一段并去掉数量
export function bookLabel(book) {
  if (!book) return '';
  const raw = String(book.tag || book.title).split('·')[0];
  return raw.replace(/\s+\d[\d,]*\s*(核心|词)?\s*$/i, '').trim() || bookCode(book);
}

export const CATEGORY_LABEL = { cet: '大学', kaoyan: '大学', abroad: '大学', high: '高中', middle: '初中', primary: '小学' };
export const CATEGORY_ORDER = ['大学', '高中', '初中', '小学'];

export function categoryOf(book) {
  return CATEGORY_LABEL[book.category] || '大学';
}

export function difficultyOf(book) {
  return { 大学: 3, 高中: 2, 初中: 2, 小学: 1 }[categoryOf(book)] || 2;
}

// ---------- 图片 ----------
export function imageName(w) {
  if (!w) return '';
  return w.img || w.s || String(w.w || '').replace(/\s+/g, '_');
}

export function imageUrl(w) {
  const name = imageName(w);
  return name ? IMG_BASE + encodeURIComponent(name) + '.webp' : '';
}

export function placeholderImage(w) {
  const ch = escXml((w && w.w ? w.w[0] : '?').toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <rect width="300" height="300" rx="24" fill="#EFEAE1"/>
  <rect x="18" y="18" width="264" height="264" rx="18" fill="none" stroke="#D9D1C4" stroke-width="1.5" stroke-dasharray="4 5"/>
  <text x="150" y="172" font-family="Georgia,serif" font-size="96" fill="#C9BFAE" text-anchor="middle">${ch}</text>
  <text x="150" y="230" font-family="PingFang SC,Microsoft YaHei,sans-serif" font-size="13" fill="#B3A996" text-anchor="middle">暂无插画</text>
</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

function escXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

const imgCacheName = 'bwt-images-v1';

export function attachImage(img, w) {
  const url = imageUrl(w);
  if (!url) {
    img.src = placeholderImage(w);
    return;
  }
  img.dataset.word = w.w;
  img.src = url;
  img.onerror = async () => {
    try {
      const cache = await caches.open(imgCacheName);
      const hit = await cache.match(url);
      if (hit) {
        img.src = URL.createObjectURL(await hit.blob());
        img.onerror = null;
        return;
      }
    } catch {}
    img.src = placeholderImage(w);
    img.onerror = null;
  };
  // 静默写入缓存，之后可离线
  if (navigator.onLine) {
    cacheImage(url).catch(() => {});
  }
}

async function cacheImage(url) {
  const cache = await caches.open(imgCacheName);
  if (await cache.match(url)) return;
  const res = await fetch(url, { mode: 'cors' });
  if (res.ok) await cache.put(url, res.clone());
}

export function prefetchWords(words) {
  if (!navigator.onLine) return;
  for (const w of words) {
    const url = imageUrl(w);
    if (url) cacheImage(url).catch(() => {});
  }
}

// ---------- 搜索 ----------
export async function loadDictionary() {
  if (data.dict) return data.dict;
  const raw = await fetch('./data/dict.json').then((r) => r.json());
  data.dict = raw;
  data.dictMap = new Map(raw.map(([w, t, tag]) => [w.toLowerCase(), { w, t, tag }]));
  return raw;
}

export async function searchWords(q, limit = 8) {
  q = q.trim();
  if (!q) return [];
  const lower = q.toLowerCase();
  const out = [];
  const seen = new Set();
  if (/[一-龥]/.test(q)) {
    const re = new RegExp(escapeReg(q));
    for (const w of data.vocab) {
      if (seen.has(w.w)) continue;
      if (w.t && re.test(w.t)) {
        out.push(w);
        seen.add(w.w);
        if (out.length >= limit) break;
      }
    }
  } else {
    for (const w of data.vocab) {
      if (seen.has(w.w)) continue;
      if (w.w.toLowerCase().startsWith(lower)) {
        out.push(w);
        seen.add(w.w);
        if (out.length >= limit) break;
      }
    }
    if (out.length < limit) {
      try {
        await loadDictionary();
        for (const entry of data.dictMap.values()) {
          if (out.length >= limit) break;
          if (!entry.w.toLowerCase().startsWith(lower)) continue;
          if (seen.has(entry.w)) continue;
          out.push({ w: entry.w, t: entry.t || '', p: '', s: entry.w, _dict: true });
          seen.add(entry.w);
        }
      } catch {}
    }
  }
  return out;
}

// 干扰项：优先同词书、长度相近，尽量有插画
export function distractors(correct, pool, n, keyFn) {
  const key = keyFn || ((x) => x && x.t);
  const correctKey = key(correct);
  const cands = pool.filter((x) => x && x !== correct && key(x) && key(x) !== correctKey);
  const withImg = cands.filter((x) => imageUrl(x));
  const src = withImg.length >= n ? withImg : cands;
  return sample(src, n);
}
