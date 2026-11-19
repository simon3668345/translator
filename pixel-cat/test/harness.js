'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.PC_SHOTS || path.join(require('os').tmpdir(), 'pc-shots');
fs.mkdirSync(SHOTS, { recursive: true });

let failures = 0;
let checks = 0;
function ok(cond, msg) {
  checks++;
  if (cond) console.log('  PASS ' + msg);
  else { failures++; console.log('  FAIL ' + msg); }
}
function section(name) { console.log('\n== ' + name + ' =='); }

/* ---------------- PNG encoder ---------------- */
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------------- color parsing ---------------- */
const colorCache = {};
function parseColor(c) {
  if (typeof c !== 'string') return null;
  if (colorCache[c]) return colorCache[c];
  let r = 0, g = 0, b = 0, a = 255;
  if (c[0] === '#') {
    const h = c.slice(1);
    if (h.length === 3) {
      r = parseInt(h[0] + h[0], 16); g = parseInt(h[1] + h[1], 16); b = parseInt(h[2] + h[2], 16);
    } else {
      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);
    }
  } else if (c.startsWith('rgb')) {
    const m = c.match(/[\d.]+/g);
    r = +m[0]; g = +m[1]; b = +m[2];
    if (m.length > 3) a = Math.round(parseFloat(m[3]) * 255);
  }
  const out = [r, g, b, a];
  colorCache[c] = out;
  return out;
}

/* ---------------- mock canvas ---------------- */
class MockGradient {
  constructor(x0, y0, x1, y1) {
    this.x0 = x0; this.y0 = y0; this.x1 = x1; this.y1 = y1;
    this.stops = [];
  }
  addColorStop(off, color) { this.stops.push([off, parseColor(color)]); }
  at(t) {
    const s = this.stops;
    if (!s.length) return [0, 0, 0, 255];
    if (t <= s[0][0]) return s[0][1];
    for (let i = 0; i < s.length - 1; i++) {
      if (t >= s[i][0] && t <= s[i + 1][0]) {
        const f = (t - s[i][0]) / Math.max(1e-6, s[i + 1][0] - s[i][0]);
        const A = s[i][1], B = s[i + 1][1];
        return [
          Math.round(A[0] + (B[0] - A[0]) * f),
          Math.round(A[1] + (B[1] - A[1]) * f),
          Math.round(A[2] + (B[2] - A[2]) * f),
          Math.round(A[3] + (B[3] - A[3]) * f)
        ];
      }
    }
    return s[s.length - 1][1];
  }
}

