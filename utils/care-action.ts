/** Resolve which page URL a care action applies to (menu dismiss, feed, etc.). */
export function resolveCareActionPageUrl(
  messageUrl: string | undefined,
  senderTabUrl: string | undefined,
  activeSnapshotUrl: string | undefined,
): string | undefined {
  return messageUrl ?? senderTabUrl ?? activeSnapshotUrl ?? undefined;
}
