import type { RuntimeMessage, RuntimeResponse } from '../../utils/types';
import {
  handleCancelDoNotDisturb,
  handleCareActionMessage,
  handleClearCompanionSpeech,
  handleDevForceCompanionHide,
  handleDevForceCompanionShow,
  handleGetDevTemper,
  handleGetDoNotDisturb,
  handleGetPageOverlayState,
  handleGetPresentation,
  handleGetSettings,
  handleHideOverlay,
  handleIsActiveOverlayTab,
  handlePing,
  handleRecordInteraction,
  handleResetIntro,
  handleSaveSettings,
  handleSetDoNotDisturb,
  handleSettleAfterIntro,
  handleShowOverlay,
  handleSyncActiveOverlay,
  handleSyncDevTemper,
  handleTick,
  handleUnknownMessage,
  type MessageSender,
  type SendResponse,
} from './message-handlers';

/** Routes a runtime message to its handler. One function per message type (see
 * message-handlers.ts) instead of a single growing switch — each case here is just "which
 * function," not any of the logic itself. */
export async function dispatchMessage(
  message: RuntimeMessage,
  sender: MessageSender,
  sendResponse: SendResponse,
): Promise<void> {
  switch (message?.type) {
    case 'getPresentation':
      return handleGetPresentation(sendResponse);
    case 'getSettings':
      return handleGetSettings(sendResponse);
    case 'saveSettings':
      return handleSaveSettings(message, sendResponse);
    case 'careAction':
      return handleCareActionMessage(message, sender, sendResponse);
    case 'getPageOverlayState':
      return handleGetPageOverlayState(message, sendResponse);
    case 'getDoNotDisturb':
      return handleGetDoNotDisturb(sendResponse);
    case 'cancelDoNotDisturb':
      return handleCancelDoNotDisturb(sendResponse);
    case 'setDoNotDisturb':
      return handleSetDoNotDisturb(message, sendResponse);
    case 'showOverlay':
      return handleShowOverlay(message, sendResponse);
    case 'hideOverlay':
      return handleHideOverlay(message, sendResponse);
    case 'syncActiveOverlay':
      return handleSyncActiveOverlay(sendResponse);
    case 'isActiveOverlayTab':
      return handleIsActiveOverlayTab(sender, sendResponse);
    case 'resetIntro':
      return handleResetIntro(sendResponse);
    case 'clearCompanionSpeech':
      return handleClearCompanionSpeech(sendResponse);
    case 'recordInteraction':
      return handleRecordInteraction(sendResponse);
    case 'settleAfterIntro':
      return handleSettleAfterIntro(sendResponse);
    case 'devForceCompanionShow':
      return handleDevForceCompanionShow(sendResponse);
    case 'devForceCompanionHide':
      return handleDevForceCompanionHide(sendResponse);
    case 'getDevTemper':
      return handleGetDevTemper(sendResponse);
    case 'syncDevTemper':
      return handleSyncDevTemper(message, sendResponse);
    case 'tick':
      return handleTick(sendResponse);
    case 'ping':
      return handlePing(sendResponse);
    default:
      return handleUnknownMessage(sendResponse);
  }
}

/** Registers the onMessage listener. Runtime message handlers report failures by calling
 * sendResponse themselves with an error response — this only catches something a handler
 * didn't expect (a thrown error), so one bad message can't leave the sender hanging forever. */
export function registerMessageListener(): void {
  browser.runtime.onMessage.addListener((message: RuntimeMessage, sender, sendResponse) => {
    void dispatchMessage(message, sender, (response: RuntimeResponse) => sendResponse(response)).catch(
      (error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : 'Unexpected error',
        } satisfies RuntimeResponse);
      },
    );
    return true;
  });
}
