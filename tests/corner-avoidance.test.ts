import { describe, expect, it } from 'vitest';
import { blockedCornersForHost } from '../utils/site-registry/corner-avoidance';

describe('blockedCornersForHost', () => {
  it('blocks both slots at a corner widget (chat launcher)', () => {
    // 'br' = bottom edge hugging right, 'rb' = right edge hugging low — a small
    // corner widget realistically overlaps both.
    expect(blockedCornersForHost('linkedin.com')).toEqual(new Set(['br', 'rb']));
  });

  it('matches subdomains of a registered host', () => {
    expect(blockedCornersForHost('mail.google.com')).toEqual(new Set(['bl', 'lb', 'lt']));
  });

  it('strips a leading www. before matching', () => {
    expect(blockedCornersForHost('www.upwork.com')).toEqual(new Set(['bl', 'lb', 'lt']));
  });

  it('expands the l/r/b group shortcut to every slot on that side', () => {
    // my.interserver.net's nav menu runs the full left side (top to bottom):
    // bottom-hugging-left, left-edge-low, and left-edge-high all overlap it.
    expect(blockedCornersForHost('my.interserver.net')).toEqual(new Set(['bl', 'lb', 'lt']));
  });

  it('combines a group shortcut with individual slots', () => {
    // facebook.com: left nav (full side) plus a chat launcher at the bottom-right corner.
    expect(blockedCornersForHost('facebook.com')).toEqual(
      new Set(['bl', 'lb', 'lt', 'br', 'rb']),
    );
  });

  it('matches an arbitrary subdomain, not just www., for wildcard-style hosts', () => {
    // A Slack workspace lives at <workspace>.slack.com, and a Jira/Confluence site at
    // <org>.atlassian.net — hostMatches' subdomain-suffix check covers these for free.
    expect(blockedCornersForHost('my-team.slack.com')).toEqual(new Set(['bl', 'lb', 'lt']));
    expect(blockedCornersForHost('acme-corp.atlassian.net')).toEqual(new Set(['bl', 'lb', 'lt']));
  });

  it('returns an empty set for an unknown host', () => {
    expect(blockedCornersForHost('example.com')).toEqual(new Set());
  });

  it('returns an empty set when there is no hostname', () => {
    expect(blockedCornersForHost(undefined)).toEqual(new Set());
  });
});
