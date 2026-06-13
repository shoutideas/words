import { FloatingCard } from './floating-card';
import {
  extractWordAtPoint,
  processSelectionText,
} from '../lib/selection';
import { isExtensionContextValid } from '../lib/extension-context';
import type { ContextLookupMessage } from '../lib/types';

let card: FloatingCard | null = null;
let lastDblClickAt = 0;

function getCard(): FloatingCard {
  if (!card) {
    card = new FloatingCard(() => {
      card = null;
    });
  }
  return card;
}

function eventTargetElement(event: Event): Element | null {
  let node: Node | null = event.target as Node | null;
  while (node) {
    if (node instanceof Element) return node;
    node = node.parentNode;
  }
  return null;
}

function getSelectionCoords(): { x: number; y: number } {
  const fallback = {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  };

  try {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return fallback;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return fallback;

    return {
      x: rect.left + rect.width / 2,
      y: rect.bottom,
    };
  } catch {
    return fallback;
  }
}

function openLookup(text: string, x: number, y: number, isPhrase: boolean): void {
  if (!isExtensionContextValid()) return;

  const result = processSelectionText(text);
  if (result.action === 'ignore') return;

  const lookupText = result.action === 'lookup' ? result.text : text;
  const phrase = result.action === 'lookup' ? result.isPhrase : isPhrase;

  void getCard().show(lookupText, x, y, phrase).catch(() => {
    // Swallow errors after extension reload (context invalidated).
  });
}

document.addEventListener('mouseup', (e) => {
  try {
    if (e.button !== 0) return;
    if (Date.now() - lastDblClickAt < 400) return;

    const target = eventTargetElement(e);
    if (target?.closest('.words-card-host')) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString();
    const result = processSelectionText(text);
    if (result.action === 'ignore') return;

    const coords = getSelectionCoords();
    openLookup(text, coords.x, coords.y, result.action === 'lookup' && result.isPhrase);
  } catch {
    // Ignore selection errors on complex publisher pages (shadow DOM, live blogs).
  }
});

document.addEventListener(
  'dblclick',
  (e) => {
    try {
      const target = eventTargetElement(e);
      if (target?.closest('.words-card-host')) return;
      if (target?.closest('button, a, input, textarea, select, [role="button"]')) return;

      const word = extractWordAtPoint(e.clientX, e.clientY);
      if (!word) return;

      lastDblClickAt = Date.now();
      e.preventDefault();
      e.stopPropagation();

      const active = getCard();
      if (active.isMounted() && active.getWord()?.toLowerCase() === word.toLowerCase()) {
        return;
      }

      void active.show(word, e.clientX, e.clientY, false).catch(() => {});
    } catch {
      // Ignore caret/range errors on complex publisher pages.
    }
  },
  true,
);

chrome.runtime.onMessage.addListener((message: ContextLookupMessage | { type: 'PING' }, _sender, sendResponse) => {
  if (message.type === 'PING') {
    sendResponse({ ok: true });
    return true;
  }

  try {
    if (message.type !== 'CONTEXT_LOOKUP') return;

    const result = processSelectionText(message.text);
    if (result.action === 'ignore') return;

    const coords = getSelectionCoords();
    const isPhrase = result.action === 'lookup' && result.isPhrase;
    const text = result.action === 'lookup' ? result.text : message.text;
    void getCard().show(text, coords.x, coords.y, isPhrase).catch(() => {});
  } catch {
    // Ignore context-menu lookup errors.
  }
});
