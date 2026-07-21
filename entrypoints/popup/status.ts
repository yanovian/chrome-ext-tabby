import { statusEl } from './dom-refs';

export function showStatus(message: string): void {
  statusEl.textContent = message;
  setTimeout(() => {
    if (statusEl.textContent === message) {
      statusEl.textContent = '';
    }
  }, 2000);
}
