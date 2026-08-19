/* ------------------------------------------------------------------
   Space Invaders Knockoff - Full Boss System Edition
   Created by Ben Ellis  (original: Python / pygame)
   Browser port of the original game logic.
------------------------------------------------------------------ */
"use strict";

const W = 900, H = 600;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const WHITE = "#ffffff", BLACK = "#000000", GRAY = "#646464",
      DARK_GRAY = "#323232", RED = "#ff0000";

const ALIEN_COLORS = ["yellow", "red", "purple", "green", "orange", "blue"];
const ALIEN_VERSIONS = ["a", "b", "c"];
const BOSS_TYPES = ["juggernaut", "hive_mother", "teleporter", "laser_core", "bomber"];
const BOSS_SPRITES = {
  juggernaut:  ["red", "a"],
  hive_mother: ["green", "c"],
  teleporter:  ["purple", "b"],
  laser_core:  ["blue", "c"],
  bomber:      ["orange", "a"],
};
const BOSS_SCALE_FACTOR = 3;
const BOSS_LEVEL_INTERVAL = 5;
const BOSS_Y_POSITION = Math.max(20, Math.floor(H * 0.08));

const rnd     = (a, b) => Math.random() * (b - a) + a;
const rndInt  = (a, b) => Math.floor(rnd(a, b + 1));
const choice  = arr => arr[Math.floor(Math.random() * arr.length)];
const now     = () => performance.now();

/* ---------------- asset loading ---------------- */

const IMG = {};
const SND = {};
let assetsTotal = 0, assetsDone = 0;

function loadImage(key, src) {
  assetsTotal++;
  return new Promise(res => {
    const i = new Image();
    i.onload  = () => { IMG[key] = i; assetsDone++; res(); };
    i.onerror = () => { assetsDone++; console.warn("missing image", src); res(); };
    i.src = src;
  });
}

function loadSound(key, src, opts = {}) {
  assetsTotal++;
  return new Promise(res => {
    const a = new Audio();
    a.preload = "auto";
    a.loop = !!opts.loop;
    a.volume = opts.volume ?? 1;
    const done = () => { assetsDone++; res(); };
    a.oncanplaythrough = () => { if (!SND[key]) { SND[key] = a; done(); } };
    a.onerror = () => { console.warn("missing sound", src); done(); };
    SND[key] = a;
    a.src = src;
    // Never let a stalled audio file block the whole game from starting.
    setTimeout(() => { if (assetsDone < assetsTotal) done(); }, 4000);
  });
}

function play(key) {
  const s = SND[key];
  if (!s || muted) return;
  try { s.currentTime = 0; s.play().catch(() => {}); } catch (e) {}
}
function stopSound(key) {
  const s = SND[key];
  if (!s) return;
  try { s.pause(); s.currentTime = 0; } catch (e) {}
}
function playMusic(key) {
  stopSound("music_menu"); stopSound("music_game");
  const s = SND[key];
  if (!s || muted) return;
  s.loop = true;
  try { s.currentTime = 0; s.play().catch(() => {}); } catch (e) {}
}
function stopMusic() { stopSound("music_menu"); stopSound("music_game"); }

// Death / alarm / laser are one-shots that outlive a run if you bail out mid-way,
// so anything that returns to the menu must silence them explicitly.
function stopAllSfx() {
  stopSound("death"); stopSound("boss_alarm");
  stopSound("laser"); stopSound("ship_dmg"); stopSound("shoot");
}

function returnToMenu() {
  stopMusic();
  stopAllSfx();
  G.state = STATE.MENU;
  playMusic("music_menu");
}

