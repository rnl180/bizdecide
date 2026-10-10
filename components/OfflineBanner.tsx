"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { useLang } from "@/lib/i18n";
import { APP } from "@/lib/i18n-app";

/** A thin banner under the top bar while the browser is offline, and a short "Back online" when it returns. */
export function OfflineBanner() {
  const t = APP[useLang()];
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const off = () => {
      clearTimeout(timer);
      setState("offline");
    };
    const on = () => {
      setState("back");
      timer = setTimeout(() => setState("online"), 3000);
    };
    if (!navigator.onLine) off();
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);
  if (state === "online") return null;
  return (
    <div className={`net-banner net-${state} no-print`} role="status">
      <div className="container net-inner">
        <Icon name={state === "offline" ? "wifiOff" : "checkCircle"} size={16} />
        {state === "offline" ? t.offline : t.backOnline}
      </div>
    </div>
  );
}
