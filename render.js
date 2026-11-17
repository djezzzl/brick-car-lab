// Drawing: LEGO-style car, side-view world with force arrows, and car thumbnails.
(function (B) {
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  B.shade = shade;

  function hex(c) { return c && c.charAt(0) === '#' ? c : '#888888'; }

  // Draws the brick body in design metres (y up). Caller sets the transform.
  B.drawBody = function (ctx, design, px) {
    var S = B.STUD, lw = 1.5 / px;
    var occupied = {};
    B.cellsOf(design).forEach(function (c) { occupied[c.col + ',' + c.row] = true; });
    design.pieces.forEach(function (p) {
      var x = p.col * S, y = p.row * S, w = p.len * S, color = B.pieceColor(p);
      ctx.lineWidth = lw;
      if (p.type === 'spoiler') {
        ctx.fillStyle = '#333';
        ctx.fillRect(x + w * 0.4, y, w * 0.12, S * 0.7);
        ctx.fillStyle = color;
        ctx.fillRect(x, y + S * 0.65, w, S * 0.25);
        ctx.strokeStyle = shade(color, -70);
        ctx.strokeRect(x, y + S * 0.65, w, S * 0.25);
        return;
      }
      if (p.type === 'driver') { drawDriver(ctx, x, y, S, p.color); return; }
      var shape = p.shape || 'block';
      ctx.beginPath();
      B.pieceOutline(p).forEach(function (q, i) { var X = x + q[0] * S, Y = y + q[1] * S; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
      ctx.closePath();
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = shade(hex(color), -80); ctx.stroke();
      if (shape === 'round') {
        ctx.fillStyle = shade(hex(color), 40);
        ctx.beginPath(); ctx.arc(x + S * 0.38, y + S * 0.62, S * 0.12, 0, Math.PI * 2); ctx.fill();
      }
      if (shape !== 'block') {
        if (shape === 'wedge' && (p.rot === 2 || p.rot === 3)) studs(p, x, y, color);
        return;
      }
      ctx.fillStyle = shade(hex(color), 30);
      ctx.fillRect(x, y + S * 0.8, w, S * 0.2);
      ctx.strokeRect(x, y, w, S);
      if (p.type === 'window') {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.beginPath(); ctx.moveTo(x + w * 0.2, y + S * 0.2); ctx.lineTo(x + w * 0.5, y + S * 0.8); ctx.stroke();
      }
      if (p.type === 'light') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        for (var i = 0; i < p.len * 3; i++) ctx.fillRect(x + (i + 0.3) * S / 3, y + S * 0.35, S * 0.08, S * 0.08);
      }
      if (p.type === 'heavy') {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath(); ctx.moveTo(x + S * 0.1, y + S * 0.15); ctx.lineTo(x + w - S * 0.1, y + S * 0.15); ctx.stroke();
      }
      if (p.type === 'engine') {
        ctx.fillStyle = '#222';
        for (var j = 0; j < 3; j++) ctx.fillRect(x + w * (0.2 + j * 0.25), y + S * 0.2, w * 0.1, S * 0.55);
        if (p.engine === 'rocket' || p.engine === 'turbo') {
          ctx.fillStyle = '#999';
          ctx.fillRect(x - S * 0.15, y + S * 0.1, S * 0.15, S * 0.12);
        }
      }
      studs(p, x, y, color);
    });

    // Studs on top where nothing sits above.
    function studs(p, x, y, color) {
      for (var k = 0; k < p.len; k++) {
        if (occupied[(p.col + k) + ',' + (p.row + 1)]) continue;
        ctx.fillStyle = p.type === 'window' ? '#b9e4f8' : shade(hex(color), 10);
        ctx.fillRect(x + k * S + S * 0.25, y + S, S * 0.5, S * 0.14);
        ctx.strokeStyle = shade(hex(color), -80);
        ctx.strokeRect(x + k * S + S * 0.25, y + S, S * 0.5, S * 0.14);
      }
    }
  };

  // A minifig head with a helmet, looking forward (+x).
  function drawDriver(ctx, x, y, S, helmet) {
    var cx = x + S * 0.5, cy = y + S * 0.42, r = S * 0.3;
    ctx.fillStyle = '#f2cd37'; ctx.strokeStyle = '#7a5c00';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx + r * 0.45, cy + r * 0.15, r * 0.12, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = r * 0.12;
    ctx.beginPath(); ctx.arc(cx + r * 0.3, cy - r * 0.15, r * 0.35, -Math.PI * 0.45, -Math.PI * 0.05); ctx.stroke();
    ctx.fillStyle = helmet || '#d01012';
    ctx.beginPath(); ctx.arc(cx, cy + r * 0.05, r * 1.08, Math.PI * 0.05, Math.PI * 0.95); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(160,220,255,0.85)';
    ctx.fillRect(cx + r * 0.25, cy + r * 0.25, r * 0.8, r * 0.25);
    ctx.fillStyle = '#555'; ctx.fillRect(cx - r * 0.35, y, r * 0.7, S * 0.12);
  }

  B.drawWheel = function (ctx, cx, cy, r, spin, tyre, px) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-spin);
    ctx.fillStyle = '#1d1d1d';
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    if (tyre === 'offroad') {
      ctx.fillStyle = '#1d1d1d';
      for (var i = 0; i < 12; i++) {
        var a = i / 12 * Math.PI * 2;
        ctx.save(); ctx.rotate(a); ctx.fillRect(r * 0.92, -r * 0.1, r * 0.14, r * 0.2); ctx.restore();
      }
    }
    ctx.fillStyle = '#c9ccd1';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#7d8187';
    ctx.lineWidth = Math.max(r * 0.08, 1 / px);
    for (var k = 0; k < 5; k++) {
      var b = k / 5 * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(b) * r * 0.5, Math.sin(b) * r * 0.5); ctx.stroke();
    }
    ctx.fillStyle = '#7d8187';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };

  function arrow(ctx, x, y, dx, dy, color, label) {
    var len = Math.hypot(dx, dy);
    if (len < 4) return;
    var ux = dx / len, uy = dy / len;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx - ux * 10, y + dy - uy * 10); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy);
    ctx.lineTo(x + dx - ux * 16 - uy * 9, y + dy - uy * 16 + ux * 9);
    ctx.lineTo(x + dx - ux * 16 + uy * 9, y + dy - uy * 16 - ux * 9);
    ctx.closePath(); ctx.fill();
    if (label) {
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      var tx = x + dx + ux * 8 - (ux < 0 ? ctx.measureText(label).width : 0), ty = y + dy + uy * 8 + 4;
      ctx.strokeText(label, tx, ty); ctx.fillText(label, tx, ty);
    }
  }

  function kN(f) { return (f / 1000).toFixed(1) + ' kN'; }

  B.renderSide = function (ctx, W, H, sim, track, design, cam, opts) {
    var s = sim.s;
    var px = cam.scale;
    var sx = function (x) { return (x - cam.x) * px + W / 2; };
    var sy = function (y) { return H * 0.5 - (y - cam.y) * px; };

    var th = track.theme || { sky: ['#7ec8f2', '#d9f1ff'], hills: '#b5e0b0', ground: '#6d6f73', edge: '#3c3d40' };
    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, th.sky[0]); sky.addColorStop(1, th.sky[1]);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // parallax hills
    ctx.fillStyle = th.hills;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var hx = 0; hx <= W; hx += 20) ctx.lineTo(hx, H * 0.55 - 40 * Math.sin((hx + cam.x * px * 0.2) / 140) - 20);
    ctx.lineTo(W, H); ctx.fill();

    var x0 = cam.x - W / 2 / px - 1, x1 = cam.x + W / 2 / px + 1;
    // lava / water / dark canyon inside each gap
    if (track.hazard) {
      var lvl = sy(track.hazard === 'canyon' ? 0.5 : track.hazardLevel);
      var t = Date.now() / 1000;
      (track.gaps || []).forEach(function (g) {
        var gx0 = sx(g[0]), gx1 = sx(g[1]);
        if (gx1 < 0 || gx0 > W) return;
        ctx.fillStyle = { water: '#1e88e5', lava: '#ff5722', canyon: '#4e342e' }[track.hazard];
        ctx.fillRect(gx0, lvl, gx1 - gx0, H - lvl);
        if (track.hazard === 'canyon') return;
        ctx.save(); ctx.beginPath(); ctx.rect(gx0, lvl - 12, gx1 - gx0, H); ctx.clip();
        ctx.fillStyle = track.hazard === 'lava' ? '#ffc107' : 'rgba(255,255,255,0.7)';
        for (var wx = gx0 - 40; wx < gx1 + 40; wx += 30) {
          ctx.beginPath(); ctx.arc(wx + (t * 25) % 30, lvl + 3 + 3 * Math.sin(t * 3 + wx), 6, Math.PI, 0); ctx.fill();
        }
        if (track.hazard === 'water') {
          for (var k = 0; k < 2; k++) {
            var fx = sx(g[0] + (g[1] - g[0]) * (0.3 + 0.4 * k) + 2.5 * Math.sin(t * (0.8 + k) + k));
            ctx.fillStyle = '#546e7a';
            ctx.beginPath(); ctx.moveTo(fx - 0.6 * px, lvl + 2); ctx.lineTo(fx + 0.1 * px, lvl - 1.0 * px); ctx.lineTo(fx + 0.5 * px, lvl + 2); ctx.closePath(); ctx.fill();
          }
        }
        ctx.restore();
      });
    }
    ctx.fillStyle = th.ground;
    ctx.beginPath(); ctx.moveTo(sx(x0), H);
    var step = Math.max(0.05, 2 / px);
    for (var x = x0; x <= x1; x += step) ctx.lineTo(sx(x), sy(sim.ground(x)));
    ctx.lineTo(sx(x1), H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = th.edge;
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (x = x0; x <= x1; x += step) { if (x === x0) ctx.moveTo(sx(x), sy(sim.ground(x))); else ctx.lineTo(sx(x), sy(sim.ground(x))); }
    ctx.stroke();

    // distance ticks
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '12px system-ui, sans-serif';
    for (var m = Math.ceil(x0 / 10) * 10; m <= x1; m += 10) {
      ctx.fillRect(sx(m) - 1, sy(sim.ground(m)) + 4, 2, 10);
      ctx.fillText(m + ' m', sx(m) + 3, sy(sim.ground(m)) + 26);
    }
    function pole(x, color, label, h) {
      var gx = sx(x), gy = sy(sim.ground(x));
      ctx.fillStyle = '#444'; ctx.fillRect(gx - 2, gy - (h || 70), 4, h || 70);
      ctx.fillStyle = color; ctx.fillRect(gx + 2, gy - (h || 70), 36, 22);
      ctx.fillStyle = '#111'; ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(label, gx + 6, gy - (h || 70) + 15);
    }
    (track.markers || []).forEach(function (mk) { pole(mk.x, '#fff', mk.label, 55); });
    if (track.finishX) {
      var fx = sx(track.finishX), fy = sy(sim.ground(track.finishX));
      for (var i = 0; i < 8; i++) for (var j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? '#000' : '#fff';
        ctx.fillRect(fx + j * 8, fy - 100 + i * 8, 8, 8);
      }
      ctx.fillStyle = '#444'; ctx.fillRect(fx - 3, fy - 100, 3, 100);
    }
    // booster pads: glowing arrows on the road
    (track.boosters || []).forEach(function (bz) {
      if (bz[1] < x0 || bz[0] > x1) return;
      var glow = 0.6 + 0.4 * Math.sin(Date.now() / 120);
      for (var bx = bz[0]; bx < bz[1]; bx += 1.6) {
        var gx = sx(bx), gy = sy(sim.ground(bx));
        ctx.fillStyle = 'rgba(255,152,0,' + glow + ')';
        ctx.beginPath(); ctx.moveTo(gx, gy - 2); ctx.lineTo(gx + 0.8 * px, gy - 2); ctx.lineTo(gx + 1.3 * px, gy - 0.25 * px - 2); ctx.lineTo(gx + 0.8 * px, gy - 0.5 * px - 2); ctx.lineTo(gx, gy - 0.5 * px - 2); ctx.lineTo(gx + 0.5 * px, gy - 0.25 * px - 2); ctx.closePath(); ctx.fill();
      }
    });

    // car
    ctx.save();
    ctx.translate(sx(sim.x), sy(sim.y));
    ctx.rotate(-sim.a);
    ctx.scale(px, -px);
    ctx.translate(-s.comX, -s.comY);
    // suspension struts
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.07;
    sim.wheels.forEach(function (w) {
      var ax = w.ax + s.comX, ay = w.ay + s.comY;
      ctx.beginPath(); ctx.moveTo(ax, Math.max(ay, 0.02)); ctx.lineTo(ax, ay - w.len); ctx.stroke();
    });
    B.drawBody(ctx, design, px);
    sim.wheels.forEach(function (w) {
      B.drawWheel(ctx, w.ax + s.comX, w.ay + s.comY - w.len, w.r, w.spin, design.tyre, px);
    });
    // centre of mass marker
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(s.comX, s.comY, 0.1, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.moveTo(s.comX, s.comY); ctx.arc(s.comX, s.comY, 0.1, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(s.comX, s.comY); ctx.arc(s.comX, s.comY, 0.1, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    ctx.restore();

    // force arrows (length: the car's weight = 70 px)
    if (opts.arrows) {
      var cx = sx(sim.x), cy = sy(sim.y) - (s.bodyTop + 0.6) * px - 10;
      var unit = 70 / (s.mass * B.G);
      var fx2 = Math.cos(sim.a), fy2 = -Math.sin(sim.a);
      var clamp = function (v) { return Math.max(-170, Math.min(170, v)); };
      var f = sim.f;
      var dir = sim.forwardSpeed() >= 0 ? 1 : -1;
      arrow(ctx, cx, cy, clamp(f.engine * unit) * fx2, clamp(f.engine * unit) * fy2, '#1e9e3a', f.engine > 50 ? 'push ' + kN(f.engine) : '');
      arrow(ctx, cx, cy + 16, -dir * clamp(f.drag * unit) * fx2, -dir * clamp(f.drag * unit) * fy2, '#d93025', f.drag > 200 ? 'air ' + kN(f.drag) : '');
      arrow(ctx, cx, cy + 32, -dir * clamp(f.brake * unit) * fx2, -dir * clamp(f.brake * unit) * fy2, '#f29900', f.brake > 50 ? 'brake ' + kN(f.brake) : '');
      if (Math.abs(f.gravity) > 300) arrow(ctx, cx, cy + 48, -clamp(f.gravity * unit) * fx2, -clamp(f.gravity * unit) * fy2, '#1a73e8', 'gravity ' + kN(Math.abs(f.gravity)));
      if (f.booster > 50) arrow(ctx, cx, cy - 16, clamp(f.booster * unit) * fx2, clamp(f.booster * unit) * fy2, '#ff9800', 'BOOST ' + kN(f.booster));
      if (f.scrape > 300) arrow(ctx, cx, cy + 64, -dir * clamp(f.scrape * unit) * fx2, -dir * clamp(f.scrape * unit) * fy2, '#795548', 'scrape ' + kN(f.scrape));
    }
  };

  // Small picture of a car (for the record book). Fits the whole car into the canvas.
  B.drawCarThumb = function (canvas, design) {
    var ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, st = B.computeStats(design);
    ctx.clearRect(0, 0, W, H);
    var left = st.minX, right = st.maxX;
    st.wheels.forEach(function (w) { left = Math.min(left, w.x - w.r); right = Math.max(right, w.x + w.r); });
    var top = st.clearance + st.bodyTop + 0.2;
    var px = Math.min((W - 6) / Math.max(0.5, right - left), (H - 6) / top);
    ctx.save();
    ctx.translate((W - (right - left) * px) / 2 - left * px, H - 3);
    ctx.scale(px, -px);
    ctx.fillStyle = '#9aa0a6'; ctx.fillRect(left - 1, -0.05, right - left + 2, 0.05);
    ctx.translate(0, st.clearance);
    B.drawBody(ctx, design, px);
    st.wheels.forEach(function (w) { B.drawWheel(ctx, w.x, w.y, w.r, 0, design.tyre, px); });
    ctx.restore();
  };
})(window.BCL);
