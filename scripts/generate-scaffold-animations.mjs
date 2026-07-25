/**
 * Standing Tabby Lottie scaffolds (3 stages × 9 states).
 * One connected orange silhouette: chunky head, neck, torso, legs, swaying tail, blink.
 * Run: node scripts/generate-scaffold-animations.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'lottie-json');

const COLORS = {
  body: [0.97, 0.62, 0.28],
  bodyDark: [0.84, 0.46, 0.16],
  belly: [0.99, 0.78, 0.48],
  blush: [0.99, 0.72, 0.42],
  outline: [0.28, 0.16, 0.08],
  eye: [0.99, 0.82, 0.18],
  eyeWhite: [1, 1, 1],
  pupil: [0.14, 0.09, 0.06],
  pink: [0.94, 0.55, 0.64],
  collar: [0.5, 0.3, 0.7],
  charm: [0.9, 0.82, 1],
  shadow: [0.72, 0.55, 0.82],
  white: [1, 1, 1],
};

/** Washed-out "gone without a meal too long" fur, for the starving mood. */
const STARVING_PALETTE = {
  body: [0.91, 0.88, 0.83],
  bodyDark: [0.72, 0.68, 0.62],
  belly: [0.98, 0.97, 0.95],
  bone: [0.98, 0.96, 0.9],
  outline: [0.46, 0.4, 0.36],
};

function paletteFor(pale) {
  return pale
    ? STARVING_PALETTE
    : { body: COLORS.body, bodyDark: COLORS.bodyDark, belly: COLORS.belly, outline: COLORS.outline };
}

const STAGES = {
  newborn: {
    size: 140,
    headR: 30,
    bodyW: 26,
    bodyH: 20,
    legH: 6,
    legW: 6,
    tailLen: 20,
    stroke: 2.8,
  },
  playful: {
    size: 180,
    headR: 42,
    bodyW: 46,
    bodyH: 36,
    legH: 10,
    legW: 11,
    tailLen: 32,
    stroke: 3.6,
  },
  adult: {
    size: 220,
    headR: 50,
    bodyW: 54,
    bodyH: 42,
    legH: 12,
    legW: 13,
    tailLen: 38,
    stroke: 4,
  },
};

const STATES = ['idle', 'happy', 'curious', 'eat', 'starving', 'feeding', 'stress', 'sleep', 'groom', 'play', 'playing', 'peek', 'overwhelmed', 'pet', 'talk'];

function staticValue(value) {
  return { a: 0, k: value };
}

function loopKeys(frames, values) {
  const step = Math.max(1, Math.floor(frames / (values.length - 1)));
  return {
    a: 1,
    k: values.map((s, index) => ({
      t: index === values.length - 1 ? frames : index * step,
      s: Array.isArray(s) ? s : [s],
    })),
  };
}

function breathe(frames, amount = 2) {
  const mid = Math.floor(frames / 2);
  return {
    a: 1,
    k: [
      { t: 0, s: [100, 100, 100] },
      { t: mid, s: [100, 100 + amount, 100] },
      { t: frames, s: [100, 100, 100] },
    ],
  };
}

