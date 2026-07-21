/** How nourishing the current browsing feels for Tabby. */
export type BrowseCategory = 'nourishing' | 'neutral' | 'draining';

/** Social vs news for long-session overwhelmed tracking. */
export type DrainingSessionKind = 'social' | 'news';

/** Dev-only: which temper scenario the sliders simulate. */
export type DevTemperScenario = 'on_feed' | 'away_from_feed';

/** Visible mood derived from internal stats — drives sprite + speech. */
export type CatMood =
  | 'content'
  | 'happy'
  | 'curious'
  | 'hungry'
  | 'starving'
  | 'stressed'
  | 'sleepy'
  | 'peek'
  | 'overwhelmed';

/** Visual life stage — each age has its own mood sprites. */
export type CatLifeStage = 'newborn' | 'playful' | 'adult';

export type DevLifeStageOverride = 'auto' | CatLifeStage;

export type DevMoodOverride = 'auto' | CatMood;

/** Why Tabby chose to speak right now. */
export type SpeechTriggerKind =
  | 'hungry'
  | 'starving'
  | 'stressed'
  | 'lonely'
  | 'happy'
  | 'sleepy'
  | 'curious'
  | 'memory'
  | 'milestone'
  | 'overwhelmed'
  | 'recovery_easing'
  | 'recovery_thanks'
  | 'dev';

/** A single browsing observation queued from a tab. */
export interface TabObservation {
  id: string;
  observedAt: number;
  title: string;
  url: string;
  hostname: string;
  pageTextSnippet: string;
  activeDurationMs: number;
  category: BrowseCategory | null;
  topic: string | null;
}

/** Internal cat vitals — never shown as numbers in the UI. */
export interface CatVitals {
  hunger: number;
  happiness: number;
  stress: number;
  energy: number;
}

/** Persistent cat record stored in IndexedDB. */
export interface CatState {
  name: 'Tabby';
  adoptedAt: number;
  stage: CatLifeStage;
  vitals: CatVitals;
  lastCareAt: number;
  /** After feeding, Tabby stays full until this time. */
  satiatedUntil: number;
  /** After pet, play, feed, or ask, Tabby stays happy until this time. */
  happyUntil: number;
  lastSeenAt: number;
  lastSpeechAt: number;
  nudgesToday: number;
  nudgesDayKey: string;
  mischiefCooldownAt: number;
  lastAmbientAt: number;
  ambientsToday: number;
  ambientsDayKey: string;
}

/** A memory Tabby can recall in conversation. */
export interface MemorySeed {
  id: string;
  topic: string;
  kind: 'learning' | 'exploring' | 'creating' | 'milestone';
  firstSeenAt: number;
  lastSeenAt: number;
  sessionCount: number;
  totalActiveMs: number;
  recallLine: string;
  lastRecalledAt: number | null;
}

/** Snapshot pushed to the content-script overlay. */
export interface CatPresentation {
  mood: CatMood;
  stage: CatLifeStage;
  stageLabel: string;
  sprite: string;
  speech: string | null;
  triggerKind: SpeechTriggerKind | null;
  /** When true the user chose "Hide for now" — no floating cat on the page. */
  overlayHidden: boolean;
  canPet: boolean;
  canTreat: boolean;
  canPlay: boolean;
  interactions: import('./cat-interactions').PrimaryInteractionOption[];
  secondaryInteractions: import('./cat-interactions').SecondaryInteractionOption[];
  /** Last care button the user pressed — highlighted until they pick another. */
  lastCareAction: import('./cat-interactions').InteractionAction | null;
  /** Whether the cat sprite is on screen right now (global, not per-tab). */
  companionVisible: boolean;
  /** Quiet idle animation while visible without speech. */
  ambientActivity: import('./ambient-presence').AmbientActivity | null;
  /** When an ambient rest should end and Tabby come back. */
  ambientPeekUntil: number | null;
  /** Screen edge for peek mood (bottom, left, or right). */
  peekEdge: import('./ambient-presence').PeekEdge | null;
  /** Random inset from the viewport edge during peek (px). */
  peekInset: number | null;
  /** Bottom peek: which horizontal corner to hug. */
  peekCorner: import('./ambient-presence').PeekCorner | null;
  /** Ambient state saved when a peek cycle starts; restored on reveal. */
  peekRestoreAmbientActivity: import('./ambient-presence').AmbientActivity | null;
  peekRestoreAmbientUntil: number | null;
  /** After reveal tap, keep Tabby on screen with her real mood until this time. */
  stayVisibleUntil: number | null;
  /** While set and in the future, Tabby is munching after a treat. */
  eatingUntil: number | null;
  /** While set and in the future, Tabby is in a wild play moment. */
  playingUntil: number | null;
}

/** Saved position for the draggable overlay (pixels from top-left). */
export interface OverlayPosition {
  x: number;
  y: number;
}

