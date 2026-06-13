import { FloatingCard } from './floating-card';
import {
  extractWordAtPoint,
  processSelectionText,
} from '../lib/selection';
import type { ContextLookupMessage } from '../lib/types';

let card: FloatingCard | null = null;

function getCard(): FloatingCard {
  if (!card) {
    card = new FloatingCard(() => {
      card = null;
    });
  }
  return card;
}

function getSelectionCoords(): { x: number; y: number } {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  }
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.bottom,
  };
}

function openLookup(text: string, x: number, y: number, isPhrase: boolean): void {
  const result = processSelectionText(text);
  if (result.action === 'ignore') return;

  const lookupText = result.action === 'lookup' ? result.text : text;
  const phrase = result.action === 'lookup' ? result.isPhrase : isPhrase;

  void getCard().show(lookupText, x, y, phrase);
}

document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;

  const target = e.target as HTMLElement;
  if (target.closest('.words-card-host')) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return;

  const text = selection.toString();
  const result = processSelectionText(text);
  if (result.action === 'ignore') return;

  const coords = getSelectionCoords();
  openLookup(text, coords.x, coords.y, result.action === 'lookup' && result.isPhrase);
});

document.addEventListener(
  'dblclick',
  (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.words-card-host')) return;
    if (target.closest('button, a, input, textarea, select, [role="button"]')) return;

    const word = extractWordAtPoint(e.clientX, e.clientY);
    if (!word) return;

    e.preventDefault();
    e.stopPropagation();

    const active = getCard();
    if (active.isMounted() && active.getWord()?.toLowerCase() === word.toLowerCase()) {
      return;
    }

    void active.show(word, e.clientX, e.clientY, false);
  },
  true,
);

chrome.runtime.onMessage.addListener((message: ContextLookupMessage) => {
  if (message.type !== 'CONTEXT_LOOKUP') return;

  const result = processSelectionText(message.text);
  if (result.action === 'ignore') return;

  const coords = getSelectionCoords();
  const isPhrase = result.action === 'lookup' && result.isPhrase;
  const text = result.action === 'lookup' ? result.text : message.text;
  void getCard().show(text, coords.x, coords.y, isPhrase);
});