function motionFor(state, frames, layout) {
  switch (state) {
    case 'happy':
      return {
        body: breathe(frames, 3),
        tail: loopKeys(frames, [-24, 24, -24]),
        headR: loopKeys(frames, [-5, 5, -5]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [0, -3, 0],
          [0, 0, 0],
        ]),
        face: 'happy',
        blink: true,
      };
    case 'play':
      return {
        body: breathe(frames, 5),
        tail: loopKeys(frames, [-36, 36, -30, 36, -36]),
        headR: loopKeys(frames, [-12, 12, -12]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [0, -5, 0],
          [0, 0, 0],
        ]),
        face: 'happy',
        blink: true,
      };
    case 'playing':
      return {
        body: breathe(frames, 3),
        bodyR: loopKeys(frames, [-5, 5, -4, 6, -5]),
        bodyP: loopKeys(frames, [
          [0, 0, 0],
          [3, 0, 0],
          [-3, 0, 0],
          [0, 0, 0],
        ]),
        tailRoot: loopKeys(frames, [-18, 22, -14, 24, -18]),
        tailBase: loopKeys(frames, [52, 88, 58, 92, 52]),
        tail: loopKeys(frames, [-72, 72, -60, 78, -68, 74, -72]),
        tailTip: loopKeys(frames, [38, -42, 32, -45, 40, -38, 38]),
        headR: loopKeys(frames, [-16, 16, -12, 20, -16]),
        headP: loopKeys(frames, [
          [0, -10, 0],
          [12, -18, 0],
          [-10, -12, 0],
          [14, -20, 0],
          [0, -10, 0],
        ]),
        pawL: {
          p: loopKeys(frames, [
            [0, 0, 0],
            [6, -34, 0],
            [2, -14, 0],
            [8, -38, 0],
            [-2, -20, 0],
            [4, -30, 0],
            [0, 0, 0],
          ]),
          r: loopKeys(frames, [-52, 28, -38, 32, -44, 22, -52]),
        },
        pawR: {
          p: loopKeys(frames, [
            [0, -8, 0],
            [-4, -30, 0],
            [0, -12, 0],
            [-6, -36, 0],
            [2, -18, 0],
            [-2, -28, 0],
            [0, -8, 0],
          ]),
          r: loopKeys(frames, [32, -48, 18, -42, 26, -50, 32]),
        },
        face: 'wide',
        blink: true,
      };
    case 'pet':
      // Leaning into the pet: head tilts and nuzzles toward one side and holds there
      // (a one-directional lean, not the symmetric side-to-side wiggle idle/happy use),
      // eyes closed the whole time in contentment rather than blinking, slow satisfied
      // tail curl — reads as "being touched" at a glance, not just "happy".
      return {
        body: breathe(frames, 2.5),
        tail: loopKeys(frames, [10, 22, 14, 24, 10]),
        headR: loopKeys(frames, [0, -14, -18, -14, 0]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [-3, 4, 0],
          [-4, 6, 0],
          [-3, 4, 0],
          [0, 0, 0],
        ]),
        face: 'happy',
        blink: false,
      };
    case 'talk':
      // Explaining herself when asked "what's up?": upright and attentive (normal round
      // eyes, not closed or narrowed like the reaction moods), a small side-to-side head
      // tilt as if gesturing mid-sentence, and a chattering mouth (see kawaiiMouth's 'talk'
      // branch) — the loop runs for as long as her speech bubble is up, however long that
      // ends up being, so it has to read as "talking" on every pass, not just the first.
      return {
        body: breathe(frames, 2),
        tail: loopKeys(frames, [-12, 12, -8, 10, -12]),
        headR: loopKeys(frames, [-3, 4, -5, 3, -3]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [0, -2, 0],
          [0, 1, 0],
          [0, -2, 0],
          [0, 0, 0],
        ]),
        face: 'talk',
        blink: true,
      };
    case 'curious':
      return {
        body: staticValue([100, 100, 100]),
        tail: loopKeys(frames, [12, 22, 12]),
        headR: staticValue([-12]),
        headP: loopKeys(frames, [
          [0, -4, 0],
          [0, -6, 0],
          [0, -4, 0],
        ]),
        face: 'wide',
        blink: false,
      };
    case 'eat':
      return {
        body: breathe(frames, 2),
        tail: loopKeys(frames, [-10, 10, -10]),
        headR: loopKeys(frames, [-8, 8, -8]),
        headP: loopKeys(frames, [
          [0, -6, 0],
          [0, -8, 0],
          [0, -6, 0],
        ]),
        face: 'worry',
        blink: false,
      };
    case 'starving':
      // Low-energy and pleading: mostly still, with one slow hopeful head-lift
      // toward the viewer (as if begging "please...") before sagging back down.
      return {
        body: breathe(frames, 0.6),
        tailBase: staticValue(82),
        tail: loopKeys(frames, [2, -2, 2]),
        headR: loopKeys(frames, [0, 0, -7, -7, 2, 0]),
        headP: loopKeys(frames, [
          [0, 9, 0],
          [0, 9, 0],
          [0, -3, 0],
          [0, -3, 0],
          [0, 9, 0],
          [0, 9, 0],
        ]),
        face: 'weary',
        blink: false,
      };
    case 'feeding': {
      // Three quick dips down into the bowl, not one slow bob — that's what actually
      // reads as "eating" instead of "nodding off". Dip distance scales with the stage's
      // head size: a fixed pixel dip that looks right on the adult is a wild head-bang
      // on the much smaller newborn.
      const dip = layout ? layout.headR / STAGES.adult.headR : 1;
      const dipPoint = (x, y) => [x * dip, y * dip, 0];
      return {
        body: breathe(frames, 1.5),
        tail: loopKeys(frames, [6, 12, 6, 10, 6]),
        headR: loopKeys(frames, [0, -6, 2, -8, 2, -6, 0]),
        headP: loopKeys(frames, [
          dipPoint(0, 2),
          dipPoint(-3, 34),
          dipPoint(2, 4),
          dipPoint(-3, 36),
          dipPoint(2, 4),
          dipPoint(-3, 34),
          dipPoint(0, 2),
        ]),
        face: 'open',
        blink: false,
      };
    }
    case 'stress':
      return {
        body: staticValue([100, 100, 100]),
        tail: loopKeys(frames, [-20, 18, -16, 14, 0]),
        headR: loopKeys(frames, [-8, 8, -6, 6, 0]),
        headP: staticValue([0, 0, 0]),
        face: 'worry',
        blink: false,
      };
    case 'overwhelmed':
      return {
        body: staticValue([100, 100, 100]),
        tail: staticValue([0]),
        headR: loopKeys(frames, [-2, 2, -2]),
        headP: staticValue([0, 0, 0]),
        face: 'overwhelmed',
        blink: false,
        coverHands: true,
      };
    case 'sleep':
      return {
        body: breathe(frames, 1.5),
        tail: loopKeys(frames, [-4, 4, -4]),
        headR: staticValue([8]),
        headP: loopKeys(frames, [
          [0, 3, 0],
          [0, 5, 0],
          [0, 3, 0],
        ]),
        face: 'sleep',
        blink: false,
      };
    case 'groom':
      return {
        body: breathe(frames, 2),
        tail: staticValue([6]),
        headR: loopKeys(frames, [14, 34, 14]),
        headP: loopKeys(frames, [
          [8, 6, 0],
          [12, 12, 0],
          [8, 6, 0],
        ]),
        face: 'sleep',
        blink: false,
      };
    default:
      return {
        body: breathe(frames, 2),
        tail: loopKeys(frames, [-14, 14, -14]),
        headR: loopKeys(frames, [-3, 3, -3]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [0, -2, 0],
          [0, 0, 0],
        ]),
        face: 'neutral',
        blink: true,
      };
  }
}

function fill(color, opacity = 100) {
  return { ty: 'fl', c: staticValue(color), o: staticValue(opacity), r: 1, bm: 0 };
}

function stroke(color, width) {
  return {
    ty: 'st',
    c: staticValue(color),
    o: staticValue(100),
    w: staticValue(width),
    lc: 2,
    lj: 2,
    bm: 0,
  };
}

/** Butt (flat) line caps instead of round — round caps on a short thin stroke (like a
 * whisker) blob up into a fat capsule instead of a crisp line. */
function crispStroke(color, width) {
  return { ...stroke(color, width), lc: 1 };
}

function ellipse(w, h) {
  return { ty: 'el', p: staticValue([0, 0]), s: staticValue([w, h]), d: 1 };
}

function rect(w, h, round = 0) {
  return { ty: 'rc', p: staticValue([0, 0]), s: staticValue([w, h]), r: staticValue(round), d: 1 };
}

function path(vertices, closed = false) {
  return {
    ty: 'sh',
    ks: staticValue({
      i: vertices.map(() => [0, 0]),
      o: vertices.map(() => [0, 0]),
      v: vertices,
      c: closed,
    }),
    nm: 'Path',
  };
}

function group(name, items, transform) {
  return {
    ty: 'gr',
    nm: name,
    it: [
      ...items,
      {
        ty: 'tr',
        p: transform.p ?? staticValue([0, 0]),
        a: transform.a ?? staticValue([0, 0]),
        s: transform.s ?? staticValue([100, 100]),
        r: transform.r ?? staticValue(0),
        o: staticValue(100),
      },
    ],
    np: items.length + 1,
  };
}

