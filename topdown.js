// "Death 8": top-down figure-eight where corner speed decides slide / tip-over.
(function (B) {
  var A = 60, N = 3000;

  // Lemniscate of Bernoulli: straight through the crossing, tightest (radius A/3) at both ends.
  function point(t) {
    var d = 1 + Math.sin(t) * Math.sin(t);
    return { x: A * Math.cos(t) / d, y: A * Math.sin(t) * Math.cos(t) / d };
  }

  function buildPath() {
    var pts = [], len = 0, prev = null, h = 1e-4;
    for (var i = 0; i <= N; i++) {
      var t = i / N * Math.PI * 2; // starts at the right end of the 8
      var p = point(t), p1 = point(t - h), p2 = point(t + h);
      var dx = (p2.x - p1.x) / (2 * h), dy = (p2.y - p1.y) / (2 * h);
      var ddx = (p2.x - 2 * p.x + p1.x) / (h * h), ddy = (p2.y - 2 * p.y + p1.y) / (h * h);
      var k = Math.abs(dx * ddy - dy * ddx) / Math.pow(Math.hypot(dx, dy), 3);
      if (prev) len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = { x: p.x, y: p.y, s: len, k: k, heading: Math.atan2(dy, dx) };
      pts.push(prev);
    }
    return { pts: pts, length: len };
  }

  var PATH = buildPath();
  B.EIGHT_PATH = PATH;
  B.EIGHT_MIN_RADIUS = 1 / Math.max.apply(null, PATH.pts.map(function (p) { return p.k; }));

  B.eightAt = function (s) {
    var L = PATH.length;
    s = ((s % L) + L) % L;
    var lo = 0, hi = PATH.pts.length - 1;
    while (hi - lo > 1) { var mid = (lo + hi) >> 1; if (PATH.pts[mid].s <= s) lo = mid; else hi = mid; }
    return PATH.pts[lo];
  };

  var track = B.trackById('eight');
  var total = PATH.length * track.laps;
  track.timeLimit = Math.round(total / 10.5);
  track.three = Math.round(total / 14.5);
  track.two = Math.round(total / 12.5);
  track.starHint = '⭐⭐⭐ under ' + track.three + ' s · ⭐⭐ under ' + track.two + ' s · limit ' + track.timeLimit + ' s';

  B.EightSim = function (stats) {
    this.s = stats;
    this.m = stats.mass;
    this.pos = 0;
    this.v = 0;
    this.lap = 0;
    this.ghostPos = PATH.length * 0.75; // starts at the crossing, a quarter lap out of step
    this.ghostV = 14;
    this.spinTime = 0;
    this.slides = 0;
    this.tipped = false;
    this.crashed = false;
    this.aLat = 0;
    this.f = { engine: 0, drag: 0, brake: 0, rolling: 0 };
  };

  var P = B.EightSim.prototype;
  P.speed = function () { return this.v; };
  P.forwardSpeed = function () { return this.v; };
  P.slideLimit = function () {
    var s = this.s;
    return s.gripRoad * B.G + 0.5 * B.AIR_DENSITY * s.downforceA * this.v * this.v / this.m;
  };
  P.tipLimit = function () { return this.s.tipLimitG * B.G; };

  // Seconds until each car reaches the middle crossing (at a quarter and three quarters of a lap).
  function timeToCrossing(pos, v) {
    var L = PATH.length, p = ((pos % L) + L) % L;
    var d = p < L / 4 ? L / 4 - p : p < 3 * L / 4 ? 3 * L / 4 - p : 5 * L / 4 - p;
    return d / Math.max(v, 0.5);
  }

  // Seconds until each car reaches the crossing.
  P.crossingETA = function () {
    return { me: timeToCrossing(this.pos, this.v), other: timeToCrossing(this.ghostPos, this.ghostV) };
  };

  // True when both cars will reach the crossing at about the same time.
  P.crossingDanger = function () {
    var e = this.crossingETA();
    return e.me < 3 && e.other < 3 && Math.abs(e.me - e.other) < 1;
  };

  P.step = function (dt, input) {
    var s = this.s, m = this.m, g = B.G;
    var f = { engine: 0, drag: 0, brake: 0, rolling: 0 };
    var spinning = this.spinTime > 0;
    if (spinning) this.spinTime -= dt;
    if (input.gas && !spinning) f.engine = Math.min(s.power / Math.max(this.v, 8), s.gripRoad * m * g);
    if (input.brake) f.brake = this.v > 0.01 ? Math.min(B.BRAKE_FORCE, s.gripRoad * m * g, this.v * m / dt) : 0;
    f.drag = 0.5 * B.AIR_DENSITY * s.cdA * this.v * this.v;
    f.rolling = this.v > 0.01 ? Math.min(B.ROLLING * m * g, this.v * m / dt) : 0;
    this.f = f;
    this.v = Math.max(0, this.v + (f.engine - f.brake - f.drag - f.rolling) / m * dt);

    var before = this.pos;
    this.pos += this.v * dt;
    if (Math.floor(this.pos / PATH.length) > Math.floor(before / PATH.length)) this.lap++;
    // The other car never rams you from behind: it slows down to follow.
    var L = PATH.length, gap = (((this.pos - this.ghostPos) % L) + L) % L;
    var ghostSpeed = gap < 10 ? Math.min(this.ghostV, this.v * 0.9) : this.ghostV;
    this.ghostPos += ghostSpeed * dt;

    var here = B.eightAt(this.pos);
    this.k = here.k;
    this.aLat = this.v * this.v * here.k;
    var slide = this.slideLimit(), tip = this.tipLimit();
    if (!spinning && this.aLat > Math.min(slide, tip)) {
      if (tip < slide) this.tipped = true;
      else { this.v *= 0.5; this.spinTime = 1.2; this.slides++; }
    }

    var me = B.eightAt(this.pos), gh = B.eightAt(this.ghostPos);
    var atCrossing = Math.hypot(me.x, me.y) < 6 && Math.hypot(gh.x, gh.y) < 6;
    if (atCrossing && Math.hypot(me.x - gh.x, me.y - gh.y) < 3.2) this.crashed = true;
  };

  track.check = function (sim, run) {
    if (sim.tipped) return { win: false, reason: 'Your car tipped over in the corner!', why: 'tip' };
    if (sim.crashed) return { win: false, reason: 'CRASH at the crossing!', why: 'crash' };
    if (run.time > this.timeLimit) return { win: false, reason: 'Out of time!', why: 'time' };
    if (sim.lap >= this.laps) {
      var stars = run.time <= this.three ? 3 : run.time <= this.two ? 2 : 1;
      return { win: true, reason: '3 laps in ' + run.time.toFixed(1) + ' s' + (sim.slides ? ' (' + sim.slides + ' slides)' : '') + '!', stars: stars, why: 'eightWin' };
    }
    return null;
  };
})(window.BCL);