async function loadAll(progress) {
  const jobs = [];
  for (const c of ALIEN_COLORS)
    for (const v of ALIEN_VERSIONS)
      for (let n = 1; n <= 3; n++)
        jobs.push(loadImage(`alien_${c}_${v}_${n}`, `assets/aliens/xenis-${c}-${v}-${n}.png`));

  // The Python original loads only redfighter000N.png (the red ship). The
  // redfighternormal000N.png files exist in the repo but are never used, so
  // they are not loaded here either.
  for (let n = 1; n <= 9; n++)
    jobs.push(loadImage(`ship_${n}`, `assets/player/redfighter000${n}.png`));

  jobs.push(loadImage("bg", "assets/background/SpaceBg.png"));
  jobs.push(loadImage("player_bullet", "assets/explosions/player_bullet.png"));
  jobs.push(loadImage("alien_bullet",  "assets/explosions/alien_bullet.png"));
  for (const l of ["a", "b", "c", "d", "e"])
    jobs.push(loadImage(`bomb_${l}`, `assets/explosions/bomb-${l}.png`));

  jobs.push(loadSound("music_menu", "assets/audio/main_menu_music.ogg", {loop: true, volume: 0.5}));
  jobs.push(loadSound("music_game", "assets/audio/game_music.ogg",      {loop: true, volume: 0.5}));
  jobs.push(loadSound("boss_alarm", "assets/audio/boss_alarm.ogg"));
  jobs.push(loadSound("laser",      "assets/audio/lazer_boss.ogg"));
  jobs.push(loadSound("shoot",      "assets/audio/player_ship.ogg", {volume: 0.6}));
  jobs.push(loadSound("death",      "assets/audio/death_audio.ogg"));
  jobs.push(loadSound("ship_dmg",   "assets/audio/ship_dmg.ogg"));

  const tick = setInterval(() => progress(assetsDone, assetsTotal), 60);
  await Promise.all(jobs);
  clearInterval(tick);
  progress(assetsTotal, assetsTotal);
}

/* ---------------- drawing helpers ---------------- */

function scaledSize(img, targetW) {
  const r = img.height / img.width;
  return [targetW, Math.round(targetW * r)];
}
function drawImg(img, x, y, w, h) {
  if (!img) return;
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}
function text(str, x, y, size, color, align = "left") {
  ctx.font = `${size}px "Courier New", monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, x, y);
  ctx.textAlign = "left";
}
function neonText(str, cx, y, size, base) {
  ctx.font = `bold ${size}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.save();
  ctx.shadowColor = base;
  ctx.shadowBlur = 18;
  ctx.fillStyle = base;
  ctx.fillText(str, cx, y);
  ctx.shadowBlur = 8;
  ctx.fillStyle = WHITE;
  ctx.fillText(str, cx, y);
  ctx.restore();
  ctx.textAlign = "left";
}

/* ---------------- input ---------------- */

const keys = {};
addEventListener("keydown", e => {
  keys[e.code] = true;
  if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
});
addEventListener("keyup", e => { keys[e.code] = false; });

const touch = { left: false, right: false, fire: false };
const mouse = { x: 0, y: 0, clicked: false };

canvas.addEventListener("mousemove", e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
});
canvas.addEventListener("click", e => {
  const r = canvas.getBoundingClientRect();
  mouse.x = (e.clientX - r.left) * (W / r.width);
  mouse.y = (e.clientY - r.top) * (H / r.height);
  mouse.clicked = true;
});

let muted = false;

/* ---------------- buttons ---------------- */

function Button(label, x, y, w, h) {
  return { label, x, y, w, h };
}
function drawButton(b) {
  const hover = mouse.x >= b.x && mouse.x <= b.x + b.w && mouse.y >= b.y && mouse.y <= b.y + b.h;
  ctx.fillStyle = hover ? DARK_GRAY : GRAY;
  ctx.fillRect(b.x, b.y, b.w, b.h);
  text(b.label, b.x + b.w / 2, b.y + b.h / 2 + 12, 32, WHITE, "center");
}
function clickedButton(b) {
  return mouse.clicked && mouse.x >= b.x && mouse.x <= b.x + b.w &&
         mouse.y >= b.y && mouse.y <= b.y + b.h;
}
function drawVolume() {
  ctx.beginPath();
  ctx.arc(W - 60, 50, 20, 0, Math.PI * 2);
  ctx.fillStyle = muted ? DARK_GRAY : GRAY;
  ctx.fill();
  text("Vol", W - 60, 57, 20, WHITE, "center");
}
function clickedVolume() {
  return mouse.clicked && Math.abs(mouse.x - (W - 60)) < 22 && Math.abs(mouse.y - 50) < 22;
}

/* ------------------------------------------------------------------
   Speeds are in pixels per second. The original ran at clock.tick(120)
   with per-frame values, so each has been multiplied by 120 to keep the
   same feel while running frame-rate independently here.
------------------------------------------------------------------ */
// The original scales every sprite to a target WIDTH keeping aspect ratio
// (scale_image_keep_aspect). Sizing from the raw PNG instead makes the boss
// roughly 3x too large, so these mirror the Python target widths exactly.
const ALIEN_W = 50, ALIEN_H = Math.round(50 * 150 / 120);   // source 120x150
const PLAYER_W = 70, PLAYER_H = Math.round(70 * 383 / 343); // source 343x383
const BOMB_W = 60, BOMB_H = 60;                             // source 200x200