function painted(shape, fillColor, outline, width) {
  return [shape, fill(fillColor), stroke(outline, width)];
}

function shapeLayer(name, index, transform, shapes, frames) {
  return {
    ddd: 0,
    ind: index,
    ty: 4,
    nm: name,
    sr: 1,
    ks: {
      o: staticValue(100),
      r: transform.r ?? staticValue(0),
      p: transform.p ?? staticValue([0, 0, 0]),
      a: transform.a ?? staticValue([0, 0, 0]),
      s: transform.s ?? staticValue([100, 100, 100]),
    },
    ao: 0,
    shapes,
    ip: 0,
    op: frames,
    st: 0,
    bm: 0,
  };
}

function blinkScale(frames) {
  const blinkAt = Math.floor(frames * 0.55);
  return {
    a: 1,
    k: [
      { t: 0, s: [100, 100, 100] },
      { t: blinkAt, s: [100, 100, 100] },
      { t: blinkAt + 2, s: [100, 6, 100] },
      { t: blinkAt + 4, s: [100, 100, 100] },
      { t: frames, s: [100, 100, 100] },
    ],
  };
}

function offsetPos(pos, ox, oy) {
  if (pos.a === 0) {
    const [x, y, z] = pos.k;
    return staticValue([ox + x, oy + y, z]);
  }
  return {
    a: 1,
    k: pos.k.map((frame) => ({
      ...frame,
      s: [ox + frame.s[0], oy + frame.s[1], frame.s[2] ?? 0],
    })),
  };
}

function rigPositions(layout, size) {
  const cx = size * 0.5;
  const footY = size * 0.9;
  const torsoY = footY - layout.bodyH * 0.52;
  const headOffsetY = -(layout.bodyH * 0.12 + layout.headR * 0.9);
  return { cx, footY, torsoY, headOffsetY };
}

/**
 * Pinched-waist "hourglass" outline for the starving silhouette. The head sits low
 * enough to cover the upper torso, so only the lower half (around y=0 downward) is
 * ever visible: that's where the waist must visibly cinch in for the gag to read.
 */
function buildThinTorsoOutline(bw, bh) {
  const points = [
    { y: -bh * 0.52, w: bw * 0.5 },
    { y: -bh * 0.2, w: bw * 0.46 },
    { y: 0, w: bw * 0.26 },
    { y: bh * 0.18, w: bw * 0.32 },
    { y: bh * 0.4, w: bw * 0.4 },
    { y: bh * 0.58, w: bw * 0.28 },
  ];
  const right = points.map((p) => [p.w, p.y]);
  const left = [...points].reverse().map((p) => [-p.w, p.y]);
  return path([...right, ...left], true);
}

/** Bold ivory "visible ribs" arcs placed in the belly's visible lower half. */
function buildRibArcs(bw, bh, strokeWidth, boneColor) {
  const arcs = [
    { y: bh * 0.02, half: bw * 0.22 },
    { y: bh * 0.17, half: bw * 0.27 },
  ];
  return arcs.map((r, i) =>
    group(
      `Rib${i}`,
      [
        path([[-r.half, r.y], [0, r.y + bh * 0.07], [r.half, r.y]]),
        stroke(boneColor, strokeWidth * 0.6),
      ],
      { p: staticValue([0, 0]) },
    ),
  );
}

function buildTorso(layout, options = {}) {
  const thin = options.thin ?? false;
  const c = paletteFor(thin);
  const o = c.outline;
  const w = layout.stroke;
  const bw = layout.bodyW * (thin ? 0.68 : 1);
  const bh = layout.bodyH * (thin ? 0.88 : 1);

  const paw = (x) =>
    group(
      'Paw',
      painted(
        ellipse(layout.legW * (thin ? 0.7 : 1.2), layout.legH * (thin ? 0.48 : 0.85)),
        c.bodyDark,
        o,
        w * 0.65,
      ),
      { p: staticValue([x, bh * 0.34]) },
    );

  const midsection = thin
    ? [...buildRibArcs(bw, bh, w, STARVING_PALETTE.bone)]
    : [
        group(
          'FlankPatch',
          painted(ellipse(bw * 0.22, bh * 0.18), c.bodyDark, o, w * 0.2),
          { p: staticValue([bw * 0.28, -bh * 0.05]) },
        ),
      ];

  const outline = thin ? buildThinTorsoOutline(bw, bh) : ellipse(bw * 1.08, bh * 1.05);
  const bellySize = ellipse(bw * (thin ? 0.34 : 0.55), bh * (thin ? 0.24 : 0.45));
  const belly = thin
    ? [group('Belly', painted(bellySize, c.belly, o, w * 0.25), { p: staticValue([0, bh * 0.1]) })]
    : painted(bellySize, c.belly, o, w * 0.25);
  const base = painted(outline, c.body, o, w);
  const collar = buildCollarBand(layout, { pale: thin });
  const paws = [paw(-bw * 0.2), paw(bw * 0.2)];

  // Detail shapes must come before the base silhouette: this renderer draws earlier
  // items in front, so a base fill listed first would otherwise hide everything after it.
  const parts = thin ? [...belly, ...midsection, collar, ...paws, ...base] : [...base, ...belly, ...midsection, collar, ...paws];

  return group('Torso', parts, { p: staticValue([0, 0]) });
}

function buildCollarBand(layout, options = {}) {
  const o = paletteFor(options.pale).outline;
  const w = layout.stroke;
  const bw = layout.bodyW;

  return group(
    'Collar',
    [
      ...painted(rect(bw * 0.78, layout.headR * 0.14, layout.headR * 0.07), COLORS.collar, o, w * 0.4),
      ...painted(ellipse(layout.headR * 0.16, layout.headR * 0.16), COLORS.charm, o, w * 0.3),
    ],
    { p: staticValue([0, -layout.bodyH * 0.42]) },
  );
}

function headLayerTransform(motion, cx, headY) {
  return {
    p: offsetPos(motion.headP, cx, headY),
    r: motion.headR,
  };
}

