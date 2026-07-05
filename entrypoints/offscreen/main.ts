import { generateSpeechWithModel, warmSpeechModel } from '../../utils/speech-model';
import type { SpeechContext } from '../../utils/speech-types';

browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  void (async () => {
    try {
      if (message?.type === 'speech:warm') {
        await warmSpeechModel();
        sendResponse({ ok: true });
        return;
      }

      if (message?.type === 'speech:generate') {
        const context = message.context as SpeechContext;
        const text = await generateSpeechWithModel(context);
        sendResponse({ ok: true, text });
        return;
      }

      sendResponse({ ok: false, error: 'Unknown offscreen message' });
    } catch (error) {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Speech engine error',
      });
    }
  })();

  return true;
});

void warmSpeechModel().catch((error) => {
  console.warn('[Tabby] Speech model warm-up failed.', error);
});
