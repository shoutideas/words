# Words by Funthinkers.com

Look up, learn, and collect vocabulary while you read on any website.

## Features

- **Highlight or double-click** any word to open a floating lookup card
- **Definitions, synonyms, antonyms**, and example sentences
- **Pronunciation** via dictionary audio, with browser speech as fallback (🔊)
- **Add words** with the `+` icon (toggles to ✓ when saved)
- **Toolbar popup** for manual search, saved-word review, and export
- **Export .txt** — download your word list anytime
- **Right-click** → "Look up in Words" on selected text

All saved words stay **on your device only** — no account required.

## Privacy policy

https://shoutideas.github.io/words/privacy-policy.html

## Development

```bash
npm install
npm run dev      # HMR development build
npm run build    # Production build → dist/
npm run zip      # Build + zip dist/ for Chrome Web Store upload
```

### Load unpacked

1. Run `npm run build`
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked** and select the `dist/` folder

## Chrome Web Store submission

1. `npm run zip` — upload `words.zip` (contents of `dist/` only)
2. Developer account ($5 one-time): [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Link privacy policy URL (GitHub Pages)
4. Screenshots: card on article + popup with saved words
5. Permissions justification:
   - `storage` — persist saved words locally
   - `contextMenus` — right-click lookup
   - `<all_urls>` — content script runs on pages you read

## Testing checklist

- [ ] Highlight single word → card with definition
- [ ] Double-click word → same card; buttons/links still work
- [ ] `+` adds word; `✓` removes; no "Save" text anywhere
- [ ] Syn / Ant / Use tabs and ↻ sentence refresh
- [ ] 🔊 pronunciation
- [ ] Popup search, saved list, Export .txt
- [ ] Context menu lookup
- [ ] API miss → "Word not found"

## License

MIT — see [LICENSE](LICENSE).

## Brand assets

`public/assets/ft.png` and extension icons that incorporate the FunThinkers logo
are © [FunThinkers](https://funthinkers.com). They are included in this
repository for use with the Words extension and may be redistributed as part of
this project.
