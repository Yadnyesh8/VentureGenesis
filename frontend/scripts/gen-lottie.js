// Generates the VENTUREGENESIS loading animation as a renderer-safe Lottie file.
// Run: node scripts/gen-lottie.js  → writes lib/loadingLottie.json
const fs = require("fs");
const path = require("path");

// Warm palette — red / orange / yellow.
const RED = [1, 0.365, 0.365];    // #FF5D5D
const ORANGE = [1, 0.541, 0.239]; // #FF8A3D
const YELLOW = [1, 0.784, 0.239]; // #FFC83D
// Aliases keep the layer code below readable: outer ring = red, inner ring = orange.
const VIOLET = RED;
const AQUA = ORANGE;
const FR = 60;
const OP = 120;
const CX = 256, CY = 256;

const tr = (r = 0, p = [0, 0], s = [100, 100], o = 100, a = [0, 0]) => ({
  ty: "tr",
  p: { a: 0, k: p }, a: { a: 0, k: a }, s: { a: 0, k: s }, r: { a: 0, k: r }, o: { a: 0, k: o },
});

const line = (R, color, opacity, width) => ({
  ty: "gr",
  it: [
    { ty: "sh", ks: { a: 0, k: { c: false, v: [[0, 0], [R, 0]], i: [[0, 0], [0, 0]], o: [[0, 0], [0, 0]] } } },
    { ty: "st", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: opacity }, w: { a: 0, k: width }, lc: 2, lj: 2 },
    tr(),
  ],
});

const node = (R, size, color) => ({
  ty: "gr",
  it: [
    { ty: "el", p: { a: 0, k: [R, 0] }, s: { a: 0, k: [size, size] } },
    { ty: "fl", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 } },
    tr(),
  ],
});

// One "agent": a spoke line from the core out to a glowing node, rotated to its angle.
const agent = (angleDeg, R, size, color, lineOpacity) => ({
  ty: "gr",
  it: [line(R, color, lineOpacity, 1.4), node(R, size, color), tr(angleDeg)],
});

// A shape layer that rotates its children around the composition center.
const orbitLayer = (nm, agents, fromDeg, toDeg) => ({
  ty: 4, nm, ip: 0, op: OP, st: 0,
  ks: {
    o: { a: 0, k: 100 },
    p: { a: 0, k: [CX, CY, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
    r: { a: 1, k: [
      { t: 0, s: [fromDeg], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
      { t: OP, s: [toDeg] },
    ] },
  },
  shapes: agents,
});

// Faint static orbit track (stroke ellipse).
const ringTrack = (nm, R, color, opacity) => ({
  ty: 4, nm, ip: 0, op: OP, st: 0,
  ks: { o: { a: 0, k: 100 }, p: { a: 0, k: [CX, CY, 0] }, a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] }, r: { a: 0, k: 0 } },
  shapes: [{
    ty: "gr",
    it: [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [R * 2, R * 2] } },
      { ty: "st", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: opacity }, w: { a: 0, k: 1 }, lc: 1, lj: 1 },
      tr(),
    ],
  }],
});

// Expanding radar pulse — fades in small, expands, fades out. Two of these, staggered,
// give a continuous double-pulse that loops seamlessly (both invisible at the boundary).
const pulse = (nm, color, phase) => {
  // phase 0 → fires first half, phase 1 → second half
  const oKeys = phase === 0
    ? [{ t: 0, s: [0] }, { t: 8, s: [70] }, { t: 60, s: [0] }, { t: OP, s: [0] }]
    : [{ t: 0, s: [0] }, { t: 60, s: [0] }, { t: 68, s: [70] }, { t: OP, s: [0] }];
  const sKeys = phase === 0
    ? [{ t: 0, s: [30, 30], i: { x: [0.3], y: [1] }, o: { x: [0.5], y: [0] } }, { t: 60, s: [230, 230] }, { t: OP, s: [230, 230] }]
    : [{ t: 0, s: [30, 30] }, { t: 60, s: [30, 30], i: { x: [0.3], y: [1] }, o: { x: [0.5], y: [0] } }, { t: OP, s: [230, 230] }];
  return {
    ty: 4, nm, ip: 0, op: OP, st: 0,
    ks: { o: { a: 1, k: oKeys }, p: { a: 0, k: [CX, CY, 0] }, a: { a: 0, k: [0, 0, 0] },
          s: { a: 1, k: sKeys }, r: { a: 0, k: 0 } },
    shapes: [{
      ty: "gr",
      it: [
        { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [60, 60] } },
        { ty: "st", c: { a: 0, k: [...color, 1] }, o: { a: 0, k: 100 }, w: { a: 0, k: 2.5 }, lc: 1, lj: 1 },
        tr(),
      ],
    }],
  };
};

// Pulsing central core: violet halo + aqua heart, gently breathing.
const core = () => ({
  ty: 4, nm: "core", ip: 0, op: OP, st: 0,
  ks: {
    o: { a: 0, k: 100 },
    p: { a: 0, k: [CX, CY, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 1, k: [
      { t: 0, s: [100, 100, 100], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
      { t: 60, s: [120, 120, 100], i: { x: [0.42], y: [1] }, o: { x: [0.58], y: [0] } },
      { t: OP, s: [100, 100, 100] },
    ] },
    r: { a: 0, k: 0 },
  },
  shapes: [
    { ty: "gr", it: [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [78, 78] } },
      { ty: "fl", c: { a: 0, k: [...RED, 1] }, o: { a: 0, k: 24 } },
      tr(),
    ] },
    { ty: "gr", it: [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [50, 50] } },
      { ty: "fl", c: { a: 0, k: [...ORANGE, 1] }, o: { a: 0, k: 65 } },
      tr(),
    ] },
    { ty: "gr", it: [
      { ty: "el", p: { a: 0, k: [0, 0] }, s: { a: 0, k: [26, 26] } },
      { ty: "fl", c: { a: 0, k: [...YELLOW, 1] }, o: { a: 0, k: 100 } },
      tr(),
    ] },
  ],
});

const R1 = 132, R2 = 86;
const orbit1Agents = [0, 60, 120, 180, 240, 300].map((d) => agent(d, R1, 17, VIOLET, 28));
const orbit2Agents = [0, 90, 180, 270].map((d) => agent(d, R2, 13, AQUA, 30));

const doc = {
  v: "5.7.0", fr: FR, ip: 0, op: OP, w: 512, h: 512, nm: "venturegenesis-loading", assets: [],
  layers: [
    core(),
    orbitLayer("orbit-inner", orbit2Agents, 360, 0),   // counter-rotating
    orbitLayer("orbit-outer", orbit1Agents, 0, 360),
    ringTrack("track-inner", R2, AQUA, 14),
    ringTrack("track-outer", R1, VIOLET, 12),
    pulse("pulse-a", YELLOW, 0),
    pulse("pulse-b", ORANGE, 1),
  ],
};

const out = path.join(__dirname, "..", "lib", "loadingLottie.json");
fs.writeFileSync(out, JSON.stringify(doc));
console.log("wrote", out, "(" + JSON.stringify(doc).length + " bytes)");
