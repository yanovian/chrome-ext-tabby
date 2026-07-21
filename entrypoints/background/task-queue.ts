/** Every browser event listener below enqueues its work here instead of running inline, so
 * two events landing close together (e.g. a tab switch during the minute-tick alarm) can't
 * run concurrently and interleave their reads/writes of the shared active-tab state. */
let taskQueue = Promise.resolve();

export function enqueueTask(task: () => Promise<void>): void {
  taskQueue = taskQueue.then(task).catch((error) => {
    console.error('[Tabby]', error);
  });
}
