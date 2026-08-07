/* ============================================================
   Flappy Bird — High Quality Edition
   Pure Canvas + JS, no external assets.
   ============================================================ */
(() => {
  "use strict";

  // ---------- Canvas setup (crisp on hi-dpi) ----------
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = 420, H = 640;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.scale(dpr, dpr);

  // ---------- DOM ----------
  const scoreEl = document.getElementById("score");
  const bestEl = document.getElementById("best");
  const overlay = document.getElementById("overlay");
  const titleCard = document.getElementById("title-card");
  const subtitle = document.getElementById("subtitle");
  const startBtn = document.getElementById("start-btn");

  // ---------- Constants ----------
  let GRAVITY   = 0.42;
  let FLAP_VEL  = -7.2;
  let MAX_FALL  = 9.5;
  const PIPE_W    = 62;
  let PIPE_GAP  = 168;
  let PIPE_SPEED= 2.6;
  let PIPE_SPAC = 205;      // horizontal spacing between pipes
  const BIRD_X    = 110;
  const GROUND_Y  = H - 84;
  let BIRD_R    = 15;
  const SKY_EVERY  = 5;   // background palette shifts every N pipes scored
  const PIPE_EVERY = 9;   // pipe palette shifts every N pipes spawned
  const NIGHT_EVERY = 15; // day/night cycle flips every N pipes scored

  // Difficulty modes (Easy / Normal / Turbo)
  const MODE_CFG = {
    easy: {
      label: "Easy",
      birdR: 19, gravity: 0.34, flapVel: -6.4, maxFall: 8.2,
      pipeSpeed: 1.9, pipeGap: 192, pipeSpac: 260,
    },
    normal: {
      label: "Normal",
      birdR: 15, gravity: 0.42, flapVel: -7.2, maxFall: 9.5,
      pipeSpeed: 2.6, pipeGap: 168, pipeSpac: 205,
    },
    turbo: {
      label: "Turbo",
      birdR: 13, gravity: 0.52, flapVel: -8.2, maxFall: 11,
      pipeSpeed: 3.4, pipeGap: 150, pipeSpac: 172,
    },
  };

  // Bird color choices (base hex; full palette is derived from each)
  const BIRD_COLORS = [
    { name: "Classic Yellow", hex: "#f6b73c" },
    { name: "Sunny Gold",     hex: "#f5c542" },
    { name: "Crimson",        hex: "#e23b3b" },
    { name: "Rose",           hex: "#e86a9a" },
    { name: "Orange",         hex: "#f07a2e" },
    { name: "Emerald",        hex: "#2ecc71" },
    { name: "Teal",           hex: "#2aa8a0" },
    { name: "Sky Blue",       hex: "#4a90d9" },
    { name: "Royal Purple",   hex: "#8e44ad" },
    { name: "Hot Pink",       hex: "#ff5ea0" },
    { name: "Chocolate",      hex: "#8a5a2b" },
    { name: "Charcoal",       hex: "#4a4a4a" },
    { name: "Snow",           hex: "#e8e8f0" },
    { name: "Mint",           hex: "#7fd8a8" },
  ];

  // Sky gradients cycle with score
  const SKY_THEMES = [
    { top: "#4ec0f4", mid: "#8fd8f8", bot: "#c9ecff", sun: "#fff3b0", glow: "#ffe680" },
    { top: "#6b8cff", mid: "#9eb6ff", bot: "#d6e0ff", sun: "#ffe0a0", glow: "#ffc878" },
    { top: "#c06cf0", mid: "#d9a0f8", bot: "#f0d8ff", sun: "#ffe9a8", glow: "#ffd070" },
    { top: "#ff7b54", mid: "#ffb088", bot: "#ffe0cc", sun: "#fff4c2", glow: "#ffe080" },
    { top: "#2ec4b6", mid: "#7ee0d6", bot: "#c8f5f0", sun: "#fff1b8", glow: "#ffe070" },
    { top: "#1d3557", mid: "#457b9d", bot: "#a8dadc", sun: "#f1faee", glow: "#e9c46a" },
  ];

  // Night palette (moon + stars replace the sun + clouds)
  const NIGHT_THEME = {
    top: "#0a0f24", mid: "#182040", bot: "#283060",
    moon: "#eef0f8", glow: "#b8c8f0",
  };

  // Pipe body/rim gradients cycle with spawn count
  const PIPE_THEMES = [
    { a: "#5da63a", b: "#8ed060", c: "#6dbf3f", d: "#4c8f2c", rim: "#3f7d22" },
    { a: "#2a7fc9", b: "#6eb6f0", c: "#3d9ae0", d: "#1f5f9a", rim: "#184c7a" },
    { a: "#c45c26", b: "#f0a060", c: "#e07830", d: "#a84818", rim: "#8a3a12" },
    { a: "#8b3db8", b: "#c98aef", c: "#a855d4", d: "#6b2a8f", rim: "#542070" },
    { a: "#c9a227", b: "#f0d060", c: "#e0bc30", d: "#9a7a18", rim: "#7a6012" },
    { a: "#c2305a", b: "#f07898", c: "#e04870", d: "#9a2045", rim: "#7a1836" },
  ];

  // ---------- State ----------
  const MODE = { READY: "ready", PLAYING: "playing", OVER: "over" };
  let mode = MODE.READY;
  let bird = { y: H / 2, vel: 0, rot: 0 };
  let pipes = [];
  let pipesSpawned = 0;
  let score = 0;
  let frame = 0;
  let shake = 0;
  let overAt = 0;   // timestamp of game over, used to delay restart

  // Safe storage (works even on file:// protocol)
  const storage = {
    get(key) {
      try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, val) {
      try { localStorage.setItem(key, val); } catch (e) { /* ignore */ }
    },
  };
  let best = Number(storage.get("flap2_best") || 0);
  bestEl.textContent = best;

  // ---------- Settings ----------
  let gameMode = storage.get("flap2_mode") || "normal";
  if (!MODE_CFG[gameMode]) gameMode = "normal";
  let birdColorIdx = Number(storage.get("flap2_color") || 0);
  if (!BIRD_COLORS[birdColorIdx]) birdColorIdx = 0;

  function applyMode() {
    const m = MODE_CFG[gameMode];
    GRAVITY = m.gravity;
    FLAP_VEL = m.flapVel;
    MAX_FALL = m.maxFall;
    PIPE_GAP = m.pipeGap;
    PIPE_SPEED = m.pipeSpeed;
    PIPE_SPAC = m.pipeSpac;
    BIRD_R = m.birdR;
  }
  applyMode();

  function birdPalette() {
    const hex = BIRD_COLORS[birdColorIdx].hex;
    return {
      light: lighten(hex, 0.35),
      mid: hex,
      dark: darken(hex, 0.35),
      belly: lighten(hex, 0.55),
      wingLight: lighten(hex, 0.45),
      wingDark: darken(hex, 0.25),
      beak: "#f26b21",
      beakDark: "#c24e12",
      stroke: darken(hex, 0.5),
    };
  }

  // ---------- Procedural audio (Web Audio, no files) ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function beep(type, freq, dur, vol = 0.18) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }
  const sfx = {
    flap:  () => beep("triangle", 420, 0.09, 0.14),
    score: () => { beep("square", 660, 0.08, 0.1); setTimeout(() => beep("square", 880, 0.1, 0.1), 70); },
    hit:   () => { beep("sawtooth", 160, 0.28, 0.22); },
  };

  // ---------- Helpers ----------
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- Clouds (parallax) ----------
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    clouds.push({
      x: rand(0, W),
      y: rand(24, 220),
      s: rand(0.5, 1.15),
      v: rand(0.15, 0.5),
      puffs: [rand(0, Math.PI * 2), rand(0, Math.PI * 2)],
    });
  }

  // ---------- Stars (night) ----------
  const stars = [];
  for (let i = 0; i < 60; i++) {
    stars.push({
      x: rand(0, W),
      y: rand(10, GROUND_Y - 40),
      s: rand(0.6, 1.8),
      tw: rand(0, Math.PI * 2),
    });
  }

  function drawCloud(c, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(c.x, c.y);
    ctx.scale(c.s, c.s);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.arc(24, 8, 16, 0, Math.PI * 2);
    ctx.arc(-24, 8, 16, 0, Math.PI * 2);
    ctx.arc(6, -12, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ---------- Themes ----------
  function parseColor(c) {
    if (c.startsWith("#")) {
      const n = parseInt(c.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = c.match(/rgb\((\d+),(\d+),(\d+)\)/);
    return m ? [+m[1], +m[2], +m[3]] : [0, 0, 0];
  }
  function lighten(hex, pct) {
    const c = parseColor(hex);
    return `rgb(${Math.round(c[0] + (255 - c[0]) * pct)},${Math.round(c[1] + (255 - c[1]) * pct)},${Math.round(c[2] + (255 - c[2]) * pct)})`;
  }
  function darken(hex, pct) {
    const c = parseColor(hex);
    return `rgb(${Math.round(c[0] * (1 - pct))},${Math.round(c[1] * (1 - pct))},${Math.round(c[2] * (1 - pct))})`;
  }
  function lerpColor(a, b, t) {
    const ca = parseColor(a), cb = parseColor(b);
    const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
    const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
    const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
    return `rgb(${r},${g},${bl})`;
  }
  // Interpolate smoothly between palette themes instead of hard-switching.
  function dayThemeColors() {
    const progress = score / SKY_EVERY;
    const idx = Math.floor(progress) % SKY_THEMES.length;
    const next = (idx + 1) % SKY_THEMES.length;
    const t = progress - Math.floor(progress);
    const cur = SKY_THEMES[idx], nxt = SKY_THEMES[next];
    return {
      top: lerpColor(cur.top, nxt.top, t),
      mid: lerpColor(cur.mid, nxt.mid, t),
      bot: lerpColor(cur.bot, nxt.bot, t),
      sun: lerpColor(cur.sun, nxt.sun, t),
      glow: lerpColor(cur.glow, nxt.glow, t),
    };
  }
  // 0 = full day, 1 = full night. Smoothly ramps at each day/night boundary.
  function nightFactor() {
    const cycle = score % (NIGHT_EVERY * 2);
    const W = 3;
    if (cycle < NIGHT_EVERY) {
      if (cycle >= NIGHT_EVERY - W) return (cycle - (NIGHT_EVERY - W)) / W;
      return 0;
    }
    if (cycle >= NIGHT_EVERY * 2 - W) return (NIGHT_EVERY * 2 - cycle) / W;
    return 1;
  }
  // Sky gradient blends from the day palette toward the night palette.
  function skyColors() {
    const day = dayThemeColors();
    const night = nightFactor();
    return {
      top: lerpColor(day.top, NIGHT_THEME.top, night),
      mid: lerpColor(day.mid, NIGHT_THEME.mid, night),
      bot: lerpColor(day.bot, NIGHT_THEME.bot, night),
    };
  }
  function pipeThemeForIndex(spawnIndex) {
    return PIPE_THEMES[Math.floor(spawnIndex / PIPE_EVERY) % PIPE_THEMES.length];
  }

  // ---------- Pipes ----------
  function spawnPipe() {
    const minTop = 70, maxTop = GROUND_Y - PIPE_GAP - 70;
    const top = rand(minTop, maxTop);
    const theme = pipeThemeForIndex(pipesSpawned);
    pipesSpawned++;
    pipes.push({ x: W + 10, top, scored: false, theme });
  }

  // ---------- Bird ----------
  function flap() {
    // Ignore input while the settings menu is open.
    if (settingsPanel && !settingsPanel.classList.contains("hidden")) return;
    // Space bar starts the game from the title screen AND presses "Play again"
    // after a game over. After dying, ignore input for 1.5s so the score
    // screen isn't skipped while the player is still jamming on space.
    if (mode === MODE.READY) startGame();
    else if (mode === MODE.OVER && Date.now() - overAt >= 1500) startGame();
    if (mode !== MODE.PLAYING) return;
    bird.vel = FLAP_VEL;
    sfx.flap();
  }

  function startGame() {
    mode = MODE.PLAYING;
    bird.y = H / 2;
    bird.vel = 0;
    bird.rot = 0;
    pipes = [];
    pipesSpawned = 0;
    score = 0;
    scoreEl.textContent = 0;
    overlay.classList.add("hidden");
  }

  function gameOver() {
    mode = MODE.OVER;
    overAt = Date.now();
    sfx.hit();
    shake = 10;
    if (score > best) {
      best = score;
      storage.set("flap2_best", String(best));
      bestEl.textContent = best;
    }
    overlay.classList.remove("hidden");
    titleCard.innerHTML = `
      <h1>Game Over</h1>
      <p>Nice try!</p>
      <p class="final-score">Score: ${score} · Best: ${best}</p>
      <div class="btn-row">
        <button id="start-btn">↻ Play again</button>
        <button id="settings-btn">⚙ Settings</button>
      </div>`;
    document.getElementById("start-btn").addEventListener("click", startGame);
    bindSettingsBtn();
  }

  // ---------- Update ----------
  function update() {
    if (mode === MODE.PLAYING) {
      bird.vel = Math.min(bird.vel + GRAVITY, MAX_FALL);
      bird.y += bird.vel;

      // rotation
      const target = clamp(bird.vel * 3.2, -25, 82);
      bird.rot += (target - bird.rot) * 0.18;

      // pipes
      for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= PIPE_SPEED;
        if (p.x < -PIPE_W - 20) pipes.splice(i, 1);
        else if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
          p.scored = true;
          score++;
          scoreEl.textContent = score;
          sfx.score();
        }
      }
      if (pipes.length === 0 || pipes[pipes.length - 1].x < W - PIPE_SPAC) spawnPipe();

      // collisions
      const birdTop = bird.y - BIRD_R, birdBottom = bird.y + BIRD_R;
      if (birdBottom >= GROUND_Y) {
        bird.y = GROUND_Y - BIRD_R;
        gameOver();
        return;
      }
      if (birdTop <= 0) { bird.y = BIRD_R; bird.vel = 0; }
      for (const p of pipes) {
        if (BIRD_X + BIRD_R > p.x && BIRD_X - BIRD_R < p.x + PIPE_W) {
          const topHole = p.top, botHole = p.top + PIPE_GAP;
          if (birdTop < topHole || birdBottom > botHole) { gameOver(); return; }
        }
      }
    }
    // ambient motion always runs
    for (const c of clouds) {
      c.x -= c.v;
      if (c.x < -60) { c.x = W + 60; c.y = rand(24, 220); }
    }
    if (shake > 0) shake *= 0.85;
    frame++;
  }

  // ---------- Draw ----------
  function drawSky() {
    const sky = skyColors();
    const night = nightFactor();
    const g = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.7, sky.mid);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, GROUND_Y);

    const day = dayThemeColors();
    // sun sets at night
    if (night < 1) {
      ctx.save();
      ctx.globalAlpha = 0.9 * (1 - night);
      ctx.fillStyle = day.sun;
      ctx.beginPath();
      ctx.arc(345, 78, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35 * (1 - night);
      ctx.fillStyle = day.glow;
      ctx.beginPath();
      ctx.arc(345, 78, 50, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // moon rises at night
    if (night > 0) {
      ctx.save();
      ctx.globalAlpha = night;
      ctx.fillStyle = NIGHT_THEME.moon;
      ctx.beginPath();
      ctx.arc(345, 78, 26, 0, Math.PI * 2);
      ctx.fill();
      // carve a crescent with a sky-colored disc
      ctx.fillStyle = "#0a0f24";
      ctx.beginPath();
      ctx.arc(353, 72, 21, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = night * 0.35;
      ctx.fillStyle = NIGHT_THEME.glow;
      ctx.beginPath();
      ctx.arc(345, 78, 42, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawStars(alpha) {
    if (alpha <= 0) return;
    ctx.save();
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(frame * 0.06 + s.tw);
      ctx.globalAlpha = alpha * tw;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPipes() {
    for (const p of pipes) {
      // top pipe (flipped)
      const topH = p.top;
      const bottomY = p.top + PIPE_GAP;
      drawPipe(p.x, 0, topH, true, p.theme);
      drawPipe(p.x, bottomY, GROUND_Y - bottomY, false, p.theme);
    }
  }

  function drawPipe(x, y, h, flipped, theme) {
    const t = theme || PIPE_THEMES[0];
    ctx.save();
    if (flipped) {
      ctx.translate(x + PIPE_W / 2, y + h);
      ctx.rotate(Math.PI);
    } else {
      ctx.translate(x + PIPE_W / 2, y);
    }
    const grad = ctx.createLinearGradient(-PIPE_W / 2, 0, PIPE_W / 2, 0);
    grad.addColorStop(0, t.a);
    grad.addColorStop(0.25, t.b);
    grad.addColorStop(0.55, t.c);
    grad.addColorStop(1, t.d);
    ctx.fillStyle = grad;
    ctx.fillRect(-PIPE_W / 2, 0, PIPE_W, h);
    // edge highlight
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(-PIPE_W / 2 + 6, 0, 9, h);
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(PIPE_W / 2 - 12, 0, 7, h);
    // rim
    const rimH = 26;
    const rimGrad = ctx.createLinearGradient(-PIPE_W / 2, 0, PIPE_W / 2, 0);
    rimGrad.addColorStop(0, t.d);
    rimGrad.addColorStop(0.25, t.b);
    rimGrad.addColorStop(0.55, t.c);
    rimGrad.addColorStop(1, t.rim);
    ctx.fillStyle = rimGrad;
    ctx.fillRect(-PIPE_W / 2 - 5, 0, PIPE_W + 10, rimH);
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.strokeRect(-PIPE_W / 2 - 5, 0, PIPE_W + 10, rimH);
    ctx.restore();
  }

  function drawGround() {
    const gh = H - GROUND_Y;
    const g = ctx.createLinearGradient(0, GROUND_Y, 0, H);
    g.addColorStop(0, "#8ed060");
    g.addColorStop(1, "#5da63a");
    ctx.fillStyle = g;
    ctx.fillRect(0, GROUND_Y, W, gh);
    // grass strip
    ctx.fillStyle = "#6dbf3f";
    ctx.fillRect(0, GROUND_Y, W, 12);
    // scrolling stripes
    const off = (frame * PIPE_SPEED) % 32;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(0, GROUND_Y + 10, W, 5);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    for (let x = -32 + off; x < W + 32; x += 32) {
      ctx.fillRect(x, GROUND_Y + 26, 16, gh - 26);
    }
  }

  function drawBird() {
    const pal = birdPalette();
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate((bird.rot * Math.PI) / 180);
    const k = BIRD_R / 15;
    ctx.scale(k, k);
    // shadow
    ctx.save();
    ctx.translate(2, 4);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // body
    const g = ctx.createRadialGradient(-4, -6, 4, 0, 0, 19);
    g.addColorStop(0, pal.light);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 17, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // belly
    ctx.fillStyle = pal.belly;
    ctx.beginPath();
    ctx.ellipse(2, 5, 9, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // wing (flaps)
    const wingY = Math.sin(frame * 0.3) * 6;
    ctx.save();
    ctx.translate(-3, -wingY * 0.5);
    ctx.rotate(-0.5 + Math.sin(frame * 0.3) * 0.5);
    const wg = ctx.createLinearGradient(0, -6, 0, 8);
    wg.addColorStop(0, pal.wingLight);
    wg.addColorStop(1, pal.wingDark);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.ellipse(-7, 0, 9, 6, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(7, -5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.arc(9, -5, 3.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(10.2, -6.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    // beak
    ctx.fillStyle = pal.beak;
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(24, 4);
    ctx.lineTo(12, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.beakDark;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawEagle() {
    const pal = birdPalette();
    ctx.save();
    ctx.translate(BIRD_X, bird.y);
    ctx.rotate((bird.rot * Math.PI) / 180);
    const k = BIRD_R / 13;
    ctx.scale(k, k);
    // shadow
    ctx.save();
    ctx.translate(2, 4);
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.beginPath();
    ctx.ellipse(0, 2, 16, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // tail feathers
    ctx.save();
    ctx.translate(-13, 1);
    ctx.rotate(0.35);
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, 5);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // wing (swept, flaps)
    const wingY = Math.sin(frame * 0.3) * 6;
    ctx.save();
    ctx.translate(-3, -3 - wingY * 0.5);
    ctx.rotate(-0.55 + Math.sin(frame * 0.3) * 0.4);
    const wg = ctx.createLinearGradient(0, -8, 0, 4);
    wg.addColorStop(0, pal.wingLight);
    wg.addColorStop(1, pal.wingDark);
    ctx.fillStyle = wg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-11, -7, -15, -13);
    ctx.quadraticCurveTo(-7, -9, 0, -3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // body (angular)
    const bg = ctx.createLinearGradient(0, -8, 0, 8);
    bg.addColorStop(0, pal.light);
    bg.addColorStop(0.6, pal.mid);
    bg.addColorStop(1, pal.dark);
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.moveTo(-12, 2);
    ctx.quadraticCurveTo(-5, -5, 3, -6);
    ctx.quadraticCurveTo(9, -4, 12, -1);
    ctx.quadraticCurveTo(13, 3, 9, 6);
    ctx.quadraticCurveTo(3, 8, -5, 6);
    ctx.quadraticCurveTo(-11, 4, -12, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // white head
    ctx.fillStyle = "#f2f2f2";
    ctx.beginPath();
    ctx.arc(11, -2, 5.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = pal.stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
    // hooked beak (yellow)
    ctx.fillStyle = "#f6c23c";
    ctx.beginPath();
    ctx.moveTo(14, -1);
    ctx.quadraticCurveTo(19, -2, 20, 1);
    ctx.quadraticCurveTo(17, 3, 14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#c98a1e";
    ctx.lineWidth = 1;
    ctx.stroke();
    // fierce eye
    ctx.fillStyle = "#1d1d1d";
    ctx.beginPath();
    ctx.arc(11.5, -3, 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(12, -3.4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    // angry brow
    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(9.5, -5.5);
    ctx.lineTo(13, -4.2);
    ctx.stroke();
    ctx.restore();
  }

  function draw() {
    ctx.save();
    if (shake > 0.5) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }
    drawSky();
    const night = nightFactor();
    for (const c of clouds) drawCloud(c, 1 - night);
    drawStars(night);
    drawPipes();
    drawGround();
    if (gameMode === "turbo") drawEagle(); else drawBird();
    ctx.restore();
  }

  // ---------- Loop ----------
  function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  function onInput(e) {
    if (e.cancelable) e.preventDefault();
    if (e.type === "keydown" && e.repeat) return;
    ensureAudio();
    flap();
  }
  canvas.addEventListener("pointerdown", onInput);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") onInput(e);
  });
  startBtn.addEventListener("click", (e) => { e.stopPropagation(); ensureAudio(); startGame(); });

  // ---------- Settings menu ----------
  const settingsPanel = document.getElementById("settings-panel");
  const colorRow = document.getElementById("color-row");

  function updateModeLabel() {
    const lbl = document.getElementById("mode-label");
    if (lbl) lbl.textContent = MODE_CFG[gameMode].label;
  }

  function renderSettings() {
    document.querySelectorAll(".mode-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.mode === gameMode);
    });
    colorRow.innerHTML = "";
    BIRD_COLORS.forEach((c, i) => {
      const sw = document.createElement("button");
      sw.className = "color-swatch";
      sw.style.background = c.hex;
      sw.title = c.name;
      sw.dataset.idx = i;
      sw.classList.toggle("active", i === birdColorIdx);
      sw.addEventListener("click", () => selectColor(i));
      colorRow.appendChild(sw);
    });
  }

  function selectMode(m) {
    gameMode = m;
    storage.set("flap2_mode", m);
    applyMode();
    updateModeLabel();
    renderSettings();
  }

  function selectColor(i) {
    birdColorIdx = i;
    storage.set("flap2_color", String(i));
    renderSettings();
  }

  function openSettings() {
    settingsPanel.classList.remove("hidden");
    renderSettings();
  }

  function closeSettings() {
    settingsPanel.classList.add("hidden");
  }

  function bindSettingsBtn() {
    const btn = document.getElementById("settings-btn");
    if (btn) btn.addEventListener("click", (e) => { e.stopPropagation(); openSettings(); });
  }

  document.querySelectorAll(".mode-btn").forEach(b => {
    b.addEventListener("click", () => selectMode(b.dataset.mode));
  });
  document.getElementById("settings-close").addEventListener("click", closeSettings);
  settingsPanel.addEventListener("click", (e) => {
    if (e.target === settingsPanel) closeSettings();
  });
  bindSettingsBtn();
  updateModeLabel();

  // ---------- Boot ----------
  loop();
})();
