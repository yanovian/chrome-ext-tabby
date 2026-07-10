import { describe, expect, it } from 'vitest';
import { companionAnimationPath, allCompanionAnimationPaths } from '../utils/companion-animation';

describe('companion GIF paths', () => {
  it('uses gif assets for every mood clip', () => {
    expect(companionAnimationPath('adult', 'happy')).toBe('gif/adult/happy.gif');
    expect(allCompanionAnimationPaths().every((path) => path.endsWith('.gif'))).toBe(true);
    expect(allCompanionAnimationPaths().every((path) => path.startsWith('gif/'))).toBe(true);
  });
});
