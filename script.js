// ============================================
// 한글 타자연습 게임
// ============================================

// ---------- 프리셋 연습 텍스트 ----------
const PRESETS = [
  "제6조(투명하고 공정한 직무수행) 임직원은 공사인으로서 자긍심과 높은 윤리적 가치관을 가지고 제 규정을 준수하여 공정하고 성실하게 직무를 수행하여야 하며 건전한 기업문화 조성을 위해 노력하여야 한다.",
  "제9조(특혜 및 차별 배제) 임직원은 직무를 수행함에 있어서 혈연, 지연, 학연, 종교 등을 이유로 직무관련자나 다른 직원에게 특혜를 주거나 특정인을 차별하여서는 아니 된다.",
  "제24조(성관련 비위행위 금지) 임직원은 상대방의 인권을 침해하고 공직자로서의 품위를 손상시키는 성희롱, 성폭력, 성매매 등 성범죄 행위를 하여서는 아니 된다."
];

// ---------- 한글 분해 기반 실제 타수(키 입력 횟수) 계산 ----------
const HANGUL_BASE = 0xAC00;
const HANGUL_LAST = 0xD7A3;
const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const JONG = ['', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const DOUBLE_JUNG = new Set(['ㅘ','ㅙ','ㅚ','ㅝ','ㅞ','ㅟ','ㅢ']);
const DOUBLE_JONG = new Set(['ㄳ','ㄵ','ㄶ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅄ']);

function keystrokesOf(char) {
  if (!char) return 0;
  const code = char.charCodeAt(0);
  if (code < HANGUL_BASE || code > HANGUL_LAST) return 1;
  const offset = code - HANGUL_BASE;
  const jongIdx = offset % 28;
  const jungIdx = Math.floor(offset / 28) % 21;
  let strokes = 1;
  strokes += DOUBLE_JUNG.has(JUNG[jungIdx]) ? 2 : 1;
  if (jongIdx > 0) strokes += DOUBLE_JONG.has(JONG[jongIdx]) ? 2 : 1;
  return strokes;
}

// ---------- 최종 결과물의 문자열 일치율 계산 ----------
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function calcMatchRate(target, typed) {
  if (target.length === 0) return 100;
  const distance = levenshteinDistance(target, typed);
  const maxLen = Math.max(target.length, typed.length);
  if (maxLen === 0) return 100;
  return Math.max(0, Math.round((1 - distance / maxLen) * 100));
}

// ---------- 상태 ----------
let userName = '';
let userPosition = '';
let targetText = '';
let startTime = null;
let timerInterval = null;
let finished = false;
let correctStrokes = 0;
let wrongStrokes = 0;
let finalizedIndex = -1;
let prevValue = '';
let composingFlag = false;

// ---------- DOM ----------
const screens = {
  welcome: document.getElementById('screen-welcome'),
  intro: document.getElementById('screen-intro'),
  game: document.getElementById('screen-game'),
  result: document.getElementById('screen-result')
};
const welcomeNextBtn = document.getElementById('welcomeNextBtn');
const userNameInput = document.getElementById('userNameInput');
const userPositionInput = document.getElementById('userPositionInput');
const greetingText = document.getElementById('greetingText');

const presetButtons = Array.from(document.querySelectorAll('.preset-btn'));
const customText = document.getElementById('customText');
const startBtn = document.getElementById('startBtn');
const targetTextEl = document.getElementById('targetText');
const hiddenInput = document.getElementById('hiddenInput');
const timeDisplay = document.getElementById('timeDisplay');
const cpmDisplay = document.getElementById('cpmDisplay');
const accDisplay = document.getElementById('accDisplay');
const progressFill = document.getElementById('progressFill');
const quitBtn = document.getElementById('quitBtn');
const resultTime = document.getElementById('resultTime');
const resultCpm = document.getElementById('resultCpm');
const resultAcc = document.getElementById('resultAcc');
const resultMatch = document.getElementById('resultMatch');
const resultMistakes = document.getElementById('resultMistakes');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------- 1) 이름/직급 입력 ----------
welcomeNextBtn.addEventListener('click', () => {
  const name = userNameInput.value.trim();
  const position = userPositionInput.value.trim();
  if (!name || !position) {
    alert('이름과 직급을 모두 입력해주세요.');
    return;
  }
  userName = name;
  userPosition = position;
  greetingText.textContent = `${userName} ${userPosition}님, 반갑습니다!`;
  showScreen('intro');
});

// ---------- 2) 프리셋 선택 ----------
presetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const val = btn.dataset.preset;
    if (val === 'custom') {
      customText.value = '';
      customText.disabled = false;
      customText.focus();
    } else {
      customText.value = PRESETS[Number(val)];
      customText.disabled = true;
    }
  });
});

startBtn.addEventListener('click', () => startGame(customText.value));

