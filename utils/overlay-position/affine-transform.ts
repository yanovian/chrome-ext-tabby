import type { PeekEdge } from '../ambient-presence';
import { peekCatSurfaceLayout, peekRootDimensions } from './peek-geometry';

type Point = readonly [number, number];

type Affine = {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
};

function affineIdentity(): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function multiplyAffine(left: Affine, right: Affine): Affine {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
}

function translateAffine(x: number, y: number): Affine {
  return { a: 1, b: 0, c: 0, d: 1, e: x, f: y };
}

function rotateAffine(deg: number): Affine {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 };
}

function applyAffine(matrix: Affine, x: number, y: number): Point {
  return [
    matrix.a * x + matrix.c * y + matrix.e,
    matrix.b * x + matrix.d * y + matrix.f,
  ];
}

function buildSurfaceTransformMatrix(transform: string): Affine {
  let matrix = affineIdentity();
  for (const step of parseTransformSteps(transform)) {
    if (step.kind === 'translateX') {
      matrix = multiplyAffine(matrix, translateAffine(step.value, 0));
      continue;
    }
    if (step.kind === 'translateY') {
      matrix = multiplyAffine(matrix, translateAffine(0, step.value));
      continue;
    }
    if (step.kind === 'rotate') {
      matrix = multiplyAffine(matrix, rotateAffine(step.deg));
    }
  }
  return matrix;
}

function transformPoint(
  point: Point,
  width: number,
  height: number,
  transform: string,
  transformOrigin: string,
): Point {
  const [ox, oy] = parseTransformOrigin(transformOrigin, width, height);
  const surfaceMatrix = buildSurfaceTransformMatrix(transform);
  const matrix = multiplyAffine(
    translateAffine(ox, oy),
    multiplyAffine(surfaceMatrix, translateAffine(-ox, -oy)),
  );
  return applyAffine(matrix, point[0], point[1]);
}

function parseTransformSteps(
  transform: string,
): Array<{ kind: 'translateX' | 'translateY'; value: number } | { kind: 'rotate'; deg: number }> {
  const steps: Array<
    { kind: 'translateX' | 'translateY'; value: number } | { kind: 'rotate'; deg: number }
  > = [];
  const pattern = /(translateX\(([-\d.]+)px\)|translateY\(([-\d.]+)px\)|rotate\((-?\d+)deg\))/g;
  for (const match of transform.matchAll(pattern)) {
    const token = match[1] ?? '';
    if (token.startsWith('translateX')) {
      steps.push({ kind: 'translateX', value: Number(match[2]) });
      continue;
    }
    if (token.startsWith('translateY')) {
      steps.push({ kind: 'translateY', value: Number(match[3]) });
      continue;
    }
    if (token.startsWith('rotate')) {
      steps.push({ kind: 'rotate', deg: Number(match[4]) });
    }
  }
  return steps;
}

function parseTransformOrigin(
  transformOrigin: string,
  width: number,
  height: number,
): Point {
  const [xToken, yToken] = transformOrigin.trim().split(/\s+/);
  const parseAxis = (token: string, size: number): number => {
    if (token.endsWith('%')) {
      return (Number(token.slice(0, -1)) / 100) * size;
    }
    if (token.endsWith('px')) {
      return Number(token.slice(0, -2));
    }
    if (token === 'left' || token === 'top') {
      return 0;
    }
    if (token === 'right' || token === 'bottom') {
      return size;
    }
    if (token === 'center') {
      return size / 2;
    }
    return Number(token);
  };
  return [parseAxis(xToken ?? '0', width), parseAxis(yToken ?? '0', height)];
}

/** Whether the rotated sprite fills the peek clip window enough to read as a peek. */
export function peekSurfaceFillsClipWindow(edge: PeekEdge, catSize: number): boolean {
  const layout = peekCatSurfaceLayout(edge, catSize);
  const overlap = measurePeekSurfaceOverlap(edge, layout, catSize);
  if (edge === 'bottom') {
    return overlap.coverage > 0.25;
  }
  // Side peeks must fill the FULL container height (not just half of it):
  // the whole clip window is meant to be covered by sprite, same as bottom.
  const { width, height } = peekRootDimensions(edge, catSize);
  return (
    overlap.overlapWidth >= width * 0.85 &&
    overlap.overlapHeight >= height * 0.85 &&
    layout.transform.includes('rotate')
  );
}

/** Visible overlap bounds inside the peek clip window (for tests). */
export function measurePeekSurfaceOverlap(
  edge: PeekEdge,
  layout: Pick<ReturnType<typeof peekCatSurfaceLayout>, 'transform' | 'transformOrigin'>,
  catSize = 192,
): {
  overlapWidth: number;
  overlapHeight: number;
  coverage: number;
} {
  const { width, height } = peekRootDimensions(edge, catSize);
  const step = Math.max(8, Math.round(catSize / 12));
  let inside = 0;
  let total = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let y = 0; y <= catSize; y += step) {
    for (let x = 0; x <= catSize; x += step) {
      const [tx, ty] = transformPoint(
        [x, y],
        catSize,
        catSize,
        layout.transform,
        layout.transformOrigin,
      );
      total += 1;
      if (tx >= 0 && tx <= width && ty >= 0 && ty <= height) {
        inside += 1;
        minX = Math.min(minX, tx);
        maxX = Math.max(maxX, tx);
        minY = Math.min(minY, ty);
        maxY = Math.max(maxY, ty);
      }
    }
  }
  const overlapWidth = Number.isFinite(minX) ? Math.max(0, maxX - minX) : 0;
  const overlapHeight = Number.isFinite(minY) ? Math.max(0, maxY - minY) : 0;
  return {
    overlapWidth,
    overlapHeight,
    coverage: total > 0 ? inside / total : 0,
  };
}
