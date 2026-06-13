import type { LookupMessage, LookupResponse } from '../lib/types';
import {
  CONTEXT_INVALIDATED_MESSAGE,
  isContextInvalidatedError,
  isExtensionContextValid,
} from '../lib/extension-context';
import { WordCard } from '../ui/word-card';
import wordCardStyles from '../ui/word-card.css?inline';

export class FloatingCard {
  private host: HTMLDivElement;
  private shadow: ShadowRoot;
  private mount: HTMLDivElement;
  private card: WordCard | null = null;
  private currentWord: string | null = null;
  private lastX = 0;
  private lastY = 0;
  private onDismiss: () => void;
  private outsideHandler: (e: MouseEvent) => void;
  private keyHandler: (e: KeyboardEvent) => void;

  constructor(onDismiss: () => void) {
    this.onDismiss = onDismiss;

    this.host = document.createElement('div');
    this.host.className = 'words-card-host';
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = wordCardStyles;
    this.shadow.appendChild(style);

    this.mount = document.createElement('div');
    this.shadow.appendChild(this.mount);

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
    try {
      if (this.currentWord?.toLowerCase() === text.toLowerCase() && this.isMounted()) {
        return;
      }

      if (!isExtensionContextValid()) {
        this.mountCardIfNeeded(x, y);
        this.card?.showError(CONTEXT_INVALIDATED_MESSAGE);
        return;
      }

      this.currentWord = text;
      this.lastX = x;
      this.lastY = y;

      this.mountCardIfNeeded(x, y);
      this.ensureCard();
      this.card!.showLoading();

      const response = await this.fetchLookup(text);

      if (!this.isMounted() || !this.card) return;

      if (response.ok === false) {
        if (response.error === 'context_invalidated') {
          this.card.showError(CONTEXT_INVALIDATED_MESSAGE);
        } else if (isPhrase && response.error === 'not_found') {
          this.card.showError('Select one word');
        } else if (response.error === 'not_found') {
          this.card.showError('Word not found');
        } else {
          this.card.showError('Could not load definition. Check your connection.');
        }
        return;
      }

      await this.card.showLookup(response.data);
    } catch {
      if (!this.isMounted() || !this.card) return;
      this.card.showError(CONTEXT_INVALIDATED_MESSAGE);
    }
  }

  dismiss(): void {
    document.removeEventListener('mousedown', this.outsideHandler);
    document.removeEventListener('keydown', this.keyHandler);
    this.card?.destroy();
    this.card = null;
    this.host.remove();
    this.currentWord = null;
    this.onDismiss();
  }

  private mountCardIfNeeded(x: number, y: number): void {
    if (!this.isMounted()) {
      const body = document.body;
      if (!body) return;
      body.appendChild(this.host);
      setTimeout(() => {
        document.addEventListener('mousedown', this.outsideHandler);
        document.addEventListener('keydown', this.keyHandler);
      }, 0);
    }
    this.position(x, y);
    this.ensureCard();
  }

  private ensureCard(): void {
    if (this.card) return;
    this.mount.innerHTML = '';
    this.card = new WordCard(this.mount, {
      mode: 'floating',
      onClose: () => this.dismiss(),
      sourceUrl: window.location.href,
      onLookupWord: (w) => {
        void this.show(w, this.lastX, this.lastY, false);
      },
    });
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
    if (!isExtensionContextValid()) {
      return Promise.resolve({ ok: false, error: 'context_invalidated' });
    }

    return new Promise((resolve) => {
      try {
        const message: LookupMessage = { type: 'LOOKUP', word };
        chrome.runtime.sendMessage(message, (response: LookupResponse) => {
          const lastError = chrome.runtime.lastError;
          if (lastError) {
            resolve({
              ok: false,
              error: isContextInvalidatedError(lastError.message)
                ? 'context_invalidated'
                : 'network',
            });
            return;
          }
          if (!response) {
            resolve({ ok: false, error: 'network' });
            return;
          }
          resolve(response);
        });
      } catch {
        resolve({ ok: false, error: 'context_invalidated' });
      }
    });
  }
}