class MockCtx {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000000';
    this.globalAlpha = 1;
    this.imageSmoothingEnabled = true;
  }
  _resolve(px, py) {
    const f = this.fillStyle;
    if (f instanceof MockGradient) {
      const dx = f.x1 - f.x0, dy = f.y1 - f.y0;
      const len2 = dx * dx + dy * dy || 1;
      let t = ((px - f.x0) * dx + (py - f.y0) * dy) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      return f.at(t);
    }
    return parseColor(f) || [0, 0, 0, 255];
  }
  fillRect(x, y, w, h) {
    const c = this.canvas;
    x = Math.floor(x); y = Math.floor(y);
    w = Math.ceil(w); h = Math.ceil(h);
    const ga = this.globalAlpha;
    for (let j = 0; j < h; j++) {
      const py = y + j;
      if (py < 0 || py >= c.height) continue;
      for (let i = 0; i < w; i++) {
        const pxx = x + i;
        if (pxx < 0 || pxx >= c.width) continue;
        const col = this._resolve(pxx + 0.5, py + 0.5);
        const sa = (col[3] / 255) * ga;
        if (sa <= 0) continue;
        const di = (py * c.width + pxx) * 4;
        const da = c._px[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        c._px[di] = Math.round((col[0] * sa + c._px[di] * da * (1 - sa)) / oa);
        c._px[di + 1] = Math.round((col[1] * sa + c._px[di + 1] * da * (1 - sa)) / oa);
        c._px[di + 2] = Math.round((col[2] * sa + c._px[di + 2] * da * (1 - sa)) / oa);
        c._px[di + 3] = Math.round(oa * 255);
      }
    }
  }
  clearRect(x, y, w, h) {
    const c = this.canvas;
    x = Math.floor(x); y = Math.floor(y);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const pxx = x + i, py = y + j;
        if (pxx < 0 || py < 0 || pxx >= c.width || py >= c.height) continue;
        const di = (py * c.width + pxx) * 4;
        c._px[di + 3] = 0;
      }
    }
  }
  createLinearGradient(x0, y0, x1, y1) { return new MockGradient(x0, y0, x1, y1); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { return new MockGradient(x0, y0, x1, y1); }
  drawImage(img, a, b, cc, d, e, f, g, h) {
    let sx, sy, sw, sh, dx, dy, dw, dh;
    if (arguments.length === 3) { sx = 0; sy = 0; sw = img.width; sh = img.height; dx = a; dy = b; dw = sw; dh = sh; }
    else if (arguments.length === 5) { sx = 0; sy = 0; sw = img.width; sh = img.height; dx = a; dy = b; dw = cc; dh = d; }
    else { sx = a; sy = b; sw = cc; sh = d; dx = e; dy = f; dw = g; dh = h; }
    const c = this.canvas;
    const ga = this.globalAlpha;
    dx = Math.floor(dx); dy = Math.floor(dy);
    if (!img._xmap) img._xmap = {};
    const key = dw + ':' + sw + ':' + sx;
    let xm = img._xmap[key];
    if (!xm) {
      xm = new Int32Array(dw);
      for (let i = 0; i < dw; i++) xm[i] = Math.min(img.width - 1, Math.floor(i / dw * sw) + sx);
      img._xmap[key] = xm;
    }
    if (!c._px32) c._px32 = new Uint32Array(c._px.buffer, c._px.byteOffset, c._px.length >> 2);
    const px32 = c._px32;
    const opaque = ga >= 1;
    for (let j = 0; j < dh; j++) {
      const py = dy + j;
      if (py < 0 || py >= c.height) continue;
      const syy = Math.min(img.height - 1, Math.floor(j / dh * sh) + sy);
      const srow = syy * img.width;
      const drow = py * c.width;
      for (let i = 0; i < dw; i++) {
        const pxx = dx + i;
        if (pxx < 0 || pxx >= c.width) continue;
        const si = (srow + xm[i]) << 2;
        const sa = (img._px[si + 3] / 255) * ga;
        if (sa <= 0) continue;
        const di32 = drow + pxx;
        if (opaque && img._px[si + 3] === 255) {
          px32[di32] = 0xFF000000 | (img._px[si + 2] << 16) | (img._px[si + 1] << 8) | img._px[si];
          continue;
        }
        const di = di32 << 2;
        const da = c._px[di + 3] / 255;
        const oa = sa + da * (1 - sa);
        if (oa <= 0) continue;
        c._px[di] = Math.round((img._px[si] * sa + c._px[di] * da * (1 - sa)) / oa);
        c._px[di + 1] = Math.round((img._px[si + 1] * sa + c._px[di + 1] * da * (1 - sa)) / oa);
        c._px[di + 2] = Math.round((img._px[si + 2] * sa + c._px[di + 2] * da * (1 - sa)) / oa);
        c._px[di + 3] = Math.round(oa * 255);
      }
    }
  }
  getImageData(x, y, w, h) {
    const c = this.canvas;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const si = ((y + j) * c.width + (x + i)) * 4;
        const di = (j * w + i) * 4;
        if (si >= 0 && si < c._px.length) {
          data[di] = c._px[si]; data[di + 1] = c._px[si + 1];
          data[di + 2] = c._px[si + 2]; data[di + 3] = c._px[si + 3];
        }
      }
    }
    return { data, width: w, height: h };
  }
}