const PLAYER_SPEED   = 4 * 120;
const BULLET_SPEED   = 4 * 120;
const ENEMY_DROP     = 10;
const SHOT_COOLDOWN  = 600;
const PREFIRE_MS     = 430;

const STATE = {
  LOADING: "loading", MENU: "menu", BOSSSELECT: "bossselect",
  BOSSINTRO: "bossintro", PLAYING: "playing",
  LEVELDONE: "leveldone", GAMEOVER: "gameover",
};

const G = {
  state: STATE.LOADING,
  loadPct: 0,
  level: 1,
  lives: 3,
  score: 0,
};

const menuButtons = {
  play: Button("Play",        W / 2 - 100, 200, 200, 50),
  boss: Button("Boss Select", W / 2 - 100, 280, 200, 50),
};
let bossSelectButtons = [];

/* ---------------- run state ---------------- */

let R = null;

function alienFrames(color, version) {
  return [1, 2, 3].map(n => IMG[`alien_${color}_${version}_${n}`]);
}

function newRun(startBoss) {
  const pw = PLAYER_W, ph = PLAYER_H;

  R = {
    alienW: ALIEN_W,
    alienH: ALIEN_H,
    enemies: [],
    enemyDir: 1,
    enemySpeed: 1 * 120,
    levelVersion: choice(ALIEN_VERSIONS),

    pw, ph,
    px: W / 2 - pw / 2,
    py: H - ph - 10,
    playerFrame: 0,
    playerAnimT: 0,
    playerAnimDir: 1,

    bullets: [],
    alienBullets: [],
    explosions: [],

    lastShot: 0,
    nextAlienShot: now() + rndInt(500, 1500),

    invulnerable: false,
    invulnUntil: 0,
    blinkT: 0,
    visible: true,
    dead: false,
    deathAt: 0,

    bossActive: false,
    bossType: null,
    bossHP: 0, bossMaxHP: 0,
    bossRect: null,
    bossDir: 1,
    bossSpeed: 2 * 120,
    bossAttackT: now(),
    bossInterval: 1200,
    bossColor: null, bossVersion: null,
    teleportT: now(),
    minions: [],

    laserWarn: false, laserOn: false, laserFollow: false,
    laserWarnAt: 0, laserFireAt: 0, laserX: W / 2,
  };

  if (startBoss) {
    startBossFight(startBoss, true);
  } else {
    spawnEnemies();
  }
}

function spawnEnemies() {
  R.enemies = [];
  const rows = Math.min(2 + Math.floor(G.level / 5), 6);
  const perRow = 9, sx = 80, sy = 60;
  const startX = (W - (perRow - 1) * sx) / 2;
  const startY = 50;
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < perRow; col++)
      R.enemies.push({
        x: startX + col * sx - R.alienW / 2,
        y: startY + row * sy,
        color: choice(ALIEN_COLORS),
        version: R.levelVersion,
        frame: 0,
        preFiring: false,
        preFireAt: 0,
        pendingType: null,
      });
}

function startBossFight(type, fromSelect) {
  R.bossActive = true;
  R.bossType = type;
  R.bossHP = type === "juggernaut" ? 120 : 60;
  R.bossMaxHP = R.bossHP;
  R.bossSpeed = (type === "juggernaut" ? 1 : 2) * 120;
  R.bossRect = null;
  R.enemies = [];
  R.minions = [];
  R.laserWarn = R.laserOn = false;
  [R.bossColor, R.bossVersion] = BOSS_SPRITES[type];
  R.teleportT = now();
  R.bossAttackT = now();
  if (fromSelect) G.level = 0;
}

/* ---------------- boss intro ---------------- */

let introStart = 0, introBoss = null;
function beginBossIntro(type) {
  introBoss = type;
  introStart = now();
  stopMusic();
  play("boss_alarm");
  G.state = STATE.BOSSINTRO;
}
function drawBossIntro(t) {
  const el = t - introStart;
  ctx.fillStyle = BLACK;
  ctx.fillRect(0, 0, W, H);
  const flash = Math.floor(el / 250) % 2 === 0;
  const title = introBoss.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  neonText("WARNING", W / 2, H / 2 - 60, 52, flash ? "#ff2222" : "#661111");
  neonText(title, W / 2, H / 2 + 20, 46, "#ffcc00");
  text("BOSS INCOMING", W / 2, H / 2 + 70, 24, "#8fa1b3", "center");
  if (el > 2600) {
    startBossFight(introBoss, false);
    playMusic("music_game");
    G.state = STATE.PLAYING;
  }
}

