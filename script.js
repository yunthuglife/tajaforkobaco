// ============================================
// 한글 타자연습 게임
// ============================================

// 2단계에서 복사한 Apps Script 웹 앱 URL (이 값이 비어 있으면 기록 전송을 건너뜀)
const SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbxspEuKFvqcvJKYOETKg31Y9-gp3xngqAMUASu2zt23x23rdCdkxs_bwZUtPiCOHAXe/exec';

// ---------- 프리셋 연습 텍스트 ----------
const PRESETS = [
  "제6조(투명하고 공정한 직무수행) 임직원은 공사인으로서 자긍심과 높은 윤리적 가치관을 가지고 제 규정을 준수하여 공정하고 성실하게 직무를 수행하여야 하며 건전한 기업문화 조성을 위해 노력하여야 한다.",
  "제9조(특혜 및 차별 배제) 임직원은 직무를 수행함에 있어서 혈연, 지연, 학연, 종교 등을 이유로 직무관련자나 다른 직원에게 특혜를 주거나 특정인을 차별하여서는 아니 된다.",
  "제24조(성관련 비위행위 금지) 임직원은 상대방의 인권을 침해하고 공직자로서의 품위를 손상시키는 성희롱, 성폭력, 성매매 등 성범죄 행위를 하여서는 아니 된다.",
  "우리 공사는 기명 신고채널인 고충상담창구(인사팀, 노조, 사이버), 익명이 보장되는 외부위탁 신고채널인 K-휘슬(redwhistle.org), 그리고 국민권익위원회 청렴포털(clean.go.kr)을 통해 부패행위 신고를 받고 있다."
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

// 파일명에 쓸 수 없는 문자(\/:*?"<>|)와 공백을 제거
function sanitizeForFilename(text) {
  return text.replace(/[\\/:*?"<>|\s]/g, '');
}

// 결과를 Google 스프레드시트로 전송
async function saveRecord(record) {
  if (!SHEET_API_URL) return;
  saveStatus.textContent = '기록 저장 중...';
  try {
    // 주의: headers에 'Content-Type: application/json'을 지정하면 안 됩니다.
    // (지정하면 브라우저가 사전 요청을 보내고 Apps Script가 이를 처리하지 못해 실패함)
    const res = await fetch(SHEET_API_URL, {
      method: 'POST',
      body: JSON.stringify(record)
    });
    const result = await res.json();
    if (!result.ok) throw new Error(result.error || '저장 실패');
    saveStatus.textContent = '기록이 저장되었습니다.';
  } catch (err) {
    console.error('기록 저장 실패:', err);
    saveStatus.textContent = '기록 저장에 실패했습니다. 스크린샷으로 결과를 남겨주세요.';
  }
}

// 현재 시각을 파일명에 쓸 수 있는 형식으로 변환 (예: 20260922_153045)
function formatTimestampForFilename(date) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
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
const resultUserInfo = document.getElementById('resultUserInfo');
const saveStatus = document.getElementById('saveStatus');

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
const screenshotBtn = document.getElementById('screenshotBtn'); // 추가
const captureArea = document.getElementById('captureArea');     // 추가
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
  // 전체 텍스트를 다 그린 상태의 높이를 프레임 높이로 고정 (타이핑 중 박스 크기 변동 방지)

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

// 현재 입력 위치의 글자가 있는 줄을 텍스트 박스 중앙에 오도록 박스 내부만 스크롤
function keepActiveCharInView() {
  const activeEl = targetTextEl.querySelector('.composing') || targetTextEl.querySelector('.current');
  if (!activeEl) return;

  const boxRect = targetTextEl.getBoundingClientRect();
  const elRect = activeEl.getBoundingClientRect();

  // 글자의 위치를 '박스 내용 전체 기준'으로 환산
  const elTopInContent = elRect.top - boxRect.top + targetTextEl.scrollTop;
  const desiredScrollTop = elTopInContent - (targetTextEl.clientHeight / 2) + (elRect.height / 2);

  targetTextEl.scrollTop = Math.max(0, desiredScrollTop);
}

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
      const isCorrect = value[i] === targetText[i];
      span.textContent = isCorrect ? targetText[i] : value[i];
      span.classList.add(isCorrect ? 'correct' : 'incorrect');
    } else {
      span.textContent = targetText[i];
      if (i === committedLength) span.classList.add('current');
    }

    frag.appendChild(span);
  }

  const prevScrollTop = targetTextEl.scrollTop;   // 추가: 다시 그리기 전 스크롤 위치 저장
  targetTextEl.innerHTML = '';
  targetTextEl.appendChild(frag);
  targetTextEl.scrollTop = prevScrollTop;         // 추가: 다시 그린 뒤 스크롤 위치 복원
  keepActiveCharInView();                         // 추가: 현재 글자가 보이도록 스크롤 조정
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

  resultUserInfo.textContent = `${userName} ${userPosition}님의 기록`;
  resultTime.textContent = formatTime(elapsedMs);
  resultCpm.textContent = cpm;
  resultAcc.textContent = acc + '%';
  resultMatch.textContent = matchRate + '%';
  resultMistakes.textContent = wrongStrokes;
  saveStatus.textContent = '';

  hiddenInput.blur();
  showScreen('result');

  // 추가: 스프레드시트로 기록 전송
  saveRecord({
    name: userName,
    position: userPosition,
    elapsedSec: Math.round(elapsedMs / 1000),
    cpm: cpm,
    accuracy: acc,
    matchRate: matchRate,
    mistakes: wrongStrokes,
    completed: hiddenInput.value.length >= targetText.length,
    textPreview: targetText.slice(0, 20),
    textLength: targetText.length
  });
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
screenshotBtn.addEventListener('click', () => {
  screenshotBtn.disabled = true;
  screenshotBtn.textContent = '이미지 생성 중...';

  html2canvas(captureArea, {
    backgroundColor: '#ffffff',
    scale: 2 // 고해상도로 캡처 (기본 1배율은 화질이 다소 떨어짐)
  }).then((canvas) => {
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

   // 파일명: 시간_이름_직급.jpg  (예: 20260922_153045_홍길동_대리.jpg)
   // '시간'은 연습 소요 시간이 아니라 캡처(저장 버튼 클릭)한 시점의 날짜+시각
    const safeTimestamp = formatTimestampForFilename(new Date());
    const safeName = sanitizeForFilename(userName);
    const safePosition = sanitizeForFilename(userPosition);
    const filename = `${safeTimestamp}_${safeName}_${safePosition}.jpg`;

    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }).catch((err) => {
    console.error('스크린샷 생성 실패:', err);
    alert('스크린샷 생성에 실패했습니다. 다시 시도해주세요.');
  }).finally(() => {
    screenshotBtn.disabled = false;
    screenshotBtn.textContent = '스크린샷 저장';
  });
});
retryBtn.addEventListener('click', () => startGame(targetText));
homeBtn.addEventListener('click', () => showScreen('welcome')); // 흐름의 맨 처음(이름/직급 입력)으로 복귀

screens.game.addEventListener('click', () => hiddenInput.focus());

// ---------- 초기화 ----------
document.addEventListener('DOMContentLoaded', () => {
  customText.value = PRESETS[0];
  showScreen('welcome');
});
