# Mood system

How Tabby's visible mood is computed, from raw browsing activity to the label shown on
screen. This is the detailed reference; `architecture.md` only lists the involved
functions.

Two independent layers feed the final mood:

1. **Vitals**: four 0-100 stats (`hunger`, `happiness`, `stress`, `energy`) that drift
   continuously and respond to care actions.
2. **Draining session tracker**: a separate wall-clock state machine that overrides the
   vitals-derived mood during and after a long stretch on social/news sites.

## Vitals (`utils/cat-sim.ts`, `CatVitals` in `utils/types.ts`)

All four stats are clamped to `0-100`. Starting values (`createInitialCat`):
`hunger: 35, happiness: 70, stress: 15, energy: 80`.

### What changes vitals

| Source | Function | Nourishing page | Draining page | Neutral page |
|--------|----------|------------------|----------------|--------------|
| Active dwell, per minute | `applyBrowsingToVitals` | hunger -8, happiness +6, stress -4, energy -2 | stress +10, happiness -5, energy -4, hunger +3 | hunger +2, energy -1 |
| Landing on a new page (fixed bump) | `applyVisitToVitals` | hunger -1, happiness +1, stress -1 | stress +1, happiness -1 | hunger +1 |

Both are scaled by `statMultiplier` from settings (dev mode runs faster).

### Passive drift, every minute (`applyMinuteTick`)

- `hunger += 0.4 * hungerRateMultiplier(hour)` (mealtime hours rise faster, quiet hours
  almost flat, see `utils/mood-grace.ts`)
- `stress -= 0.2`, plus another `-0.5` if the user is idle
- `energy += 1.5` if idle, else `-0.3`
- `happiness += 0.2` while `hunger < 25 && stress < 40`
- `happiness -= 0.4` while `stress > 70`

### Care actions (`applyCareAction`)

| Action | Happiness | Stress | Hunger | Energy | Grace set |
|--------|-----------|--------|--------|--------|-----------|
| Pet | +12 | -8 | no change | no change | `happyUntil` |
| Treat | +8 | no change | → `SATIATED_HUNGER_LEVEL` (30) | no change | `happyUntil`, `satiatedUntil` |
| Play | +15 | -10 | no change | -10 | `happyUntil` |

### Ask / "what's up" (`applyAskInteraction`)

No vitals change. Only resets `happyUntil` (comfort from being checked on), same as pet
and play.

## Grace timers (`utils/mood-grace.ts`)

| Timer | Duration | Effect |
|-------|----------|--------|
| `happyMs` | 20 min | While active, `deriveMoodFromVitals` reads as `happy` regardless of the happiness/stress numbers |
| `satiatedMs` | 2 hr | While active, hunger-based moods (`hungry`/`starving`) are suppressed |
| `sleepDeferMs` | 30 min | Blocks the idle/quiet-hours `sleepy` mood right after a care action |

## Mood derivation from vitals (`deriveMoodFromVitals`, `utils/cat-sim.ts:186`)

Checked in this order, first match wins:

1. `hunger >= 88` (and not satiated) → `starving`
2. `hunger >= 65` (and not satiated) → `hungry`
3. Idle, or quiet hours with `energy < 45` (and not sleep-deferred) → `sleepy`
4. `stress >= 72` (`stressedVitalThreshold`, `utils/mood-timers.ts`) → `stressed`
5. Happy grace active → `happy`
6. `happiness >= 82 && stress < 35` → `happy`
7. `hunger < 40 && stress < 45 && happiness >= 60` → `curious`
8. `happiness >= 55 && stress < 55` → `content`
9. Otherwise → `content`

This is the "resting" mood from the numbers alone. The draining session tracker below
can still override what's actually displayed.

## Draining session tracker (`utils/draining-session.ts`)

Tracks continuous wall-clock time on `social`/`news` sites, independent of the `stress`
vital. State: `DrainingSessionState { kind, accumulatedMs, recoveryStartedAt,
recoveryAwayMs, pendingRecoveryNudge, ... }`.

**Active session** (still on a draining site, `recoveryStartedAt === null`):

- `accumulatedMs > 0` → sticky **`stressed`** (`isDrainingSessionStressed`)
- `accumulatedMs >= 60 min` (`DRAINING_SESSION_THRESHOLD_MS`) → sticky **`overwhelmed`**
  (`isDrainingSessionOverwhelmed`)
