/**
 * Alien Stack — Tetris-like with aliens on blocks; crush them for points.
 * Game over when the stack fills past the hidden spawn rows.
 */

const COLS = 10;
const ROWS = 22;
const HIDDEN = 2;
const VISIBLE_ROWS = ROWS - HIDDEN;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const blockImg = new Image();
let blockReady = false;
blockImg.onload = () => {
  blockReady = true;
};
blockImg.onerror = () => {
  blockReady = false;
  console.warn("[Alien Stack] Missing or invalid art/block.png — using flat blocks.");
};
/** Resolves next to index.html (works with file:// and any static host path). */
blockImg.src = new URL("art/block.png", document.baseURI).href;

const previewBlockImg = new Image();
let previewBlockReady = false;
previewBlockImg.onload = () => {
  previewBlockReady = true;
};
previewBlockImg.onerror = () => {
  previewBlockReady = false;
  console.warn("[Alien Stack] Missing art/preview_block.png — ghost uses block.png.");
};
previewBlockImg.src = new URL("art/preview_block.png", document.baseURI).href;

/** Background music (same folder as index.html). Add `bgm.mp3` as alternate name if you rename. */
const BGM_FILES = [
  "Burgundy - Supersonic (freetouse.com).mp3",
  "bgm.mp3",
];
const bgm = new Audio();
bgm.loop = true;
bgm.volume = 0.4;
bgm.preload = "auto";
let bgmFileIndex = 0;
function setBgmSrc(i) {
  if (i >= BGM_FILES.length) return;
  try {
    bgm.src = new URL(encodeURI(BGM_FILES[i]), document.baseURI).href;
    bgmFileIndex = i;
  } catch {
    setBgmSrc(i + 1);
  }
}
bgm.addEventListener("error", () => {
  if (bgmFileIndex + 1 < BGM_FILES.length) {
    setBgmSrc(bgmFileIndex + 1);
  }
});
setBgmSrc(0);

function tryStartBgm() {
  if (!bgm.src) return;
  bgm.play().catch(() => {});
}

function pauseBgm() {
  bgm.pause();
}

window.addEventListener("pointerdown", tryStartBgm, { once: true, passive: true });
window.addEventListener(
  "keydown",
  () => tryStartBgm(),
  { once: true }
);

const bombImg = new Image();
let bombReady = false;
bombImg.onload = () => {
  bombReady = true;
};
bombImg.onerror = () => {
  bombReady = false;
  console.warn("[Alien Stack] Missing art/bomb.png — bombs disabled.");
};
bombImg.src = new URL("art/bomb.png", document.baseURI).href;

const bgImg = new Image();
let bgReady = false;
bgImg.onload = () => {
  bgReady = true;
};
bgImg.onerror = () => {
  bgReady = false;
  console.warn("[Alien Stack] Missing art/background.png — using solid playfield background.");
};
bgImg.src = new URL("art/background.png", document.baseURI).href;

const BG_DIM_ALPHA = 0.3;

/** Five species: art/alien_1.png … art/alien_5.png (underscore). */
const ALIEN_KINDS = 5;
const alienImages = [];
const alienReady = [];
for (let i = 0; i < ALIEN_KINDS; i++) {
  const img = new Image();
  alienImages.push(img);
  alienReady.push(false);
  const n = i + 1;
  img.onload = () => {
    alienReady[i] = true;
  };
  img.onerror = () => {
    alienReady[i] = false;
    console.warn(`[Alien Stack] Missing art/alien_${n}.png — using fallback alien.`);
  };
  img.src = new URL(`art/alien_${n}.png`, document.baseURI).href;
}

const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlaySub = document.getElementById("overlay-sub");
const overlayLbHead = document.getElementById("overlay-lb-head");
const overlayLbList = document.getElementById("overlay-lb-list");
const btnRestart = document.getElementById("btn-restart");

const LB_STORAGE_KEY = "alienStack_monthly_top5";

function leaderboardMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function leaderboardMonthLabel(monthKey) {
  const [ys, ms] = monthKey.split("-");
  const y = Number(ys);
  const m = Number(ms);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function loadMonthlyTop5() {
  const key = leaderboardMonthKey();
  try {
    const raw = localStorage.getItem(LB_STORAGE_KEY);
    if (!raw) return { month: key, scores: [] };
    const data = JSON.parse(raw);
    if (data.month !== key || !Array.isArray(data.scores)) {
      return { month: key, scores: [] };
    }
    return {
      month: key,
      scores: data.scores.filter((n) => typeof n === "number" && Number.isFinite(n)),
    };
  } catch {
    return { month: key, scores: [] };
  }
}

function saveMonthlyTop5(month, scores) {
  try {
    localStorage.setItem(LB_STORAGE_KEY, JSON.stringify({ month, scores }));
  } catch {
    /* private mode / quota */
  }
}

/** Insert this run into the current calendar month’s top 5 (local device). */
function recordMonthlyTop5(finalScore) {
  const key = leaderboardMonthKey();
  const { scores } = loadMonthlyTop5();
  const merged = [...scores, finalScore].sort((a, b) => b - a);
  const next = merged.slice(0, 5);
  saveMonthlyTop5(key, next);
  return { month: key, scores: next };
}

function renderOverlayLeaderboard(data, thisRunScore) {
  if (!overlayLbHead || !overlayLbList) return;
  overlayLbHead.textContent = `Top 5 · ${leaderboardMonthLabel(data.month)}`;
  overlayLbList.replaceChildren();
  for (let i = 0; i < 5; i++) {
    const li = document.createElement("li");
    const rank = document.createElement("span");
    rank.className = "lb-rank";
    rank.textContent = `${i + 1}.`;
    const val = document.createElement("span");
    const s = data.scores[i];
    if (s !== undefined) {
      val.textContent = String(s);
      if (s === thisRunScore) val.classList.add("lb-this-run");
    } else {
      val.textContent = "—";
      val.className = "lb-empty";
    }
    li.appendChild(rank);
    li.appendChild(val);
    overlayLbList.appendChild(li);
  }
}

const COLORS = {
  I: "#5eead4",
  O: "#fbbf24",
  T: "#a78bfa",
  S: "#4ade80",
  Z: "#ff2424",
  J: "#60a5fa",
  L: "#fb923c",
};

const SHAPES = {
  I: [
    [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0], [0, 0, 1, 0]],
    [[0, 0, 0, 0], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0]],
  ],
  O: [
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
  ],
  T: [
    [[0, 1, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
  S: [
    [[0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [0, 1, 1, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
    [[1, 0, 0, 0], [1, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
  Z: [
    [[1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 1, 0], [0, 1, 1, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [1, 1, 0, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
  ],
  J: [
    [[1, 0, 0, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 1, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [0, 0, 1, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [1, 1, 0, 0], [0, 0, 0, 0]],
  ],
  L: [
    [[0, 0, 1, 0], [1, 1, 1, 0], [0, 0, 0, 0], [0, 0, 0, 0]],
    [[0, 1, 0, 0], [0, 1, 0, 0], [0, 1, 1, 0], [0, 0, 0, 0]],
    [[0, 0, 0, 0], [1, 1, 1, 0], [1, 0, 0, 0], [0, 0, 0, 0]],
    [[1, 1, 0, 0], [0, 1, 0, 0], [0, 1, 0, 0], [0, 0, 0, 0]],
  ],
};

const PIECE_IDS = Object.keys(SHAPES);

function cloneMask(m) {
  return m.map((row) => row.slice());
}

/** Rotate 4×4 occupancy 90° CW (matches advancing `rot` in SHAPES). */
function rotateMaskCW(m) {
  const n = 4;
  const o = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (m[r][c]) o[c][n - 1 - r] = 1;
    }
  }
  return o;
}

function countMaskCells(m) {
  let n = 0;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (m[r][c]) n++;
    }
  }
  return n;
}

function createBag() {
  const a = [...PIECE_IDS];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let bag = createBag();
function nextPieceId() {
  if (bag.length === 0) bag = createBag();
  return bag.pop();
}

function emptyBoard() {
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    b[r] = Array(COLS).fill(null);
  }
  return b;
}

let board;
let piece;
let score;
let linesCleared;
let level;
let lastDrop;
let lastAlienSpawn;
let lastAlienShot;
let gameOver;
let paused;
/** @type {{ rows: number[], t0: number } | null} */
let lineClearAnim;
/** @type {{ cx: number, cy: number, t0: number, seeds: number[] } | null} */
let bombExplosionAnim;
/** @type {{ t0: number, mode: "to2" | "to3" | "goal" } | null} */
let stageInterstitial;
let gameStage = 1;
/** Interstitials for reaching 1k / 2.5k already triggered. */
let stageMilestoneShown = [false, false];
/** 45k celebration started / finished (HUD shows Endless only after countdown ends). */
let stageFinalStarted = false;
let stageFinalComplete = false;
let rafId;

const STAGE_TARGETS = [1000, 2500, 45000];
const STAGE_COUNTDOWN_MS = 3000;

function gameplayLocked() {
  return lineClearAnim != null || stageInterstitial != null;
}

function checkStageMilestones() {
  if (gameOver || gameplayLocked()) return;
  if (gameStage === 1 && score >= STAGE_TARGETS[0] && !stageMilestoneShown[0]) {
    stageMilestoneShown[0] = true;
    startStageInterstitial("to2");
  } else if (gameStage === 2 && score >= STAGE_TARGETS[1] && !stageMilestoneShown[1]) {
    stageMilestoneShown[1] = true;
    startStageInterstitial("to3");
  } else if (gameStage === 3 && score >= STAGE_TARGETS[2] && !stageFinalStarted) {
    stageFinalStarted = true;
    startStageInterstitial("goal");
  }
}

function startStageInterstitial(mode) {
  stageInterstitial = { t0: performance.now(), mode };
  pauseBgm();
}

function tickStageInterstitial(t) {
  if (!stageInterstitial || gameOver) return;
  if (t - stageInterstitial.t0 < STAGE_COUNTDOWN_MS) return;
  const mode = stageInterstitial.mode;
  stageInterstitial = null;
  if (mode === "to2") gameStage = 2;
  else if (mode === "to3") gameStage = 3;
  else if (mode === "goal") stageFinalComplete = true;
  tryStartBgm();
  checkStageMilestones();
}

function drawStageInterstitial() {
  if (!stageInterstitial) return;
  const w = canvas.width;
  const h = canvas.height;
  const elapsed = performance.now() - stageInterstitial.t0;
  const secIndex = Math.min(3, Math.floor(elapsed / 1000));
  const countNum = secIndex < 3 ? 3 - secIndex : 0;

  ctx.save();
  ctx.fillStyle = "rgba(5, 8, 14, 0.82)";
  ctx.fillRect(0, 0, w, h);

  const cx = w * 0.5;

  let title = "Stage 2";
  if (stageInterstitial.mode === "to3") title = "Stage 3";
  if (stageInterstitial.mode === "goal") title = "Milestone reached";

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const titlePx = Math.max(15, cellSize * 0.52);
  const countPx = Math.max(36, cellSize * 1.15);
  const stackGap = cellSize * 0.32;

  if (countNum > 0) {
    const blockH = titlePx + stackGap + countPx;
    const midY = h * 0.5;
    const top = midY - blockH * 0.5;
    const titleY = top + titlePx * 0.5;
    const countY = top + titlePx + stackGap + countPx * 0.5;

    ctx.fillStyle = "#e8eef8";
    ctx.font = `800 ${titlePx}px system-ui, sans-serif`;
    ctx.fillText(title, cx, titleY);

    ctx.fillStyle = "#5eead4";
    ctx.font = `900 ${countPx}px system-ui, sans-serif`;
    ctx.fillText(String(countNum), cx, countY);
  } else {
    ctx.fillStyle = "#e8eef8";
    ctx.font = `800 ${titlePx}px system-ui, sans-serif`;
    ctx.fillText(title, cx, h * 0.5);
  }
  ctx.restore();
}

const MAX_ALIENS_BASE = 10;
const MAX_ALIENS_CAP = 18;

function getDropIntervalMs() {
  const base = Math.max(75, 800 - Math.min(725, Math.floor(score / 280) * 42));
  if (score < 4000) return base;
  /** 4000–7999: easier gravity (double interval, capped). */
  if (score < 8000) return Math.min(1500, Math.round(base * 2));
  /** 8000–8499: 50% slower than base. 8500+: 30% slower than base. */
  if (score >= 8500) return Math.round(base * 1.3);
  return Math.round(base * 1.5);
}

function getAlienSpawnIntervalMs() {
  return Math.max(480, 4600 - Math.min(3600, Math.floor(score / 180) * 120));
}

function getMaxAliens() {
  return Math.min(MAX_ALIENS_CAP, MAX_ALIENS_BASE + Math.floor(score / 2000));
}

function getAlienShotIntervalMs() {
  return Math.max(850, 3600 - Math.min(2300, Math.floor(score / 220) * 95));
}
const PTS_ALIEN_CRUSH = 150;
const PTS_ALIEN_LINE = 220;
const PTS_BOMB_ALIEN = 120;
/** Chance to roll a bomb spawn each alien-spawn tick (0–1). */
const BOMB_SPAWN_CHANCE = 0.12;
const BASE_LINE = 100;

const BLOCK_OPACITY = 1;
const GHOST_OPACITY = 0.25;
const LINE_CLEAR_MS = 320;
const BOMB_EXPLOSION_MS = 520;

const SCORE_POP_MS = 900;
const SCORE_POP_COLOR = "#facc15";
const SCORE_POP_SHADOW = "rgba(0, 0, 0, 0.5)";

/** @type {{ gx: number, gy: number, value: number, t0: number }[]} */
let scorePops = [];

/** @type {{ sx: number, sy: number, tx: number, ty: number, t0: number, dur: number }[]} */
let alienProjectiles = [];

function countBoardBombs() {
  let n = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]?.bomb) n++;
    }
  }
  return n;
}

/** Same surface rule as aliens: exposed top of stack; max one bomb on the board. */
function trySpawnBoardBomb() {
  if (!bombReady) return;
  if (Math.random() > BOMB_SPAWN_CHANCE) return;
  if (countBoardBombs() >= 1) return;
  const candidates = [];
  for (let y = HIDDEN; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (!cell || cell.bomb) continue;
      if (cell.alienType != null) continue;
      const above = y > 0 ? board[y - 1][x] : null;
      if (!above) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  board[pick.y][pick.x].bomb = true;
}

/** Grid cell of a board bomb sitting directly under a placed mino (after merge). */
function findTriggeredBombCell(placed) {
  for (const { x, y } of placed) {
    const below = y + 1;
    if (below < 0 || below >= ROWS) continue;
    const cell = board[below][x];
    if (cell?.bomb) return { x, y: below };
  }
  return null;
}

function detonateAllAliensFromBomb() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      if (cell.bomb) cell.bomb = false;
      if (cell.alienType != null) {
        const gained = PTS_BOMB_ALIEN * level;
        cell.alienType = null;
        score += gained;
        spawnAlienScorePop(c, r, gained);
      }
    }
  }
}

/** Remove one board row (the bomb’s row), shift stack down; score like a single line clear. */
function applyBombLineClear(row) {
  if (row < 0 || row >= ROWS) return;
  const remaining = [];
  for (let r = 0; r < ROWS; r++) {
    if (r !== row) remaining.push(board[r]);
  }
  while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
  for (let i = 0; i < ROWS; i++) board[i] = remaining[i];

  const linePts = BASE_LINE * level;
  score += linePts;
  linesCleared += 1;
  level = 1 + Math.floor(linesCleared / 10);
  spawnAlienScorePop(Math.floor(COLS / 2), row, linePts);
}

function startBombExplosionAtCell(col, row) {
  const offsetY = -HIDDEN;
  const cx = (col + 0.5) * cellSize;
  const cy = (row + offsetY) * cellSize + cellSize * 0.5;
  const seeds = [];
  for (let i = 0; i < 16; i++) seeds.push(Math.random());
  bombExplosionAnim = { cx, cy, t0: performance.now(), seeds };
}

function tickBombExplosion(t) {
  if (!bombExplosionAnim) return;
  if (t - bombExplosionAnim.t0 >= BOMB_EXPLOSION_MS) bombExplosionAnim = null;
}

function drawBombExplosion() {
  if (!bombExplosionAnim) return;
  const now = performance.now();
  const u = Math.min(1, (now - bombExplosionAnim.t0) / BOMB_EXPLOSION_MS);
  const { cx, cy, seeds } = bombExplosionAnim;
  const ease = 1 - (1 - u) * (1 - u);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  const flash = (1 - u) * (1 - u);
  if (flash > 0.04) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cellSize * (2.2 + ease * 2));
    g.addColorStop(0, `rgba(255, 255, 240, ${0.55 * flash})`);
    g.addColorStop(0.35, `rgba(255, 200, 80, ${0.35 * flash})`);
    g.addColorStop(0.7, `rgba(255, 80, 40, ${0.12 * flash})`);
    g.addColorStop(1, "rgba(255, 40, 20, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * (2.8 + ease * 3), 0, Math.PI * 2);
    ctx.fill();
  }

  for (let ring = 0; ring < 3; ring++) {
    const ru = Math.max(0, u - ring * 0.12) / (1 - ring * 0.12);
    if (ru <= 0) continue;
    const rad = cellSize * (0.35 + ru * 2.8) + ring * cellSize * 0.35;
    const a = (1 - ru) * (0.5 - ring * 0.12);
    ctx.strokeStyle = `rgba(255, ${180 - ring * 40}, ${60 - ring * 15}, ${a})`;
    ctx.lineWidth = Math.max(2, cellSize * (0.14 - ring * 0.03));
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  const n = seeds.length;
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * Math.PI * 2 + seeds[i] * 0.4;
    const dist = cellSize * (0.2 + ease * (2.4 + seeds[i] * 1.8));
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist;
    const pr = Math.max(2, cellSize * (0.1 * (1 - u) + 0.04));
    const pa = (1 - u) * (0.75 + seeds[i] * 0.25);
    ctx.fillStyle = `rgba(255, ${120 + (i % 5) * 25}, ${40 + (i % 3) * 20}, ${pa})`;
    ctx.beginPath();
    ctx.arc(px, py, pr, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function spawnAlienScorePop(gx, gy, value) {
  scorePops.push({ gx, gy, value, t0: performance.now() });
}

function tickScorePops(t) {
  scorePops = scorePops.filter((p) => t - p.t0 < SCORE_POP_MS);
}

function drawFloatingScorePops() {
  const now = performance.now();
  const offsetY = -HIDDEN;
  const pad = 1;
  const fontPx = Math.max(11, Math.round(cellSize * 0.38));

  for (const p of scorePops) {
    const u = (now - p.t0) / SCORE_POP_MS;
    const sx = p.gx * cellSize + pad;
    const sy = (p.gy + offsetY) * cellSize + pad;
    const w = cellSize - pad * 2;
    const cx = sx + w * 0.5;
    const baseCy = sy - cellSize * 0.2;
    const rise = cellSize * 1.05 * u;
    const alpha = (1 - u) * (1 - u);
    const amt = Math.max(0, Math.round(Math.abs(Number(p.value))));
    const text = "+" + String(amt);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `800 ${fontPx}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = Math.max(1, fontPx * 0.07);
    ctx.strokeStyle = SCORE_POP_SHADOW;
    ctx.strokeText(text, cx, baseCy - rise);
    ctx.fillStyle = SCORE_POP_COLOR;
    ctx.fillText(text, cx, baseCy - rise);
    ctx.restore();
  }
}

function newPiece() {
  const id = nextPieceId();
  piece = {
    id,
    rot: 0,
    x: Math.floor(COLS / 2) - 2,
    y: 0,
    mask: cloneMask(SHAPES[id][0]),
  };
  if (collides(piece, board)) {
    gameOver = true;
    showGameOverOverlay();
  }
}

function cellAt(p, dy, dx) {
  const m = p.mask;
  const cells = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (m[r][c]) cells.push({ x: p.x + c + dx, y: p.y + r + dy });
    }
  }
  return cells;
}

function collides(p, b, dy = 0, dx = 0) {
  const cells = cellAt(p, dy, dx);
  for (const { x, y } of cells) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return true;
    if (b[y][x]) return true;
  }
  return false;
}

function mergePiece() {
  const cells = cellAt(piece, 0, 0);
  for (const { x, y } of cells) {
    if (y >= 0) {
      board[y][x] = { color: COLORS[piece.id], alienType: null, bomb: false };
    }
  }
}

/** Remove aliens orthogonally adjacent to any newly placed cell (crushed by the drop). */
function crushAdjacentAliens(cells) {
  const dirs = [
    [0, 1],
    [0, -1],
    [1, 0],
    [-1, 0],
  ];
  let pts = 0;
  for (const { x, y } of cells) {
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      const cell = board[ny][nx];
      if (cell && cell.alienType != null) {
        const gained = PTS_ALIEN_CRUSH * level;
        cell.alienType = null;
        pts += gained;
        spawnAlienScorePop(nx, ny, gained);
      }
    }
  }
  return pts;
}

function findFullRows() {
  const full = [];
  for (let r = HIDDEN; r < ROWS; r++) {
    if (board[r].every((c) => c)) full.push(r);
  }
  return full;
}

function applyLineClear(full) {
  if (full.length === 0) return;

  let alienBonus = 0;
  const perLineAlien = PTS_ALIEN_LINE * level;
  for (const r of full) {
    for (let col = 0; col < COLS; col++) {
      const c = board[r][col];
      if (c && c.alienType != null) {
        alienBonus += perLineAlien;
        spawnAlienScorePop(col, r, perLineAlien);
      }
    }
  }

  const remaining = [];
  for (let r = 0; r < ROWS; r++) {
    if (!full.includes(r)) remaining.push(board[r]);
  }
  while (remaining.length < ROWS) {
    remaining.unshift(Array(COLS).fill(null));
  }
  for (let i = 0; i < ROWS; i++) {
    board[i] = remaining[i];
  }
  const removed = full.length;

  const linePts = BASE_LINE * removed * removed * level;
  score += linePts + alienBonus;
  linesCleared += removed;
  level = 1 + Math.floor(linesCleared / 10);
}

function stackReachesTop() {
  for (let r = 0; r < HIDDEN; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) return true;
    }
  }
  return false;
}

function listSurfaceAliensWithGun() {
  const list = [];
  for (let y = HIDDEN; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (!cell || cell.alienType == null) continue;
      const above = y > 0 ? board[y - 1][x] : null;
      if (!above) list.push({ x, y });
    }
  }
  return list;
}

function tryAlienShootPiece(t) {
  if (!piece || gameOver || paused || gameplayLocked()) return;
  const shooters = listSurfaceAliensWithGun();
  if (shooters.length === 0) return;
  const targets = cellAt(piece, 0, 0).filter((c) => c.y >= 0);
  if (targets.length === 0) return;
  const s = shooters[Math.floor(Math.random() * shooters.length)];
  const tgt = targets[Math.floor(Math.random() * targets.length)];
  alienProjectiles.push({
    sx: s.x,
    sy: s.y,
    tx: tgt.x,
    ty: tgt.y,
    t0: t,
    dur: 220 + Math.random() * 100,
  });
}

function resolvePieceOverlapAfterDamage() {
  if (!piece) return;
  for (let i = 0; i < 22 && collides(piece, board); i++) {
    piece.y -= 1;
  }
  for (const kick of [-1, 1, -2, 2]) {
    if (!collides(piece, board)) return;
    piece.x += kick;
    if (!collides(piece, board)) return;
    piece.x -= kick;
  }
  for (let i = 0; i < 14 && collides(piece, board); i++) {
    piece.y -= 1;
  }
  if (collides(piece, board)) {
    lockPiece();
  }
}

function applyShotToPieceAt(gridX, gridY) {
  if (!piece) return;
  const hit = piece;
  let removed = false;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      if (!hit.mask[r][c]) continue;
      if (hit.x + c === gridX && hit.y + r === gridY) {
        hit.mask[r][c] = 0;
        removed = true;
        break;
      }
    }
    if (removed) break;
  }
  if (!removed) return;
  resolvePieceOverlapAfterDamage();
  if (!piece || piece !== hit) return;
  if (countMaskCells(piece.mask) === 0) {
    piece = null;
    newPiece();
  }
}

function tickAlienProjectiles(t) {
  for (let i = alienProjectiles.length - 1; i >= 0; i--) {
    const p = alienProjectiles[i];
    if (t - p.t0 >= p.dur) {
      applyShotToPieceAt(p.tx, p.ty);
      alienProjectiles.splice(i, 1);
    }
  }
}

function trySpawnAlien() {
  const candidates = [];
  for (let y = HIDDEN; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const cell = board[y][x];
      if (!cell || cell.alienType != null || cell.bomb) continue;
      const above = y > 0 ? board[y - 1][x] : null;
      if (!above) candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return;
  let count = 0;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]?.alienType != null) count++;
    }
  }
  if (count >= getMaxAliens()) return;
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  board[pick.y][pick.x].alienType = Math.floor(Math.random() * ALIEN_KINDS);
}

function lockPiece() {
  const placed = cellAt(piece, 0, 0).filter((c) => c.y >= 0);
  mergePiece();
  const bombHit = findTriggeredBombCell(placed);
  if (bombHit) {
    startBombExplosionAtCell(bombHit.x, bombHit.y);
    detonateAllAliensFromBomb();
    applyBombLineClear(bombHit.y);
  }
  score += crushAdjacentAliens(placed);
  const full = findFullRows();
  if (full.length > 0) {
    piece = null;
    lineClearAnim = { rows: full, t0: performance.now() };
    return;
  }
  if (stackReachesTop()) {
    gameOver = true;
    showGameOverOverlay();
    return;
  }
  newPiece();
}

function finishLineClearIfDone(t) {
  if (!lineClearAnim || gameOver) return;
  if (t - lineClearAnim.t0 < LINE_CLEAR_MS) return;
  applyLineClear(lineClearAnim.rows);
  lineClearAnim = null;
  if (stackReachesTop()) {
    gameOver = true;
    showGameOverOverlay();
    return;
  }
  newPiece();
}

function tickDrop() {
  if (gameOver || paused || gameplayLocked() || !piece) return;
  if (!collides(piece, board, 1, 0)) {
    piece.y += 1;
  } else {
    lockPiece();
  }
}

function togglePause() {
  if (gameOver || gameplayLocked()) return;
  paused = !paused;
  if (paused) {
    pauseBgm();
  } else {
    const now = performance.now();
    lastDrop = now;
    lastAlienSpawn = now;
    lastAlienShot = now;
    tryStartBgm();
  }
}

function move(dx) {
  if (gameOver || paused || gameplayLocked()) return;
  if (!collides(piece, board, 0, dx)) piece.x += dx;
}

function softDrop() {
  if (gameOver || paused || gameplayLocked()) return;
  if (!collides(piece, board, 1, 0)) {
    piece.y += 1;
    score += 1;
  } else {
    lockPiece();
  }
}

function hardDrop() {
  if (gameOver || paused || gameplayLocked()) return;
  while (!collides(piece, board, 1, 0)) {
    piece.y += 1;
    score += 2;
  }
  lockPiece();
}

function rotate() {
  if (gameOver || paused || gameplayLocked()) return;
  const nextMask = rotateMaskCW(piece.mask);
  const next = {
    ...piece,
    rot: (piece.rot + 1) % 4,
    mask: nextMask,
  };
  if (!collides(next, board)) {
    piece = next;
    return;
  }
  for (const kick of [-1, 1, -2, 2]) {
    const k = { ...next, x: next.x + kick };
    if (!collides(k, board)) {
      piece = k;
      return;
    }
  }
}

let cellSize = 30;

function resizeCanvas() {
  const wrap = canvas.parentElement;
  const maxW = Math.min(wrap.clientWidth - 8, 360);
  cellSize = maxW / COLS;
  canvas.width = COLS * cellSize;
  canvas.height = VISIBLE_ROWS * cellSize;
}

function drawBlock(x, y, color, alienType, ghost = false, bomb = false) {
  const pad = 1;
  const sx = x * cellSize + pad;
  const sy = y * cellSize + pad;
  const w = cellSize - pad * 2;
  const h = cellSize - pad * 2;

  ctx.save();
  ctx.globalAlpha = ghost ? GHOST_OPACITY : BLOCK_OPACITY;

  if (ghost && previewBlockReady) {
    ctx.drawImage(previewBlockImg, sx, sy, w, h);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else if (blockReady) {
    ctx.drawImage(blockImg, sx, sy, w, h);
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, w, h);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(sx, sy, w, h);
  }

  ctx.restore();

  if (!ghost && bomb && bombReady) {
    ctx.save();
    ctx.globalAlpha = BLOCK_OPACITY;
    drawBombOnTop(sx, sy, w);
    ctx.restore();
  }

  if (
    !ghost &&
    Number.isInteger(alienType) &&
    alienType >= 0 &&
    alienType < ALIEN_KINDS
  ) {
    ctx.save();
    ctx.globalAlpha = BLOCK_OPACITY;
    drawAlienOnTop(sx, sy, w, alienType);
    ctx.restore();
  }

  if (!blockReady && !ghost) {
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 0.5, sy + 0.5, w - 1, h - 1);
  }
}

/** Bomb sits above the block like aliens; bottom of sprite meets top of cell (sy). */
function drawBombOnTop(sx, sy, w) {
  const bw = Math.min(w * 1.2, cellSize * 1.15);
  const bh = bw;
  const cx = sx + w * 0.5;
  const top = sy - bh;
  ctx.drawImage(bombImg, cx - bw * 0.5, top, bw, bh);
}

/** Alien sits above the block; light bob / sway so they feel alive. */
function drawAlienOnTop(sx, sy, w, typeIdx) {
  const t = performance.now() * 0.001;
  const phase = sx * 0.045 + sy * 0.036 + typeIdx * 1.15 + t * 2.35;
  const bobY = Math.sin(phase) * (cellSize * 0.058);
  const bobX = Math.cos(phase * 0.88) * (cellSize * 0.026);
  const sway = Math.sin(phase * 1.12) * 0.11;

  const aw = Math.min(w * 1.2, cellSize * 1.15);
  const ah = aw;
  const cx0 = sx + w * 0.5;
  const pivotY = sy - ah * 0.42 + bobY;
  const top = sy - ah + bobY;
  const drawCx = cx0 + bobX;

  ctx.save();
  ctx.translate(drawCx, pivotY);
  ctx.rotate(sway);
  ctx.translate(-drawCx, -pivotY);

  const img = alienImages[typeIdx];
  if (img && alienReady[typeIdx]) {
    ctx.drawImage(img, drawCx - aw * 0.5, top, aw, ah);
  } else {
    drawAlienFallback(drawCx, sy - ah * 0.35 + bobY, Math.min(aw, ah) * 0.38, typeIdx);
  }
  ctx.restore();
}

function drawAlienProjectiles(offsetY) {
  const now = performance.now();
  for (const p of alienProjectiles) {
    const u = Math.min(1, (now - p.t0) / p.dur);
    const e = u * u * (3 - 2 * u);
    const fromX = (p.sx + 0.5) * cellSize;
    const fromY = (p.sy + offsetY) * cellSize - cellSize * 0.42;
    const toX = (p.tx + 0.5) * cellSize;
    const toY = (p.ty + offsetY) * cellSize + cellSize * 0.32;
    const x = fromX + (toX - fromX) * e;
    const y = fromY + (toY - fromY) * e;

    ctx.save();
    ctx.strokeStyle = `rgba(251, 113, 133, ${0.35 + 0.45 * (1 - u)})`;
    ctx.lineWidth = Math.max(2, cellSize * 0.09);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = `rgba(254, 205, 211, ${0.85})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, cellSize * 0.09), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

const FALLBACK_HUES = [125, 195, 275, 38, 305];

function drawAlienFallback(cx, cy, r, typeIdx) {
  const hue = FALLBACK_HUES[typeIdx % FALLBACK_HUES.length];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = `hsl(${hue} 72% 58%)`;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.15, r * 0.85, r * 0.65, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0a0e17";
  ctx.beginPath();
  ctx.arc(-r * 0.32, -r * 0.05, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.32, -r * 0.05, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = `hsl(${hue} 72% 58%)`;
  ctx.lineWidth = r * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.35);
  ctx.lineTo(-r * 0.85, -r * 0.75);
  ctx.moveTo(r * 0.5, -r * 0.35);
  ctx.lineTo(r * 0.85, -r * 0.75);
  ctx.stroke();
  ctx.restore();
}

function drawCanvasBackground() {
  const cw = canvas.width;
  const ch = canvas.height;
  if (bgReady && bgImg.naturalWidth > 0) {
    const iw = bgImg.naturalWidth;
    const ih = bgImg.naturalHeight;
    const scale = Math.max(cw / iw, ch / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(bgImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = "#070b12";
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.fillStyle = `rgba(0, 0, 0, ${BG_DIM_ALPHA})`;
  ctx.fillRect(0, 0, cw, ch);
}

function fillRoundRect(x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
  ctx.fill();
}

/** Score strip at top of playfield: white 50% dim plate behind label + value. */
function drawInGameScore() {
  const label = "Score";
  const num = String(score);
  const padX = Math.max(8, cellSize * 0.32);
  const padY = Math.max(5, cellSize * 0.18);
  const gap = Math.max(6, cellSize * 0.22);

  ctx.save();
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(11, Math.round(cellSize * 0.34))}px system-ui, sans-serif`;
  const wLabel = ctx.measureText(label).width;
  ctx.font = `800 ${Math.max(14, Math.round(cellSize * 0.5))}px system-ui, sans-serif`;
  const wNum = ctx.measureText(num).width;

  const totalW = wLabel + gap + wNum + padX * 2;
  const totalH = Math.max(cellSize * 0.72, padY * 2 + cellSize * 0.46);
  const bx = Math.max(6, cellSize * 0.1);
  const by = Math.max(4, cellSize * 0.08) + 30;
  const rad = Math.min(12, cellSize * 0.28);

  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  fillRoundRect(bx, by, totalW, totalH, rad);

  const cy = by + totalH * 0.5;
  let tx = bx + padX;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
  ctx.font = `600 ${Math.max(11, Math.round(cellSize * 0.34))}px system-ui, sans-serif`;
  ctx.fillText(label, tx, cy);
  tx += wLabel + gap;
  ctx.fillStyle = "#0a0e17";
  ctx.font = `800 ${Math.max(14, Math.round(cellSize * 0.5))}px system-ui, sans-serif`;
  ctx.fillText(num, tx, cy);
  ctx.restore();
}

function draw() {
  drawCanvasBackground();

  const offsetY = -HIDDEN;

  for (let r = HIDDEN; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = board[r][c];
      if (cell) {
        drawBlock(c, r + offsetY, cell.color, cell.alienType, false, !!cell.bomb);
      }
    }
  }

  drawAlienProjectiles(offsetY);

  drawBombExplosion();

  if (lineClearAnim) {
    const u = Math.min(1, (performance.now() - lineClearAnim.t0) / LINE_CLEAR_MS);
    const pulse = Math.sin(u * Math.PI);
    const flashA = 0.18 + pulse * 0.5;
    ctx.fillStyle = `rgba(255, 255, 255, ${flashA})`;
    for (const r of lineClearAnim.rows) {
      const yy = (r + offsetY) * cellSize;
      ctx.fillRect(0, yy, canvas.width, cellSize);
    }
    ctx.strokeStyle = `rgba(110, 231, 255, ${0.25 + pulse * 0.55})`;
    ctx.lineWidth = Math.max(2, cellSize * 0.07);
    for (const r of lineClearAnim.rows) {
      const yy = (r + offsetY) * cellSize;
      const inset = ctx.lineWidth * 0.5;
      ctx.strokeRect(inset, yy + inset, canvas.width - ctx.lineWidth, cellSize - ctx.lineWidth);
    }
  }

  if (!gameOver && piece) {
    const ghost = { ...piece };
    while (!collides(ghost, board, 1, 0)) ghost.y += 1;
    const ghostCells = cellAt(ghost, 0, 0);
    for (const { x, y } of ghostCells) {
      if (y >= HIDDEN) {
        drawBlock(x, y + offsetY, COLORS[piece.id], null, true);
      }
    }
    const live = cellAt(piece, 0, 0);
    for (const { x, y } of live) {
      if (y >= HIDDEN) {
        drawBlock(x, y + offsetY, COLORS[piece.id], null, false);
      }
    }
  }

  if (paused && !gameOver) {
    ctx.fillStyle = "rgba(5, 8, 14, 0.55)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#e8eef8";
    ctx.font = `700 ${Math.max(14, cellSize * 0.55)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("PAUSED", canvas.width * 0.5, canvas.height * 0.45);
    ctx.font = `${Math.max(11, cellSize * 0.28)}px system-ui, sans-serif`;
    ctx.globalAlpha = 0.85;
    ctx.fillText("Esc · long-press canvas", canvas.width * 0.5, canvas.height * 0.55);
    ctx.globalAlpha = 1;
  }

  drawInGameScore();
  drawFloatingScorePops();
  drawStageInterstitial();
}

function loop(t) {
  if (!gameOver && !paused) {
    finishLineClearIfDone(t);
    if (!gameplayLocked()) {
      if (t - lastDrop >= getDropIntervalMs()) {
        tickDrop();
        lastDrop = t;
      }
      if (t - lastAlienSpawn >= getAlienSpawnIntervalMs()) {
        trySpawnAlien();
        trySpawnBoardBomb();
        lastAlienSpawn = t;
      }
      if (t - lastAlienShot >= getAlienShotIntervalMs()) {
        lastAlienShot = t;
        tryAlienShootPiece(t);
      }
      tickAlienProjectiles(t);
    }
  }
  tickStageInterstitial(t);
  if (!gameOver && !paused && !gameplayLocked()) {
    checkStageMilestones();
  }
  tickBombExplosion(t);
  tickScorePops(t);
  draw();
  rafId = requestAnimationFrame(loop);
}

function showGameOverOverlay() {
  paused = false;
  lineClearAnim = null;
  stageInterstitial = null;
  bombExplosionAnim = null;
  alienProjectiles = [];
  pauseBgm();
  const lb = recordMonthlyTop5(score);
  overlayTitle.textContent = "Game over";
  overlaySub.textContent = `Score ${score}`;
  renderOverlayLeaderboard(lb, score);
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

function reset() {
  cancelAnimationFrame(rafId);
  board = emptyBoard();
  bag = createBag();
  score = 0;
  linesCleared = 0;
  level = 1;
  lastDrop = performance.now();
  lastAlienSpawn = performance.now();
  lastAlienShot = performance.now();
  gameOver = false;
  paused = false;
  lineClearAnim = null;
  bombExplosionAnim = null;
  alienProjectiles = [];
  scorePops = [];
  gameStage = 1;
  stageMilestoneShown = [false, false];
  stageFinalStarted = false;
  stageFinalComplete = false;
  stageInterstitial = null;
  hideOverlay();
  newPiece();
  resizeCanvas();
  tryStartBgm();
  rafId = requestAnimationFrame(loop);
}

window.addEventListener("resize", () => {
  resizeCanvas();
});

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (!gameOver) togglePause();
    return;
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (gameOver || paused || gameplayLocked()) return;
    rotate();
    return;
  }
  if (gameOver || paused || gameplayLocked()) return;
  switch (e.code) {
    case "ArrowLeft":
      e.preventDefault();
      move(-1);
      break;
    case "ArrowRight":
      e.preventDefault();
      move(1);
      break;
    case "ArrowDown":
      e.preventDefault();
      hardDrop();
      break;
    case "KeyS":
      e.preventDefault();
      softDrop();
      break;
    case "ArrowUp":
      e.preventDefault();
      break;
    default:
      break;
  }
});

/** Mobile canvas: tap L/R half to move (deferred for double-tap), swipe down hard drop, double-tap rotate, long-press pause. */
let touchGesture = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let pendingMoveTimer = null;
/** @type {ReturnType<typeof setTimeout> | null} */
let longPressTimer = null;
let longPressFired = false;
let lastTapEnd = { t: 0, x: 0, y: 0 };

const TAP_MAX_MS = 380;
const TAP_MAX_MOVE = 24;
const TAP_DEFER_MS = 280;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MAX_DIST = 44;
const SWIPE_DOWN_MIN = 52;
const LONG_PRESS_MS = 600;
const LONG_PRESS_SLOP = 16;

function clearPendingCanvasMove() {
  if (pendingMoveTimer != null) {
    clearTimeout(pendingMoveTimer);
    pendingMoveTimer = null;
  }
}

function canvasClientPos(ev) {
  const r = canvas.getBoundingClientRect();
  const t =
    (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;
  return { cx: t.clientX, cy: t.clientY };
}

canvas.addEventListener(
  "touchstart",
  (e) => {
    if (gameOver || e.touches.length !== 1) return;
    clearPendingCanvasMove();
    const { cx, cy } = canvasClientPos(e);
    touchGesture = { x0: cx, y0: cy, t0: performance.now(), moved: false };
    longPressFired = false;
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    longPressTimer = setTimeout(() => {
      longPressTimer = null;
      if (!touchGesture || touchGesture.moved || gameOver || gameplayLocked()) return;
      longPressFired = true;
      clearPendingCanvasMove();
      if (!gameOver) togglePause();
    }, LONG_PRESS_MS);
  },
  { passive: true }
);

canvas.addEventListener(
  "touchmove",
  (e) => {
    if (!touchGesture || e.touches.length !== 1) return;
    const { cx, cy } = canvasClientPos(e);
    const d = Math.hypot(cx - touchGesture.x0, cy - touchGesture.y0);
    if (d > LONG_PRESS_SLOP) {
      touchGesture.moved = true;
      if (longPressTimer != null) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }
  },
  { passive: true }
);

canvas.addEventListener("touchcancel", () => {
  touchGesture = null;
  longPressFired = false;
  if (longPressTimer != null) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
});

canvas.addEventListener(
  "touchend",
  (e) => {
    if (longPressTimer != null) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    if (longPressFired) {
      longPressFired = false;
      touchGesture = null;
      return;
    }
    if (!touchGesture || gameOver || gameplayLocked()) {
      touchGesture = null;
      return;
    }
    const { cx, cy } = canvasClientPos(e);
    const dx = cx - touchGesture.x0;
    const dy = cy - touchGesture.y0;
    const elapsed = performance.now() - touchGesture.t0;
    touchGesture = null;

    if (dy >= SWIPE_DOWN_MIN && dy > Math.abs(dx) * 1.15 && elapsed < 700) {
      e.preventDefault();
      clearPendingCanvasMove();
      lastTapEnd = { t: 0, x: 0, y: 0 };
      if (!paused) hardDrop();
      return;
    }

    if (elapsed > TAP_MAX_MS || Math.hypot(dx, dy) > TAP_MAX_MOVE) {
      lastTapEnd = { t: 0, x: 0, y: 0 };
      return;
    }

    const now = performance.now();
    const distPrev = Math.hypot(cx - lastTapEnd.x, cy - lastTapEnd.y);
    if (
      lastTapEnd.t > 0 &&
      now - lastTapEnd.t < DOUBLE_TAP_MS &&
      distPrev < DOUBLE_TAP_MAX_DIST
    ) {
      e.preventDefault();
      clearPendingCanvasMove();
      lastTapEnd = { t: 0, x: 0, y: 0 };
      if (!paused) rotate();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dir = cx < rect.left + rect.width * 0.5 ? -1 : 1;
    lastTapEnd = { t: now, x: cx, y: cy };
    pendingMoveTimer = setTimeout(() => {
      pendingMoveTimer = null;
      if (!gameOver && !paused && !gameplayLocked()) move(dir);
      lastTapEnd = { t: 0, x: 0, y: 0 };
    }, TAP_DEFER_MS);
  },
  { passive: false }
);

canvas.addEventListener("dblclick", (e) => {
  e.preventDefault();
  if (!gameOver && !paused && !gameplayLocked()) hardDrop();
});

btnRestart.addEventListener("click", reset);

reset();
