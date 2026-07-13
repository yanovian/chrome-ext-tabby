/** Layout viewport box in CSS pixels (handles mobile browser chrome). */
export interface ViewportBox {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
}

export function readViewportBox(): ViewportBox {
  if (typeof window === 'undefined') {
    return { width: 0, height: 0, offsetX: 0, offsetY: 0 };
  }

  const visual = window.visualViewport;
  return {
    width: visual?.width ?? window.innerWidth,
    height: visual?.height ?? window.innerHeight,
    offsetX: visual?.offsetLeft ?? 0,
    offsetY: visual?.offsetTop ?? 0,
  };
}
