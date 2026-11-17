// Catalog of everything a car can be built from, plus world constants.
window.BCL = window.BCL || {};
(function (B) {
  B.STUD = 0.3; // metres per grid cell (both directions)
  B.GRID_W = 14;
  B.GRID_H = 8;
  B.G = 9.81;
  B.AIR_DENSITY = 1.2;
  B.ROLLING = 0.015;
  B.BRAKE_FORCE = 14000; // newtons, same brakes on every car

  B.MATERIALS = {
    plastic: { name: 'Plastic brick', massPerCell: 25, hint: 'A normal brick. Not too heavy, not too light.' },
    heavy: { name: 'Metal brick', massPerCell: 110, hint: 'Very heavy! Put it LOW so the car does not tip over.' },
    light: { name: 'Foam brick', massPerCell: 6, hint: 'Super light. Good for tall parts that should not make the car tippy.' },
    window: { name: 'Window', massPerCell: 12, hint: 'Glass so the driver can see.' },
    spoiler: { name: 'Spoiler', massPerCell: 10, hint: 'Air pushes it DOWN: more grip when fast, but a bit more air drag.' },
    driver: { name: 'Driver', massPerCell: 8, hint: 'A minifig driver. Every cool car needs one!' },
    engine: { name: 'Engine', massPerCell: 0, hint: 'Makes the push. Add more engines for more power – but each one adds weight!' }
  };

  B.ENGINES = {
    tiny: { name: 'Tiny engine', power: 30000, massPerCell: 45, color: '#9aa0a6' },
    normal: { name: 'Normal engine', power: 80000, massPerCell: 75, color: '#5f6368' },
    turbo: { name: 'Turbo engine', power: 160000, massPerCell: 110, color: '#e8710a' },
    rocket: { name: 'Rocket engine', power: 320000, massPerCell: 160, color: '#d93025' }
  };

  B.WHEELS = {
    tiny: { name: 'Tiny', r: 0.18, mass: 6 },
    small: { name: 'Small', r: 0.25, mass: 10 },
    medium: { name: 'Medium', r: 0.35, mass: 16 },
    big: { name: 'Big', r: 0.5, mass: 26 },
    monster: { name: 'Monster', r: 0.75, mass: 45 },
    giant: { name: 'Giant', r: 1.0, mass: 80 }
  };

  // Shapes change how much of the cell a brick fills (and so its weight).
  B.SHAPES = {
    block: { fill: 1 },
    wedge: { fill: 0.5 },
    round: { fill: 0.8 }
  };
  // Wedge rotations: which triangle half of the cell is filled.
  B.WEDGE_ICONS = ['◢', '◣', '◤', '◥'];

  // Grip (friction coefficient, μ) of each tyre on each surface.
  B.TYRES = {
    slick: { name: 'Slick (road)', grip: { road: 1.0, rough: 0.7, dirt: 0.55 } },
    offroad: { name: 'Knobbly (off-road)', grip: { road: 0.85, rough: 0.95, dirt: 0.9 } }
  };

  B.LIFTS = {
    low: { name: 'Low', h: 0.0, travel: 0.08 },
    normal: { name: 'Normal', h: 0.12, travel: 0.15 },
    high: { name: 'High', h: 0.35, travel: 0.25 },
    super: { name: 'Super high', h: 0.7, travel: 0.35 }
  };

  B.WIDTHS = {
    narrow: { name: 'Narrow', w: 1.4, extraMass: 0 },
    normal: { name: 'Normal', w: 1.8, extraMass: 20 },
    wide: { name: 'Wide', w: 2.2, extraMass: 40 }
  };

  B.COLORS = ['#d01012', '#0055bf', '#f2cd37', '#237841', '#fe8a18', '#ffffff', '#1b2a34', '#a0a5a9', '#c870a0', '#69c3e2'];

  B.PALETTE = [
    { id: 'p1', type: 'plastic', len: 1 },
    { id: 'p2', type: 'plastic', len: 2 },
    { id: 'p4', type: 'plastic', len: 4 },
    { id: 'l1', type: 'light', len: 1 },
    { id: 'l2', type: 'light', len: 2 },
    { id: 'l4', type: 'light', len: 4 },
    { id: 'h1', type: 'heavy', len: 1 },
    { id: 'h2', type: 'heavy', len: 2 },
    { id: 'w1', type: 'window', len: 1 },
    { id: 'w2', type: 'window', len: 2 },
    { id: 's2', type: 'spoiler', len: 2 },
    { id: 'wg1', type: 'plastic', shape: 'wedge', len: 1 },
    { id: 'wg2', type: 'plastic', shape: 'wedge', len: 2 },
    { id: 'lw2', type: 'light', shape: 'wedge', len: 2 },
    { id: 'rd1', type: 'plastic', shape: 'round', len: 1 },
    { id: 'dr1', type: 'driver', len: 1 },
    { id: 'e-tiny', type: 'engine', engine: 'tiny', len: 2 },
    { id: 'e-normal', type: 'engine', engine: 'normal', len: 2 },
    { id: 'e-turbo', type: 'engine', engine: 'turbo', len: 2 },
    { id: 'e-rocket', type: 'engine', engine: 'rocket', len: 2 }
  ];

  // localStorage can be blocked (e.g. some browsers on file://), so never let it break the game.
  B.load = function (key, fallback) {
    try { var v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; }
  };
  B.save = function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  };

  B.pieceName = function (p) {
    if (p.type === 'engine') return B.ENGINES[p.engine].name;
    if (p.shape === 'wedge') return (p.type === 'light' ? 'Foam wedge' : 'Wedge') + (p.len > 1 ? ' ×' + p.len : '');
    if (p.shape === 'round') return 'Round brick';
    return B.MATERIALS[p.type].name + (p.len > 1 ? ' ×' + p.len : '');
  };

  B.cellMass = function (p) {
    var m = p.type === 'engine' ? B.ENGINES[p.engine].massPerCell : B.MATERIALS[p.type].massPerCell;
    return m * B.SHAPES[p.shape || 'block'].fill;
  };

  // Outline of a piece in its own units (u along its length 0..len, v up 0..1), for drawing and collisions.
  B.pieceOutline = function (p) {
    var L = p.len;
    if (p.shape === 'wedge') {
      return [[[0, 0], [L, 0], [L, 1]], [[0, 0], [L, 0], [0, 1]], [[0, 0], [0, 1], [L, 1]], [[L, 0], [L, 1], [0, 1]]][p.rot || 0];
    }
    if (p.shape === 'round') {
      var pts = [];
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; pts.push([0.5 + 0.48 * Math.cos(a), 0.5 + 0.48 * Math.sin(a)]); }
      return pts;
    }
    return [[0, 0], [L, 0], [L, 1], [0, 1]];
  };

  B.pieceColor = function (p) {
    if (p.type === 'engine') return B.ENGINES[p.engine].color;
    if (p.type === 'window') return '#9fd8f5';
    if (p.type === 'heavy') return '#6b7178';
    return p.color || '#d01012';
  };
})(window.BCL);
