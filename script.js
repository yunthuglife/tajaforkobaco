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
  if (code < HANGUL_BASE || code > HANGUL_LAST) return 1; // 영문/숫자/공백/문장부호
  const offset = code - HANGUL_BASE;
  const jongIdx = offset % 28;
  const jungIdx = Math.floor(offset / 28) % 21;
  let strokes = 1; // 초성
  strokes += DOUBLE_JUNG.has(JUNG[jungIdx]) ? 2 : 1;
  if (jongIdx > 0) strokes += DOUBLE_JONG.has(JONG[jongIdx]) ? 2 : 1;
  return strokes;
}

// ---------- 상태 ----------
let targetText = '';
let startTime = null;
let timerInterval = null;
let completionTimer = null;
let finished = false;
let correctStrokes = 0;
let wrongStrokes = 0;
let finalizedIndex = -1;
let prevValue = '';

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
const typedEchoEl = document.getElementById('typedEcho');
const hiddenInput = document.getElementById('hiddenInput');
const timeDisplay = document.getElementById('timeDisplay');
const cpmDisplay = document.getElementById('cpmDisplay');
const accDisplay = document.getElementById('accDisplay');
const progressFill = document.getElementById('progressFill');
const restartBtn = document.getElementById('restartBtn');
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
  clearInterval(timerInterval);
  clearTimeout(completionTimer);

  hiddenInput.value = '';
  timeDisplay.textContent = '00:00';
  cpmDisplay.textContent = '0';
  accDisplay.textContent = '100%';
  progressFill.style.width = '0%';

  renderTargetText('');
  renderTypedEcho('');

  showScreen('game');
  setTimeout(() => hiddenInput.focus(), 50); // 모바일 키보드 호출
}

// ---------- 입력 처리 ----------
function finalizeChar(index, typedChar) {
  if (index < 0 || index >= targetText.length) return;
  const expected = targetText[index];
  const strokes = keystrokesOf(expected);
  if (typedChar === expected) correctStrokes += strokes;
  else wrongStrokes += strokes;
}

hiddenInput.addEventListener('paste', (e) => e.preventDefault());
hiddenInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });

hiddenInput.addEventListener('input', () => {
  if (finished) return;
  const value = hiddenInput.value;

  if (startTime === null && value.length > 0) {
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 200);
  }

  if (value.length > prevValue.length) {
    // 새 글자 슬롯이 생겼다는 것은 직전 글자의 조합(입력)이 끝났다는 뜻
    const toFinalize = value.length - 2;
    if (toFinalize >= 0 && toFinalize > finalizedIndex) {
      finalizeChar(toFinalize, prevValue[toFinalize]);
      finalizedIndex = toFinalize;
    }
  } else if (value.length < prevValue.length) {
    // 백스페이스로 지운 경우
    if (finalizedIndex >= value.length - 1) finalizedIndex = value.length - 2;
  }

  prevValue = value;
  renderTargetText(value);
  renderTypedEcho(value);
  updateLiveStats();

  if (value.length >= targetText.length) scheduleCompletionCheck();
  else clearTimeout(completionTimer);
});

function scheduleCompletionCheck() {
  clearTimeout(completionTimer);
  // 마지막 글자의 겹받침 등 조합이 끝나길 잠깐 기다린 뒤 종료 처리
  completionTimer = setTimeout(() => {
    if (finished) return;
    if (hiddenInput.value.length >= targetText.length) completeExercise();
  }, 350);
}

function completeExercise() {
  const value = hiddenInput.value;
  const lastIndex = targetText.length - 1;
  if (lastIndex > finalizedIndex) {
    finalizeChar(lastIndex, value[lastIndex]);
    finalizedIndex = lastIndex;
  }
  finishGame();
}

// ---------- 렌더링 ----------
function renderTargetText(value) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < targetText.length; i++) {
    const span = document.createElement('span');
    span.className = 'char';
    span.textContent = targetText[i];
    if (i < value.length) {
      span.classList.add(value[i] === targetText[i] ? 'correct' : 'incorrect');
    } else if (i === value.length) {
      span.classList.add('current');
    }
    frag.appendChild(span);
  }
  targetTextEl.innerHTML = '';
  targetTextEl.appendChild(frag);
}

function renderTypedEcho(value) { typedEchoEl.textContent = value; }

// ---------- 통계 ----------
function updateLiveStats() {
  const total = correctStrokes + wrongStrokes;
  const acc = total > 0 ? Math.round((correctStrokes / total) * 100) : 100;
  accDisplay.textContent = acc + '%';

  const elapsedMin = startTime ? (Date.now() - startTime) / 60000 : 0;
  const cpm = elapsedMin > 0 ? Math.round(correctStrokes / elapsedMin) : 0;
  cpmDisplay.textContent = cpm;

  const progress = Math.min(100, Math.round((prevValue.length / targetText.length) * 100));
  progressFill.style.width = progress + '%';
}

function updateTimer() {
  if (!startTime) return;
  timeDisplay.textContent = formatTime(Date.now() - startTime);
  updateLiveStats();
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const sec = String(totalSec % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

// ---------- 종료 ----------
function finishGame() {
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
restartBtn.addEventListener('click', () => startGame(targetText));
quitBtn.addEventListener('click', () => {
  clearInterval(timerInterval);
  clearTimeout(completionTimer);
  showScreen('intro');
});
retryBtn.addEventListener('click', () => startGame(targetText));
homeBtn.addEventListener('click', () => showScreen('intro'));

// 게임 화면 아무 곳이나 탭하면 키보드가 다시 뜨도록 (모바일 대응)
screens.game.addEventListener('click', () => hiddenInput.focus());

// ---------- 초기화 ----------
document.addEventListener('DOMContentLoaded', () => {
  customText.value = PRESETS[0];
  showScreen('intro');
});