/* ---------------- player ---------------- */

function damagePlayer(t) {
  if (R.invulnerable) return;
  play("ship_dmg");
  G.lives--;
  R.px = W / 2 - R.pw / 2;
  R.invulnerable = true;
  R.invulnUntil = t + 3000;
  R.blinkT = t;
  if (G.lives <= 0) killPlayer(t);
}

function killPlayer(t) {
  if (R.dead) return;
  stopMusic();
  stopSound("boss_alarm"); stopSound("laser");
  play("death");
  R.dead = true;
  R.deathAt = t;
}

function updatePlayer(t, dt) {
  if (R.dead) return;

  const left  = keys.ArrowLeft  || keys.KeyA || touch.left;
  const right = keys.ArrowRight || keys.KeyD || touch.right;
  if (left)  R.px -= PLAYER_SPEED * dt;
  if (right) R.px += PLAYER_SPEED * dt;
  R.px = Math.max(0, Math.min(W - R.pw, R.px));

  const firing = keys.Space || keys.KeyW || keys.ArrowUp || touch.fire;
  if (firing && t - R.lastShot > SHOT_COOLDOWN) {
    R.lastShot = t;
    play("shoot");
    R.bullets.push([R.px + R.pw / 2 - 2.5, R.py]);
  }

  // ship animation cycles back and forth through its frames
  R.playerAnimT += dt;
  if (R.playerAnimT > 0.06) {
    R.playerAnimT = 0;
    R.playerFrame += R.playerAnimDir;
    if (R.playerFrame >= 8) { R.playerFrame = 8; R.playerAnimDir = -1; }
    if (R.playerFrame <= 0) { R.playerFrame = 0; R.playerAnimDir = 1; }
  }

  if (R.invulnerable) {
    if (t > R.invulnUntil) { R.invulnerable = false; R.visible = true; }
    else if (t - R.blinkT > 120) { R.blinkT = t; R.visible = !R.visible; }
  }
}

function drawPlayer() {
  if (R.dead || (R.invulnerable && !R.visible)) return;
  const img = IMG[`ship_${R.playerFrame + 1}`] || IMG.ship_1;
  drawImg(img, R.px, R.py, R.pw, R.ph);
}

/* ---------------- enemies ---------------- */

function moveEnemies(dt) {
  if (!R.enemies.length) return;
  for (const e of R.enemies) e.x += R.enemySpeed * R.enemyDir * dt;

  const xs = R.enemies.map(e => e.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs) + R.alienW;

  // Bounce only when actually heading INTO the wall, and push the wave back
  // inside on the same frame. Both guards matter: on a high-refresh display
  // each frame moves the wave less than a pixel, so a plain "are we past the
  // edge?" test stays true frame after frame, flipping and dropping every
  // frame - the wave appears to plummet. This can only drop once per contact.
  if (R.enemyDir > 0 && maxX > W) {
    const over = maxX - W;
    for (const e of R.enemies) { e.x -= over; e.y += ENEMY_DROP; }
    R.enemyDir = -1;
  } else if (R.enemyDir < 0 && minX < 0) {
    const over = -minX;
    for (const e of R.enemies) { e.x += over; e.y += ENEMY_DROP; }
    R.enemyDir = 1;
  }
}

function scheduleAlienShot(t) {
  if (!R.enemies.length) return;
  const s = choice(R.enemies);
  if (s.preFiring) return;
  s.preFiring = true;
  s.preFireAt = t;
  s.pendingType = Math.random() < 0.1 ? "green" : "red";
  s.frame = 0;
}

function updateEnemies(t) {
  for (const e of R.enemies) {
    if (!e.preFiring) continue;
    const el = t - e.preFireAt;
    if (el < PREFIRE_MS) {
      e.frame = Math.min(Math.floor((el / PREFIRE_MS) * 3), 2);
    } else {
      e.preFiring = false;
      e.frame = 0;
      R.alienBullets.push({
        x: e.x + R.alienW / 2, y: e.y + R.alienH,
        type: e.pendingType,
      });
      e.pendingType = null;
    }
  }
}

function drawEnemies() {
  for (const e of R.enemies) {
    const f = alienFrames(e.color, e.version)[e.frame] || alienFrames(e.color, e.version)[0];
    drawImg(f, e.x, e.y, R.alienW, R.alienH);
  }
}

/* ---------------- bullets ---------------- */

