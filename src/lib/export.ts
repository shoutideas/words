import type { SavedWord } from './types';

function formatDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function exportWordsToTxt(words: SavedWord[]): Blob {
  const exportDate = new Date().toISOString().slice(0, 10);
  const sorted = [...words].sort((a, b) => a.savedAt - b.savedAt);

  const lines: string[] = [
    `Words — exported ${exportDate}`,
    '============================',
    '',
  ];

  sorted.forEach((word, index) => {
    lines.push(`${index + 1}. ${word.word}`);
    if (word.partOfSpeech) {
      lines.push(`   Part of speech: ${word.partOfSpeech}`);
    }
    if (word.phonetic) {
      lines.push(`   Phonetic: ${word.phonetic}`);
    }
    lines.push(`   Definition: ${word.definition}`);
    lines.push(`   Added: ${formatDate(word.savedAt)}`);
    if (word.sourceUrl) {
      lines.push(`   Source: ${word.sourceUrl}`);
    }
    lines.push('');
  });

  lines.push('---');
  lines.push(`Total: ${sorted.length} words`);

  return new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
}

export function downloadTxt(blob: Blob, filename?: string): void {
  const date = new Date().toISOString().slice(0, 10);
  const name = filename ?? `words-${date}.txt`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}
