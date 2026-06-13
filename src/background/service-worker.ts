import { lookupWord } from '../lib/dictionary';
import { ensureContentScript } from '../lib/inject-content';
import type {
  EnsureContentMessage,
  LookupMessage,
  LookupResponse,
} from '../lib/types';

const CONTEXT_MENU_ID = 'words-lookup';

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: 'Look up in Words',
      contexts: ['selection'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== CONTEXT_MENU_ID || !tab?.id) return;
  const text = info.selectionText?.trim();
  if (!text) return;

  void (async () => {
    await ensureContentScript(tab.id!);
    await chrome.tabs.sendMessage(tab.id!, {
      type: 'CONTEXT_LOOKUP',
      text,
    });
  })();
});

chrome.runtime.onMessage.addListener(
  (
    message: LookupMessage | EnsureContentMessage,
    _sender,
    sendResponse: (response: LookupResponse | { ok: true }) => void,
  ) => {
    if (message.type === 'ENSURE_CONTENT') {
      ensureContentScript(message.tabId)
        .then(() => sendResponse({ ok: true }))
        .catch(() => sendResponse({ ok: true }));
      return true;
    }

    if (message.type !== 'LOOKUP') return false;

    lookupWord(message.word)
      .then((data) => {
        if (!data) {
          sendResponse({ ok: false, error: 'not_found' });
          return;
        }
        sendResponse({ ok: true, data });
      })
      .catch(() => {
        sendResponse({ ok: false, error: 'network' });
      });

    return true;
  },
);
