import { Language } from '../types';

let currentUtterance: SpeechSynthesisUtterance | null = null;

export const speechService = {
  speak(text: string, lang: Language, onEnd?: () => void, onError?: () => void): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError?.();
      return false;
    }

    try {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      currentUtterance = utterance;

      const langMap: Record<Language, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
      };
      utterance.lang = langMap[lang] || 'en-US';
      utterance.rate = 0.95; // Clear natural pacing for medical instructions

      utterance.onend = () => {
        currentUtterance = null;
        onEnd?.();
      };
      utterance.onerror = () => {
        currentUtterance = null;
        onError?.();
      };

      window.speechSynthesis.speak(utterance);
      return true;
    } catch {
      onError?.();
      return false;
    }
  },

  stop(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      currentUtterance = null;
    }
  },

  isSpeaking(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking;
  },

  isRecognitionSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
  },

  createSpeechRecognition(lang: Language, onResult: (transcript: string) => void, onError?: () => void) {
    if (typeof window === 'undefined') return null;
    const SpeechRec = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
                      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SpeechRec) return null;

    try {
      const recognition = new SpeechRec();
      const langMap: Record<Language, string> = {
        en: 'en-IN',
        hi: 'hi-IN',
        ta: 'ta-IN',
      };
      recognition.lang = langMap[lang] || 'en-IN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || '';
        if (transcript) {
          onResult(transcript);
        }
      };

      recognition.onerror = () => {
        onError?.();
      };

      return recognition;
    } catch {
      return null;
    }
  },
};
