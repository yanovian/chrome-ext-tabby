import { describe, expect, it } from 'vitest';
import { isExtensionUnavailable } from '../utils/extension-errors';

describe('isExtensionUnavailable', () => {
  it('matches common MV3 messaging failures', () => {
    expect(
      isExtensionUnavailable(new Error('Could not establish connection. Receiving end does not exist.')),
    ).toBe(true);
    expect(isExtensionUnavailable(new Error('Extension context invalidated.'))).toBe(true);
  });

  it('does not treat other errors as unavailable', () => {
    expect(isExtensionUnavailable(new Error('Unexpected handler failure'))).toBe(false);
  });
});