function updateBullets(t, dt) {
  // player bullets
  for (let i = R.bullets.length - 1; i >= 0; i--) {
    R.bullets[i][1] -= BULLET_SPEED * dt;
    if (R.bullets[i][1] < -20) R.bullets.splice(i, 1);
  }

  // alien bullets
  for (let i = R.alienBullets.length - 1; i >= 0; i--) {
    const b = R.alienBullets[i];
    b.y += BULLET_SPEED * dt;

    if (b.type === "green") {
      if (b.x < R.px) b.x += 120 * dt;
      else if (b.x > R.px) b.x -= 120 * dt;
    }

    if (b.y > H + 40) { R.alienBullets.splice(i, 1); continue; }

    // green / bomber bombs detonate at the player's row
    if (b.type === "green" || b.type === "bomber_green") {
      const bombH = b.type === "bomber_green" ? BOMB_H * 3 : BOMB_H * 1.4;
      if (b.y + bombH / 2 >= R.py) {
        const cx = b.x, cy = R.py + R.ph / 2;
        R.explosions.push({ x: cx, y: cy, frame: 0, timer: 0, type: b.type });
        R.alienBullets.splice(i, 1);
        const radius = b.type === "bomber_green" ? 90 : 40;
        const dx = Math.abs(cx - (R.px + R.pw / 2));
        const dy = Math.abs(cy - (R.py + R.ph / 2));
        if (dx <= R.pw / 2 + radius && dy <= R.ph / 2 + radius) damagePlayer(t);
        continue;
      }
    } else if (!R.invulnerable && !R.dead) {
      // red bullets hit on contact
      if (b.x > R.px && b.x < R.px + R.pw && b.y > R.py && b.y < R.py + R.ph) {
        R.alienBullets.splice(i, 1);
        damagePlayer(t);
        continue;
      }
    }
  }
}

function drawBullets() {
  for (const b of R.bullets) drawImg(IMG.player_bullet, b[0], b[1], 6, 14);

  for (const b of R.alienBullets) {
    if (b.type === "bomber_green") {
      const w = BOMB_W * 3, h = BOMB_H * 3;
      drawImg(IMG.bomb_a, b.x - w / 2, b.y - h / 2, w, h);
    } else if (b.type === "green") {
      const w = BOMB_W * 1.4, h = BOMB_H * 1.4;
      drawImg(IMG.bomb_a, b.x - w / 2, b.y - h / 2, w, h);
    } else {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = RED;
      ctx.fill();
    }
  }
}

function drawExplosions() {
  const frames = ["bomb_a", "bomb_b", "bomb_c", "bomb_d", "bomb_e"];
  for (let i = R.explosions.length - 1; i >= 0; i--) {
    const ex = R.explosions[i];
    ex.timer++;
    if (ex.timer >= 8) { ex.timer = 0; ex.frame++; }
    if (ex.frame >= frames.length) { R.explosions.splice(i, 1); continue; }
    const img = IMG[frames[ex.frame]];
    if (!img) continue;
    const scale = ex.type === "bomber_green" ? 2.8 : 1.5;
    const w = BOMB_W * scale, h = BOMB_H * scale;
    drawImg(img, ex.x - w / 2, ex.y - h / 2, w, h);
  }
}

/* ---------------- boss ---------------- */

