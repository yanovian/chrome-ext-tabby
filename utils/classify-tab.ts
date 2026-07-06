import {
  AI_CLASSIFY_CONFIDENCE_THRESHOLD,
  classifyTab,
  needsAiRefinement,
  type ClassificationResult,
} from './classifier';
import { refineClassificationWithLocalAi } from './classify-service';

export interface ClassifyTabOptions {
  localAiEnabled?: boolean;
}

/** Heuristic pass first, then optional on-device AI when confidence is low. */
export async function classifyTabWithAi(
  input: { title: string; url: string },
  options: ClassifyTabOptions = {},
): Promise<ClassificationResult> {
  const heuristic = classifyTab(input);

  if (!needsAiRefinement(heuristic) || options.localAiEnabled === false) {
    return heuristic;
  }

  const aiCategory = await refineClassificationWithLocalAi({
    title: input.title,
    url: input.url,
    enabled: options.localAiEnabled ?? true,
  });

  if (!aiCategory) {
    return heuristic;
  }

  return {
    category: aiCategory,
    confidence: Math.max(heuristic.confidence, AI_CLASSIFY_CONFIDENCE_THRESHOLD),
    topic: heuristic.topic,
    source: heuristic.source,
  };
}
