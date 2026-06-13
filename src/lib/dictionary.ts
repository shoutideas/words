import type { WordLookup } from './types';

interface ApiDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
  antonyms?: string[];
}

interface ApiMeaning {
  partOfSpeech: string;
  definitions: ApiDefinition[];
  synonyms?: string[];
  antonyms?: string[];
}

interface ApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: { text?: string }[];
  meanings: ApiMeaning[];
}

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}

function pickPrimaryMeaning(meanings: ApiMeaning[]): ApiMeaning | undefined {
  const priority = ['adjective', 'noun', 'verb', 'adverb'];
  for (const pos of priority) {
    const match = meanings.find((m) => m.partOfSpeech === pos);
    if (match) return match;
  }
  return meanings[0];
}

function parseEntry(entry: ApiEntry): WordLookup {
  const primary = pickPrimaryMeaning(entry.meanings);
  const primaryDef = primary?.definitions[0];

  const synonyms: string[] = [];
  const antonyms: string[] = [];
  const examples: string[] = [];

  for (const meaning of entry.meanings) {
    if (meaning.synonyms) synonyms.push(...meaning.synonyms);
    if (meaning.antonyms) antonyms.push(...meaning.antonyms);
    for (const def of meaning.definitions) {
      if (def.synonyms) synonyms.push(...def.synonyms);
      if (def.antonyms) antonyms.push(...def.antonyms);
      if (def.example) examples.push(def.example);
    }
  }

  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    undefined;

  return {
    word: entry.word,
    phonetic,
    partOfSpeech: primary?.partOfSpeech,
    definition: primaryDef?.definition ?? 'No definition available.',
    synonyms: uniqueStrings(synonyms),
    antonyms: uniqueStrings(antonyms),
    examples: uniqueStrings(examples),
  };
}

export async function lookupWord(word: string): Promise<WordLookup | null> {
  const encoded = encodeURIComponent(word.trim());
  if (!encoded) return null;

  try {
    const res = await fetch(`${API_BASE}/${encoded}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as ApiEntry[];
    if (!data.length) return null;
    return parseEntry(data[0]);
  } catch {
    throw new Error('network');
  }
}
