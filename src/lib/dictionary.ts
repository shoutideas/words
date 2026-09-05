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

interface WikiDefinition {
  definition: string;
  examples?: string[];
}

interface WikiMeaning {
  partOfSpeech: string;
  definitions: WikiDefinition[];
}

interface DatamuseEntry {
  word: string;
  defs?: string[];
}

const DICT_API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en';
const WIKTIONARY_API_BASE =
  'https://en.wiktionary.org/api/rest_v1/page/definition';
const DATAMUSE_API_BASE = 'https://api.datamuse.com/words';
const UA = 'Words/1.1.8 (https://www.funthinkers.com)';
const DICT_TIMEOUT_MS = 2500;
const WIKI_TIMEOUT_MS = 6000;
const DATAMUSE_TIMEOUT_MS = 5000;
const DATAMUSE_POS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
};

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

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Api-User-Agent': UA,
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

function shouldFallback(status: number): boolean {
  return status === 522 || status >= 500;
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

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWiktionary(
  word: string,
  payload: Record<string, WikiMeaning[]>,
): WordLookup | null {
  const meanings = payload.en;
  if (!meanings?.length) return null;

  const definitions: DefinitionEntry[] = [];
  const examples: string[] = [];

  for (const meaning of meanings) {
    const pos = meaning.partOfSpeech?.toLowerCase() ?? '';
    for (const def of meaning.definitions ?? []) {
      const text = stripHtml(def.definition ?? '');
      if (!text) continue;
      definitions.push({
        partOfSpeech: pos,
        definition: text,
        synonyms: [],
        antonyms: [],
      });
      if (def.examples) {
        for (const example of def.examples) {
          const cleaned = stripHtml(example);
          if (cleaned) examples.push(cleaned);
        }
      }
    }
  }

  if (!definitions.length) return null;

  const primary = definitions[0];
  return {
    word,
    partOfSpeech: primary.partOfSpeech,
    definition: primary.definition,
    definitions,
    synonyms: [],
    antonyms: [],
    examples: uniqueStrings(examples),
  };
}

function parseDatamuse(word: string, rows: DatamuseEntry[]): WordLookup | null {
  const row = rows.find((entry) => entry.defs?.length) ?? rows[0];
  if (!row?.defs?.length) return null;

  const definitions: DefinitionEntry[] = [];
  for (const raw of row.defs) {
    const tab = raw.indexOf('\t');
    const posKey = tab >= 0 ? raw.slice(0, tab).trim() : '';
    const text = (tab >= 0 ? raw.slice(tab + 1) : raw).trim();
    if (!text) continue;
    definitions.push({
      partOfSpeech: DATAMUSE_POS[posKey] ?? posKey,
      definition: text,
      synonyms: [],
      antonyms: [],
    });
  }

  if (!definitions.length) return null;

  const primary = definitions[0];
  return {
    word: row.word || word,
    partOfSpeech: primary.partOfSpeech,
    definition: primary.definition,
    definitions,
    synonyms: [],
    antonyms: [],
    examples: [],
  };
}

async function lookupFromDictionaryApi(encoded: string): Promise<WordLookup | null> {
  const res = await fetchWithTimeout(
    `${DICT_API_BASE}/${encoded}`,
    DICT_TIMEOUT_MS,
  );
  if (res.status === 404) return null;
  if (shouldFallback(res.status) || !res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const data = (await res.json()) as ApiEntry[];
  if (!data.length) return null;
  return parseEntry(data[0]);
}

async function lookupFromWiktionary(
  word: string,
  encoded: string,
): Promise<WordLookup | null> {
  const res = await fetchWithTimeout(
    `${WIKTIONARY_API_BASE}/${encoded}`,
    WIKI_TIMEOUT_MS,
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, WikiMeaning[]>;
  return parseWiktionary(word, data);
}

async function lookupFromDatamuse(word: string): Promise<WordLookup | null> {
  const url = `${DATAMUSE_API_BASE}?sp=${encodeURIComponent(word)}&md=d&max=1`;
  const res = await fetchWithTimeout(url, DATAMUSE_TIMEOUT_MS);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as DatamuseEntry[];
  return parseDatamuse(word, data);
}

function firstSuccessfulLookup(
  sources: Array<Promise<WordLookup | null>>,
): Promise<WordLookup | null> {
  return new Promise((resolve, reject) => {
    let remaining = sources.length;
    let misses = 0;
    let settled = false;

    const finish = (value: WordLookup | null, network: boolean) => {
      if (settled) return;
      settled = true;
      if (network) reject(new Error('network'));
      else resolve(value);
    };

    for (const source of sources) {
      source.then(
        (value) => {
          if (value) {
            finish(value, false);
            return;
          }
          misses += 1;
          remaining -= 1;
          if (remaining === 0) finish(null, false);
        },
        () => {
          remaining -= 1;
          if (remaining === 0) finish(null, misses === 0);
        },
      );
    }
  });
}

export async function lookupWord(word: string): Promise<WordLookup | null> {
  const query = word.trim().toLowerCase();
  const encoded = encodeURIComponent(query);
  if (!encoded) return null;

  return firstSuccessfulLookup([
    lookupFromWiktionary(query, encoded),
    lookupFromDatamuse(query),
    lookupFromDictionaryApi(encoded),
  ]);
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
