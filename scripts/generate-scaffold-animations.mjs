/**
 * Standing Tabby Lottie scaffolds (3 stages × 8 states).
 * One connected orange silhouette: chunky head, neck, torso, legs, swaying tail, blink.
 * Run: node scripts/generate-scaffold-animations.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'animations');

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

const STAGES = {
  newborn: {
    size: 140,
    headR: 34,
    bodyW: 38,
    bodyH: 30,
    legH: 8,
    legW: 9,
    tailLen: 26,
    stroke: 3.2,
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

const STATES = ['idle', 'happy', 'curious', 'eat', 'stress', 'sleep', 'groom', 'play'];

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

function motionFor(state, frames) {
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
        tail: staticValue([8]),
        headR: loopKeys(frames, [8, 20, 8]),
        headP: loopKeys(frames, [
          [0, 0, 0],
          [4, 12, 0],
          [0, 0, 0],
        ]),
        face: 'open',
        blink: false,
      };
    case 'stress':
      return {
        body: staticValue([100, 100, 100]),
        tail: loopKeys(frames, [-20, 18, -16, 14, 0]),
        headR: loopKeys(frames, [-8, 8, -6, 6, 0]),
        headP: staticValue([0, 0, 0]),
        face: 'worry',
        blink: false,
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

function buildTorso(layout) {
  const o = COLORS.outline;
  const w = layout.stroke;
  const bw = layout.bodyW;
  const bh = layout.bodyH;

  const paw = (x) =>
    group(
      'Paw',
      painted(ellipse(layout.legW * 1.2, layout.legH * 0.85), COLORS.bodyDark, o, w * 0.65),
      { p: staticValue([x, bh * 0.34]) },
    );

  return group(
    'Torso',
    [
      ...painted(ellipse(bw * 1.08, bh * 1.05), COLORS.body, o, w),
      ...painted(ellipse(bw * 0.55, bh * 0.45), COLORS.belly, o, w * 0.25),
      group(
        'FlankPatch',
        painted(ellipse(bw * 0.22, bh * 0.18), COLORS.bodyDark, o, w * 0.2),
        { p: staticValue([bw * 0.28, -bh * 0.05]) },
      ),
      buildCollarBand(layout),
      paw(-bw * 0.2),
      paw(bw * 0.2),
    ],
    { p: staticValue([0, 0]) },
  );
}

function buildCollarBand(layout) {
  const o = COLORS.outline;
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

function buildHeadShell(layout) {
  const o = COLORS.outline;
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
          COLORS.body,
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
    ...painted(ellipse(r * 2, r * 2), COLORS.body, o, w),
    ear('L'),
    ear('R'),
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
  ];
}

function whiskerOnCheek(o, w, r, side) {
  const cheekY = r * 0.34;
  const startX = side * r * 0.54;
  const endX = side * r * 0.96;
  return group(
    `Whisker${side}`,
    [path([[startX, cheekY], [endX, cheekY - r * 0.02]]), stroke(o, w * 0.72)],
    { p: staticValue([0, 0]) },
  );
}

function kawaiiMouth(face, y, o, w) {
  if (face === 'open') {
    return group('Mouth', painted(ellipse(6, 5), COLORS.pink, o, w * 0.4), { p: staticValue([0, y]) });
  }
  if (face === 'worry') {
    return group(
      'Mouth',
      [path([[-4, y + 2], [0, y], [4, y + 2]]), stroke(o, w * 0.85)],
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
  return group(
    'Mouth',
    [
      path([
        [-4, y],
        [-1.5, y + 3],
        [0, y + 1],
        [1.5, y + 3],
        [4, y],
      ]),
      stroke(o, w * 0.9),
    ],
    { p: staticValue([0, 0]) },
  );
}

function buildFace(layout, face, blink, frames) {
  const o = COLORS.outline;
  const w = layout.stroke;
  const r = layout.headR;
  const wide = face === 'wide';
  const eyeY = r * 0.06;
  const gap = r * 0.3;
  const eyeW = (wide ? 0.56 : 0.5) * r;
  const eyeH = (wide ? 0.64 : 0.58) * r;
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

    return group(
      `Eye${side}`,
      [
        ...painted(ellipse(eyeW, eyeH), COLORS.eye, o, w * 0.45),
        ...painted(ellipse(eyeW * 0.78, eyeH * 0.82), COLORS.pupil, COLORS.pupil, 0),
        group(
          'ShineBig',
          painted(ellipse(eyeW * 0.18, eyeH * 0.2), COLORS.white, COLORS.white, 0),
          { p: staticValue([-eyeW * 0.16, -eyeH * 0.2]) },
        ),
        group(
          'ShineSmall',
          painted(ellipse(eyeW * 0.08, eyeH * 0.09), COLORS.white, COLORS.white, 0),
          { p: staticValue([eyeW * 0.14, eyeH * 0.08]) },
        ),
      ],
      {
        p: staticValue([x, eyeY]),
        s: blink ? blinkScale(frames) : staticValue([100, 100, 100]),
      },
    );
  };

  return [eye('L'), eye('R'), kawaiiMouth(face, mouthY, o, w)];
}

function buildBodyRig(layout, motion) {
  const tail = buildTail(layout);

  return group(
    'BodyRig',
    [
      group(
        'Tail',
        [
          tail.base,
          group('TailTipRig', [tail.tip], {
            p: staticValue([0, 0]),
            a: staticValue([tail.baseLen * 0.55, -tail.baseLen * 0.45]),
            r: motion.tail,
          }),
        ],
        {
          p: staticValue([-layout.bodyW * 0.34, -layout.bodyH * 0.02]),
          r: staticValue(0),
        },
      ),
      buildTorso(layout),
    ],
    { p: staticValue([0, 0]) },
  );
}

function buildTail(layout) {
  const len = layout.tailLen;
  const thick = layout.stroke * 2.2;
  const baseLen = len * 0.45;
  const tipLen = len - baseLen;

  const base = group(
    'TailBase',
    [
      path(
        [
          [0, 0],
          [baseLen * 0.2, -baseLen * 0.08],
          [baseLen * 0.45, -baseLen * 0.22],
          [baseLen * 0.55, -baseLen * 0.45],
        ],
        false,
      ),
      stroke(COLORS.bodyDark, thick),
      path(
        [
          [0, 0],
          [baseLen * 0.18, -baseLen * 0.07],
          [baseLen * 0.4, -baseLen * 0.18],
          [baseLen * 0.5, -baseLen * 0.38],
        ],
        false,
      ),
      stroke(COLORS.body, thick * 0.8),
    ],
    { p: staticValue([0, 0]), r: staticValue(58) },
  );

  const tip = group(
    'TailTip',
    [
      path(
        [
          [0, 0],
          [tipLen * 0.15, -tipLen * 0.12],
          [tipLen * 0.22, -tipLen * 0.28],
          [tipLen * 0.12, -tipLen * 0.42],
        ],
        false,
      ),
      stroke(COLORS.bodyDark, thick),
      path(
        [
          [0, 0],
          [tipLen * 0.13, -tipLen * 0.1],
          [tipLen * 0.19, -tipLen * 0.24],
          [tipLen * 0.1, -tipLen * 0.36],
        ],
        false,
      ),
      stroke(COLORS.body, thick * 0.8),
    ],
    { p: staticValue([baseLen * 0.55, -baseLen * 0.45]), r: staticValue(0) },
  );

  return { baseLen, base, tip };
}

function buildCat(stageKey, state) {
  const layout = STAGES[stageKey];
  const size = layout.size;
  const { cx, footY, torsoY, headOffsetY } = rigPositions(layout, size);
  const headY = torsoY + headOffsetY;
  const frames = state === 'stress' ? 48 : 96;
  const motion = motionFor(state, frames);
  const headPose = headLayerTransform(motion, cx, headY);

  // dotLottie: higher `ind` draws in front; Face shape before HeadShell within the Head layer.
  const layers = [
    shapeLayer(
      'Head',
      3,
      headPose,
      [
        group('Face', buildFace(layout, motion.face, motion.blink, frames), { p: staticValue([0, 0]) }),
        group('HeadShell', buildHeadShell(layout), { p: staticValue([0, 0]) }),
      ],
      frames,
    ),
    shapeLayer(
      'Body',
      2,
      {
        p: staticValue([cx, torsoY, 0]),
        s: motion.body,
      },
      [buildBodyRig(layout, motion)],
      frames,
    ),
    shapeLayer(
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
    ),
  ];

  if (state === 'eat') {
    layers[0].ind = 4;
    layers.splice(
      2,
      0,
      shapeLayer(
        'Bowl',
        3,
        { p: staticValue([cx, footY + 8, 0]) },
        [
          group(
            'BowlShape',
            [
              ...painted(ellipse(34, 12), COLORS.collar, COLORS.outline, layout.stroke * 0.65),
              ...painted(ellipse(22, 6), COLORS.belly, COLORS.outline, layout.stroke * 0.45),
            ],
            { p: staticValue([0, 0]) },
          ),
        ],
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
}

console.log(`[generate-scaffold-animations] wrote ${count} connected orange Tabby animations`);
