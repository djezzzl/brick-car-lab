// Car design model: placing pieces, validation and the car's physical stats.
(function (B) {
  B.newDesign = function () {
    return { pieces: [], wheel: 'medium', tyre: 'slick', lift: 'normal', width: 'normal' };
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

  // Kid-friendly list of what still needs fixing before the car can drive.
  B.validate = function (design) {
    var problems = [];
    var cells = B.cellsOf(design);
    var engines = design.pieces.filter(function (p) { return p.type === 'engine'; }).length;
    var chassis = cells.filter(function (c) { return c.row === 0; });
    if (chassis.length === 0) problems.push('Put some bricks in the bottom row – that is the floor (chassis) the wheels hold.');
    else {
      var cols = chassis.map(function (c) { return c.col; });
      if (Math.max.apply(null, cols) - Math.min.apply(null, cols) < 3) problems.push('Make the bottom row at least 4 studs long so the wheels have room.');
    }
    if (engines === 0) problems.push('Add an engine – without it nothing pushes the car!');
    if (engines > 1) problems.push('Only ONE engine please – remove the extra ones.');
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
    var wheel = B.WHEELS[design.wheel];
    var tyre = B.TYRES[design.tyre];
    var lift = B.LIFTS[design.lift];
    var width = B.WIDTHS[design.width];
    var cells = B.cellsOf(design);
    var clearance = wheel.r * 0.5 + lift.h;

    var mass = 0, mx = 0, my = 0, spoilerCells = 0, power = 0;
    var minCol = Infinity, maxCol = -Infinity, topRow = 0, chMin = Infinity, chMax = -Infinity;
    cells.forEach(function (c) {
      var m = B.cellMass(c.piece);
      mass += m; mx += m * (c.col + 0.5) * S; my += m * (c.row + 0.5) * S;
      if (c.piece.type === 'spoiler') spoilerCells++;
      minCol = Math.min(minCol, c.col); maxCol = Math.max(maxCol, c.col);
      topRow = Math.max(topRow, c.row);
      if (c.row === 0) { chMin = Math.min(chMin, c.col); chMax = Math.max(chMax, c.col); }
    });
    design.pieces.forEach(function (p) { if (p.type === 'engine') power = B.ENGINES[p.engine].power; });
    if (!isFinite(chMin)) { chMin = isFinite(minCol) ? minCol : 0; chMax = isFinite(maxCol) ? maxCol : 3; }

    var rearX = (chMin + 0.5) * S, frontX = (chMax + 0.5) * S;
    var wheelY = wheel.r - clearance; // wheel centre, relative to the chassis bottom
    var wheelMass = 4 * wheel.mass;
    mass += wheelMass + width.extraMass;
    mx += wheelMass * (rearX + frontX) / 2 + width.extraMass * (rearX + frontX) / 2;
    my += wheelMass * wheelY;
    var comX = mass ? mx / mass : 0, comY = mass ? my / mass : 0;

    var bodyTop = (topRow + 1) * S;
    var height = clearance + bodyTop;
    var frontalArea = (bodyTop + wheel.r) * width.w * 0.85;
    var cd = 0.32 + 0.04 * spoilerCells;
    var cdA = cd * frontalArea;
    var hCoM = clearance + comY;
    var gripRoad = tyre.grip.road;

    var s = {
      mass: mass,
      power: power,
      powerPerKg: mass ? power / mass : 0,
      comX: comX, comY: comY, hCoM: hCoM,
      clearance: clearance,
      height: height,
      length: isFinite(minCol) ? (maxCol - minCol + 1) * S : 0,
      minX: isFinite(minCol) ? minCol * S : 0,
      maxX: isFinite(maxCol) ? (maxCol + 1) * S : 0,
      bodyTop: bodyTop,
      wheelbase: frontX - rearX,
      rearX: rearX, frontX: frontX, wheelY: wheelY,
      wheelR: wheel.r,
      wheelMass: wheel.mass,
      travel: lift.travel,
      width: width.w,
      frontalArea: frontalArea,
      cdA: cdA,
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
    // Front/back balance: 0 = all weight on rear wheel, 1 = all on front.
    s.frontWeight = s.wheelbase > 0 ? Math.min(1, Math.max(0, (comX - rearX) / s.wheelbase)) : 0.5;
    return s;
  };

  B.PRESETS = {
    sport: function () {
      var d = { pieces: [], wheel: 'small', tyre: 'slick', lift: 'low', width: 'wide' };
      var red = '#d01012';
      [[0, 0, 4], [4, 0, 4], [8, 0, 4]].forEach(function (a) { d.pieces.push({ type: 'plastic', col: a[0], row: a[1], len: a[2], color: red }); });
      d.pieces.push({ type: 'engine', engine: 'turbo', col: 9, row: 1, len: 2 });
      d.pieces.push({ type: 'plastic', col: 11, row: 1, len: 1, color: red });
      d.pieces.push({ type: 'plastic', col: 1, row: 1, len: 4, color: red });
      d.pieces.push({ type: 'window', col: 5, row: 1, len: 2 });
      d.pieces.push({ type: 'plastic', col: 7, row: 1, len: 2, color: red });
      d.pieces.push({ type: 'spoiler', col: 0, row: 2, len: 2 });
      return d;
    },
    monster: function () {
      var d = { pieces: [], wheel: 'monster', tyre: 'offroad', lift: 'super', width: 'wide' };
      var g = '#237841';
      d.pieces.push({ type: 'heavy', col: 1, row: 0, len: 2 });
      d.pieces.push({ type: 'plastic', col: 3, row: 0, len: 4, color: g });
      d.pieces.push({ type: 'engine', engine: 'turbo', col: 7, row: 0, len: 2 });
      d.pieces.push({ type: 'heavy', col: 9, row: 0, len: 2 });
      d.pieces.push({ type: 'plastic', col: 3, row: 1, len: 4, color: g });
      d.pieces.push({ type: 'window', col: 5, row: 2, len: 2 });
      d.pieces.push({ type: 'light', col: 3, row: 2, len: 2, color: '#f2cd37' });
      d.pieces.push({ type: 'light', col: 7, row: 1, len: 4, color: '#f2cd37' });
      return d;
    },
    tower: function () {
      var d = { pieces: [], wheel: 'medium', tyre: 'slick', lift: 'high', width: 'narrow' };
      var b = '#0055bf';
      d.pieces.push({ type: 'plastic', col: 2, row: 0, len: 4, color: b });
      d.pieces.push({ type: 'plastic', col: 6, row: 0, len: 2, color: b });
      d.pieces.push({ type: 'engine', engine: 'tiny', col: 4, row: 1, len: 2 });
      for (var r = 2; r < 7; r++) d.pieces.push({ type: 'plastic', col: 4, row: r, len: 2, color: r % 2 ? '#f2cd37' : b });
      d.pieces.push({ type: 'light', col: 3, row: 7, len: 4, color: '#d01012' });
      return d;
    }
  };
})(window.BCL);