class MockCanvas {
  constructor() {
    this._w = 300; this._h = 150;
    this._px = new Uint8ClampedArray(300 * 150 * 4);
    this._ctx = null;
    this.style = {};
    this.listeners = {};
  }
  get width() { return this._w; }
  set width(v) { this._w = Math.max(1, v | 0); this._px = new Uint8ClampedArray(this._w * this._h * 4); this._px32 = null; }
  get height() { return this._h; }
  set height(v) { this._h = Math.max(1, v | 0); this._px = new Uint8ClampedArray(this._w * this._h * 4); this._px32 = null; }
  getContext(kind) {
    if (!this._ctx) this._ctx = new MockCtx(this);
    return this._ctx;
  }
  addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); }
  removeEventListener() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, right: this._envW || 1024, bottom: this._envH || 768, width: this._envW || 1024, height: this._envH || 768 };
  }
  toBuffer() { return Buffer.from(this._px.buffer, this._px.byteOffset, this._px.length); }
}

/* ---------------- mock audio ---------------- */
function paramMock() {
  return {
    value: 0,
    setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, cancelScheduledValues() {}
  };
}
class MockAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = 'running';
    this.sampleRate = 44100;
    this.destination = {};
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  createGain() { return { gain: paramMock(), connect() {}, disconnect() {} }; }
  createOscillator() { return { type: '', frequency: paramMock(), detune: paramMock(), connect() {}, start() {}, stop() {} }; }
  createBuffer(ch, len, sr) { return { getChannelData() { return new Float32Array(len); } }; }
  createBufferSource() { return { buffer: null, loop: false, playbackRate: paramMock(), connect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: '', frequency: paramMock(), Q: paramMock(), gain: paramMock(), connect() {} }; }
}

/* ---------------- environment ---------------- */
function makeEnv(opts) {
  opts = opts || {};
  const W = opts.width || 800, H = opts.height || 500;
  const store = opts.store || {};
  const canvas = new MockCanvas();
  canvas._envW = W; canvas._envH = H;
  const docListeners = {};
  const winListeners = {};
  let nowMs = 1000;
  let rafCb = null;
  const sandbox = {
    console,
    Math, JSON, Promise, Float32Array, Uint8ClampedArray,
    innerWidth: W, innerHeight: H, devicePixelRatio: 1,
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; }
    },
    requestAnimationFrame: f => { rafCb = f; },
    performance: { now: () => nowMs },
    AudioContext: MockAudioContext,
    navigator: { maxTouchPoints: 5 },
    location: { href: 'http://localhost/pixel-cat/' },
    document: {
      readyState: 'complete',
      hidden: false,
      getElementById: id => (id === 'game' ? canvas : { style: {} }),
      createElement: tag => (tag === 'canvas' ? new MockCanvas() : { style: {} }),
      addEventListener: (t, f) => { (docListeners[t] = docListeners[t] || []).push(f); },
      body: { style: {} }
    }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.addEventListener = (t, f) => { (winListeners[t] = winListeners[t] || []).push(f); };
  vm.createContext(sandbox);
  if (!opts.noLoad) {
    for (const f of ['font.js', 'sprites.js', 'audio.js', 'game.js']) {
      const code = fs.readFileSync(path.join(ROOT, 'js', f), 'utf8');
      vm.runInContext(code, sandbox, { filename: f });
    }
  }
  const env = {
    sandbox,
    canvas,
    store,
    get PC() { return sandbox.PC; },
    step(ms) {
      nowMs += ms;
      const g = sandbox.PC && sandbox.PC.game;
      if (g && g.ctx && g.ctx instanceof MockAudioContext) {}
      const cb = rafCb;
      rafCb = null;
      if (cb) cb(nowMs);
      const audio = sandbox.PC.audio;
      if (audio.ctx) audio.ctx.currentTime = nowMs / 1000;
    },
    steps(n, ms) { for (let i = 0; i < n; i++) this.step(ms || 1000 / 60); },
    fire(type, x, y) {
      const e = { clientX: x, clientY: y, preventDefault() {}, pointerId: 1 };
      (canvas.listeners[type] || []).forEach(f => f(e));
    },
    key(code) {
      (winListeners.keydown || []).forEach(f => f({ code, preventDefault() {} }));
    },
    shot(name, scale) {
      const g = sandbox.PC.game;
      const sc = g.screen;
      const s = scale || 3;
      const w = sc.width * s, h = sc.height * s;
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const si = (Math.floor(y / s) * sc.width + Math.floor(x / s)) * 4;
          const di = (y * w + x) * 4;
          out[di] = sc._px[si]; out[di + 1] = sc._px[si + 1];
          out[di + 2] = sc._px[si + 2]; out[di + 3] = sc._px[si + 3];
        }
      }
      fs.writeFileSync(path.join(SHOTS, name + '.png'), encodePNG(w, h, out));
      console.log('  shot -> ' + path.join(SHOTS, name + '.png'));
    },
    shotDisplay(name, scale) {
      const sc = canvas;
      const s = scale || 2;
      const w = sc.width * s, h = sc.height * s;
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const si = (Math.floor(y / s) * sc.width + Math.floor(x / s)) * 4;
          const di = (y * w + x) * 4;
          out[di] = sc._px[si]; out[di + 1] = sc._px[si + 1];
          out[di + 2] = sc._px[si + 2]; out[di + 3] = sc._px[si + 3];
        }
      }
      fs.writeFileSync(path.join(SHOTS, name + '.png'), encodePNG(w, h, out));
      console.log('  shot -> ' + path.join(SHOTS, name + '.png'));
    },
    shotCrop(name, cx, cy, cw, ch, s) {
      const g = sandbox.PC.game;
      const sc = g.screen;
      const w = cw * s, h = ch * s;
      const out = new Uint8ClampedArray(w * h * 4);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = Math.min(sc.width - 1, Math.max(0, cx + Math.floor(x / s)));
          const sy = Math.min(sc.height - 1, Math.max(0, cy + Math.floor(y / s)));
          const si = (sy * sc.width + sx) * 4;
          const di = (y * w + x) * 4;
          out[di] = sc._px[si]; out[di + 1] = sc._px[si + 1];
          out[di + 2] = sc._px[si + 2]; out[di + 3] = sc._px[si + 3];
        }
      }
      fs.writeFileSync(path.join(SHOTS, name + '.png'), encodePNG(w, h, out));
      console.log('  shot -> ' + path.join(SHOTS, name + '.png'));
    }
  };
  return env;
}

