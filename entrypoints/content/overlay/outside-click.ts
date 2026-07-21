/** A tap anywhere outside the overlay root closes the menu or dismisses the speech bubble.
 * Bound lazily (deferred by a tick) so the tap that opened the menu doesn't immediately close
 * it, and rebound fresh each time so there's never more than one listener attached. */
export class OutsideClickWatcher {
  private listener: ((event: Event) => void) | null = null;

  bind(getRoot: () => HTMLElement | null, onOutsideTap: () => void): void {
    this.unbind();
    this.listener = (event: Event) => {
      const root = getRoot();
      if (!root || !(event.target instanceof Node)) {
        return;
      }
      if (!root.contains(event.target)) {
        onOutsideTap();
      }
    };
    window.setTimeout(() => {
      if (this.listener) {
        document.addEventListener('pointerdown', this.listener, true);
      }
    }, 0);
  }

  unbind(): void {
    if (this.listener) {
      document.removeEventListener('pointerdown', this.listener, true);
      this.listener = null;
    }
  }
}
