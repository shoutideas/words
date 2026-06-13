export async function speakWord(word: string, audioUrl?: string): Promise<void> {
  if (audioUrl) {
    try {
      const audio = new Audio(audioUrl);
      await audio.play();
      return;
    } catch {
      // fall through to speechSynthesis
    }
  }

  if (!('speechSynthesis' in window)) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
}
