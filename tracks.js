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

  // Common pass/fail rules for side-view tracks. Returns null while still running.
  function commonChecks(track, sim, run) {
    if (sim.flipped) return { win: false, reason: 'Your car flipped over!', why: 'flip' };
    if (sim.y < -6) return { win: false, reason: 'Your car fell into the gap!', why: 'gap' };
    if (run.stuckTime > 8) return { win: false, reason: 'Your car got stuck.', why: 'stuck' };
    if (run.time > (track.timeLimit || 120)) return { win: false, reason: 'Out of time!', why: 'time' };
    return null;
  }

  B.TRACKS = [
    {
      id: 'speed', name: 'Speed Strip', emoji: '🏎️', kind: 'side', length: 330, finishX: 300, surface: 'road',
      challenge: 'Drag race! Drive 300 m as fast as you can.',
      lesson: 'Acceleration: a = F ÷ m. A strong push and a light car speed up quickly. Air pushes back harder the faster you go, so every car has a top speed.',
      starHint: '⭐⭐⭐ under 12 s · ⭐⭐ under 16 s',
      build: function () { return table(function () { return 0; }, this.length); },
      markers: [{ x: 100, label: '100 m' }, { x: 200, label: '200 m' }],
      check: function (sim, run) {
        var c = commonChecks(this, sim, run);
        if (c) return c;
        if (sim.minX() > this.finishX) return { win: true, reason: 'Finished in ' + run.time.toFixed(1) + ' s!', stars: starsByTime(run.time, 12, 16), why: 'speedWin' };
        return null;
      }
    },
    {
      id: 'stop', name: 'Full Stop', emoji: '🛑', kind: 'side', length: 190, surface: 'road',
      lineX: 110, zoneA: 150, zoneB: 160, wallX: 164,
      challenge: 'Cross the yellow line FAST (at least 40 km/h), then stop with your nose inside the green box – before the wall!',
      lesson: 'Momentum: a moving car wants to keep moving. Brakes slow it a little every second, so a fast car needs MUCH more room to stop: double the speed = four times the distance (d = v² ÷ 2a).',
      starHint: 'Line speed: ⭐ 40+ · ⭐⭐ 60+ · ⭐⭐⭐ 80+ km/h',
      build: function () { return table(function () { return 0; }, this.length); },
      markers: [],
      check: function (sim, run) {
        var c = commonChecks(this, sim, run);
        if (c) return c;
        var front = sim.maxX();
        if (front >= this.lineX && run.lineSpeed == null) run.lineSpeed = sim.speed();
        if (front >= this.wallX - 0.05) {
          return { win: false, reason: 'BONK! You hit the wall at ' + Math.round(sim.speed() * 3.6) + ' km/h.', why: 'wall' };
        }
        if (run.lineSpeed == null) {
          if (sim.speed() < 0.2 && run.time > 3 && run.stillTime > 2 && front > 30) return { win: false, reason: 'You stopped before the yellow line.', why: 'early' };
          return null;
        }
        if (run.lineSpeed < 40 / 3.6) return { win: false, reason: 'Too slow at the line: ' + Math.round(run.lineSpeed * 3.6) + ' km/h. You need at least 40!', why: 'slowLine' };
        if (sim.speed() < 0.15 && run.stillTime > 0.8) {
          if (front < this.zoneA) return { win: false, reason: 'You stopped too early – ' + (this.zoneA - front).toFixed(1) + ' m before the box.', why: 'early' };
          if (front > this.zoneB) return { win: false, reason: 'Too far! You stopped ' + (front - this.zoneB).toFixed(1) + ' m past the box.', why: 'late' };
          var kmh = run.lineSpeed * 3.6;
          return { win: true, reason: 'Perfect stop! Line speed ' + Math.round(kmh) + ' km/h.', stars: kmh >= 80 ? 3 : kmh >= 60 ? 2 : 1, why: 'stopWin' };
        }
        return null;
      }
    },
    {
      id: 'bad', name: 'Bad Road', emoji: '🪨', kind: 'side', length: 270, finishX: 250, surface: 'rough', timeLimit: 120,
      challenge: 'Rocks, steps, holes and logs! Get to the end without getting stuck.',
      lesson: 'Clearance is the space under your car. If a rock is taller than it, the car scrapes and gets stuck. Big wheels roll over steps that small wheels bump into, and soft, long suspension soaks up the bumps.',
      starHint: '⭐⭐⭐ under 30 s · ⭐⭐ under 45 s',
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
      markers: [{ x: 62, label: 'rock' }, { x: 92, label: 'step 30 cm' }, { x: 118, label: 'hole' }, { x: 138, label: 'logs' }, { x: 172, label: 'step 50 cm' }, { x: 195, label: 'washboard' }, { x: 238, label: 'big rock' }],
      check: function (sim, run) {
        var c = commonChecks(this, sim, run);
        if (c) return c;
        if (sim.minX() > this.finishX) return { win: true, reason: 'Made it through in ' + run.time.toFixed(1) + ' s!', stars: starsByTime(run.time, 30, 45), why: 'badWin' };
        return null;
      }
    },
    {
      id: 'hill', name: 'Hill Climb', emoji: '⛰️', kind: 'side', length: 175, finishX: 160, surface: 'dirt', timeLimit: 90,
      challenge: 'Three dirt ramps: 15°, 25° and a super steep 38°. Reach the top!',
      lesson: 'Gravity pulls you back down a hill – the steeper, the harder (m·g·sin θ). You need enough power for your weight, and enough grip: on a 38° slope the tyres need grip of at least tan 38° ≈ 0.78 or they just spin.',
      starHint: '⭐⭐⭐ under 20 s · ⭐⭐ under 30 s',
      build: function () { return fromSlopes([[30, 55, deg(15)], [75, 95, deg(25)], [110, 132, deg(38)]], this.length); },
      markers: [{ x: 30, label: '15°' }, { x: 75, label: '25°' }, { x: 110, label: '38°' }],
      check: function (sim, run) {
        var c = commonChecks(this, sim, run);
        if (c) return c;
        if (sim.minX() > this.finishX) return { win: true, reason: 'King of the hill in ' + run.time.toFixed(1) + ' s!', stars: starsByTime(run.time, 20, 30), why: 'hillWin' };
        return null;
      }
    },
    {
      id: 'jump', name: 'Big Jump', emoji: '🦘', kind: 'side', length: 175, finishX: 150, surface: 'road', timeLimit: 60,
      gapA: 66, gapB: 84,
      challenge: 'Fly over the 18 m gap and land on your wheels!',
      lesson: 'In the air nothing pushes you – gravity pulls you down while you keep flying forward. Faster take-off = longer flight. If the weight is too far back or front, the car spins in the air.',
      starHint: '⭐⭐⭐ under 10 s · ⭐⭐ under 14 s',
      build: function () {
        var self = this;
        return table(function (x) {
          if (x < 45) return 0;
          if (x < self.gapA) return (x - 45) * deg(18);
          if (x < self.gapB) return -30;
          var top = (self.gapA - 45) * deg(18) - 1;
          var down = top - (x - self.gapB) * deg(12);
          return Math.max(0, down);
        }, this.length);
      },
      markers: [{ x: 45, label: 'ramp' }],
      check: function (sim, run) {
        var c = commonChecks(this, sim, run);
        if (c) return c;
        if (sim.minX() > this.finishX) return { win: true, reason: 'Great landing! ' + run.time.toFixed(1) + ' s.', stars: starsByTime(run.time, 10, 14), why: 'jumpWin' };
        return null;
      }
    },
    {
      id: 'eight', name: 'Death 8', emoji: '♾️', kind: 'top', laps: 3, timeLimit: 70,
      challenge: 'Drive 3 laps of the figure 8. Watch the crossing – the other car will not stop! Corners too fast = slide or tip over.',
      lesson: 'To turn, the tyres must pull the car sideways: a = v² ÷ r. Twice as fast needs FOUR times the pull! If the tyres cannot hold, you slide. If the car is tall and narrow, it tips over before it slides.',
      starHint: '⭐⭐⭐ under 45 s · ⭐⭐ under 55 s'
    }
  ];

  B.trackById = function (id) {
    return B.TRACKS.filter(function (t) { return t.id === id; })[0];
  };

  B.newRun = function () {
    return { time: 0, started: false, stuckTime: 0, stillTime: 0, lineSpeed: null, history: [], airTime: 0, lastAir: 0, bestX: -Infinity, progressTime: 0 };
  };

  // Book-keeping shared by the game and the tests: time, standing still, being stuck, flying.
  B.updateRun = function (run, sim, dt) {
    run.time += dt;
    run.stillTime = sim.speed() < 0.15 ? run.stillTime + dt : 0;
    if (sim.x != null) {
      if (sim.x > run.bestX + 0.3) { run.bestX = sim.x; run.progressTime = run.time; }
      run.stuckTime = run.time - run.progressTime;
    }
    if (sim.airborne) run.airTime += dt;
    else if (run.airTime > 0) { run.lastAir = run.airTime; run.airTime = 0; }
  };

  // "Why it happened" explanations for results, using the car's own numbers.
  B.explain = function (why, s, run) {
    var kg = Math.round(s.mass) + ' kg';
    var map = {
      flip: 'The car rotated too far. Tall cars (centre of mass ' + s.hCoM.toFixed(2) + ' m high) and cars with all their weight at one end tip easily. Try heavy bricks LOW and in the middle, and a longer bottom row.',
      gap: 'You were not fast enough at take-off, so gravity pulled you down before you reached the other side. More power, less weight, or a longer run-up help.',
      stuck: 'Something blocked the car. If the bottom scraped, you need more clearance (now ' + Math.round(s.clearance * 100) + ' cm). If a wheel hit a step, bigger wheels roll over it. On hills you may need more power per kg or grippier tyres.',
      time: 'Too slow this time. More power per kilogram (now ' + Math.round(s.powerPerKg) + ' W/kg) means faster speeding up.',
      wall: 'Your car had too much momentum. With your brakes it slows by ' + s.brakeDecel.toFixed(1) + ' m/s every second. Brake earlier – or make the car lighter so the brakes work better (' + kg + ' now).',
      early: 'You braked a bit too soon. The brake distance d = v² ÷ (2·a) – watch the purple marker while driving: it shows where you would stop if you braked right now.',
      late: 'You braked a bit late. The purple marker shows where you would stop if you braked right now – start braking when it reaches the green box.',
      slowLine: 'The challenge is to stop from a HIGH speed. Keep the gas pressed until the yellow line!',
      speedWin: 'Your engine pushes with power ' + Math.round(s.power / 1000) + ' kW and the car weighs ' + kg + '. Less weight or more power = faster acceleration (a = F ÷ m).',
      stopWin: 'You judged the braking distance well. Remember: double the speed needs four times the room to stop!',
      badWin: 'Your clearance (' + Math.round(s.clearance * 100) + ' cm) and wheels (radius ' + Math.round(s.wheelR * 100) + ' cm) handled the bumps.',
      hillWin: 'You had enough power per kg (' + Math.round(s.powerPerKg) + ' W/kg) and enough grip to beat gravity.',
      jumpWin: 'You took off fast enough to fly across. In the air only gravity acts on you!',
      eightWin: 'Smooth driving! You kept the sideways pull v²/r below your slide and tip-over limits.',
      tip: 'Turning pulled the car sideways harder than it could stand. Your tip-over limit is ' + s.tipLimitG.toFixed(2) + ' g: (half the width ' + (s.width / 2).toFixed(2) + ' m) ÷ (centre of mass height ' + s.hCoM.toFixed(2) + ' m). Make it lower or wider – or slow down before the corners.',
      crash: 'You arrived at the crossing at the same time as the other car. Slow down or speed up to time it!'
    };
    return map[why] || '';
  };
})(window.BCL);
