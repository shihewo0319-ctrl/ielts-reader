/* ============ 单词发音 / 音标 ============ */
// 单词发音：默认用有道词典发音接口（免费、无需 key、国内稳定，type=2 美音 / type=1 英音）；
// 若播放失败或超时未开始播放，兜底用浏览器内置语音合成。
import { fetchJson } from '../lib/api.js';

let ttsVoices = [];
export function initTts() {
  if (!('speechSynthesis' in window)) return;
  const load = () => { try { ttsVoices = speechSynthesis.getVoices() || []; } catch (e) {} };
  load();
  try { speechSynthesis.onvoiceschanged = load; } catch (e) {}
}

function pickEnVoice() {
  return ttsVoices.find(v => /^en(-|_)?(US|GB)/i.test(v.lang) && /Google|Microsoft|Samantha|Daniel|Alex|Aria|Jenny|Guy|Libby|Zira|Hazel|Susan/i.test(v.name))
      || ttsVoices.find(v => /^en(-|_)?US/i.test(v.lang))
      || ttsVoices.find(v => /^en/i.test(v.lang))
      || null;
}

function ttsSpeak(word) {
  if (!('speechSynthesis' in window)) return;
  let started = false;
  try { speechSynthesis.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(word);
  u.lang = 'en-US';
  u.rate = 0.9;
  const voice = pickEnVoice();
  if (voice) u.voice = voice;
  // Chrome 已知问题：cancel 后立刻 speak 可能被吞掉，稍作延迟
  setTimeout(() => {
    if (!started) { try { speechSynthesis.resume(); } catch (e) {} speechSynthesis.speak(u); }
  }, 60);
}

export function speakWord(word, accent) {
  // 播放反馈：高亮被点击的音标标签（或兜底喇叭按钮）
  const sel = accent ? '.popup .popup-phonetic[data-accent="' + accent + '"]' : '.popup .popup-sound';
  const btn = document.querySelector(sel);
  if (btn) {
    btn.classList.remove('speaking');
    void btn.offsetWidth; // 重置动画
    btn.classList.add('speaking');
    setTimeout(() => btn.classList.remove('speaking'), 1600);
  }
  // 默认：有道发音（type=2 美音 / type=1 英音）
  const type = accent === 'uk' ? 1 : 2;
  let used = false;
  const fallback = () => { if (!used) { used = true; ttsSpeak(word); } };
  try {
    const audio = new Audio('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(word) + '&type=' + type);
    audio.play().then(() => { used = true; }).catch(fallback);
    setTimeout(() => { if (!used) fallback(); }, 2000);
  } catch (e) {
    fallback();
  }
}

// 音标：有道 /api/pron 返回英音(ukphone)/美音(usphone)两套音标，点击哪个就发哪个音
const pronCache = {};
export async function loadPhonetics(word, wrap) {
  let data = null;
  if (pronCache[word]) {
    data = pronCache[word];
  } else {
    try {
      data = await fetchJson('/api/pron?word=' + encodeURIComponent(word), 6000);
      if (data && data.ok) pronCache[word] = data;
    } catch (e) { data = null; }
  }
  const uk = data && (data.ukphone || '').trim();
  const us = data && (data.usphone || '').trim();
  if (!uk && !us) return; // 没有音标时保留 🔊 兜底按钮
  wrap.innerHTML = '';
  if (us) wrap.appendChild(makePhoneticBtn(word, 'us', us));
  if (uk) wrap.appendChild(makePhoneticBtn(word, 'uk', uk));
}

export function makePhoneticBtn(word, accent, ipa) {
  const b = document.createElement('button');
  b.className = 'popup-phonetic';
  b.dataset.accent = accent;
  b.title = (accent === 'uk' ? '英音' : '美音') + '发音';
  b.setAttribute('aria-label', (accent === 'uk' ? '英音' : '美音') + ' ' + word);
  const ipaSpan = document.createElement('span');
  ipaSpan.className = 'ipa';
  ipaSpan.textContent = '/' + ipa + '/';
  const accSpan = document.createElement('span');
  accSpan.className = 'accent';
  accSpan.textContent = accent === 'uk' ? '英' : '美';
  b.appendChild(ipaSpan);
  b.appendChild(accSpan);
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    speakWord(word, accent);
  });
  return b;
}
