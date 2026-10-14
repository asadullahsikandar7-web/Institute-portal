import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { makeApi, onInstituteChange } from "../lib/api.js";
import { num } from "../lib/utils.js";

const SettingsCtx = createContext(null);

// Institute branding + currency, from the unauthenticated
// /api/system/public endpoint so it's available on the login page and in
// every portal. Falls back to neutral defaults if the API is unreachable —
// nothing in the UI should block on this.
const FALLBACK = { instituteName: "ACADEXA", instituteType: "university", currency: "₨", admissionsOpen: true };

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(FALLBACK);

  const refresh = useCallback(() => {
    makeApi(null).call("GET", "/api/system/public").then(s => setSettings({ ...FALLBACK, ...s })).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);
  // Another institute chosen on the login page → its branding.
  useEffect(() => onInstituteChange(() => { setSettings(FALLBACK); refresh(); }), [refresh]);

  const money = useCallback(n => `${settings.currency}${num(n)}`, [settings.currency]);

  return <SettingsCtx.Provider value={{ settings, money, refresh }}>{children}</SettingsCtx.Provider>;
}

export function useSettings() {
  const ctx = useContext(SettingsCtx);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
