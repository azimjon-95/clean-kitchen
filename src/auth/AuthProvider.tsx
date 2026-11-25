import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as doLogin, logout as doLogout, refreshSession, fetchMe, setLoggedOutHandler, startSessionKeepAlive, lastRefreshWasNetworkFail, type Me } from "./client";
import { clearAllOffline } from "../lib/offline";

type Status = "loading" | "anon" | "authed";
type Ctx = { status: Status; me: Me | null; guest: boolean; signIn(email: string, password: string): Promise<void>; signOut(): Promise<void>; reload(): Promise<void>; enterGuest(): void; setMe(m: Me): void };
const C = createContext<Ctx>(null as any);
export const useAuth = () => useContext(C);
export const GUEST_ALLOWED = String(import.meta.env.VITE_ALLOW_GUEST ?? "true").toLowerCase() !== "false";

/** Данные ресторана на устройстве привязаны к restaurantId; при смене пользователя/ресторана и при выходе они стираются */
const TENANT_KEY = "ck-tenant";
/** Профиль (без токенов и секретов) — чтобы приложение открывалось без интернета с сохранёнными картами */
const ME_KEY = "ck-me";
const saveMe = (m: Me | null) => { try { m ? localStorage.setItem(ME_KEY, JSON.stringify(m)) : localStorage.removeItem(ME_KEY); } catch { /* */ } };
const loadMe = (): Me | null => { try { return JSON.parse(localStorage.getItem(ME_KEY) || "null"); } catch { return null; } };
function wipeIfTenantChanged(me: Me | null) {
  try {
    const cur = me?.restaurant?.id ?? (me ? "platform" : "");
    const prev = localStorage.getItem(TENANT_KEY);
    if (prev !== null && prev !== cur) { void clearAllOffline(); localStorage.removeItem("ck-drafts"); }
    if (cur) localStorage.setItem(TENANT_KEY, cur);
  } catch { /* приватный режим */ }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [me, setMeState] = useState<Me | null>(null);
  const [guest, setGuest] = useState(false);

  const setMe = useCallback((m: Me) => { wipeIfTenantChanged(m); saveMe(m); setMeState(m); setStatus("authed"); setGuest(false); }, []);
  const clear = useCallback(() => { saveMe(null); setMeState(null); setStatus("anon"); }, []);

  useEffect(() => {
    setLoggedOutHandler(() => { clear(); });
    refreshSession().then((m) => {
      if (m) return setMe(m);
      const cached = lastRefreshWasNetworkFail() ? loadMe() : null;   // нет сети — открываем с сохранёнными данными
      if (cached) { setMeState(cached); setStatus("authed"); } else clear();
    }).catch(clear);
    startSessionKeepAlive((m) => setMe(m), () => clear());
  }, [clear, setMe]);

  const value = useMemo<Ctx>(() => ({
    status, me, guest,
    signIn: async (email, password) => { const m = await doLogin(email, password); setMe(m); },
    signOut: async () => { await doLogout(); try { await clearAllOffline(); localStorage.removeItem("ck-drafts"); localStorage.removeItem(TENANT_KEY); localStorage.removeItem(ME_KEY); } catch { /* */ } setGuest(false); clear(); },
    reload: async () => { setMe(await fetchMe()); },
    enterGuest: () => { setGuest(true); setStatus("anon"); },
    setMe
  }), [status, me, guest, clear, setMe]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