function updateBoss(t, dt) {
  if (!R.bossActive) return;

  if (!R.bossRect) {
    const w = ALIEN_W * BOSS_SCALE_FACTOR;
    const h = ALIEN_H * BOSS_SCALE_FACTOR;
    R.bossRect = { x: W / 2 - w / 2, y: BOSS_Y_POSITION, w, h };
    R.teleportT = t;
  }
  const B = R.bossRect;

  if (R.bossType !== "teleporter") {
    B.x += R.bossSpeed * R.bossDir * dt;
    if (B.x + B.w >= W || B.x <= 0) R.bossDir *= -1;
  } else if (t - R.teleportT > 1500) {
    R.teleportT = t;
    B.x = rndInt(50, W - 50 - B.w);
  }

  // attacks
  if (t - R.bossAttackT > R.bossInterval) {
    R.bossAttackT = t;
    const cx = B.x + B.w / 2, bottom = B.y + B.h;

    if (R.bossType === "juggernaut") {
      for (const off of [-40, 0, 40])
        R.alienBullets.push({ x: cx + off, y: bottom, type: "red" });

    } else if (R.bossType === "bomber") {
      R.bossInterval = 1200;
      R.alienBullets.push({ x: cx, y: bottom, type: "bomber_green" });

    } else if (R.bossType === "teleporter") {
      R.alienBullets.push({ x: cx, y: bottom, type: "red" });

    } else if (R.bossType === "laser_core") {
      R.laserWarn = true;
      R.laserOn = false;
      R.laserWarnAt = t;
      if (Math.random() < 0.6) {
        R.laserFollow = false;
        R.laserX = R.px + R.pw / 2;   // lock on to where the player is now
      } else {
        R.laserFollow = true;         // beam tracks the boss instead
        R.laserX = cx;
      }

    } else if (R.bossType === "hive_mother") {
      if (R.minions.length < 8)
        R.minions.push({
          angle: rnd(0, 360), distance: 140,
          color: choice(ALIEN_COLORS), version: choice(ALIEN_VERSIONS),
          shotT: t,
        });
    }
  }

  // laser core beam
  if (R.bossType === "laser_core") {
    if (R.laserWarn) {
      if (R.laserFollow) R.laserX = B.x + B.w / 2;
      if (t - R.laserWarnAt >= 800) {
        R.laserWarn = false;
        R.laserOn = true;
        R.laserFireAt = t;
        play("laser");
      }
    }
    if (R.laserOn) {
      if (R.laserFollow) R.laserX = B.x + B.w / 2;
      if (!R.invulnerable && !R.dead &&
          R.px <= R.laserX && R.laserX <= R.px + R.pw) damagePlayer(t);
      if (t - R.laserFireAt >= 1600) R.laserOn = false;
    }
  }

  // hive mother minions
  if (R.bossType === "hive_mother") {
    for (let i = R.minions.length - 1; i >= 0; i--) {
      const m = R.minions[i];
      m.angle += 48 * dt;
      const rad = m.angle * Math.PI / 180;
      m.x = B.x + B.w / 2 + Math.cos(rad) * m.distance;
      m.y = Math.min(B.y + B.h / 2 + Math.sin(rad) * m.distance, H * 0.45);
      if (t - m.shotT > 1200) {
        m.shotT = t;
        R.alienBullets.push({
          x: m.x + R.alienW / 2, y: m.y + R.alienH / 2,
          type: choice(["red", "green"]),
        });
      }
      for (let j = R.bullets.length - 1; j >= 0; j--) {
        const bl = R.bullets[j];
        if (bl[0] > m.x && bl[0] < m.x + R.alienW && bl[1] > m.y && bl[1] < m.y + R.alienH) {
          R.bullets.splice(j, 1);
          R.minions.splice(i, 1);
          G.score += 25;
          break;
        }
      }
    }
  }
}

function drawBoss(t) {
  if (!R.bossActive || !R.bossRect) return;
  const B = R.bossRect;

  if (R.bossType === "laser_core") {
    if (R.laserWarn) {
      ctx.strokeStyle = "#00ffff"; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(R.laserX, B.y + B.h); ctx.lineTo(R.laserX, H); ctx.stroke();
    }
    if (R.laserOn) {
      ctx.strokeStyle = RED; ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(R.laserX, B.y + B.h); ctx.lineTo(R.laserX, H); ctx.stroke();
    }
  }

  for (const m of R.minions)
    drawImg(alienFrames(m.color, m.version)[0], m.x, m.y, R.alienW, R.alienH);

  const el = t - R.bossAttackT;
  const idx = el < 200 ? 0 : el < 400 ? 1 : 2;
  drawImg(alienFrames(R.bossColor, R.bossVersion)[idx], B.x, B.y, B.w, B.h);

  // hp bar
  const bw = 300, bh = 14, bx = W / 2 - bw / 2, by = 12;
  ctx.fillStyle = "#3a1111"; ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = "#ff3b3b";
  ctx.fillRect(bx, by, bw * Math.max(0, R.bossHP / R.bossMaxHP), bh);
  ctx.strokeStyle = "#772222"; ctx.lineWidth = 2; ctx.strokeRect(bx, by, bw, bh);
  text(R.bossType.replace(/_/g, " ").toUpperCase(), W / 2, by + bh + 20, 18, "#ffb4b4", "center");
}

/* ---------------- collisions ---------------- */

