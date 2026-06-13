export interface SavedWord {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  savedAt: number;
  sourceUrl?: string;
}

export interface WordLookup {
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  synonyms: string[];
  antonyms: string[];
  examples: string[];
}

export type LookupMessage = {
  type: 'LOOKUP';
  word: string;
};

export type LookupResponse =
  | { ok: true; data: WordLookup }
  | { ok: false; error: 'not_found' | 'network' };

export type ContextLookupMessage = {
  type: 'CONTEXT_LOOKUP';
  text: string;
};

export const STORAGE_KEY = 'savedWords';