- Switching between `social` and `news`, or landing on a non-draining page, resets
  `accumulatedMs` to 0 (see `applyDrainingSessionPageChange`) unless the session had
  already crossed the overwhelmed threshold, in which case leaving starts recovery.

**Recovery** (left the site after an overwhelmed session, `recoveryStartedAt !== null`):

- `pendingRecoveryNudge: 'easing'` is queued immediately, shown once, then acknowledged
  (`acknowledgeRecoveryEasing`).
- `recoveryAwayMs` accrues while the user stays on non-draining pages.
- Once `recoveryAwayMs >= 60 s` (`RECOVERY_THANKS_THRESHOLD_MS`), `pendingRecoveryNudge`
  becomes `'thanks'` and the display mood flips to `happy`.
- Returning to a draining site mid-recovery cancels recovery and starts a fresh active
  session instead.

### Care-recovery credit (`applyCareRecoveryCredit`)

Petting or playing chips away at a stuck session instead of leaving it stuck until you
navigate away. Applied from `computeGeneralCareState` in `utils/cat/care-general.ts` for
the `pet` and `play` actions only:

| Action | While on the draining tab (`accumulatedMs`) | During recovery (`recoveryAwayMs`) |
|--------|----------------------------------------------|--------------------------------------|
| Pet | -5 min | +15 s |
| Play | -10 min | +30 s |

`accumulatedMs` floors at 0. This never clears a session in one tap by design (the
mechanic exists to nudge the user to actually step away), but repeated pets/plays, or a
single pet/play near the end of recovery, do finish it.

## Ask mood resolution (`resolveAskMood`, `utils/cat-interactions.ts:87`)

When the user taps "what's up" / the fussy-question button, checked in this order:

1. Hunger (`resolveHungryMood`): `starving`/`hungry` wins unless satiated, preferring the
   mood that was already on screen (`displayMood`) over a freshly recomputed one.
2. `displayMood === 'overwhelmed'` → stay `overwhelmed`.
3. `displayMood === 'stressed'` or freshly derived `stressed` → stay `stressed`.
4. Happy grace active (`cat.happyUntil > now`) → `happy`.
5. Freshly derived `sleepy` → `sleepy`.
6. Low happiness (`isBored` / `needsPlayAttention`) → the derived mood as-is (so the
   speech line reads as wanting attention).
7. Otherwise → the freshly derived mood.

Step 2 and 3 both check the *displayed* mood, not just the freshly recomputed one,
specifically so that comfort/grace side effects from the ask action itself (step 4)
can't silently overwrite a mood the button just asked about.

## Final display mood (`resolveDisplayMood`, `utils/presentation.ts:40`)

The mood actually shown on screen, checked in this order:

1. Dev mood override (dev builds only).
2. Explicit `moodOverride` passed in for this update (e.g. from `resolveAskMood` above,
   or `resolveMoodOverrideAfterCare` after pet/treat/play).
3. `starving` / `hungry` (always win, never hidden behind ambient states).
4. Ambient peek in progress → `peek`.
5. Draining session in recovery → `happy` if the thanks nudge is due, else `stressed`.
6. Draining session overwhelmed → `overwhelmed`.
7. Draining session stressed → `stressed`.
8. Ambient activity (sleeping/peeking) when the derived mood is neutral (`content` or
   `curious`).
9. "Sticky" derived moods (`sleepy`, `happy`, `stressed`) are kept as-is.
10. Otherwise, the freshly derived mood.

## Constants reference

| Constant | Value | File |
|----------|-------|------|
| `stressedVitalThreshold` | 72 | `utils/mood-timers.ts` |
| `overwhelmedThresholdMs` | 60 min | `utils/mood-timers.ts` |
| `recoveryThanksThresholdMs` | 60 s | `utils/mood-timers.ts` |
| `happyMs` | 20 min | `utils/mood-grace.ts` |
| `satiatedMs` | 2 hr | `utils/mood-grace.ts` |
| `sleepDeferMs` | 30 min | `utils/mood-grace.ts` |
| `CARE_RECOVERY_CREDIT_MS` | pet 5 min, play 10 min | `utils/draining-session.ts` |
| `CARE_RECOVERY_AWAY_CREDIT_MS` | pet 15 s, play 30 s | `utils/draining-session.ts` |
