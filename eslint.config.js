import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Thresholds are calibrated against the whole codebase as it stands today (not just the
      // files this refactor touched), so the rule is meaningful without demanding an unrelated
      // audit of pre-existing logic (e.g. utils/emotional-triggers.ts's trigger-matching, which
      // is inherently a long chain of independent conditions). They're still tight enough to
      // fail on real runaway growth in new code.
      'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': [
        'error',
        { max: 220, skipBlankLines: true, skipComments: true, IIFEs: true },
      ],
      complexity: ['error', 35],
      'max-depth': ['error', 4],
      'max-params': ['error', 8],
    },
  },
  {
    // TabbyOverlay is the content-script coordinator wiring together its 8 collaborator
    // modules (positioner, transitions, intro menu, renderer, sync, presentation-update,
    // outside-click, peek-state) plus lifecycle/render/mount/exit sequencing that all share
    // cross-cutting state (root, presentation). Splitting further would mean passing large
    // callback bags into new files rather than real separation — see the collaborator
    // modules under entrypoints/content/overlay/ for where the actual logic lives.
    files: ['entrypoints/content/tabby-overlay.ts'],
    rules: {
      'max-lines': ['error', { max: 650, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Long describe/it suites aren't god-objects, they're just many independent cases.
    files: ['tests/**/*.test.ts', 'e2e/**/*.spec.ts'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
    },
  },
  {
    // Node build/codegen tooling (Lottie-to-GIF pipeline, scaffold generation), not extension
    // runtime code — a different category from "avoid god objects in the extension," so these
    // size/complexity rules don't apply to it.
    files: ['**/*.mjs'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      complexity: 'off',
      'max-params': 'off',
    },
  },
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      'website/**',
      'public/ort/**',
      'public/models/**',
      'docker/lottie-gif/**',
    ],
  },
);