// ---------- 3) 게임 시작 ----------
function startGame(text) {
  const trimmed = text.trim();
  if (!trimmed) { alert('연습할 텍스트를 입력하거나 선택해주세요.'); return; }

  targetText = trimmed;
  startTime = null;
  finished = false;
  correctStrokes = 0;
  wrongStrokes = 0;
  finalizedIndex = -1;
  prevValue = '';
  composingFlag = false;
  clearInterval(timerInterval);

  hiddenInput.value = '';
  timeDisplay.textContent = '00:00';
  cpmDisplay.textContent = '0';
  accDisplay.textContent = '100%';
  progressFill.style.width = '0%';

  renderTargetText('', false);

  showScreen('game');
  setTimeout(() => hiddenInput.focus(), 50);
}

// ---------- 조합(IME) 상태 추적 ----------
hiddenInput.addEventListener('compositionstart', () => {
  composingFlag = true;
});
hiddenInput.addEventListener('compositionupdate', () => {
  processInput();
});
hiddenInput.addEventListener('compositionend', () => {
  composingFlag = false;
  processInput();
});
hiddenInput.addEventListener('input', () => {
  processInput();
});

hiddenInput.addEventListener('paste', (e) => e.preventDefault());
hiddenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

function finalizeUpTo(value, upToIndexInclusive) {
  for (let i = finalizedIndex + 1; i <= upToIndexInclusive; i++) {
    if (i < 0 || i >= targetText.length) continue;
    const expected = targetText[i];
    const typedChar = value[i];
    const strokes = keystrokesOf(expected);
    if (typedChar === expected) correctStrokes += strokes;
    else wrongStrokes += strokes;
  }
  if (upToIndexInclusive > finalizedIndex) finalizedIndex = upToIndexInclusive;
}

function processInput() {
  if (finished) return;
  const value = hiddenInput.value;
  const composing = composingFlag;

  if (startTime === null && value.length > 0) {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 200);
  }

  if (value.length < prevValue.length) {
    finalizedIndex = Math.min(finalizedIndex, value.length - 1);
  }

  const committedUpTo = composing ? value.length - 2 : value.length - 1;
  if (committedUpTo > finalizedIndex) finalizeUpTo(value, committedUpTo);

  prevValue = value;
  renderTargetText(value, composing);
  updateLiveStats(value);

  if (!composing && value.length >= targetText.length) {
    finishGame();
  }
}

// ---------- 렌더링 ----------
function renderTargetText(value, composing) {
  const committedLength = composing ? value.length - 1 : value.length;
  const composingIndex = composing ? value.length - 1 : -1;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < targetText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';

    if (i === composingIndex) {
      span.textContent = value[i] ?? targetText[i];
      span.classList.add('composing');
    } else if (i < committedLength) {
      span.textContent = targetText[i];
      span.classList.add(value[i] === targetText[i] ? 'correct' : 'incorrect');
    } else {
      span.textContent = targetText[i];
      if (i === committedLength) span.classList.add('current');
    }

    frag.appendChild(span);
  }

  targetTextEl.innerHTML = '';
  targetTextEl.appendChild(frag);
}

// ---------- 통계 ----------
function updateLiveStats(value) {
  const total = correctStrokes + wrongStrokes;
  const acc = total > 0 ? Math.round((correctStrokes / total) * 100) : 100;
  accDisplay.textContent = acc + '%';

  const elapsedMin = startTime ? (Date.now() - startTime) / 60000 : 0;
  const cpm = elapsedMin > 0 ? Math.round(correctStrokes / elapsedMin) : 0;
  cpmDisplay.textContent = cpm;

  const progress = Math.min(100, Math.round((value.length / targetText.length) * 100));
  progressFill.style.width = progress + '%';
}

function updateTimer() {
  if (!startTime) return;
  timeDisplay.textContent = formatTime(Date.now() - startTime);
  updateLiveStats(hiddenInput.value);
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

// ---------- 4) 종료 ----------
function finishGame() {
  if (finished) return;
  finished = true;
  clearInterval(timerInterval);

  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const elapsedMin = elapsedMs / 60000;
  const total = correctStrokes + wrongStrokes;
  const acc = total > 0 ? Math.round((correctStrokes / total) * 100) : 100;
  const cpm = elapsedMin > 0 ? Math.round(correctStrokes / elapsedMin) : 0;
  const matchRate = calcMatchRate(targetText, hiddenInput.value);

  resultTime.textContent = formatTime(elapsedMs);
  resultCpm.textContent = cpm;
  resultAcc.textContent = acc + '%';
  resultMatch.textContent = matchRate + '%';
  resultMistakes.textContent = wrongStrokes;

  hiddenInput.blur();
  showScreen('result');
}

// ---------- 버튼 ----------
quitBtn.addEventListener('click', () => {
  const confirmed = confirm('연습을 그만하고 결과를 확인하시겠습니까?');
  if (confirmed) {
    finishGame();
  } else {
    hiddenInput.focus();
  }
});
retryBtn.addEventListener('click', () => startGame(targetText));
homeBtn.addEventListener('click', () => showScreen('welcome')); // 흐름의 맨 처음(이름/직급 입력)으로 복귀

screens.game.addEventListener('click', () => hiddenInput.focus());

// ---------- 초기화 ----------
document.addEventListener('DOMContentLoaded', () => {
  customText.value = PRESETS[0];
  showScreen('welcome');
});
