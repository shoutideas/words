import type { WordLookup } from '../lib/types';
import { speakWord } from '../lib/pronounce';
import { addWord, isWordSaved, removeWord } from '../lib/storage';
import { iconClose, iconRefresh, iconSpeaker } from './icons';

export type TabId = 'def' | 'syn' | 'ant' | 'use';
export type WordCardMode = 'floating' | 'embedded' | 'sheet';

export interface WordCardOptions {
  mode: WordCardMode;
  onClose?: () => void;
  onSavedChange?: () => void;
  onLookupWord?: (word: string) => void;
  sourceUrl?: string;
}

export class WordCard {
  private root: HTMLElement;
  private card: HTMLDivElement;
  private options: WordCardOptions;
  private lookup: WordLookup | null = null;
  private activeTab: TabId = 'def';
  private exampleIndex = 0;
  private saved = false;

  constructor(mount: HTMLElement, options: WordCardOptions) {
    this.root = mount;
    this.options = options;
    this.card = document.createElement('div');
    this.card.className = this.cardClassName();
    mount.appendChild(this.card);
  }

  getLookup(): WordLookup | null {
    return this.lookup;
  }

  showLoading(): void {
    this.lookup = null;
    this.card.innerHTML = `<div class="words-loading">Looking up…</div>`;
  }

  showError(message: string): void {
    this.lookup = null;
    const closeBtn =
      this.options.mode !== 'embedded'
        ? `<button class="words-btn-icon" data-action="close" title="Close" type="button">${iconClose()}</button>`
        : '';
    this.card.innerHTML = `
      <div class="words-error">${escapeHtml(message)}</div>
      ${closeBtn ? `<div style="text-align:center;padding-bottom:12px">${closeBtn}</div>` : ''}
    `;
    this.bindClose();
  }

  async showLookup(lookup: WordLookup): Promise<void> {
    this.lookup = lookup;
    this.activeTab = 'def';
    this.exampleIndex = 0;
    this.saved = await isWordSaved(lookup.word);
    this.render();
  }

  destroy(): void {
    this.root.innerHTML = '';
  }

  private cardClassName(): string {
    const base = 'words-card';
    if (this.options.mode === 'embedded') return `${base} words-card-embedded`;
    if (this.options.mode === 'sheet') return `${base} words-card-sheet`;
    return base;
  }

