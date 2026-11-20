import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./style.css";
import { AuthProvider, useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { PlatformAdmin } from "./platform/PlatformAdmin";
import { isSuper } from "./auth/client";

/** Единое приложение: после входа сервер определяет роль, ресторан и права — интерфейс строится из них */
function Root() {
  const { status, me, guest, signOut, reload } = useAuth();
  if (status === "loading") return <div className="app"><p className="mg-empty" style={{ paddingTop: 120 }}>Загрузка…</p></div>;
  if (status === "anon") return guest ? <App /> : <LoginScreen />;
  if (isSuper(me)) return <PlatformAdmin me={me!} onLogout={signOut} />;
  return <App key={me!.restaurant?.id ?? "none"} me={me} onLogout={signOut} onReloadMe={reload} />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider><Root /></AuthProvider>
  </React.StrictMode>
);

// Service Worker для офлайн-оболочки
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => { /* без SW приложение работает онлайн */ });
  });
}
