// ============================================
// 한글 타자연습 게임
// ============================================

// ---------- 프리셋 연습 텍스트 ----------
const PRESETS = [
  "오늘은 날씨가 참 좋습니다. 하늘이 맑고 바람도 시원하게 붑니다.",
  "가는 말이 고와야 오는 말이 곱다. 백지장도 맞들면 낫다. 티끌 모아 태산.",
  "우리는 매일 새로운 것을 배우며 성장한다. 작은 습관이 모여 큰 변화를 만든다. 꾸준함은 재능을 이긴다는 말이 있다. 오늘 하루도 최선을 다해 연습해 보자."
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

// ---------- 상태 ----------
let targetText = '';
let startTime = null;
let timerInterval = null;
let finished = false;
let correctStrokes = 0;
let wrongStrokes = 0;
let finalizedIndex = -1;    // 여기까지는 조합이 끝나 '확정'된 글자
let prevValue = '';
let composingFlag = false;  // compositionstart ~ compositionend 사이 true

// ---------- DOM ----------
const screens = {
  intro: document.getElementById('screen-intro'),
  game: document.getElementById('screen-game'),
  result: document.getElementById('screen-result')
};
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
const resultMistakes = document.getElementById('resultMistakes');
const retryBtn = document.getElementById('retryBtn');
const homeBtn = document.getElementById('homeBtn');

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// ---------- 프리셋 선택 ----------
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

// ---------- 게임 시작 ----------
startBtn.addEventListener('click', () => startGame(customText.value));

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
// 목표 텍스트 한 곳에서 '유령 텍스트 / 확정된 글자(정오답) / 지금 조합 중인 글자'를 모두 표시
function renderTargetText(value, composing) {
  const committedLength = composing ? value.length - 1 : value.length;
  const composingIndex = composing ? value.length - 1 : -1;
  const frag = document.createDocumentFragment();

  for (let i = 0; i < targetText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';

    if (i === composingIndex) {
      // 조합 중: 목표 글자 자리에 실제로 지금 만들어지고 있는 글자를 그대로 표시
      span.textContent = value[i] ?? targetText[i];
      span.classList.add('composing');
    } else if (i < committedLength) {
      // 확정됨: 목표 글자를 보여주되 맞았는지 여부로 색을 구분
      span.textContent = targetText[i];
      span.classList.add(value[i] === targetText[i] ? 'correct' : 'incorrect');
    } else {
      // 아직 입력 전
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

// ---------- 종료 (완주 또는 '그만하기' 모두 여기로 모임) ----------
function finishGame() {
  if (finished) return;
  finished = true;
  clearInterval(timerInterval);

  const elapsedMs = startTime ? Date.now() - startTime : 0;
  const elapsedMin = elapsedMs / 60000;
  const total = correctStrokes + wrongStrokes;
  const acc = total > 0 ? Math.round((correctStrokes / total) * 100) : 100;
  const cpm = elapsedMin > 0 ? Math.round(correctStrokes / elapsedMin) : 0;

  resultTime.textContent = formatTime(elapsedMs);
  resultCpm.textContent = cpm;
  resultAcc.textContent = acc + '%';
  resultMistakes.textContent = wrongStrokes;

  hiddenInput.blur();
  showScreen('result');
}

// ---------- 버튼 ----------
quitBtn.addEventListener('click', () => finishGame());
retryBtn.addEventListener('click', () => startGame(targetText));
homeBtn.addEventListener('click', () => showScreen('intro'));

screens.game.addEventListener('click', () => hiddenInput.focus());

// ---------- 초기화 ----------
document.addEventListener('DOMContentLoaded', () => {
  customText.value = PRESETS[0];
  showScreen('intro');
});
