import { lookupWord } from '../lib/dictionary';
import type { WordLookup } from '../lib/types';
import {
  getSavedWords,
  isWordSaved,
  addWord,
  removeWord,
  clearAll,
} from '../lib/storage';
import { exportWordsToTxt, downloadTxt } from '../lib/export';
import { speakWord } from '../lib/pronounce';

const searchInput = document.getElementById('search') as HTMLInputElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const savedTitle = document.getElementById('saved-title') as HTMLDivElement;
const savedList = document.getElementById('saved-list') as HTMLUListElement;
const savedEmpty = document.getElementById('saved-empty') as HTMLDivElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const clearBtn = document.getElementById('clear-btn') as HTMLButtonElement;

let currentLookup: WordLookup | null = null;
let currentSaved = false;
let exampleIndex = 0;
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

function hideAll(): void {
  resultEl.classList.add('hidden');
  statusEl.classList.add('hidden');
  errorEl.classList.add('hidden');
}

function showError(message: string): void {
  hideAll();
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function renderLookup(lookup: WordLookup): Promise<void> {
  currentLookup = lookup;
  exampleIndex = 0;
  currentSaved = await isWordSaved(lookup.word);

  const examples = lookup.examples;
  const example =
    examples.length > 0
      ? examples[exampleIndex]
      : `"Use ${lookup.word} in a sentence."`;

  resultEl.innerHTML = `
    <div class="popup-word-row">
      <span class="popup-word">${escapeHtml(lookup.word)}</span>
      <button type="button" class="popup-btn-icon" id="speak-btn" title="Pronounce">🔊</button>
      <button type="button" class="popup-btn-icon ${currentSaved ? 'popup-btn-added' : ''}" id="toggle-btn" title="${currentSaved ? 'Added' : 'Add word'}">${currentSaved ? '✓' : '+'}</button>
    </div>
    ${lookup.phonetic ? `<div class="popup-phonetic">${escapeHtml(lookup.phonetic)}</div>` : ''}
    <div class="popup-def">${lookup.partOfSpeech ? `<em>${escapeHtml(lookup.partOfSpeech)}</em> · ` : ''}${escapeHtml(lookup.definition)}</div>
    ${lookup.synonyms.length ? `<div class="popup-meta">Syn · ${escapeHtml(lookup.synonyms.slice(0, 5).join(', '))}</div>` : ''}
    ${lookup.antonyms.length ? `<div class="popup-meta">Ant · ${escapeHtml(lookup.antonyms.slice(0, 5).join(', '))}</div>` : ''}
    <div class="popup-example">
      <span id="example-text">${escapeHtml(example)}</span>
      <button type="button" class="popup-btn-icon" id="refresh-example" title="Another sentence">↻</button>
    </div>
  `;

  hideAll();
  resultEl.classList.remove('hidden');

  document.getElementById('speak-btn')?.addEventListener('click', () => speakWord(lookup.word));
  document.getElementById('toggle-btn')?.addEventListener('click', async () => {
    if (currentSaved) {
      await removeWord(lookup.word);
      currentSaved = false;
    } else {
      await addWord(lookup);
      currentSaved = true;
    }
    await renderLookup(lookup);
    await renderSavedList();
  });
  document.getElementById('refresh-example')?.addEventListener('click', () => {
    if (!currentLookup) return;
    const ex = currentLookup.examples;
    if (ex.length > 1) {
      exampleIndex = (exampleIndex + 1) % ex.length;
      const el = document.getElementById('example-text');
      if (el) el.textContent = ex[exampleIndex];
    }
  });
}

async function doSearch(word: string): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) {
    hideAll();
    return;
  }

  hideAll();
  statusEl.classList.remove('hidden');

  try {
    const result = await lookupWord(trimmed);
    if (!result) {
      showError('Word not found');
      return;
    }
    await renderLookup(result);
  } catch {
    showError('Could not load definition. Check your connection.');
  }
}

async function renderSavedList(): Promise<void> {
  const words = await getSavedWords();
  savedTitle.textContent = `MY WORDS (${words.length})`;
  savedList.innerHTML = '';

  if (words.length === 0) {
    savedEmpty.classList.remove('hidden');
    return;
  }

  savedEmpty.classList.add('hidden');

  for (const word of words) {
    const li = document.createElement('li');
    li.className = 'popup-word-item';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = `<span>· ${escapeHtml(word.word)}</span>`;
    btn.addEventListener('click', () => {
      const detail = li.querySelector('.popup-word-detail');
      detail?.classList.toggle('open');
    });

    const detail = document.createElement('div');
    detail.className = 'popup-word-detail';
    detail.innerHTML = `
      ${word.phonetic ? `<div>${escapeHtml(word.phonetic)} <button type="button" class="popup-btn-icon speak-saved" data-word="${escapeHtml(word.word)}">🔊</button></div>` : `<button type="button" class="popup-btn-icon speak-saved" data-word="${escapeHtml(word.word)}">🔊</button>`}
      <div>${word.partOfSpeech ? `<em>${escapeHtml(word.partOfSpeech)}</em> · ` : ''}${escapeHtml(word.definition)}</div>
      <div style="margin-top:4px;font-size:12px">Added ${new Date(word.savedAt).toISOString().slice(0, 10)}</div>
    `;

    detail.querySelectorAll('.speak-saved').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        speakWord((el as HTMLElement).dataset.word ?? word.word);
      });
    });

    li.appendChild(btn);
    li.appendChild(detail);
    savedList.appendChild(li);
  }
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    if (searchTimeout) clearTimeout(searchTimeout);
    void doSearch(searchInput.value);
  }
});

searchInput.addEventListener('input', () => {
  if (searchTimeout) clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    void doSearch(searchInput.value);
  }, 400);
});

exportBtn.addEventListener('click', async () => {
  const words = await getSavedWords();
  if (words.length === 0) return;
  const blob = exportWordsToTxt(words);
  downloadTxt(blob);
});

clearBtn.addEventListener('click', async () => {
  const words = await getSavedWords();
  if (words.length === 0) return;
  if (!confirm(`Remove all ${words.length} saved words?`)) return;
  await clearAll();
  await renderSavedList();
});

void renderSavedList();
