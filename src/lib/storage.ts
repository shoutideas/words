import type { SavedWord, WordLookup } from './types';
import { STORAGE_KEY } from './types';

async function readAll(): Promise<SavedWord[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const words = result[STORAGE_KEY];
  return Array.isArray(words) ? (words as SavedWord[]) : [];
}

async function writeAll(words: SavedWord[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: words });
}

export async function getSavedWords(): Promise<SavedWord[]> {
  const words = await readAll();
  return words.sort((a, b) => b.savedAt - a.savedAt);
}

export async function isWordSaved(word: string): Promise<boolean> {
  const lower = word.toLowerCase();
  const words = await readAll();
  return words.some((w) => w.word.toLowerCase() === lower);
}

export async function addWord(
  lookup: WordLookup,
  sourceUrl?: string,
): Promise<SavedWord> {
  const words = await readAll();
  const lower = lookup.word.toLowerCase();
  const existing = words.find((w) => w.word.toLowerCase() === lower);
  if (existing) return existing;

  const saved: SavedWord = {
    id: crypto.randomUUID(),
    word: lookup.word,
    phonetic: lookup.phonetic,
    partOfSpeech: lookup.partOfSpeech,
    definition: lookup.definition,
    savedAt: Date.now(),
    sourceUrl,
  };

  words.push(saved);
  await writeAll(words);
  return saved;
}

export async function removeWord(word: string): Promise<void> {
  const lower = word.toLowerCase();
  const words = await readAll();
  await writeAll(words.filter((w) => w.word.toLowerCase() !== lower));
}

export async function clearAll(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
