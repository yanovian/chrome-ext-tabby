/** How nourishing the current browsing feels for Tabby. */
export type BrowseCategory = 'nourishing' | 'neutral' | 'draining';

/** Visible mood derived from internal stats — drives sprite + speech. */
export type CatMood =
  | 'content'
  | 'happy'
  | 'curious'
  | 'hungry'
  | 'starving'
  | 'stressed'
  | 'sleepy';

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
  /** When an ambient peek should end and Tabby hide again. */
  ambientPeekUntil: number | null;
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
  /** Show the floating cat overlay on web pages. */
  showOverlay: boolean;
  /** Generate varied speech with the bundled local model (offline). */
  localSpeechEnabled: boolean;
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
  showOverlay: true,
  localSpeechEnabled: true,
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
  introCompleted: 'introCompleted',
  /** Page keys (hostname + path) where the user chose Hide Tabby. */
  hiddenPageKeys: 'hiddenPageKeys',
  /** Hostname + path keys for the last few counted page visits (anti-cheat). */
  recentVisitKeys: 'recentVisitKeys',
  /** Timestamp (ms) until global do-not-disturb ends. */
  doNotDisturbUntil: 'doNotDisturbUntil',
  /** Original do-not-disturb duration chosen by the user. */
  doNotDisturbDuration: 'doNotDisturbDuration',
} as const;

export const ALARM_NAMES = {
  tick: 'tabby-tick',
} as const;

export type CareAction =
  | 'pet'
  | 'treat'
  | 'play'
  | 'ask'
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
  | { type: 'saveSettings'; settings: Partial<ExtensionSettings> }
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
  | { type: 'devForceCompanionShow'; mode: 'ambient' | 'quiet' }
  | { type: 'devForceCompanionHide' }
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
