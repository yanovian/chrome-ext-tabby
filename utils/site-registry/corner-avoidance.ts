import { hostMatches, normalizeHostname } from './host-match';

/**
 * Every spot ambient peek can place her, short-form. Bottom-edge placements hug a
 * side (`bl`/`br`); side-edge placements are rotated and sit low or high (`lb`/`lt`
 * on the left, `rb`/`rt` on the right). `bl` and `lb` both read as "bottom-left" but
 * are genuinely different placements (peeking up from the bottom vs. out from the
 * side) — a small corner widget may only block one, a full-height side menu blocks
 * both plus the high one on that side.
 */
export type PeekSlot = 'bl' | 'br' | 'lb' | 'lt' | 'rb' | 'rt';

/** Group shortcuts for a registry entry: every slot touching that side/edge. */
type AvoidGroup = 'l' | 'r' | 'b';
export type AvoidToken = PeekSlot | AvoidGroup;

const GROUP_SLOTS: Readonly<Record<AvoidGroup, readonly PeekSlot[]>> = {
  b: ['bl', 'br'],
  l: ['bl', 'lb', 'lt'],
  r: ['br', 'rb', 'rt'],
};

function isGroup(token: AvoidToken): token is AvoidGroup {
  return token === 'l' || token === 'r' || token === 'b';
}

/**
 * Hosts with their own fixed-position chat launcher, menu, or modal, so ambient
 * peek never lands on top of it. One row per site, using short slot codes or the
 * `l`/`r`/`b` group shortcut for something that runs the full side/edge. Scales to
 * hundreds of entries — this is a flat lookup table, not logic.
 */
const BLOCKED_SLOTS: Readonly<Record<string, readonly AvoidToken[]>> = {
  'linkedin.com': ['br', 'rb'], // chat launcher, bottom-right corner
  'pooyan.info': ['br', 'rb'], // cookie consent modal, bottom-right corner
  'my.interserver.net': ['l'], // nav menu runs the full left side
  'upwork.com': ['l'], // nav menu runs the full left side
  'facebook.com': ['l', 'br', 'rb'], // nav menu on the left, chat bottom-right corner
  'canva.com': ['l'], // nav menu runs the full left side
  'mail.google.com': ['l'], // Gmail's left menu/chat rail

  // Full-height left sidebar is the whole layout, not a widget on top of the page —
  // same treatment as Gmail/Canva above.
  'drive.google.com': ['l'],
  'calendar.google.com': ['l'],
  'notion.so': ['l'],
  'slack.com': ['l'], // workspace runs at app.slack.com, a subdomain of this
  'discord.com': ['l'], // server rail + channel list
  'web.whatsapp.com': ['l'], // chat list panel
  'twitter.com': ['l'],
  'x.com': ['l'],
  'instagram.com': ['l'],
  'dropbox.com': ['l'],
  'airtable.com': ['l'],
  'asana.com': ['l'],
  'monday.com': ['l'],
  'figma.com': ['l'], // layers/file panel in the editor
  'atlassian.net': ['l'], // Jira/Confluence on *.atlassian.net
};

const NO_BLOCKED_SLOTS: ReadonlySet<PeekSlot> = new Set();

/** Peek slots a host's own UI occupies for the given hostname, if any. */
export function blockedCornersForHost(hostname: string | undefined): ReadonlySet<PeekSlot> {
  if (!hostname) {
    return NO_BLOCKED_SLOTS;
  }
  const normalizedHost = normalizeHostname(hostname);
  for (const [host, tokens] of Object.entries(BLOCKED_SLOTS)) {
    if (hostMatches(normalizedHost, host)) {
      return new Set(tokens.flatMap((token) => (isGroup(token) ? GROUP_SLOTS[token] : [token])));
    }
  }
  return NO_BLOCKED_SLOTS;
}
