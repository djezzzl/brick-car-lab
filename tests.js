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

  test('Death 8: tower tips, sport car only slides', function () {
    var tower = new B.EightSim(B.computeStats(B.PRESETS.tower()));
    var sport = new B.EightSim(B.computeStats(B.PRESETS.sport()));
    for (var t = 0; t < 20; t += 1 / 240) {
      if (!tower.tipped) tower.step(1 / 240, { gas: true, brake: false });
      sport.step(1 / 240, { gas: true, brake: false });
    }
    assert(tower.tipped, 'tower should tip');
    assert(!sport.tipped && sport.slides > 0, 'sport should slide, not tip');
  });

  // Not assertions: how each preset does on each track with a simple driver (for tuning).
  function survey() {
    var rows = [];
    ['sport', 'monster', 'tower'].forEach(function (name) {
      B.TRACKS.filter(function (t) { return t.kind === 'side'; }).forEach(function (track) {
        track.ground = track.ground || track.build();
        var sim = new B.SideSim(B.computeStats(B.PRESETS[name]()), track);
        var r = B.newRun(), res = null, braking = false;
        for (var i = 0; i < 240 * 90 && !res; i++) {
          var input = { gas: true, brake: false };
          if (track.id === 'stop' && sim.maxX() > track.lineX) {
            var stopAt = sim.maxX() + sim.speed() * sim.speed() / (2 * sim.s.brakeDecel);
            if (stopAt > (track.zoneA + track.zoneB) / 2) braking = true;
            input = { gas: !braking, brake: braking };
          }
          if (track.id === 'bad' && sim.forwardSpeed() > 9) input.gas = false;
          if (track.id === 'stop' && sim.forwardSpeed() > 22) input.gas = false;
          sim.step(1 / 240, input);
          B.updateRun(r, sim, 1 / 240);
          res = track.check(sim, r);
          if (isNaN(sim.x)) res = { win: false, reason: 'NaN!' };
        }
        rows.push(name + ' @ ' + track.id + ': ' + (res ? (res.win ? 'WIN ' : 'FAIL ') + res.reason : 'no result') + ' (x=' + sim.x.toFixed(1) + ')');
      });
      var eight = new B.EightSim(B.computeStats(B.PRESETS[name]()));
      var t8 = B.trackById('eight'), r8 = B.newRun(), res8 = null;
      for (var j = 0; j < 240 * 120 && !res8; j++) {
        var kmax = 0;
        for (var d = 0; d <= eight.v * eight.v / 16 + 2; d += 1) kmax = Math.max(kmax, B.eightAt(eight.pos + d).k);
        var safe = Math.sqrt(0.85 * Math.min(eight.slideLimit(), eight.tipLimit()) / Math.max(kmax, 1e-4));
        var wait = eight.crossingDanger(), first = eight.crossingETA().me < eight.crossingETA().other;
        eight.step(1 / 240, { gas: (wait && first) || (!wait && eight.v < safe), brake: (wait && !first) || eight.v > safe + 0.5 });
        B.updateRun(r8, eight, 1 / 240);
        res8 = t8.check(eight, r8);
      }
      rows.push(name + ' @ eight (careful driver): ' + (res8 ? (res8.win ? 'WIN ' : 'FAIL ') + res8.reason : 'no result'));
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
