(function () {
  'use strict';
  window.PC = window.PC || {};

  var A = {
    ctx: null,
    master: null,
    musicGain: null,
    muted: false,
    musicOn: false,
    step: 0,
    nextT: 0,
    stepDur: 60 / 138 / 2
  };

  var MELODY = [
    440, 0, 523.25, 659.25, 0, 783.99, 659.25, 0,
    587.33, 0, 698.46, 880, 0, 783.99, 698.46, 587.33,
    440, 0, 523.25, 659.25, 0, 783.99, 880, 0,
    1046.5, 0, 880, 783.99, 698.46, 659.25, 587.33, 0
  ];
  var BASS = [110, 0, 110, 0, 130.81, 0, 130.81, 0, 87.31, 0, 87.31, 0, 98, 0, 98, 0];

  function param() {
    return {
      value: 0,
      setValueAtTime: function () {},
      linearRampToValueAtTime: function () {},
      exponentialRampToValueAtTime: function () {},
      cancelScheduledValues: function () {}
    };
  }

  A.ensure = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.5;
      this.musicGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    return true;
  };

  A.setMuted = function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.42;
  };

  function tone(freq, dur, type, vol, when, slideTo, dest) {
    if (!A.ctx || A.muted) return;
    var t = when !== undefined ? when : A.ctx.currentTime;
    var o = A.ctx.createOscillator();
    var g = A.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(dest || A.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol, when, cutoff) {
    if (!A.ctx || A.muted) return;
    var t = when !== undefined ? when : A.ctx.currentTime;
    var len = Math.max(1, Math.floor(A.ctx.sampleRate * dur));
    var buf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = A.ctx.createBufferSource();
    src.buffer = buf;
    var f = A.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff || 1200;
    var g = A.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(A.master);
    src.start(t);
  }

  A.sfx = {
    jump: function () { tone(300, 0.16, 'square', 0.16, 0, 640); },
    slide: function () { noise(0.18, 0.12, 0, 900); },
    fish: function (combo) {
      var base = 660 + Math.min(combo || 0, 12) * 30;
      tone(base, 0.09, 'sine', 0.22);
      tone(base * 1.5, 0.12, 'sine', 0.18, A.ctx ? A.ctx.currentTime + 0.06 : 0);
    },
    power: function () {
      if (!A.ctx) return;
      var t = A.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.12, 'triangle', 0.2, t + i * 0.07); });
    },
    hit: function () {
      noise(0.3, 0.35, 0, 700);
      tone(220, 0.35, 'sawtooth', 0.25, 0, 60);
    },
    shieldBreak: function () {
      noise(0.2, 0.25, 0, 2400);
      tone(880, 0.2, 'square', 0.15, 0, 220);
    },
    click: function () { tone(700, 0.06, 'square', 0.12, 0, 500); },
    buy: function () {
      if (!A.ctx) return;
      var t = A.ctx.currentTime;
      [784, 988, 1175].forEach(function (f, i) { tone(f, 0.1, 'square', 0.16, t + i * 0.05); });
    },
    over: function () {
      if (!A.ctx) return;
      var t = A.ctx.currentTime;
      [392, 330, 262, 196].forEach(function (f, i) { tone(f, 0.22, 'triangle', 0.22, t + i * 0.18); });
    },
    start: function () {
      if (!A.ctx) return;
      var t = A.ctx.currentTime;
      [523.25, 659.25, 783.99].forEach(function (f, i) { tone(f, 0.1, 'square', 0.16, t + i * 0.06); });
    }
  };

  function play(name) {
    if (!A.ctx) return;
    if (A.sfx[name]) A.sfx[name]();
  }

  A.startMusic = function () {
    if (!this.ensure()) return;
    this.musicOn = true;
    this.step = 0;
    this.nextT = this.ctx.currentTime + 0.05;
  };

  A.stopMusic = function () { this.musicOn = false; };

  A.tick = function () {
    if (!this.ctx || !this.musicOn || this.muted) return;
    while (this.nextT < this.ctx.currentTime + 0.18) {
      var s = this.step % 32;
      var m = MELODY[s];
      if (m) tone(m, this.stepDur * 0.9, 'square', 0.07, this.nextT, 0, this.musicGain);
      var b = BASS[s % 16];
      if (b) tone(b, this.stepDur * 1.8, 'triangle', 0.12, this.nextT, 0, this.musicGain);
      if (s % 4 === 2) noise(0.03, 0.05, this.nextT, 6000);
      this.nextT += this.stepDur;
      this.step++;
    }
  };

  PC.audio = A;
  PC.audio.play = play;
})();
