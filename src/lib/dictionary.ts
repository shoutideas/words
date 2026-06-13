import type { DefinitionEntry, WordLookup } from './types';

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

interface ApiPhonetic {
  text?: string;
  audio?: string;
}

interface ApiEntry {
  word: string;
  phonetic?: string;
  phonetics?: ApiPhonetic[];
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

function pickAudioUrl(phonetics: ApiPhonetic[]): string | undefined {
  const withAudio = phonetics.filter((p) => p.audio);
  const us = withAudio.find(
    (p) => p.audio!.includes('-us') || p.audio!.toLowerCase().includes('us.mp3'),
  );
  if (us?.audio) return us.audio;
  const uk = withAudio.find(
    (p) => p.audio!.includes('-uk') || p.audio!.toLowerCase().includes('uk.mp3'),
  );
  if (uk?.audio) return uk.audio;
  return withAudio[0]?.audio;
}

function parseEntry(entry: ApiEntry): WordLookup {
  const definitions: DefinitionEntry[] = [];
  const synonyms: string[] = [];
  const antonyms: string[] = [];
  const examples: string[] = [];

  for (const meaning of entry.meanings) {
    if (meaning.synonyms) synonyms.push(...meaning.synonyms);
    if (meaning.antonyms) antonyms.push(...meaning.antonyms);

    for (const def of meaning.definitions) {
      definitions.push({
        partOfSpeech: meaning.partOfSpeech,
        definition: def.definition,
        example: def.example,
        synonyms: def.synonyms ?? [],
        antonyms: def.antonyms ?? [],
      });
      if (def.synonyms) synonyms.push(...def.synonyms);
      if (def.antonyms) antonyms.push(...def.antonyms);
      if (def.example) examples.push(def.example);
    }
  }

  const primary = definitions[0];
  const phonetic =
    entry.phonetic ||
    entry.phonetics?.find((p) => p.text)?.text ||
    undefined;
  const audioUrl = pickAudioUrl(entry.phonetics ?? []);

  return {
    word: entry.word,
    phonetic,
    audioUrl,
    partOfSpeech: primary?.partOfSpeech,
    definition: primary?.definition ?? 'No definition available.',
    definitions,
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

export function lookupFromSaved(
  word: string,
  phonetic?: string,
  partOfSpeech?: string,
  definition?: string,
): WordLookup {
  return {
    word,
    phonetic,
    partOfSpeech,
    definition: definition ?? '',
    definitions: partOfSpeech
      ? [{ partOfSpeech, definition: definition ?? '', synonyms: [], antonyms: [] }]
      : [],
    synonyms: [],
    antonyms: [],
    examples: [],
  };
}