function dumpSprite(label, img) {
  let out = label + ' (' + img.width + 'x' + img.height + ')\n';
  for (let y = 0; y < img.height; y++) {
    let row = '';
    for (let x = 0; x < img.width; x++) {
      const a = img._px[(y * img.width + x) * 4 + 3];
      row += a > 0 ? '#' : '.';
    }
    out += row + '\n';
  }
  console.log(out);
}

/* ---------------- bot ---------------- */
function botFrame(env) {
  const g = env.PC.game;
  if (g.state === 'title') { g.pressAt(g.W / 2, 100); return; }
  if (g.state === 'over') { if (g.overT > 0.7) g.pressAt(g.W / 2, 100); return; }
  if (g.state !== 'playing') return;
  const px = 70;
  let threat = null, tdist = 1e9;
  for (const o of g.obstacles) {
    const rel = o.sx - px;
    if (rel > -20 && rel < tdist) { tdist = rel; threat = o; }
  }
  if (threat && threat.flying && tdist < g.speed * 0.32) {
    g.trySlide();
    g.input.slideHeld = true;
    g.input.down = false;
    return;
  }
  if (g.input.slideHeld) {
    const still = g.obstacles.some(o => o.flying && o.sx - px > -12 && o.sx - px < g.speed * 0.55);
    if (!still) g.input.slideHeld = false;
  }
  if (threat && !threat.flying && tdist < g.speed * 0.55 && g.player.onGround && !g.player.sliding) {
    g.tryJump();
    g.input.down = true;
    return;
  }
  if (g.player.onGround && g.input.down) g.releaseAt();
}