  private render(): void {
    if (!this.lookup) return;
    const lookup = this.lookup;
    const showClose = this.options.mode !== 'embedded';

    this.card.innerHTML = `
      <div class="words-card-header">
        <span class="words-card-title">${escapeHtml(lookup.word)}</span>
        <div class="words-card-actions">
          <button class="words-btn-icon ${this.saved ? 'words-btn-added' : 'words-btn-add'}" data-action="toggle" title="${this.saved ? 'Added' : 'Add word'}" type="button">${this.saved ? '✓' : '+'}</button>
          <button class="words-btn-icon" data-action="speak" title="Pronounce" type="button">${iconSpeaker()}</button>
          ${showClose ? `<button class="words-btn-icon" data-action="close" title="Close" type="button">${iconClose()}</button>` : ''}
        </div>
      </div>
      ${lookup.phonetic ? `<div class="words-phonetic">${escapeHtml(lookup.phonetic)}</div>` : ''}
      <div class="words-card-body">
        <div class="words-tabs">
          <button class="words-tab ${this.activeTab === 'def' ? 'words-tab-active' : ''}" data-tab="def" type="button">Def</button>
          <button class="words-tab ${this.activeTab === 'syn' ? 'words-tab-active' : ''}" data-tab="syn" type="button">Syn</button>
          <button class="words-tab ${this.activeTab === 'ant' ? 'words-tab-active' : ''}" data-tab="ant" type="button">Ant</button>
          <button class="words-tab ${this.activeTab === 'use' ? 'words-tab-active' : ''}" data-tab="use" type="button">Use</button>
        </div>
        <div class="words-tab-panel">${this.renderTabPanel()}</div>
      </div>
    `;

    this.card.querySelector('[data-action="toggle"]')?.addEventListener('click', () =>
      void this.toggleSave(),
    );
    this.card.querySelector('[data-action="speak"]')?.addEventListener('click', () =>
      void speakWord(lookup.word, lookup.audioUrl),
    );
    this.bindClose();

    this.card.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.tab as TabId;
        this.render();
      });
    });

    this.card.querySelector('[data-action="refresh-example"]')?.addEventListener('click', () => {
      if (!this.lookup?.examples.length) return;
      this.exampleIndex = (this.exampleIndex + 1) % this.lookup.examples.length;
      this.render();
    });

    this.bindChipLookups();
  }

  private bindChipLookups(): void {
    if (!this.options.onLookupWord || !this.lookup) return;

    this.card.querySelectorAll('[data-action="lookup-chip"]').forEach((el) => {
      el.addEventListener('click', () => {
        const word = (el as HTMLElement).dataset.word;
        if (!word) return;
        if (word.toLowerCase() === this.lookup!.word.toLowerCase()) return;
        this.options.onLookupWord?.(word);
      });
    });
  }

  private bindClose(): void {
    this.card.querySelector('[data-action="close"]')?.addEventListener('click', () => {
      this.options.onClose?.();
    });
  }

  private renderTabPanel(): string {
    if (!this.lookup) return '';

    switch (this.activeTab) {
      case 'def':
        if (!this.lookup.definitions.length) {
          return `<div class="words-def-block"><div>${escapeHtml(this.lookup.definition)}</div></div>`;
        }
        return `<div class="words-def-stack">${this.lookup.definitions
          .map(
            (d) => `
          <div class="words-def-block">
            <div class="words-pos">${escapeHtml(d.partOfSpeech)}</div>
            <div>${escapeHtml(d.definition)}</div>
          </div>`,
          )
          .join('')}</div>`;
      case 'syn':
        if (!this.lookup.synonyms.length) {
          return '<div class="words-empty-tab">No synonyms found.</div>';
        }
        return `<div class="words-chips">${this.renderChips(this.lookup.synonyms)}</div>`;
      case 'ant':
        if (!this.lookup.antonyms.length) {
          return '<div class="words-empty-tab">No antonyms found.</div>';
        }
        return `<div class="words-chips">${this.renderChips(this.lookup.antonyms)}</div>`;
      case 'use': {
        const examples = this.lookup.examples;
        const example =
          examples.length > 0
            ? examples[this.exampleIndex % examples.length]
            : `Use "${this.lookup.word}" in your own sentence.`;
        const showRefresh = examples.length !== 1;
        return `
          <div class="words-example">${escapeHtml(example)}</div>
          ${showRefresh ? `<div class="words-refresh-row"><button class="words-btn-refresh" data-action="refresh-example" type="button">${iconRefresh()} New sentence</button></div>` : ''}
        `;
      }
    }
  }

  private renderChips(words: string[]): string {
    const canLookup = Boolean(this.options.onLookupWord);
    return words
      .map((s) => {
        const label = escapeHtml(s);
        if (!canLookup) {
          return `<span class="words-chip">${label}</span>`;
        }
        return `<button type="button" class="words-chip" data-action="lookup-chip" data-word="${escapeAttr(s)}" title="Look up ${label}">${label}</button>`;
      })
      .join('');
  }

  private async toggleSave(): Promise<void> {
    if (!this.lookup) return;

    if (this.saved) {
      await removeWord(this.lookup.word);
      this.saved = false;
    } else {
      await addWord(this.lookup, this.options.sourceUrl);
      this.saved = true;
      this.showToast('Added to Words');
    }
    this.options.onSavedChange?.();
    this.render();
  }

  private showToast(message: string): void {
    const existing = this.root.querySelector('.words-toast');
    existing?.remove();

    const toast = document.createElement('div');
    toast.className = 'words-toast';
    toast.textContent = message;
    this.card.style.position = 'relative';
    this.card.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function escapeAttr(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
