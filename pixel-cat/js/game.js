(function () {
  'use strict';
  window.PC = window.PC || {};
  var F = PC.font, SP = PC.sprites, AU = PC.audio;

  var VIEW_H = 270;
  var GROUND_H = 34;
  var GRAV = 2400;
  var JUMP_V = -800;
  var MAX_FALL = 950;
  var CAT_X = 70;

  var INK = '#2b2138';

  var PHASES = [
    { sky0: '#6ec3ff', sky1: '#c9f0ff', far: '#8fd98a', near: '#4fb85e', grass: '#46c95c', grassD: '#2f9e44', dirt: '#8a5a3b', cloud: '#ffffff', star: 0, dim: 0 },
    { sky0: '#ff8a5c', sky1: '#ffd9a0', far: '#e89a6a', near: '#c97a4a', grass: '#c9904a', grassD: '#9e6a34', dirt: '#7a4a30', cloud: '#ffe8d0', star: 0, dim: 0.10 },
    { sky0: '#150c2e', sky1: '#3b2a63', far: '#2c2154', near: '#221a45', grass: '#2e6b4f', grassD: '#1f4c38', dirt: '#33253a', cloud: '#4a3f78', star: 1, dim: 0.28 },
    { sky0: '#ff7eb6', sky1: '#ffd0e8', far: '#d98ab8', near: '#b86a9a', grass: '#6fc97a', grassD: '#4a9e58', dirt: '#8a5a3b', cloud: '#fff0f8', star: 0.25, dim: 0.05 }
  ];

  var OBS = {
    can: { img: 'can', w: 12, h: 14 },
    cone: { img: 'cone', w: 10, h: 11 },
    hydrant: { img: 'hydrant', w: 10, h: 12 },
    dog: { img: ['dogA', 'dogB'], w: 17, h: 11, anim: true },
    tower: { img: 'can', w: 12, h: 26, stack: true },
    drone: { img: ['droneA', 'droneB'], w: 15, h: 6, flying: true, anim: true }
  };

  var PICKUP = {
    fish: { img: 'fish', w: 10, h: 6 },
    yarn: { img: 'yarn', w: 10, h: 10 },
    milk: { img: 'milk', w: 8, h: 12 },
    star: { img: 'star', w: 8, h: 8 }
  };

  var SHOP = {
    shield: { name: '9 LIVES', costs: [150], desc: 'START WITH SHIELD' },
    magnet: { name: 'MAGNET', costs: [250, 500], desc: 'FISH FLY TO YOU' },
    collar: { name: 'GOLD COLLAR', costs: [300], desc: 'FISH X2 POINTS' }
  };

  var hexCache = {};
  function hx(c) {
    if (!hexCache[c]) {
      hexCache[c] = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    return hexCache[c];
  }
  function lerpC(a, b, t) {
    var A = hx(a), B = hx(b);
    return 'rgb(' + Math.round(A[0] + (B[0] - A[0]) * t) + ',' + Math.round(A[1] + (B[1] - A[1]) * t) + ',' + Math.round(A[2] + (B[2] - A[2]) * t) + ')';
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function mod(n, m) { return ((n % m) + m) % m; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var G = {
    state: 'boot',
    W: 480,
    groundY: VIEW_H - GROUND_H,
    canvas: null,
    ctx: null,
    screen: null,
    sctx: null,
    tod: 0,
    dist: 0,
    speed: 230,
    score: 0,
    best: 0,
    bank: 0,
    runFish: 0,
    combo: 0,
    comboT: 0,
    mult: 1,
    newBest: false,
    overT: 0,
    deathT: 0,
    nextSpawn: 600,
    patternsSincePower: 0,
    obstacles: [],
    pickups: [],
    parts: [],
    clouds: [],
    mid: [],
    flowers: [],
    stars: [],
    genX: 0,
    buttons: [],
    input: { down: false, slideHeld: false, downX: 0, downY: 0, swiped: false, coyote: 0 },
    player: null,
    up: { shield: 0, magnet: 0, collar: 0 },
    muted: false,
    magnetT: 0,
    slowT: 0,
    shield: false,
    invuln: 0,
    runAnim: 0,
    blinkT: 2,
    dustT: 0,
    pal: PHASES[0],
    time: 0
  };

  G.player = {
    y: G.groundY, vy: 0, onGround: true,
    sliding: false, slideT: 0, h: 16, w: 14, dead: false
  };

  function persist() {
    try {
      localStorage.setItem('pc_save', JSON.stringify({
        best: G.best, bank: G.bank, up: G.up, muted: G.muted
      }));
    } catch (e) {}
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem('pc_save') || '{}');
      G.best = s.best || 0;
      G.bank = s.bank || 0;
      G.muted = !!s.muted;
      if (s.up) { G.up.shield = s.up.shield | 0; G.up.magnet = s.up.magnet | 0; G.up.collar = s.up.collar | 0; }
    } catch (e) {}
    AU.muted = G.muted;
  }

  G.init = function () {
    G.canvas = document.getElementById('game');
    G.ctx = G.canvas.getContext('2d');
    G.screen = document.createElement('canvas');
    G.screen.height = VIEW_H;
    G.sctx = G.screen.getContext('2d');
    for (var i = 0; i < 46; i++) {
      G.stars.push({ x: Math.random() * 700, y: Math.random() * 150, s: Math.random() < 0.25 ? 3 : 2, tw: Math.random() * 6 });
    }
    for (var c = 0; c < 7; c++) {
      G.clouds.push({ x: Math.random() * 900, y: 14 + Math.random() * 70, sc: Math.random() < 0.4 ? 2 : 1 });
    }
    load();
    G.resize();
    G.state = 'title';
    bindInput();
    var last = 0;
    var loop = function (t) {
      var dt = Math.min(0.05, (t - last) / 1000 || 0.016);
      last = t;
      G.time = t / 1000;
      G.update(dt);
      G.render();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  G.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    G.canvas.width = Math.max(1, Math.round(w * dpr));
    G.canvas.height = Math.max(1, Math.round(h * dpr));
    var aspect = w / Math.max(1, h);
    G.W = clamp(Math.round(VIEW_H * aspect), 340, 660);
    G.screen.width = G.W;
    G.groundY = VIEW_H - GROUND_H;
    G.player.y = G.groundY;
  };

  function phase() {
    var cycle = mod(G.tod / 40, 1);
    var f = cycle * 4;
    var i = Math.floor(f) % 4;
    var t = f - Math.floor(f);
    var A = PHASES[i], B = PHASES[(i + 1) % 4];
    return {
      sky0: lerpC(A.sky0, B.sky0, t), sky1: lerpC(A.sky1, B.sky1, t),
      far: lerpC(A.far, B.far, t), near: lerpC(A.near, B.near, t),
      grass: lerpC(A.grass, B.grass, t), grassD: lerpC(A.grassD, B.grassD, t),
      dirt: lerpC(A.dirt, B.dirt, t), cloud: lerpC(A.cloud, B.cloud, t),
      star: A.star + (B.star - A.star) * t,
      dim: A.dim + (B.dim - A.dim) * t,
      cycle: cycle
    };
  }

  function magnetRadius() { return 70 + G.up.magnet * 60; }

  G.start = function () {
    AU.ensure();
    AU.play('start');
    AU.startMusic();
    G.state = 'playing';
    G.dist = 0;
    G.speed = 230;
    G.score = 0;
    G.runFish = 0;
    G.combo = 0;
    G.comboT = 0;
    G.mult = 1;
    G.newBest = false;
    G.overT = 0;
    G.deathT = 0;
    G.nextSpawn = 650;
    G.patternsSincePower = 0;
    G.obstacles.length = 0;
    G.pickups.length = 0;
    G.parts.length = 0;
    G.magnetT = 0;
    G.slowT = 0;
    G.invuln = 0;
    var p = G.player;
    p.y = G.groundY;
    p.vy = 0;
    p.onGround = true;
    p.sliding = false;
    p.slideT = 0;
    p.dead = false;
    G.shield = G.up.shield > 0;
    var hint = document.getElementById('hint');
    if (hint) hint.style.display = 'none';
  };

  G.retry = function () { G.start(); };

  G.toMenu = function () {
    G.state = 'title';
    G.obstacles.length = 0;
    G.pickups.length = 0;
    G.parts.length = 0;
    var p = G.player;
    p.y = G.groundY;
    p.vy = 0;
    p.onGround = true;
    p.sliding = false;
    p.slideT = 0;
    p.dead = false;
    G.shield = false;
    G.invuln = 0;
    G.magnetT = 0;
    G.slowT = 0;
    AU.play('click');
    if (AU.ctx) AU.startMusic();
  };

  G.togglePause = function () {
    if (G.state === 'playing') { G.state = 'paused'; AU.play('click'); }
    else if (G.state === 'paused') { G.state = 'playing'; AU.play('click'); }
  };

  G.toggleMute = function () {
    G.muted = !G.muted;
    AU.setMuted(G.muted);
    persist();
  };

  G.buy = function (id) {
    var def = SHOP[id];
    var lvl = G.up[id];
    if (lvl >= def.costs.length) return false;
    var cost = def.costs[lvl];
    if (G.bank < cost) { AU.ensure(); AU.play('click'); return false; }
    G.bank -= cost;
    G.up[id] = lvl + 1;
    AU.ensure();
    AU.play('buy');
    persist();
    return true;
  };

  function gameOver() {
    G.state = 'over';
    G.overT = 0;
    var s = Math.floor(G.score);
    G.newBest = s > G.best;
    if (G.newBest) G.best = s;
    G.bank += G.runFish;
    persist();
    AU.play('over');
    AU.stopMusic();
  }

  G.tryJump = function () {
    var p = G.player;
    if (G.state !== 'playing' || p.dead) return;
    if (p.onGround || G.input.coyote > 0) {
      p.vy = JUMP_V;
      p.onGround = false;
      p.sliding = false;
      G.input.coyote = 0;
      AU.ensure();
      AU.play('jump');
      puff(CAT_X, G.groundY, 4, 'rgba(255,243,224,0.6)');
    }
  };

  G.trySlide = function () {
    var p = G.player;
    if (G.state !== 'playing' || p.dead) return;
    p.sliding = true;
    p.slideT = 0.55;
    G.input.slideHeld = true;
    if (!p.onGround && p.vy < 350) p.vy = 350;
    AU.ensure();
    AU.play('slide');
    puff(CAT_X, G.groundY, 3, 'rgba(200,200,220,0.5)');
  };

  function puff(x, y, n, color) {
    for (var i = 0; i < n; i++) {
      G.parts.push({
        x: x + rand(-6, 6), y: y - rand(0, 4),
        vx: rand(-40, 40), vy: rand(-90, -20),
        life: rand(0.25, 0.5), max: 0.5,
        color: color, size: 2, grav: 320
      });
    }
  }

  function burst(x, y, n, colors, speed) {
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2;
      var v = rand(speed * 0.4, speed);
      G.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        life: rand(0.3, 0.6), max: 0.6,
        color: pick(colors), size: 2, grav: 500
      });
    }
  }

  function groundObs(sx, type) {
    var o = OBS[type];
    G.obstacles.push({ sx: sx, type: type, w: o.w, h: o.h, flying: false, anim: 0, bob: Math.random() * 6 });
  }

  function drone(sx) {
    G.obstacles.push({ sx: sx, type: 'drone', w: OBS.drone.w, h: OBS.drone.h, flying: true, anim: 0, bob: Math.random() * 6 });
  }

  function spawnPattern() {
    var d = clamp(G.dist / 5200, 0, 1);
    var sx = G.W + 60;
    var r = Math.random() * (1 - d * 0.25);
    if (r < 0.30) {
      groundObs(sx, pick(['can', 'cone', 'hydrant']));
    } else if (r < 0.46) {
      groundObs(sx, 'dog');
    } else if (r < 0.64) {
      drone(sx);
      if (d > 0.35 && Math.random() < 0.55) groundObs(sx - 78, pick(['can', 'cone']));
    } else if (r < 0.82) {
      groundObs(sx, pick(['can', 'cone', 'hydrant']));
      groundObs(sx + 30, pick(['can', 'cone']));
    } else {
      groundObs(sx, 'tower');
    }
    if (Math.random() < 0.85) {
      var n = 4 + Math.floor(Math.random() * 3);
      var fx = sx + 70 + Math.random() * 60;
      var arc = Math.random() < 0.6;
      for (var i = 0; i < n; i++) {
        var fy = arc ? G.groundY - 16 - Math.sin((i / (n - 1)) * Math.PI) * 30 : G.groundY - 12;
        G.pickups.push({ sx: fx + i * 17, y: fy, type: 'fish', w: 10, h: 6, vx: 0, vy: 0 });
      }
    }
    G.patternsSincePower++;
    if (G.patternsSincePower >= 5 + Math.floor(Math.random() * 4)) {
      G.patternsSincePower = 0;
      var t = pick(['yarn', 'milk', 'star']);
      G.pickups.push({ sx: sx + 130 + Math.random() * 90, y: G.groundY - 14, type: t, w: PICKUP[t].w, h: PICKUP[t].h, vx: 0, vy: 0 });
    }
    var gap = rand(255, 380) - d * 115;
    G.nextSpawn = G.dist + Math.max(165, gap);
  }

  function genMid() {
    while (G.genX < G.dist + G.W + 260) {
      var roll = Math.random();
      if (roll < 0.3) G.mid.push({ x: G.genX, type: 'tree', s: 1 + Math.floor(Math.random() * 2) });
      else if (roll < 0.5) G.mid.push({ x: G.genX, type: 'house', s: 1 });
      else if (roll < 0.72) G.mid.push({ x: G.genX, type: 'bush', s: 1 + Math.floor(Math.random() * 2) });
      else G.mid.push({ x: G.genX, type: 'fence', s: 1 });
      if (Math.random() < 0.12) G.flowers.push({ x: G.genX + rand(0, 40), v: Math.floor(Math.random() * 3) });
      G.genX += rand(50, 150);
    }
    while (G.mid.length && G.mid[0].x < G.dist * 0.85 - 120) G.mid.shift();
    while (G.flowers.length && G.flowers[0].x < G.dist - 80) G.flowers.shift();
  }

  function difficulty() { return clamp(G.dist / 5200, 0, 1); }

  G.update = function (dt) {
    G.tod += dt;
    G.pal = phase();
    AU.tick();
    if (G.state === 'title') {
      G.dist += 95 * dt;
      G.runAnim += dt * 8;
      genMid();
      updateParts(dt);
      return;
    }
    if (G.state === 'paused') return;
    if (G.state === 'over') { G.overT += dt; genMid(); updateParts(dt); return; }
    if (G.state === 'dying') {
      G.deathT += dt;
      var p0 = G.player;
      p0.vy = Math.min(p0.vy + GRAV * dt, MAX_FALL);
      p0.y += p0.vy * dt;
      updateParts(dt);
      if (G.deathT > 1.15) gameOver();
      return;
    }

    var p = G.player;
    var d = difficulty();
    G.speed = Math.min(560, 230 + G.dist * 0.011);
    if (G.slowT > 0) { G.speed *= 0.55; G.slowT -= dt; }
    var eff = G.speed;
    G.dist += eff * dt;
    G.score += eff * dt * 0.05;
    genMid();

    if (G.dist >= G.nextSpawn) spawnPattern();

    var g = GRAV * (G.input.down && p.vy < 0 ? 0.55 : 1);
    p.vy = Math.min(p.vy + g * dt, MAX_FALL);
    p.y += p.vy * dt;
    if (p.y >= G.groundY) {
      if (!p.onGround && p.vy > 300) puff(CAT_X, G.groundY, 5, 'rgba(255,243,224,0.6)');
      p.y = G.groundY;
      p.vy = 0;
      p.onGround = true;
    } else {
      p.onGround = false;
      G.input.coyote = p.vy > 0 ? 0.09 : G.input.coyote - dt;
    }

    if (p.sliding) {
      p.slideT -= dt;
      if ((!G.input.slideHeld && p.slideT <= 0) || p.slideT < -0.6) p.sliding = false;
    }
    p.h = p.sliding ? 8 : 16;
    p.w = p.sliding ? 17 : 14;

    if (G.invuln > 0) G.invuln -= dt;
    if (G.magnetT > 0) G.magnetT -= dt;
    if (G.comboT > 0) { G.comboT -= dt; if (G.comboT <= 0) G.combo = 0; }
    G.mult = 1 + Math.min(4, Math.floor(G.combo / 6));

    G.runAnim += dt * eff * 0.045;
    G.blinkT -= dt;
    if (G.blinkT < -0.12) G.blinkT = 2 + Math.random() * 2.5;

    G.dustT -= dt;
    if (p.onGround && !p.sliding && G.dustT <= 0) {
      G.dustT = 0.13;
      G.parts.push({
        x: CAT_X - 8, y: G.groundY - 2, vx: -eff * 0.25, vy: rand(-30, -5),
        life: 0.35, max: 0.35, color: 'rgba(255,243,224,0.45)', size: 2, grav: 60
      });
    }

    for (var i = G.obstacles.length - 1; i >= 0; i--) {
      var o = G.obstacles[i];
      o.sx -= eff * dt;
      o.anim += dt;
      if (o.sx < -80) { G.obstacles.splice(i, 1); continue; }
      if (G.invuln <= 0 && !p.dead) {
        var oy = o.flying ? G.groundY - 14 + Math.sin(G.time * 6 + o.bob) * 2 : G.groundY - o.h;
        var hbx = o.sx + 2, hby = oy + 2, hbw = o.w - 4, hbh = o.h - 3;
        var cx = CAT_X - 5, cy = p.y - p.h + 2, cw = 10, ch = p.h - 3;
        if (cx < hbx + hbw && cx + cw > hbx && cy < hby + hbh && cy + ch > hby) {
          if (G.shield) {
            G.shield = false;
            G.invuln = 1.4;
            AU.play('shieldBreak');
            burst(CAT_X, p.y - 10, 14, ['#59f7ff', '#ffffff', '#bfefff'], 160);
          } else {
            p.dead = true;
            p.vy = -520;
            G.state = 'dying';
            G.deathT = 0;
            AU.play('hit');
            burst(CAT_X, p.y - 10, 18, ['#ffa63d', '#fff3e0', '#ff5d8f'], 200);
          }
        }
      }
    }

    var mr = G.magnetT > 0 ? magnetRadius() : 0;
    for (var j = G.pickups.length - 1; j >= 0; j--) {
      var pk = G.pickups[j];
      pk.sx -= eff * dt;
      if (pk.sx < -40) { G.pickups.splice(j, 1); continue; }
      var dx = CAT_X - pk.sx, dy = (p.y - 8) - pk.y;
      var dd = Math.sqrt(dx * dx + dy * dy);
      if (mr > 0 && dd < mr && dd > 1) {
        var pull = (mr - dd) / mr * 1400;
        pk.sx += (dx / dd) * pull * dt;
        pk.y += (dy / dd) * pull * dt;
      }
      var cx2 = CAT_X - 6, cy2 = p.y - p.h, cw2 = 12, ch2 = p.h;
      if (cx2 < pk.sx + pk.w && cx2 + cw2 > pk.sx && cy2 < pk.y + pk.h && cy2 + ch2 > pk.y) {
        G.pickups.splice(j, 1);
        if (pk.type === 'fish') {
          G.runFish++;
          G.combo++;
          G.comboT = 3.5;
          G.score += 10 * G.mult * (G.up.collar > 0 ? 2 : 1);
          AU.play('fish');
          burst(pk.sx + 5, pk.y + 3, 7, ['#ffd93d', '#ff6b81', '#fff3e0'], 120);
        } else if (pk.type === 'yarn') {
          G.magnetT = 7;
          AU.play('power');
          burst(pk.sx + 5, pk.y + 5, 10, ['#ff8fab', '#e0608a', '#ffffff'], 140);
        } else if (pk.type === 'milk') {
          G.shield = true;
          AU.play('power');
          burst(pk.sx + 4, pk.y + 6, 10, ['#59f7ff', '#fff8ee', '#ffffff'], 140);
        } else if (pk.type === 'star') {
          G.slowT = 6;
          AU.play('power');
          burst(pk.sx + 4, pk.y + 4, 10, ['#ffe066', '#ffb703', '#ffffff'], 140);
        }
      }
    }

    updateParts(dt);
  };

  function updateParts(dt) {
    for (var i = G.parts.length - 1; i >= 0; i--) {
      var q = G.parts[i];
      q.life -= dt;
      if (q.life <= 0) { G.parts.splice(i, 1); continue; }
      q.vy += (q.grav || 0) * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
  }

  function px(x, y, w, h, c) {
    G.sctx.fillStyle = c;
    G.sctx.fillRect(Math.round(x), Math.round(y), Math.ceil(w), Math.ceil(h));
  }

  function spr(img, x, y, w, h) {
    if (w === undefined) G.sctx.drawImage(img, Math.round(x), Math.round(y));
    else G.sctx.drawImage(img, Math.round(x), Math.round(y), w, h);
  }

  function drawHill(cx, baseY, R, color) {
    G.sctx.fillStyle = color;
    for (var r = 0; r < R; r++) {
      var hw = Math.sqrt(Math.max(0, R * R - (R - r) * (R - r)));
      var w = hw * 3.4;
      G.sctx.fillRect(Math.round(cx - w / 2), baseY - R + r, Math.ceil(w), 1);
    }
  }

  function drawTree(x, s, pal) {
    px(x, G.groundY - 12 * s, 4 * s, 12 * s, '#6b4226');
    px(x - 6 * s, G.groundY - 22 * s, 16 * s, 12 * s, pal.near);
    px(x - 3 * s, G.groundY - 28 * s, 10 * s, 8 * s, pal.near);
    px(x - 6 * s, G.groundY - 22 * s, 16 * s, 3 * s, shade(pal.near, 1.25));
  }

  function shade(c, f) {
    if (c[0] === '#') {
      var A = hx(c);
      return 'rgb(' + clamp(Math.round(A[0] * f), 0, 255) + ',' + clamp(Math.round(A[1] * f), 0, 255) + ',' + clamp(Math.round(A[2] * f), 0, 255) + ')';
    }
    return c;
  }

  function drawHouse(x, pal, night) {
    px(x, G.groundY - 26, 34, 26, '#e8b98a');
    px(x - 3, G.groundY - 32, 40, 8, '#c25b4a');
    px(x + 4, G.groundY - 8, 7, 8, '#6b4226');
    px(x + 20, G.groundY - 20, 9, 8, night > 0.4 ? '#ffe066' : '#9adfff');
    px(x + 4, G.groundY - 20, 9, 8, night > 0.4 ? '#ffe066' : '#9adfff');
  }

  function drawBush(x, s, pal) {
    px(x, G.groundY - 6 * s, 14 * s, 6 * s, pal.near);
    px(x + 2 * s, G.groundY - 9 * s, 9 * s, 4 * s, shade(pal.near, 1.2));
  }

  function drawFence(x, pal) {
    px(x, G.groundY - 8, 26, 8, '#a0713f');
    px(x, G.groundY - 8, 26, 2, '#c08b52');
    px(x + 2, G.groundY - 10, 3, 10, '#a0713f');
    px(x + 12, G.groundY - 10, 3, 10, '#a0713f');
    px(x + 21, G.groundY - 10, 3, 10, '#a0713f');
  }

  G.render = function () {
    var s = G.sctx;
    var W = G.W, pal = G.pal;
    G.buttons.length = 0;

    var grad = s.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, pal.sky0);
    grad.addColorStop(1, pal.sky1);
    s.fillStyle = grad;
    s.fillRect(0, 0, W, VIEW_H);

    if (pal.star > 0.02) {
      for (var i = 0; i < G.stars.length; i++) {
        var st = G.stars[i];
        var sx = mod(st.x - G.dist * 0.12, W + 40) - 20;
        var tw = 0.5 + 0.5 * Math.sin(G.time * 2 + st.tw);
        s.globalAlpha = pal.star * tw;
        s.fillStyle = '#ffffff';
        s.fillRect(Math.round(sx), st.y, st.s, st.s);
      }
      s.globalAlpha = 1;
    }

    var isDay = pal.cycle < 0.5;
    var ang = (isDay ? pal.cycle : pal.cycle - 0.5) * Math.PI * 2;
    var bodyX = W / 2 + (isDay ? 1 : -1) * Math.cos(ang) * W * 0.4;
    var bodyY = G.groundY - 26 - Math.sin(ang) * (G.groundY - 80);
    s.globalAlpha = 0.25;
    px(bodyX - 11, bodyY - 11, 22, 22, isDay ? '#ffd93d' : '#e8ecff');
    s.globalAlpha = 1;
    spr(isDay ? SP.sun : SP.moon, bodyX - 6, bodyY - 6);

    for (var c = 0; c < G.clouds.length; c++) {
      var cl = G.clouds[c];
      var cx = mod(cl.x - G.dist * 0.28, W + 260) - 130;
      s.globalAlpha = 0.85;
      spr(SP.cloud, cx, cl.y, SP.cloud.width * cl.sc, SP.cloud.height * cl.sc);
    }
    s.globalAlpha = 1;

    var hw = 170;
    var off = mod(G.dist * 0.45, hw);
    for (var x = -off; x < W + hw; x += hw) drawHill(x + hw / 2, G.groundY, 52, pal.far);
    var hw2 = 120;
    var off2 = mod(G.dist * 0.7, hw2);
    for (var x2 = -off2; x2 < W + hw2; x2 += hw2) drawHill(x2 + hw2 / 2, G.groundY, 30, pal.near);

    for (var m = 0; m < G.mid.length; m++) {
      var it = G.mid[m];
      var mx = it.x - G.dist * 0.85;
      if (mx < -80 || mx > W + 80) continue;
      if (it.type === 'tree') drawTree(mx, it.s, pal);
      else if (it.type === 'house') drawHouse(mx, pal, pal.star);
      else if (it.type === 'bush') drawBush(mx, it.s, pal);
      else drawFence(mx, pal);
    }

    px(0, G.groundY, W, GROUND_H, pal.dirt);
    px(0, G.groundY, W, 6, pal.grass);
    px(0, G.groundY + 6, W, 2, pal.grassD);
    var t0 = Math.floor(G.dist / 10);
    for (var tx = -mod(G.dist, 10); tx < W; tx += 10) {
      var idx = t0 + Math.floor((tx + mod(G.dist, 10)) / 10);
      spr(SP.speck, tx + (idx % 3), G.groundY + 9);
      if (mod(idx * 2654435761, 1000) < 160) spr(SP.tuft, tx + 3, G.groundY - 3);
    }
    for (var fl = 0; fl < G.flowers.length; fl++) {
      var f = G.flowers[fl];
      var fx = f.x - G.dist;
      if (fx < -10 || fx > W + 10) continue;
      spr(SP.flower, fx, G.groundY - 5);
    }

    for (var oi = 0; oi < G.obstacles.length; oi++) {
      var o = G.obstacles[oi];
      var def = OBS[o.type];
      var oy = o.flying ? G.groundY - 14 + Math.sin(G.time * 6 + o.bob) * 2 : G.groundY - o.h;
      if (def.anim) {
        spr(SP[def.img[Math.floor(o.anim * 8) % 2]], o.sx, oy);
      } else if (def.stack) {
        spr(SP.can, o.sx, G.groundY - 14);
        spr(SP.can, o.sx, G.groundY - 28);
      } else {
        spr(SP[def.img], o.sx, oy);
      }
    }

    for (var pi = 0; pi < G.pickups.length; pi++) {
      var pk = G.pickups[pi];
      var bob = Math.sin(G.time * 4 + pk.sx * 0.1) * 2;
      spr(SP[PICKUP[pk.type].img], pk.sx, pk.y + bob);
    }

    drawCat();

    for (var qi = 0; qi < G.parts.length; qi++) {
      var q = G.parts[qi];
      s.globalAlpha = clamp(q.life / q.max, 0, 1);
      px(q.x, q.y, q.size, q.size, q.color);
    }
    s.globalAlpha = 1;

    if (pal.dim > 0.01) {
      s.fillStyle = 'rgba(12,8,38,' + pal.dim.toFixed(3) + ')';
      s.fillRect(0, 0, W, VIEW_H);
    }
    if (G.slowT > 0 && G.state === 'playing') {
      s.fillStyle = 'rgba(89,247,255,0.07)';
      s.fillRect(0, 0, W, VIEW_H);
    }

    if (G.state === 'title') drawTitle();
    else if (G.state === 'playing' || G.state === 'dying') drawHUD();
    else if (G.state === 'over') drawOver();
    else if (G.state === 'paused') drawPause();

    G.ctx.imageSmoothingEnabled = false;
    G.ctx.clearRect(0, 0, G.canvas.width, G.canvas.height);
    G.ctx.drawImage(G.screen, 0, 0, G.canvas.width, G.canvas.height);
  };

  function drawCat() {
    var p = G.player;
    var s = G.sctx;
    if (G.state === 'dying' || p.dead) {
      spr(SP.catDead, CAT_X - 4, Math.round(p.y - 10));
      return;
    }
    if (G.invuln > 0 && Math.floor(G.time * 14) % 2 === 0 && G.state === 'playing') return;
    var img;
    if (p.sliding) img = SP.catSlide;
    else if (p.onGround) img = SP.catRun[Math.floor(G.runAnim) % 4];
    else img = SP.catJump;
    var dy = Math.round(p.y - img.height);
    spr(img, CAT_X - 4, dy);
    if (img.height === 16 || img === SP.catSlide) {
      var blink = G.blinkT < 0;
      s.fillStyle = INK;
      if (blink) s.fillRect(CAT_X - 4 + 15, dy + 5, 4, 1);
      else s.fillRect(CAT_X - 4 + 16, dy + 4, 2, 2);
    }
    if (G.shield) {
      s.fillStyle = '#59f7ff';
      var cx = CAT_X + 6, cy = p.y - 9, r = 15;
      for (var a = 0; a < 8; a++) {
        var an = a / 8 * Math.PI * 2 + G.time * 3;
        s.fillRect(Math.round(cx + Math.cos(an) * r), Math.round(cy + Math.sin(an) * r * 0.7), 2, 2);
      }
    }
  }

  function panel(x, y, w, h, bg, border) {
    px(x, y, w, h, bg);
    px(x, y, w, 3, border);
    px(x, y + h - 3, w, 3, shade(border, 0.55));
    px(x, y, 3, h, border);
    px(x + w - 3, y, 3, h, shade(border, 0.55));
  }

  function button(id, x, y, w, h, label, cb, scale) {
    var b = { id: id, x: x, y: y, w: w, h: h, label: label, cb: cb, scale: scale || 1 };
    G.buttons.push(b);
    var hi = '#8f7bff', lo = '#3b2a63', bg = '#5b3fd4';
    px(x, y, w, h, bg);
    px(x, y, w, 2, hi);
    px(x, y + h - 3, w, 3, lo);
    px(x, y, 2, h, hi);
    px(x + w - 2, y, 2, h, lo);
    var sc = scale || 1;
    F.draw(G.sctx, label, x + w / 2, y + (h - 5 * sc) / 2, sc, '#ffffff', 'center');
    return b;
  }

  function iconBtn(id, x, y, w, h, drawIcon, cb) {
    var b = { id: id, x: x, y: y, w: w, h: h, cb: cb, icon: drawIcon };
    G.buttons.push(b);
    px(x, y, w, h, 'rgba(43,33,56,0.55)');
    px(x, y, w, 2, 'rgba(255,255,255,0.25)');
    px(x, y + h - 2, w, 2, 'rgba(0,0,0,0.3)');
    drawIcon(x, y, w, h);
    return b;
  }

  function drawMuteIcon(x, y, w, h) {
    spr(SP.note, x + w / 2 - 3, y + 3, 6, 10);
    if (G.muted) {
      G.sctx.fillStyle = '#ff5d8f';
      G.sctx.fillRect(Math.round(x + 3), Math.round(y + h / 2), w - 6, 2);
    }
  }

  function drawPauseIcon(x, y, w, h) {
    G.sctx.fillStyle = '#ffffff';
    G.sctx.fillRect(Math.round(x + w / 2 - 4), Math.round(y + 4), 3, h - 8);
    G.sctx.fillRect(Math.round(x + w / 2 + 1), Math.round(y + 4), 3, h - 8);
  }

  function drawTitle() {
    var W = G.W;
    var cx = W / 2;
    F.drawShadow(G.sctx, 'PIXEL CAT', cx, 34, 4, '#ffd93d', INK, 'center');
    F.drawShadow(G.sctx, "VIBE'S ENDLESS RUN", cx, 58, 1, '#ffffff', INK, 'center');
    spr(SP.catRun[Math.floor(G.runAnim) % 4], W - 78, 30, 60, 48);
    if (Math.floor(G.time * 2) % 2 === 0) {
      F.drawShadow(G.sctx, 'TAP TO START', cx, 84, 2, '#7dff8a', INK, 'center');
    }
    F.draw(G.sctx, 'BEST ' + G.best, 10, 12, 1, 'rgba(255,255,255,0.9)');
    spr(SP.fish, 10, 26, 14, 8);
    F.draw(G.sctx, '' + G.bank, 28, 27, 1, '#ffd93d');

    F.draw(G.sctx, 'TAP: JUMP (HOLD = HIGHER)', cx, 116, 1, 'rgba(255,255,255,0.85)', 'center');
    F.draw(G.sctx, 'SWIPE DOWN: SLIDE UNDER DRONES', cx, 126, 1, 'rgba(255,255,255,0.85)', 'center');

    var ids = ['shield', 'magnet', 'collar'];
    var cw = Math.min(150, (W - 44) / 3);
    var gap = 8;
    var x0 = cx - (cw * 3 + gap * 2) / 2;
    var y0 = 150;
    var ch = 78;
    for (var i = 0; i < 3; i++) {
      var id = ids[i];
      var def = SHOP[id];
      var lvl = G.up[id];
      var x = x0 + i * (cw + gap);
      var maxed = lvl >= def.costs.length;
      var cost = maxed ? 0 : def.costs[lvl];
      var afford = G.bank >= cost;
      panel(x, y0, cw, ch, maxed ? 'rgba(46,84,44,0.85)' : afford ? 'rgba(91,63,212,0.9)' : 'rgba(43,33,56,0.8)', maxed ? '#7dff8a' : afford ? '#8f7bff' : '#5a5470');
      F.draw(G.sctx, def.name, x + cw / 2, y0 + 8, 1, '#ffffff', 'center');
      F.draw(G.sctx, def.desc, x + cw / 2, y0 + 20, 1, 'rgba(255,255,255,0.7)', 'center');
      var pip = '';
      for (var k = 0; k < def.costs.length; k++) pip += k < lvl ? '*' : '.';
      F.draw(G.sctx, 'LV ' + pip, x + cw / 2, y0 + 34, 1, '#ffd93d', 'center');
      if (maxed) {
        F.draw(G.sctx, 'MAX', x + cw / 2, y0 + 52, 1, '#7dff8a', 'center');
      } else {
        spr(SP.fish, x + cw / 2 - 22, y0 + 52, 12, 7);
        F.draw(G.sctx, '' + cost, x + cw / 2 + 2, y0 + 52, 1, afford ? '#ffd93d' : '#ff8f8f', 'center');
      }
      G.buttons.push({ id: 'buy:' + id, x: x, y: y0, w: cw, h: ch, cb: (function (id2) { return function () { G.buy(id2); }; })(id) });
    }

    F.draw(G.sctx, 'EARN FISH EVERY RUN - SPEND THEM HERE', cx, y0 + ch + 10, 1, 'rgba(255,255,255,0.6)', 'center');
    iconBtn('mute', W - 30, 8, 22, 18, drawMuteIcon, function () { G.toggleMute(); });
  }

  function drawHUD() {
    var W = G.W;
    F.drawShadow(G.sctx, '' + Math.floor(G.score), 10, 8, 2, '#ffffff', INK);
    spr(SP.fish, 10, 28, 14, 8);
    F.draw(G.sctx, '' + G.runFish, 28, 28, 1, '#ffd93d');
    if (G.mult > 1) F.draw(G.sctx, 'X' + G.mult, 52, 28, 1, '#7dff8a');
    F.draw(G.sctx, 'BEST ' + G.best, W - 62, 10, 1, 'rgba(255,255,255,0.75)', 'right');

    var py = 42;
    if (G.shield) { spr(SP.milk, 10, py, 12, 16); py += 22; }
    if (G.magnetT > 0) {
      spr(SP.yarn, 10, py, 12, 12);
      px(26, py + 4, 24 * (G.magnetT / 7), 3, '#ff8fab');
      py += 18;
    }
    if (G.slowT > 0) {
      spr(SP.star, 10, py, 12, 12);
      px(26, py + 4, 24 * (G.slowT / 6), 3, '#ffe066');
    }

    iconBtn('pause', W - 30, 8, 22, 18, drawPauseIcon, function () { G.togglePause(); });
    iconBtn('mute', W - 56, 8, 22, 18, drawMuteIcon, function () { G.toggleMute(); });
  }

  function drawOver() {
    var W = G.W, cx = W / 2;
    G.sctx.fillStyle = 'rgba(12,8,38,0.55)';
    G.sctx.fillRect(0, 0, W, VIEW_H);
    var pw = Math.min(W - 40, 250), ph = 168;
    var px0 = cx - pw / 2, py0 = 36;
    panel(px0, py0, pw, ph, 'rgba(43,33,56,0.95)', '#8f7bff');
    F.drawShadow(G.sctx, 'GAME OVER', cx, py0 + 14, 3, '#ff6b81', INK, 'center');
    F.draw(G.sctx, 'SCORE ' + Math.floor(G.score), cx, py0 + 48, 2, '#ffffff', 'center');
    if (G.newBest && Math.floor(G.time * 3) % 2 === 0) {
      F.draw(G.sctx, 'NEW BEST!', cx, py0 + 66, 1, '#7dff8a', 'center');
    } else {
      F.draw(G.sctx, 'BEST ' + G.best, cx, py0 + 66, 1, 'rgba(255,255,255,0.8)', 'center');
    }
    spr(SP.fish, cx - 34, py0 + 82, 14, 8);
    F.draw(G.sctx, '+' + G.runFish + ' FISH  (BANK ' + G.bank + ')', cx + 22, py0 + 83, 1, '#ffd93d', 'center');
    F.draw(G.sctx, Math.floor(G.dist) + ' M', cx, py0 + 100, 1, 'rgba(255,255,255,0.7)', 'center');
    button('retry', px0 + 14, py0 + ph - 34, 100, 24, 'RETRY', function () { G.retry(); }, 1);
    button('menu', px0 + pw - 114, py0 + ph - 34, 100, 24, 'MENU', function () { G.toMenu(); }, 1);
    if (G.overT > 0.6 && Math.floor(G.time * 2) % 2 === 0) {
      F.draw(G.sctx, 'OR TAP ANYWHERE', cx, py0 + ph - 42, 1, 'rgba(255,255,255,0.7)', 'center');
    }
  }

  function drawPause() {
    var W = G.W, cx = W / 2;
    G.sctx.fillStyle = 'rgba(12,8,38,0.6)';
    G.sctx.fillRect(0, 0, W, VIEW_H);
    F.drawShadow(G.sctx, 'PAUSED', cx, 70, 3, '#ffffff', INK, 'center');
    button('resume', cx - 60, 120, 120, 26, 'RESUME', function () { G.togglePause(); }, 1);
    button('restart', cx - 60, 154, 120, 26, 'RESTART', function () { G.start(); }, 1);
    button('menu', cx - 60, 188, 120, 26, 'MENU', function () { G.toMenu(); }, 1);
    iconBtn('mute', W - 30, 8, 22, 18, drawMuteIcon, function () { G.toggleMute(); });
  }

  function hitButton(x, y) {
    for (var i = G.buttons.length - 1; i >= 0; i--) {
      var b = G.buttons[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
    }
    return null;
  }

  function toView(e) {
    var r = G.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / Math.max(1, r.width) * G.W,
      y: (e.clientY - r.top) / Math.max(1, r.height) * VIEW_H
    };
  }

  G.pressAt = function (x, y) {
    AU.ensure();
    var b = hitButton(x, y);
    if (b) { b.cb(); return; }
    if (G.state === 'title') { G.start(); return; }
    if (G.state === 'over') { if (G.overT > 0.6) G.retry(); return; }
    if (G.state === 'playing') {
      G.input.down = true;
      G.tryJump();
    }
  };

  G.releaseAt = function () {
    G.input.down = false;
    G.input.slideHeld = false;
    G.input.swiped = false;
    var p = G.player;
    if (G.state === 'playing' && !p.dead && p.vy < -280) p.vy = -280;
  };

  G.swipeDown = function () {
    if (G.state === 'playing') { G.input.swiped = true; G.trySlide(); }
  };

  function bindInput() {
    var c = G.canvas;
    function pd(e) {
      e.preventDefault();
      var v = toView(e);
      G.input.downX = v.x;
      G.input.downY = v.y;
      G.pressAt(v.x, v.y);
    }
    function pm(e) {
      if (!G.input.down && G.state !== 'playing') return;
      var v = toView(e);
      if (!G.input.swiped && v.y - G.input.downY > 26 && Math.abs(v.x - G.input.downX) < 60) G.swipeDown();
    }
    function pu(e) {
      if (e) e.preventDefault();
      G.releaseAt();
    }
    c.addEventListener('pointerdown', pd);
    c.addEventListener('pointermove', pm);
    c.addEventListener('pointerup', pu);
    c.addEventListener('pointercancel', pu);
    c.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (G.state === 'title') G.start();
        else if (G.state === 'over' && G.overT > 0.6) G.retry();
        else if (G.state === 'playing') { G.input.down = true; G.tryJump(); }
      } else if (e.code === 'ArrowDown' || e.code === 'KeyS') {
        e.preventDefault();
        if (G.state === 'playing') G.trySlide();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        G.togglePause();
      } else if (e.code === 'KeyM') {
        G.toggleMute();
      } else if (e.code === 'Enter') {
        if (G.state === 'title') G.start();
        else if (G.state === 'over' && G.overT > 0.6) G.retry();
      }
    });
    window.addEventListener('resize', function () { G.resize(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && G.state === 'playing') G.state = 'paused';
    });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    G.init();
  } else {
    document.addEventListener('DOMContentLoaded', function () { G.init(); });
  }

  PC.game = G;
})();