/* ---------------- tests ---------------- */
async function main() {
  section('boot & title (landscape tablet 1180x820)');
  const env = makeEnv({ width: 800, height: 500 });
  const g = env.PC.game;
  ok(!!g, 'game object exists after load');
  ok(g.state === 'title', 'initial state is title, got ' + g.state);
  ok(g.W >= 340 && g.W <= 660, 'view width computed: ' + g.W);
  env.steps(90);
  ok(g.state === 'title', 'still on title after 1.5s idle');
  env.shot('01-title');
  let painted = 0;
  for (let i = 0; i < env.canvas._px.length; i += 4) if (env.canvas._px[i + 3] > 0) painted++;
  ok(painted > env.canvas.width * env.canvas.height * 0.5, 'visible display canvas is painted (not blank): ' + painted + ' px with alpha>0');
  env.shotDisplay('01b-display-canvas');

  section('sprites (ASCII dump for visual review)');
  if (process.env.DUMP_SPRITES) {
    const names = ['catRun', 'catJump', 'catSlide', 'catDead', 'fish', 'yarn', 'milk', 'star', 'can', 'cone', 'hydrant', 'dogA', 'dogB', 'droneA', 'droneB', 'cloud', 'sun', 'moon', 'flower', 'heart', 'note'];
    for (const n of names) {
      const v = env.PC.sprites[n];
      if (Array.isArray(v)) v.forEach((img, i) => dumpPNG(n + i, img));
      else if (v && v.width) dumpPNG(n, v);
    }
  }
  function dumpPNG(name, img) {
    const s = 8;
    const w = img.width * s, h = img.height * s;
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const si = (Math.floor(y / s) * img.width + Math.floor(x / s)) * 4;
      const di = (y * w + x) * 4;
      out[di] = img._px[si]; out[di + 1] = img._px[si + 1]; out[di + 2] = img._px[si + 2]; out[di + 3] = img._px[si + 3];
    }
    fs.writeFileSync(path.join(SHOTS, 'sprite-' + name + '.png'), encodePNG(w, h, out));
  }
  dumpSprite('catRun0', env.PC.sprites.catRun[0]);
  dumpSprite('catRun1', env.PC.sprites.catRun[1]);
  dumpSprite('catJump', env.PC.sprites.catJump);
  dumpSprite('catSlide', env.PC.sprites.catSlide);
  dumpSprite('fish', env.PC.sprites.fish);
  dumpSprite('droneA', env.PC.sprites.droneA);
  dumpSprite('dogA', env.PC.sprites.dogA);

  section('start game + bot plays 45s');
  g.pressAt(g.W / 2, 100);
  ok(g.state === 'playing', 'tap starts the run');
  let maxScore = 0, totalFish = 0, deaths = 0, runs = 0, maxSpeed = 0, spawnedTotal = 0;
  let runStartDist = 0, bestRunTime = 0, curRunTime = 0;
  let wasAlive = true;
  for (let i = 0; i < 45 * 60; i++) {
    botFrame(env);
    env.step(1000 / 60);
    if (g.state === 'playing' || g.state === 'dying') {
      curRunTime += 1 / 60;
      maxScore = Math.max(maxScore, g.score);
      maxSpeed = Math.max(maxSpeed, g.speed);
      spawnedTotal = g.obstacles.length + spawnedTotal * 0; // snapshot below
    }
    if (g.state === 'over') {
      if (wasAlive) { deaths++; runs++; bestRunTime = Math.max(bestRunTime, curRunTime); }
      wasAlive = false;
      totalFish += g.runFish;
      curRunTime = 0;
    }
    if (g.state === 'playing' && !wasAlive) { wasAlive = true; curRunTime = 0; }
  }
  ok(deaths >= 0 && runs >= 1, 'bot completed at least one run (runs=' + runs + ', deaths=' + deaths + ')');
  ok(maxScore > 300, 'bot scored > 300 (max ' + Math.floor(maxScore) + ')');
  g.dist = 5000;
  g.slowT = 0;
  env.step(1000 / 60);
  ok(g.speed > 280, 'speed ramps with distance: dist=5000 -> speed=' + Math.floor(g.speed));
  g.dist = 0;
  ok(totalFish > 0, 'bot collected fish across runs: ' + totalFish);
  ok(bestRunTime > 8, 'bot survived a run > 8s (best ' + bestRunTime.toFixed(1) + 's) — patterns are survivable');
  env.shot('02-play-day');

  section('day/night cycle');
  g.tod = 40 * 0.5 + 0.5;
  env.steps(30);
  env.shot('03-play-night');
  ok(g.pal.star > 0.5, 'night phase has stars (star=' + g.pal.star.toFixed(2) + ')');
  g.tod = 40 * 0.25 + 0.5;
  env.steps(30);
  env.shot('04-play-dusk');

  section('no input => game over, score saved, retry works');
  const env2 = makeEnv({ width: 1180, height: 820, store: env.store });
  const g2 = env2.PC.game;
  ok(g2.best > 0, 'best score persisted across reload: ' + g2.best);
  g2.pressAt(g2.W / 2, 100);
  ok(g2.state === 'playing', 'second env started a run');
  let overFrames = 0;
  while (g2.state !== 'over' && overFrames < 60 * 30) { env2.step(1000 / 60); overFrames++; }
  ok(g2.state === 'over', 'run ends without input after ' + (overFrames / 60).toFixed(1) + 's');
  ok(g2.score > 0, 'distance score accumulated: ' + Math.floor(g2.score));
  ok(g2.best >= Math.floor(g2.score) || g2.newBest, 'best updated');
  env2.steps(50);
  env2.shot('05-gameover');
  g2.pressAt(g2.W / 2, 100);
  ok(g2.state === 'playing', 'tap after game over retries');

  section('pause / mute / keys');
  env2.key('KeyP');
  ok(g2.state === 'paused', 'P pauses');
  const d0 = g2.dist;
  env2.steps(30);
  ok(g2.dist === d0, 'world frozen while paused');
  env2.key('KeyP');
  ok(g2.state === 'playing', 'P resumes');
  env2.key('KeyM');
  ok(g2.muted === true && env2.PC.audio.muted === true, 'M mutes audio');
  ok(JSON.parse(env2.store.pc_save).muted === true, 'mute persisted to localStorage');
  env2.key('KeyM');

  section('shop purchases');
  g2.bank = 1000;
  ok(g2.buy('shield') === true && g2.up.shield === 1 && g2.bank === 850, 'bought 9 LIVES for 150 (bank ' + g2.bank + ')');
  ok(g2.buy('magnet') === true && g2.up.magnet === 1 && g2.bank === 600, 'bought MAGNET lvl1 for 250');
  ok(g2.buy('magnet') === true && g2.up.magnet === 2 && g2.bank === 100, 'bought MAGNET lvl2 for 500');
  ok(g2.buy('collar') === false && g2.bank === 100, 'cannot afford GOLD COLLAR (300) with 100 bank');
  ok(g2.buy('shield') === false, 'cannot re-buy maxed upgrade');

  section('shield protects from first hit');
  g2.start();
  ok(g2.shield === true, 'run starts with shield when upgrade owned');
  g2.obstacles.push({ sx: 72, type: 'can', w: 12, h: 14, flying: false, anim: 0, bob: 0 });
  env2.steps(5);
  ok(g2.state === 'playing' && g2.shield === false && g2.invuln > 0, 'shield absorbed the hit, invulnerable now');
  g2.obstacles.length = 0;
  g2.invuln = 0;
  g2.obstacles.push({ sx: 72, type: 'can', w: 12, h: 14, flying: false, anim: 0, bob: 0 });
  env2.steps(10);
  ok(g2.state === 'over' || g2.state === 'dying', 'second hit without shield ends the run (state=' + g2.state + ')');

  section('magnet pulls fish');
  const env3 = makeEnv({ width: 1180, height: 820, store: env.store });
  const g3 = env3.PC.game;
  g3.up.magnet = 2;
  g3.start();
  g3.magnetT = 7;
  const before = g3.runFish;
  g3.pickups.push({ sx: 220, y: g3.groundY - 12, type: 'fish', w: 10, h: 6, vx: 0, vy: 0 });
  env3.steps(90);
  ok(g3.runFish > before, 'magnet collected fish from 150px away (fish=' + g3.runFish + ')');

  section('powerups spawn & work');
  g3.pickups.length = 0;
  g3.pickups.push({ sx: 72, y: g3.groundY - 8, type: 'milk', w: 8, h: 12, vx: 0, vy: 0 });
  env3.steps(5);
  ok(g3.shield === true, 'milk pickup grants shield');
  g3.pickups.push({ sx: 72, y: g3.groundY - 8, type: 'star', w: 8, h: 8, vx: 0, vy: 0 });
  env3.steps(5);
  ok(g3.slowT > 0, 'star pickup triggers slow-mo');
  g3.pickups.push({ sx: 72, y: g3.groundY - 8, type: 'yarn', w: 10, h: 10, vx: 0, vy: 0 });
  env3.steps(5);
  ok(g3.magnetT > 0, 'yarn pickup triggers magnet');

  section('portrait tablet 820x1180');
  const env4 = makeEnv({ width: 820, height: 1180 });
  const g4 = env4.PC.game;
  ok(g4.W === 340, 'portrait view width clamps to 340, got ' + g4.W);
  env4.steps(60);
  env4.shot('06-title-portrait');
  g4.pressAt(g4.W / 2, 100);
  ok(g4.state === 'playing', 'portrait run starts');
  for (let i = 0; i < 120; i++) { botFrame(env4); env4.step(1000 / 60); }
  ok(true, 'portrait bot ran 2s without crash (state=' + g4.state + ')');
  env4.shot('07-play-portrait');
  env4.shotCrop('07b-cat-portrait', 40, 180, 110, 80, 6);

  section('swipe-down slide via pointer events');
  const env5 = makeEnv({ width: 1180, height: 820 });
  const g5 = env5.PC.game;
  g5.pressAt(g5.W / 2, 100);
  env5.steps(10);
  env5.fire('pointerdown', 590, 400);
  env5.fire('pointermove', 590, 540);
  ok(g5.player.sliding === true || g5.input.slideHeld === true, 'swipe down triggers slide');
  env5.fire('pointerup', 590, 460);
  env5.steps(60);
  ok(g5.player.sliding === false, 'slide ends after release');

  section('persistence across reload');
  const env6 = makeEnv({ width: 1180, height: 820, store: env.store });
  const g6 = env6.PC.game;
  ok(g6.up.magnet === 2 && g6.up.shield === 1, 'upgrades restored: ' + JSON.stringify(g6.up));
  ok(g6.bank === 100, 'bank restored: ' + g6.bank);
  ok(g6.best > 0, 'best restored: ' + g6.best);

  section('drone collision fairness: slide survives, standing dies');
  const env8 = makeEnv({ width: 1180, height: 820 });
  const g8 = env8.PC.game;
  g8.pressAt(g8.W / 2, 100);
  env8.steps(5);
  g8.obstacles.push({ sx: 130, type: 'drone', w: 15, h: 6, flying: true, anim: 0, bob: 0 });
  g8.trySlide();
  for (let i = 0; i < 90; i++) env8.step(1000 / 60);
  ok(g8.state === 'playing', 'sliding under drone survives (state=' + g8.state + ')');
  const env9 = makeEnv({ width: 1180, height: 820 });
  const g9 = env9.PC.game;
  g9.pressAt(g9.W / 2, 100);
  env9.steps(5);
  g9.obstacles.push({ sx: 130, type: 'drone', w: 15, h: 6, flying: true, anim: 0, bob: 0 });
  for (let i = 0; i < 90; i++) env9.step(1000 / 60);
  ok(g9.state === 'dying' || g9.state === 'over', 'standing into drone dies (state=' + g9.state + ')');
  const env10 = makeEnv({ width: 1180, height: 820 });
  const g10 = env10.PC.game;
  g10.pressAt(g10.W / 2, 100);
  env10.steps(5);
  g10.obstacles.push({ sx: 200, type: 'can', w: 12, h: 14, flying: false, anim: 0, bob: 0 });
  g10.tryJump();
  g10.input.down = true;
  for (let i = 0; i < 90; i++) env10.step(1000 / 60);
  ok(g10.state === 'playing', 'jumping over a can survives (state=' + g10.state + ')');

  section('beauty shots with obstacles/powerups on screen');
  const env7 = makeEnv({ width: 1180, height: 820 });
  const g7 = env7.PC.game;
  g7.pressAt(g7.W / 2, 100);
  env7.steps(5);
  const mk = (sx, type, flying) => ({ sx, type, w: (type === 'drone' ? 15 : 12), h: (type === 'drone' ? 6 : 14), flying: !!flying, anim: 0, bob: Math.random() * 6 });
  g7.obstacles.push(mk(210, 'dog'), mk(330, 'can'), mk(430, 'tower'), mk(540, 'drone', true));
  for (let i = 0; i < 5; i++) g7.pickups.push({ sx: 185 + i * 17, y: g7.groundY - 16 - Math.sin(i / 4 * Math.PI) * 30, type: 'fish', w: 10, h: 6 });
  g7.pickups.push({ sx: 360, y: g7.groundY - 12, type: 'yarn', w: 10, h: 10 });
  g7.pickups.push({ sx: 470, y: g7.groundY - 14, type: 'milk', w: 8, h: 12 });
  g7.pickups.push({ sx: 580, y: g7.groundY - 10, type: 'star', w: 8, h: 8 });
  g7.player.vy = -800;
  g7.player.onGround = false;
  env7.step(1000 / 60);
  env7.shot('08-beauty-day');
  env7.shotCrop('08b-cat', 40, 170, 120, 80, 5);
  g7.tod = 40 * 0.52;
  env7.steps(5);
  env7.shot('09-beauty-night');

  section('standalone.html single-file build');
  const saPath = path.join(ROOT, 'standalone.html');
  if (fs.existsSync(saPath)) {
    const sa = fs.readFileSync(saPath, 'utf8');
    const envS = makeEnv({ width: 800, height: 500, noLoad: true });
    const scripts = [...sa.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
    ok(scripts.length === 4, 'standalone has 4 inline scripts, got ' + scripts.length);
    for (const code of scripts) vm.runInContext(code, envS.sandbox, { filename: 'standalone-inline.js' });
    const gs = envS.PC.game;
    envS.steps(60);
    ok(gs.state === 'title', 'standalone boots to title');
    let p2 = 0;
    for (let i = 3; i < envS.canvas._px.length; i += 4) if (envS.canvas._px[i] > 0) p2++;
    ok(p2 > envS.canvas.width * envS.canvas.height * 0.5, 'standalone display canvas painted: ' + p2 + ' px');
    gs.pressAt(gs.W / 2, 100);
    envS.steps(30);
    ok(gs.state === 'playing', 'standalone starts a run');
    envS.shotDisplay('10-standalone');
  } else {
    ok(false, 'standalone.html missing - run node test/build-standalone.js');
  }

  section('favicon generation');
  const cat = env.PC.sprites.catRun[1];
  const S = 2, size = 32;
  const fav = new MockCanvas();
  fav.width = size; fav.height = size;
  const fctx = fav.getContext('2d');
  fctx.fillStyle = '#1b1033';
  fctx.fillRect(0, 0, size, size);
  fctx.drawImage(cat, 0, 0, cat.width, cat.height, 0, Math.floor((size - cat.height * S) / 2), cat.width * S, cat.height * S);
  fs.writeFileSync(path.join(ROOT, 'favicon.png'), encodePNG(size, size, fav._px));
  console.log('  favicon -> ' + path.join(ROOT, 'favicon.png'));

  console.log('\n========================================');
  console.log('RESULT: ' + (checks - failures) + '/' + checks + ' checks passed, ' + failures + ' failures');
  process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error('HARNESS CRASH:', e); process.exit(2); });
