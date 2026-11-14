// Drive screen: runs a simulation, draws it and explains the physics live.
(function (B) {
  var DT = 1 / 240;

  B.Drive = function (root, opts) {
    this.root = root;
    this.onExit = opts.onExit;
    this.canvas = root.querySelector('#drive-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.graph = root.querySelector('#speed-graph');
    this.gctx = this.graph.getContext('2d');
    this.input = { gas: false, brake: false };
    this.paused = false;
    this.slow = false;
    this.arrows = true;
    this.running = false;
    this.bindControls();
  };

  var P = B.Drive.prototype;

  P.start = function (design, track) {
    this.design = JSON.parse(JSON.stringify(design));
    this.stats = B.computeStats(this.design);
    this.track = track;
    if (track.kind === 'side') {
      if (!track.ground) track.ground = track.build();
      this.sim = new B.SideSim(this.stats, track);
    } else {
      this.sim = new B.EightSim(this.stats);
    }
    this.run = B.newRun();
    this.result = null;
    this.acc = 0;
    this.aSmooth = 0;
    this.lastV = 0;
    this.cam = { x: this.sim.x || 0, y: this.sim.y || 0, scale: 50 };
    this.paused = false;
    this.input.gas = this.input.brake = false;
    this.root.querySelector('#drive-title').textContent = track.emoji + ' ' + track.name;
    this.root.querySelector('#drive-challenge').textContent = track.challenge;
    this.root.querySelector('#drive-lesson').textContent = track.lesson;
    this.root.querySelector('#result').hidden = true;
    this.root.querySelector('#hint-start').hidden = false;
    this.updateButtons();
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
      var self = this;
      requestAnimationFrame(function loop(now) {
        if (!self.running) return;
        self.frame(now);
        requestAnimationFrame(loop);
      });
    }
  };

  P.stop = function () { this.running = false; };

  P.bindControls = function () {
    var self = this;
    var keys = { ArrowRight: 'gas', ArrowUp: 'gas', d: 'gas', w: 'gas', ArrowLeft: 'brake', ArrowDown: 'brake', a: 'brake', s: 'brake' };
    window.addEventListener('keydown', function (e) {
      if (!self.running) return;
      if (keys[e.key]) { self.input[keys[e.key]] = true; e.preventDefault(); }
      if (e.key === ' ') { self.togglePause(); e.preventDefault(); }
      if (e.key === 'r') self.restart();
    });
    window.addEventListener('keyup', function (e) { if (keys[e.key]) self.input[keys[e.key]] = false; });
    [['#pedal-gas', 'gas'], ['#pedal-brake', 'brake']].forEach(function (p) {
      var el = self.root.querySelector(p[0]);
      el.addEventListener('pointerdown', function (e) { self.input[p[1]] = true; el.setPointerCapture(e.pointerId); el.classList.add('down'); });
      ['pointerup', 'pointercancel'].forEach(function (ev) { el.addEventListener(ev, function () { self.input[p[1]] = false; el.classList.remove('down'); }); });
    });
    this.root.querySelector('#btn-pause').addEventListener('click', function () { self.togglePause(); });
    this.root.querySelector('#btn-slow').addEventListener('click', function () { self.slow = !self.slow; self.updateButtons(); });
    this.root.querySelector('#btn-arrows').addEventListener('click', function () { self.arrows = !self.arrows; self.updateButtons(); });
    this.root.querySelector('#btn-restart').addEventListener('click', function () { self.restart(); });
    this.root.querySelector('#btn-garage').addEventListener('click', function () { self.exit('garage'); });
    this.root.querySelector('#res-retry').addEventListener('click', function () { self.restart(); });
    this.root.querySelector('#res-garage').addEventListener('click', function () { self.exit('garage'); });
    this.root.querySelector('#res-tracks').addEventListener('click', function () { self.exit('tracks'); });
  };

  P.exit = function (where) { this.stop(); this.onExit(where, this.track); };
  P.restart = function () { this.start(this.design, this.track); };
  P.togglePause = function () { if (!this.result) { this.paused = !this.paused; this.updateButtons(); } };
  P.updateButtons = function () {
    this.root.querySelector('#btn-pause').textContent = this.paused ? '▶️ Play' : '⏸️ Pause';
    this.root.querySelector('#btn-slow').classList.toggle('active', this.slow);
    this.root.querySelector('#btn-arrows').classList.toggle('active', this.arrows);
  };

  P.frame = function (now) {
    var real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused && !this.result) {
      var simTime = real * (this.slow ? 0.25 : 1);
      this.acc = (this.acc || 0) + simTime;
      while (this.acc >= DT && !this.result) { this.tick(DT); this.acc -= DT; }
      if (simTime > 0) {
        var v = this.sim.forwardSpeed();
        var aInst = (v - this.lastV) / simTime;
        this.lastV = v;
        this.aSmooth += (aInst - this.aSmooth) * Math.min(1, simTime * 5);
      }
    }
    this.draw();
    this.updatePanel(real);
  };

  P.tick = function (dt) {
    var run = this.run, sim = this.sim;
    if (!run.started && this.input.gas) { run.started = true; this.root.querySelector('#hint-start').hidden = true; }
    if (!run.started && this.track.kind === 'top') return;
    var input = run.started ? this.input : { gas: false, brake: false };
    sim.step(dt, input);
    if (!run.started) return;
    B.updateRun(run, sim, dt);
    if (!run.history.length || run.time - run.history[run.history.length - 1].t > 0.1) run.history.push({ t: run.time, v: sim.speed() });
    var res = this.track.check(sim, run);
    if (res) this.finish(res);
  };

  P.finish = function (res) {
    this.result = res;
    var el = this.root.querySelector('#result');
    el.hidden = false;
    el.querySelector('h2').textContent = res.win ? '🎉 You did it!' : '💥 Oops!';
    el.querySelector('.reason').textContent = res.reason;
    el.querySelector('.stars').textContent = res.win ? '⭐'.repeat(res.stars) + '☆'.repeat(3 - res.stars) : '';
    el.querySelector('.why').textContent = B.explain(res.why, this.stats, this.run);
    var tips = B.evaluateTips(this.track.id, this.stats).checks.filter(function (c) { return !c.ok; });
    el.querySelector('.fix').innerHTML = !res.win && tips.length ? '<b>Ideas for your next car:</b><ul>' + tips.map(function (t) { return '<li>' + t.text + '</li>'; }).join('') + '</ul>' : '';
    if (res.win) {
      var best = B.load('bcl.stars', {});
      best[this.track.id] = Math.max(best[this.track.id] || 0, res.stars);
      B.save('bcl.stars', best);
    }
  };

  P.draw = function () {
    var c = this.canvas, ctx = this.ctx, W = c.width, H = c.height, sim = this.sim;
    if (this.track.kind === 'top') { B.renderEight(ctx, W, H, sim, this.design, { arrows: this.arrows }); return; }
    var v = sim.speed();
    var target = 58 / (1 + v / 35) * Math.min(1.2, 2.2 / Math.max(1.6, this.stats.height));
    this.cam.scale += (target - this.cam.scale) * 0.05;
    this.cam.x += (sim.x + sim.vx * 0.35 - this.cam.x) * 0.12;
    this.cam.y += (sim.y - this.cam.y) * 0.08;
    var opts = { arrows: this.arrows };
    if (this.track.id === 'stop') opts.brakeX = sim.maxX() + v * v / (2 * Math.max(0.5, this.stats.brakeDecel));
    B.renderSide(ctx, W, H, sim, this.track, this.design, this.cam, opts);
  };

  function fmt(n, d) { return (n >= 0 ? '' : '−') + Math.abs(n).toFixed(d == null ? 1 : d); }
  function kN(n) { return (n / 1000).toFixed(1) + ' kN'; }

  P.updatePanel = function () {
    var sim = this.sim, s = this.stats, run = this.run, t = this.track;
    var v = sim.speed(), a = this.aSmooth, f = sim.f;
    var el = this.root;
    el.querySelector('#hud-speed').textContent = Math.round(v * 3.6);
    el.querySelector('#hud-ms').textContent = v.toFixed(1) + ' m/s = you move ' + v.toFixed(1) + ' metres every second';
    el.querySelector('#hud-acc').textContent = fmt(a) + ' m/s²';
    el.querySelector('#hud-inc').textContent = (a >= 0 ? '+' : '−') + Math.abs(a * 3.6).toFixed(1) + ' km/h every second';
    el.querySelector('#hud-time').textContent = run.time.toFixed(1) + ' s';

    var net = f.engine - f.drag - f.brake - (f.rolling || 0) - (f.gravity || 0) - (f.scrape || 0);
    var lines = [];
    lines.push('<div class="eq"><b>Newton’s rule:</b> a = F ÷ m</div>');
    lines.push('<div class="eq">F = <span class="g">push ' + kN(f.engine) + '</span> − <span class="r">air ' + kN(f.drag) + '</span> − <span class="o">brake ' + kN(f.brake) + '</span>' +
      (f.gravity ? ' − <span class="b">gravity ' + kN(f.gravity) + '</span>' : '') + (f.scrape > 50 ? ' − <span class="br">scrape ' + kN(f.scrape) + '</span>' : '') + ' − rolling ' + kN(f.rolling || 0) + '</div>');
    lines.push('<div class="eq">a = ' + kN(net) + ' ÷ ' + Math.round(s.mass) + ' kg = <b>' + fmt(net / s.mass) + ' m/s²</b></div>');
    lines.push('<div class="eq small">Air drag = ½·ρ·Cd·A·v² – double speed ➜ 4× air push!</div>');

    var extra = '';
    if (t.id === 'stop') {
      var d = v * v / (2 * Math.max(0.5, s.brakeDecel));
      extra += '<div class="eq"><b>Brake distance</b> d = v² ÷ (2·a) = ' + v.toFixed(1) + '² ÷ (2 × ' + s.brakeDecel.toFixed(1) + ') = <b>' + d.toFixed(1) + ' m</b></div>';
      extra += '<div class="eq">Momentum p = m·v = ' + Math.round(s.mass * v) + ' kg·m/s</div>';
      if (run.lineSpeed != null) extra += '<div class="eq">Speed at the line: <b>' + Math.round(run.lineSpeed * 3.6) + ' km/h</b></div>';
    } else if (t.id === 'hill' && sim.ground) {
      var sl = sim.slope(sim.x), th = Math.atan(sl) * 180 / Math.PI, need = Math.abs(sl);
      extra += '<div class="eq">Slope θ = <b>' + th.toFixed(0) + '°</b></div>';
      extra += '<div class="eq">Gravity pull = m·g·sin θ = ' + kN(Math.abs(f.gravity)) + '</div>';
      extra += '<div class="eq">Grip needed tan θ = ' + need.toFixed(2) + ' · your grip ' + s.grip.dirt.toFixed(2) + (need > s.grip.dirt ? ' <b class="r">✗ slipping!</b>' : ' ✓') + '</div>';
      if (sim.wheelspin) extra += '<div class="eq r"><b>Wheelspin!</b> Engine pushes harder than the tyres can grip.</div>';
    } else if (t.id === 'bad') {
      extra += '<div class="eq">Clearance ' + Math.round(s.clearance * 100) + ' cm · wheel radius ' + Math.round(s.wheelR * 100) + ' cm</div>';
      extra += sim.scraping > 50 ? '<div class="eq r"><b>SCRAPING!</b> The floor of the car is rubbing the ground.</div>' : '<div class="eq g">Floor is clear of the ground.</div>';
    } else if (t.id === 'jump') {
      extra += sim.airborne ? '<div class="eq b"><b>✈ Flying! ' + run.airTime.toFixed(2) + ' s</b> – only gravity acts: falling 9.8 m/s faster each second.</div>' :
        '<div class="eq">Last flight: ' + run.lastAir.toFixed(2) + ' s</div>';
    } else if (t.id === 'speed') {
      extra += '<div class="eq">Top speed ≈ ' + Math.round(s.topSpeed * 3.6) + ' km/h (push = air + rolling)</div>';
    } else if (t.id === 'eight') {
      var r = sim.k > 1e-4 ? 1 / sim.k : Infinity;
      var slide = sim.slideLimit(), tip = sim.tipLimit();
      extra += '<div class="eq">Lap <b>' + Math.min(sim.lap + 1, t.laps) + ' / ' + t.laps + '</b> · limit ' + t.timeLimit + ' s</div>';
      extra += '<div class="eq"><b>Turn pull</b> a = v² ÷ r = ' + v.toFixed(1) + '² ÷ ' + (isFinite(r) ? r.toFixed(0) + ' m' : '∞') + ' = <b>' + sim.aLat.toFixed(1) + ' m/s²</b></div>';
      extra += meter('Slide limit (grip)', sim.aLat / slide, slide);
      extra += meter('Tip-over limit', sim.aLat / tip, tip);
      if (sim.spinTime > 0) extra += '<div class="eq r"><b>SKIDDING!</b> Tyres could not pull hard enough.</div>';
      if (sim.crossingDanger()) extra += '<div class="eq r"><b>⚠ The other car is coming to the crossing!</b> Slow down or speed up.</div>';
    }
    el.querySelector('#formulas').innerHTML = lines.join('') + extra;
    this.drawGraph();
  };

  function meter(label, frac, limit) {
    var pct = Math.min(100, Math.round(frac * 100));
    var col = frac > 0.9 ? '#d93025' : frac > 0.7 ? '#f29900' : '#1e9e3a';
    return '<div class="meter"><span>' + label + ' (' + limit.toFixed(1) + ' m/s²)</span><span class="bar"><i style="width:' + pct + '%;background:' + col + '"></i></span></div>';
  }

  P.drawGraph = function () {
    var c = this.graph, ctx = this.gctx, W = c.width, H = c.height, h = this.run.history;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);
    var maxT = Math.max(10, this.run.time), maxV = Math.max(60, Math.max.apply(null, h.map(function (p) { return p.v * 3.6; }).concat([0])) * 1.1);
    ctx.strokeStyle = '#e3e7eb'; ctx.lineWidth = 1; ctx.fillStyle = '#888'; ctx.font = '10px system-ui';
    for (var k = 0; k <= maxV; k += 20) { var y = H - 14 - k / maxV * (H - 22); ctx.beginPath(); ctx.moveTo(28, y); ctx.lineTo(W, y); ctx.stroke(); if (k % 40 === 0) ctx.fillText(k, 2, y + 3); }
    ctx.fillText('time →', W - 40, H - 2);
    ctx.fillText('km/h', 32, 10);
    ctx.strokeStyle = '#d01012'; ctx.lineWidth = 2.5; ctx.beginPath();
    h.forEach(function (p, i) {
      var x = 28 + p.t / maxT * (W - 32), y = H - 14 - p.v * 3.6 / maxV * (H - 22);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  };
})(window.BCL);
