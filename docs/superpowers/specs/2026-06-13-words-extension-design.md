# Words Chrome Extension — Design Spec

**Date:** 2026-06-13  
**Status:** v1 implementation  
**Repo:** Standalone `words` (MV3 Chrome extension)

## Purpose

Vocabulary lookup and word collection while browsing. Students highlight or double-click words to see definitions, synonyms, antonyms, example sentences, and pronunciation. Words are saved locally with export to `.txt`.

## Activation

| Trigger | Behavior |
|---------|----------|
| Highlight (mouseup) | 1 word → lookup; 2–5 words → phrase lookup or "Select one word"; 6+ → ignore |
| Double-click | Extract word at cursor; same floating card as highlight |
| Extension icon | Toolbar popup: search, saved list, export |
| Context menu | "Look up in Words" on selection |

## UI surfaces

- **Floating card** — Shadow DOM, max 320px, tabs Def / Syn / Ant / Use, `+`/`✓` (never "Save"), 🔊, ✕
- **Popup** — Search, lookup result, MY WORDS list, Export .txt, Clear all

## Data model

```typescript
interface SavedWord {
  id: string;
  word: string;
  phonetic?: string;
  partOfSpeech?: string;
  definition: string;
  savedAt: number;
  sourceUrl?: string;
}
```

Storage: `chrome.storage.local`, key `savedWords`.

## External APIs

- **Definitions:** `https://api.dictionaryapi.dev/api/v2/entries/en/{word}` (JSON only, no key)
- **Pronunciation:** `speechSynthesis` with `en-US`

## Permissions

- `storage` — saved words locally
- `contextMenus` — right-click lookup
- `<all_urls>` — content script on pages user reads

## Store checklist

- MV3 build, icons 16/48/128, privacy policy URL, screenshots, zip `dist/` only
- No remote code; API returns data only

## Out of v1

EdAccelerator sync, spaced repetition, dark mode, CSV/Anki, offline dictionary.
