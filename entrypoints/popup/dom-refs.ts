export const localeSelect = document.getElementById('locale-select') as HTMLSelectElement;

export const fields = {
  quietStart: document.getElementById('quiet-start') as HTMLInputElement,
  quietEnd: document.getElementById('quiet-end') as HTMLInputElement,
  maxAppearances: document.getElementById('max-appearances') as HTMLInputElement,
  cooldownMinutes: document.getElementById('cooldown-minutes') as HTMLInputElement,
  devModeEnabled: document.getElementById('dev-mode-enabled') as HTMLInputElement,
  devMaxAppearances: document.getElementById('dev-max-appearances') as HTMLInputElement,
  devCooldownMinutes: document.getElementById('dev-cooldown-minutes') as HTMLInputElement,
  devStatMultiplier: document.getElementById('dev-stat-multiplier') as HTMLInputElement,
  devMinTabMs: document.getElementById('dev-min-tab-ms') as HTMLInputElement,
  devForceLifeStage: document.getElementById('dev-force-life-stage') as HTMLSelectElement,
  devForceMood: document.getElementById('dev-force-mood') as HTMLSelectElement,
};

export const temperFields = {
  panel: document.getElementById('dev-temper-panel') as HTMLElement,
  inferred: document.getElementById('dev-temper-inferred') as HTMLParagraphElement,
  scenario: document.getElementById('dev-temper-scenario') as HTMLSelectElement,
  drainingRow: document.getElementById('dev-draining-row') as HTMLDivElement,
  drainingMs: document.getElementById('dev-simulated-draining-ms') as HTMLInputElement,
  drainingLabel: document.getElementById('dev-draining-label') as HTMLElement,
  recoveryAwayRow: document.getElementById('dev-recovery-away-row') as HTMLDivElement,
  recoveryAwayMs: document.getElementById('dev-simulated-recovery-away-ms') as HTMLInputElement,
  recoveryAwayLabel: document.getElementById('dev-recovery-away-label') as HTMLElement,
};

export const statusEl = document.getElementById('status') as HTMLParagraphElement;
export const previewHost = document.getElementById('preview-cat-host') as HTMLDivElement;
export const devSettingsSection = document.getElementById('dev-settings-section') as HTMLElement;
export const devBuildHint = document.getElementById('dev-build-hint') as HTMLParagraphElement;
export const forceTickButton = document.getElementById('force-tick') as HTMLButtonElement;
export const forceTickHint = document.getElementById('force-tick-hint') as HTMLParagraphElement;
export const devForceAppearButton = document.getElementById('dev-force-appear') as HTMLButtonElement;
export const devForceHideButton = document.getElementById('dev-force-hide') as HTMLButtonElement;
export const devPresenceHint = document.getElementById('dev-presence-hint') as HTMLParagraphElement;
export const resetIntroButton = document.getElementById('reset-intro') as HTMLButtonElement;
export const showAllButton = document.getElementById('show-all-btn') as HTMLButtonElement;
export const hideAllButton = document.getElementById('hide-all-btn') as HTMLButtonElement;
export const showPageButton = document.getElementById('show-page-btn') as HTMLButtonElement;
export const hidePageButton = document.getElementById('hide-page-btn') as HTMLButtonElement;
export const pageOverlayHint = document.getElementById('page-overlay-hint') as HTMLParagraphElement;
export const dndActivePanel = document.getElementById('dnd-active-panel') as HTMLDivElement;
export const dndInactivePanel = document.getElementById('dnd-inactive-panel') as HTMLDivElement;
export const dndStatusText = document.getElementById('dnd-status-text') as HTMLParagraphElement;
export const cancelDndButton = document.getElementById('cancel-dnd-btn') as HTMLButtonElement;
export const setDnd30Button = document.getElementById('set-dnd-30-btn') as HTMLButtonElement;
export const setDnd60Button = document.getElementById('set-dnd-60-btn') as HTMLButtonElement;
export const setDndTodayButton = document.getElementById('set-dnd-today-btn') as HTMLButtonElement;
