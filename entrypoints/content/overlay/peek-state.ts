import { isPeekPresentation, resolveEffectivePeekPlacement } from '../../../utils/presentation';
import type { PeekCorner, PeekEdge } from '../../../utils/ambient-presence';
import type { CatPresentation } from '../../../utils/types';

/** Pure derivations of "is she peeking, and from where" from the current presentation alone
 * — shared by the overlay coordinator and its renderer/positioner collaborators so none of
 * them need to duplicate this logic or reach into each other just to ask it. */

export function isPeeking(presentation: CatPresentation | null): boolean {
  return presentation ? isPeekPresentation(presentation) : false;
}

export function peekPlacement(
  presentation: CatPresentation | null,
): { edge: PeekEdge; inset: number; corner: PeekCorner } {
  if (!presentation || !isPeeking(presentation)) {
    return { edge: 'bottom', inset: 16, corner: 'left' };
  }
  return resolveEffectivePeekPlacement(presentation);
}
