// In-browser tests for car stats and physics. Open tests.html to run.
(function (B) {
  var results = [];
  function test(name, fn) {
    try { fn(); results.push({ name: name, ok: true }); }
    catch (e) { results.push({ name: name, ok: false, msg: e.message }); }
  }
  function assert(cond, msg) { if (!cond) throw new Error(msg); }

  function flatTrack(extra) {
    return { id: 'test', surface: 'road', ground: extra || function () { return 0; } };
  }
  function run(design, track, seconds, input) {
    var sim = new B.SideSim(B.computeStats(design), track);
    var dt = 1 / 240;
    for (var t = 0; t < seconds; t += dt) sim.step(dt, typeof input === 'function' ? input(sim, t) : input);
    return sim;
  }

  test('sport car stats make sense', function () {
    var s = B.computeStats(B.PRESETS.sport());
    assert(s.power === 160000, 'turbo power');
    assert(Math.abs(s.clearance - 0.125) < 1e-9, 'clearance ' + s.clearance);
    assert(s.mass > 500 && s.mass < 1500, 'mass ' + s.mass);
    assert(s.topSpeed * 3.6 > 150, 'top speed ' + s.topSpeed * 3.6);
  });

  test('top speed balances power with drag and rolling', function () {
    var v = B.solveTopSpeed(80000, 1000, 0.7);
    var need = (B.ROLLING * 1000 * B.G + 0.5 * B.AIR_DENSITY * 0.7 * v * v) * v;
    assert(Math.abs(need - 80000) < 50, 'power balance ' + need);
  });

  test('validation catches missing engine, chassis and floating bricks', function () {
    var d = B.newDesign();
    d.pieces.push({ type: 'plastic', col: 0, row: 3, len: 2 });
    var p = B.validate(d).join(' ');
    assert(/engine/.test(p) && /bottom row/.test(p), p);
    d = B.PRESETS.sport();
    d.pieces.push({ type: 'plastic', col: 0, row: 6, len: 1 });
    assert(/floating/.test(B.validate(d).join(' ')), 'floating');
    assert(B.validate(B.PRESETS.sport()).length === 0, 'preset valid');
  });

  test('tall narrow tower tips easier than wide sport car', function () {
    var t = B.computeStats(B.PRESETS.tower()), s = B.computeStats(B.PRESETS.sport());
    assert(t.tipLimitG < 0.6 && s.tipLimitG > 1.5, t.tipLimitG + ' vs ' + s.tipLimitG);
  });

  test('parked car stays still and upright', function () {
    var sim = run(B.PRESETS.sport(), flatTrack(), 3, { gas: false, brake: false });
    assert(sim.speed() < 0.05, 'speed ' + sim.speed());
    assert(Math.abs(sim.a) < 0.02 && !sim.flipped, 'angle ' + sim.a);
    assert(sim.wheels[0].contact && sim.wheels[1].contact, 'wheels touch ground');
  });

  test('gas accelerates (a = F/m) and brakes stop near v²/2a', function () {
    var design = B.PRESETS.sport(), s = B.computeStats(design);
    var sim = run(design, flatTrack(), 3, { gas: true, brake: false });
    var v = sim.forwardSpeed();
    assert(v > 15, 'speed after 3 s ' + v);
    var x0 = sim.maxX();
    for (var t = 0; t < 8 && sim.speed() > 0.05; t += 1 / 240) sim.step(1 / 240, { gas: false, brake: true });
    var d = sim.maxX() - x0, expect = v * v / (2 * s.brakeDecel);
    assert(sim.speed() < 0.1, 'stopped');
    assert(Math.abs(d - expect) / expect < 0.3, 'brake distance ' + d.toFixed(1) + ' expected ' + expect.toFixed(1));
  });

  test('big wheels climb a 50 cm step that small wheels cannot', function () {
    var step = flatTrack(function (x) { return x > 20 ? 0.5 : 0; });
    var crawl = function (sim) { return { gas: sim.forwardSpeed() < 4, brake: false }; };
    var a = run(B.PRESETS.sport(), step, 12, crawl);
    var b = run(B.PRESETS.monster(), step, 12, crawl);
    assert(a.minX() < 22, 'small wheels should be blocked, reached ' + a.minX().toFixed(1));
    assert(b.minX() > 25, 'monster should climb, reached ' + b.minX().toFixed(1));
  });

  test('38° dirt ramp: slick tyres slip, knobbly tyres climb', function () {
    var hill = B.trackById('hill');
    hill.ground = hill.ground || hill.build();
    function climb(tyre) {
      var d = B.PRESETS.monster(); d.tyre = tyre;
      var sim = run(d, hill, 70, function (s) { return { gas: s.forwardSpeed() < 4, brake: false }; });
      return sim.minX();
    }
    var slick = climb('slick'), knobbly = climb('offroad');
    assert(slick < hill.finishX && knobbly > hill.finishX, 'slick reached ' + slick.toFixed(0) + ', knobbly ' + knobbly.toFixed(0));
  });

  test('several engines add power and weight; every wheel is a pair', function () {
    var h = B.computeStats(B.PRESETS.hotrod()), t = B.computeStats(B.PRESETS.truck());
    assert(h.engines === 2 && h.power === 240000, 'hot rod engines ' + h.engines + ' power ' + h.power);
    assert(t.wheelCount === 6, 'truck wheels ' + t.wheelCount);
    var one = B.PRESETS.hotrod();
    one.pieces = one.pieces.filter(function (p) { return p.engine !== 'normal'; });
    assert(B.computeStats(one).mass < h.mass, 'second engine adds weight');
  });

  test('a pointy wedge nose lowers air drag', function () {
    var pointy = B.computeStats(B.PRESETS.sport());
    var d = B.PRESETS.sport();
    d.pieces.forEach(function (p) { if (p.shape === 'wedge') delete p.shape; });
    var boxy = B.computeStats(d);
    assert(pointy.cd < boxy.cd && pointy.nose === 1, 'pointy ' + pointy.cd + ' boxy ' + boxy.cd);
  });

  test('wheels need a brick above and cannot overlap', function () {
    var d = B.PRESETS.sport();
    assert(!B.placeWheel(d, 13, 'small'), 'no brick at col 13');
    assert(!B.placeWheel(d, 2, 'small'), 'too close to the wheel at col 1');
    assert(B.placeWheel(d, 5, 'medium') && d.wheels.length === 3, 'third wheel placed');
    assert(B.removeWheelAt(d, 5) && d.wheels.length === 2, 'wheel removed');
    d.wheels = [d.wheels[0]];
    assert(/2 wheels/.test(B.validate(d).join(' ')), 'needs 2 wheels');
  });

  test('mixed wheel sizes and six wheels park level and steady', function () {
    ['hotrod', 'truck'].forEach(function (name) {
      var sim = run(B.PRESETS[name](), flatTrack(), 3, { gas: false, brake: false });
      assert(sim.speed() < 0.05 && Math.abs(sim.a) < 0.03, name + ' speed ' + sim.speed().toFixed(3) + ' angle ' + sim.a.toFixed(3));
      assert(sim.wheels.every(function (w) { return w.contact; }), name + ' all wheels on the ground');
    });
  });

  test('old saved cars (one wheel size) are upgraded', function () {
    var d = B.migrate({ pieces: [{ type: 'plastic', col: 2, row: 0, len: 4 }, { type: 'engine', engine: 'normal', col: 2, row: 1, len: 2 }], wheel: 'big', tyre: 'slick', lift: 'low', width: 'wide' });
    assert(d.wheels.length === 2 && d.wheels[0].col === 2 && d.wheels[1].col === 5 && d.wheels[0].size === 'big', JSON.stringify(d.wheels));
    assert(B.validate(d).length === 0, B.validate(d).join(' '));
  });

  test('no track fails a car that just sits at the start', function () {
    B.TRACKS.forEach(function (track) {
      track.ground = track.ground || track.build();
      var sim = new B.SideSim(B.computeStats(B.PRESETS.sport()), track), r = B.newRun();
      for (var i = 0; i < 240; i++) { sim.step(1 / 240, { gas: false, brake: false }); B.updateRun(r, sim, 1 / 240); }
      var res = track.check(sim, r);
      assert(!res, track.id + ': ' + (res && res.reason));
    });
  });

  test('record book keeps the fastest run first', function () {
    var key = B.Records.key;
    B.Records.key = 'bcl.records.test';
    try {
      B.Records.clear('speed');
      var d = B.PRESETS.sport(), s = B.computeStats(d);
      B.Records.add('speed', d, s, { time: 12, flips: 0 }, 2);
      var r = B.Records.add('speed', d, s, { time: 9.5, flips: 1 }, 3);
      assert(r.rank === 1 && B.Records.best('speed').time === 9.5 && B.Records.forTrack('speed').length === 2, 'rank ' + r.rank);
      B.Records.clear('speed');
    } finally { B.Records.key = key; }
  });

  // Not assertions: how each preset does on each track with a simple driver (for tuning).
  function survey() {
    var rows = [];
    Object.keys(B.PRESETS).forEach(function (name) {
      B.TRACKS.forEach(function (track) {
        track.ground = track.ground || track.build();
        var sim = new B.SideSim(B.computeStats(B.PRESETS[name]()), track);
        var r = B.newRun(), res = null;
        for (var i = 0; i < 240 * 90 && !res; i++) {
          var input = { gas: true, brake: false };
          if (track.id === 'bad' && sim.forwardSpeed() > 9) input.gas = false;
          // In the air, keep the car roughly parallel to the ground below (like a player would).
          if (sim.airborne) {
            var want = Math.atan(sim.slope(sim.x));
            if (sim.a + sim.w * 0.4 > want + 0.15) input = { gas: false, brake: true };
            else if (sim.a + sim.w * 0.4 < want - 0.15) input = { gas: true, brake: false };
            else input = { gas: false, brake: false };
          }
          sim.step(1 / 240, input);
          B.updateRun(r, sim, 1 / 240);
          res = track.check(sim, r);
          if (isNaN(sim.x)) res = { win: false, reason: 'NaN!' };
        }
        rows.push(name + ' @ ' + track.id + ': ' + (res ? (res.win ? 'WIN ' : 'FAIL ') + res.reason : 'no result') + ' (x=' + sim.x.toFixed(1) + ')');
      });
    });
    return rows;
  }

  window.addEventListener('DOMContentLoaded', function () {
    var out = document.getElementById('out');
    var html = results.map(function (r) { return '<li class="' + (r.ok ? 'ok' : 'fail') + '">' + (r.ok ? '✅ ' : '❌ ') + r.name + (r.msg ? ' — ' + r.msg : '') + '</li>'; }).join('');
    var failed = results.filter(function (r) { return !r.ok; }).length;
    out.innerHTML = '<h2>' + (results.length - failed) + ' / ' + results.length + ' passed</h2><ul>' + html + '</ul>';
    var sv = survey();
    document.getElementById('survey').textContent = sv.join('\n');
    window.__testResults = { results: results, failed: failed, survey: sv };
  });
})(window.BCL);