/** User-configurable extension settings. */
export interface ExtensionSettings {
  /** Local hour when quiet hours begin (inclusive). */
  quietHoursStart: number;
  /** Local hour when quiet hours end (exclusive). */
  quietHoursEnd: number;
  /** Max unprompted appearances per calendar day (production). */
  maxAppearancesPerDay: number;
  /** Minutes between possible appearances (production). */
  appearanceCooldownMinutes: number;
  /** Dev-only: faster stat drift and more frequent appearances. */
  devModeEnabled: boolean;
  /** Dev-only: override max appearances when dev mode is on. */
  devMaxAppearancesPerDay: number;
  /** Dev-only: override cooldown minutes when dev mode is on. */
  devAppearanceCooldownMinutes: number;
  /** Dev-only: multiply stat change rates. */
  devStatMultiplier: number;
  /** Dev-only: minimum ms on a page before mood can change (production uses 60s). */
  devMinTabDurationMs: number;
  /** Dev-only: preview a specific life stage instead of age-based growth. */
  devForceLifeStage: DevLifeStageOverride;
  /** Dev-only: preview a specific mood instead of vitals-based mood. */
  devForceMood: DevMoodOverride;
  /** Dev-only: ms on social/news before overwhelmed (production: 1 hour). */
  devOverwhelmedThresholdMs: number;
  /** Dev-only: ms away from feed before recovery thank-you (production: 1 minute). */
  devRecoveryThanksThresholdMs: number;
  /** Dev-only: stress vital level for the stressed mood tier. */
  devStressedVitalThreshold: number;
  /** Dev-only: simulate on-feed vs away-from-feed for temper sliders. */
  devTemperScenario: DevTemperScenario;
  /** Dev-only: simulated dwell on social/news (ms). */
  devSimulatedDrainingMs: number;
  /** Dev-only: simulated time away during recovery (ms). */
  devSimulatedRecoveryAwayMs: number;
  /** Show the floating cat overlay on web pages. */
  showOverlay: boolean;
  /** In-app UI language (Chrome store has separate manifest locales). */
  locale: string;
}

export const CAT_NAME = 'Tabby' as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  quietHoursStart: 23,
  quietHoursEnd: 8,
  maxAppearancesPerDay: 5,
  appearanceCooldownMinutes: 30,
  devModeEnabled: false,
  devMaxAppearancesPerDay: 30,
  devAppearanceCooldownMinutes: 2,
  devStatMultiplier: 4,
  devMinTabDurationMs: 1000,
  devForceLifeStage: 'auto',
  devForceMood: 'auto',
  devOverwhelmedThresholdMs: 60 * 60_000,
  devRecoveryThanksThresholdMs: 60_000,
  devStressedVitalThreshold: 72,
  devTemperScenario: 'on_feed',
  devSimulatedDrainingMs: 0,
  devSimulatedRecoveryAwayMs: 0,
  showOverlay: true,
  locale: 'en',
};

export const DB = {
  name: 'tabby',
  version: 1,
  stores: {
    observations: 'observations',
    memories: 'memories',
    cat: 'cat',
  },
  indexes: {
    observedAt: 'observedAt',
  },
} as const;

export const STORAGE_KEYS = {
  settings: 'settings',
  presentation: 'presentation',
  overlayPosition: 'overlayPosition',
  /** Cat position saved when ambient peek starts; restored on reveal. */
  peekRestorePosition: 'peekRestorePosition',
  introCompleted: 'introCompleted',
  /** Page keys (hostname + path) where the user chose Hide Tabby. */
  hiddenPageKeys: 'hiddenPageKeys',
  /** Hostname + path keys for the last few counted page visits (anti-cheat). */
  recentVisitKeys: 'recentVisitKeys',
  /** Timestamp (ms) until global do-not-disturb ends. */
  doNotDisturbUntil: 'doNotDisturbUntil',
  /** Original do-not-disturb duration chosen by the user. */
  doNotDisturbDuration: 'doNotDisturbDuration',
  /** Continuous social/news dwell time for overwhelmed nudges. */
  drainingSession: 'drainingSession',
} as const;

export const ALARM_NAMES = {
  tick: 'tabby-tick',
  feedingComplete: 'tabby-feeding-complete',
  playingComplete: 'tabby-playing-complete',
} as const;

export type CareAction =
  | 'pet'
  | 'treat'
  | 'play'
  | 'ask'
  | 'reveal'
  | 'shoo'
  | 'dismiss'
  | 'dnd_30'
  | 'dnd_60'
  | 'dnd_today';

/** Whether Tabby is visible on the active tab (settings popup). */
export interface PageOverlayState {
  /** Tabby can be shown or hidden on this tab. */
  applicable: boolean;
  /** Tabby is currently visible on this tab. */
  visible: boolean;
}

export type DoNotDisturbDuration = '30m' | '60m' | 'today';

export interface DoNotDisturbStatus {
  active: boolean;
  until: number | null;
  duration: DoNotDisturbDuration | null;
  summary: string | null;
}

export type TabObservationInput = Omit<
  TabObservation,
  'id' | 'category' | 'topic' | 'pageTextSnippet'
>;

export type RuntimeMessage =
  | { type: 'getPresentation' }
  | { type: 'getSettings' }
  | { type: 'saveSettings'; settings: Partial<ExtensionSettings>; skipPresent?: boolean }
  | { type: 'careAction'; action: CareAction; url?: string }
  | { type: 'showOverlay'; url?: string; title?: string }
  | { type: 'hideOverlay'; url?: string }
  | { type: 'getPageOverlayState'; url?: string }
  | { type: 'getDoNotDisturb' }
  | { type: 'setDoNotDisturb'; duration: DoNotDisturbDuration }
  | { type: 'cancelDoNotDisturb' }
  | { type: 'syncActiveOverlay' }
  | { type: 'isActiveOverlayTab' }
  | { type: 'tick' }
  | { type: 'resetIntro' }
  | { type: 'devForceCompanionShow' }
  | { type: 'devForceCompanionHide' }
  | { type: 'clearCompanionSpeech' }
  | { type: 'settleAfterIntro' }
  | { type: 'recordInteraction' }
  | { type: 'syncDevTemper'; simulation?: Partial<import('./mood-timers').TemperSimulation>; devForceMood?: DevMoodOverride }
  | { type: 'getDevTemper' }
  | { type: 'ping' };

export interface RuntimeResponseOk<T = unknown> {
  ok: true;
  data?: T;
}

export interface RuntimeResponseError {
  ok: false;
  error: string;
}

export type RuntimeResponse<T = unknown> =
  | RuntimeResponseOk<T>
  | RuntimeResponseError;
