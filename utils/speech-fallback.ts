import { brandName, getLocaleBundle, pickLine, tLines } from './i18n';
import type { SpeechContext, SpeechKind } from './speech-types';
import type { SpeechTriggerKind } from './types';

function speechLines(kind: string): string[] {
  const lines = tLines(`speech.${kind}`);
  return lines.length > 0 ? lines : tLines('speech.ask');
}

export function fallbackSpeech(context: SpeechContext): string {
  if (context.kind === 'memory' && context.memoryTopic) {
    const templates = getLocaleBundle().speechTemplates.memory;
    const template = pickLine(templates, context.seed);
    return template.replaceAll('{topic}', context.memoryTopic);
  }

  if (context.kind === 'milestone' && context.milestoneDays) {
    const milestones = getLocaleBundle().speechTemplates.milestone;
    const key = String(context.milestoneDays) as keyof typeof milestones;
    const line = milestones[key];
    if (line) {
      return line.replaceAll('{brand}', brandName());
    }
  }

  return pickLine(speechLines(context.kind), context.seed);
}

export function triggerKindToSpeechKind(kind: SpeechTriggerKind): SpeechKind {
  if (kind === 'overwhelmed') {
    return 'overwhelmed_social';
  }
  return kind;
}

/** Dev preview: sample recovery line for easing or thanks. */
export function previewRecoverySpeech(
  kind: 'recovery_easing' | 'recovery_thanks',
  seed = 0,
): string {
  return pickLine(speechLines(kind), seed);
}
