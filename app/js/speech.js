// 发音：优先 Web Speech API；无可用语音时用提示音兜底

let voices = [];
let loaded = false;

function loadVoices() {
  if (!('speechSynthesis' in window)) return [];
  voices = window.speechSynthesis.getVoices();
  loaded = voices.length > 0;
  return voices;
}

if ('speechSynthesis' in window) {
  loadVoices();
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}

export function canSpeak() {
  return 'speechSynthesis' in window;
}

export function pickVoice(accent = 'us') {
  if (!loaded) loadVoices();
  const lang = accent === 'uk' ? 'en-GB' : 'en-US';
  const langShort = accent === 'uk' ? 'en_gb' : 'en_us';
  return (
    voices.find((v) => v.lang === lang && /google|natural|samantha|daniel|aria|libby|sonia/i.test(v.name)) ||
    voices.find((v) => v.lang === lang) ||
    voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.toLowerCase())) ||
    voices.find((v) => v.lang.toLowerCase().replace('_', '-').startsWith('en')) ||
    null
  );
}

export function speak(text, { accent = 'us', rate = 0.9 } = {}) {
  if (!text || !('speechSynthesis' in window)) return false;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text));
    u.lang = accent === 'uk' ? 'en-GB' : 'en-US';
    u.rate = rate;
    u.pitch = 1;
    const v = pickVoice(accent);
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
    return true;
  } catch {
    return false;
  }
}
