// Drawing: LEGO-style car, side-view world with force arrows, and the Death 8 map.
(function (B) {
  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }
  B.shade = shade;

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
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, S);
      ctx.fillStyle = shade(color.charAt(0) === '#' ? color : '#888888', 30);
      ctx.fillRect(x, y + S * 0.8, w, S * 0.2);
      ctx.strokeStyle = shade(color.charAt(0) === '#' ? color : '#888888', -80);
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
      // studs on top where nothing sits above
      for (var k = 0; k < p.len; k++) {
        if (occupied[(p.col + k) + ',' + (p.row + 1)]) continue;
        ctx.fillStyle = p.type === 'window' ? '#b9e4f8' : shade(color.charAt(0) === '#' ? color : '#888888', 10);
        ctx.fillRect(x + k * S + S * 0.25, y + S, S * 0.5, S * 0.14);
        ctx.strokeStyle = shade(color.charAt(0) === '#' ? color : '#888888', -80);
        ctx.strokeRect(x + k * S + S * 0.25, y + S, S * 0.5, S * 0.14);
      }
    });
  };

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

    var sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#7ec8f2'); sky.addColorStop(1, '#d9f1ff');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    // parallax hills
    ctx.fillStyle = '#b5e0b0';
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var hx = 0; hx <= W; hx += 20) ctx.lineTo(hx, H * 0.55 - 40 * Math.sin((hx + cam.x * px * 0.2) / 140) - 20);
    ctx.lineTo(W, H); ctx.fill();

    var x0 = cam.x - W / 2 / px - 1, x1 = cam.x + W / 2 / px + 1;
    var groundColor = { road: '#6d6f73', rough: '#8d6e4f', dirt: '#a0703f' }[track.surface] || '#777';
    ctx.fillStyle = groundColor;
    ctx.beginPath(); ctx.moveTo(sx(x0), H);
    var step = Math.max(0.05, 2 / px);
    for (var x = x0; x <= x1; x += step) ctx.lineTo(sx(x), sy(sim.ground(x)));
    ctx.lineTo(sx(x1), H); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = track.surface === 'road' ? '#3c3d40' : '#5b8a3a';
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
    if (track.id === 'stop') {
      ctx.fillStyle = '#f2cd37'; ctx.fillRect(sx(track.lineX) - 3, sy(0) - 2, 6, 10);
      pole(track.lineX, '#f2cd37', '40+!', 80);
      ctx.fillStyle = 'rgba(40,180,70,0.35)';
      ctx.fillRect(sx(track.zoneA), sy(0) - 120, (track.zoneB - track.zoneA) * px, 120);
      ctx.strokeStyle = '#1e7b34'; ctx.lineWidth = 3;
      ctx.strokeRect(sx(track.zoneA), sy(0) - 120, (track.zoneB - track.zoneA) * px, 120);
      ctx.fillStyle = '#a33'; ctx.fillRect(sx(track.wallX), sy(0) - 3 * px, 1.2 * px, 3 * px);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.fillText('WALL', sx(track.wallX) + 4, sy(0) - 1.5 * px);
      if (opts.brakeX != null) {
        var bx = sx(opts.brakeX), by = sy(0);
        ctx.strokeStyle = '#8e24aa'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx, by - 150); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#8e24aa'; ctx.fillRect(bx, by - 150, 92, 20);
        ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui'; ctx.fillText('stop here?', bx + 6, by - 136);
      }
    }

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
      B.drawWheel(ctx, w.ax + s.comX, w.ay + s.comY - w.len, s.wheelR, w.spin, design.tyre, px);
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
      if (f.scrape > 300) arrow(ctx, cx, cy + 64, -dir * clamp(f.scrape * unit) * fx2, -dir * clamp(f.scrape * unit) * fy2, '#795548', 'scrape ' + kN(f.scrape));
    }
  };

  B.renderEight = function (ctx, W, H, sim, design, opts) {
    var path = B.EIGHT_PATH;
    ctx.fillStyle = '#5fa85a'; ctx.fillRect(0, 0, W, H);
    var scale = Math.min(W / 135, H / 52);
    var ox = W / 2, oy = H / 2;
    var tx = function (x) { return ox + x * scale; }, ty = function (y) { return oy - y * scale; };
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 9.5 * scale;
    ctx.beginPath();
    path.pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(tx(p.x), ty(p.y)); else ctx.lineTo(tx(p.x), ty(p.y)); });
    ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = '#555'; ctx.lineWidth = 8 * scale; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 2; ctx.setLineDash([12, 12]); ctx.stroke(); ctx.setLineDash([]);
    // danger crossing (flashes when both cars are heading there at the same time)
    var danger = sim.crossingDanger();
    ctx.fillStyle = danger && Math.floor(Date.now() / 200) % 2 ? 'rgba(217,48,37,0.85)' : 'rgba(217,48,37,0.35)';
    ctx.beginPath(); ctx.arc(tx(0), ty(0), 6 * scale, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui';
    ctx.fillText(danger ? '⚠ WATCH OUT!' : '⚠ crossing', tx(0) + 8 * scale, ty(0) - 6 * scale);
    // start line
    ctx.fillStyle = '#fff'; ctx.fillRect(tx(path.pts[0].x) - 4 * scale, ty(0) - 1, 8 * scale, 3);

    function car(pos, color, spin, tipped) {
      var p = B.eightAt(pos);
      ctx.save();
      ctx.translate(tx(p.x), ty(p.y));
      ctx.rotate(-p.heading + spin);
      var len = Math.max(design ? sim.s.length : 4, 3) * scale, wid = (sim.s.width) * scale;
      if (color !== 'ghost') {
        ctx.fillStyle = '#111';
        [[-0.35, -0.5], [0.35, -0.5], [-0.35, 0.5], [0.35, 0.5]].forEach(function (k) { ctx.fillRect(k[0] * len - 0.3 * scale, k[1] * wid - 0.25 * scale, 0.6 * scale, 0.5 * scale); });
        ctx.fillStyle = tipped ? '#555' : (B.mainColor(design) || '#d01012');
        ctx.fillRect(-len / 2, -wid / 2, len, wid);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(len * 0.1, -wid / 2 + 2, len * 0.15, wid - 4);
      } else {
        ctx.fillStyle = '#ffeb3b'; ctx.fillRect(-2.2 * scale, -0.9 * scale, 4.4 * scale, 1.8 * scale);
        ctx.fillStyle = '#333'; ctx.fillRect(0.6 * scale, -0.8 * scale, 0.8 * scale, 1.6 * scale);
      }
      ctx.restore();
    }
    car(sim.ghostPos, 'ghost', 0);
    car(sim.pos, 'me', sim.spinTime > 0 ? sim.spinTime * 9 : 0, sim.tipped);

    if (opts.arrows) {
      var p = B.eightAt(sim.pos);
      var nx = -Math.sin(p.heading), ny = Math.cos(p.heading);
      // point the sideways arrow towards the inside of the turn
      var ahead = B.eightAt(sim.pos + 3);
      var turn = Math.sign(Math.sin(ahead.heading - p.heading)) || 1;
      var len = Math.min(140, sim.aLat / B.G * 70);
      arrow(ctx, tx(p.x), ty(p.y), nx * turn * len, -ny * turn * len, '#8e24aa', len > 10 ? 'turn pull ' + (sim.aLat / B.G).toFixed(2) + ' g' : '');
    }
  };

  B.mainColor = function (design) {
    var counts = {};
    design.pieces.forEach(function (p) { if (p.color) counts[p.color] = (counts[p.color] || 0) + p.len; });
    var best = null;
    Object.keys(counts).forEach(function (c) { if (!best || counts[c] > counts[best]) best = c; });
    return best;
  };
})(window.BCL);
