import enBundle from '../locales/en.json';
import {
  DEFAULT_APP_LOCALE,
  RTL_LOCALES,
  type AppLocale,
  isAppLocale,
  normalizeLocaleTag,
} from './locale-registry';
import { getSettings } from './settings';

export type LocaleBundle = typeof enBundle;

type ExplainRecord = Record<string, Record<string, string[]>>;

const localeModules = import.meta.glob<{ default: LocaleBundle }>('../locales/*.json', {
  eager: false,
});

let activeLocale: AppLocale = DEFAULT_APP_LOCALE;
let activeBundle: LocaleBundle = enBundle;
const loadCache = new Map<AppLocale, LocaleBundle>([[DEFAULT_APP_LOCALE, enBundle]]);

function deepGet(root: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in (node as Record<string, unknown>)) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, root);
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((line) => typeof line === 'string')) {
    return value;
  }
  return [];
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

export function getAppLocale(): AppLocale {
  return activeLocale;
}

export function getLocaleBundle(): LocaleBundle {
  return activeBundle;
}

export function brandName(): string {
  return activeBundle.brand;
}

export async function loadAppLocale(locale: string): Promise<AppLocale> {
  const code = isAppLocale(locale) ? locale : normalizeLocaleTag(locale);
  if (loadCache.has(code)) {
    activeLocale = code;
    activeBundle = loadCache.get(code)!;
    return code;
  }

  const importer = localeModules[`../locales/${code}.json`];
  if (!importer) {
    activeLocale = DEFAULT_APP_LOCALE;
    activeBundle = enBundle;
    return DEFAULT_APP_LOCALE;
  }

  const mod = await importer();
  const bundle = mod.default;
  loadCache.set(code, bundle);
  activeLocale = code;
  activeBundle = bundle;
  return code;
}

export async function loadLocaleFromSettings(isDevBuild = false): Promise<void> {
  const settings = await getSettings(isDevBuild);
  await loadAppLocale(settings.locale);
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const value = deepGet(activeBundle, key) ?? deepGet(enBundle, key);
  if (typeof value === 'string') {
    return interpolate(value, vars);
  }
  return key;
}

export function tLines(key: string): string[] {
  return asStringArray(deepGet(activeBundle, key) ?? deepGet(enBundle, key));
}

export function explainLines(mood: string, stage: string): string[] {
  const explain = activeBundle.explain as ExplainRecord;
  const fallback = enBundle.explain as ExplainRecord;
  return (
    explain[mood]?.[stage] ??
    explain[mood]?.adult ??
    fallback[mood]?.[stage] ??
    fallback[mood]?.adult ??
    []
  );
}

export function pickLine(lines: string[], seed: number): string {
  if (lines.length === 0) {
    return '';
  }
  const index = Math.abs(seed) % lines.length;
  return lines[index] ?? lines[0] ?? '';
}

export function applyDataI18n(root: ParentNode = document): void {
  for (const element of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    const key = element.dataset.i18n;
    if (key) {
      element.textContent = t(key);
    }
  }
}

export function applyNodeLocale(node: HTMLElement): void {
  node.lang = activeLocale.replace('_', '-');
  node.dir = RTL_LOCALES.has(activeLocale) ? 'rtl' : 'ltr';
}

export function applyDocumentLocale(): void {
  applyNodeLocale(document.documentElement);
}
