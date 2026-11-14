// Garage: the brick-building screen with stats and tips.
(function (B) {
  var CP = 44, LEFT = 24, TOP = 24, BELOW = 175;

  function haloText(ctx, text, x, y, color) {
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.strokeText(text, x, y);
    ctx.fillStyle = color; ctx.fillText(text, x, y);
  }

  B.Builder = function (root, opts) {
    this.root = root;
    this.onChange = opts.onChange;
    this.design = opts.design;
    this.tool = B.PALETTE[1];
    this.color = B.COLORS[0];
    this.hover = null;
    this.tipsTrack = 'bad';
    this.canvas = root.querySelector('#builder-canvas');
    this.canvas.width = LEFT * 2 + CP * B.GRID_W;
    this.canvas.height = TOP + CP * B.GRID_H + BELOW;
    this.ctx = this.canvas.getContext('2d');
    this.buildPalette();
    this.buildOptions();
    this.bindCanvas();
    var self = this;
    root.querySelector('#tips-track').addEventListener('change', function (e) { self.tipsTrack = e.target.value; self.refresh(); });
    root.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () { self.setDesign(B.PRESETS[b.dataset.preset]()); });
    });
    root.querySelector('#btn-clear').addEventListener('click', function () {
      var d = B.newDesign();
      d.wheel = self.design.wheel; d.tyre = self.design.tyre; d.lift = self.design.lift; d.width = self.design.width;
      self.setDesign(d);
    });
    this.refresh();
  };

  var P = B.Builder.prototype;

  P.setDesign = function (d) { this.design = d; this.syncOptions(); this.refresh(); };

  P.buildPalette = function () {
    var self = this, box = this.root.querySelector('#palette');
    box.innerHTML = '';
    var tools = B.PALETTE.concat([{ id: 'eraser', type: 'eraser', len: 1 }]);
    tools.forEach(function (t) {
      var b = document.createElement('button');
      b.className = 'tool';
      b.dataset.id = t.id;
      var c = document.createElement('canvas');
      c.width = 4 * 18 + 8; c.height = 30;
      var cx = c.getContext('2d');
      if (t.type === 'eraser') { cx.font = '22px system-ui'; cx.fillText('🧽', 26, 24); }
      else {
        var piece = { type: t.type, engine: t.engine, len: t.len, col: 0, row: 0, color: self.color };
        cx.save(); cx.translate(4, 26); cx.scale(18 / B.STUD, -18 / B.STUD);
        B.drawBody(cx, { pieces: [piece] }, 18 / B.STUD); cx.restore();
      }
      b.appendChild(c);
      var label = document.createElement('span');
      label.textContent = t.type === 'eraser' ? 'Eraser' : B.pieceName(t);
      b.appendChild(label);
      b.title = t.type === 'eraser' ? 'Click a brick to remove it (or right-click)' :
        (t.type === 'engine' ? B.ENGINES[t.engine].name + ': ' + B.ENGINES[t.engine].power / 1000 + ' kW, ' + B.ENGINES[t.engine].massPerCell * 2 + ' kg. ' : B.MATERIALS[t.type].massPerCell * t.len + ' kg. ') + (B.MATERIALS[t.type] ? B.MATERIALS[t.type].hint : '');
      b.addEventListener('click', function () { self.tool = t; self.markTool(); self.refreshHint(); });
      box.appendChild(b);
    });
    var colors = this.root.querySelector('#colors');
    colors.innerHTML = '';
    B.COLORS.forEach(function (col) {
      var s = document.createElement('button');
      s.className = 'swatch'; s.style.background = col; s.dataset.color = col; s.title = 'Brick colour';
      s.addEventListener('click', function () { self.color = col; self.buildPalette(); self.markTool(); });
      colors.appendChild(s);
    });
    this.markTool();
  };

  P.markTool = function () {
    var self = this;
    this.root.querySelectorAll('.tool').forEach(function (b) { b.classList.toggle('active', b.dataset.id === self.tool.id); });
    this.root.querySelectorAll('.swatch').forEach(function (b) { b.classList.toggle('active', b.dataset.color === self.color); });
  };

  P.refreshHint = function () {
    var t = this.tool, el = this.root.querySelector('#tool-hint');
    if (t.type === 'eraser') el.textContent = 'Eraser: click a brick to remove it.';
    else if (t.type === 'engine') el.textContent = B.ENGINES[t.engine].name + ' – ' + B.ENGINES[t.engine].power / 1000 + ' kW of power, weighs ' + B.ENGINES[t.engine].massPerCell * 2 + ' kg. ' + B.MATERIALS.engine.hint;
    else el.textContent = B.pieceName(t) + ' – ' + B.MATERIALS[t.type].massPerCell * t.len + ' kg. ' + B.MATERIALS[t.type].hint;
  };

  var OPTIONS = [
    { key: 'wheel', box: '#opt-wheel', list: function () { return B.WHEELS; }, label: function (w) { return w.name + ' (' + Math.round(w.r * 200) + ' cm)'; } },
    { key: 'tyre', box: '#opt-tyre', list: function () { return B.TYRES; }, label: function (t) { return t.name; } },
    { key: 'lift', box: '#opt-lift', list: function () { return B.LIFTS; }, label: function (l) { return l.name; } },
    { key: 'width', box: '#opt-width', list: function () { return B.WIDTHS; }, label: function (w) { return w.name + ' (' + w.w + ' m)'; } }
  ];

  P.buildOptions = function () {
    var self = this;
    OPTIONS.forEach(function (o) {
      var box = self.root.querySelector(o.box);
      box.innerHTML = '';
      var list = o.list();
      Object.keys(list).forEach(function (id) {
        var b = document.createElement('button');
        b.className = 'opt'; b.dataset.key = o.key; b.dataset.id = id;
        b.textContent = o.label(list[id]);
        b.addEventListener('click', function () { self.design[o.key] = id; self.syncOptions(); self.refresh(); });
        box.appendChild(b);
      });
    });
    this.syncOptions();
  };

  P.syncOptions = function () {
    var d = this.design;
    this.root.querySelectorAll('.opt').forEach(function (b) { b.classList.toggle('active', d[b.dataset.key] === b.dataset.id); });
  };

  P.cellFromEvent = function (e) {
    var r = this.canvas.getBoundingClientRect();
    var mx = (e.clientX - r.left) * this.canvas.width / r.width, my = (e.clientY - r.top) * this.canvas.height / r.height;
    var col = Math.floor((mx - LEFT) / CP), row = B.GRID_H - 1 - Math.floor((my - TOP) / CP);
    if (col < 0 || col >= B.GRID_W || row < 0 || row >= B.GRID_H) return null;
    return { col: col, row: row };
  };

  P.bindCanvas = function () {
    var self = this, down = false, erase = false;
    var c = this.canvas;
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    c.addEventListener('pointerdown', function (e) {
      down = true; erase = e.button === 2 || self.tool.type === 'eraser';
      c.setPointerCapture(e.pointerId);
      self.act(self.cellFromEvent(e), erase);
    });
    c.addEventListener('pointermove', function (e) {
      self.hover = self.cellFromEvent(e);
      if (down) self.act(self.hover, erase);
      self.draw();
    });
    c.addEventListener('pointerup', function () { down = false; });
    c.addEventListener('pointerleave', function () { self.hover = null; self.draw(); });
  };

  P.act = function (cell, erase) {
    if (!cell) return;
    var changed;
    if (erase) changed = B.removeAt(this.design, cell.col, cell.row);
    else {
      var t = this.tool;
      changed = B.placePiece(this.design, { type: t.type, engine: t.engine, len: t.len, col: cell.col, row: cell.row, color: this.color });
    }
    if (changed) this.refresh();
  };

  P.refresh = function () {
    this.stats = B.computeStats(this.design);
    this.problems = B.validate(this.design);
    this.draw();
    this.renderStats();
    this.renderTips();
    this.refreshHint();
    if (this.onChange) this.onChange(this.design, this.stats, this.problems);
  };

  P.draw = function () {
    var ctx = this.ctx, W = this.canvas.width, H = this.canvas.height, s = this.stats, d = this.design;
    var px = CP / B.STUD, baseY = TOP + CP * B.GRID_H;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#eef6fb'; ctx.fillRect(0, 0, W, H);
    // baseplate grid
    for (var c = 0; c < B.GRID_W; c++) for (var r = 0; r < B.GRID_H; r++) {
      var x = LEFT + c * CP, y = TOP + r * CP;
      ctx.fillStyle = r === B.GRID_H - 1 ? '#dcebd8' : '#e3edf3';
      ctx.fillRect(x + 1, y + 1, CP - 2, CP - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.05)';
      ctx.beginPath(); ctx.arc(x + CP / 2, y + CP / 2, CP * 0.18, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#5b7f4a'; ctx.font = '12px system-ui';
    ctx.fillText('Green bottom row = chassis. The wheels attach at its two ends.', LEFT, TOP - 8);

    // ground
    var groundY = baseY + s.clearance * px;
    ctx.fillStyle = '#8d9097'; ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = '#6d6f73'; ctx.fillRect(0, groundY, W, 5);

    ctx.save();
    ctx.translate(LEFT, baseY); ctx.scale(px, -px);
    var wy = s.wheelY;
    ctx.strokeStyle = '#555'; ctx.lineWidth = 0.07;
    [s.rearX, s.frontX].forEach(function (wx) { ctx.beginPath(); ctx.moveTo(wx, 0); ctx.lineTo(wx, wy); ctx.stroke(); });
    B.drawBody(ctx, d, px);
    [s.rearX, s.frontX].forEach(function (wx) { B.drawWheel(ctx, wx, wy, s.wheelR, 0, d.tyre, px); });
    if (d.pieces.length) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 0.03;
      ctx.beginPath(); ctx.arc(s.comX, s.comY, 0.11, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(s.comX, s.comY); ctx.arc(s.comX, s.comY, 0.11, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(s.comX, s.comY); ctx.arc(s.comX, s.comY, 0.11, Math.PI, Math.PI * 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();

    // measurement labels
    ctx.font = 'bold 12px system-ui';
    var mx = LEFT + (s.rearX + s.frontX) / 2 * px;
    if (d.pieces.length) {
      ctx.strokeStyle = '#0055bf'; ctx.fillStyle = '#0055bf'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(mx, baseY); ctx.lineTo(mx, groundY); ctx.stroke();
      haloText(ctx, 'clearance ' + Math.round(s.clearance * 100) + ' cm', mx + 6, (baseY + groundY) / 2 + 4, '#0055bf');
      var cmx = LEFT + s.comX * px, cmy = baseY - s.comY * px;
      ctx.fillStyle = '#111';
      haloText(ctx, 'centre of mass (' + s.hCoM.toFixed(2) + ' m high)', cmx + 12, cmy - 8, '#111');
    }

    // hover ghost
    if (this.hover && this.tool.type !== 'eraser') {
      var t = this.tool, ok = B.canPlace(d, { col: this.hover.col, row: this.hover.row, len: t.len });
      ctx.fillStyle = ok ? 'rgba(30,158,58,0.35)' : 'rgba(217,48,37,0.35)';
      ctx.fillRect(LEFT + this.hover.col * CP, TOP + (B.GRID_H - 1 - this.hover.row) * CP, t.len * CP, CP);
    } else if (this.hover) {
      ctx.strokeStyle = '#d93025'; ctx.lineWidth = 3;
      ctx.strokeRect(LEFT + this.hover.col * CP + 2, TOP + (B.GRID_H - 1 - this.hover.row) * CP + 2, CP - 4, CP - 4);
    }
  };

  P.renderStats = function () {
    var s = this.stats, el = this.root.querySelector('#stats');
    function row(label, value, frac, tip, color) {
      return '<div class="stat" title="' + tip + '"><span class="l">' + label + '</span><span class="v">' + value + '</span>' +
        '<span class="bar"><i style="width:' + Math.round(Math.max(0, Math.min(1, frac)) * 100) + '%;background:' + (color || '#0055bf') + '"></i></span></div>';
    }
    var html = '';
    html += row('⚖️ Weight', Math.round(s.mass) + ' kg', s.mass / 2500, 'Heavier cars are harder to speed up AND to stop.', '#6b7178');
    html += row('🔥 Power', Math.round(s.power / 1000) + ' kW', s.power / 320000, 'How much work the engine can do every second.', '#e8710a');
    html += row('💪 Power per kg', Math.round(s.powerPerKg) + ' W/kg', s.powerPerKg / 300, 'The most important number for speeding up: a = F ÷ m.', '#d93025');
    html += row('🏁 Top speed', Math.round(s.topSpeed * 3.6) + ' km/h', s.topSpeed * 3.6 / 300, 'Where engine push = air drag + rolling. Tall/wide cars hit more air.', '#1e9e3a');
    html += row('⏱️ 0–100 km/h', s.zeroTo100 ? s.zeroTo100.toFixed(1) + ' s' : 'never', s.zeroTo100 ? 1 - s.zeroTo100 / 20 : 0, 'Time to speed up from 0 to 100 km/h on flat road.', '#1e9e3a');
    html += row('🛑 Braking', s.brakeDecel.toFixed(1) + ' m/s²', s.brakeDecel / 10, 'How much speed the brakes remove each second. Heavy cars brake worse.', '#f29900');
    html += row('📏 Clearance', Math.round(s.clearance * 100) + ' cm', s.clearance / 1.1, 'Space under the car. More = goes over rocks, but taller and tippier.', '#0055bf');
    html += row('🎯 Centre of mass', s.hCoM.toFixed(2) + ' m high', 1 - s.hCoM / 2.5, 'Where the weight is “on average”. Lower is more stable.', '#8e24aa');
    html += row('🤸 Tip-over limit', s.tipLimitG.toFixed(2) + ' g', s.tipLimitG / 1.5, 'How hard you can turn before tipping: (half width) ÷ (centre of mass height).', '#8e24aa');
    html += row('🛞 Grip (road)', s.gripRoad.toFixed(2), s.gripRoad, 'Tyre friction. Limits push, braking and turning.', '#1b2a34');
    el.innerHTML = html;
    var pr = this.root.querySelector('#problems');
    pr.innerHTML = this.problems.length ? this.problems.map(function (p) { return '<li>' + p + '</li>'; }).join('') : '<li class="ok">✅ Your car is ready to drive!</li>';
  };

  P.renderTips = function () {
    var t = B.evaluateTips(this.tipsTrack, this.stats);
    var el = this.root.querySelector('#tips');
    el.innerHTML = '<ul class="checks">' + t.checks.map(function (c) { return '<li class="' + (c.ok ? 'ok' : 'warn') + '">' + (c.ok ? '✅ ' : '⚠️ ') + c.text + '</li>'; }).join('') + '</ul>' +
      '<div class="caveats"><b>Pay attention to:</b><ul>' + t.caveats.map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul></div>';
  };
})(window.BCL);
