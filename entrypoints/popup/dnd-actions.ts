import {
  requestCancelDoNotDisturb,
  requestDoNotDisturbStatus,
  requestSetDoNotDisturb,
} from '../../utils/runtime-client';
import { t } from '../../utils/i18n';
import type { DoNotDisturbDuration } from '../../utils/types';
import { dndActivePanel, dndInactivePanel, dndStatusText } from './dom-refs';
import { updatePreviewCat } from './preview-cat';
import { showStatus } from './status';
// refreshOverlayButtons (overlay-actions.ts) also calls back into refreshDoNotDisturbSection
// here — both sides are function declarations only invoked from event handlers, never at
// module-init time, so the cycle never actually runs during either module's own evaluation.
import { refreshOverlayButtons } from './overlay-actions';

export async function refreshDoNotDisturbSection(): Promise<void> {
  const status = await requestDoNotDisturbStatus();
  if (!status.active || !status.summary) {
    dndActivePanel.hidden = true;
    dndInactivePanel.hidden = false;
    dndStatusText.textContent = '';
    return;
  }

  dndActivePanel.hidden = false;
  dndInactivePanel.hidden = true;
  dndStatusText.textContent = status.summary;
}

export async function cancelDoNotDisturb(): Promise<void> {
  const next = await requestCancelDoNotDisturb();
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
  showStatus(t('settings.dndOff'));
}

export async function enableDoNotDisturb(duration: DoNotDisturbDuration): Promise<void> {
  const next = await requestSetDoNotDisturb(duration);
  await updatePreviewCat(next.sprite);
  await refreshDoNotDisturbSection();
  await refreshOverlayButtons();
  showStatus(t('settings.dndOn'));
}
