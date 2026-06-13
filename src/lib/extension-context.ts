/** True when this content/popup script can still talk to the extension. */
export function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

export function isContextInvalidatedError(message: string | undefined): boolean {
  if (!message) return false;
  return message.includes('Extension context invalidated');
}

export const CONTEXT_INVALIDATED_MESSAGE =
  'Words was updated. Refresh this page to continue.';
