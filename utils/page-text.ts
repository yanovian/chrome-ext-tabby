/** Extract a readable text snippet from the current page for local classification. */
export function extractPageTextSnippet(maxChars: number): string {
  const bodyText = document.body?.innerText ?? '';
  const normalized = bodyText
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars);
  return normalized;
}
