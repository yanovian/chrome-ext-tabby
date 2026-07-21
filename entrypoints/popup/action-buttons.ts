import { t } from '../../utils/i18n';
import { showStatus } from './status';
import { refreshDoNotDisturbSection } from './dnd-actions';
import { refreshOverlayButtons } from './overlay-actions';

let actionBusy = false;

export function bindActionButton(button: HTMLButtonElement, action: () => Promise<void>): void {
  button.addEventListener('click', () => {
    if (actionBusy) {
      return;
    }
    void (async () => {
      actionBusy = true;
      button.disabled = true;
      try {
        await action();
      } catch (error) {
        showStatus(error instanceof Error ? error.message : t('settings.unavailable'));
        await refreshDoNotDisturbSection();
        await refreshOverlayButtons();
      } finally {
        button.disabled = false;
        actionBusy = false;
      }
    })();
  });
}
