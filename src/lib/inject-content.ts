import contentScript from '../content/index.ts?script';

const CONTENT_CSS = 'src/ui/word-card.css';

function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  return /^https?:/i.test(url);
}

export async function ensureContentScript(tabId: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (!isInjectableUrl(tab.url)) return;

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return;
  } catch {
    // Content script not loaded yet on this tab.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: [contentScript],
  });
  await chrome.scripting.insertCSS({
    target: { tabId },
    files: [CONTENT_CSS],
  });
}
