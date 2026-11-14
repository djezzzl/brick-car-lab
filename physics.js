// Side-view car physics: a rigid brick body on two sprung wheels over a ground profile.
// Each wheel is its own small mass that touches the ground as a circle, so steps push
// back along the real contact direction (big wheels roll up, small ones hit a wall).
(function (B) {
  var SCRAPE_GRIP = 0.6;

  B.SideSim = function (stats, track) {
    var s = stats;
    this.s = s;
    this.track = track;
    this.ground = track.ground;
    this.mw = 2 * s.wheelMass + 15; // one axle: two wheels + hub
    this.m = s.mass - 2 * this.mw;   // sprung body mass
    this.mTotal = s.mass;
    var L = Math.max(s.length, 1), H = s.bodyTop + s.clearance;
    this.I = this.m * (L * L + H * H) / 12;

    // Body outline points (cell corners) relative to the centre of mass.
    var seen = {}, pts = [], roofCols = {};
    s.cells.forEach(function (c) {
      roofCols[c.col] = Math.max(roofCols[c.col] == null ? -1 : roofCols[c.col], c.row);
    });
    s.cells.forEach(function (c) {
      [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0], [0.5, 1]].forEach(function (k) {
        var x = (c.col + k[0]) * B.STUD, y = (c.row + k[1]) * B.STUD, key = x.toFixed(3) + ',' + y.toFixed(3);
        if (seen[key]) return;
        seen[key] = true;
        pts.push({ x: x - s.comX, y: y - s.comY, roof: k[1] === 1 && roofCols[c.col] === c.row && c.row > 0 });
      });
    });
    this.points = pts;

    // Suspension: spring sags 40% of its travel when the car sits still.
    var sag = 0.4 * s.travel;
    this.k = (this.m * B.G / 2) / sag;
    this.c = 2 * 0.6 * Math.sqrt(this.k * this.m / 2);
    this.kStop = this.k * 12;
    this.kLat = 60000 + this.mTotal * 300;
    this.cLat = 2 * 0.7 * Math.sqrt(this.kLat * this.mw);
    this.kTyre = (this.mTotal * B.G / 2) / 0.02;
    this.cTyre = 2 * 0.4 * Math.sqrt(this.kTyre * this.mw);
    this.L0 = s.travel + 0.05;
    this.restLen = this.L0 - sag;
    var anchorY = s.wheelY + this.restLen - s.comY;

    var startX = 5 - s.minX + s.comX;
    this.x = startX;
    this.y = this.ground(startX) + s.clearance + s.comY;
    this.a = 0; this.vx = 0; this.vy = 0; this.w = 0;

    var self = this;
    this.wheels = [s.rearX, s.frontX].map(function (wx) {
      var w = { ax: wx - s.comX, ay: anchorY, len: self.restLen, spin: 0, spinRate: 0, contact: false, N: 0, vx: 0, vy: 0 };
      var A = self.toWorld(w.ax, w.ay);
      w.x = A.x; w.y = A.y - self.restLen;
      w.cx = w.x; w.cy = w.y;
      return w;
    });

    this.flipped = false;
    this.upsideTime = 0;
    this.reverseTime = 0;
    this.scraping = 0;
    this.f = { engine: 0, drag: 0, brake: 0, gravity: 0, rolling: 0, scrape: 0 };
    this.wheelspin = false;
    this.airborne = false;
  };

  var P = B.SideSim.prototype;

  P.toWorld = function (px, py) {
    var c = Math.cos(this.a), sn = Math.sin(this.a);
    return { x: this.x + px * c - py * sn, y: this.y + px * sn + py * c };
  };
  P.pointVel = function (wx, wy) {
    return { x: this.vx - this.w * (wy - this.y), y: this.vy + this.w * (wx - this.x) };
  };
  P.speed = function () { return Math.hypot(this.vx, this.vy); };
  P.forwardSpeed = function () { return this.vx * Math.cos(this.a) + this.vy * Math.sin(this.a); };
  P.surface = function () { return this.track.surface || 'road'; };
  P.slope = function (x) { return (this.ground(x + 0.04) - this.ground(x - 0.04)) / 0.08; };
  P.minX = function () { var self = this; return Math.min.apply(null, this.points.map(function (p) { return self.toWorld(p.x, p.y).x; })); };
  P.maxX = function () { var self = this; return Math.max.apply(null, this.points.map(function (p) { return self.toWorld(p.x, p.y).x; })); };

  // Closest ground point to a wheel centre (ground treated as short straight pieces).
  P.wheelContact = function (wx, wy, r) {
    var gh = this.ground(wx);
    if (wy < gh) return { pen: r + (gh - wy), nx: 0, ny: 1 };
    var step = Math.min(0.025, r / 10), best = null, bestD = r;
    var x0 = wx - r - step, h0 = this.ground(x0);
    for (var x1 = x0 + step; x1 <= wx + r + step; x1 += step) {
      var h1 = this.ground(x1);
      var ex = x1 - x0, ey = h1 - h0;
      var t = Math.max(0, Math.min(1, ((wx - x0) * ex + (wy - h0) * ey) / (ex * ex + ey * ey)));
      var qx = x0 + ex * t, qy = h0 + ey * t, d = Math.hypot(wx - qx, wy - qy);
      if (d < bestD) { bestD = d; best = { x: qx, y: qy }; }
      x0 = x1; h0 = h1;
    }
    if (!best) return null;
    var dd = bestD || 1e-6;
    return { pen: r - bestD, nx: (wx - best.x) / dd, ny: (wy - best.y) / dd };
  };

  // Smallest push that gets a body point out of the ground: up the slope, or sideways off a step face.
  P.groundPush = function (px, py) {
    var gh = this.ground(px);
    var sl = this.slope(px), nl = Math.hypot(1, sl);
    var best = { nx: -sl / nl, ny: 1 / nl, depth: (gh - py) / nl };
    for (var dx = 0.02; dx < best.depth; dx += 0.02) {
      if (this.ground(px - dx) < py) { best = { nx: -1, ny: 0, depth: dx }; break; }
      if (this.ground(px + dx) < py) { best = { nx: 1, ny: 0, depth: dx }; break; }
    }
    return best;
  };

  P.step = function (dt, input) {
    var s = this.s, m = this.m, g = B.G, self = this, r = s.wheelR;
    var Fx = 0, Fy = -m * g, T = 0;
    function apply(fx, fy, px, py) { Fx += fx; Fy += fy; T += (px - self.x) * fy - (py - self.y) * fx; }

    var ca = Math.cos(this.a), sa = Math.sin(this.a);
    var fwdX = ca, fwdY = sa, downX = sa, downY = -ca;
    var vf = this.forwardSpeed();
    var mu = s.grip[this.surface()];
    var f = { engine: 0, drag: 0, brake: 0, gravity: 0, rolling: 0, scrape: 0 };

    // Reverse when holding brake while stopped (to back out of trouble).
    if (input.brake && !input.gas && Math.abs(vf) < 0.3) this.reverseTime += dt;
    else if (!input.brake || input.gas) this.reverseTime = 0;
    var reversing = this.reverseTime > 1.2;

    // --- suspension: springs between body anchors and wheels
    this.wheels.forEach(function (w) {
      var A = self.toWorld(w.ax, w.ay), Av = self.pointVel(A.x, A.y);
      var rx = w.x - A.x, ry = w.y - A.y;
      var sAx = rx * downX + ry * downY, sLat = rx * fwdX + ry * fwdY;
      var rvx = w.vx - Av.x, rvy = w.vy - Av.y;
      var vAx = rvx * downX + rvy * downY, vLat = rvx * fwdX + rvy * fwdY;
      var comp = self.L0 - sAx;
      var Fs = self.k * comp - self.c * vAx;
      if (comp > s.travel) Fs += self.kStop * (comp - s.travel);
      if (comp < 0) Fs += self.kStop * comp;
      var Fl = -self.kLat * sLat - self.cLat * vLat;
      var wfx = Fs * downX + Fl * fwdX, wfy = Fs * downY + Fl * fwdY;
      w.fx = wfx; w.fy = wfy - self.mw * g;
      apply(-wfx, -wfy, A.x, A.y);
      w.len = sAx; w.comp = comp;
    });

    // --- tyres pressing on the ground
    var contacts = [], totalN = 0;
    this.wheels.forEach(function (w) {
      w.contact = false; w.N = 0;
      var c = self.wheelContact(w.x, w.y, r);
      if (!c || c.pen <= 0) return;
      var vn = w.vx * c.nx + w.vy * c.ny;
      var N = Math.max(0, self.kTyre * c.pen - self.cTyre * vn);
      w.fx += N * c.nx; w.fy += N * c.ny;
      w.contact = true; w.N = N;
      contacts.push({ w: w, nx: c.nx, ny: c.ny, N: N });
      totalN += N;
    });
    this.airborne = contacts.length === 0;

    // Engine push: power ÷ speed (capped at low speed), never more than the tyres can grip.
    var engineTotal = 0;
    if (input.gas) engineTotal = s.power / Math.max(Math.abs(vf), 8);
    else if (reversing && vf > -4) engineTotal = -0.35 * s.power / Math.max(Math.abs(vf), 8);
    this.wheelspin = false;
    contacts.forEach(function (c) {
      var w = c.w, share = totalN > 0 ? c.N / totalN : 0;
      var tx = c.ny, ty = -c.nx; // along the ground, forward
      var vt = w.vx * tx + w.vy * ty;
      var gripMax = mu * c.N;
      var Fl = engineTotal * share;
      if (Math.abs(Fl) > gripMax) { Fl = Math.sign(Fl) * gripMax; self.wheelspin = true; }
      f.engine += Fl;
      var stopNeeded = Math.abs(vt) * self.mw / dt;
      if (input.brake && !reversing) {
        var Fb = Math.min(B.BRAKE_FORCE * share, gripMax, stopNeeded);
        Fl -= Math.sign(vt) * Fb; f.brake += Fb;
      }
      var Fr = Math.min(B.ROLLING * c.N, stopNeeded);
      Fl -= Math.sign(vt) * Fr; f.rolling += Fr;
      w.fx += Fl * tx; w.fy += Fl * ty;
      w.spinRate = vt / r;
    });

    // --- move wheels
    this.wheels.forEach(function (w) {
      w.vx += w.fx / self.mw * dt; w.vy += w.fy / self.mw * dt;
      w.x += w.vx * dt; w.y += w.vy * dt;
      w.spin += w.spinRate * dt;
      w.cx = w.x; w.cy = w.y;
    });

    // --- air: drag against motion, spoilers press the car down
    var v = this.speed();
    if (v > 0.01) {
      var D = 0.5 * B.AIR_DENSITY * s.cdA * v * v;
      apply(-D * this.vx / v, -D * this.vy / v, this.x, this.y);
      f.drag = D;
    }
    if (s.downforceA > 0) {
      var DF = 0.5 * B.AIR_DENSITY * s.downforceA * v * v;
      apply(downX * DF, downY * DF, this.x, this.y);
    }

    // --- body bricks touching the ground: scrape and slow down
    var scraping = 0, roofHit = false;
    this.points.forEach(function (p) {
      var Pw = self.toWorld(p.x, p.y);
      if (Pw.y >= self.ground(Pw.x)) return;
      var gp = self.groundPush(Pw.x, Pw.y);
      var nx = gp.nx, ny = gp.ny;
      var vp = self.pointVel(Pw.x, Pw.y);
      var vn = vp.x * nx + vp.y * ny;
      var Fn = Math.max(0, m * 1000 * gp.depth - m * 8 * vn);
      var tx = ny, ty = -nx, vt = vp.x * tx + vp.y * ty;
      var Ff = Math.min(SCRAPE_GRIP * Fn, Math.abs(vt) * m * 0.03 / dt);
      apply(Fn * nx - Math.sign(vt) * Ff * tx, Fn * ny - Math.sign(vt) * Ff * ty, Pw.x, Pw.y);
      scraping += Ff;
      if (p.roof) roofHit = true;
    });
    f.scrape = scraping;
    this.scraping = scraping;

    // Gravity part pulling along the ground (for the force arrows).
    var gs = (this.ground(this.x + 1) - this.ground(this.x - 1)) / 2;
    f.gravity = this.mTotal * g * gs / Math.hypot(1, gs);
    this.f = f;

    this.vx += Fx / m * dt;
    this.vy += Fy / m * dt;
    this.w += T / this.I * dt;
    this.w *= 1 - 0.3 * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.a += this.w * dt;

    if (roofHit && Math.cos(this.a) < 0.5) this.flipped = true;
    if (Math.cos(this.a) < -0.3) this.upsideTime += dt; else this.upsideTime = 0;
    if (this.upsideTime > 0.5) this.flipped = true;
  };
})(window.BCL);
