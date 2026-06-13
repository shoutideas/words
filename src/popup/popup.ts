import { lookupWord, lookupFromSaved } from '../lib/dictionary';
import type { SavedWord } from '../lib/types';
import { getSavedWords } from '../lib/storage';
import { exportWordsToTxt, downloadTxt } from '../lib/export';
import { WordCard } from '../ui/word-card';
import { iconSearch } from '../ui/icons';

const searchInput = document.getElementById('search') as HTMLInputElement;
const resultEl = document.getElementById('result') as HTMLDivElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const errorEl = document.getElementById('error') as HTMLDivElement;
const detailEl = document.getElementById('detail') as HTMLDivElement;
const detailCardEl = document.getElementById('detail-card') as HTMLDivElement;
const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
const savedTitle = document.getElementById('saved-title') as HTMLDivElement;
const savedList = document.getElementById('saved-list') as HTMLUListElement;
const savedEmpty = document.getElementById('saved-empty') as HTMLDivElement;
const exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
const searchIconEl = document.querySelector('.popup-search-icon') as HTMLSpanElement;

let resultCard: WordCard | null = null;
let detailCard: WordCard | null = null;
let detailMode: 'list' | 'word' = 'list';
let searchTimeout: ReturnType<typeof setTimeout> | null = null;

searchIconEl.innerHTML = iconSearch();

function handleLookupWord(word: string): void {
  if (detailMode === 'word') {
    void openWordDetail(word);
    return;
  }
  searchInput.value = word;
  void doSearch(word);
}

function hideAll(): void {
  resultEl.classList.add('hidden');
  statusEl.classList.add('hidden');
  errorEl.classList.add('hidden');
}

function showError(message: string): void {
  hideAll();
  resultCard?.destroy();
  resultCard = null;
  errorEl.textContent = message;
  errorEl.classList.remove('hidden');
}

function showListView(): void {
  detailMode = 'list';
  document.body.classList.remove('popup-expanded');
  detailEl.classList.add('hidden');
  detailCard?.destroy();
  detailCard = null;
}

function ensureResultCard(): WordCard {
  if (!resultCard) {
    resultEl.innerHTML = '';
    resultCard = new WordCard(resultEl, {
      mode: 'embedded',
      onSavedChange: () => void renderSavedList(),
      onLookupWord: handleLookupWord,
    });
  }
  return resultCard;
}

function ensureDetailCard(): WordCard {
  if (!detailCard) {
    detailCardEl.innerHTML = '';
    detailCard = new WordCard(detailCardEl, {
      mode: 'embedded',
      onSavedChange: () => void renderSavedList(),
      onLookupWord: handleLookupWord,
    });
  }
  return detailCard;
}

async function openWordDetail(word: string): Promise<void> {
  detailMode = 'word';
  document.body.classList.add('popup-expanded');
  hideAll();
  detailEl.classList.remove('hidden');

  const card = ensureDetailCard();
  card.showLoading();

  try {
    const lookup = await lookupWord(word);
    if (lookup) {
      await card.showLookup(lookup);
    } else {
      card.showError('Word not found');
    }
  } catch {
    card.showError('Could not load definition. Check your connection.');
  }
}

async function openSavedWord(saved: SavedWord): Promise<void> {
  detailMode = 'word';
  document.body.classList.add('popup-expanded');
  hideAll();
  detailEl.classList.remove('hidden');

  const card = ensureDetailCard();
  card.showLoading();

  try {
    const lookup = await lookupWord(saved.word);
    if (lookup) {
      await card.showLookup(lookup);
    } else {
      await card.showLookup(
        lookupFromSaved(saved.word, saved.phonetic, saved.partOfSpeech, saved.definition),
      );
    }
  } catch {
    await card.showLookup(
      lookupFromSaved(saved.word, saved.phonetic, saved.partOfSpeech, saved.definition),
    );
  }
}

async function doSearch(word: string): Promise<void> {
  const trimmed = word.trim();
  if (!trimmed) {
    hideAll();
    resultCard?.destroy();
    resultCard = null;
    return;
  }

  showListView();
  hideAll();
  statusEl.classList.remove('hidden');

  try {
    const result = await lookupWord(trimmed);
    if (!result) {
      showError('Word not found');
      return;
    }
    const card = ensureResultCard();
    await card.showLookup(result);
    statusEl.classList.add('hidden');
    resultEl.classList.remove('hidden');
  } catch {
    showError('Could not load definition. Check your connection.');
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
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
      void openSavedWord(word);
    });

    li.appendChild(btn);
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

backBtn.addEventListener('click', () => {
  showListView();
});

exportBtn.addEventListener('click', async () => {
  const words = await getSavedWords();
  if (words.length === 0) return;
  const blob = exportWordsToTxt(words);
  downloadTxt(blob);
});

document.addEventListener('words:saved-change', () => {
  void renderSavedList();
  const lookup = resultCard?.getLookup();
  if (lookup) void resultCard?.showLookup(lookup);
  const detailLookup = detailCard?.getLookup();
  if (detailLookup) void detailCard?.showLookup(detailLookup);
});

async function enableOnActiveTab(): Promise<void> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url || !/^https?:/i.test(tab.url)) return;
    await chrome.runtime.sendMessage({ type: 'ENSURE_CONTENT', tabId: tab.id });
  } catch {
    // Popup opened on a restricted page, or extension context invalidated.
  }
}

void renderSavedList();
void enableOnActiveTab();