function buildHeadShell(layout, options = {}) {
  const c = paletteFor(options.pale);
  const o = c.outline;
  const w = layout.stroke;
  const r = layout.headR;

  const ear = (side) =>
    group(
      `Ear${side}`,
      [
        ...painted(
          path(
            [
              [-15, 5],
              [-7, -10],
              [0, -26],
              [7, -10],
              [15, 5],
            ],
            true,
          ),
          c.body,
          o,
          w,
        ),
        ...painted(
          path(
            [
              [-8, 3],
              [-3, -6],
              [0, -14],
              [3, -6],
              [8, 3],
            ],
            true,
          ),
          COLORS.pink,
          o,
          w * 0.35,
        ),
      ],
      {
        p: staticValue([side === 'L' ? -r * 0.62 : r * 0.62, -r * 0.86]),
        r: staticValue(side === 'L' ? -6 : 6),
      },
    );

  return [
    // Earlier items draw in front: cheeks and whiskers sit on top of the fur. Ears go
    // *after* the head fill on purpose — their root tucks behind the head silhouette
    // seamlessly, only the pointed tip (which already extends past the circle) shows.
    group(
      'CheekL',
      painted(ellipse(r * 0.28, r * 0.2), COLORS.blush, o, 0),
      { p: staticValue([-r * 0.62, r * 0.2]) },
    ),
    group(
      'CheekR',
      painted(ellipse(r * 0.28, r * 0.2), COLORS.blush, o, 0),
      { p: staticValue([r * 0.62, r * 0.2]) },
    ),
    whiskerOnCheek(o, w, r, -1),
    whiskerOnCheek(o, w, r, 1),
    ...painted(ellipse(r * 2, r * 2), c.body, o, w),
    ear('L'),
    ear('R'),
  ];
}

/** Two straight strands starting right beside the mouth (a real whisker pad sits next
 * to the muzzle, not out by the cheek/eye) and reaching out past the head silhouette.
 * This renders at 150px, often viewed even smaller — simple straight lines with a
 * moderate width read clearly there; thin curved ones just blur into stubs. */
function whiskerOnCheek(o, w, r, side) {
  const originX = side * r * 0.2;
  const originY = r * 0.42;
  const reach = r * 0.9;
  const tilts = [-0.22, 0.26];

  return group(
    `Whisker${side}`,
    tilts.map((tilt, i) => {
      const endX = originX + side * reach;
      const endY = originY + tilt * r * 0.18;
      return group(
        `WhiskerStrand${i}`,
        [path([[originX, originY], [endX, endY]]), crispStroke(o, w * 0.4)],
        { p: staticValue([0, 0]) },
      );
    }),
    { p: staticValue([0, 0]) },
  );
}

function kawaiiMouth(face, y, o, w, frames) {
  if (face === 'open') {
    // Chewing: closed by default (including at rest, head up and away from the bowl) and
    // only opens at the exact moments the head dips down to the food — matches headP's
    // [rest, dip, lift, dip, lift, dip, rest] beats exactly, so "mouth open" only ever
    // lines up with "head down at the bowl", never with head-up rest.
    const chewScale = [15, 165, 15, 175, 15, 165, 15].map((h) => [100, h]);
    return group('Mouth', painted(ellipse(6, 5), COLORS.pink, o, w * 0.4), {
      p: staticValue([0, y]),
      s: loopKeys(frames, chewScale),
    });
  }
  if (face === 'talk') {
    // Quick, irregular open/close flaps (unlike chewing's slower, more uniform dips) —
    // varied heights and closer-together beats read as chatter, not eating.
    const talkScale = [15, 130, 20, 150, 15, 110, 25, 140, 15, 100, 15].map((h) => [100, h]);
    return group('Mouth', painted(ellipse(6, 5), COLORS.pink, o, w * 0.4), {
      p: staticValue([0, y]),
      s: loopKeys(frames, talkScale),
    });
  }
  if (face === 'worry') {
    return group(
      'Mouth',
      [path([[-4, y + 2], [0, y], [4, y + 2]]), stroke(o, w * 0.85)],
      { p: staticValue([0, 0]) },
    );
  }
  if (face === 'weary') {
    return group(
      'Mouth',
      [path([[-6, y + 4], [0, y - 1], [6, y + 4]]), stroke(o, w)],
      { p: staticValue([0, 0]) },
    );
  }
  if (face === 'happy') {
    return group(
      'Mouth',
      [path([[-4, y], [0, y + 4], [4, y]]), stroke(o, w * 0.9)],
      { p: staticValue([0, 0]) },
    );
  }
  // Plain content smile — a single gentle dip. The old default shape doubled back on
  // itself into a small "w", which read as fussy instead of calm on the most common
  // faces (idle, curious, playing).
  return group(
    'Mouth',
    [path([[-3.5, y], [0, y + 2.5], [3.5, y]]), stroke(o, w * 0.85)],
    { p: staticValue([0, 0]) },
  );
}

/** Palm-up cat paw (toe beans toward viewer) for overwhelmed cover. */
function buildOverwhelmedCoverPaw(layout, side) {
  const o = COLORS.outline;
  const w = layout.stroke;
  const pawW = layout.headR * 0.78;
  const pawH = layout.headR * 0.9;
  const sign = side === 'L' ? -1 : 1;

  const palmW = pawW * 0.76;
  const palmH = pawH * 0.38;
  const toeR = pawW * 0.11;
  const toeArcY = -pawH * 0.15;
  const toeSpread = pawW * 0.21;

  const toeBean = (index) => {
    const offset = index - 1.5;
    const tx = offset * toeSpread;
    const ty = toeArcY - Math.abs(offset) * toeR * 0.35;
    return group(
      `Toe${index}`,
      [
        ...painted(ellipse(toeR, toeR * 0.9), COLORS.pink, o, w * 0.14),
        group(
          'ToeShine',
          painted(ellipse(toeR * 0.28, toeR * 0.22), COLORS.white, COLORS.white, 0),
          { p: staticValue([-toeR * 0.22, -toeR * 0.18]) },
        ),
      ],
      { p: staticValue([tx, ty]) },
    );
  };

  const wrist = group(
    'Wrist',
    painted(ellipse(pawW * 0.34, pawH * 0.24), COLORS.body, o, w * 0.4),
    { p: staticValue([sign * pawW * 0.72, pawH * 0.34]) },
  );

  return group(
    side === 'L' ? 'CoverPawL' : 'CoverPawR',
    [
      wrist,
      ...painted(ellipse(pawW * 1.04, pawH * 1.06), COLORS.belly, o, w * 0.52),
      ...painted(ellipse(palmW, palmH), COLORS.pink, o, w * 0.24),
      group(
        'PalmShine',
        painted(ellipse(palmW * 0.22, palmH * 0.18), COLORS.white, COLORS.white, 0),
        { p: staticValue([-palmW * 0.18, -palmH * 0.12]) },
      ),
      toeBean(0),
      toeBean(1),
      toeBean(2),
      toeBean(3),
    ],
    { p: staticValue([0, 0]) },
  );
}

