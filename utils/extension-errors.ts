const EXTENSION_UNAVAILABLE = [
  'Extension context invalidated',
  'Receiving end does not exist',
  'Could not establish connection',
  'message port closed',
] as const;

export function isExtensionUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return EXTENSION_UNAVAILABLE.some((part) => message.includes(part));
}

/** Ignore expected MV3 races; log surprises in dev only. */
export function ignoreIfExtensionUnavailable(context: string, error: unknown): void {
  if (!isExtensionUnavailable(error) && import.meta.env.DEV) {
    console.debug(`[Tabby] ${context}`, error);
  }
}