function collisions(t) {
  // player bullets vs normal aliens
  for (let i = R.bullets.length - 1; i >= 0; i--) {
    const b = R.bullets[i];
    let hit = false;
    for (let j = R.enemies.length - 1; j >= 0; j--) {
      const e = R.enemies[j];
      if (b[0] > e.x && b[0] < e.x + R.alienW && b[1] > e.y && b[1] < e.y + R.alienH) {
        R.explosions.push({ x: e.x + R.alienW / 2, y: e.y + R.alienH / 2, frame: 0, timer: 0 });
        R.enemies.splice(j, 1);
        R.bullets.splice(i, 1);
        G.score += 10;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // player bullets vs boss
    if (R.bossActive && R.bossRect) {
      const B = R.bossRect;
      if (b[0] > B.x && b[0] < B.x + B.w && b[1] > B.y && b[1] < B.y + B.h) {
        R.bullets.splice(i, 1);
        R.bossHP--;
        G.score += 5;
        if (R.bossHP <= 0) {
          R.explosions.push({ x: B.x + B.w / 2, y: B.y + B.h / 2, frame: 0, timer: 0, type: "bomber_green" });
          R.bossActive = false;
          R.bossRect = null;
          R.minions = [];
          R.laserOn = R.laserWarn = false;
          G.score += 250;
          G.state = STATE.LEVELDONE;
          levelDoneAt = t;
          levelDoneLabel = "BOSS DEFEATED";
        }
      }
    }
  }

  // aliens reaching the player
  for (const e of R.enemies) {
    if (e.y + R.alienH >= R.py && !R.dead) { killPlayer(t); break; }
  }

  // wave cleared
  if (!R.bossActive && R.enemies.length === 0 && G.state === STATE.PLAYING) {
    G.state = STATE.LEVELDONE;
    levelDoneAt = t;
    levelDoneLabel = "LEVEL COMPLETE";
  }
}

let levelDoneAt = 0, levelDoneLabel = "";

function nextLevel(t) {
  G.level++;
  if (G.level % BOSS_LEVEL_INTERVAL === 0) {
    beginBossIntro(choice(BOSS_TYPES));
    return;
  }
  R.enemySpeed += 0.2 * 120;
  R.levelVersion = choice(ALIEN_VERSIONS);
  spawnEnemies();
  G.state = STATE.PLAYING;
}

/* ---------------- HUD ---------------- */

function drawHUD() {
  // level 0 means the run was started from Boss Select, matching the original
  text(G.level === 0 ? "Boss Rush" : `Level ${G.level}`, 16, 28, 22, "#4ade80");
  text(`Score ${G.score}`, 16, 54, 22, "#38bdf8");
  text(`Lives ${Math.max(0, G.lives)}`, W - 16, 28, 22, G.lives > 1 ? "#d7e1ec" : "#ff6b6b", "right");
}

/* ---------------- screens ---------------- */

function drawBackground() {
  if (IMG.bg) drawImg(IMG.bg, 0, 0, W, H);
  else { ctx.fillStyle = "#05070d"; ctx.fillRect(0, 0, W, H); }
}

function drawMenu() {
  ctx.fillStyle = BLACK; ctx.fillRect(0, 0, W, H);
  neonText("Space Invaders Knockoff", W / 2, 110, 40, "#00b4ff");
  text("by Ben Ellis", W / 2, 145, 20, "#8fa1b3", "center");
  drawButton(menuButtons.play);
  drawButton(menuButtons.boss);
  drawVolume();
  text("Arrow keys / A D to move    -    Space to fire    -    Esc to quit",
       W / 2, H - 40, 18, "#66788a", "center");

  if (clickedVolume()) muted = !muted, applyMute();
  if (clickedButton(menuButtons.play)) {
    G.level = 1; G.lives = 3; G.score = 0;
    newRun(null);
    playMusic("music_game");
    G.state = STATE.PLAYING;
  }
  if (clickedButton(menuButtons.boss)) {
    buildBossButtons();
    G.state = STATE.BOSSSELECT;
  }
}

function buildBossButtons() {
  bossSelectButtons = BOSS_TYPES.map((b, i) =>
    Object.assign(Button(b.replace(/_/g, " "), W / 2 - 140, 140 + i * 62, 280, 48), { boss: b }));
  bossSelectButtons.push(Object.assign(Button("Back", W / 2 - 70, 470, 140, 44), { boss: null }));
}

function drawBossSelect() {
  ctx.fillStyle = BLACK; ctx.fillRect(0, 0, W, H);
  neonText("Boss Select", W / 2, 90, 36, "#ffcc00");
  for (const b of bossSelectButtons) drawButton(b);
  drawVolume();
  if (clickedVolume()) muted = !muted, applyMute();
  for (const b of bossSelectButtons) {
    if (clickedButton(b)) {
      if (b.boss === null) { G.state = STATE.MENU; return; }
      G.level = 0; G.lives = 3; G.score = 0;
      newRun(b.boss);
      playMusic("music_game");
      G.state = STATE.PLAYING;
      return;
    }
  }
}

function drawLevelDone(t) {
  drawBackground();
  drawPlayer();
  neonText(levelDoneLabel, W / 2, H / 2 - 20, 44, "#4ade80");
  text("press Enter to continue", W / 2, H / 2 + 30, 22, "#d7e1ec", "center");
  if (keys.Enter || keys.NumpadEnter || mouse.clicked) nextLevel(t);
}

function drawGameOver() {
  ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0, 0, W, H);
  neonText("GAME OVER", W / 2, H / 2 - 30, 52, "#ff3b3b");
  text(`Final score: ${G.score}     Level reached: ${G.level}`, W / 2, H / 2 + 20, 24, "#d7e1ec", "center");
  text("press Enter for the menu", W / 2, H / 2 + 60, 20, "#8fa1b3", "center");
  if (keys.Enter || keys.NumpadEnter || mouse.clicked) returnToMenu();
}

function applyMute() {
  for (const k in SND) {
    if (!SND[k]) continue;
    if (muted) { try { SND[k].pause(); } catch (e) {} }
  }
  if (!muted) {
    if (G.state === STATE.MENU || G.state === STATE.BOSSSELECT) playMusic("music_menu");
    else if (G.state === STATE.PLAYING) playMusic("music_game");
  }
}

/* ---------------- main loop ---------------- */

let last = 0;

function frame(ts) {
  const t = ts;
  let dt = (t - last) / 1000;
  last = t;
  if (!isFinite(dt) || dt > 0.1) dt = 1 / 60;   // guard against tab-switch jumps

  ctx.clearRect(0, 0, W, H);

  switch (G.state) {
    case STATE.MENU:       drawMenu(); break;
    case STATE.BOSSSELECT: drawBossSelect(); break;
    case STATE.BOSSINTRO:  drawBossIntro(t); break;

    case STATE.PLAYING: {
      drawBackground();

      if (!R.dead) {
        updatePlayer(t, dt);
        if (!R.bossActive) {
          moveEnemies(dt);
          updateEnemies(t);
          if (t > R.nextAlienShot) {
            scheduleAlienShot(t);
            R.nextAlienShot = t + rndInt(500, 1500);
          }
        }
        updateBoss(t, dt);
        updateBullets(t, dt);
        collisions(t);
      }

      drawEnemies();
      drawBoss(t);
      drawBullets();
      drawPlayer();
      drawExplosions();
      drawHUD();

      if (R.dead && t - R.deathAt > 900) G.state = STATE.GAMEOVER;
      if (keys.Escape) returnToMenu();
      break;
    }

    case STATE.LEVELDONE: drawLevelDone(t); break;

    case STATE.GAMEOVER:
      drawBackground();
      drawExplosions();
      drawHUD();
      drawGameOver();
      break;
  }

  mouse.clicked = false;
  requestAnimationFrame(frame);
}

/* ---------------- boot ---------------- */

const overlay   = document.getElementById("overlay");
const startBtn  = document.getElementById("startbtn");
const loadLabel = document.getElementById("loadlabel");

(async function boot() {
  await loadAll((done, total) => {
    const pct = total ? Math.round((done / total) * 100) : 0;
    loadLabel.textContent = `Loading assets... ${pct}%`;
  });

  loadLabel.textContent = "Ready";
  startBtn.style.display = "inline-block";

  startBtn.addEventListener("click", () => {
    overlay.style.display = "none";
    G.state = STATE.MENU;
    playMusic("music_menu");          // started from a click, so autoplay is allowed
    requestAnimationFrame(frame);
  });
})();

/* touch controls */
function bindTouch(id, prop) {
  const el = document.getElementById(id);
  if (!el) return;
  const on  = e => { e.preventDefault(); touch[prop] = true;  };
  const off = e => { e.preventDefault(); touch[prop] = false; };
  el.addEventListener("touchstart", on,  {passive: false});
  el.addEventListener("touchend",   off, {passive: false});
  el.addEventListener("touchcancel",off, {passive: false});
  el.addEventListener("mousedown",  on);
  el.addEventListener("mouseup",    off);
  el.addEventListener("mouseleave", off);
}
bindTouch("btn-left",  "left");
bindTouch("btn-right", "right");
bindTouch("btn-fire",  "fire");

if (matchMedia("(pointer: coarse)").matches) {
  const tc = document.getElementById("touchcontrols");
  if (tc) tc.style.display = "flex";
}
