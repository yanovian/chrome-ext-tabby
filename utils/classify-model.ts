import { buildClassifyPrompt, parseClassifyAnswer } from './classify-prompt';
import { getSpeechGenerator } from './speech-model';
import type { BrowseCategory } from './types';

export interface ClassifyModelInput {
  title: string;
  url: string;
}

export async function generateClassificationWithModel(
  input: ClassifyModelInput,
): Promise<BrowseCategory | null> {
  const generate = await getSpeechGenerator();
  const prompt = buildClassifyPrompt(input);

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const raw = await generate(prompt, Date.now(), attempt);
    const category = parseClassifyAnswer(raw);
    if (category) {
      return category;
    }
  }

  return null;
}