function overwhelmedLoopTiming(frames) {
  const t = (ratio) => Math.floor(frames * ratio);
  return {
    frames,
    coverIn: t(0.18),
    holdCover: t(0.38),
    coverOut: t(0.58),
    eyesWide: t(0.76),
  };
}

function buildOverwhelmedCoverHands(layout, frames) {
  const r = layout.headR;
  const eyeY = r * 0.06;
  const eyeGap = r * 0.26;
  const restOffset = eyeGap + r * 0.2;
  const startOffset = r * 1.08;
  const { coverIn, holdCover, coverOut, eyesWide, frames: end } = overwhelmedLoopTiming(frames);

  const hand = (side) => {
    const sign = side === 'L' ? -1 : 1;
    const restX = sign * restOffset;
    const startX = sign * startOffset;
    const inward = side === 'L' ? 1 : -1;
    const offY = eyeY + 8;
    const positionKeys = {
      a: 1,
      k: [
        { t: 0, s: [startX, offY, 0] },
        { t: coverIn, s: [restX, eyeY, 0] },
        { t: holdCover, s: [restX + inward * 0.7, eyeY - 0.45, 0] },
        { t: coverOut, s: [startX, offY, 0] },
        { t: eyesWide, s: [startX, offY - 2, 0] },
        { t: end, s: [startX, offY, 0] },
      ],
    };
    const rotationKeys = {
      a: 1,
      k: [
        { t: 0, s: [side === 'L' ? -6 : 6] },
        { t: coverIn, s: [side === 'L' ? -14 : 14] },
        { t: holdCover, s: [side === 'L' ? -12 : 12] },
        { t: coverOut, s: [side === 'L' ? -6 : 6] },
        { t: end, s: [side === 'L' ? -6 : 6] },
      ],
    };
    return group(
      `CoverHand${side}`,
      [buildOverwhelmedCoverPaw(layout, side)],
      {
        p: positionKeys,
        r: rotationKeys,
        s: staticValue([108, 108, 100]),
      },
    );
  };

  return [hand('L'), hand('R')];
}

function overwhelmedEyeScaleKeys(frames) {
  const { coverIn, holdCover, coverOut, eyesWide, frames: end } = overwhelmedLoopTiming(frames);
  return {
    a: 1,
    k: [
      { t: 0, s: [114, 114, 100] },
      { t: coverIn, s: [100, 100, 100] },
      { t: holdCover, s: [98, 102, 100] },
      { t: coverOut, s: [112, 112, 100] },
      { t: eyesWide, s: [118, 118, 100] },
      { t: end, s: [114, 114, 100] },
    ],
  };
}

function buildFace(layout, face, blink, frames, options = {}) {
  const o = paletteFor(options.pale).outline;
  const w = layout.stroke;
  const r = layout.headR;
  const wide = face === 'wide' || face === 'overwhelmed' || face === 'weary';
  const eyeY = r * 0.06;
  const gap = face === 'overwhelmed' ? r * 0.26 : r * 0.3;
  // Kitten eyes: bigger relative to the head than the grown-up stages, for that
  // naughty-baby-animal look (big eyes, big head, tiny body).
  const babyBoost = options.babyEyes ? 1.2 : 1;
  const eyeW = (face === 'overwhelmed' ? 0.64 : wide ? 0.56 : 0.5) * r * babyBoost;
  const eyeH = (face === 'overwhelmed' ? 0.74 : wide ? 0.64 : 0.58) * r * babyBoost;
  const mouthY = r * 0.36;

  const eye = (side) => {
    const x = side === 'L' ? -gap : gap;

    if (face === 'sleep') {
      return group(
        `Eye${side}`,
        [path([[-eyeW * 0.45, 0], [0, 2], [eyeW * 0.45, 0]]), stroke(o, w * 0.85)],
        { p: staticValue([x, eyeY]) },
      );
    }

    if (face === 'happy') {
      return group(
        `Eye${side}`,
        [path([[-eyeW * 0.38, eyeH * 0.06], [0, -eyeH * 0.2], [eyeW * 0.38, eyeH * 0.06]]), stroke(o, w * 0.9)],
        { p: staticValue([x, eyeY]) },
      );
    }

    if (face === 'overwhelmed') {
      return group(
        `Eye${side}`,
        [
          // Earlier items draw in front: pupil and shine sit on top of the base iris fill,
          // not hidden behind it.
          group(
            'ShineBig',
            painted(ellipse(eyeW * 0.14, eyeH * 0.16), COLORS.white, COLORS.white, 0),
            { p: staticValue([-eyeW * 0.12, -eyeH * 0.22]) },
          ),
          ...painted(ellipse(eyeW * 0.3, eyeH * 0.34), COLORS.pupil, COLORS.pupil, 0),
          ...painted(ellipse(eyeW, eyeH), COLORS.eye, o, w * 0.45),
        ],
        {
          p: staticValue([x, eyeY]),
          s: overwhelmedEyeScaleKeys(frames),
        },
      );
    }

    // Feeding: pupil and shine shift toward the bottom of the eye so she's visibly
    // looking down at the bowl, not staring straight ahead while her head just happens
    // to be lower. Kept just inside the iris so it doesn't clip past the eye outline.
    const gazeY = face === 'open' ? eyeH * 0.14 : 0;

    return group(
      `Eye${side}`,
      [
        // Earlier items draw in front: shines and the pupil slit sit on top of the base
        // iris fill, not hidden behind it.
        group(
          'ShineSmall',
          painted(ellipse(eyeW * 0.08, eyeH * 0.09), COLORS.white, COLORS.white, 0),
          { p: staticValue([eyeW * 0.14, eyeH * 0.08 + gazeY]) },
        ),
        group(
          'ShineBig',
          painted(ellipse(eyeW * 0.18, eyeH * 0.2), COLORS.white, COLORS.white, 0),
          { p: staticValue([-eyeW * 0.16, -eyeH * 0.2 + gazeY]) },
        ),
        // 'worry'/'weary' (hungry, stressed, starving) get a narrow alert slit — the
        // real cat-eye cue fits the tension. Everything else (idle, curious, playing,
        // feeding) gets a big round pupil instead: warm and cute, not on-edge.
        group(
          'Pupil',
          painted(
            face === 'worry' || face === 'weary'
              ? ellipse(eyeW * 0.32, eyeH * 0.86)
              : ellipse(eyeH * 0.62, eyeH * 0.62),
            COLORS.pupil,
            COLORS.pupil,
            0,
          ),
          { p: staticValue([0, gazeY]) },
        ),
        ...painted(ellipse(eyeW, eyeH), COLORS.eye, o, w * 0.45),
      ],
      {
        p: staticValue([x, eyeY]),
        s: blink ? blinkScale(frames) : staticValue([100, 100, 100]),
      },
    );
  };

  if (face === 'overwhelmed') {
    return [
      eye('L'),
      eye('R'),
      group(
        'Mouth',
        [path([[-3.5, mouthY + 1], [0, mouthY - 1], [3.5, mouthY + 1]]), stroke(o, w * 0.85)],
        { p: staticValue([0, 0]) },
      ),
    ];
  }

  return [eye('L'), eye('R'), kawaiiMouth(face, mouthY, o, w, frames)];
}

