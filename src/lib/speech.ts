/**
 * Clean Kitchen Speech layer
 * Priority:
 *  1. Capacitor native SpeechRecognition (when running in native shell)
 *  2. Browser Web Speech API (fallback)
 *
 * Supports ru-RU and uz-UZ.
 * Push-to-talk only — no continuous listening.
 */

export type SpeechLang = "ru-RU" | "uz-UZ";

export type SpeechCallbacks = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onEnd?: () => void;
};

type CapacitorSpeechPlugin = {
  available: () => Promise<{ available: boolean }>;
  start: (opts: { language: string; maxResults: number; partialResults: boolean; popup: boolean }) => Promise<void>;
  stop: () => Promise<void>;
  addListener: (event: string, cb: (data: any) => void) => Promise<{ remove: () => void }>;
};

function getCapacitorSpeech(): CapacitorSpeechPlugin | null {
  try {
    const cap = (window as any).Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    const plugins = cap.Plugins || {};
    return plugins.SpeechRecognition || null;
  } catch {
    return null;
  }
}

function getWebSpeech(): any {
  return (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition || null;
}

export function isSpeechSupported(): boolean {
  return !!(getCapacitorSpeech() || getWebSpeech());
}

export function getSpeechBackend(): "native" | "web" | "none" {
  if (getCapacitorSpeech()) return "native";
  if (getWebSpeech()) return "web";
  return "none";
}

export async function startSpeech(lang: SpeechLang, cb: SpeechCallbacks): Promise<() => void> {
  const native = getCapacitorSpeech();

  // ── Native Capacitor path ──
  if (native) {
    const listeners: { remove: () => void }[] = [];
    try {
      const avail = await native.available();
      if (!avail?.available) throw new Error("Native speech not available");

      const partial = await native.addListener("partialResults", (data: any) => {
        const text = (data?.matches?.[0] || "").trim();
        if (text) cb.onInterim?.(text);
      });
      listeners.push(partial);

      const result = await native.addListener("result", (data: any) => {
        const text = (data?.matches?.[0] || "").trim();
        if (text) cb.onFinal?.(text);
      });
      listeners.push(result);

      await native.start({
        language: lang,
        maxResults: 3,
        partialResults: true,
        popup: false
      });

      return () => {
        native.stop().catch(() => {});
        listeners.forEach(l => l.remove());
        cb.onEnd?.();
      };
    } catch (e: any) {
      cb.onError?.(e?.message || "Native speech error");
      return () => {};
    }
  }

  // ── Web Speech API fallback ──
  const SpeechAPI = getWebSpeech();
  if (!SpeechAPI) {
    cb.onError?.("Голосовой ввод не поддерживается на этом устройстве.");
    return () => {};
  }

  const recognition = new SpeechAPI();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  recognition.onresult = (event: any) => {
    let interim = "";
    let finalText = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const res = event.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    if (interim) cb.onInterim?.(interim);
    if (finalText.trim()) cb.onFinal?.(finalText.trim());
  };

  recognition.onerror = (event: any) => {
    const map: Record<string, string> = {
      "not-allowed": "Нет доступа к микрофону.",
      "service-not-allowed": "Сервис распознавания недоступен.",
      "no-speech": "Речь не обнаружена.",
      "audio-capture": "Микрофон не найден.",
      "network": "Ошибка сети при распознавании."
    };
    cb.onError?.(map[event.error] || `Ошибка: ${event.error}`);
  };

  recognition.onend = () => cb.onEnd?.();

  try {
    recognition.start();
  } catch {
    cb.onError?.("Не удалось запустить микрофон.");
  }

  return () => {
    try { recognition.stop(); } catch { /* */ }
  };
}
