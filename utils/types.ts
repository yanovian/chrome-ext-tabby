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
}

/** Saved position for the draggable overlay (pixels from top-left). */
export interface OverlayPosition {
  x: number;
  y: number;
}

/** User-configurable extension settings. */
export interface ExtensionSettings {
  /** Read visible page text to understand tab context. Default: true. */
  readPageContent: boolean;
  /** Maximum characters of page text to analyze per tab. */
  pageTextMaxChars: number;
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
  /** Dev-only: minimum ms on a tab before it counts (production uses 5000). */
  devMinTabDurationMs: number;
  /** Dev-only: preview a specific life stage instead of age-based growth. */
  devForceLifeStage: DevLifeStageOverride;
  /** Show the floating cat overlay on web pages. */
  showOverlay: boolean;
  /** Generate varied speech with the bundled local model (offline). */
  localSpeechEnabled: boolean;
}

export const CAT_NAME = 'Tabby' as const;

export const DEFAULT_SETTINGS: ExtensionSettings = {
  readPageContent: true,
  pageTextMaxChars: 2000,
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
} as const;

export const ALARM_NAMES = {
  tick: 'tabby-tick',
} as const;

export type CareAction = 'pet' | 'treat' | 'play' | 'ask' | 'dismiss';

export type TabObservationInput = Omit<
  TabObservation,
  'id' | 'category' | 'topic'
>;

export type RuntimeMessage =
  | { type: 'getPresentation' }
  | { type: 'getSettings' }
  | { type: 'saveSettings'; settings: Partial<ExtensionSettings> }
  | { type: 'observeTab'; observation: TabObservationInput }
  | { type: 'careAction'; action: CareAction }
  | { type: 'showOverlay' }
  | { type: 'tick' }
  | { type: 'resetIntro' }
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