function buildBodyRig(layout, motion, options = {}) {
  // dotLottie: first shape group in the layer draws in front. Torso always
  // goes first so the tail tucks behind the body instead of floating on top
  // of it when the cat faces the viewer, but batting paws need to read as
  // reaching out in front of her, so they go even earlier than the torso.
  const parts = [];
  if (options.batPaws) {
    parts.push(buildBatPawRig(motion.pawL, 'L', layout));
    parts.push(buildBatPawRig(motion.pawR, 'R', layout));
  }
  parts.push(buildTorso(layout, options.torsoOptions ?? {}));
  if (!options.skipTail) {
    parts.push(buildTailRigGroup(layout, motion, options.tailOptions ?? {}));
  }
  return group('BodyRig', parts, { p: staticValue([0, 0]) });
}

function buildBatPawRig(pawMotion, side, layoutRef) {
  const spread = layoutRef.bodyW * 0.46;
  const chestY = layoutRef.bodyH * 0.1;
  const anchorY = layoutRef.legH * 0.55;
  return group(
    side === 'L' ? 'PawBatL' : 'PawBatR',
    [buildBatPaw(layoutRef, side)],
    {
      p: offsetPos(pawMotion.p, side === 'L' ? -spread : spread, chestY),
      r: pawMotion.r,
      s: staticValue([118, 118, 100]),
      a: staticValue([0, anchorY, 0]),
    },
  );
}

function buildTailRigGroup(layout, motion, options = {}) {
  const tail = buildTail(layout, {
    ...options,
    baseRotation: options.baseRotation ?? motion.tailBase,
  });
  const tipAnchor = [tail.baseLen * 0.52, -tail.baseLen * 0.48];
  const tipEnd = [tail.tipLen * 0.14, -tail.tipLen * 0.5];
  const whipLen = tail.tipLen * 0.38;

  const tipRigChildren = [tail.tip];
  if (options.whipTip && motion.tailTip) {
    const whipColors = paletteFor(options.pale);
    tipRigChildren.push(
      group(
        'TailWhipRig',
        [
          group(
            'TailWhip',
            [
              path(
                [
                  [0, 0],
                  [whipLen * 0.2, -whipLen * 0.32],
                  [whipLen * 0.1, -whipLen * 0.68],
                ],
                false,
              ),
              stroke(whipColors.bodyDark, layout.stroke * (options.thickScale ?? 2.2) * 0.82),
              path(
                [
                  [0, 0],
                  [whipLen * 0.17, -whipLen * 0.28],
                  [whipLen * 0.08, -whipLen * 0.58],
                ],
                false,
              ),
              stroke(whipColors.body, layout.stroke * (options.thickScale ?? 2.2) * 0.68),
            ],
            { p: staticValue([0, 0]), r: staticValue(0) },
          ),
        ],
        {
          p: staticValue([0, 0]),
          a: staticValue(tipEnd),
          r: motion.tailTip,
        },
      ),
    );
  }

  const segments = [
    tail.base,
    group('TailTipRig', tipRigChildren, {
      p: staticValue([0, 0]),
      a: staticValue(tipAnchor),
      r: motion.tail,
    }),
  ];

  const mount = options.mount ?? [-layout.bodyW * 0.34, -layout.bodyH * 0.02];
  return group('Tail', segments, {
    p: staticValue(mount),
    r: motion.tailRoot ?? staticValue(0),
  });
}

function buildTail(layout, options = {}) {
  const c = paletteFor(options.pale);
  const len = layout.tailLen * (options.lengthScale ?? 1);
  const thick = layout.stroke * (options.thickScale ?? 2.2);
  const baseLen = len * 0.45;
  const tipLen = len - baseLen;
  const baseRotation = motionOrStatic(options.baseRotation, 58);

  const base = group(
    'TailBase',
    [
      path(
        [
          [0, 0],
          [baseLen * 0.2, -baseLen * 0.1],
          [baseLen * 0.48, -baseLen * 0.28],
          [baseLen * 0.52, -baseLen * 0.48],
        ],
        false,
      ),
      stroke(c.bodyDark, thick),
      path(
        [
          [0, 0],
          [baseLen * 0.18, -baseLen * 0.09],
          [baseLen * 0.42, -baseLen * 0.24],
          [baseLen * 0.48, -baseLen * 0.42],
        ],
        false,
      ),
      stroke(c.body, thick * 0.8),
    ],
    { p: staticValue([0, 0]), r: baseRotation },
  );

  const tip = group(
    'TailTip',
    [
      path(
        [
          [0, 0],
          [tipLen * 0.16, -tipLen * 0.14],
          [tipLen * 0.24, -tipLen * 0.32],
          [tipLen * 0.14, -tipLen * 0.5],
        ],
        false,
      ),
      stroke(c.bodyDark, thick),
      path(
        [
          [0, 0],
          [tipLen * 0.14, -tipLen * 0.12],
          [tipLen * 0.21, -tipLen * 0.28],
          [tipLen * 0.12, -tipLen * 0.44],
        ],
        false,
      ),
      stroke(c.body, thick * 0.8),
    ],
    { p: staticValue([0, 0]), r: staticValue(0) },
  );

  return { baseLen, tipLen, base, tip };
}

