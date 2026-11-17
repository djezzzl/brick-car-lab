// Drive screen: runs a simulation, draws it and explains the physics live.
(function (B) {
  var DT = 1 / 240;

  B.Drive = function (root, opts) {
    this.root = root;
    this.onExit = opts.onExit;
    this.onRecords = opts.onRecords;
    this.canvas = root.querySelector('#drive-canvas');
    this.ctx = this.canvas.getContext('2d');
    var self0 = this;
    window.addEventListener('resize', function () { self0.resize(); });
    window.addEventListener('orientationchange', function () { setTimeout(function () { self0.resize(); }, 300); });
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
    if (!track.ground) track.ground = track.build();
    this.sim = new B.SideSim(this.stats, track);
    this.popups = [];
    this.seenEvents = 0;
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
    this.resize();
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

  // Fit the drive canvas to the screen (so pedals and road are visible without scrolling) and keep it sharp on retina screens.
  P.resize = function () {
    var c = this.canvas, cssW = c.clientWidth;
    if (!cssW) return;
    var top = c.getBoundingClientRect().top + window.scrollY;
    var cssH = Math.round(Math.max(260, Math.min(cssW * 0.6, window.innerHeight - top - 12)));
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.style.height = cssH + 'px';
    c.width = Math.round(cssW * dpr); c.height = Math.round(cssH * dpr);
    this.dpr = dpr; this.cssW = cssW; this.cssH = cssH;
  };

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
      el.addEventListener('pointerdown', function (e) { e.preventDefault(); self.input[p[1]] = true; try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } el.classList.add('down'); });
      el.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      el.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { el.addEventListener(ev, function () { self.input[p[1]] = false; el.classList.remove('down'); }); });
    });
    this.root.querySelector('#btn-pause').addEventListener('click', function () { self.togglePause(); });
    this.root.querySelector('#btn-slow').addEventListener('click', function () { self.slow = !self.slow; self.updateButtons(); });
    this.root.querySelector('#btn-arrows').addEventListener('click', function () { self.arrows = !self.arrows; self.updateButtons(); });
    this.root.querySelector('#btn-restart').addEventListener('click', function () { self.restart(); });
    this.root.querySelector('#btn-garage').addEventListener('click', function () { self.exit('garage'); });
    this.root.querySelector('#res-retry').addEventListener('click', function () { self.restart(); });
    this.root.querySelector('#res-garage').addEventListener('click', function () { self.exit('garage'); });
    this.root.querySelector('#res-tracks').addEventListener('click', function () { self.exit('tracks'); });
    this.root.querySelector('#res-records').addEventListener('click', function () { if (self.onRecords) self.onRecords(self.track); });
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
    var input = run.started ? this.input : { gas: false, brake: false };
    sim.step(dt, input);
    if (!run.started) return;
    B.updateRun(run, sim, dt);
    if (!run.history.length || run.time - run.history[run.history.length - 1].t > 0.1) run.history.push({ t: run.time, v: sim.speed() });
    while (this.seenEvents < run.events.length) this.popups.push({ text: run.events[this.seenEvents++].text, born: performance.now() });
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
    var rec = el.querySelector('.record');
    rec.textContent = '';
    if (res.win) {
      var r = B.Records.add(this.track.id, this.design, this.stats, this.run, res.stars);
      rec.textContent = r.rank === 1 ? '🏆 NEW TRACK RECORD! #1 of ' + r.total + ' runs' : '📜 Place #' + r.rank + ' of ' + r.total + ' in the record book';
      if (r.rank === 1) this.popups.push({ text: '🏆 NEW RECORD!', born: performance.now() });
    }
  };

  P.draw = function () {
    var ctx = this.ctx, W = this.cssW || this.canvas.width, H = this.cssH || this.canvas.height, sim = this.sim;
    ctx.setTransform(this.dpr || 1, 0, 0, this.dpr || 1, 0, 0);
    var v = sim.speed();
    var target = 58 / (1 + v / 35) * Math.min(1.2, 2.2 / Math.max(1.6, this.stats.height)) * (sim.airborne ? 0.7 : 1);
    this.cam.scale += (target - this.cam.scale) * 0.05;
    // Look a little ahead of the car, but never so far that the car leaves the screen.
    var halfW = W / 2 / this.cam.scale, lead = Math.max(-halfW * 0.3, Math.min(halfW * 0.3, sim.vx * 0.25));
    this.cam.x += (sim.x + lead - this.cam.x) * 0.2;
    this.cam.x = Math.max(sim.x - halfW * 0.6, Math.min(sim.x + halfW * 0.6, this.cam.x));
    this.cam.y += (sim.y - this.cam.y) * 0.12;
    var halfH = H / 2 / this.cam.scale;
    this.cam.y = Math.max(sim.y - halfH * 0.6, Math.min(sim.y + halfH * 0.6, this.cam.y));
    B.renderSide(ctx, W, H, sim, this.track, this.design, this.cam, { arrows: this.arrows });
    this.drawPopups(ctx, W, H);
  };

  // Big cheerful text for flips, big air and records; floats up and fades out.
  P.drawPopups = function (ctx, W, H) {
    var now = performance.now();
    this.popups = this.popups.filter(function (p) { return now - p.born < 1800; });
    this.popups.forEach(function (p, i) {
      var age = (now - p.born) / 1800;
      ctx.globalAlpha = 1 - age * age;
      ctx.font = '900 ' + Math.round(Math.min(48, W / 14)) + 'px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 7; ctx.strokeStyle = '#1b2a34'; ctx.fillStyle = '#f2cd37';
      var y = H * 0.3 - age * 40 + i * 54;
      ctx.strokeText(p.text, W / 2, y); ctx.fillText(p.text, W / 2, y);
      ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    });
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
    if (sim.airborne) extra += '<div class="eq b">🎮 In the air: hold <b>BRAKE</b> to tip the nose down (stopping the wheels spins the car the other way!).</div>';
    if (f.booster > 0) extra += '<div class="eq o"><b>⚡ BOOSTER!</b> Extra push ' + kN(f.booster) + ' ➜ a bigger speed increment.</div>';
    if (t.id === 'hill') {
      var sl = sim.slope(sim.x), th = Math.atan(sl) * 180 / Math.PI, need = Math.abs(sl);
      extra += '<div class="eq">Slope θ = <b>' + th.toFixed(0) + '°</b></div>';
      extra += '<div class="eq">Gravity pull = m·g·sin θ = ' + kN(Math.abs(f.gravity)) + '</div>';
      extra += '<div class="eq">Grip needed tan θ = ' + need.toFixed(2) + ' · your grip ' + s.grip.dirt.toFixed(2) + (need > s.grip.dirt ? ' <b class="r">✗ slipping!</b>' : ' ✓') + '</div>';
      if (sim.wheelspin) extra += '<div class="eq r"><b>Wheelspin!</b> Engine pushes harder than the tyres can grip.</div>';
    } else if (t.id === 'bad') {
      extra += '<div class="eq">Clearance ' + Math.round(s.clearance * 100) + ' cm · wheels ' + Math.round(s.wheelRMin * 100) + '–' + Math.round(s.wheelR * 100) + ' cm radius</div>';
      extra += sim.scraping > 50 ? '<div class="eq r"><b>SCRAPING!</b> The floor of the car is rubbing the ground.</div>' : '<div class="eq g">Floor is clear of the ground.</div>';
    } else if (t.id === 'speed') {
      extra += '<div class="eq">Top speed ≈ ' + Math.round(s.topSpeed * 3.6) + ' km/h (push = air + rolling)</div>';
    } else if (t.id === 'roller' || t.id === 'mega') {
      var h = Math.max(0, sim.ground(sim.x)), pe = s.mass * B.G * h, ke = 0.5 * s.mass * v * v, tot = Math.max(1, pe + ke);
      extra += '<div class="eq"><b>Energy swap</b> (height ⇄ speed)</div>';
      extra += '<div class="energy"><i class="pe" style="width:' + Math.round(pe / tot * 100) + '%"></i><i class="ke" style="width:' + Math.round(ke / tot * 100) + '%"></i></div>';
      extra += '<div class="eq small"><span class="b">■ height m·g·h = ' + Math.round(pe / 1000) + ' kJ</span> (h = ' + h.toFixed(1) + ' m) · <span class="r">■ speed ½·m·v² = ' + Math.round(ke / 1000) + ' kJ</span></div>';
      if (t.id === 'mega' && h > 1) extra += '<div class="eq">Falling ' + h.toFixed(0) + ' m gives v = √(2·g·h) = ' + Math.round(Math.sqrt(2 * B.G * h) * 3.6) + ' km/h</div>';
    }
    if (t.gaps || t.id === 'roller' || t.id === 'mega') {
      extra += sim.airborne ? '<div class="eq b"><b>✈ Flying! ' + run.airTime.toFixed(2) + ' s</b> – only gravity acts: falling 9.8 m/s faster each second.</div>' :
        '<div class="eq">Last flight: ' + run.lastAir.toFixed(2) + ' s' + (run.flips ? ' · flips: ' + run.flips : '') + '</div>';
    }
    el.querySelector('#formulas').innerHTML = lines.join('') + extra;
    this.drawGraph();
  };

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
