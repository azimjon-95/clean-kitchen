/**
 * Распознавание речи. Порядок:
 *  1) сервер (Whisper-совместимый, со словарём блюд) — самый точный, работает и в Telegram/WebView;
 *  2) системное распознавание (Web Speech / Capacitor) с несколькими вариантами (n-best);
 */
import { API_URL } from "../lib/api";

export type SttResult = { alternatives: string[]; engine: "server" | "device" };

let statusCache: { enabled: boolean; at: number } | null = null;
export async function serverSttEnabled(): Promise<boolean> {
  if (!navigator.onLine) return false;
  if (statusCache && Date.now() - statusCache.at < 60_000) return statusCache.enabled;
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 3500);
    const r = await fetch(`${API_URL}/api/voice/status`, { signal: ctrl.signal }); clearTimeout(t);
    const j = r.ok ? await r.json() : { enabled: false };
    statusCache = { enabled: !!j.enabled, at: Date.now() };
  } catch { statusCache = { enabled: false, at: Date.now() }; }
  return statusCache.enabled;
}

export async function transcribeOnServer(wav: Blob, lang: string): Promise<SttResult> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const r = await fetch(`${API_URL}/api/voice/transcribe?lang=${encodeURIComponent(lang.slice(0, 2))}`, {
      method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav, signal: ctrl.signal
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    const alts = [j.text, ...(Array.isArray(j.alternatives) ? j.alternatives : [])].filter((x: unknown): x is string => typeof x === "string" && !!x.trim());
    return { alternatives: Array.from(new Set(alts)), engine: "server" };
  } finally { clearTimeout(t); }
}
