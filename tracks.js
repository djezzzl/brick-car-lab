// Test tracks: ground shape, goals and the physics idea each one teaches.
(function (B) {
  var DX = 0.05, X0 = -40;

  // Bake a ground-height function into a lookup table for fast, stable sampling.
  function table(fn, length) {
    var n = Math.ceil((length - X0 + 60) / DX);
    var arr = new Float32Array(n);
    for (var i = 0; i < n; i++) arr[i] = fn(X0 + i * DX);
    return function (x) {
      var f = (x - X0) / DX;
      if (f <= 0) return arr[0];
      if (f >= n - 1) return arr[n - 1];
      var i0 = f | 0, t = f - i0;
      return arr[i0] * (1 - t) + arr[i0 + 1] * t;
    };
  }

  // Ground built from a slope profile (rise per metre), so ramps have smooth corners.
  function fromSlopes(segments, length) {
    function slopeAt(x) {
      var s = 0;
      segments.forEach(function (g) {
        var a = smooth((x - g[0]) / 5), b = smooth((x - g[1]) / 5);
        s += g[2] * (a - b);
      });
      return s;
    }
    var h = 0, x = X0;
    var n = Math.ceil((length - X0 + 60) / DX);
    var arr = new Float32Array(n);
    for (var i = 0; i < n; i++) { arr[i] = h; h += slopeAt(x) * DX; x += DX; }
    return table(function (xx) { var f = Math.round((xx - X0) / DX); return arr[Math.max(0, Math.min(n - 1, f))]; }, length);
  }
  function smooth(t) { t = Math.max(-0.5, Math.min(0.5, t)) + 0.5; return t * t * (3 - 2 * t); }

  function rock(x, c, hw, h) { var d = (x - c) / hw; return Math.abs(d) < 1 ? h * Math.sqrt(1 - d * d) : 0; }
  function block(x, a, b, h) { return x >= a && x <= b ? h : 0; }
  function deg(d) { return Math.tan(d * Math.PI / 180); }
  function starsByTime(t, three, two) { return t <= three ? 3 : t <= two ? 2 : 1; }

  // Ground from [x, height] points joined by straight lines, softened so ramps have rounded corners.
  // Gaps are cut out afterwards so jump lips stay sharp. extra(x) adds small bumps on top.
  function profile(points, length, opts) {
    opts = opts || {};
    var n = Math.ceil((length - X0 + 60) / DX), raw = new Float32Array(n), j = 0;
    for (var i = 0; i < n; i++) {
      var x = X0 + i * DX;
      while (j < points.length - 2 && x > points[j + 1][0]) j++;
      var a = points[j], b = points[j + 1];
      var t = Math.max(0, Math.min(1, (x - a[0]) / (b[0] - a[0])));
      raw[i] = a[1] + (b[1] - a[1]) * t;
    }
    var w = Math.round((opts.smooth == null ? 2 : opts.smooth) / DX);
    for (var pass = 0; pass < 2 && w > 0; pass++) {
      var sum = new Float64Array(n + 1);
      for (i = 0; i < n; i++) sum[i + 1] = sum[i] + raw[i];
      var out = new Float32Array(n);
      for (i = 0; i < n; i++) {
        var lo = Math.max(0, i - w), hi = Math.min(n, i + w + 1);
        out[i] = (sum[hi] - sum[lo]) / (hi - lo);
      }
      raw = out;
    }
    return table(function (x) {
      var f = Math.max(0, Math.min(n - 1, Math.round((x - X0) / DX)));
      for (var g = 0; g < (opts.gaps || []).length; g++) if (x > opts.gaps[g][0] && x < opts.gaps[g][1]) return opts.pit == null ? -10 : opts.pit;
      return raw[f] + (opts.extra ? opts.extra(x) : 0);
    }, length);
  }

  function bump(x, c, w, h) { var d = (x - c) / w; return Math.abs(d) < 0.5 ? h * (1 + Math.cos(d * 2 * Math.PI)) / 2 : 0; }

  var HAZARD_TEXT = {
    water: 'SPLASH! You fell into the shark pool! 🦈',
    lava: 'Oh no – you fell into the lava! 🌋',
    canyon: 'You fell into the canyon!'
  };

  // Shared rules: fail on flip, falling, getting stuck or time; win past the finish line.
  function check(sim, run) {
    if (sim.flipped) return { win: false, reason: 'Your car flipped over!', why: 'flip' };
    var overGap = (this.gaps || []).some(function (g) { return sim.x > g[0] && sim.x < g[1]; });
    if (sim.y < -6 || (overGap && sim.y < this.hazardLevel - 0.3)) return { win: false, reason: HAZARD_TEXT[this.hazard] || HAZARD_TEXT.canyon, why: 'gap' };
    if (run.stuckTime > 8) return { win: false, reason: 'Your car got stuck.', why: 'stuck' };
    if (run.time > (this.timeLimit || 120)) return { win: false, reason: 'Out of time!', why: 'time' };
    if (sim.minX() > this.finishX) {
      return { win: true, reason: this.winText + ' ' + run.time.toFixed(1) + ' s' + (run.flips ? ' and ' + run.flips + ' flip' + (run.flips > 1 ? 's' : '') + '!' : '!'), stars: starsByTime(run.time, this.three, this.two), why: this.id + 'Win' };
    }
    return null;
  }

  var THEMES = {
    city: { sky: ['#7ec8f2', '#d9f1ff'], hills: '#b5e0b0', ground: '#6d6f73', edge: '#3c3d40' },
    fair: { sky: ['#ffb4d8', '#fff0c2'], hills: '#f7c6a3', ground: '#7a5cc4', edge: '#f2cd37' },
    rocks: { sky: ['#9fd3f0', '#e8f6ff'], hills: '#c7d9a8', ground: '#8d6e4f', edge: '#5b8a3a' },
    mountain: { sky: ['#6fb7ea', '#d3ecff'], hills: '#e9f2f7', ground: '#a0703f', edge: '#5b8a3a' },
    beach: { sky: ['#5ec4f2', '#c9f0ff'], hills: '#f3e2a9', ground: '#d9b26a', edge: '#b48a3e' },
    volcano: { sky: ['#3a1c2e', '#e2583e'], hills: '#8a4a4a', ground: '#2a201d', edge: '#ff6a00' },
    mega: { sky: ['#0b3d91', '#7fb8ff'], hills: '#9bb7d4', ground: '#30343a', edge: '#ff9800' }
  };

  B.TRACKS = [
    {
      id: 'speed', name: 'Speed Strip', emoji: '🏎️', level: 1, length: 330, finishX: 300, surface: 'road', theme: THEMES.city,
      challenge: 'Drag race! Drive 300 m as fast as you can.',
      lesson: 'Acceleration: a = F ÷ m. A strong push and a light car speed up quickly. Air pushes back harder the faster you go, so every car has a top speed.',
      three: 9, two: 12, winText: 'Finished in',
      build: function () { return table(function () { return 0; }, this.length); },
      markers: [{ x: 100, label: '100 m' }, { x: 200, label: '200 m' }]
    },
    {
      id: 'roller', name: 'Rollercoaster', emoji: '🎢', level: 1, length: 300, finishX: 270, surface: 'road', theme: THEMES.fair,
      challenge: 'Huge hills! Zoom down, fly over the tops and keep going.',
      lesson: 'Energy swap: going up a hill turns speed into height, going down turns height back into speed. Fast over a hill top? The ground drops away faster than you fall – AIRTIME!',
      three: 9.5, two: 12, winText: 'What a ride!',
      build: function () {
        // A smooth wave of hills that slowly get bigger: fast cars float over the tops and land on the way down.
        return table(function (x) {
          if (x < 25 || x > 270) return 0;
          var amp = 1.5 + 1.7 * (x - 25) / 245;
          return amp * (1 - Math.cos((x - 25) / 85 * 2 * Math.PI));
        }, this.length);
      },
      markers: [{ x: 60, label: 'whee!' }]
    },
    {
      id: 'bad', name: 'Rocky Road', emoji: '🪨', level: 2, length: 270, finishX: 250, surface: 'rough', theme: THEMES.rocks,
      challenge: 'Rocks, steps, holes and logs! Get to the end without getting stuck.',
      lesson: 'Clearance is the space under your car. If a rock is taller than it, the car scrapes and gets stuck. Big wheels roll over steps that small wheels bump into, and soft, long suspension soaks up the bumps.',
      three: 27, two: 35, winText: 'Made it through in',
      build: function () {
        return table(function (x) {
          var h = 0;
          if (x > 20 && x < 50) h += 0.08 * (1 + Math.sin(x * 2.2)) / 2;
          h += rock(x, 62, 0.9, 0.25) + rock(x, 75, 1.1, 0.38);
          h += block(x, 92, 100, 0.3);
          if (x > 118 && x < 119.6) h -= 0.5;
          h += rock(x, 138, 0.45, 0.4) + rock(x, 145, 0.45, 0.4) + rock(x, 152, 0.45, 0.4);
          h += block(x, 172, 182, 0.5);
          if (x > 195 && x < 228) h += 0.15 * (1 + Math.sin((x - 195) * 2.5)) / 2;
          h += rock(x, 238, 1.2, 0.55);
          return h;
        }, this.length);
      },
      markers: [{ x: 62, label: 'rock' }, { x: 92, label: 'step 30 cm' }, { x: 118, label: 'hole' }, { x: 138, label: 'logs' }, { x: 172, label: 'step 50 cm' }, { x: 195, label: 'washboard' }, { x: 238, label: 'big rock' }]
    },
    {
      id: 'hill', name: 'Hill Climb', emoji: '⛰️', level: 2, length: 175, finishX: 160, surface: 'dirt', theme: THEMES.mountain, timeLimit: 90,
      challenge: 'Three dirt ramps: 15°, 25° and a super steep 38°. Reach the top!',
      lesson: 'Gravity pulls you back down a hill – the steeper, the harder (m·g·sin θ). You need enough power for your weight, and enough grip: on a 38° slope the tyres need grip of at least tan 38° ≈ 0.78 or they just spin.',
      three: 11, two: 15, winText: 'King of the hill in',
      build: function () { return fromSlopes([[30, 55, deg(15)], [75, 95, deg(25)], [110, 132, deg(38)]], this.length); },
      markers: [{ x: 30, label: '15°' }, { x: 75, label: '25°' }, { x: 110, label: '38°' }]
    },
    {
      id: 'jump', name: 'Shark Jump', emoji: '🦈', level: 2, length: 175, finishX: 150, surface: 'road', theme: THEMES.beach, timeLimit: 60,
      hazard: 'water', hazardLevel: 3.6, gaps: [[66, 84]],
      challenge: 'Hit the booster, fly over the shark pool and land on your wheels!',
      lesson: 'In the air nothing pushes you – gravity pulls you down while you keep flying forward. Faster take-off = longer flight. If the weight is too far back or front, the car spins in the air.',
      three: 7.2, two: 9, winText: 'Great landing!',
      boosters: [[28, 38]],
      build: function () {
        return table(function (x) {
          if (x < 45) return 0;
          if (x < 66) return (x - 45) * deg(18);
          if (x < 84) return -8;
          return Math.max(0, (66 - 45) * deg(18) - 1 - (x - 84) * deg(12));
        }, this.length);
      },
      markers: [{ x: 45, label: 'ramp' }]
    },
    {
      id: 'volcano', name: 'Volcano Run', emoji: '🌋', level: 3, length: 240, finishX: 212, surface: 'rough', theme: THEMES.volcano, timeLimit: 90,
      hazard: 'lava', hazardLevel: 0.4, gaps: [[52, 62], [114, 130]],
      challenge: 'Boost, jump over TWO lava rivers, then race up the volcano!',
      lesson: 'Boosters give an extra push: more force = bigger speed increment (a = F ÷ m). A jump needs enough speed at the lip – longer gaps need more speed.',
      three: 9.8, two: 12.5, winText: 'You conquered the volcano in',
      boosters: [[16, 26], [84, 94]],
      build: function () {
        return profile([[X0, 0], [40, 0], [52, 2.6], [52.01, 1.6], [62, 1.6], [76, 0], [100, 0], [114, 3.7], [114.01, 2.5], [130, 2.5], [146, 0], [160, 0], [192, 9.6], [206, 11.2], [240, 11.2]],
          this.length, { gaps: this.gaps, pit: -8, smooth: 1.2 });
      },
      markers: [{ x: 52, label: 'lava!' }, { x: 114, label: 'lava!' }, { x: 160, label: 'climb' }]
    },
    {
      id: 'mega', name: 'Mega Ramp', emoji: '🚀', level: 3, length: 245, finishX: 212, surface: 'road', theme: THEMES.mega, timeLimit: 60,
      hazard: 'canyon', hazardLevel: -6, gaps: [[118, 148]],
      challenge: 'Start on top of a 30 m tower, dive down the ramp and fly over the 30 m canyon!',
      lesson: 'Height is stored energy. Falling 30 m turns it into speed: v = √(2·g·h) ≈ 24 m/s ≈ 87 km/h – even with no engine! Then the kicker ramp throws you into the air.',
      three: 7.6, two: 9.5, winText: 'MEGA landing!',
      boosters: [[76, 86]],
      build: function () {
        // The ramp line carries on into the canyon (it is cut out) so the lip stays sharp after smoothing.
        return profile([[X0, 30], [20, 30], [72, 0], [106, 0], [118, 3.2], [127, 5.6], [148, 4], [172, 0], [260, 0]],
          this.length, { gaps: this.gaps, pit: -20, smooth: 4 });
      },
      markers: [{ x: 14, label: '30 m!' }, { x: 106, label: 'kicker' }]
    }
  ];

  B.TRACKS.forEach(function (t) {
    t.kind = 'side';
    t.check = check;
    t.starHint = '⭐⭐⭐ under ' + t.three + ' s · ⭐⭐ under ' + t.two + ' s';
  });

  B.trackById = function (id) {
    return B.TRACKS.filter(function (t) { return t.id === id; })[0];
  };

  B.newRun = function () {
    return { time: 0, started: false, stuckTime: 0, stillTime: 0, history: [], airTime: 0, lastAir: 0, bestX: -Infinity, progressTime: 0, flips: 0, events: [], airA0: 0 };
  };

  // Book-keeping shared by the game and the tests: time, being stuck, flying and flips.
  B.updateRun = function (run, sim, dt) {
    run.time += dt;
    run.stillTime = sim.speed() < 0.15 ? run.stillTime + dt : 0;
    if (sim.x > run.bestX + 0.3) { run.bestX = sim.x; run.progressTime = run.time; }
    run.stuckTime = run.time - run.progressTime;
    if (sim.airborne) {
      if (run.airTime === 0) run.airA0 = sim.a;
      run.airTime += dt;
    } else if (run.airTime > 0) {
      run.lastAir = run.airTime;
      var turn = sim.a - run.airA0, flips = Math.floor((Math.abs(turn) + 0.6) / (2 * Math.PI));
      if (flips > 0) {
        run.flips += flips;
        run.events.push({ t: run.time, text: (flips > 1 ? flips + '× ' : '') + (turn > 0 ? 'BACKFLIP!' : 'FRONTFLIP!') + ' 🤸' });
      } else if (run.airTime > 0.9) {
        run.events.push({ t: run.time, text: 'BIG AIR ' + run.airTime.toFixed(1) + ' s! ✈️' });
      }
      run.airTime = 0;
    }
  };

  // "Why it happened" explanations for results, using the car's own numbers.
  B.explain = function (why, s) {
    var kg = Math.round(s.mass) + ' kg';
    var map = {
      flip: 'The car rotated too far. Tall cars (centre of mass ' + s.hCoM.toFixed(2) + ' m high) and cars with all their weight at one end tip easily. Try heavy bricks LOW and in the middle, wheels far apart, and soft suspension for landings. In the air, hold BRAKE to tip the nose down.',
      gap: 'You were not fast enough at take-off, so gravity pulled you down before you reached the other side. More power, less weight, a booster run-up – and keep the gas pressed until the lip!',
      stuck: 'Something blocked the car. If the bottom scraped, you need more clearance (now ' + Math.round(s.clearance * 100) + ' cm). If a wheel hit a step, bigger wheels roll over it. On hills you may need more power per kg or grippier tyres.',
      time: 'Too slow this time. More power per kilogram (now ' + Math.round(s.powerPerKg) + ' W/kg) means faster speeding up.',
      speedWin: 'Your engines push with ' + Math.round(s.power / 1000) + ' kW and the car weighs ' + kg + '. Less weight or more power = faster acceleration (a = F ÷ m). A pointy wedge nose cuts through the air!',
      rollerWin: 'Speed and height kept swapping: down = faster, up = slower. The faster you go over a top, the more airtime you get!',
      badWin: 'Your clearance (' + Math.round(s.clearance * 100) + ' cm) and wheels (biggest radius ' + Math.round(s.wheelR * 100) + ' cm) handled the bumps.',
      hillWin: 'You had enough power per kg (' + Math.round(s.powerPerKg) + ' W/kg) and enough grip to beat gravity.',
      jumpWin: 'You took off fast enough to fly across. In the air only gravity acts on you!',
      volcanoWin: 'Boosters + engines gave you enough speed for both lava jumps, and enough power per kg for the climb.',
      megaWin: 'Gravity turned the tower height into speed, and the kicker threw you across. Physics is awesome!'
    };
    return map[why] || '';
  };
})(window.BCL);
