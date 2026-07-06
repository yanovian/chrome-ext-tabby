import { classifyTabWithAi } from './classify-tab';
import {
  createInitialCat,
  markMemoryRecalled,
  pickMemoryForRecall,
  resolveLifeStage,
  normalizeCatState,
} from './cat-sim';
import { DB } from './types';
import type { CatState, MemorySeed, TabObservation } from './types';
import { getSettings } from './settings';

const IS_DEV_BUILD = import.meta.env.DEV;

let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise;
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB.name, DB.version);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(DB.stores.observations)) {
        const observations = database.createObjectStore(DB.stores.observations, {
          keyPath: 'id',
        });
        observations.createIndex(DB.indexes.observedAt, 'observedAt', {
          unique: false,
        });
      }
      if (!database.objectStoreNames.contains(DB.stores.memories)) {
        database.createObjectStore(DB.stores.memories, { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains(DB.stores.cat)) {
        database.createObjectStore(DB.stores.cat, { keyPath: 'name' });
      }
    };

    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };

    request.onerror = () =>
      reject(request.error ?? new Error('Failed to open Tabby database.'));
  });

  return databasePromise;
}

function objectStore(
  database: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  return database.transaction(storeName, mode).objectStore(storeName);
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCatState(now = Date.now()): Promise<CatState> {
  const database = await openDatabase();
  const raw = await promisifyRequest(
    objectStore(database, DB.stores.cat, 'readonly').get('Tabby'),
  );
  if (!raw) {
    const initial = createInitialCat(now);
    await saveCatState(initial);
    return initial;
  }
  return normalizeCatState(raw as CatState, now);
}

export async function saveCatState(cat: CatState): Promise<void> {
  const database = await openDatabase();
  const settings = await getSettings(IS_DEV_BUILD);
  const withStage = {
    ...cat,
    stage: resolveLifeStage(
      cat.adoptedAt,
      Date.now(),
      settings.devForceLifeStage,
    ),
  };
  await promisifyRequest(
    objectStore(database, DB.stores.cat, 'readwrite').put(withStage),
  );
}

export async function appendObservation(
  partial: Omit<TabObservation, 'id' | 'category' | 'topic' | 'pageTextSnippet'>,
): Promise<TabObservation> {
  const settings = await getSettings(IS_DEV_BUILD);
  const classification = await classifyTabWithAi(
    { title: partial.title, url: partial.url },
    { localAiEnabled: settings.localSpeechEnabled },
  );

  const observation: TabObservation = {
    ...partial,
    id: crypto.randomUUID(),
    category: classification.category,
    topic: classification.topic,
    pageTextSnippet: '',
  };

  const database = await openDatabase();
  await promisifyRequest(
    objectStore(database, DB.stores.observations, 'readwrite').put(observation),
  );

  if (observation.topic && observation.category === 'nourishing') {
    await upsertMemoryFromObservation(observation);
  }

  return observation;
}

async function upsertMemoryFromObservation(
  observation: TabObservation,
): Promise<void> {
  const memories = await getMemories();
  const existing = memories.find((memory) => memory.topic === observation.topic);
  const now = observation.observedAt;

  if (existing) {
    const updated: MemorySeed = {
      ...existing,
      lastSeenAt: now,
      sessionCount: existing.sessionCount + 1,
      totalActiveMs: existing.totalActiveMs + observation.activeDurationMs,
      recallLine: `We were on ${existing.topic} again. I remember.`,
    };
    await saveMemory(updated);
    return;
  }

  const created: MemorySeed = {
    id: crypto.randomUUID(),
    topic: observation.topic!,
    kind: 'learning',
    firstSeenAt: now,
    lastSeenAt: now,
    sessionCount: 1,
    totalActiveMs: observation.activeDurationMs,
    recallLine: `We looked at ${observation.topic} together.`,
    lastRecalledAt: null,
  };
  await saveMemory(created);
}

export async function getMemories(): Promise<MemorySeed[]> {
  const database = await openDatabase();
  const raw = await promisifyRequest(
    objectStore(database, DB.stores.memories, 'readonly').getAll(),
  );
  return (raw as MemorySeed[]).sort(
    (left, right) => right.lastSeenAt - left.lastSeenAt,
  );
}

export async function saveMemory(memory: MemorySeed): Promise<void> {
  const database = await openDatabase();
  await promisifyRequest(
    objectStore(database, DB.stores.memories, 'readwrite').put(memory),
  );
}

export async function recallMemory(now: number): Promise<MemorySeed | null> {
  const memories = await getMemories();
  const picked = pickMemoryForRecall(memories, now);
  if (!picked) {
    return null;
  }
  const updated = markMemoryRecalled(picked, now);
  await saveMemory(updated);
  return updated;
}

export async function clearAllData(): Promise<void> {
  const database = await openDatabase();
  await Promise.all([
    promisifyRequest(
      objectStore(database, DB.stores.observations, 'readwrite').clear(),
    ),
    promisifyRequest(
      objectStore(database, DB.stores.memories, 'readwrite').clear(),
    ),
    promisifyRequest(
      objectStore(database, DB.stores.cat, 'readwrite').clear(),
    ),
  ]);
}

export async function getRecentObservations(
  limit: number,
): Promise<TabObservation[]> {
  const database = await openDatabase();
  const raw = await promisifyRequest(
    objectStore(database, DB.stores.observations, 'readonly').getAll(),
  );
  return (raw as TabObservation[])
    .sort((left, right) => right.observedAt - left.observedAt)
    .slice(0, limit);
}
