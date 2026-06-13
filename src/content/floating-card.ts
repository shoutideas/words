import type { WordLookup, LookupMessage, LookupResponse } from '../lib/types';
import { speakWord } from '../lib/pronounce';
import { addWord, isWordSaved, removeWord } from '../lib/storage';
import cardStyles from '../styles/card.css?inline';

type TabId = 'def' | 'syn' | 'ant' | 'use';

export class FloatingCard {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private card: HTMLDivElement;
  private currentWord: string | null = null;
  private lookup: WordLookup | null = null;
  private activeTab: TabId = 'def';
  private exampleIndex = 0;
  private saved = false;
  private onDismiss: () => void;
  private outsideHandler: (e: MouseEvent) => void;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onDismiss: () => void) {
    this.onDismiss = onDismiss;

    this.host = document.createElement('div');
    this.host.className = 'words-card-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = cardStyles;
    this.shadow.appendChild(style);

    this.card = document.createElement('div');
    this.card.className = 'words-card';
    this.shadow.appendChild(this.card);

    this.outsideHandler = (e: MouseEvent) => {
      const path = e.composedPath();
      if (!path.includes(this.host)) {
        this.dismiss();
      }
    };

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.dismiss();
    };
  }

  getWord(): string | null {
    return this.currentWord;
  }

  isMounted(): boolean {
    return document.body.contains(this.host);
  }

  async show(
    text: string,
    x: number,
    y: number,
    isPhrase: boolean,
  ): Promise<void> {
    if (this.currentWord?.toLowerCase() === text.toLowerCase() && this.isMounted()) {
      return;
    }

    this.currentWord = text;
    this.lookup = null;
    this.activeTab = 'def';
    this.exampleIndex = 0;

    if (!this.isMounted()) {
      document.body.appendChild(this.host);
      setTimeout(() => {
        document.addEventListener('mousedown', this.outsideHandler);
        document.addEventListener('keydown', this.keyHandler);
      }, 0);
    }

    this.position(x, y);
    this.renderLoading();

    const response = await this.fetchLookup(text);

    if (response.ok === false) {
      if (isPhrase && response.error === 'not_found') {
        this.renderError('Select one word');
      } else if (response.error === 'not_found') {
        this.renderError('Word not found');
      } else {
        this.renderError('Could not load definition. Check your connection.');
      }
      return;
    }

    this.lookup = response.data;
    this.saved = await isWordSaved(this.lookup.word);
    this.renderCard();
  }

  dismiss(): void {
    document.removeEventListener('mousedown', this.outsideHandler);
    document.removeEventListener('keydown', this.keyHandler);
    this.host.remove();
    this.currentWord = null;
    this.lookup = null;
    this.onDismiss();
  }

  private position(x: number, y: number): void {
    const margin = 12;
    const cardWidth = 320;
    const cardHeight = 280;

    let left = x;
    let top = y + 12;

    if (left + cardWidth > window.innerWidth - margin) {
      left = window.innerWidth - cardWidth - margin;
    }
    if (left < margin) left = margin;

    if (top + cardHeight > window.innerHeight - margin) {
      top = y - cardHeight - 12;
    }
    if (top < margin) top = margin;

    this.host.style.left = `${left}px`;
    this.host.style.top = `${top}px`;
  }

  private fetchLookup(word: string): Promise<LookupResponse> {
    return new Promise((resolve) => {
      const message: LookupMessage = { type: 'LOOKUP', word };
      chrome.runtime.sendMessage(message, (response: LookupResponse) => {
        if (chrome.runtime.lastError || !response) {
          resolve({ ok: false, error: 'network' });
          return;
        }
        resolve(response);
      });
    });
  }

  private renderLoading(): void {
    this.card.innerHTML = `<div class="words-loading">Looking up…</div>`;
  }

  private renderError(message: string): void {
    this.card.innerHTML = `
      <div class="words-error">${message}</div>
      <div style="text-align:center;padding-bottom:12px">
        <button class="words-btn-icon" data-action="close" title="Close">✕</button>
      </div>
    `;
    this.card.querySelector('[data-action="close"]')?.addEventListener('click', () =>
      this.dismiss(),
    );
  }

  private renderCard(): void {
    if (!this.lookup) return;
    const lookup = this.lookup;

    this.card.innerHTML = `
      <div class="words-card-header">
        <span class="words-card-title">${escapeHtml(lookup.word)}</span>
        <div class="words-card-actions">
          <button class="words-btn-icon ${this.saved ? 'words-btn-added' : 'words-btn-add'}" data-action="toggle" title="${this.saved ? 'Added' : 'Add word'}">${this.saved ? '✓' : '+'}</button>
          <button class="words-btn-icon" data-action="speak" title="Pronounce">🔊</button>
          <button class="words-btn-icon" data-action="close" title="Close">✕</button>
        </div>
      </div>
      ${lookup.phonetic ? `<div class="words-phonetic">${escapeHtml(lookup.phonetic)}</div>` : ''}
      <div class="words-card-body">
        <div class="words-tabs">
          <button class="words-tab ${this.activeTab === 'def' ? 'words-tab-active' : ''}" data-tab="def">Def</button>
          <button class="words-tab ${this.activeTab === 'syn' ? 'words-tab-active' : ''}" data-tab="syn">Syn</button>
          <button class="words-tab ${this.activeTab === 'ant' ? 'words-tab-active' : ''}" data-tab="ant">Ant</button>
          <button class="words-tab ${this.activeTab === 'use' ? 'words-tab-active' : ''}" data-tab="use">Use</button>
        </div>
        <div class="words-tab-panel">${this.renderTabPanel()}</div>
      </div>
    `;

    this.card.querySelector('[data-action="toggle"]')?.addEventListener('click', () =>
      this.toggleSave(),
    );
    this.card.querySelector('[data-action="speak"]')?.addEventListener('click', () =>
      speakWord(lookup.word),
    );
    this.card.querySelector('[data-action="close"]')?.addEventListener('click', () =>
      this.dismiss(),
    );

    this.card.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeTab = (btn as HTMLElement).dataset.tab as TabId;
        this.renderCard();
      });
    });

    this.card.querySelector('[data-action="refresh-example"]')?.addEventListener('click', () => {
      if (!this.lookup?.examples.length) return;
      this.exampleIndex = (this.exampleIndex + 1) % this.lookup.examples.length;
      this.renderCard();
    });
  }

  private renderTabPanel(): string {
    if (!this.lookup) return '';

    switch (this.activeTab) {
      case 'def':
        return `
          <div class="words-pos-def">
            ${this.lookup.partOfSpeech ? `<div class="words-pos">${escapeHtml(this.lookup.partOfSpeech)}</div>` : ''}
            <div>${escapeHtml(this.lookup.definition)}</div>
          </div>
        `;
      case 'syn':
        if (!this.lookup.synonyms.length) {
          return '<div class="words-pos-def">No synonyms found.</div>';
        }
        return `<div class="words-chips">${this.lookup.synonyms.map((s) => `<span class="words-chip">${escapeHtml(s)}</span>`).join('')}</div>`;
      case 'ant':
        if (!this.lookup.antonyms.length) {
          return '<div class="words-pos-def">No antonyms found.</div>';
        }
        return `<div class="words-chips">${this.lookup.antonyms.map((s) => `<span class="words-chip">${escapeHtml(s)}</span>`).join('')}</div>`;
      case 'use': {
        const examples = this.lookup.examples;
        const example =
          examples.length > 0
            ? examples[this.exampleIndex % examples.length]
            : `Use "${this.lookup.word}" in your own sentence.`;
        return `
          <div class="words-example">${escapeHtml(example)}</div>
          ${examples.length > 1 ? '<div class="words-refresh-row"><button class="words-btn-refresh" data-action="refresh-example">↻ New sentence</button></div>' : examples.length === 0 ? '<div class="words-refresh-row"><button class="words-btn-refresh" data-action="refresh-example">↻ New sentence</button></div>' : ''}
        `;
      }
    }
  }

  private async toggleSave(): Promise<void> {
    if (!this.lookup) return;

    if (this.saved) {
      await removeWord(this.lookup.word);
      this.saved = false;
    } else {
      await addWord(this.lookup, window.location.href);
      this.saved = true;
      this.showToast('Added to Words');
    }
    this.renderCard();
  }

  private showToast(message: string): void {
    const existing = this.shadow.querySelector('.words-toast');
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
