const WORD_PATTERN = /^[a-zA-Z'-]+$/;

export function normalizeWord(raw: string): string {
  return raw.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9'-]+$/g, '');
}

export function isValidWord(word: string): boolean {
  return word.length > 0 && WORD_PATTERN.test(word);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function extractWordFromSelection(): string | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const wordCount = countWords(text);
  if (wordCount === 0 || wordCount > 5) return null;

  if (wordCount === 1) {
    const word = normalizeWord(text);
    return isValidWord(word) ? word : null;
  }

  return text;
}

export function extractWordAtPoint(x: number, y: number): string | null {
  try {
    let range: Range | null = null;

    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(x, y);
    } else {
      const doc = document as Document & {
        caretPositionFromPoint?: (
          px: number,
          py: number,
        ) => { offsetNode: Node; offset: number } | null;
      };
      const pos = doc.caretPositionFromPoint?.(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
        range.collapse(true);
      }
    }

    if (!range) return null;

    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return null;

    const text = node.textContent ?? '';
    const offset = range.startOffset;

    let start = offset;
    let end = offset;

    while (start > 0 && /[a-zA-Z'-]/.test(text[start - 1])) start--;
    while (end < text.length && /[a-zA-Z'-]/.test(text[end])) end++;

    const word = normalizeWord(text.slice(start, end));
    return isValidWord(word) ? word : null;
  } catch {
    return null;
  }
}

export type SelectionResult =
  | { action: 'ignore' }
  | { action: 'lookup'; text: string; isPhrase: boolean }
  | { action: 'phrase_failed' };

export function processSelectionText(text: string): SelectionResult {
  const trimmed = text.trim();
  if (!trimmed) return { action: 'ignore' };

  const wordCount = countWords(trimmed);
  if (wordCount === 0 || wordCount > 5) return { action: 'ignore' };

  if (wordCount === 1) {
    const word = normalizeWord(trimmed);
    if (!isValidWord(word)) return { action: 'ignore' };
    return { action: 'lookup', text: word, isPhrase: false };
  }

  return { action: 'lookup', text: trimmed, isPhrase: true };
}
