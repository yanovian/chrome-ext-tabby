import { buildSpeechPrompt, postProcessSpeech } from './speech-prompt';
import { isAcceptableTabbySpeech } from './speech-quality';
import type { SpeechContext } from './speech-types';
import { SPEECH_MODEL } from './speech-types';

export interface ModelProgress {
  status: string;
  name?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

type ProgressHandler = (progress: ModelProgress) => void;

const progressHandlers = new Set<ProgressHandler>();
const MAX_GENERATION_ATTEMPTS = 3;

let generatorFn: Promise<
  (prompt: string, seed: number, attempt: number) => Promise<string>
> | null = null;

export function onSpeechModelProgress(handler: ProgressHandler): () => void {
  progressHandlers.add(handler);
  return () => {
    progressHandlers.delete(handler);
  };
}

function emitProgress(progress: ModelProgress): void {
  for (const handler of progressHandlers) {
    handler(progress);
  }
}

function assetUrl(path: string): string {
  return (browser.runtime.getURL as (p: string) => string)(path);
}

async function loadSpeechGenerator(): Promise<
  (prompt: string, seed: number, attempt: number) => Promise<string>
> {
  const { pipeline, env } = await import('@huggingface/transformers');

  env.allowLocalModels = true;
  env.allowRemoteModels = false;
  env.localModelPath = assetUrl('/models/');
  env.useBrowserCache = true;
  (env as { useWasmCache?: boolean }).useWasmCache = false;

  const onnx = env.backends?.onnx as
    | { wasm?: { wasmPaths?: unknown; numThreads?: number } }
    | undefined;
  if (onnx?.wasm) {
    onnx.wasm.wasmPaths = {
      wasm: assetUrl('/ort/ort-wasm-simd-threaded.asyncify.wasm'),
      mjs: assetUrl('/ort/ort-wasm-simd-threaded.asyncify.mjs'),
    };
    onnx.wasm.numThreads = 1;
  }

  const generator = await pipeline('text2text-generation', SPEECH_MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (progress: unknown) => {
      emitProgress(progress as ModelProgress);
    },
  });

  return async (prompt: string, seed: number, attempt: number): Promise<string> => {
    const output = await generator(prompt, {
      max_new_tokens: 22,
      do_sample: attempt > 0,
      temperature: 0.35,
      top_p: 0.85,
      repetition_penalty: 1.15,
      seed: Math.abs(seed + attempt * 997) % 2_147_483_647,
    });

    const first = Array.isArray(output) ? output[0] : output;
    if (typeof first === 'string') {
      return first;
    }
    if (first && typeof first === 'object' && 'generated_text' in first) {
      return String((first as { generated_text: string }).generated_text);
    }
    return String(first ?? '');
  };
}

export function getSpeechGenerator(): Promise<
  (prompt: string, seed: number, attempt: number) => Promise<string>
> {
  if (!generatorFn) {
    generatorFn = loadSpeechGenerator().catch((error) => {
      generatorFn = null;
      throw error;
    });
  }
  return generatorFn;
}

export async function generateSpeechWithModel(context: SpeechContext): Promise<string | null> {
  const generate = await getSpeechGenerator();
  const prompt = buildSpeechPrompt(context);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const raw = await generate(prompt, context.seed, attempt);
    const text = postProcessSpeech(raw, context);
    if (text && isAcceptableTabbySpeech(text, context)) {
      return text;
    }
  }

  return null;
}

export async function warmSpeechModel(): Promise<void> {
  await getSpeechGenerator();
}
