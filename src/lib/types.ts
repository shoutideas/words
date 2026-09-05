export interface SavedWord {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  savedAt: number;
  sourceUrl?: string;
}

export interface DefinitionEntry {
  partOfSpeech: string;
  definition: string;
  example?: string;
  synonyms: string[];
  antonyms: string[];
}

export const LOOKUP_TIMEOUT_SECONDS = 10;
export const LOOKUP_TIMEOUT_MS = LOOKUP_TIMEOUT_SECONDS * 1000;

export interface WordLookup {
  word: string;
  phonetic?: string;
  audioUrl?: string;
  partOfSpeech?: string;
  definition: string;
  definitions: DefinitionEntry[];
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
  | { ok: false; error: 'not_found' | 'network' | 'context_invalidated' };

export type ContextLookupMessage = {
  type: 'CONTEXT_LOOKUP';
  text: string;
};

export const STORAGE_KEY = 'savedWords';