function motionOrStatic(value, fallback) {
  if (value == null) {
    return staticValue(fallback);
  }
  return value;
}

function buildBatPaw(layout, side) {
  const o = COLORS.outline;
  const w = layout.stroke;
  const pw = layout.legW * 1.35;
  const ph = layout.legH * 1.15;
  const toe = layout.legW * 0.22;
  const toeY = -ph * 0.42;
  const spread = pw * 0.28;
  const sign = side === 'L' ? -1 : 1;

  const toePad = (index) =>
    group(
      `Toe${index}`,
      painted(ellipse(toe, toe * 0.9), COLORS.pink, o, w * 0.2),
      {
        p: staticValue([sign * spread * (index - 1), toeY]),
      },
    );

  return group(
    'BatPaw',
    [
      // Earlier items draw in front: toe beans over the palm pad, both over the base mitt.
      toePad(0),
      toePad(1),
      toePad(2),
      ...painted(ellipse(pw * 0.55, ph * 0.42), COLORS.pink, o, w * 0.25),
      ...painted(ellipse(pw, ph), COLORS.bodyDark, o, w * 0.7),
    ],
    {
      p: staticValue([0, layout.legH * 0.35]),
      a: staticValue([0, layout.legH * 0.35, 0]),
    },
  );
}

/** Head-only hide-and-peek: rises from below, playful eyes, body hidden. */
function buildPeekCat(stageKey) {
  const layout = STAGES[stageKey];
  const size = layout.size;
  const cx = size * 0.5;
  const frames = 90;
  const riseEnd = 22;
  const restY = size * 0.94;
  const startY = size * 1.24;

  const headLayer = shapeLayer(
    'Head',
    2,
    {
      p: {
        a: 1,
        k: [
          { t: 0, s: [cx, startY, 0] },
          { t: riseEnd, s: [cx, restY, 0] },
          { t: frames, s: [cx, restY, 0] },
        ],
      },
      r: loopKeys(frames, [-7, 7, -7]),
    },
    [
      group('Face', buildFace(layout, 'wide', true, frames, { babyEyes: stageKey === 'newborn' }), { p: staticValue([0, 0]) }),
      group('HeadShell', buildHeadShell(layout), { p: staticValue([0, 0]) }),
    ],
    frames,
  );

  const hiddenLayer = (name, index) =>
    shapeLayer(name, index, { p: staticValue([cx, restY, 0]) }, [], frames);

  const layers = [
    headLayer,
    { ...hiddenLayer('Body', 1), ks: { ...hiddenLayer('Body', 1).ks, o: staticValue(0) } },
    {
      ...shapeLayer('Shadow', 0, { p: staticValue([cx, size * 0.98, 0]) }, [], frames),
      ks: {
        o: staticValue(0),
        r: staticValue(0),
        p: staticValue([cx, size * 0.98, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100]),
      },
    },
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: frames,
    w: size,
    h: size,
    nm: `tabby-${stageKey}-peek`,
    ddd: 0,
    assets: [],
    layers,
  };
}

/** Head ducks below the edge — reverse of peek in. */
function buildPeekDuckCat(stageKey) {
  const layout = STAGES[stageKey];
  const size = layout.size;
  const cx = size * 0.5;
  const frames = 54;
  const sinkEnd = 32;
  const restY = size * 0.94;
  const startY = size * 1.24;

  const headLayer = shapeLayer(
    'Head',
    2,
    {
      p: {
        a: 1,
        k: [
          { t: 0, s: [cx, restY, 0] },
          { t: sinkEnd, s: [cx, startY, 0] },
          { t: frames, s: [cx, startY, 0] },
        ],
      },
      r: staticValue(0),
    },
    [
      group('Face', buildFace(layout, 'wide', false, frames, { babyEyes: stageKey === 'newborn' }), { p: staticValue([0, 0]) }),
      group('HeadShell', buildHeadShell(layout), { p: staticValue([0, 0]) }),
    ],
    frames,
  );

  const hiddenLayer = (name, index) =>
    shapeLayer(name, index, { p: staticValue([cx, restY, 0]) }, [], frames);

  const layers = [
    headLayer,
    { ...hiddenLayer('Body', 1), ks: { ...hiddenLayer('Body', 1).ks, o: staticValue(0) } },
    {
      ...shapeLayer('Shadow', 0, { p: staticValue([cx, size * 0.98, 0]) }, [], frames),
      ks: {
        o: staticValue(0),
        r: staticValue(0),
        p: staticValue([cx, size * 0.98, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100]),
      },
    },
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: frames,
    w: size,
    h: size,
    nm: `tabby-${stageKey}-peek_duck`,
    ddd: 0,
    assets: [],
    layers,
  };
}

