// Car design model: placing bricks and wheels, validation and the car's physical stats.
(function (B) {
  B.newDesign = function () {
    return { name: 'My car', pieces: [], wheels: [], tyre: 'slick', lift: 'normal', width: 'normal' };
  };

  // Bring saved cars from older versions (one wheel size for the whole car) up to date.
  B.migrate = function (d) {
    if (!d || !Array.isArray(d.pieces)) return null;
    if (!Array.isArray(d.wheels)) {
      var size = B.WHEELS[d.wheel] ? d.wheel : 'medium';
      var cols = d.pieces.filter(function (p) { return p.row === 0; }).reduce(function (a, p) { return a.concat([p.col, p.col + p.len - 1]); }, []);
      d.wheels = cols.length ? [{ col: Math.min.apply(null, cols), size: size }, { col: Math.max.apply(null, cols), size: size }] : [];
    }
    delete d.wheel;
    d.name = d.name || 'My car';
    d.pieces = d.pieces.filter(function (p) { return B.MATERIALS[p.type] && (p.type !== 'engine' || B.ENGINES[p.engine]); });
    d.wheels = d.wheels.filter(function (w) { return B.WHEELS[w.size]; });
    if (!B.TYRES[d.tyre]) d.tyre = 'slick';
    if (!B.LIFTS[d.lift]) d.lift = 'normal';
    if (!B.WIDTHS[d.width]) d.width = 'normal';
    return d;
  };

  B.cellsOf = function (design) {
    var cells = [];
    design.pieces.forEach(function (p) {
      for (var i = 0; i < p.len; i++) cells.push({ col: p.col + i, row: p.row, piece: p });
    });
    return cells;
  };

  B.pieceAt = function (design, col, row) {
    for (var i = 0; i < design.pieces.length; i++) {
      var p = design.pieces[i];
      if (p.row === row && col >= p.col && col < p.col + p.len) return p;
    }
    return null;
  };

  B.canPlace = function (design, piece) {
    if (piece.col < 0 || piece.row < 0 || piece.row >= B.GRID_H || piece.col + piece.len > B.GRID_W) return false;
    for (var i = 0; i < piece.len; i++) if (B.pieceAt(design, piece.col + i, piece.row)) return false;
    return true;
  };

  B.placePiece = function (design, piece) {
    if (!B.canPlace(design, piece)) return false;
    design.pieces.push(piece);
    return true;
  };

  B.removeAt = function (design, col, row) {
    var p = B.pieceAt(design, col, row);
    if (!p) return false;
    design.pieces.splice(design.pieces.indexOf(p), 1);
    return true;
  };

  B.wheelX = function (col) { return (col + 0.5) * B.STUD; };

  // Why a wheel cannot go at this column ('' when it can).
  B.wheelProblem = function (design, col, size) {
    if (col < 0 || col >= B.GRID_W) return 'outside';
    if (!B.pieceAt(design, col, 0)) return 'Wheels clip under the bottom row – put a brick there first.';
    var r = B.WHEELS[size].r;
    for (var i = 0; i < design.wheels.length; i++) {
      var w = design.wheels[i];
      if (w.col === col) continue;
      if (Math.abs(B.wheelX(w.col) - B.wheelX(col)) < (r + B.WHEELS[w.size].r) * 0.95) return 'Too close to another wheel – they would rub!';
    }
    return '';
  };

  B.placeWheel = function (design, col, size) {
    if (B.wheelProblem(design, col, size)) return false;
    var same = design.wheels.filter(function (w) { return w.col === col; })[0];
    if (same) { if (same.size === size) return false; same.size = size; return true; }
    design.wheels.push({ col: col, size: size });
    return true;
  };

  // Removes the wheel covering this column, if any.
  B.removeWheelAt = function (design, col) {
    var x = B.wheelX(col), best = null, bestD = Infinity;
    design.wheels.forEach(function (w) {
      var d = Math.abs(B.wheelX(w.col) - x);
      if (d <= B.WHEELS[w.size].r + 0.16 && d < bestD) { best = w; bestD = d; }
    });
    if (!best) return false;
    design.wheels.splice(design.wheels.indexOf(best), 1);
    return true;
  };

  // Kid-friendly list of what still needs fixing before the car can drive.
  B.validate = function (design) {
    var problems = [];
    var cells = B.cellsOf(design);
    var engines = design.pieces.filter(function (p) { return p.type === 'engine'; }).length;
    var chassis = cells.filter(function (c) { return c.row === 0; });
    if (chassis.length === 0) problems.push('Put some bricks in the bottom row – that is the floor (chassis) the wheels hold.');
    if (engines === 0) problems.push('Add an engine – without it nothing pushes the car!');
    if (design.wheels.length < 2) problems.push('Add at least 2 wheels: pick a wheel size, then tap under the bottom row.');
    if (design.wheels.some(function (w) { return !B.pieceAt(design, w.col, 0); })) problems.push('A wheel has no brick above it – add a brick in the bottom row there.');
    if (chassis.length && !B.isConnected(cells)) problems.push('Some bricks are floating! Every brick must touch another brick.');
    return problems;
  };

  B.isConnected = function (cells) {
    var key = function (c, r) { return c + ',' + r; };
    var set = {};
    cells.forEach(function (c) { set[key(c.col, c.row)] = true; });
    var seen = {};
    var queue = cells.filter(function (c) { return c.row === 0; }).slice(0, 1).map(function (c) { return [c.col, c.row]; });
    queue.forEach(function (q) { seen[key(q[0], q[1])] = true; });
    while (queue.length) {
      var q = queue.pop();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var k = key(q[0] + d[0], q[1] + d[1]);
        if (set[k] && !seen[k]) { seen[k] = true; queue.push([q[0] + d[0], q[1] + d[1]]); }
      });
    }
    return Object.keys(seen).length === Object.keys(set).length;
  };

  // Highest speed where engine power equals the power lost to air drag and rolling.
  B.solveTopSpeed = function (power, mass, cdA) {
    if (power <= 0) return 0;
    var lo = 0, hi = 200;
    for (var i = 0; i < 60; i++) {
      var v = (lo + hi) / 2;
      var need = (B.ROLLING * mass * B.G + 0.5 * B.AIR_DENSITY * cdA * v * v) * v;
      if (need > power) hi = v; else lo = v;
    }
    return lo;
  };

  // Seconds to reach targetSpeed on flat road, or null if it never gets there.
  B.timeToSpeed = function (s, targetSpeed) {
    var v = 0, t = 0, dt = 0.01;
    while (t < 60) {
      var push = Math.min(s.power / Math.max(v, 8), s.gripRoad * s.mass * B.G);
      var drag = 0.5 * B.AIR_DENSITY * s.cdA * v * v + B.ROLLING * s.mass * B.G;
      v += (push - drag) / s.mass * dt;
      t += dt;
      if (v >= targetSpeed) return t;
    }
    return null;
  };

  B.computeStats = function (design) {
    var S = B.STUD;
    var tyre = B.TYRES[design.tyre];
    var lift = B.LIFTS[design.lift];
    var width = B.WIDTHS[design.width];
    var cells = B.cellsOf(design);
    var occupied = {};
    cells.forEach(function (c) { occupied[c.col + ',' + c.row] = true; });

    var mass = 0, mx = 0, my = 0, spoilerCells = 0, power = 0, engines = 0, nose = 0, tail = 0;
    var minCol = Infinity, maxCol = -Infinity, topRow = 0;
    cells.forEach(function (c) {
      var m = B.cellMass(c.piece);
      mass += m; mx += m * (c.col + 0.5) * S; my += m * (c.row + 0.5) * S;
      if (c.piece.type === 'spoiler') spoilerCells++;
      minCol = Math.min(minCol, c.col); maxCol = Math.max(maxCol, c.col);
      topRow = Math.max(topRow, c.row);
    });
    design.pieces.forEach(function (p) {
      if (p.type === 'engine') { power += B.ENGINES[p.engine].power; engines++; }
      // A wedge sloping down towards the front with open air ahead is a pointy nose; one at the back is a tail.
      if (p.shape === 'wedge' && p.rot === 1 && !occupied[(p.col + p.len) + ',' + p.row]) nose++;
      if (p.shape === 'wedge' && p.rot === 0 && !occupied[(p.col - 1) + ',' + p.row]) tail++;
    });

    var sizes = design.wheels.map(function (w) { return B.WHEELS[w.size]; });
    var rMax = sizes.length ? Math.max.apply(null, sizes.map(function (w) { return w.r; })) : 0.35;
    var rMin = sizes.length ? Math.min.apply(null, sizes.map(function (w) { return w.r; })) : 0.35;
    // Every axle is mounted so the body sits level, whatever size each wheel is.
    var clearance = rMax * 0.5 + lift.h;
    var wheels = design.wheels.map(function (w) {
      var spec = B.WHEELS[w.size];
      return { col: w.col, size: w.size, x: B.wheelX(w.col), r: spec.r, mass: 2 * spec.mass, y: spec.r - clearance };
    }).sort(function (a, b) { return a.x - b.x; });
    wheels.forEach(function (w) { mass += w.mass; mx += w.mass * w.x; my += w.mass * w.y; });
    var rearX = wheels.length ? wheels[0].x : (isFinite(minCol) ? (minCol + 0.5) * S : 0);
    var frontX = wheels.length ? wheels[wheels.length - 1].x : (isFinite(maxCol) ? (maxCol + 0.5) * S : 1);
    mass += width.extraMass; mx += width.extraMass * (rearX + frontX) / 2;
    var comX = mass ? mx / mass : 0, comY = mass ? my / mass : 0;

    var bodyTop = (topRow + 1) * S;
    var height = clearance + bodyTop;
    var frontalArea = (bodyTop + rMax) * width.w * 0.85;
    var cd = Math.max(0.2, 0.36 + 0.04 * spoilerCells - 0.05 * Math.min(nose, 3) - 0.02 * Math.min(tail, 2));
    var cdA = cd * frontalArea;
    var hCoM = clearance + comY;
    var gripRoad = tyre.grip.road;

    var s = {
      mass: mass,
      power: power,
      engines: engines,
      powerPerKg: mass ? power / mass : 0,
      comX: comX, comY: comY, hCoM: hCoM,
      clearance: clearance,
      height: height,
      length: isFinite(minCol) ? (maxCol - minCol + 1) * S : 0,
      minX: isFinite(minCol) ? minCol * S : 0,
      maxX: isFinite(maxCol) ? (maxCol + 1) * S : 0,
      bodyTop: bodyTop,
      wheels: wheels,
      wheelCount: wheels.length * 2,
      wheelbase: frontX - rearX,
      rearX: rearX, frontX: frontX,
      wheelR: rMax, wheelRMin: rMin,
      travel: lift.travel,
      width: width.w,
      frontalArea: frontalArea,
      cd: cd, cdA: cdA,
      nose: nose,
      downforceA: 0.35 * spoilerCells,
      spoilerCells: spoilerCells,
      grip: tyre.grip,
      gripRoad: gripRoad,
      brakeDecel: mass ? Math.min(gripRoad * B.G, B.BRAKE_FORCE / mass) : 0,
      tipLimitG: hCoM > 0 ? (width.w / 2) / hCoM : 99,
      cells: cells
    };
    s.topSpeed = B.solveTopSpeed(power, mass, cdA);
    s.zeroTo100 = power ? B.timeToSpeed(s, 100 / 3.6) : null;
    // Front/back balance: 0 = all weight on the back wheel, 1 = all on the front.
    s.frontWeight = s.wheelbase > 0 ? Math.min(1, Math.max(0, (comX - rearX) / s.wheelbase)) : 0.5;
    return s;
  };

  function brick(d, type, col, row, len, color, extra) {
    var p = { type: type, col: col, row: row, len: len, color: color };
    for (var k in extra) p[k] = extra[k];
    d.pieces.push(p);
  }

  B.PRESETS = {
    sport: function () {
      var d = { name: 'Red Rocket', pieces: [], wheels: [{ col: 1, size: 'small' }, { col: 10, size: 'small' }], tyre: 'slick', lift: 'low', width: 'wide' };
      var red = '#d01012';
      brick(d, 'plastic', 0, 0, 4, red); brick(d, 'plastic', 4, 0, 4, red); brick(d, 'plastic', 8, 0, 4, red);
      brick(d, 'engine', 9, 1, 2, null, { engine: 'turbo' });
      brick(d, 'plastic', 11, 1, 1, red, { shape: 'wedge', rot: 1 });
      brick(d, 'plastic', 1, 1, 4, red);
      brick(d, 'window', 5, 1, 2);
      brick(d, 'plastic', 7, 1, 2, red);
      brick(d, 'spoiler', 0, 2, 2);
      return d;
    },
    monster: function () {
      var d = { name: 'Big Green', pieces: [], wheels: [{ col: 1, size: 'monster' }, { col: 10, size: 'monster' }], tyre: 'offroad', lift: 'super', width: 'wide' };
      var g = '#237841';
      brick(d, 'heavy', 1, 0, 2); brick(d, 'plastic', 3, 0, 4, g);
      brick(d, 'engine', 7, 0, 2, null, { engine: 'turbo' });
      brick(d, 'heavy', 9, 0, 2);
      brick(d, 'plastic', 3, 1, 4, g);
      brick(d, 'window', 5, 2, 2);
      brick(d, 'light', 3, 2, 2, '#f2cd37');
      brick(d, 'light', 7, 1, 4, '#f2cd37');
      return d;
    },
    hotrod: function () {
      var d = { name: 'Hot Rod', pieces: [], wheels: [{ col: 1, size: 'big' }, { col: 11, size: 'small' }], tyre: 'slick', lift: 'normal', width: 'normal' };
      var o = '#fe8a18';
      brick(d, 'plastic', 0, 0, 4, o); brick(d, 'plastic', 4, 0, 4, o); brick(d, 'plastic', 8, 0, 4, o);
      brick(d, 'plastic', 12, 0, 1, o, { shape: 'wedge', rot: 1 });
      brick(d, 'engine', 8, 1, 2, null, { engine: 'turbo' });
      brick(d, 'engine', 10, 1, 2, null, { engine: 'normal' });
      brick(d, 'plastic', 0, 1, 1, o, { shape: 'wedge', rot: 0 });
      brick(d, 'plastic', 1, 1, 3, o);
      brick(d, 'driver', 5, 1, 1);
      brick(d, 'window', 6, 1, 1);
      brick(d, 'plastic', 7, 1, 1, o, { shape: 'wedge', rot: 1 });
      brick(d, 'plastic', 4, 1, 1, o);
      return d;
    },
    truck: function () {
      var d = { name: 'Six Wheeler', pieces: [], wheels: [{ col: 1, size: 'medium' }, { col: 4, size: 'medium' }, { col: 12, size: 'medium' }], tyre: 'offroad', lift: 'high', width: 'wide' };
      var b = '#0055bf', y = '#f2cd37';
      brick(d, 'plastic', 0, 0, 4, b); brick(d, 'plastic', 4, 0, 4, b); brick(d, 'plastic', 8, 0, 4, b); brick(d, 'plastic', 12, 0, 2, b);
      brick(d, 'light', 0, 1, 4, y); brick(d, 'light', 4, 1, 4, y);
      brick(d, 'light', 0, 2, 4, y); brick(d, 'light', 4, 2, 4, y);
      brick(d, 'engine', 8, 1, 2, null, { engine: 'normal' });
      brick(d, 'engine', 10, 1, 2, null, { engine: 'normal' });
      brick(d, 'plastic', 12, 1, 2, b);
      brick(d, 'window', 12, 2, 1); brick(d, 'driver', 11, 2, 1);
      brick(d, 'plastic', 13, 2, 1, b, { shape: 'wedge', rot: 1 });
      return d;
    },
    tower: function () {
      var d = { name: 'Wobbly Tower', pieces: [], wheels: [{ col: 2, size: 'medium' }, { col: 7, size: 'medium' }], tyre: 'slick', lift: 'high', width: 'narrow' };
      var b = '#0055bf';
      brick(d, 'plastic', 2, 0, 4, b);
      brick(d, 'plastic', 6, 0, 2, b);
      brick(d, 'engine', 4, 1, 2, null, { engine: 'tiny' });
      for (var r = 2; r < 7; r++) brick(d, 'plastic', 4, r, 2, r % 2 ? '#f2cd37' : b);
      brick(d, 'light', 3, 7, 4, '#d01012');
      return d;
    }
  };
})(window.BCL);
