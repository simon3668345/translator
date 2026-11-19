(function () {
  'use strict';
  window.PC = window.PC || {};

  var INK = '#2b2138';

  function S(rows, pal) {
    var w = 0;
    for (var i = 0; i < rows.length; i++) w = Math.max(w, rows[i].length);
    var c = document.createElement('canvas');
    c.width = w;
    c.height = rows.length;
    var x = c.getContext('2d');
    for (var r = 0; r < rows.length; r++) {
      var row = rows[r];
      for (var j = 0; j < w; j++) {
        var col = pal[row[j]];
        if (col) {
          x.fillStyle = col;
          x.fillRect(j, r, 1, 1);
        }
      }
    }
    return c;
  }

  var CAT = {
    k: INK, o: '#ffa63d', d: '#e07b1f', w: '#fff3e0',
    p: '#ff8fab', n: '#ff5d8f', h: '#4a5d9e', c: '#59f7ff', z: INK
  };

  var catHead = [
    '.............k..k...',
    '.............kp.kp..',
    '.............hhhhhc.',
    '.............kooook.',
    '.............oooook.',
    '.............oowwok.',
    '.............kwwwnk.',
    '.............kwwwwk.'
  ];

  var catBodyA = [
    'koooooooooooookwwwwk.',
    'ko..ooddooooo.......',
    'k...ooooooooo.......',
    '....ooooooooo.......',
    '....oowwwwwoo.......',
    '....kwwwwwwwk.......'
  ];

  var catBodyB = [
    'ko..ooooooooo.......',
    'k...ooddooooo.......',
    'ko..ooooooooo.......',
    '....ooooooooo.......',
    '....oowwwwwoo.......',
    '....kwwwwwwwk.......'
  ];

  function catFrame(body, legs) {
    var rows = catHead.concat(body).concat(legs);
    return S(rows, CAT);
  }

  var legsA = ['.....kk...kk........', '.....oo...oo........', '.....kk...kk........'];
  var legsB = ['......kk..kk........', '......oo..oo........', '......kk..kk........'];
  var legsC = ['.....kk..kk.........', '.....oo..oo.........', '.....kk..kk.........'];
  var legsTuck = ['.....kk.kk..........', '.....oo.oo..........', '.....kk.kk..........'];

  var catSlide = S([
    '.............k..k...',
    '.............kp.kp..',
    'k............hhhhhc.',
    'ko...........kooook.',
    'ko..ooooooooo.oooook',
    'ko..oowwwwwoo.oowwok',
    'k...kwwwwwwwk.kwwwnk',
    '....kk..kk..........',
    '....oo..oo..........',
    '....kk..kk..........'
  ], CAT);

  var catDead = S([
    'k............k..k...',
    'kw...........kp.kp..',
    'ko...........hhhhhc.',
    'ko...........kooook.',
    'ko..oooooooooozowok.',
    'ko..oowwwwwooozzwok.',
    'k...kwwwwwwwkkwwwnk.',
    '...kk.kk............',
    '...oo.oo............',
    '...kk.kk............'
  ], CAT);

  PC.sprites = {
    catRun: [
      catFrame(catBodyA, legsA),
      catFrame(catBodyB, legsB),
      catFrame(catBodyA, legsC),
      catFrame(catBodyB, legsB)
    ],
    catJump: catFrame(catBodyA, legsTuck),
    catSlide: catSlide,
    catDead: catDead,
    catEye: { x: 16, y: 4 },

    fish: S([
      '...ffff...',
      '..ffffff..',
      'tfffffffek',
      '..ffffff..',
      '...ffff...',
      '..........'
    ], { f: '#ff6b81', t: '#ffd93d', e: INK }),

    yarn: S([
      '...yyyy...',
      '..yyyyyy..',
      '.yYyYYyYy.',
      'yyYYyYYyYy',
      'yYyYYyYYyY',
      'yYYyYYyYYy',
      'yyYYyYYyYy',
      '.yYyYYyYy.',
      '..yyyyyy..',
      '...yyyy..y'
    ], { y: '#ff8fab', Y: '#e0608a' }),

    milk: S([
      '..cccc..',
      '..kwwk..',
      '.kwwwwk.',
      'kwwwwwwk',
      'kwwwwwwk',
      'kggggggk',
      'kgwwwwgk',
      'kgwwwwgk',
      'kggggggk',
      'kwwwwwwk',
      'kwwwwwwk',
      '.kkkkkk.'
    ], { c: '#59f7ff', k: INK, w: '#fff8ee', g: '#ff6b81' }),

    star: S([
      '...ss...',
      '...ss...',
      '..sSSs..',
      'sssSSsss',
      '.sSSSSs.',
      '..sSSs..',
      '...ss...',
      '..s..s..'
    ], { s: '#ffe066', S: '#ffb703' }),

    can: S([
      '..kkkkkkkk..',
      '.kllllllllk.',
      '.kmmmmmmmmk.',
      'kMmmmmmmmmMk',
      'kmmmmmmmmmmk',
      'kMrrrrrrrmMk',
      'kmmmmmmmmmmk',
      'kMmmmmmmmmMk',
      'kmmmmmmmmmmk',
      'kMmmmmmmmmMk',
      'kmmmmmmmmmmk',
      'kMmmmmmmmmMk',
      'kmmmmmmmmmmk',
      '.kkkkkkkkkk.'
    ], { k: INK, l: '#eef4ff', m: '#c7d3e8', M: '#8a97ad', r: '#e07b1f' }),

    cone: S([
      '....kk....',
      '...kook...',
      '...kook...',
      '..kwwwwk..',
      '..kwwwwk..',
      '.kwwwwwwk.',
      '.kwwwwwwk.',
      'kwwwwwwwwk',
      'kwwwwwwwwk',
      'kooooooook',
      'kkkkkkkkkk',
      '..........'
    ], { k: INK, o: '#ff7b2f', w: '#fff3e0' }),

    hydrant: S([
      '...kyyk...',
      '..kyyyyyk.',
      '.kRRRRRRk.',
      'kRRRRRRRRk',
      'kRyyyyyyRk',
      'kRRRRRRRRk',
      'kRRRRRRRRk',
      'kRRRRRRRRk',
      '.kRRRRRRk.',
      '.kRRRRRRk.',
      'kRRRRRRRRk',
      '.kkkkkkkk.'
    ], { k: INK, y: '#ffd93d', R: '#ff4757' }),

    dogA: S([
      '..................',
      '.kk...............',
      'kbbk..............k',
      'kbebk.............k',
      'kbbwwk............',
      'kbbnnk............',
      '.kwwwwkbbbbbbbbbkk',
      '.kbbbbkBBBBBBBBBk',
      '.kBBBBkbbbbbbbbBk',
      '.kbbbbkbbbbbbbbBk',
      '.......kk.kk.kk...',
      '.......bb.bb.bb...'
    ], { k: INK, b: '#a0663a', B: '#7a4a26', w: '#f3e2c7', e: INK, n: '#ff8fab' }),

    dogB: S([
      '..................',
      '.kk...............',
      'kbbk..............k',
      'kbebk.............k',
      'kbbwwk............',
      'kbbnnk............',
      '.kwwwwkbbbbbbbbbkk',
      '.kbbbbkBBBBBBBBBk',
      '.kBBBBkbbbbbbbbBk',
      '.kbbbbkbbbbbbbbBk',
      '........kk..kk....',
      '........bb..bb....'
    ], { k: INK, b: '#a0663a', B: '#7a4a26', w: '#f3e2c7', e: INK, n: '#ff8fab' }),

    droneA: S([
      'pp..............pp',
      '.pp............pp.',
      '..kGGGGGGGGGGGGk..',
      '.kGGGrrrrrrrrGGk.',
      '.kGGGGGGGGGGGGGk..',
      '..kGGk......kGGk..',
      '...kk........kk...',
      '..................'
    ], { p: '#dfe7f2', k: INK, G: '#6c7a99', r: '#ff4757' }),

    droneB: S([
      '..................',
      '.p..............p.',
      '..kGGGGGGGGGGGGk..',
      '.kGGGGGGGGGGGGGk..',
      '.kGGGGGGGGGGGGGk..',
      '..kGGk......kGGk..',
      '...kk........kk...',
      '..................'
    ], { p: '#dfe7f2', k: INK, G: '#6c7a99', r: '#ff4757' }),

    cloud: S([
      '......wwwwww........',
      '....wwwwwwwwww......',
      '..wwwwwwwwwwwwww....',
      '.wwwwwwwwwwwwwwww...',
      'wwwwwwwwwwwwwwwwwwww',
      'wwwwwwwwwwwwwwwwwwww'
    ], { w: '#ffffff' }),

    sun: S([
      '....yyyy....',
      '..yyyyyyyy..',
      '.yyyyyyyyyy.',
      'yyyyyyyyyyyy',
      'yyyyyyyyyyyy',
      'yyyyyyyyyyyy',
      'yyyyyyyyyyyy',
      'yyyyyyyyyyyy',
      'yyyyyyyyyyyy',
      '.yyyyyyyyyy.',
      '..yyyyyyyy..',
      '....yyyy....'
    ], { y: '#ffd93d' }),

    moon: S([
      '...mmmm.....',
      '..mmWWmm....',
      '.mmWWWWmm...',
      'mmWWWWmm....',
      'mmWWWWm.....',
      'mmWWWWm.....',
      'mmWWWWm.....',
      'mmWWWWmm....',
      '.mmWWWWmm...',
      '..mmWWmm....',
      '...mmmm.....',
      '............'
    ], { m: '#e8ecff', W: '#b9c4f2' }),

    flower: S([
      '..p..',
      '.pyP.',
      '..P..',
      '.gg..',
      'ggggg'
    ], { p: '#ff8fab', y: '#ffe066', P: '#ff5d8f', g: '#3ecf6e' }),

    tuft: S([
      '..a.a..',
      '.a.a.a.',
      'a..a..a'
    ], { a: 'rgba(255,255,255,0.28)' }),

    speck: S([
      'b.....b...',
      '...b....b.',
      '.b....b...',
      '.....b..b.',
      'b....b....',
      '..b.....b.',
      '....b.....',
      'b.....b...'
    ], { b: 'rgba(43,33,56,0.25)' }),

    heart: S([
      '.rr.rr.',
      'rrrrrrr',
      'rrrrrrr',
      '.rrrrr.',
      '..rrr..',
      '...r...'
    ], { r: '#ff5d8f' }),

    note: S([
      '...nn',
      '...nn',
      '...nn',
      '...nn',
      'nnnnn',
      '.nnnn'
    ], { n: '#c9a2ff' })
  };
})();