/** Face-forward overwhelmed: peek-style framing, wide eyes, paws shielding from the sides. */
function buildOverwhelmedCat(stageKey) {
  const layout = STAGES[stageKey];
  const size = layout.size;
  const cx = size * 0.5;
  const frames = 96;
  const faceY = size * 0.9;
  const headPose = {
    p: staticValue([cx, faceY, 0]),
    r: loopKeys(frames, [-2, 2, -2]),
  };

  const headLayer = shapeLayer(
    'Head',
    2,
    headPose,
    [
      group('Face', buildFace(layout, 'overwhelmed', false, frames, { babyEyes: stageKey === 'newborn' }), { p: staticValue([0, 0]) }),
      group('HeadShell', buildHeadShell(layout), { p: staticValue([0, 0]) }),
    ],
    frames,
  );

  const coverHandsLayer = shapeLayer(
    'CoverHands',
    4,
    headPose,
    [group('CoverPaws', buildOverwhelmedCoverHands(layout, frames), { p: staticValue([0, 0]) })],
    frames,
  );

  const hiddenLayer = (name, index) =>
    shapeLayer(name, index, { p: staticValue([cx, faceY, 0]) }, [], frames);

  // dotLottie paints the first layer in this array on the viewer side (in front).
  const layers = [
    coverHandsLayer,
    headLayer,
    { ...hiddenLayer('Body', 1), ks: { ...hiddenLayer('Body', 1).ks, o: staticValue(0) } },
    {
      ...shapeLayer('Shadow', 0, { p: staticValue([cx, size * 0.98, 0]) }, [], frames),
      ks: {
        o: staticValue(0),
        r: staticValue(0),
        p: staticValue([cx, size * 0.98, 0]),
        a: staticValue([0, 0, 0]),
        s: staticValue([100, 100, 100]),
      },
    },
  ];

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: frames,
    w: size,
    h: size,
    nm: `tabby-${stageKey}-overwhelmed`,
    ddd: 0,
    assets: [],
    layers,
  };
}

/** Food bowl with visible kibble, not just an empty dish. Earlier items draw in front,
 * so the kibble and food base go before the rim, or the rim would hide them. */
function buildFoodBowl(layout) {
  const o = COLORS.outline;
  const w = layout.stroke;
  const kibbleColor = COLORS.bodyDark;
  const kibbleSpots = [
    [-10, -1.5],
    [-3, 1.5],
    [4, -2],
    [10.5, 1],
    [0.5, -3.5],
  ];
  const kibble = kibbleSpots.map(([kx, ky], i) =>
    group(
      `Kibble${i}`,
      painted(ellipse(5, 4), kibbleColor, o, w * 0.25),
      { p: staticValue([kx, ky]) },
    ),
  );

  return group(
    'BowlShape',
    [
      ...kibble,
      ...painted(ellipse(30, 9), COLORS.belly, o, w * 0.4),
      ...painted(ellipse(40, 14), COLORS.collar, o, w * 0.65),
    ],
    { p: staticValue([0, 0]) },
  );
}

function buildCat(stageKey, state) {
  if (state === 'peek') {
    return buildPeekCat(stageKey);
  }
  if (state === 'overwhelmed') {
    return buildOverwhelmedCat(stageKey);
  }
  const layout = STAGES[stageKey];
  const size = layout.size;
  const { cx, footY, torsoY, headOffsetY } = rigPositions(layout, size);
  const headY = torsoY + headOffsetY;
  // Pet's on-screen window is capped short (utils/pet-moment.ts) to read as an obvious quick
  // reaction, not a lingering one — a shorter loop (like stress's) means it reliably finishes
  // its lean-in/lean-out before the presentation cuts back to normal, instead of always being
  // caught mid-motion.
  const frames = state === 'stress' || state === 'pet' ? 48 : 96;
  const motion = motionFor(state, frames, layout);
  const headPose = headLayerTransform(motion, cx, headY);
  const bodyTransform = {
    p: motion.bodyP ? offsetPos(motion.bodyP, cx, torsoY) : staticValue([cx, torsoY, 0]),
    s: motion.body,
    r: motion.bodyR ?? staticValue(0),
  };
  const shadowLayer = shapeLayer(
    'Shadow',
    1,
    { p: staticValue([cx, footY + 6, 0]) },
    [
      group(
        'ShadowOval',
        [ellipse(size * 0.36, size * 0.075), fill(COLORS.shadow, 32)],
        { p: staticValue([0, 0]), s: staticValue([100, 55]) },
      ),
    ],
    frames,
  );

  const playingBodyOptions =
    state === 'playing'
      ? {
          tailOptions: {
            lengthScale: 1.4,
            thickScale: 2.4,
            whipTip: true,
          },
          batPaws: true,
        }
      : state === 'starving'
        ? {
            torsoOptions: { thin: true },
            tailOptions: { lengthScale: 0.7, thickScale: 1.5, pale: true },
          }
        : {};

  const pale = state === 'starving';
  const babyEyes = stageKey === 'newborn';
  const headShapes = [
    group('Face', buildFace(layout, motion.face, motion.blink, frames, { pale, babyEyes }), { p: staticValue([0, 0]) }),
    group('HeadShell', buildHeadShell(layout, { pale }), { p: staticValue([0, 0]) }),
  ];

  // dotLottie: first shape group in the layer draws in front (Face before HeadShell).
  const layers = [
    shapeLayer(
      'Head',
      3,
      headPose,
      headShapes,
      frames,
    ),
    shapeLayer(
      'Body',
      2,
      bodyTransform,
      [buildBodyRig(layout, motion, playingBodyOptions)],
      frames,
    ),
    shadowLayer,
  ];

  if (state === 'feeding') {
    layers[0].ind = 4;
    layers.splice(
      2,
      0,
      shapeLayer(
        'Bowl',
        3,
        // Clearly below and separate from the shadow (footY + 6), not stacked right on
        // top of it where the two used to blend into one purple smudge.
        { p: staticValue([cx, footY + 20, 0]) },
        [buildFoodBowl(layout)],
        frames,
      ),
    );
  }

  return {
    v: '5.7.4',
    fr: 30,
    ip: 0,
    op: frames,
    w: size,
    h: size,
    nm: `tabby-${stageKey}-${state}`,
    ddd: 0,
    assets: [],
    layers,
  };
}

mkdirSync(OUT_DIR, { recursive: true });

let count = 0;
for (const stage of Object.keys(STAGES)) {
  const stageDir = join(OUT_DIR, stage);
  mkdirSync(stageDir, { recursive: true });
  for (const state of STATES) {
    writeFileSync(join(stageDir, `${state}.json`), JSON.stringify(buildCat(stage, state)));
    count += 1;
  }
  writeFileSync(join(stageDir, 'peek_duck.json'), JSON.stringify(buildPeekDuckCat(stage)));
  count += 1;
}

console.log(`[generate-scaffold-animations] wrote ${count} Lottie JSON files to lottie-json/`);
